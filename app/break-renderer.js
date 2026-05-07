import HtmlTranslate from './utils/htmlTranslate.js'
import applyBreakHealthEffect from './utils/breakHealthEffect.js'
import './platform.js'

window.onload = async (event) => {
  const [idea, started, duration, strictMode, postpone,
    postponePercent, backgroundColor, danger, breakHealthMode] = await window.breaks.sendBreakData()

  const mainColor = await window.settings.get('mainColor')

  new HtmlTranslate(document).translate()
  applyBreakHealthEffect(danger, breakHealthMode, mainColor)

  document.ondragover = event =>
    event.preventDefault()

  document.ondrop = event =>
    event.preventDefault()

  // Resolve quota status for red-tier postpone cost label (quota mode only).
  // Falls back gracefully when get-quota-status handler is not yet wired in main.js.
  let quotaStatus = { schedulingMode: 'classic', tier: 'green' }
  try {
    quotaStatus = await window.breaks.getQuotaStatus()
  } catch (_err) {
    // handler not yet implemented (T007 dependency) — classic path
  }

  const postponeCost = await window.settings.get('postponeCost')
  const redPostponeMultiplier = await window.settings.get('redPostponeMultiplier')
  const isRedTierQuota = quotaStatus &&
    quotaStatus.schedulingMode === 'quota' &&
    quotaStatus.tier === 'red'

  document.querySelector('#close').onclick = async event =>
    await window.breaks.finishBreak(manualAwaiting)

  document.querySelector('#postpone').onclick = async event => {
    const tier = (quotaStatus && quotaStatus.tier) || null
    await window.breaks.postponeBreak(tier)
  }

  // Show 2× deduction label on the postpone button when in quota red tier.
  if (isRedTierQuota) {
    const cost = Math.round(postponeCost * redPostponeMultiplier)
    const postponeSpan = document.querySelector('#postpone > span[data-i18next]')
    if (postponeSpan) {
      // Use i18n key if available; fall back to English literal (i18n gap: quota.postpone.redCost).
      // T011 provides quota.redPostponeWarning.title but not quota.postpone.redCost.
      // Using inline English until T011 adds the key or architect confirms the key name.
      postponeSpan.removeAttribute('data-i18next')
      postponeSpan.textContent = `Postpone (costs ${cost}%)`
    }
  }

  document.querySelector('.break-idea').innerHTML = window.breaks.sanitizeIdea(idea[0])
  document.querySelector('.break-text').innerHTML = window.breaks.sanitizeIdea(idea[1])

  document.querySelectorAll('.break-idea a, .break-text a').forEach(a => {
    a.onclick = (event) => {
      event.preventDefault()
      window.electronApi.openExternal(a.href)
    }
  })

  document.querySelectorAll('.break-idea img, .break-text img').forEach(async img => {
    const src = img.getAttribute('src') || ''
    const resolved = await window.electronApi.resolveLocalImage(src)
    if (resolved) {
      img.src = resolved
    } else {
      img.remove()
    }
  })

  const progress = document.querySelector('#progress')
  const progressTime = document.querySelector('#progress-time')
  const postponeElement = document.querySelector('#postpone')
  const closeElement = document.querySelector('#close')
  const manualFinishElement = document.querySelector('#finish')
  document.body.classList.add(mainColor.substring(1))
  document.body.style.backgroundColor = backgroundColor

  document.querySelectorAll('.tiptext').forEach(async tt => {
    const keyboardShortcut = await window.settings.get('endBreakShortcut')
    tt.innerHTML = window.utils.formatKeyboardShortcut(keyboardShortcut)
  })

  let manualAwaiting = false

  const locale = await window.settings.get('language')

  manualFinishElement.onclick = async () => {
    await window.breaks.finishBreak(manualAwaiting)
  }

  setInterval(async () => {
    if (await window.settings.get('currentTimeInBreaks')) {
      document.querySelector('.breaks > :last-child').innerHTML = (new Date()).toLocaleTimeString()
    }
    const now = Date.now()
    const passed = now - started
    if (!manualAwaiting) {
      if (passed < duration) {
        const passedPercent = passed / duration * 100
        if (window.utils.canPostpone(postpone, passedPercent, postponePercent)) {
          postponeElement.classList.remove('hidden')
        } else {
          postponeElement.classList.add('hidden')
        }
        if (window.utils.canSkip(strictMode, postpone, passedPercent, postponePercent)) {
          closeElement.classList.remove('hidden')
        } else {
          closeElement.classList.add('hidden')
        }
        progress.value = (100 - passedPercent) * progress.max / 100
        progressTime.innerHTML = await window.utils.formatTimeRemaining(duration - passed, locale)
      }
    } else {
      progressTime.innerHTML = await window.utils.formatElapsedDuration(passed, locale)
    }
  }, 100)

  window.breaks.onEnterManualAwait(async (which) => {
    if (which !== 'break' || manualAwaiting) return
    manualAwaiting = true
    progress.value = 0
    progressTime.classList.remove('hidden')
    postponeElement.classList.add('hidden')
    closeElement.classList.add('hidden')
    manualFinishElement.classList.remove('hidden')
    progressTime.innerHTML = await window.utils.formatElapsedDuration(Date.now() - started, locale)
  })

  await window.breaks.signalLoaded()
}
