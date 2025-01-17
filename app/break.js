const { ipcRenderer } = require('electron')
const remote = require('@electron/remote')
const Utils = remote.require('./utils/utils')
const HtmlTranslate = require('./utils/htmlTranslate')
const Store = require('electron-store')
const settings = new Store()

window.onload = (event) => {
  ipcRenderer.send('send-break-data')
  require('./platform')
  new HtmlTranslate(document).translate()

  document.ondragover = event =>
    event.preventDefault()

  document.ondrop = event =>
    event.preventDefault()

  document.querySelector('#close').onclick = event =>
    ipcRenderer.send('finish-break', false)

  document.querySelector('#postpone').onclick = event =>
    ipcRenderer.send('postpone-break')

  ipcRenderer.once('breakIdea', (event, message) => {
    const breakIdea = document.querySelector('.break-idea')
    breakIdea.innerHTML = message[0]
    const breakText = document.querySelector('.break-text')
    breakText.innerHTML = message[1]
  })

  ipcRenderer.once('progress', (event, started, duration, strictMode, postpone, postponePercent, backgroundColor) => {
    const progress = document.querySelector('#progress')
    const progressTime = document.querySelector('#progress-time')
    const postponeElement = document.querySelector('#postpone')
    const closeElement = document.querySelector('#close')
    const mainColor = settings.get('mainColor')
    document.body.classList.add(mainColor.substring(1))
    document.body.style.backgroundColor = backgroundColor

    document.querySelectorAll('.tiptext').forEach(tt => {
      const keyboardShortcut = settings.get('endBreakShortcut')
      tt.innerHTML = Utils.formatKeyboardShortcut(keyboardShortcut)
    })

    window.setInterval(() => {
      if (settings.get('currentTimeInBreaks')) {
        document.querySelector('.breaks > :last-child').innerHTML =
        (new Date()).toLocaleTimeString()
      }
      if (Date.now() - started < duration) {
        const passedPercent = (Date.now() - started) / duration * 100
        Utils.canSkip(strictMode, postpone, passedPercent, postponePercent)
        postponeElement.style.display =
          Utils.canPostpone(postpone, passedPercent, postponePercent) ? 'flex' : 'none'
        closeElement.style.display =
          Utils.canSkip(strictMode, postpone, passedPercent, postponePercent) ? 'flex' : 'none'
        progress.value = (100 - passedPercent) * progress.max / 100
        progressTime.innerHTML = Utils.formatTimeRemaining(Math.trunc(duration - Date.now() + started),
          settings.get('language'))
      }
    }, 100)
    ipcRenderer.send('long-break-loaded')
  })

  ipcRenderer.on('send-data', (event, data) => {
    const postponeTime = data.postponeTime || 0
    const postponeTimeElement = document.querySelector('#postpone-time')

    // Update the postpone-time span with the time in seconds
    postponeTimeElement.innerHTML = `(${Math.trunc(postponeTime / 1000)}s)`
  })
}
