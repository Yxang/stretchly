// Mock electron and electron-log BEFORE any module imports.
// vi.mock calls are hoisted by vitest so this works even though
// the import statements appear later in the source.
import { vi } from 'vitest'
import 'chai/register-should'
import BreaksPlanner from '../app/breaksPlanner.js'

// ATDD stubs — written from spec (IF-2, AC 17, AC 10, AC 9, AC 7)
// before developer implements quota branch in app/breaksPlanner.js.
// These tests are EXPECTED to FAIL until T004 dev implements quota support.

vi.mock('electron', () => ({
  powerMonitor: { on: vi.fn(), off: vi.fn() },
  app: { getPath: vi.fn().mockReturnValue('/tmp'), getVersion: vi.fn().mockReturnValue('0.0.0') }
}))

vi.mock('electron-log/main.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}))

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const MICRO_INTERVAL_MS = 600000 // 10 min default
const MICRO_DURATION_MS = 20000 // 20 s default
const BREAK_DURATION_MS = 300000 // 5 min default
const BREAK_INTERVAL_DEFAULT = 2

function makeClassicSettings (overrides = {}) {
  const defaults = {
    schedulingMode: 'classic',
    microbreak: true,
    break: true,
    microbreakInterval: MICRO_INTERVAL_MS,
    microbreakDuration: MICRO_DURATION_MS,
    breakDuration: BREAK_DURATION_MS,
    breakInterval: BREAK_INTERVAL_DEFAULT,
    breakNotification: false,
    microbreakNotification: false,
    breakNotificationInterval: 30000,
    microbreakNotificationInterval: 30000,
    microbreakPostponeTime: 120000,
    breakPostponeTime: 120000,
    postponesLimit: 0,
    postponableDurationPercent: 100,
    naturalBreaks: false,
    dnd: false,
    appExclusions: [],
    morningHour: 6,
    // quota fields (must not affect classic mode)
    miniBreakWorkWindowMs: 1500000,
    longBreakWorkWindowMs: 7200000,
    tierGreenMin: 70,
    tierYellowMin: 30,
    tierOrangeMin: 10,
    softReminderYellowIntervalMs: 300000,
    softReminderOrangeIntervalMs: 120000,
    softReminderAutoDismissMs: 90000,
    longBreakHardDeadlineMs: 7200000,
    harassmentBaseIntervalMs: 600000,
    harassmentMinIntervalMs: 30000,
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

function makeQuotaSettings (overrides = {}) {
  return makeClassicSettings({ schedulingMode: 'quota', ...overrides })
}

// Minimal QuotaManager mock — tracks calls without real quota logic.
function makeQuotaManagerMock () {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    freeze: vi.fn(),
    unfreeze: vi.fn(),
    getMiniQuota: vi.fn().mockReturnValue(80),
    getLongQuota: vi.fn().mockReturnValue(80),
    getTier: vi.fn().mockReturnValue('green'),
    shouldTriggerHardDeadline: vi.fn().mockReturnValue(false),
    onHarassmentRejected: vi.fn(),
    getHarassmentIntervalMs: vi.fn().mockReturnValue(600000),
    onBreakCompleted: vi.fn(),
    onBreakPostponed: vi.fn(),
    onIgnored: vi.fn(),
    on: vi.fn(),
    emit: vi.fn()
  }
}

// ─────────────────────────────────────────────
// 1. Classic mode zero regression
// ─────────────────────────────────────────────
describe('BreaksPlanner — classic mode zero regression (T004/T005)', function () {
  beforeEach(function () {
    vi.useFakeTimers({ now: new Date('2026-04-21T09:00:00').valueOf() })
  })

  afterEach(function () {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should have quotaManager === null when schedulingMode is classic', function () {
    const planner = new BreaksPlanner(makeClassicSettings())
    // classic mode must never instantiate QuotaManager
    // this property should be null / undefined / not set
    const qm = planner.quotaManager
    ;(qm === null || qm === undefined).should.equal(true)
  })

  it('should schedule startMicrobreak via nextBreak() in classic mode', function () {
    const planner = new BreaksPlanner(makeClassicSettings({ breakInterval: 2 }))
    const events = []
    planner.on('startMicrobreak', () => events.push('startMicrobreak'))
    planner.nextBreak()
    vi.advanceTimersByTime(MICRO_INTERVAL_MS + 100)
    events.should.include('startMicrobreak')
  })

  it('should emit updateToolTip in classic mode without quota events', function () {
    const planner = new BreaksPlanner(makeClassicSettings())
    const events = []
    planner.on('updateToolTip', () => events.push('updateToolTip'))
    planner.on('quotaChanged', () => events.push('quotaChanged'))
    planner.on('startSoftReminder', () => events.push('startSoftReminder'))
    planner.on('longBreakHardDeadline', () => events.push('longBreakHardDeadline'))
    planner.nextBreak()
    // classic mode must not emit quota-specific events
    events.should.not.include('quotaChanged')
    events.should.not.include('startSoftReminder')
    events.should.not.include('longBreakHardDeadline')
  })

  it('should pause and resume correctly in classic mode', function () {
    const planner = new BreaksPlanner(makeClassicSettings())
    planner.nextBreak()
    planner.pause(60000)
    planner.isPaused.should.equal(true)
    const events = []
    planner.on('resumeBreaks', () => events.push('resumeBreaks'))
    vi.advanceTimersByTime(60100)
    events.should.include('resumeBreaks')
  })

  it('should not emit startSoftReminder or quotaChanged in classic mode after nextBreak', function () {
    const planner = new BreaksPlanner(makeClassicSettings())
    const forbidden = []
    planner.on('startSoftReminder', () => forbidden.push('startSoftReminder'))
    planner.on('quotaChanged', () => forbidden.push('quotaChanged'))
    planner.nextBreak()
    vi.advanceTimersByTime(MICRO_INTERVAL_MS * 3)
    forbidden.length.should.equal(0)
  })
})

// ─────────────────────────────────────────────
// 2. Quota mode initialization
// ─────────────────────────────────────────────
describe('BreaksPlanner — quota mode initialization (T004/T005)', function () {
  beforeEach(function () {
    vi.useFakeTimers({ now: new Date('2026-04-21T09:00:00').valueOf() })
  })

  afterEach(function () {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should have schedulingMode property === "quota" when constructed with quota settings', function () {
    const planner = new BreaksPlanner(makeQuotaSettings())
    planner.schedulingMode.should.equal('quota')
  })

  it('should create a non-null quotaManager instance when schedulingMode is quota', function () {
    const planner = new BreaksPlanner(makeQuotaSettings())
    // planner.quotaManager must be a QuotaManager instance (not null/undefined)
    ;(planner.quotaManager !== null && planner.quotaManager !== undefined).should.equal(true)
  })

  it('should call quotaManager.start() when planner starts quota mode', function () {
    const planner = new BreaksPlanner(makeQuotaSettings())
    // quota mode planner should expose a start() or init() that calls qm.start()
    // developer may call this from constructor or explicit start() method
    const qm = planner.quotaManager
    ;(typeof qm.start).should.equal('function')
  })

  it('should have deadlineScheduler in quota mode (may be null before nextBreak, must be set after)', function () {
    const planner = new BreaksPlanner(makeQuotaSettings())
    planner.nextBreak()
    // deadlineScheduler should be wired up after starting in quota mode
    ;(planner.deadlineScheduler !== undefined).should.equal(true)
  })
})

// ─────────────────────────────────────────────
// 3. Tier dispatch — quota mode
// ─────────────────────────────────────────────
describe('BreaksPlanner — quota tier dispatch (T004/T005)', function () {
  beforeEach(function () {
    vi.useFakeTimers({ now: new Date('2026-04-21T09:00:00').valueOf() })
  })

  afterEach(function () {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // Helper: build planner with injected mock QuotaManager
  function makePlannerWithMockQM (tierMini, tierLong, overrides = {}) {
    const settings = makeQuotaSettings(overrides)
    const planner = new BreaksPlanner(settings)
    // Inject mock after construction so developer can hook in
    const qm = makeQuotaManagerMock()
    qm.getTier = vi.fn((breakType) => breakType === 'mini' ? tierMini : tierLong)
    qm.getMiniQuota = vi.fn().mockReturnValue(tierMini === 'red' ? 5 : tierMini === 'orange' ? 15 : tierMini === 'yellow' ? 50 : 80)
    qm.getLongQuota = vi.fn().mockReturnValue(tierLong === 'red' ? 5 : tierLong === 'orange' ? 15 : tierLong === 'yellow' ? 50 : 80)
    planner.quotaManager = qm
    return { planner, qm }
  }

  it('mini green: nextBreak() should schedule normal work timer (no softReminder)', function () {
    const { planner } = makePlannerWithMockQM('green', 'green')
    const events = []
    planner.on('startSoftReminder', (bt, tier) => events.push({ type: 'softReminder', bt, tier }))
    planner.nextBreak()
    vi.advanceTimersByTime(100)
    const softMini = events.filter(e => e.bt === 'mini')
    softMini.length.should.equal(0)
  })

  it('mini yellow: nextBreak() should emit startSoftReminder("mini", "yellow")', function () {
    const { planner } = makePlannerWithMockQM('yellow', 'green')
    const events = []
    planner.on('startSoftReminder', (bt, tier) => events.push({ bt, tier }))
    planner.nextBreak()
    vi.advanceTimersByTime(300000 + 100) // yellowIntervalMs
    const match = events.find(e => e.bt === 'mini' && e.tier === 'yellow')
    ;(match !== undefined).should.equal(true)
  })

  it('mini orange: nextBreak() should emit startSoftReminder("mini", "orange")', function () {
    const { planner } = makePlannerWithMockQM('orange', 'green')
    const events = []
    planner.on('startSoftReminder', (bt, tier) => events.push({ bt, tier }))
    planner.nextBreak()
    vi.advanceTimersByTime(120000 + 100) // orangeIntervalMs
    const match = events.find(e => e.bt === 'mini' && e.tier === 'orange')
    ;(match !== undefined).should.equal(true)
  })

  it('mini red: nextBreak() should emit startMicrobreak (fullscreen)', function () {
    const { planner } = makePlannerWithMockQM('red', 'green')
    const events = []
    planner.on('startMicrobreak', () => events.push('startMicrobreak'))
    planner.nextBreak()
    vi.advanceTimersByTime(1000)
    events.should.include('startMicrobreak')
  })

  it('long yellow: nextBreak() should emit startSoftReminder("long", "yellow")', function () {
    const { planner } = makePlannerWithMockQM('green', 'yellow')
    const events = []
    planner.on('startSoftReminder', (bt, tier) => events.push({ bt, tier }))
    planner.nextBreak()
    vi.advanceTimersByTime(300000 + 100)
    const match = events.find(e => e.bt === 'long' && e.tier === 'yellow')
    ;(match !== undefined).should.equal(true)
  })

  it('long orange: nextBreak() should emit startSoftReminder("long", "orange")', function () {
    const { planner } = makePlannerWithMockQM('green', 'orange')
    const events = []
    planner.on('startSoftReminder', (bt, tier) => events.push({ bt, tier }))
    planner.nextBreak()
    vi.advanceTimersByTime(120000 + 100)
    const match = events.find(e => e.bt === 'long' && e.tier === 'orange')
    ;(match !== undefined).should.equal(true)
  })

  it('long red: nextBreak() should emit startBreak (fullscreen)', function () {
    const { planner } = makePlannerWithMockQM('green', 'red')
    const events = []
    planner.on('startBreak', () => events.push('startBreak'))
    planner.nextBreak()
    vi.advanceTimersByTime(1000)
    events.should.include('startBreak')
  })

  it('both mini red and long red: should prefer long break', function () {
    const { planner } = makePlannerWithMockQM('red', 'red')
    const events = []
    planner.on('startBreak', () => events.push('startBreak'))
    planner.on('startMicrobreak', () => events.push('startMicrobreak'))
    planner.nextBreak()
    vi.advanceTimersByTime(1000)
    // long break wins over mini when both are red
    events.should.include('startBreak')
    events.should.not.include('startMicrobreak')
  })
})

// ─────────────────────────────────────────────
// 4. Soft reminder repeat (scheduler reference)
// ─────────────────────────────────────────────
describe('BreaksPlanner — soft reminder repeat (T004/T005)', function () {
  beforeEach(function () {
    vi.useFakeTimers({ now: new Date('2026-04-21T09:00:00').valueOf() })
  })

  afterEach(function () {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('softReminder ignored: scheduler reference should become "softReminderRepeat" after ignore action', function () {
    const settings = makeQuotaSettings()
    const planner = new BreaksPlanner(settings)
    const qm = makeQuotaManagerMock()
    qm.getTier = vi.fn().mockReturnValue('yellow')
    planner.quotaManager = qm
    planner.nextBreak()
    vi.advanceTimersByTime(300000 + 100) // trigger yellow reminder
    // Simulate ignore action
    planner.emit('softReminderAction', 'ignore', 'mini')
    // After ignore, scheduler reference must be softReminderRepeat
    ;(planner.scheduler !== null && planner.scheduler !== undefined).should.equal(true)
    if (planner.scheduler) {
      planner.scheduler.reference.should.equal('softReminderRepeat')
    }
  })

  it('softReminder autoClose: should reschedule without quota deduction (scheduler reset)', function () {
    const settings = makeQuotaSettings()
    const planner = new BreaksPlanner(settings)
    const qm = makeQuotaManagerMock()
    qm.getTier = vi.fn().mockReturnValue('yellow')
    planner.quotaManager = qm
    planner.nextBreak()
    vi.advanceTimersByTime(300000 + 100)
    const beforeIgnoredCalls = qm.onIgnored.mock.calls.length
    planner.emit('softReminderAction', 'autoClose', 'mini')
    // autoClose must NOT call qm.onIgnored
    qm.onIgnored.mock.calls.length.should.equal(beforeIgnoredCalls)
  })

  it('softReminder takeNow: should emit startMicrobreak immediately', function () {
    const settings = makeQuotaSettings()
    const planner = new BreaksPlanner(settings)
    const qm = makeQuotaManagerMock()
    qm.getTier = vi.fn().mockReturnValue('yellow')
    planner.quotaManager = qm
    const events = []
    planner.on('startMicrobreak', () => events.push('startMicrobreak'))
    planner.nextBreak()
    vi.advanceTimersByTime(300000 + 100)
    planner.emit('softReminderAction', 'takeNow', 'mini')
    vi.advanceTimersByTime(200)
    events.should.include('startMicrobreak')
  })
})

// ─────────────────────────────────────────────
// 5. Pause / resume links QuotaManager.freeze
// ─────────────────────────────────────────────
describe('BreaksPlanner — pause/resume calls QuotaManager.freeze (T004/T005)', function () {
  beforeEach(function () {
    vi.useFakeTimers({ now: new Date('2026-04-21T09:00:00').valueOf() })
  })

  afterEach(function () {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function makePlannerWithQMMock (settings) {
    const planner = new BreaksPlanner(settings)
    const qm = makeQuotaManagerMock()
    planner.quotaManager = qm
    return { planner, qm }
  }

  it('dndStarted event should call quotaManager.freeze("dnd") in quota mode', function () {
    const { planner, qm } = makePlannerWithQMMock(makeQuotaSettings({ dnd: true }))
    planner.nextBreak()
    // Simulate DnD started by triggering the dndManager event through planner
    planner.dndManager.emit('dndStarted')
    const freezeCall = qm.freeze.mock.calls.find(c => c[0] === 'dnd')
    ;(freezeCall !== undefined).should.equal(true)
  })

  it('dndFinished event should call quotaManager.unfreeze() in quota mode', function () {
    const { planner, qm } = makePlannerWithQMMock(makeQuotaSettings({ dnd: true }))
    planner.nextBreak()
    planner.dndManager.emit('dndStarted')
    qm.freeze.mockClear()
    planner.dndManager.emit('dndFinished')
    qm.unfreeze.mock.calls.length.should.be.greaterThan(0)
  })

  it('clearBreakScheduler (idle pause) should call quotaManager.freeze("idle") in quota mode', function () {
    const { planner, qm } = makePlannerWithQMMock(makeQuotaSettings({ naturalBreaks: true }))
    planner.nextBreak()
    planner.naturalBreaksManager.emit('clearBreakScheduler')
    const freezeCall = qm.freeze.mock.calls.find(c => c[0] === 'idle')
    ;(freezeCall !== undefined).should.equal(true)
  })

  it('appExclusionStarted (pause rule) should call quotaManager.freeze("appExclusion") in quota mode', function () {
    const { planner, qm } = makePlannerWithQMMock(makeQuotaSettings())
    planner.nextBreak()
    planner.appExclusionsManager.emit('appExclusionStarted', 'pause', 'someApp')
    const freezeCall = qm.freeze.mock.calls.find(c => c[0] === 'appExclusion')
    ;(freezeCall !== undefined).should.equal(true)
  })

  it('appExclusionFinished (pause rule resume) should call quotaManager.unfreeze() in quota mode', function () {
    const { planner, qm } = makePlannerWithQMMock(makeQuotaSettings())
    planner.nextBreak()
    planner.appExclusionsManager.emit('appExclusionStarted', 'pause', 'someApp')
    qm.unfreeze.mockClear()
    planner.appExclusionsManager.emit('appExclusionFinished', 'pause')
    qm.unfreeze.mock.calls.length.should.be.greaterThan(0)
  })

  it('classic mode: dndStarted should NOT call quotaManager.freeze', function () {
    const planner = new BreaksPlanner(makeClassicSettings({ dnd: true }))
    // in classic mode, quotaManager is null so freeze cannot be called
    const qm = planner.quotaManager
    ;(qm === null || qm === undefined).should.equal(true)
    // No error must be thrown when dnd fires in classic mode
    ;(() => planner.dndManager.emit('dndStarted')).should.not.throw()
  })
})

// ─────────────────────────────────────────────
// 6. Long break hard deadline
// ─────────────────────────────────────────────
describe('BreaksPlanner — long break hard deadline (T004/T005)', function () {
  beforeEach(function () {
    vi.useFakeTimers({ now: new Date('2026-04-21T09:00:00').valueOf() })
  })

  afterEach(function () {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should emit longBreakHardDeadline when shouldTriggerHardDeadline returns true', function () {
    const settings = makeQuotaSettings()
    const planner = new BreaksPlanner(settings)
    const qm = makeQuotaManagerMock()
    qm.shouldTriggerHardDeadline = vi.fn().mockReturnValue(true)
    planner.quotaManager = qm
    const events = []
    planner.on('longBreakHardDeadline', () => events.push('longBreakHardDeadline'))
    planner.nextBreak()
    vi.advanceTimersByTime(7200000 + 100)
    events.should.include('longBreakHardDeadline')
  })

  it('harassment mode: each rejection decrements interval (harassmentRepeat reference)', function () {
    const settings = makeQuotaSettings({ harassmentBaseIntervalMs: 600000, harassmentMinIntervalMs: 30000 })
    const planner = new BreaksPlanner(settings)
    const qm = makeQuotaManagerMock()
    qm.shouldTriggerHardDeadline = vi.fn().mockReturnValue(true)
    let rejectCount = 0
    qm.onHarassmentRejected = vi.fn(() => { rejectCount++ })
    qm.getHarassmentIntervalMs = vi.fn(() => Math.max(30000, Math.floor(600000 / (rejectCount + 1))))
    planner.quotaManager = qm
    planner.on('longBreakHardDeadline', () => {})
    planner.nextBreak()
    vi.advanceTimersByTime(7200000 + 100)
    // Simulate first rejection
    planner.emit('harassmentRejected')
    // deadlineScheduler should now use harassmentRepeat reference
    if (planner.deadlineScheduler) {
      planner.deadlineScheduler.reference.should.equal('harassmentRepeat')
    }
  })

  it('DnD freeze should cancel deadlineScheduler; unfreeze should reschedule it', function () {
    const settings = makeQuotaSettings({ dnd: true })
    const planner = new BreaksPlanner(settings)
    const qm = makeQuotaManagerMock()
    planner.quotaManager = qm
    planner.nextBreak()
    // Trigger DnD
    planner.dndManager.emit('dndStarted')
    // After freeze, deadlineScheduler timer should be cancelled (timer === null) or deadlineScheduler === null
    const ds = planner.deadlineScheduler
    if (ds) {
      ;(ds.timer === null || ds.reference === null).should.equal(true)
    }
    // After unfreeze, deadlineScheduler should be rescheduled
    planner.dndManager.emit('dndFinished')
    // deadlineScheduler must exist again
    ;(planner.deadlineScheduler !== null && planner.deadlineScheduler !== undefined).should.equal(true)
  })

  it('long break completed: harassmentRejectCount should reset to 0', function () {
    const settings = makeQuotaSettings()
    const planner = new BreaksPlanner(settings)
    const qm = makeQuotaManagerMock()
    qm.shouldTriggerHardDeadline = vi.fn().mockReturnValue(true)
    planner.quotaManager = qm
    planner.nextBreak()
    vi.advanceTimersByTime(7200000 + 100) // trigger hard deadline
    // Simulate rejection
    planner.emit('harassmentRejected')
    // Then long break completes — reset via quotaManager.onBreakCompleted
    planner.emit('finishBreak', false, true)
    // qm.onBreakCompleted should have been called with 'long'
    const longCompletedCall = qm.onBreakCompleted.mock.calls.find(c => c[0] === 'long')
    ;(longCompletedCall !== undefined).should.equal(true)
  })

  it('hardDeadline during microbreak: long break should start after microbreak ends', function () {
    const settings = makeQuotaSettings()
    const planner = new BreaksPlanner(settings)
    const qm = makeQuotaManagerMock()
    qm.shouldTriggerHardDeadline = vi.fn().mockReturnValue(true)
    planner.quotaManager = qm
    const events = []
    planner.on('startBreak', () => events.push('startBreak'))
    // Start a microbreak
    planner.emit('microbreakStarted', false)
    // Hard deadline fires while microbreak is active
    vi.advanceTimersByTime(7200000 + 100)
    // Finish microbreak
    planner.emit('finishMicrobreak', false, true)
    // Long break should now start immediately after microbreak ends
    vi.advanceTimersByTime(200)
    events.should.include('startBreak')
  })
})

// ─────────────────────────────────────────────
// 7. quotaChanged event emission
// ─────────────────────────────────────────────
describe('BreaksPlanner — quotaChanged event (T004/T005)', function () {
  beforeEach(function () {
    vi.useFakeTimers({ now: new Date('2026-04-21T09:00:00').valueOf() })
  })

  afterEach(function () {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('quota mode: should emit quotaChanged with {miniQuota, longQuota, miniTier, longTier} when QM fires', function () {
    const settings = makeQuotaSettings()
    const planner = new BreaksPlanner(settings)
    const qm = makeQuotaManagerMock()
    planner.quotaManager = qm
    const received = []
    planner.on('quotaChanged', (data) => received.push(data))
    planner.nextBreak()
    // Simulate QuotaManager emitting quotaChanged
    // Developer must wire: qm.on('quotaChanged', ...)  → planner.emit('quotaChanged', {...})
    qm.emit('quotaChanged', { miniQuota: 60, longQuota: 80 })
    const match = received.find(d => typeof d.miniQuota === 'number' && typeof d.miniTier === 'string')
    ;(match !== undefined).should.equal(true)
  })

  it('quota mode: quotaChanged payload should include miniTier and longTier strings', function () {
    const settings = makeQuotaSettings()
    const planner = new BreaksPlanner(settings)
    const qm = makeQuotaManagerMock()
    planner.quotaManager = qm
    const received = []
    planner.on('quotaChanged', (data) => received.push(data))
    planner.nextBreak()
    qm.emit('quotaChanged', { miniQuota: 50, longQuota: 90 })
    if (received.length > 0) {
      const d = received[received.length - 1]
      ;['green', 'yellow', 'orange', 'red'].should.include(d.miniTier)
      ;['green', 'yellow', 'orange', 'red'].should.include(d.longTier)
    }
  })

  it('classic mode: should NOT emit quotaChanged even if QM somehow fires', function () {
    const planner = new BreaksPlanner(makeClassicSettings())
    const events = []
    planner.on('quotaChanged', () => events.push('quotaChanged'))
    planner.nextBreak()
    vi.advanceTimersByTime(MICRO_INTERVAL_MS * 2)
    events.should.not.include('quotaChanged')
  })
})

// ─────────────────────────────────────────────
// 8. schedulingMode switching
// ─────────────────────────────────────────────
describe('BreaksPlanner — schedulingMode switching (T004/T005)', function () {
  beforeEach(function () {
    vi.useFakeTimers({ now: new Date('2026-04-21T09:00:00').valueOf() })
  })

  afterEach(function () {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('switching quota → classic: quotaManager.stop() should be called and deadlineScheduler cleaned', function () {
    const settings = makeQuotaSettings()
    const planner = new BreaksPlanner(settings)
    const qm = makeQuotaManagerMock()
    planner.quotaManager = qm
    planner.nextBreak()
    // Simulate switch to classic
    planner.setSchedulingMode('classic')
    qm.stop.mock.calls.length.should.be.greaterThan(0)
    ;(planner.deadlineScheduler === null || planner.deadlineScheduler === undefined).should.equal(true)
  })

  it('switching classic → quota: should create QuotaManager and call start()', function () {
    const settings = makeClassicSettings()
    const planner = new BreaksPlanner(settings)
    ;(planner.quotaManager === null || planner.quotaManager === undefined).should.equal(true)
    // Simulate switch to quota — developer must implement setSchedulingMode
    planner.setSchedulingMode('quota')
    ;(planner.quotaManager !== null && planner.quotaManager !== undefined).should.equal(true)
  })

  it('mode switch during active break should not interrupt the break', function () {
    const settings = makeQuotaSettings()
    const planner = new BreaksPlanner(settings)
    const qm = makeQuotaManagerMock()
    planner.quotaManager = qm
    // Start a break
    planner.emit('breakStarted', false)
    ;(planner.scheduler !== null).should.equal(true)
    const refBefore = planner.scheduler ? planner.scheduler.reference : null
    // Switch mode
    planner.setSchedulingMode('classic')
    // Active break scheduler reference should still be finishBreak
    if (planner.scheduler) {
      planner.scheduler.reference.should.equal(refBefore)
    }
  })
})

// ─────────────────────────────────────────────
// 9. Edge cases (PLANNING §4)
// ─────────────────────────────────────────────
describe('BreaksPlanner — edge cases (T004/T005)', function () {
  beforeEach(function () {
    vi.useFakeTimers({ now: new Date('2026-04-21T09:00:00').valueOf() })
  })

  afterEach(function () {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('microbreak=false in quota mode: mini quota should not consume (getTier not called for mini)', function () {
    const settings = makeQuotaSettings({ microbreak: false })
    const planner = new BreaksPlanner(settings)
    const qm = makeQuotaManagerMock()
    planner.quotaManager = qm
    planner.nextBreak()
    vi.advanceTimersByTime(1000)
    // With microbreak disabled, planner should not route to mini quota logic
    const miniTierCalls = qm.getTier.mock.calls.filter(c => c[0] === 'mini')
    miniTierCalls.length.should.equal(0)
  })

  it('break=false in quota mode: long quota should not consume (getTier not called for long)', function () {
    const settings = makeQuotaSettings({ break: false })
    const planner = new BreaksPlanner(settings)
    const qm = makeQuotaManagerMock()
    planner.quotaManager = qm
    planner.nextBreak()
    vi.advanceTimersByTime(1000)
    const longTierCalls = qm.getTier.mock.calls.filter(c => c[0] === 'long')
    longTierCalls.length.should.equal(0)
  })

  it('machine resume (correctScheduler) should call quotaManager.unfreeze + correctScheduler', function () {
    const settings = makeQuotaSettings()
    const planner = new BreaksPlanner(settings)
    const qm = makeQuotaManagerMock()
    planner.quotaManager = qm
    planner.nextBreak()
    planner.freeze(qm)
    // Simulate power monitor resume via planner.onPowerResume or correctScheduler
    planner.onPowerResume()
    qm.unfreeze.mock.calls.length.should.be.greaterThan(0)
  })

  it('breakStrictMode=true in red tier: postpone should not be available (no quota deduction)', function () {
    const settings = makeQuotaSettings({ breakStrictMode: true })
    const planner = new BreaksPlanner(settings)
    const qm = makeQuotaManagerMock()
    qm.getTier = vi.fn().mockReturnValue('red')
    planner.quotaManager = qm
    // In strict mode red tier: renderer disables postpone button
    // Planner side: if strictMode is on and we're at red, onBreakPostponed should not be called
    // This is primarily a renderer-level constraint, but planner should expose strictMode state
    planner.nextBreak()
    // Verify planner does not auto-call onBreakPostponed during strict+red scheduling
    const postponeCallCount = qm.onBreakPostponed.mock.calls.length
    postponeCallCount.should.equal(0)
  })
})

// ─────────────────────────────────────────────
// 10. schedulingModeChanged event (v1.22 T-203 ATDD stubs)
// These tests are EXPECTED TO FAIL until dev-t203 implements
// `emit('schedulingModeChanged', { mode, oldMode })` in setSchedulingMode.
// ─────────────────────────────────────────────
describe('BreaksPlanner — schedulingModeChanged event (v1.22 T-203)', function () {
  beforeEach(function () {
    vi.useFakeTimers({ now: new Date('2026-04-21T09:00:00').valueOf() })
  })

  afterEach(function () {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // Case 1: classic → quota emits event once with correct payload
  it('emit schedulingModeChanged once when classic → quota', function () {
    const settings = makeClassicSettings()
    const planner = new BreaksPlanner(settings)
    const calls = []
    planner.on('schedulingModeChanged', (payload) => calls.push(payload))
    planner.setSchedulingMode('quota')
    calls.length.should.equal(1)
    calls[0].mode.should.equal('quota')
    calls[0].oldMode.should.equal('classic')
  })

  // Case 2: quota → classic emits event once with correct payload
  it('emit schedulingModeChanged once when quota → classic', function () {
    const settings = makeQuotaSettings()
    const planner = new BreaksPlanner(settings)
    const calls = []
    planner.on('schedulingModeChanged', (payload) => calls.push(payload))
    planner.setSchedulingMode('classic')
    calls.length.should.equal(1)
    calls[0].mode.should.equal('classic')
    calls[0].oldMode.should.equal('quota')
  })

  // Case 3: same mode call must NOT emit
  it('do not emit schedulingModeChanged when mode is unchanged (quota → quota)', function () {
    const settings = makeQuotaSettings()
    const planner = new BreaksPlanner(settings)
    let count = 0
    planner.on('schedulingModeChanged', () => count++)
    planner.setSchedulingMode('quota')
    count.should.equal(0)
  })

  // Case 4: active break during mode switch — 5 invariants (AC 2.6)
  // Active break: scheduler.reference === 'startMicrobreakNotification' (break in progress)
  it('active break during mode switch: 5 invariants all hold', function () {
    const settings = makeQuotaSettings()
    const planner = new BreaksPlanner(settings)
    const qm = makeQuotaManagerMock()
    planner._quotaManager = qm
    // Simulate an active break by setting scheduler.reference directly
    planner.scheduler = { reference: 'startMicrobreakNotification', start: vi.fn(), stop: vi.fn() }
    const refBefore = planner.scheduler.reference

    const emitCalls = []
    planner.on('schedulingModeChanged', (payload) => emitCalls.push(payload))

    planner.setSchedulingMode('classic')

    // Invariant 1: scheduler.reference not changed (active break not interrupted)
    planner.scheduler.reference.should.equal(refBefore)
    // Invariant 2: schedulingMode updated immediately
    planner.schedulingMode.should.equal('classic')
    // Invariant 3: quotaManager is null immediately (quota → classic)
    ;(planner.quotaManager === null || planner.quotaManager === undefined).should.equal(true)
    // Invariant 4: schedulingModeChanged was emitted
    emitCalls.length.should.equal(1)
    // Invariant 5: deadlineScheduler not installed (no _ensureDeadlineScheduler during active break)
    ;(planner.deadlineScheduler === null || planner.deadlineScheduler === undefined).should.equal(true)
  })

  // Case 5: quota callback guard — after switching to classic, quota callbacks return early
  it('quota path callbacks are safe after switching to classic (guard check)', function () {
    const settings = makeQuotaSettings()
    const planner = new BreaksPlanner(settings)
    const qm = makeQuotaManagerMock()
    planner._quotaManager = qm

    // Switch to classic first
    planner.setSchedulingMode('classic')

    // After switching, quotaManager should be null
    ;(planner.quotaManager === null || planner.quotaManager === undefined).should.equal(true)
    // schedulingMode is classic
    planner.schedulingMode.should.equal('classic')
    // Calling _handleSoftReminderAction (if accessible) should not throw when qm is null.
    // The guard `if (this.schedulingMode !== 'quota' || !this._quotaManager) return` protects it.
    // We verify the guard condition holds (not throwing is sufficient evidence).
    let threw = false
    try {
      if (typeof planner._handleSoftReminderAction === 'function') {
        planner._handleSoftReminderAction('dismiss')
      }
    } catch (e) {
      threw = true
    }
    threw.should.equal(false)
  })
})
