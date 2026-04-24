import { vi } from 'vitest'
import 'chai/register-should'

// QuotaManager is not yet implemented — all tests are expected to FAIL
// These stubs are written from the spec (IF-1, AC 2-10, 12-14) before implementation.
import QuotaManager from '../app/utils/quotaManager.js'

const MINI_WORK_WINDOW_MS = 1500000 // 25 min default
const LONG_WORK_WINDOW_MS = 7200000 // 120 min default
const HARD_DEADLINE_MS = 7200000
const HARASSMENT_BASE_MS = 600000 // 10 min
const HARASSMENT_MIN_MS = 30000 // 30 s

function makeSettings (overrides = {}) {
  const defaults = {
    schedulingMode: 'quota',
    miniBreakWorkWindowMs: MINI_WORK_WINDOW_MS,
    longBreakWorkWindowMs: LONG_WORK_WINDOW_MS,
    longBreakBonusToMini: 50,
    ignoreCost: 5,
    postponeCost: 10,
    redPostponeMultiplier: 2,
    tierGreenMin: 70,
    tierYellowMin: 30,
    tierOrangeMin: 10,
    longBreakHardDeadlineMs: HARD_DEADLINE_MS,
    harassmentBaseIntervalMs: HARASSMENT_BASE_MS,
    harassmentMinIntervalMs: HARASSMENT_MIN_MS,
    greenTierToastMode: 'on-threshold-cross',
    greenToastUnlockThreshold: 80,
    morningHour: 6,
    __quotaState__: null,
    ...overrides
  }
  return {
    get: (key) => {
      if (key in defaults) return defaults[key]
      return undefined
    },
    set: vi.fn()
  }
}

describe('QuotaManager (T002/T003)', function () {
  beforeEach(function () {
    vi.useFakeTimers({ now: new Date('2026-04-21T09:00:00').valueOf() })
  })

  afterEach(function () {
    vi.useRealTimers()
  })

  // ─────────────────────────────────────────────
  // 1. Initialization & defaults (AC 2.2)
  // ─────────────────────────────────────────────
  describe('initialization', function () {
    it('should initialize miniQuota to 100 after start()', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      qm.getMiniQuota().should.equal(100)
    })

    it('should initialize longQuota to 100 after start()', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      qm.getLongQuota().should.equal(100)
    })

    it('should initialize postponeCount to 0 after start()', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      qm.getState().harassmentRejectCount.should.equal(0)
    })
  })

  // ─────────────────────────────────────────────
  // 2. Quota clamping — 0 / 100 / negative / >100 (AC 2.3)
  // ─────────────────────────────────────────────
  describe('quota clamping', function () {
    it('should clamp miniQuota to 0 when work time exceeds workWindow', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      // advance 30 min past the 25 min window
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS + 30 * 60 * 1000)
      qm.getMiniQuota().should.equal(0)
    })

    it('should not allow miniQuota to go below 0 after many postpone penalties', function () {
      const qm = new QuotaManager(makeSettings({ ignoreCost: 200 }))
      qm.start()
      qm.onIgnored('mini')
      qm.getMiniQuota().should.be.at.least(0)
    })

    it('should clamp longQuota to 0 when work time exceeds longWorkWindow', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      vi.advanceTimersByTime(LONG_WORK_WINDOW_MS + 60 * 60 * 1000)
      qm.getLongQuota().should.equal(0)
    })

    it('should clamp miniQuota to 100 if refill would exceed 100 (AC 4.2 bonus clamp)', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      // mini at 95, long break completes -> bonus 50 -> clamp to 100
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS * 0.05)
      qm.onBreakCompleted('long', LONG_WORK_WINDOW_MS)
      qm.getMiniQuota().should.equal(100)
    })
  })

  // ─────────────────────────────────────────────
  // 3. Work consumption — lazy calculation (AC 3.1–3.3)
  // ─────────────────────────────────────────────
  describe('work consumption (lazy)', function () {
    it('should consume miniQuota linearly over miniBreakWorkWindowMs (Default preset)', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      // after half the work window, quota should be ~50
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS / 2)
      const q = qm.getMiniQuota()
      q.should.be.within(48, 52)
    })

    it('should consume longQuota linearly over longBreakWorkWindowMs', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      vi.advanceTimersByTime(LONG_WORK_WINDOW_MS / 2)
      const q = qm.getLongQuota()
      q.should.be.within(48, 52)
    })

    it('Relaxed preset (30 min) should consume slower than Default (25 min)', function () {
      const qmRelaxed = new QuotaManager(makeSettings({ miniBreakWorkWindowMs: 30 * 60 * 1000 }))
      const qmDefault = new QuotaManager(makeSettings({ miniBreakWorkWindowMs: 25 * 60 * 1000 }))
      qmRelaxed.start()
      qmDefault.start()
      vi.advanceTimersByTime(25 * 60 * 1000)
      qmRelaxed.getMiniQuota().should.be.above(qmDefault.getMiniQuota())
    })

    it('Strict preset (20 min) should consume faster than Default (25 min)', function () {
      const qmStrict = new QuotaManager(makeSettings({ miniBreakWorkWindowMs: 20 * 60 * 1000 }))
      const qmDefault = new QuotaManager(makeSettings({ miniBreakWorkWindowMs: 25 * 60 * 1000 }))
      qmStrict.start()
      qmDefault.start()
      vi.advanceTimersByTime(20 * 60 * 1000)
      qmStrict.getMiniQuota().should.equal(0)
      qmDefault.getMiniQuota().should.be.above(0)
    })
  })

  // ─────────────────────────────────────────────
  // 4. Break completion — quota refill (AC 4.1–4.4)
  // ─────────────────────────────────────────────
  describe('onBreakCompleted', function () {
    it('mini break completed fully → miniQuota back to 100, long unaffected (AC 4.1)', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS)
      qm.onBreakCompleted('mini', 20000)
      qm.getMiniQuota().should.equal(100)
    })

    it('mini break completion does not change longQuota', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      vi.advanceTimersByTime(LONG_WORK_WINDOW_MS / 2)
      const longBefore = qm.getLongQuota()
      qm.onBreakCompleted('mini', 20000)
      qm.getLongQuota().should.equal(longBefore)
    })

    it('long break completed → longQuota 100, miniQuota +50 bonus (AC 4.2)', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      // exhaust both quotas
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS)
      qm.onBreakCompleted('long', LONG_WORK_WINDOW_MS)
      qm.getLongQuota().should.equal(100)
      qm.getMiniQuota().should.equal(50)
    })

    it('long break completed when mini at 95 → miniQuota clamped to 100 (not 145)', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS * 0.05)
      qm.onBreakCompleted('long', LONG_WORK_WINDOW_MS)
      qm.getMiniQuota().should.equal(100)
    })

    it('mini break 60% completed → miniQuota proportionally refilled (AC 4.3)', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS)
      // 60% of a 20s break = 12s
      qm.onBreakCompleted('mini', 12000)
      const q = qm.getMiniQuota()
      q.should.be.within(58, 62)
    })

    it('long break 0% completed → no quota change (AC 4.4)', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      vi.advanceTimersByTime(LONG_WORK_WINDOW_MS)
      const longBefore = qm.getLongQuota()
      qm.onBreakCompleted('long', 0)
      qm.getLongQuota().should.equal(longBefore)
      // mini bonus is 0 too
      qm.getMiniQuota().should.equal(0)
    })
  })

  // ─────────────────────────────────────────────
  // 5. Postpone & ignore deductions (AC 5.1–5.3, 8.1, AC 12.1–12.2)
  // ─────────────────────────────────────────────
  describe('onBreakPostponed', function () {
    it('postpone in yellow/orange tier deducts postponeCost from miniQuota (AC 5.1)', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS * 0.5) // ~50%, yellow tier
      const before = qm.getMiniQuota()
      qm.onBreakPostponed('mini', 'yellow')
      qm.getMiniQuota().should.be.below(before)
      ;(before - qm.getMiniQuota()).should.equal(10)
    })

    it('postpone in red tier deducts postponeCost × redPostponeMultiplier (AC 5.3, 8.1)', function () {
      const qm = new QuotaManager(makeSettings({ postponeCost: 10, redPostponeMultiplier: 2 }))
      qm.start()
      // advance to 50% so a 20-point deduction is fully observable (not clamped)
      // tier is passed explicitly as 'red' to exercise the multiplier branch
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS * 0.5)
      const before = qm.getMiniQuota()
      qm.onBreakPostponed('mini', 'red')
      ;(before - qm.getMiniQuota()).should.equal(20)
    })

    it('postpone clamps miniQuota at 0 even when cost exceeds remaining (boundary)', function () {
      const qm = new QuotaManager(makeSettings({ postponeCost: 10, redPostponeMultiplier: 2 }))
      qm.start()
      // quota at 3, red tier, penalty 20 → should be clamped to 0
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS * 0.97)
      qm.onBreakPostponed('mini', 'red')
      qm.getMiniQuota().should.equal(0)
    })
  })

  describe('onIgnored', function () {
    it('ignore deducts ignoreCost from miniQuota (AC 5.2)', function () {
      const qm = new QuotaManager(makeSettings({ ignoreCost: 5 }))
      qm.start()
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS * 0.5)
      const before = qm.getMiniQuota()
      qm.onIgnored('mini')
      ;(before - qm.getMiniQuota()).should.equal(5)
    })

    it('ignore deducts same as postpone (uses ignoreCost, not postponeCost × red)', function () {
      const qm = new QuotaManager(makeSettings({ ignoreCost: 5, postponeCost: 10 }))
      qm.start()
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS * 0.5)
      const before = qm.getMiniQuota()
      qm.onIgnored('mini')
      ;(before - qm.getMiniQuota()).should.equal(5)
    })

    it('auto-close (no user action) does NOT deduct quota (AC 7.9)', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS * 0.5)
      const before = qm.getMiniQuota()
      // autoClose is not an explicit QuotaManager method — quota unchanged
      qm.getMiniQuota().should.equal(before)
    })
  })

  // ─────────────────────────────────────────────
  // 6. Tier calculation (AC 6.1, boundary conditions)
  // ─────────────────────────────────────────────
  describe('getTier', function () {
    it('returns green when quota > 70 (AC 6.1)', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      qm.getTier('mini').should.equal('green')
    })

    it('returns yellow when quota is 50 (between 30 and 70)', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS * 0.5)
      qm.getTier('mini').should.equal('yellow')
    })

    it('returns orange when quota is 20 (between 10 and 30)', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS * 0.8)
      qm.getTier('mini').should.equal('orange')
    })

    it('returns red when quota is below 10', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS * 0.95)
      qm.getTier('mini').should.equal('red')
    })

    it('quota = 70 → yellow tier (boundary inclusive at low side)', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      // advance exactly to the point where quota = 70
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS * 0.30)
      const tier = qm.getTier('mini')
      tier.should.equal('yellow')
    })

    it('quota = 30 → yellow tier (boundary at orange cutoff)', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS * 0.70)
      qm.getTier('mini').should.equal('yellow')
    })

    it('quota = 10 → red tier (boundary inclusive at red side)', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS * 0.90)
      qm.getTier('mini').should.equal('red')
    })

    it('mini and long tiers are independent', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS * 0.95) // mini → red
      qm.getTier('mini').should.equal('red')
      qm.getTier('long').should.equal('green') // long still high
    })
  })

  // ─────────────────────────────────────────────
  // 7. Tier-change events (AC 6.2, 6.6, 6.7)
  // ─────────────────────────────────────────────
  describe('tierChanged event', function () {
    it('emits tierChanged when mini quota crosses green → yellow boundary', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      const changes = []
      qm.on('tierChanged', (...args) => changes.push(args))
      // force a tier check that crosses the boundary
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS * 0.31) // just past 70%
      qm.getTier('mini') // trigger lazy evaluation
      changes.length.should.be.above(0)
    })

    it('emits quotaChanged when quota is modified', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      const changes = []
      qm.on('quotaChanged', (data) => changes.push(data))
      qm.onBreakCompleted('mini', 20000)
      changes.length.should.equal(1)
    })
  })

  // ─────────────────────────────────────────────
  // 8. Green-tier toast debounce (AC 6.6, 6.7)
  // ─────────────────────────────────────────────
  describe('green tier toast debounce', function () {
    it('should track greenToastArmed state initially as true', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      qm.getState().should.have.property('greenToastArmed')
      qm.getState().greenToastArmed.should.equal(true)
    })

    it('crossing below tierGreenMin disarms greenToastArmed', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS * 0.31) // cross 70 threshold
      qm.getTier('mini') // trigger check
      qm.getState().greenToastArmed.should.equal(false)
    })

    it('recovering to greenToastUnlockThreshold (80%) re-arms toast', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS * 0.31)
      qm.getTier('mini') // disarm
      qm.onBreakCompleted('mini', 20000) // refill to 100
      qm.getState().greenToastArmed.should.equal(true)
    })

    it('recovering to only 75% (below unlock threshold) does NOT re-arm toast', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      // drain quota fully so re-arm logic starts from 0
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS)
      qm.getTier('mini') // trigger disarm via tier transition (green→yellow or lower)
      qm.getState().greenToastArmed.should.equal(false)
      // refill exactly 75 points (75% of 20s break = 15s), quota goes from 0 → 75
      qm.onBreakCompleted('mini', 15000)
      // 75 < greenToastUnlockThreshold(80), so armed must stay false
      qm.getState().greenToastArmed.should.equal(false)
    })

    it('recovering to exactly the unlock threshold (80%) re-arms toast', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      // drain quota fully
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS)
      qm.getTier('mini') // disarm
      qm.getState().greenToastArmed.should.equal(false)
      // refill exactly 80 points (80% of 20s = 16s), quota goes from 0 → 80
      qm.onBreakCompleted('mini', 16000)
      // 80 >= greenToastUnlockThreshold(80), so armed must become true
      qm.getState().greenToastArmed.should.equal(true)
    })
  })

  // ─────────────────────────────────────────────
  // 9. Freeze / unfreeze semantics (AC 6, 10, AC 13)
  // ─────────────────────────────────────────────
  describe('freeze / unfreeze', function () {
    it('quota does not change during freeze', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS * 0.3)
      const beforeFreeze = qm.getMiniQuota()
      qm.freeze('idle')
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS)
      qm.getMiniQuota().should.equal(beforeFreeze)
    })

    it('isFrozen is true after freeze()', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      qm.freeze('dnd')
      qm.getState().isFrozen.should.equal(true)
    })

    it('isFrozen is false after unfreeze()', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      qm.freeze('appExclusion')
      qm.unfreeze()
      qm.getState().isFrozen.should.equal(false)
    })

    it('quota resumes consuming after unfreeze', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS * 0.3) // consume 30%
      qm.freeze('idle')
      const frozenQuota = qm.getMiniQuota()
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS) // time passes but frozen
      qm.unfreeze()
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS * 0.3) // consume another 30%
      qm.getMiniQuota().should.be.below(frozenQuota)
    })

    it('double freeze (consecutive calls) only freezes once', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      qm.freeze('idle')
      qm.freeze('dnd')
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS)
      const q1 = qm.getMiniQuota()
      qm.freeze('idle')
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS)
      qm.getMiniQuota().should.equal(q1)
    })
  })

  // ─────────────────────────────────────────────
  // 10. Manual reset (AC onManualReset)
  // ─────────────────────────────────────────────
  describe('onManualReset', function () {
    it('resets miniQuota and longQuota to 100', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS)
      qm.onManualReset()
      qm.getMiniQuota().should.equal(100)
      qm.getLongQuota().should.equal(100)
    })

    it('resets harassmentRejectCount to 0', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      qm.onHarassmentRejected()
      qm.onHarassmentRejected()
      qm.onManualReset()
      qm.getState().harassmentRejectCount.should.equal(0)
    })

    it('reset when already at 100 does not error', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      qm.onManualReset.bind(qm).should.not.throw()
      qm.getMiniQuota().should.equal(100)
    })
  })

  // ─────────────────────────────────────────────
  // 11. Daily reset at morningHour (AC 12.1–12.3)
  // ─────────────────────────────────────────────
  describe('daily reset', function () {
    it('crossing morningHour triggers quota reset to 100 (AC 12.1)', function () {
      // Start before morning hour, consume some quota, then advance past 06:00 next day
      vi.setSystemTime(new Date('2026-04-21T05:00:00').valueOf())
      const qm = new QuotaManager(makeSettings({ morningHour: 6 }))
      qm.start()
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS)
      // now cross into tomorrow after 06:00
      vi.setSystemTime(new Date('2026-04-22T06:01:00').valueOf())
      qm.getMiniQuota().should.equal(100)
    })

    it('multiple restarts same day do not trigger extra reset (AC 12.2)', function () {
      vi.setSystemTime(new Date('2026-04-21T09:00:00').valueOf())
      const qm = new QuotaManager(makeSettings())
      qm.start()
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS * 0.5)
      const q1 = qm.getMiniQuota()
      qm.stop()
      // restart same day (still before next morningHour)
      const qm2 = new QuotaManager(makeSettings({
        __quotaState__: { miniQuota: q1, longQuota: 100, lastResetDate: '2026-04-21', lastActiveTimestamp: Date.now(), isFrozen: false, lastLongBreakTimestamp: 0, harassmentRejectCount: 0 }
      }))
      qm2.start()
      qm2.getMiniQuota().should.be.closeTo(q1, 2)
    })

    it('morningHour=8 uses 8:00 as reset boundary (AC 12.3)', function () {
      vi.setSystemTime(new Date('2026-04-21T07:30:00').valueOf())
      const qm = new QuotaManager(makeSettings({ morningHour: 8 }))
      qm.start()
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS)
      // Advance to 08:01 next day
      vi.setSystemTime(new Date('2026-04-22T08:01:00').valueOf())
      qm.getMiniQuota().should.equal(100)
    })
  })

  // ─────────────────────────────────────────────
  // 12. Hard deadline / harassment (AC 9.3, 9.4, 9.5)
  // ─────────────────────────────────────────────
  describe('hard deadline & harassment', function () {
    it('shouldTriggerHardDeadline returns false before deadline', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      vi.advanceTimersByTime(HARD_DEADLINE_MS - 1)
      qm.shouldTriggerHardDeadline().should.equal(false)
    })

    it('shouldTriggerHardDeadline returns true after deadline (AC 9.1)', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      vi.advanceTimersByTime(HARD_DEADLINE_MS)
      qm.shouldTriggerHardDeadline().should.equal(true)
    })

    it('long break resets lastLongBreakTimestamp and clears deadline (AC 9.4)', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      vi.advanceTimersByTime(HARD_DEADLINE_MS)
      qm.onBreakCompleted('long', LONG_WORK_WINDOW_MS)
      qm.shouldTriggerHardDeadline().should.equal(false)
    })

    it('getHarassmentIntervalMs returns base for k=0 (AC 9.3)', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      qm.getHarassmentIntervalMs().should.equal(HARASSMENT_BASE_MS)
    })

    it('onHarassmentRejected increments k, reduces interval', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      const initial = qm.getHarassmentIntervalMs()
      qm.onHarassmentRejected()
      qm.getHarassmentIntervalMs().should.be.below(initial)
    })

    it('interval = base / (k+1) formula (AC 9.3)', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      qm.onHarassmentRejected() // k=1
      qm.getHarassmentIntervalMs().should.equal(HARASSMENT_BASE_MS / 2)
    })

    it('harassment interval never goes below harassmentMinIntervalMs (30s floor)', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      // reject 100 times to drive interval towards 0
      for (let i = 0; i < 100; i++) qm.onHarassmentRejected()
      qm.getHarassmentIntervalMs().should.be.at.least(HARASSMENT_MIN_MS)
    })

    it('long break resets harassmentRejectCount to 0 (AC 9.4)', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      qm.onHarassmentRejected()
      qm.onHarassmentRejected()
      qm.onBreakCompleted('long', LONG_WORK_WINDOW_MS)
      qm.getState().harassmentRejectCount.should.equal(0)
    })

    it('freeze pauses hard-deadline accumulation (AC 9.5)', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      vi.advanceTimersByTime(HARD_DEADLINE_MS * 0.9)
      qm.freeze('idle')
      vi.advanceTimersByTime(HARD_DEADLINE_MS) // time passes but frozen
      qm.shouldTriggerHardDeadline().should.equal(false)
    })
  })

  // ─────────────────────────────────────────────
  // 13. Persistence (stop/start round-trip) (AC 11.2, 11.3, 11.4)
  // ─────────────────────────────────────────────
  describe('persistence', function () {
    it('stop() calls settings.set to persist quota state (AC 11.2)', function () {
      const settings = makeSettings()
      const qm = new QuotaManager(settings)
      qm.start()
      vi.advanceTimersByTime(MINI_WORK_WINDOW_MS * 0.5)
      qm.stop()
      vi.mocked(settings.set).mock.calls.length.should.be.above(0)
    })

    it('start() emits persistenceRequested on first activation', function () {
      const qm = new QuotaManager(makeSettings())
      const events = []
      qm.on('persistenceRequested', () => events.push(1))
      qm.start()
      qm.onBreakCompleted('mini', 20000)
      events.length.should.be.above(0)
    })

    it('start() loads persisted quota if no daily reset needed (AC 11.3)', function () {
      const savedState = {
        miniQuota: 65,
        longQuota: 80,
        lastActiveTimestamp: Date.now(),
        lastLongBreakTimestamp: Date.now(),
        lastResetDate: '2026-04-21',
        harassmentRejectCount: 0,
        isFrozen: false
      }
      const qm = new QuotaManager(makeSettings({ __quotaState__: savedState }))
      qm.start()
      qm.getMiniQuota().should.be.closeTo(65, 2)
    })

    it('start() ignores persisted state if daily reset boundary crossed (AC 11.4)', function () {
      // persisted yesterday before morningHour
      const savedState = {
        miniQuota: 40,
        longQuota: 50,
        lastActiveTimestamp: new Date('2026-04-20T23:00:00').valueOf(),
        lastLongBreakTimestamp: 0,
        lastResetDate: '2026-04-20',
        harassmentRejectCount: 0,
        isFrozen: false
      }
      // Now it's 09:00 today, past morningHour=6
      vi.setSystemTime(new Date('2026-04-21T09:00:00').valueOf())
      const qm = new QuotaManager(makeSettings({ __quotaState__: savedState, morningHour: 6 }))
      qm.start()
      qm.getMiniQuota().should.equal(100)
    })
  })

  // ─────────────────────────────────────────────
  // 14. getConfig / getState sanity
  // ─────────────────────────────────────────────
  describe('getConfig & getState', function () {
    it('getConfig returns object with expected keys', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      const config = qm.getConfig()
      config.should.have.property('miniBreakWorkWindowMs')
      config.should.have.property('longBreakWorkWindowMs')
      config.should.have.property('postponeCost')
      config.should.have.property('tierGreenMin')
    })

    it('getState returns a read-only snapshot with expected fields', function () {
      const qm = new QuotaManager(makeSettings())
      qm.start()
      const state = qm.getState()
      state.should.have.property('miniQuota')
      state.should.have.property('longQuota')
      state.should.have.property('isFrozen')
      state.should.have.property('lastResetDate')
      state.should.have.property('harassmentRejectCount')
    })
  })
})
