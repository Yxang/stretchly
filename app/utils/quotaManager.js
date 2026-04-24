import EventEmitter from 'events'

const DEFAULT_MICROBREAK_DURATION_MS = 20000
const DEFAULT_BREAK_DURATION_MS = 300000

function clamp (value, min, max) {
  if (value < min) return min
  if (value > max) return max
  return value
}

function pad2 (n) {
  return n < 10 ? '0' + n : '' + n
}

function toLocalISODate (date) {
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate())
}

function effectiveResetDate (now, morningHour) {
  const d = new Date(now)
  if (d.getHours() < morningHour) {
    d.setDate(d.getDate() - 1)
  }
  return toLocalISODate(d)
}

class QuotaManager extends EventEmitter {
  constructor (settings, options = {}) {
    super()
    this.settings = settings
    this.log = options.log || null

    this._started = false

    // Committed quota snapshot at _lastActiveTimestamp.
    this._miniQuotaAtLastUpdate = 100
    this._longQuotaAtLastUpdate = 100
    this._lastActiveTimestamp = Date.now()
    this._lastLongBreakTimestamp = Date.now()
    this._lastResetDate = ''
    this._harassmentRejectCount = 0

    // Freeze state.
    this._freezeReasons = new Set()
    this._freezeStartTime = 0

    // Green-tier toast debounce.
    this._greenToastArmed = true

    // Track last known tier to emit transitions.
    this._lastTierMini = 'green'
    this._lastTierLong = 'green'
  }

  // ─────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────
  start () {
    this._sanitizeTierThresholds()
    const persisted = this._readPersistedState()
    const morningHour = this._getMorningHour()
    const now = Date.now()
    const todayEffective = effectiveResetDate(now, morningHour)

    if (persisted && persisted.lastResetDate && persisted.lastResetDate === todayEffective) {
      this._miniQuotaAtLastUpdate = clamp(persisted.miniQuota, 0, 100)
      this._longQuotaAtLastUpdate = clamp(persisted.longQuota, 0, 100)
      this._lastActiveTimestamp = persisted.lastActiveTimestamp || now
      this._lastLongBreakTimestamp = persisted.lastLongBreakTimestamp || now
      this._harassmentRejectCount = persisted.harassmentRejectCount || 0
      this._lastResetDate = persisted.lastResetDate
    } else {
      this._miniQuotaAtLastUpdate = 100
      this._longQuotaAtLastUpdate = 100
      this._lastActiveTimestamp = now
      this._lastLongBreakTimestamp = now
      this._harassmentRejectCount = 0
      this._lastResetDate = todayEffective
    }

    this._freezeReasons = new Set()
    this._freezeStartTime = 0
    this._greenToastArmed = true
    this._lastTierMini = this._computeTier(this._miniQuotaAtLastUpdate)
    this._lastTierLong = this._computeTier(this._longQuotaAtLastUpdate)
    this._started = true

    this._requestPersistence()
  }

  stop () {
    if (!this._started) return
    // Commit current lazy values before persisting.
    const mini = this._computeMiniQuota()
    const long = this._computeLongQuota()
    this._miniQuotaAtLastUpdate = mini
    this._longQuotaAtLastUpdate = long
    this._lastActiveTimestamp = this._effectiveNow()
    this._persistToSettings()
    this._started = false
  }

  // ─────────────────────────────────────────────
  // Freeze / unfreeze
  // ─────────────────────────────────────────────
  freeze (reason) {
    if (!reason) reason = 'unknown'
    if (this._freezeReasons.size === 0) {
      // Commit current lazy quotas before entering frozen state.
      const mini = this._computeMiniQuota()
      const long = this._computeLongQuota()
      this._miniQuotaAtLastUpdate = mini
      this._longQuotaAtLastUpdate = long
      this._lastActiveTimestamp = Date.now()
      this._freezeStartTime = Date.now()
    }
    this._freezeReasons.add(reason)
  }

  unfreeze (reason) {
    if (this._freezeReasons.size === 0) return
    if (reason) {
      this._freezeReasons.delete(reason)
    } else {
      this._freezeReasons.clear()
    }
    if (this._freezeReasons.size === 0) {
      const frozenMs = Date.now() - this._freezeStartTime
      this._lastActiveTimestamp += frozenMs
      this._lastLongBreakTimestamp += frozenMs
      this._freezeStartTime = 0
    }
  }

  // ─────────────────────────────────────────────
  // Queries
  // ─────────────────────────────────────────────
  getMiniQuota () {
    this._maybeDailyReset()
    const q = this._computeMiniQuota()
    this._checkTierTransition('mini', q)
    return q
  }

  getLongQuota () {
    this._maybeDailyReset()
    const q = this._computeLongQuota()
    this._checkTierTransition('long', q)
    return q
  }

  getTier (breakType) {
    const q = breakType === 'long' ? this.getLongQuota() : this.getMiniQuota()
    return this._computeTier(q)
  }

  getConfig () {
    return {
      miniBreakWorkWindowMs: this._getMiniWorkWindow(),
      longBreakWorkWindowMs: this._getLongWorkWindow(),
      miniBreakRefillPerMs: 100 / this._getMicrobreakDuration(),
      longBreakRefillPerMs: 100 / this._getBreakDuration(),
      longBreakBonusToMini: this._getLongBreakBonusToMini(),
      ignoreCost: this._getIgnoreCost(),
      postponeCost: this._getPostponeCost(),
      redPostponeMultiplier: this._getRedPostponeMultiplier(),
      tierGreenMin: this._getTierGreenMin(),
      tierYellowMin: this._getTierYellowMin(),
      tierOrangeMin: this._getTierOrangeMin(),
      longBreakHardDeadlineMs: this._getHardDeadlineMs(),
      harassmentBaseIntervalMs: this._getHarassmentBaseMs(),
      harassmentMinIntervalMs: this._getHarassmentMinMs(),
      greenToastUnlockThreshold: this._getGreenToastUnlockThreshold(),
      morningHour: this._getMorningHour()
    }
  }

  getState () {
    this._maybeDailyReset()
    const miniQuota = this._computeMiniQuota()
    const longQuota = this._computeLongQuota()
    return {
      miniQuota,
      longQuota,
      isFrozen: this._freezeReasons.size > 0,
      freezeReasons: Array.from(this._freezeReasons),
      lastActiveTimestamp: this._lastActiveTimestamp,
      lastLongBreakTimestamp: this._lastLongBreakTimestamp,
      lastResetDate: this._lastResetDate,
      harassmentRejectCount: this._harassmentRejectCount,
      greenToastArmed: this._greenToastArmed
    }
  }

  // ─────────────────────────────────────────────
  // Event-driven quota mutations
  // ─────────────────────────────────────────────
  onBreakCompleted (breakType, actualDurationMs) {
    if (!this._started) return
    this._maybeDailyReset()

    // Commit current lazy values first.
    const miniNow = this._computeMiniQuota()
    const longNow = this._computeLongQuota()

    if (breakType === 'mini') {
      const refill = (actualDurationMs / this._getMicrobreakDuration()) * 100
      const newMini = clamp(miniNow + refill, 0, 100)
      this._miniQuotaAtLastUpdate = newMini
      this._longQuotaAtLastUpdate = longNow
      this._maybeReArmGreenToast(newMini)
    } else if (breakType === 'long') {
      const longRefill = (actualDurationMs / this._getBreakDuration()) * 100
      const miniBonus = actualDurationMs > 0 ? this._getLongBreakBonusToMini() : 0
      const newLong = clamp(longNow + longRefill, 0, 100)
      const newMini = clamp(miniNow + miniBonus, 0, 100)
      this._longQuotaAtLastUpdate = newLong
      this._miniQuotaAtLastUpdate = newMini
      if (actualDurationMs > 0) {
        this._lastLongBreakTimestamp = Date.now()
        this._harassmentRejectCount = 0
      }
      // Pass the resulting mini quota absolute value for the debounce check.
      this._maybeReArmGreenToast(newMini)
    }

    this._lastActiveTimestamp = this._effectiveNow()
    this._emitQuotaChanged()
    this._checkTierTransition('mini', this._miniQuotaAtLastUpdate)
    this._checkTierTransition('long', this._longQuotaAtLastUpdate)
    this._requestPersistence()
  }

  onBreakPostponed (breakType, tier) {
    if (!this._started) return
    this._maybeDailyReset()

    const miniNow = this._computeMiniQuota()
    const longNow = this._computeLongQuota()
    this._miniQuotaAtLastUpdate = miniNow
    this._longQuotaAtLastUpdate = longNow

    let cost = this._getPostponeCost()
    if (tier === 'red') cost *= this._getRedPostponeMultiplier()

    if (breakType === 'long') {
      this._longQuotaAtLastUpdate = clamp(longNow - cost, 0, 100)
    } else {
      this._miniQuotaAtLastUpdate = clamp(miniNow - cost, 0, 100)
    }
    this._lastActiveTimestamp = this._effectiveNow()

    this._emitQuotaChanged()
    this._checkTierTransition('mini', this._miniQuotaAtLastUpdate)
    this._checkTierTransition('long', this._longQuotaAtLastUpdate)
    this._requestPersistence()
  }

  onIgnored (breakType) {
    if (!this._started) return
    this._maybeDailyReset()

    const miniNow = this._computeMiniQuota()
    const longNow = this._computeLongQuota()
    this._miniQuotaAtLastUpdate = miniNow
    this._longQuotaAtLastUpdate = longNow

    const cost = this._getIgnoreCost()

    if (breakType === 'long') {
      this._longQuotaAtLastUpdate = clamp(longNow - cost, 0, 100)
    } else {
      this._miniQuotaAtLastUpdate = clamp(miniNow - cost, 0, 100)
    }
    this._lastActiveTimestamp = this._effectiveNow()

    this._emitQuotaChanged()
    this._checkTierTransition('mini', this._miniQuotaAtLastUpdate)
    this._checkTierTransition('long', this._longQuotaAtLastUpdate)
    this._requestPersistence()
  }

  onManualReset () {
    if (!this._started) return
    this._miniQuotaAtLastUpdate = 100
    this._longQuotaAtLastUpdate = 100
    this._lastActiveTimestamp = this._effectiveNow()
    this._harassmentRejectCount = 0
    this._greenToastArmed = true
    this._emitQuotaChanged()
    this._checkTierTransition('mini', 100)
    this._checkTierTransition('long', 100)
    this._requestPersistence()
  }

  // ─────────────────────────────────────────────
  // Hard deadline / harassment
  // ─────────────────────────────────────────────
  shouldTriggerHardDeadline () {
    const now = this._effectiveNow()
    return (now - this._lastLongBreakTimestamp) >= this._getHardDeadlineMs()
  }

  onHarassmentRejected () {
    if (!this._started) return
    this._harassmentRejectCount += 1
    this._requestPersistence()
  }

  getHarassmentIntervalMs () {
    const base = this._getHarassmentBaseMs()
    const min = this._getHarassmentMinMs()
    const k = this._harassmentRejectCount
    return Math.max(min, Math.floor(base / (k + 1)))
  }

  // ─────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────
  _effectiveNow () {
    return this._freezeReasons.size > 0 ? this._freezeStartTime : Date.now()
  }

  _maybeDailyReset () {
    const morningHour = this._getMorningHour()
    const todayEffective = effectiveResetDate(Date.now(), morningHour)
    if (this._lastResetDate && this._lastResetDate !== todayEffective &&
        todayEffective > this._lastResetDate) {
      if (this.log && typeof this.log.info === 'function') {
        this.log.info('Stretchly: quota daily reset (crossed morning boundary)')
      }
      this._miniQuotaAtLastUpdate = 100
      this._longQuotaAtLastUpdate = 100
      this._lastActiveTimestamp = Date.now()
      this._lastResetDate = todayEffective
      this._greenToastArmed = true
      this._emitQuotaChanged()
      this._requestPersistence()
    }
  }

  _computeMiniQuota () {
    if (this._freezeReasons.size > 0) {
      // When frozen, no consumption.
      return clamp(this._miniQuotaAtLastUpdate, 0, 100)
    }
    const window = this._getMiniWorkWindow()
    if (!window || window <= 0) return clamp(this._miniQuotaAtLastUpdate, 0, 100)
    const elapsed = Date.now() - this._lastActiveTimestamp
    const consume = (elapsed / window) * 100
    return clamp(this._miniQuotaAtLastUpdate - consume, 0, 100)
  }

  _computeLongQuota () {
    if (this._freezeReasons.size > 0) {
      return clamp(this._longQuotaAtLastUpdate, 0, 100)
    }
    const window = this._getLongWorkWindow()
    if (!window || window <= 0) return clamp(this._longQuotaAtLastUpdate, 0, 100)
    const elapsed = Date.now() - this._lastActiveTimestamp
    const consume = (elapsed / window) * 100
    return clamp(this._longQuotaAtLastUpdate - consume, 0, 100)
  }

  _computeTier (quota) {
    if (quota > this._getTierGreenMin()) return 'green'
    if (quota >= this._getTierYellowMin()) return 'yellow'
    if (quota > this._getTierOrangeMin()) return 'orange'
    return 'red'
  }

  _checkTierTransition (breakType, quota) {
    const newTier = this._computeTier(quota)
    const key = breakType === 'long' ? '_lastTierLong' : '_lastTierMini'
    const oldTier = this[key]
    if (newTier !== oldTier) {
      this[key] = newTier
      // Green-tier toast debounce: disarm when leaving green.
      if (breakType === 'mini' && oldTier === 'green' && newTier !== 'green') {
        this._greenToastArmed = false
      }
      this.emit('tierChanged', breakType, oldTier, newTier)
    }
  }

  _maybeReArmGreenToast (newQuota) {
    if (!this._greenToastArmed && newQuota >= this._getGreenToastUnlockThreshold()) {
      this._greenToastArmed = true
    }
  }

  _emitQuotaChanged () {
    this.emit('quotaChanged', {
      miniQuota: this._miniQuotaAtLastUpdate,
      longQuota: this._longQuotaAtLastUpdate
    })
  }

  _requestPersistence () {
    this.emit('persistenceRequested')
  }

  _persistToSettings () {
    try {
      this.settings.set('__quotaState__', {
        miniQuota: this._miniQuotaAtLastUpdate,
        longQuota: this._longQuotaAtLastUpdate,
        lastActiveTimestamp: this._lastActiveTimestamp,
        lastLongBreakTimestamp: this._lastLongBreakTimestamp,
        lastResetDate: this._lastResetDate,
        harassmentRejectCount: this._harassmentRejectCount,
        isFrozen: this._freezeReasons.size > 0
      })
    } catch (err) {
      if (this.log && typeof this.log.warn === 'function') {
        this.log.warn('Stretchly: quota persistence failed: ' + err.message)
      }
    }
  }

  _readPersistedState () {
    try {
      const raw = this.settings.get('__quotaState__')
      if (!raw) return null
      if (typeof raw !== 'object') return null
      return raw
    } catch (err) {
      if (this.log && typeof this.log.warn === 'function') {
        this.log.warn('Stretchly: quota state read failed, resetting: ' + err.message)
      }
      return null
    }
  }

  // ─────────────────────────────────────────────
  // Settings readers with fallbacks
  // ─────────────────────────────────────────────
  _getMiniWorkWindow () {
    return this.settings.get('miniBreakWorkWindowMs') || 1500000
  }

  _getLongWorkWindow () {
    return this.settings.get('longBreakWorkWindowMs') || 7200000
  }

  _getMicrobreakDuration () {
    return this.settings.get('microbreakDuration') || DEFAULT_MICROBREAK_DURATION_MS
  }

  _getBreakDuration () {
    return this.settings.get('breakDuration') || DEFAULT_BREAK_DURATION_MS
  }

  _getLongBreakBonusToMini () {
    const v = this.settings.get('longBreakBonusToMini')
    return (v === undefined || v === null) ? 50 : v
  }

  _getIgnoreCost () {
    const v = this.settings.get('ignoreCost')
    return (v === undefined || v === null) ? 5 : v
  }

  _getPostponeCost () {
    const v = this.settings.get('postponeCost')
    return (v === undefined || v === null) ? 10 : v
  }

  _getRedPostponeMultiplier () {
    const v = this.settings.get('redPostponeMultiplier')
    return (v === undefined || v === null) ? 2 : v
  }

  _getTierGreenMin () {
    const v = this.settings.get('tierGreenMin')
    return (v === undefined || v === null) ? 70 : v
  }

  _getTierYellowMin () {
    const v = this.settings.get('tierYellowMin')
    return (v === undefined || v === null) ? 30 : v
  }

  _getTierOrangeMin () {
    const v = this.settings.get('tierOrangeMin')
    return (v === undefined || v === null) ? 10 : v
  }

  _sanitizeTierThresholds () {
    if (this.settings.get('schedulingMode') !== 'quota') return

    const gRaw = this.settings.get('tierGreenMin')
    const yRaw = this.settings.get('tierYellowMin')
    const oRaw = this.settings.get('tierOrangeMin')

    const validRaw = Number.isFinite(gRaw) && gRaw > 0 &&
                     Number.isFinite(yRaw) && yRaw > 0 &&
                     Number.isFinite(oRaw) && oRaw > 0

    if (!validRaw) {
      this.settings.set('tierGreenMin', 70)
      this.settings.set('tierYellowMin', 30)
      this.settings.set('tierOrangeMin', 10)
      if (this.log && typeof this.log.warn === 'function') {
        this.log.warn(`Stretchly: tier thresholds invalid (${gRaw}/${yRaw}/${oRaw}), reset to defaults`)
      }
      return
    }

    let yellow = yRaw
    let orange = oRaw

    if (yellow >= gRaw) yellow = gRaw - 1
    if (orange >= yellow) orange = yellow - 1

    if (orange <= 0) {
      this.settings.set('tierGreenMin', 70)
      this.settings.set('tierYellowMin', 30)
      this.settings.set('tierOrangeMin', 10)
      if (this.log && typeof this.log.warn === 'function') {
        this.log.warn(`Stretchly: tier thresholds cascade reached zero (${gRaw}/${yRaw}/${oRaw}), reset to defaults`)
      }
      return
    }

    const changed = yellow !== yRaw || orange !== oRaw
    if (changed) {
      this.settings.set('tierGreenMin', gRaw)
      this.settings.set('tierYellowMin', yellow)
      this.settings.set('tierOrangeMin', orange)
      if (this.log && typeof this.log.warn === 'function') {
        this.log.warn(`Stretchly: tier thresholds corrected (${gRaw}/${yRaw}/${oRaw} → ${gRaw}/${yellow}/${orange})`)
      }
    }
  }

  _getHardDeadlineMs () {
    return this.settings.get('longBreakHardDeadlineMs') || 7200000
  }

  _getHarassmentBaseMs () {
    return this.settings.get('harassmentBaseIntervalMs') || 600000
  }

  _getHarassmentMinMs () {
    return this.settings.get('harassmentMinIntervalMs') || 30000
  }

  _getGreenToastUnlockThreshold () {
    const v = this.settings.get('greenToastUnlockThreshold')
    return (v === undefined || v === null) ? 80 : v
  }

  _getMorningHour () {
    const v = this.settings.get('morningHour')
    return (v === undefined || v === null) ? 6 : v
  }
}

export default QuotaManager
