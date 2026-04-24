import { formatTimeIn } from './utils.js'

class StatusMessages {
  constructor ({ breakPlanner, settings, i18next, humanizeDuration, quotaManager }) {
    this.reference = breakPlanner.scheduler.reference
    this.doNotDisturb = breakPlanner.dndManager.isOnDnd
    this.appExclusionPause = breakPlanner.appExclusionsManager.isSchedulerCleared
    this.timeLeft = breakPlanner.scheduler.timeLeft
    this.timeToNextBreak = breakPlanner.timeToNextBreak
    this.isPaused = breakPlanner.isPaused
    this.breakNumber = breakPlanner.breakNumber
    this.settings = settings
    this.i18next = i18next
    this.humanizeDuration = humanizeDuration
    this.quotaManager = quotaManager || breakPlanner.quotaManager || null
  }

  get trayMessage () {
    let message = ''
    if (this.reference === 'finishMicrobreak' || this.reference === 'finishBreak') {
      return message
    }

    if (this.isPaused) {
      if (this.timeLeft) {
        message += this.i18next.t('statusMessages.paused') + ' - ' +
          this.i18next.t('statusMessages.resuming') + ' ' +
          formatTimeIn(this.timeLeft, this.settings.get('language'), this.i18next, this.humanizeDuration)
        return message
      } else {
        message += this.i18next.t('statusMessages.paused') + ' ' +
          this.i18next.t('statusMessages.indefinitely')
        return message
      }
    }

    if (this.doNotDisturb) {
      message += this.i18next.t('statusMessages.paused') + ' - ' + this.i18next.t('statusMessages.dndMode')
      return message
    }

    if (this.appExclusionPause) {
      message += this.i18next.t('statusMessages.paused') + ' - ' + this.i18next.t('statusMessages.appExclusion')
      return message
    }

    const breakInterval = this.settings.get('breakInterval') + 1
    const breakNumber = this.breakNumber % breakInterval

    if (this.reference === 'startBreak' || this.reference === 'startBreakNotification') {
      message += this.i18next.t('statusMessages.nextLongBreak') + ' ' +
        formatTimeIn(this.timeToNextBreak, this.settings.get('language'), this.i18next, this.humanizeDuration)
      if (this.settings.get('schedulingMode') !== 'quota') return message
    }

    if (this.reference === 'startMicrobreak' || this.reference === 'startMicrobreakNotification') {
      message += this.i18next.t('statusMessages.nextMiniBreak') + ' ' +
        formatTimeIn(this.timeToNextBreak, this.settings.get('language'), this.i18next, this.humanizeDuration)
      if (this.settings.get('break')) {
        message += '\n' + this.i18next.t('statusMessages.nextLongBreak') + ' ' +
          this.i18next.t('statusMessages.afterMiniBreak', { count: breakInterval - breakNumber })
      }
      if (this.settings.get('schedulingMode') !== 'quota') return message
    }

    if (this.settings.get('schedulingMode') === 'quota' && this.quotaManager) {
      const qm = this.quotaManager
      const state = qm.getState()
      const miniPct = Math.round(state.miniQuota)
      const longPct = Math.round(state.longQuota)
      const miniPrefix = this._tierPrefix(qm.getTier('mini'))
      const longPrefix = this._tierPrefix(qm.getTier('long'))
      const miniLine = miniPrefix + this.i18next.t('quota.tray.mini', { percent: miniPct })
      const longLine = longPrefix + this.i18next.t('quota.tray.long', { percent: longPct })
      message += (message ? '\n\n' : '') + miniLine + '\n' + longLine
    }

    return message
  }

  _tierPrefix (tier) {
    const mode = this.settings.get('tooltipTierPrefix')
    if (mode === 'never') return ''
    if (mode === 'auto' && !this.settings.get('useMonochromeTrayIcon')) return ''
    const letter = { green: 'G', yellow: 'Y', orange: 'O', red: 'R' }[tier] || ''
    return letter ? `[${letter}] ` : ''
  }
}

export default StatusMessages
