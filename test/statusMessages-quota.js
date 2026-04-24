import 'chai/register-should'
import StatusMessages from '../app/utils/statusMessages.js'

function makeMockPlanner ({
  reference = 'startMicrobreak',
  isPaused = false,
  timeLeft = null,
  timeToNextBreak = 60000,
  breakNumber = 0,
  isOnDnd = false,
  isSchedulerCleared = false
} = {}) {
  return {
    scheduler: { reference, timeLeft },
    dndManager: { isOnDnd },
    appExclusionsManager: { isSchedulerCleared },
    timeToNextBreak,
    isPaused,
    breakNumber
  }
}

function makeQuotaManager ({ miniQuota = 100, longQuota = 100, miniTier = 'green', longTier = 'green' } = {}) {
  return {
    getMiniQuota: () => miniQuota,
    getLongQuota: () => longQuota,
    getTier: (breakType) => breakType === 'mini' ? miniTier : longTier,
    getState: () => ({ miniQuota, longQuota, miniTier, longTier })
  }
}

function makeSettings (overrides = {}) {
  const store = {
    schedulingMode: 'classic',
    language: 'en',
    break: true,
    breakInterval: 2,
    tooltipTierPrefix: 'auto',
    useMonochromeTrayIcon: false,
    ...overrides
  }
  return { get: (key) => store[key] }
}

function makeI18next () {
  return {
    t: (key, opts) => {
      if (key === 'statusMessages.paused') return 'Paused'
      if (key === 'statusMessages.resuming') return 'resuming in'
      if (key === 'statusMessages.indefinitely') return 'indefinitely'
      if (key === 'statusMessages.dndMode') return 'Do Not Disturb'
      if (key === 'statusMessages.appExclusion') return 'app exclusion'
      if (key === 'statusMessages.nextMiniBreak') return 'Mini break in'
      if (key === 'statusMessages.nextLongBreak') return 'Long break in'
      if (key === 'statusMessages.afterMiniBreak') return `after ${opts && opts.count} mini breaks`
      if (key === 'quota.tray.mini') return `Mini: ${opts && opts.percent}%`
      if (key === 'quota.tray.long') return `Long: ${opts && opts.percent}%`
      return key
    }
  }
}

function makeHumanize () {
  return (ms) => `${Math.round(ms / 60000)}m`
}

describe('StatusMessages — quota mode (T008)', function () {
  describe('trayMessage quota two-line tooltip', function () {
    it('includes Mini: XX% line in quota mode', function () {
      const sm = new StatusMessages({
        breakPlanner: makeMockPlanner(),
        settings: makeSettings({ schedulingMode: 'quota' }),
        i18next: makeI18next(),
        humanizeDuration: makeHumanize(),
        quotaManager: makeQuotaManager({ miniQuota: 85, longQuota: 60 })
      })
      sm.trayMessage.should.include('Mini: 85%')
    })

    it('includes Long: XX% line in quota mode', function () {
      const sm = new StatusMessages({
        breakPlanner: makeMockPlanner(),
        settings: makeSettings({ schedulingMode: 'quota' }),
        i18next: makeI18next(),
        humanizeDuration: makeHumanize(),
        quotaManager: makeQuotaManager({ miniQuota: 85, longQuota: 60 })
      })
      sm.trayMessage.should.include('Long: 60%')
    })

    it('does not include quota lines in classic mode', function () {
      const sm = new StatusMessages({
        breakPlanner: makeMockPlanner(),
        settings: makeSettings({ schedulingMode: 'classic' }),
        i18next: makeI18next(),
        humanizeDuration: makeHumanize()
      })
      sm.trayMessage.should.not.include('Mini:')
      sm.trayMessage.should.not.include('Long:')
    })
  })

  describe('trayMessage tier prefix', function () {
    it('adds [Y] prefix when tooltipTierPrefix=always (non-monochrome, yellow tier)', function () {
      const sm = new StatusMessages({
        breakPlanner: makeMockPlanner(),
        settings: makeSettings({ schedulingMode: 'quota', tooltipTierPrefix: 'always', useMonochromeTrayIcon: false }),
        i18next: makeI18next(),
        humanizeDuration: makeHumanize(),
        quotaManager: makeQuotaManager({ miniQuota: 50, longQuota: 90, miniTier: 'yellow', longTier: 'green' })
      })
      sm.trayMessage.should.include('[Y]')
    })

    it('adds [O] prefix when tooltipTierPrefix=auto and useMonochromeTrayIcon=true (orange tier)', function () {
      const sm = new StatusMessages({
        breakPlanner: makeMockPlanner(),
        settings: makeSettings({ schedulingMode: 'quota', tooltipTierPrefix: 'auto', useMonochromeTrayIcon: true }),
        i18next: makeI18next(),
        humanizeDuration: makeHumanize(),
        quotaManager: makeQuotaManager({ miniQuota: 20, longQuota: 45, miniTier: 'orange', longTier: 'yellow' })
      })
      sm.trayMessage.should.include('[O]')
    })

    it('omits tier prefix when tooltipTierPrefix=auto and useMonochromeTrayIcon=false', function () {
      const sm = new StatusMessages({
        breakPlanner: makeMockPlanner(),
        settings: makeSettings({ schedulingMode: 'quota', tooltipTierPrefix: 'auto', useMonochromeTrayIcon: false }),
        i18next: makeI18next(),
        humanizeDuration: makeHumanize(),
        quotaManager: makeQuotaManager({ miniQuota: 20, longQuota: 45, miniTier: 'orange', longTier: 'yellow' })
      })
      sm.trayMessage.should.not.include('[O]')
      sm.trayMessage.should.not.include('[Y]')
    })

    it('omits tier prefix when tooltipTierPrefix=never even with monochrome', function () {
      const sm = new StatusMessages({
        breakPlanner: makeMockPlanner(),
        settings: makeSettings({ schedulingMode: 'quota', tooltipTierPrefix: 'never', useMonochromeTrayIcon: true }),
        i18next: makeI18next(),
        humanizeDuration: makeHumanize(),
        quotaManager: makeQuotaManager({ miniQuota: 5, longQuota: 3, miniTier: 'red', longTier: 'red' })
      })
      sm.trayMessage.should.not.include('[R]')
    })

    it('uses [G] prefix for green tier when always', function () {
      const sm = new StatusMessages({
        breakPlanner: makeMockPlanner(),
        settings: makeSettings({ schedulingMode: 'quota', tooltipTierPrefix: 'always', useMonochromeTrayIcon: true }),
        i18next: makeI18next(),
        humanizeDuration: makeHumanize(),
        quotaManager: makeQuotaManager({ miniQuota: 100, longQuota: 100, miniTier: 'green', longTier: 'green' })
      })
      sm.trayMessage.should.include('[G]')
    })

    it('uses [R] prefix for red tier when always', function () {
      const sm = new StatusMessages({
        breakPlanner: makeMockPlanner(),
        settings: makeSettings({ schedulingMode: 'quota', tooltipTierPrefix: 'always', useMonochromeTrayIcon: true }),
        i18next: makeI18next(),
        humanizeDuration: makeHumanize(),
        quotaManager: makeQuotaManager({ miniQuota: 5, longQuota: 3, miniTier: 'red', longTier: 'red' })
      })
      sm.trayMessage.should.include('[R]')
    })
  })

  describe('quota boundary values in tooltip', function () {
    it('shows 0% correctly for both quotas', function () {
      const sm = new StatusMessages({
        breakPlanner: makeMockPlanner(),
        settings: makeSettings({ schedulingMode: 'quota' }),
        i18next: makeI18next(),
        humanizeDuration: makeHumanize(),
        quotaManager: makeQuotaManager({ miniQuota: 0, longQuota: 0, miniTier: 'red', longTier: 'red' })
      })
      sm.trayMessage.should.include('Mini: 0%')
      sm.trayMessage.should.include('Long: 0%')
    })

    it('shows 100% correctly for both quotas', function () {
      const sm = new StatusMessages({
        breakPlanner: makeMockPlanner(),
        settings: makeSettings({ schedulingMode: 'quota' }),
        i18next: makeI18next(),
        humanizeDuration: makeHumanize(),
        quotaManager: makeQuotaManager({ miniQuota: 100, longQuota: 100, miniTier: 'green', longTier: 'green' })
      })
      sm.trayMessage.should.include('Mini: 100%')
      sm.trayMessage.should.include('Long: 100%')
    })
  })

  describe('quota mode does not break existing pause/DnD/appExclusion messages', function () {
    it('still returns paused message in quota mode when isPaused=true', function () {
      const sm = new StatusMessages({
        breakPlanner: makeMockPlanner({ isPaused: true, timeLeft: null }),
        settings: makeSettings({ schedulingMode: 'quota' }),
        i18next: makeI18next(),
        humanizeDuration: makeHumanize(),
        quotaManager: makeQuotaManager({ miniQuota: 80, longQuota: 80 })
      })
      sm.trayMessage.should.include('Paused')
    })

    it('still returns DnD message in quota mode when doNotDisturb=true', function () {
      const sm = new StatusMessages({
        breakPlanner: makeMockPlanner({ isOnDnd: true }),
        settings: makeSettings({ schedulingMode: 'quota' }),
        i18next: makeI18next(),
        humanizeDuration: makeHumanize(),
        quotaManager: makeQuotaManager({ miniQuota: 80, longQuota: 80 })
      })
      sm.trayMessage.should.include('Do Not Disturb')
    })
  })
})
