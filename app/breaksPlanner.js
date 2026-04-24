import Scheduler from './utils/scheduler.js'
import EventEmitter from 'events'
import NaturalBreaksManager from './utils/naturalBreaksManager.js'
import DndManager from './utils/dndManager.js'
import AppExclusionsManager from './utils/appExclusionsManager.js'
import QuotaManager from './utils/quotaManager.js'
import log from 'electron-log/main.js'

class BreaksPlanner extends EventEmitter {
  constructor (settings) {
    super()
    this.settings = settings
    this.breakNumber = 0
    this.postponesNumber = 0
    this.scheduler = null
    this.isPaused = false
    this.naturalBreaksManager = new NaturalBreaksManager(settings)
    this.dndManager = new DndManager(settings)
    this.appExclusionsManager = new AppExclusionsManager(settings)

    // Quota-mode fields (remain null in classic mode — zero regression).
    this.schedulingMode = settings.get('schedulingMode') || 'classic'
    this._quotaManager = null
    this.deadlineScheduler = null

    if (this.schedulingMode === 'quota') {
      this._installQuotaManager(new QuotaManager(settings, { log }))
      if (this._quotaManager && typeof this._quotaManager.start === 'function') {
        this._quotaManager.start()
      }
    }

    this._wireSelfEvents()
    this._wireManagerEvents()
  }

  // Event wiring: break lifecycle events emitted on the planner itself.
  _wireSelfEvents () {
    this.on('microbreakStarted', (shouldPlaySound) => {
      const interval = this.settings.get('microbreakDuration')
      this.scheduler = new Scheduler(() => this.emit('finishMicrobreak', shouldPlaySound, true), interval, 'finishMicrobreak')
      this.scheduler.plan()
    })

    this.on('breakStarted', (shouldPlaySound) => {
      const interval = this.settings.get('breakDuration')
      this.scheduler = new Scheduler(() => this.emit('finishBreak', shouldPlaySound, true), interval, 'finishBreak')
      this.scheduler.plan()
    })

    // Quota-mode: when a microbreak ends, check whether a long-break hard
    // deadline is pending. If so, start the long break immediately instead
    // of returning to work. See AC 10 / PLANNING §4 edge 16.
    this.on('finishMicrobreak', () => {
      if (this.schedulingMode !== 'quota' || !this._quotaManager) return
      const qm = this._quotaManager
      if (typeof qm.onBreakCompleted === 'function') {
        qm.onBreakCompleted('mini', this.settings.get('microbreakDuration') || 0)
      }
      if (typeof qm.shouldTriggerHardDeadline === 'function' && qm.shouldTriggerHardDeadline()) {
        this.skipToBreak(100)
      }
    })

    // Quota-mode: finishBreak resets harassment counter via QuotaManager.
    this.on('finishBreak', () => {
      if (this.schedulingMode !== 'quota' || !this._quotaManager) return
      const qm = this._quotaManager
      if (typeof qm.onBreakCompleted === 'function') {
        qm.onBreakCompleted('long', this.settings.get('breakDuration') || 0)
      }
    })

    // Soft reminder action routing (AC 7, IF-4).
    this.on('softReminderAction', (action, breakType) => {
      this._handleSoftReminderAction(action, breakType)
    })

    // Harassment-mode rejection (deadlineScheduler reschedules with
    // harassmentRepeat reference; interval shrinks each rejection).
    this.on('harassmentRejected', () => {
      this._handleHarassmentRejected()
    })
  }

  // Event wiring: external managers (natural breaks / DnD / app exclusions).
  _wireManagerEvents () {
    this.naturalBreaksManager.on('clearBreakScheduler', () => this._onIdleStarted())
    this.naturalBreaksManager.on('naturalBreakFinished', () => this._onIdleFinished())
    this.dndManager.on('dndStarted', () => this._onDndStarted())
    this.dndManager.on('dndFinished', () => this._onDndFinished())
    this.appExclusionsManager.on('appExclusionStarted', (rule, exclusion) => {
      this._onAppExclusionStarted(rule, exclusion)
    })
    this.appExclusionsManager.on('appExclusionFinished', (rule) => {
      this._onAppExclusionFinished(rule)
    })
  }

  // True when we are in the middle of an active break window; we must not
  // disturb the active break scheduler on pause/resume events.
  _isInActiveBreak () {
    if (!this.scheduler) return false
    const ref = this.scheduler.reference
    return ref === 'finishMicrobreak' || ref === 'finishBreak'
  }

  _canPauseScheduler () {
    return !this.isPaused && this.scheduler && !this._isInActiveBreak() && this.scheduler.reference !== null
  }

  _canResumeScheduler () {
    return !this.isPaused && this.scheduler && !this._isInActiveBreak()
  }

  _onIdleStarted () {
    if (this._canPauseScheduler()) {
      this.clear()
      log.info('Stretchly: pausing breaks because of idle time')
    }
    this._freezeQuota('idle')
  }

  _onIdleFinished () {
    if (this._canResumeScheduler() && !this.dndManager.isOnDnd) {
      this.reset()
      log.info('Stretchly: resuming breaks after idle time')
      this.emit('updateToolTip')
    }
    this._unfreezeQuota('idle')
  }

  _onDndStarted () {
    if (this._canPauseScheduler()) {
      this.clear()
      log.info('Stretchly: pausing breaks for Do Not Distrub')
      this.emit('updateToolTip')
    } else if (this.scheduler && this.scheduler.reference !== null) {
      // Nothing to clear (already inside a break); leave DnD flag unset so
      // the subsequent break finish triggers a normal resume.
      this.dndManager.isOnDnd = false
    }
    this._freezeQuota('dnd')
  }

  _onDndFinished () {
    if (this._canResumeScheduler()) {
      this.reset()
      log.info('Stretchly: resuming breaks for Do Not Distrub')
      this.emit('updateToolTip')
    }
    this._unfreezeQuota('dnd')
  }

  _onAppExclusionStarted (rule, exclusion) {
    if (rule === 'pause') {
      if (this._canPauseScheduler()) {
        this.clear()
        log.info(`Stretchly: pausing breaks as 'pause' exclusion found running: '${exclusion}'`)
        this.emit('updateToolTip')
      } else if (!this.isPaused && this.scheduler && this.scheduler.reference === 'finishBreak') {
        this.emit('finishBreak', false, false)
        this.clear()
        log.info(`Stretchly: closing current and pausing breaks as 'pause' exclusion found running: '${exclusion}'`)
        this.emit('updateToolTip')
      } else if (!this.isPaused && this.scheduler && this.scheduler.reference === 'finishMicrobreak') {
        this.emit('finishMicrobreak', false, false)
        this.clear()
        log.info(`Stretchly: closing current and pausing breaks as 'pause' exclusion found running: '${exclusion}'`)
        this.emit('updateToolTip')
      } else {
        this.appExclusionsManager.inOnException = false
      }
      this._freezeQuota('appExclusion')
    } else if (rule === 'resume') {
      if (this._canResumeScheduler()) {
        this.reset()
        log.info(`Stretchly: resuming breaks as 'resume' exclusion found running: '${exclusion}'`)
        this.emit('updateToolTip')
      }
      this._unfreezeQuota('appExclusion')
    }
  }

  _onAppExclusionFinished (rule) {
    if (rule === 'pause') {
      if (this._canResumeScheduler()) {
        this.reset()
        log.info("Stretchly: resuming breaks as no 'pause' exclusion found running")
        this.emit('updateToolTip')
      }
      this._unfreezeQuota('appExclusion')
    } else if (rule === 'resume') {
      if (this._canPauseScheduler()) {
        this.clear()
        log.info("Stretchly: pausing breaks as no 'resume' exclusion found running")
        this.emit('updateToolTip')
      } else {
        this.appExclusionsManager.inOnException = true
      }
      this._freezeQuota('appExclusion')
    }
  }

  // ─────────────────────────────────────────────
  // QuotaManager plumbing
  // ─────────────────────────────────────────────
  get quotaManager () {
    return this._quotaManager
  }

  set quotaManager (qm) {
    this._installQuotaManager(qm)
  }

  _installQuotaManager (qm) {
    this._quotaManager = qm
    if (!qm) return
    // Wrap emit so that both real QuotaManager instances and test mocks
    // forward quota/tier events to this planner. We preserve the original
    // emit so subscribers attached via qm.on() still fire.
    const origEmit = qm.emit ? qm.emit.bind(qm) : null
    qm.emit = (event, ...args) => {
      let result
      if (origEmit) result = origEmit(event, ...args)
      if (event === 'quotaChanged') {
        this._onQuotaChanged(args[0] || {})
      } else if (event === 'tierChanged') {
        this._onTierChanged(args[0], args[1], args[2])
      }
      return result
    }
  }

  _onQuotaChanged (payload) {
    if (this.schedulingMode !== 'quota' || !this._quotaManager) return
    const qm = this._quotaManager
    const miniQuota = typeof payload.miniQuota === 'number'
      ? payload.miniQuota
      : (typeof qm.getMiniQuota === 'function' ? qm.getMiniQuota() : 0)
    const longQuota = typeof payload.longQuota === 'number'
      ? payload.longQuota
      : (typeof qm.getLongQuota === 'function' ? qm.getLongQuota() : 0)
    const miniTier = typeof qm.getTier === 'function' ? qm.getTier('mini') : 'green'
    const longTier = typeof qm.getTier === 'function' ? qm.getTier('long') : 'green'
    this.emit('quotaChanged', { miniQuota, longQuota, miniTier, longTier })
  }

  _onTierChanged (breakType, oldTier, newTier) {
    if (this.schedulingMode !== 'quota' || !this._quotaManager) return
    this.emit('tierChanged', breakType, oldTier, newTier)
  }

  _freezeQuota (reason) {
    if (this.schedulingMode !== 'quota' || !this._quotaManager) return
    const qm = this._quotaManager
    if (typeof qm.freeze === 'function') qm.freeze(reason)
    this._cancelDeadlineScheduler()
  }

  _unfreezeQuota (reason) {
    if (this.schedulingMode !== 'quota' || !this._quotaManager) return
    const qm = this._quotaManager
    if (typeof qm.unfreeze === 'function') qm.unfreeze(reason)
    // Re-arm deadline scheduler so the hard deadline keeps tracking.
    this._ensureDeadlineScheduler()
  }

  // ─────────────────────────────────────────────
  // Scheduling mode switching
  // ─────────────────────────────────────────────
  setSchedulingMode (mode) {
    if (mode !== 'classic' && mode !== 'quota') return
    if (mode === this.schedulingMode) return

    if (mode === 'classic') {
      // Tear down quota-specific state but do not disturb an active break.
      if (this._quotaManager && typeof this._quotaManager.stop === 'function') {
        this._quotaManager.stop()
      }
      this._cancelDeadlineScheduler()
      this.deadlineScheduler = null
      this._quotaManager = null
      this.schedulingMode = 'classic'
    } else {
      this.schedulingMode = 'quota'
      if (!this._quotaManager) {
        this._installQuotaManager(new QuotaManager(this.settings, { log }))
        if (this._quotaManager && typeof this._quotaManager.start === 'function') {
          this._quotaManager.start()
        }
      }
      // Deadline scheduler starts only when a break cycle is running.
      if (this.scheduler && this.scheduler.reference !== 'finishMicrobreak' && this.scheduler.reference !== 'finishBreak') {
        this._ensureDeadlineScheduler()
      }
    }
  }

  // ─────────────────────────────────────────────
  // Public helpers for main.js (power / manual freeze)
  // ─────────────────────────────────────────────
  freeze (reason) {
    this._freezeQuota(typeof reason === 'string' ? reason : 'manual')
  }

  onPowerResume () {
    if (this.schedulingMode === 'quota' && this._quotaManager) {
      if (typeof this._quotaManager.unfreeze === 'function') {
        this._quotaManager.unfreeze()
      }
      this._ensureDeadlineScheduler()
    }
    this.correctScheduler()
  }

  // ─────────────────────────────────────────────
  // Break scheduling
  // ─────────────────────────────────────────────
  nextBreak () {
    this.postponesNumber = 0
    if (this.scheduler) this.scheduler.cancel()

    if (this.schedulingMode === 'quota' && this._quotaManager) {
      this._scheduleNextQuotaBreak()
      this._ensureDeadlineScheduler()
      return
    }

    this._scheduleNextClassicBreak()
  }

  _scheduleNextClassicBreak () {
    const shouldBreak = this.settings.get('break')
    const shouldMicrobreak = this.settings.get('microbreak')
    const interval = this.settings.get('microbreakInterval')
    const breakNotification = this.settings.get('breakNotification')
    const breakNotificationInterval = this.settings.get('breakNotificationInterval')
    const microbreakNotification = this.settings.get('microbreakNotification')
    const microbreakNotificationInterval = this.settings.get('microbreakNotificationInterval')
    if (!shouldBreak && shouldMicrobreak) {
      if (microbreakNotification) {
        this.scheduler = new Scheduler(() => this.emit('startMicrobreakNotification'), interval - microbreakNotificationInterval, 'startMicrobreakNotification')
      } else {
        this.scheduler = new Scheduler(() => this.emit('startMicrobreak'), interval, 'startMicrobreak')
      }
    } else if (shouldBreak && !shouldMicrobreak) {
      if (breakNotification) {
        this.scheduler = new Scheduler(() => this.emit('startBreakNotification'), interval * (this.settings.get('breakInterval') + 1) - breakNotificationInterval, 'startBreakNotification')
      } else {
        this.scheduler = new Scheduler(() => this.emit('startBreak'), interval * (this.settings.get('breakInterval') + 1), 'startBreak')
      }
    } else if (shouldBreak && shouldMicrobreak) {
      this.breakNumber = this.breakNumber + 1
      const breakInterval = this.settings.get('breakInterval') + 1
      if (this.breakNumber % breakInterval === 0) {
        if (breakNotification) {
          this.scheduler = new Scheduler(() => this.emit('startBreakNotification'), interval - breakNotificationInterval, 'startBreakNotification')
        } else {
          this.scheduler = new Scheduler(() => this.emit('startBreak'), interval, 'startBreak')
        }
      } else {
        if (microbreakNotification) {
          this.scheduler = new Scheduler(() => this.emit('startMicrobreakNotification'), interval - microbreakNotificationInterval, 'startMicrobreakNotification')
        } else {
          this.scheduler = new Scheduler(() => this.emit('startMicrobreak'), interval, 'startMicrobreak')
        }
      }
    }
    if (this.scheduler) this.scheduler.plan()
  }

  _scheduleNextQuotaBreak () {
    const qm = this._quotaManager
    const shouldBreak = this.settings.get('break')
    const shouldMicrobreak = this.settings.get('microbreak')
    const miniTier = shouldMicrobreak && typeof qm.getTier === 'function' ? qm.getTier('mini') : null
    const longTier = shouldBreak && typeof qm.getTier === 'function' ? qm.getTier('long') : null

    // Double red: long break wins over mini (PLANNING §4 edge: long takes priority).
    if (longTier === 'red') {
      this.scheduler = new Scheduler(() => this.emit('startBreak'), 100, 'startBreak')
      this.scheduler.plan()
      return
    }
    if (miniTier === 'red') {
      this.scheduler = new Scheduler(() => this.emit('startMicrobreak'), 100, 'startMicrobreak')
      this.scheduler.plan()
      return
    }

    const softReminder = this._pickSoftReminder(miniTier, longTier)
    if (softReminder) {
      const delay = softReminder.tier === 'orange'
        ? (this.settings.get('softReminderOrangeIntervalMs') || 120000)
        : (this.settings.get('softReminderYellowIntervalMs') || 300000)
      this.scheduler = new Scheduler(
        () => this.emit('startSoftReminder', softReminder.breakType, softReminder.tier),
        delay,
        'startSoftReminder'
      )
      this.scheduler.plan()
      return
    }

    // Green (or disabled) tier: reuse classic cadence.
    this._scheduleNextClassicBreak()
  }

  _pickSoftReminder (miniTier, longTier) {
    const candidates = []
    if (miniTier === 'yellow' || miniTier === 'orange') candidates.push({ breakType: 'mini', tier: miniTier })
    if (longTier === 'yellow' || longTier === 'orange') candidates.push({ breakType: 'long', tier: longTier })
    if (candidates.length === 0) return null
    // Orange beats yellow; on a tie, long beats mini.
    candidates.sort((a, b) => {
      if (a.tier === b.tier) return a.breakType === 'long' ? -1 : 1
      return a.tier === 'orange' ? -1 : 1
    })
    return candidates[0]
  }

  nextBreakAfterNotification () {
    this.scheduler.cancel()
    const scheduledBreakType = this._scheduledBreakType
    const breakNotificationInterval = this.settings.get(`${scheduledBreakType}NotificationInterval`)
    const eventName = `start${scheduledBreakType.charAt(0).toUpperCase() + scheduledBreakType.slice(1)}`
    this.scheduler = new Scheduler(() => this.emit(eventName), breakNotificationInterval, eventName)
    this.scheduler.plan()
  }

  postponeCurrentBreak () {
    this.scheduler.cancel()
    this.postponesNumber += 1
    let postponeTime, eventName
    const scheduledBreakType = this._scheduledBreakType
    const notification = this.settings.get(`${scheduledBreakType}Notification`)
    if (notification && this.settings.get(`${scheduledBreakType}PostponeTime`) > this.settings.get(`${scheduledBreakType}NotificationInterval`)) {
      postponeTime = this.settings.get(`${scheduledBreakType}PostponeTime`) - this.settings.get(`${scheduledBreakType}NotificationInterval`)
      eventName = `start${scheduledBreakType.charAt(0).toUpperCase() + scheduledBreakType.slice(1)}Notification`
    } else {
      postponeTime = this.settings.get(`${scheduledBreakType}PostponeTime`)
      eventName = `start${scheduledBreakType.charAt(0).toUpperCase() + scheduledBreakType.slice(1)}`
    }
    this.scheduler = new Scheduler(() => this.emit(eventName), postponeTime, eventName)
    this.scheduler.plan()
    this.emit('updateToolTip')
  }

  skipToMicrobreak (delay = 100) {
    if (this.scheduler) this.scheduler.cancel()
    const shouldBreak = this.settings.get('break')
    const shouldMicrobreak = this.settings.get('microbreak')
    if (shouldBreak && shouldMicrobreak) {
      const breakInterval = this.settings.get('breakInterval') + 1
      if (this.breakNumber % breakInterval === 0) {
        this.breakNumber = 1
      }
    }
    this.scheduler = new Scheduler(() => this.emit('startMicrobreak'), delay, 'startMicrobreak')
    this.scheduler.plan()
    this.emit('updateToolTip')
  }

  skipToBreak (delay = 100) {
    if (this.scheduler) this.scheduler.cancel()
    const shouldBreak = this.settings.get('break')
    const shouldMicrobreak = this.settings.get('microbreak')
    if (shouldBreak && shouldMicrobreak) {
      const breakInterval = this.settings.get('breakInterval') + 1
      this.breakNumber = breakInterval
    }
    this.scheduler = new Scheduler(() => this.emit('startBreak'), delay, 'startBreak')
    this.scheduler.plan()
    this.emit('updateToolTip')
  }

  clear () {
    if (this.scheduler) this.scheduler.cancel()
    this.breakNumber = 0
    this.postponesNumber = 0
  }

  pause (milliseconds) {
    this.clear()
    this.isPaused = true
    if (milliseconds !== 1) {
      this.scheduler = new Scheduler(() => this.emit('resumeBreaks'), milliseconds, 'resumeBreaks')
      this.scheduler.plan()
    }
  }

  resume () {
    if (this.scheduler) this.scheduler.cancel()
    this.isPaused = false
    this.appExclusionsManager.reset()
    this.nextBreak()
  }

  correctScheduler () {
    if (this.scheduler) this.scheduler.correct()
    if (this.deadlineScheduler) this.deadlineScheduler.correct()
  }

  reset () {
    this.clear()
    this.resume()
  }

  // ─────────────────────────────────────────────
  // Soft reminder handlers
  // ─────────────────────────────────────────────
  _handleSoftReminderAction (action, breakType) {
    if (this.schedulingMode !== 'quota' || !this._quotaManager) return
    const qm = this._quotaManager
    switch (action) {
      case 'takeNow':
        if (breakType === 'long') {
          this.skipToBreak(100)
        } else {
          this.skipToMicrobreak(100)
        }
        break
      case 'postpone': {
        const tier = typeof qm.getTier === 'function' ? qm.getTier(breakType || 'mini') : 'yellow'
        if (typeof qm.onBreakPostponed === 'function') {
          qm.onBreakPostponed(breakType || 'mini', tier)
        }
        this._scheduleSoftReminderRepeat(breakType)
        break
      }
      case 'ignore':
        if (typeof qm.onIgnored === 'function') {
          qm.onIgnored(breakType || 'mini')
        }
        this._scheduleSoftReminderRepeat(breakType)
        break
      case 'autoClose':
        // Auto-dismiss path: no quota deduction; just reschedule (AC 7.9/7.10).
        this._scheduleSoftReminderRepeat(breakType)
        break
      default:
        break
    }
  }

  _scheduleSoftReminderRepeat (breakType) {
    if (this.scheduler) this.scheduler.cancel()
    const qm = this._quotaManager
    const tier = qm && typeof qm.getTier === 'function' ? qm.getTier(breakType || 'mini') : 'yellow'
    const delay = tier === 'orange'
      ? (this.settings.get('softReminderOrangeIntervalMs') || 120000)
      : (this.settings.get('softReminderYellowIntervalMs') || 300000)
    this.scheduler = new Scheduler(
      () => this.emit('startSoftReminder', breakType || 'mini', tier),
      delay,
      'softReminderRepeat'
    )
    this.scheduler.plan()
  }

  // ─────────────────────────────────────────────
  // Long-break hard deadline / harassment mode
  // ─────────────────────────────────────────────
  _ensureDeadlineScheduler () {
    if (this.schedulingMode !== 'quota' || !this._quotaManager) return
    if (this.deadlineScheduler && this.deadlineScheduler.timer !== null) return
    this._planDeadlineScheduler()
  }

  _planDeadlineScheduler () {
    const delay = this.settings.get('longBreakHardDeadlineMs') || 7200000
    this.deadlineScheduler = new Scheduler(
      () => this._onDeadlineTick(),
      delay,
      'longBreakDeadlineTick'
    )
    this.deadlineScheduler.plan()
  }

  _cancelDeadlineScheduler () {
    if (this.deadlineScheduler) this.deadlineScheduler.cancel()
  }

  _onDeadlineTick () {
    if (this.schedulingMode !== 'quota' || !this._quotaManager) return
    const qm = this._quotaManager
    if (typeof qm.shouldTriggerHardDeadline === 'function' && qm.shouldTriggerHardDeadline()) {
      this.emit('longBreakHardDeadline')
    }
  }

  _handleHarassmentRejected () {
    if (this.schedulingMode !== 'quota' || !this._quotaManager) return
    const qm = this._quotaManager
    if (typeof qm.onHarassmentRejected === 'function') {
      qm.onHarassmentRejected()
    }
    const delay = typeof qm.getHarassmentIntervalMs === 'function'
      ? qm.getHarassmentIntervalMs()
      : (this.settings.get('harassmentBaseIntervalMs') || 600000)
    if (this.deadlineScheduler) this.deadlineScheduler.cancel()
    this.deadlineScheduler = new Scheduler(
      () => this._onDeadlineTick(),
      delay,
      'harassmentRepeat'
    )
    this.deadlineScheduler.plan()
  }

  // ─────────────────────────────────────────────
  // Legacy helpers (unchanged)
  // ─────────────────────────────────────────────
  get _scheduledBreakType () {
    const shouldBreak = this.settings.get('break')
    const shouldMicrobreak = this.settings.get('microbreak')
    const breakInterval = this.settings.get('breakInterval') + 1
    let scheduledBreakType
    if (shouldBreak && shouldMicrobreak) {
      scheduledBreakType = this.breakNumber % breakInterval !== 0 ? 'microbreak' : 'break'
    } else if (!shouldBreak) {
      scheduledBreakType = 'microbreak'
    } else if (!shouldMicrobreak) {
      scheduledBreakType = 'break'
    }
    return scheduledBreakType
  }

  naturalBreaks (shouldUse) {
    if (shouldUse) {
      this.naturalBreaksManager.start()
    } else {
      this.naturalBreaksManager.stop()
    }
  }

  doNotDisturb (shouldUse) {
    if (shouldUse) {
      this.dndManager.start()
    } else {
      this.dndManager.stop()
      if (!this.isPaused && this.scheduler && this.scheduler.reference === null) {
        this.reset()
      }
    }
  }

  get timeToNextBreak () {
    if (!this.scheduler) return null
    if (this.scheduler.reference === 'startMicrobreak' || this.scheduler.reference === 'startBreak') {
      return this.scheduler.timeLeft
    }
    if (this.scheduler.reference === 'startBreakNotification') {
      return this.scheduler.timeLeft + (this.settings.get('breakNotification')
        ? this.settings.get('breakNotificationInterval')
        : 0)
    }
    if (this.scheduler.reference === 'startMicrobreakNotification') {
      return this.scheduler.timeLeft + (this.settings.get('microbreakNotification')
        ? this.settings.get('microbreakNotificationInterval')
        : 0)
    }
    return null
  }

  get _progressInterval () {
    if (!this.scheduler) return null
    const { reference, delay } = this.scheduler

    if (reference === 'startMicrobreak' || reference === 'startBreak') {
      return delay
    }

    if (reference === 'startBreakNotification') {
      return delay + this.settings.get('breakNotificationInterval')
    }

    if (reference === 'startMicrobreakNotification') {
      return delay + this.settings.get('microbreakNotificationInterval')
    }

    return null
  }

  get progressPercentage () {
    const total = this._progressInterval
    const remaining = this.timeToNextBreak
    if (total === null || total <= 0 || remaining === null) return 0

    const progress = 1 - (remaining / total)
    return Math.max(0, Math.min(100, Math.round(progress * 100)))
  }
}

export default BreaksPlanner
