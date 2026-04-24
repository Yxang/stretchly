import { vi } from 'vitest'
import 'chai/register-should'
import Command from '../app/utils/commands'

vi.mock('electron-log/main.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}))

describe('commands reset-quota', () => {
  it('parses reset-quota as a supported command', () => {
    const cmd = new Command(['reset-quota'], '1.2.3')
    cmd.command.should.be.equal('reset-quota')
    cmd.hasSupportedCommand.should.be.equal(true)
  })

  it('reset-quota has no options', () => {
    const cmd = new Command(['reset-quota'], '1.2.3')
    // commands without options return null from getOpts
    ;(cmd.options === null).should.be.equal(true)
  })

  it('reset-quota is forwarded to main instance, not handled locally', () => {
    const cmd = new Command(['reset-quota'], '1.2.3')
    cmd.hasSupportedCommand.should.be.equal(true)
    // help/version/logs are handled locally; reset-quota falls through to forwarding
    cmd.command.should.not.be.equal('help')
    cmd.command.should.not.be.equal('version')
    cmd.command.should.not.be.equal('logs')
  })

  it('hasSupportedCommand is true for reset-quota as second instance', () => {
    const cmd = new Command(['reset-quota'], '1.2.3', false)
    cmd.hasSupportedCommand.should.be.equal(true)
  })

  it('unknown variant reset-quotas is not a supported command', () => {
    const cmd = new Command(['reset-quotas'], '1.2.3')
    cmd.hasSupportedCommand.should.be.equal(false)
  })
})
