import VersionChecker from './utils/versionChecker.js'
import { setSameWidths } from './utils/sameWidths.js'
import HtmlTranslate from './utils/htmlTranslate.js'

import './platform.js'

const versionChecker = new VersionChecker()
let eventsAttached = false

const PRESETS = {
  relaxed: { miniBreakWorkWindowMs: 1800000, microbreakDuration: 300000 },
  default: { miniBreakWorkWindowMs: 1500000, microbreakDuration: 300000 },
  strict: { miniBreakWorkWindowMs: 1200000, microbreakDuration: 300000 }
}

function applyPreset (name) {
  if (!PRESETS[name]) return
  const preset = PRESETS[name]
  for (const [key, value] of Object.entries(preset)) {
    window.settings.saveSettings(key, value)
  }
  window.settings.saveSettings('quotaPreset', name)
}

function updateQuotaVisibility (mode) {
  const isQuota = mode === 'quota'
  document.querySelectorAll('.quota-section').forEach(el => {
    if (isQuota) {
      el.classList.remove('hidden')
    } else {
      el.classList.add('hidden')
    }
  })
  document.querySelectorAll('[data-classic-only]').forEach(el => {
    if (isQuota) {
      el.classList.add('hidden')
    } else {
      el.classList.remove('hidden')
    }
  })
  const advancedContent = document.querySelector('.quota-advanced-content')
  if (advancedContent && !isQuota) {
    advancedContent.classList.add('hidden')
    const arrow = document.querySelector('.quota-advanced-arrow')
    if (arrow) arrow.innerHTML = '&#9658;'
  }
}

function checkThresholdWarnings () {
  const yellow = parseInt(document.querySelector('#quotaYellowBelow').value) || 0
  const orange = parseInt(document.querySelector('#quotaOrangeBelow').value) || 0
  const red = parseInt(document.querySelector('#quotaRedBelow').value) || 0
  const warnYO = document.querySelector('#warnYellowGtOrange')
  const warnOR = document.querySelector('#warnOrangeGtRed')
  if (warnYO) {
    if (yellow <= orange) {
      warnYO.classList.remove('hidden')
    } else {
      warnYO.classList.add('hidden')
    }
  }
  if (warnOR) {
    if (orange <= red) {
      warnOR.classList.remove('hidden')
    } else {
      warnOR.classList.add('hidden')
    }
  }
}

function updateTierOrderError () {
  const green = parseInt(document.querySelector('#quotaYellowBelow').value) || 0
  const yellow = parseInt(document.querySelector('#quotaOrangeBelow').value) || 0
  const orange = parseInt(document.querySelector('#quotaRedBelow').value) || 0
  const valid = green > yellow && yellow > orange && orange > 0
  const errorMsg = document.querySelector('#tierOrderError')
  const inputs = [
    document.querySelector('#quotaYellowBelow'),
    document.querySelector('#quotaOrangeBelow'),
    document.querySelector('#quotaRedBelow')
  ]
  inputs.forEach(el => {
    if (!el) return
    if (!valid) {
      el.classList.add('tier-threshold-error')
    } else {
      el.classList.remove('tier-threshold-error')
    }
  })
  if (errorMsg) {
    if (!valid) {
      errorMsg.classList.remove('hidden')
    } else {
      errorMsg.classList.add('hidden')
    }
  }
}

window.onload = async (e) => {
  const bounds = await window.stretchly.getWindowBounds()
  const settings = await window.settings.currentSettings()
  if (settings.disableAppUpdateFeatures) {
    document.querySelector('#checkNewVersion').closest('div').classList.add('hidden')
  }

  if (settings.hideStrictModePreferences) {
    document.querySelectorAll('[data-strict-mode]').forEach(element => {
      element.classList.add('hidden')
    })
    document.querySelector('#enablePostponeLong').closest('div').style.marginBottom = '56px'
  }

  if (settings.hidePreferencesFileLocation) {
    document.querySelectorAll('[data-preferences-file]').forEach(element => {
      element.classList.add('hidden')
    })
  }

  new HtmlTranslate(document).translate()
  setWindowHeight()
  setTimeout(() => { eventsAttached = true }, 500)

  if (settings.customPreferencesMessage) {
    const customMessageDiv = document.createElement('div')
    customMessageDiv.className = 'custom-message'
    customMessageDiv.textContent = settings.customPreferencesMessage
    document.querySelector('.navigation').parentNode.insertBefore(customMessageDiv, document.querySelector('.navigation').nextSibling)
  }

  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    const imagesWithDarkVersion = document.querySelectorAll('[data-has-dark-version]')
    imagesWithDarkVersion.forEach(image => {
      // replace last occurance https://github.com/electron-userland/electron-builder/issues/5152
      const newSource = image.src.replace(/.([^.]*)$/, '-dark.' + '$1')
      image.src = newSource
    })
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    const imagesWithDarkVersion = document.querySelectorAll('[data-has-dark-version]')
    if (event.matches) {
      imagesWithDarkVersion.forEach(image => {
        const newSource = image.src.replace(/.([^.]*)$/, '-dark.' + '$1')
        image.src = newSource
      })
    } else {
      imagesWithDarkVersion.forEach(image => {
        const newSource = image.src.replace('-dark.', '.')
        image.src = newSource
      })
    }
  })

  document.ondragover = event =>
    event.preventDefault()

  document.ondrop = event =>
    event.preventDefault()

  document.onkeydown = async event => {
    if (event.key === 'd' && (event.ctrlKey || event.metaKey)) {
      const [
        reference, timeleft, breaknumber,
        postponesnumber, settingsfile, logsfile, doNotDisturb, imagesfolder
      ] = await window.stretchly.showDebug()
      const debugInfo = document.querySelector('.debug > :first-child')
      if (!debugInfo.classList.contains('hidden')) {
        debugInfo.classList.add('hidden')
      } else {
        debugInfo.classList.remove('hidden')
        document.querySelector('#reference').innerHTML = reference
        document.querySelector('#timeleft').innerHTML = timeleft
        document.querySelector('#breakNumber').innerHTML = breaknumber
        document.querySelector('#postponesNumber').innerHTML = postponesnumber
        document.querySelector('#settingsfile').innerHTML = settingsfile
        document.querySelector('#logsfile').innerHTML = logsfile
        document.querySelector('#imagesfolder').innerHTML = imagesfolder
        document.querySelector('#donotdisturb').innerHTML = doNotDisturb
        document.querySelector('#node').innerHTML = await window.runtime.node()
        document.querySelector('#chrome').innerHTML = await window.runtime.chrome()
        document.querySelector('#electron').innerHTML = await window.runtime.electron()
        document.querySelector('#platform').innerHTML = await window.runtime.platform()
        document.querySelector('#windowsStore').innerHTML = await window.runtime.windowsStore() || false
        document.querySelector('#windowsPortable').innerHTML = await window.runtime.windowsPortable() || false
      }
      setWindowHeight()
    }
  }

  window.stretchly.onTranslate(async () => {
    new HtmlTranslate(document).translate()
    document.querySelectorAll('input[type="range"]').forEach(async range => {
      const settings = await window.settings.currentSettings()
      const divisor = range.dataset.divisor
      const output = range.closest('div').querySelector('output')
      range.value = settings[range.name] / divisor
      const unit = output.dataset.unit
      output.innerHTML = await window.utils.formatUnitAndValue(unit, range.value)
      document.querySelector('#longBreakEvery').closest('div').querySelector('output')
        .innerHTML = await window.i18next.t('utils.minutes', { count: parseInt(realBreakInterval()) })
    })
    setWindowHeight()
  })

  window.stretchly.onEnableContributorPreferences(() => {
    showContributorPreferencesButton()
  })

  const showContributorPreferencesButton = () => {
    document.querySelectorAll('.contributor').forEach((item) => {
      item.classList.remove('hidden')
    })
    document.querySelectorAll('.become').forEach((item) => {
      item.classList.add('hidden')
    })
    document.querySelectorAll('.authenticate').forEach((item) => {
      item.classList.add('hidden')
    })
    setWindowHeight()
  }

  if (await window.global.getValue('isContributor')) {
    showContributorPreferencesButton()
  }

  document.querySelector('[name="contributorPreferences"]').onclick = (event) => {
    event.preventDefault()
    window.stretchly.openContributorPreferences()
  }

  document.querySelector('[name="syncPreferences"]').onclick = (event) => {
    event.preventDefault()
    window.stretchly.openSyncPreferences()
  }

  document.querySelector('.debug button').onclick = async (event) => {
    event.preventDefault()
    const toCopy = document.querySelector('#to-copy')
    await navigator.clipboard.writeText(toCopy.textContent)
    const copiedEl = document.createElement('span')
    copiedEl.innerHTML = ' copied!'
    event.target.parentNode.appendChild(copiedEl)
    setTimeout(() => copiedEl.remove(), 1275)
  }

  document.querySelectorAll('.navigation a').forEach(element => {
    element.onclick = event => {
      event.preventDefault()
      event.target.closest('.navigation').childNodes.forEach(link => {
        if (link.classList) {
          link.classList.remove('active')
        }
      })
      event.target.closest('a').classList.add('active')

      const toBeDisplayed = document.querySelector(`.${event.target.closest('[data-section]').getAttribute('data-section')}`)
      document.querySelectorAll('body > div:not(.custom-message)').forEach(section => {
        if (section !== toBeDisplayed) {
          section.classList.add('hidden')
        } else {
          section.classList.remove('hidden')
        }
      })

      setSameWidths()
      setWindowHeight()
    }
  })

  document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    const isNegative = checkbox.classList.contains('negative')
    checkbox.checked = isNegative ? !settings[checkbox.value] : settings[checkbox.value]
    if (!eventsAttached) {
      checkbox.onchange = (event) =>
        window.settings.saveSettings(checkbox.value,
          isNegative ? !checkbox.checked : checkbox.checked)
    }
  })

  document.querySelectorAll('input[type="radio"]').forEach(radio => {
    let value
    switch (radio.value) {
      case 'true':
        value = true
        break
      case 'false':
        value = false
        break
      default:
        value = radio.value
    }
    radio.checked = settings[radio.name] === value
    if (!eventsAttached) {
      radio.onchange = (event) => {
        window.settings.saveSettings(radio.name, value)
      }
    }
  })

  document.querySelector('#language').value = settings.language
  if (!eventsAttached) {
    document.querySelector('#language').onchange = (event) => {
      window.settings.saveSettings('language', event.target.value)
    }
  }

  document.querySelector('#trayIconStyle').value = settings.trayIconStyle
  if (!eventsAttached) {
    document.querySelector('#trayIconStyle').onchange = (event) => {
      window.settings.saveSettings('trayIconStyle', event.target.value)
    }
  }

  document.querySelectorAll('input[type="range"]').forEach(async range => {
    const divisor = range.dataset.divisor
    const output = range.closest('div').querySelector('output')
    range.value = settings[range.name] / divisor
    const unit = output.dataset.unit
    output.innerHTML = await window.utils.formatUnitAndValue(unit, range.value)
    document.querySelector('#longBreakEvery').closest('div').querySelector('output')
      .innerHTML = await window.i18next.t('utils.minutes', { count: parseInt(realBreakInterval()) })
    if (!eventsAttached) {
      range.onchange = async event => {
        output.innerHTML = await window.utils.formatUnitAndValue(unit, range.value)
        document.querySelector('#longBreakEvery').closest('div').querySelector('output')
          .innerHTML = await window.i18next.t('utils.minutes', { count: parseInt(realBreakInterval()) })
        window.settings.saveSettings(range.name, range.value * divisor)
      }
      range.oninput = async event => {
        output.innerHTML = await window.utils.formatUnitAndValue(unit, range.value)
        document.querySelector('#longBreakEvery').closest('div').querySelector('output')
          .innerHTML = await window.i18next.t('utils.minutes', { count: parseInt(realBreakInterval()) })
      }
    }
  })

  document.querySelectorAll('.sounds img').forEach(preview => {
    if (!eventsAttached) {
      preview.onclick = (event) =>
        window.stretchly.playSound(preview.closest('div').querySelector('input').value)
    }
  })

  setWindowHeight()
  initQuotaUI(settings)

  document.querySelectorAll('.enabletype').forEach((element) => {
    element.onclick = async (event) => {
      const enabletypeChecked = document.querySelectorAll('.enabletype:checked')
      if (enabletypeChecked.length === 0) {
        element.checked = true
        window.settings.saveSettings(element.value, element.checked)
        window.alert(await window.i18next.t('preferences.schedule.cantDisableBoth'))
      }
    }
  })

  document.querySelector('.settings > div > button').onclick = (event) => {
    window.stretchly.restoreDefaults()
  }

  document.querySelectorAll('.about a').forEach((item) => {
    item.onclick = (event) => {
      event.preventDefault()
      if (event.target.classList.contains('file')) {
        window.electronApi.openPath(event.target.innerHTML)
      } else {
        window.electronApi.openExternal(event.target.href)
      }
    }
  })

  document.querySelector('[name="becomeContributor"]').onclick = () => {
    window.electronApi.openExternal('https://hovancik.net/stretchly/sponsor')
  }

  document.querySelector('[name="alreadyContributor"]').onclick = () => {
    document.querySelectorAll('.become').forEach((item) => {
      item.classList.add('hidden')
    })
    document.querySelectorAll('.authenticate').forEach((item) => {
      item.classList.remove('hidden')
    })
    setWindowHeight()
  }

  document.querySelectorAll('.authenticate a').forEach((button) => {
    button.onclick = (event) => {
      event.preventDefault()
      window.stretchly.openContributorAuth(button.dataset.provider)
    }
  })

  document.querySelector('.version').innerHTML = await window.stretchly.getVersion()
  if (!settings.disableAppUpdateFeatures) {
    versionChecker.latest()
      .then(version => {
        document.querySelector('.latestVersion').innerHTML = version.replace('v', '')
      })
      .catch(exception => {
        console.error(exception)
        document.querySelector('.latestVersion').innerHTML = 'N/A'
      })
  }

  function initQuotaUI (settings) {
    updateQuotaVisibility(settings.schedulingMode || 'classic')

    const schedulingModeRadios = document.querySelectorAll('input[name="schedulingMode"]')
    schedulingModeRadios.forEach(radio => {
      radio.checked = (radio.value === (settings.schedulingMode || 'classic'))
      radio.onchange = () => {
        window.settings.saveSettings('schedulingMode', radio.value)
        updateQuotaVisibility(radio.value)
        setWindowHeight()
      }
    })

    const presetRadios = document.querySelectorAll('input[name="quotaPreset"]')
    presetRadios.forEach(radio => {
      radio.checked = (radio.value === (settings.quotaPreset || 'default'))
      radio.onchange = () => {
        applyPreset(radio.value)
        syncQuotaAdvancedSliders()
      }
    })

    const advancedToggle = document.querySelector('.quota-advanced-toggle')
    const advancedContent = document.querySelector('.quota-advanced-content')
    const advancedArrow = document.querySelector('.quota-advanced-arrow')
    if (advancedToggle && advancedContent) {
      advancedToggle.style.cursor = 'pointer'
      advancedToggle.onclick = () => {
        const isHidden = advancedContent.classList.contains('hidden')
        if (isHidden) {
          advancedContent.classList.remove('hidden')
          if (advancedArrow) advancedArrow.innerHTML = '&#9660;'
        } else {
          advancedContent.classList.add('hidden')
          if (advancedArrow) advancedArrow.innerHTML = '&#9658;'
        }
        setWindowHeight()
      }
    }

    if (advancedContent) {
      advancedContent.querySelectorAll('input[type="range"]').forEach(range => {
        range.addEventListener('change', () => {
          if (['tierGreenMin', 'tierYellowMin', 'tierOrangeMin'].includes(range.name)) {
            checkThresholdWarnings()
            updateTierOrderError()
          }
          uncheckPresets()
        })
        range.addEventListener('input', () => {
          if (['tierGreenMin', 'tierYellowMin', 'tierOrangeMin'].includes(range.name)) {
            checkThresholdWarnings()
            updateTierOrderError()
          }
        })
        if (['tierGreenMin', 'tierYellowMin', 'tierOrangeMin'].includes(range.name)) {
          range.addEventListener('blur', () => {
            updateTierOrderError()
          })
        }
      })
    }

    const greenTierRadios = document.querySelectorAll('input[name="greenTierToastMode"]')
    const periodicInput = document.querySelector('.quota-periodic-input')
    greenTierRadios.forEach(radio => {
      radio.checked = (radio.value === (settings.greenTierToastMode || 'on-threshold-cross'))
      radio.onchange = () => {
        window.settings.saveSettings('greenTierToastMode', radio.value)
        uncheckPresets()
        if (periodicInput) {
          if (radio.value === 'periodic') {
            periodicInput.classList.remove('hidden')
          } else {
            periodicInput.classList.add('hidden')
          }
        }
      }
    })
    if (periodicInput && settings.greenTierToastMode === 'periodic') {
      periodicInput.classList.remove('hidden')
    }

    const periodicRange = document.querySelector('#greenTierPeriodicMin')
    if (periodicRange) {
      periodicRange.value = (settings.greenTierToastPeriodicMs || 1200000) / 60000
      const periodicOutput = periodicRange.closest('span').querySelector('output')
      if (periodicOutput) {
        window.utils.formatUnitAndValue('minutes', periodicRange.value).then(v => {
          periodicOutput.innerHTML = v
        })
      }
      periodicRange.onchange = async event => {
        if (periodicOutput) {
          periodicOutput.innerHTML = await window.utils.formatUnitAndValue('minutes', periodicRange.value)
        }
        window.settings.saveSettings('greenTierToastPeriodicMs', periodicRange.value * 60000)
        uncheckPresets()
      }
      periodicRange.oninput = async event => {
        if (periodicOutput) {
          periodicOutput.innerHTML = await window.utils.formatUnitAndValue('minutes', periodicRange.value)
        }
      }
    }

    checkThresholdWarnings()
    updateTierOrderError()
  }

  function syncQuotaAdvancedSliders () {
    const advancedContent = document.querySelector('.quota-advanced-content')
    if (!advancedContent) return
    window.settings.currentSettings().then(async fresh => {
      const ranges = advancedContent.querySelectorAll('input[type="range"]')
      for (const range of ranges) {
        const divisor = range.dataset.divisor
        const output = range.closest('div').querySelector('output')
        range.value = fresh[range.name] / divisor
        if (output) {
          const unit = output.dataset.unit
          output.innerHTML = await window.utils.formatUnitAndValue(unit, range.value)
        }
      }
    })
  }

  function uncheckPresets () {
    document.querySelectorAll('input[name="quotaPreset"]').forEach(r => { r.checked = false })
    window.settings.saveSettings('quotaPreset', 'advanced')
  }

  function setWindowHeight () {
    const classes = document.querySelector('body').classList
    const scrollHeight = document.querySelector('body').scrollHeight
    const availHeight = window.screen.availHeight
    let height = null
    if (classes.contains('win32')) {
      if (scrollHeight + 40 > availHeight) {
        height = availHeight
      } else {
        height = scrollHeight + 40
      }
    } else {
      if (scrollHeight + 32 > availHeight) {
        height = availHeight
      } else {
        height = scrollHeight + 32
      }
    }
    if (height) {
      window.stretchly.setWindowSize(bounds.width, height)
    }
  }

  function realBreakInterval () {
    const microbreakInterval = document.querySelector('#miniBreakEvery').value * 1
    const breakInterval = document.querySelector('#longBreakEvery').value * 1
    return microbreakInterval * (breakInterval + 1)
  }
}
