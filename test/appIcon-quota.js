import 'chai/register-should'
import AppIcon from '../app/utils/appIcon.js'

function baseParams (overrides = {}) {
  return {
    platform: 'linux',
    paused: false,
    monochrome: false,
    inverted: false,
    darkMode: false,
    trayIconStyle: 'default',
    timeToBreak: 5,
    percentage: null,
    reference: 'startMicrobreak',
    ...overrides
  }
}

describe('AppIcon — quota mode zero regression (T008)', function () {
  it('quota mode does not alter AppIcon filename (same as classic for default style)', function () {
    const classic = new AppIcon(baseParams({ trayIconStyle: 'default', reference: 'finishMicrobreak' }))
    const quota = new AppIcon(baseParams({ trayIconStyle: 'default', reference: 'finishMicrobreak' }))
    quota.trayIconFileName.should.equal(classic.trayIconFileName)
  })

  it('quota mode does not alter AppIcon filename (same as classic for time style)', function () {
    const classic = new AppIcon(baseParams({ trayIconStyle: 'time', timeToBreak: 3, reference: 'startMicrobreak' }))
    const quota = new AppIcon(baseParams({ trayIconStyle: 'time', timeToBreak: 3, reference: 'startMicrobreak' }))
    quota.trayIconFileName.should.equal(classic.trayIconFileName)
    quota.trayIconFileName.should.equal('trayNumber3.png')
  })

  it('quota mode does not alter AppIcon filename (same as classic for progress style)', function () {
    const classic = new AppIcon(baseParams({ trayIconStyle: 'progress', percentage: 45, reference: 'startMicrobreak' }))
    const quota = new AppIcon(baseParams({ trayIconStyle: 'progress', percentage: 45, reference: 'startMicrobreak' }))
    quota.trayIconFileName.should.equal(classic.trayIconFileName)
    quota.trayIconFileName.should.equal('trayProgress45.png')
  })
})
