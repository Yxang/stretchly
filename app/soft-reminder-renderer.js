import HtmlTranslate from './utils/htmlTranslate.js'
import './platform.js'

const DEFAULT_AUTO_CLOSE_SECONDS = 90
const POSTPONE_DEBOUNCE_MS = 500

function getTierClass (quota) {
  if (quota > 70) return 'tier-green'
  if (quota > 30) return 'tier-yellow'
  if (quota > 10) return 'tier-orange'
  return 'tier-red'
}

function updateProgressBar (progressEl, pctEl, value) {
  progressEl.value = value
  pctEl.textContent = Math.round(value) + '%'

  progressEl.classList.remove('tier-green', 'tier-yellow', 'tier-orange', 'tier-red')
  progressEl.classList.add(getTierClass(value))
}

window.onload = async () => {
  new HtmlTranslate(document).translate()

  const reminder = document.getElementById('soft-reminder')
  const miniProgress = document.getElementById('mini-progress')
  const longProgress = document.getElementById('long-progress')
  const miniPct = document.getElementById('mini-pct')
  const longPct = document.getElementById('long-pct')
  const btnRestNow = document.getElementById('btn-rest-now')
  const btnPostpone = document.getElementById('btn-postpone')
  const btnIgnore = document.getElementById('btn-ignore')
  const countdownEl = document.getElementById('countdown')

  const state = await window.softReminder.getState()
  const autoCloseSeconds = state && typeof state.autoDismissMs === 'number'
    ? Math.max(1, Math.round(state.autoDismissMs / 1000))
    : DEFAULT_AUTO_CLOSE_SECONDS

  let countdownValue = autoCloseSeconds
  let countdownInterval = null
  let actionTaken = false
  let postponeDebouncing = false

  if (state) {
    updateProgressBar(miniProgress, miniPct, state.miniQuota)
    updateProgressBar(longProgress, longPct, state.longQuota)
  }

  setTimeout(() => {
    reminder.classList.add('visible')
  }, 16)

  async function getCountdownText (seconds) {
    return window.i18next.t('quota.softReminder.closingIn', { seconds })
  }

  function clearCountdown () {
    if (countdownInterval) {
      clearInterval(countdownInterval)
      countdownInterval = null
    }
    countdownEl.textContent = ''
  }

  async function startCountdown () {
    countdownEl.textContent = await getCountdownText(countdownValue)
    countdownInterval = setInterval(async () => {
      countdownValue--
      if (countdownValue <= 0) {
        clearCountdown()
        if (!actionTaken) {
          actionTaken = true
          await closeWithAnimation(false)
          await window.softReminder.autoClose()
        }
      } else {
        countdownEl.textContent = await getCountdownText(countdownValue)
      }
    }, 1000)
  }

  async function closeWithAnimation (sendAction) {
    if (sendAction) {
      clearCountdown()
    }
    reminder.classList.remove('visible')
    reminder.classList.add('hiding')
    return new Promise(resolve => {
      setTimeout(() => {
        resolve()
      }, 200)
    })
  }

  async function handleRestNow () {
    if (actionTaken) return
    actionTaken = true
    await closeWithAnimation(true)
    await window.softReminder.takeBreakNow()
  }

  async function handlePostpone () {
    if (actionTaken || postponeDebouncing) return
    actionTaken = true
    postponeDebouncing = true
    btnPostpone.disabled = true
    setTimeout(() => {
      postponeDebouncing = false
      btnPostpone.disabled = false
    }, POSTPONE_DEBOUNCE_MS)
    await closeWithAnimation(true)
    await window.softReminder.postponeTwoMin()
  }

  async function handleIgnore () {
    if (actionTaken) return
    actionTaken = true
    await closeWithAnimation(true)
    await window.softReminder.ignoreAndClose()
  }

  btnRestNow.addEventListener('click', handleRestNow)
  btnPostpone.addEventListener('click', handlePostpone)
  btnIgnore.addEventListener('click', handleIgnore)

  document.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape') {
      await handleIgnore()
    }
  })

  await startCountdown()
}
