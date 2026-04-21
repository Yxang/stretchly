import 'chai/register-should'
import defaultSettings from '../app/utils/defaultSettings.js'

describe('defaultSettings — quota schema (T001)', function () {
  // Test 1: Normal path — all new quota fields present with correct defaults (IF-3)
  describe('quota scheduling fields', function () {
    it('should have schedulingMode defaulting to classic', function () {
      defaultSettings.schedulingMode.should.equal('classic')
    })

    it('should have quotaPreset defaulting to default', function () {
      defaultSettings.quotaPreset.should.equal('default')
    })

    it('should have miniBreakWorkWindowMs defaulting to 1500000 (25 min)', function () {
      defaultSettings.miniBreakWorkWindowMs.should.equal(1500000)
    })

    it('should have longBreakWorkWindowMs defaulting to 7200000 (120 min)', function () {
      defaultSettings.longBreakWorkWindowMs.should.equal(7200000)
    })

    it('should have longBreakBonusToMini defaulting to 50', function () {
      defaultSettings.longBreakBonusToMini.should.equal(50)
    })

    it('should have ignoreCost defaulting to 5', function () {
      defaultSettings.ignoreCost.should.equal(5)
    })

    it('should have postponeCost defaulting to 10', function () {
      defaultSettings.postponeCost.should.equal(10)
    })

    it('should have redPostponeMultiplier defaulting to 2', function () {
      defaultSettings.redPostponeMultiplier.should.equal(2)
    })

    it('should have tierGreenMin defaulting to 70', function () {
      defaultSettings.tierGreenMin.should.equal(70)
    })

    it('should have tierYellowMin defaulting to 30', function () {
      defaultSettings.tierYellowMin.should.equal(30)
    })

    it('should have tierOrangeMin defaulting to 10', function () {
      defaultSettings.tierOrangeMin.should.equal(10)
    })

    it('should have longBreakHardDeadlineMs defaulting to 7200000 (120 min)', function () {
      defaultSettings.longBreakHardDeadlineMs.should.equal(7200000)
    })

    it('should have harassmentBaseIntervalMs defaulting to 600000 (10 min)', function () {
      defaultSettings.harassmentBaseIntervalMs.should.equal(600000)
    })

    it('should have harassmentMinIntervalMs defaulting to 30000 (30 s)', function () {
      defaultSettings.harassmentMinIntervalMs.should.equal(30000)
    })

    it('should have softReminderPosition defaulting to bottomRight', function () {
      defaultSettings.softReminderPosition.should.equal('bottomRight')
    })

    it('should have softReminderWidth defaulting to 360', function () {
      defaultSettings.softReminderWidth.should.equal(360)
    })

    it('should have softReminderHeight defaulting to 200', function () {
      defaultSettings.softReminderHeight.should.equal(200)
    })

    it('should have softReminderYellowIntervalMs defaulting to 300000 (5 min)', function () {
      defaultSettings.softReminderYellowIntervalMs.should.equal(300000)
    })

    it('should have softReminderOrangeIntervalMs defaulting to 120000 (2 min)', function () {
      defaultSettings.softReminderOrangeIntervalMs.should.equal(120000)
    })

    it('should have softReminderAutoDismissMs defaulting to 90000 (90 s)', function () {
      defaultSettings.softReminderAutoDismissMs.should.equal(90000)
    })

    it('should have greenTierToastMode defaulting to on-threshold-cross', function () {
      defaultSettings.greenTierToastMode.should.equal('on-threshold-cross')
    })

    it('should have greenTierToastPeriodicMs defaulting to 1200000 (20 min)', function () {
      defaultSettings.greenTierToastPeriodicMs.should.equal(1200000)
    })

    it('should have greenToastUnlockThreshold defaulting to 80', function () {
      defaultSettings.greenToastUnlockThreshold.should.equal(80)
    })

    it('should have tooltipTierPrefix defaulting to auto', function () {
      defaultSettings.tooltipTierPrefix.should.equal('auto')
    })

    it('should have resetQuotaShortcut defaulting to empty string', function () {
      defaultSettings.resetQuotaShortcut.should.equal('')
    })
  })

  // Test 2: Boundary — __quotaState__ object with all required sub-fields
  describe('__quotaState__ object', function () {
    it('should have __quotaState__ as an object', function () {
      defaultSettings.__quotaState__.should.be.an('object')
    })

    it('should have __quotaState__.miniQuota defaulting to 100', function () {
      defaultSettings.__quotaState__.miniQuota.should.equal(100)
    })

    it('should have __quotaState__.longQuota defaulting to 100', function () {
      defaultSettings.__quotaState__.longQuota.should.equal(100)
    })

    it('should have __quotaState__.lastActiveTimestamp defaulting to 0', function () {
      defaultSettings.__quotaState__.lastActiveTimestamp.should.equal(0)
    })

    it('should have __quotaState__.lastLongBreakTimestamp defaulting to 0', function () {
      defaultSettings.__quotaState__.lastLongBreakTimestamp.should.equal(0)
    })

    it('should have __quotaState__.lastResetDate defaulting to empty string', function () {
      defaultSettings.__quotaState__.lastResetDate.should.equal('')
    })

    it('should have __quotaState__.harassmentRejectCount defaulting to 0', function () {
      defaultSettings.__quotaState__.harassmentRejectCount.should.equal(0)
    })

    it('should have __quotaState__ with exactly the expected keys', function () {
      const keys = Object.keys(defaultSettings.__quotaState__).sort()
      keys.should.deep.equal([
        'harassmentRejectCount',
        'lastActiveTimestamp',
        'lastLongBreakTimestamp',
        'lastResetDate',
        'longQuota',
        'miniQuota'
      ])
    })
  })

  // Test 3: Zero-regression — existing v1.20.0 fields must remain unchanged
  describe('zero-regression guard for existing fields', function () {
    it('should keep microbreakInterval at 600000', function () {
      defaultSettings.microbreakInterval.should.equal(600000)
    })

    it('should keep microbreakDuration at 20000', function () {
      defaultSettings.microbreakDuration.should.equal(20000)
    })

    it('should keep breakDuration at 300000', function () {
      defaultSettings.breakDuration.should.equal(300000)
    })

    it('should keep breakInterval at 2', function () {
      defaultSettings.breakInterval.should.equal(2)
    })

    it('should keep morningHour at 6', function () {
      defaultSettings.morningHour.should.equal(6)
    })

    it('should keep microbreakStrictMode at false', function () {
      defaultSettings.microbreakStrictMode.should.equal(false)
    })

    it('should keep breakStrictMode at false', function () {
      defaultSettings.breakStrictMode.should.equal(false)
    })

    it('should keep mainColor at #478484', function () {
      defaultSettings.mainColor.should.equal('#478484')
    })

    it('should keep naturalBreaks at true', function () {
      defaultSettings.naturalBreaks.should.equal(true)
    })

    it('should keep microbreakPostpone at true', function () {
      defaultSettings.microbreakPostpone.should.equal(true)
    })

    it('should keep breakPostpone at true', function () {
      defaultSettings.breakPostpone.should.equal(true)
    })

    it('should keep microbreakPostponesLimit at 1', function () {
      defaultSettings.microbreakPostponesLimit.should.equal(1)
    })

    it('should keep breakPostponesLimit at 1', function () {
      defaultSettings.breakPostponesLimit.should.equal(1)
    })

    it('should keep endBreakShortcut at CmdOrCtrl+X', function () {
      defaultSettings.endBreakShortcut.should.equal('CmdOrCtrl+X')
    })
  })
})
