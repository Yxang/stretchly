import { vi } from 'vitest'
import { expect } from 'chai'
import { calculateInterval, onShortcut, registerBreakShortcuts, setupBreak } from '../app/utils/breakShortcuts'

vi.mock('electron-log/main.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}))

describe('breakShortcuts resetQuotaShortcut', () => {
  describe('calculateInterval', () => {
    it('returns null for resetQuotaShortcut', () => {
      expect(calculateInterval('resetQuotaShortcut')).toBeNull()
    })
  })

  describe('onShortcut', () => {
    it('calls resetQuota and logs when resetQuotaShortcut fires', () => {
      const log = { info: vi.fn() }
      const resetQuota = vi.fn()
      const pauseBreaks = vi.fn()

      onShortcut({
        name: 'resetQuotaShortcut',
        settings: null,
        breakPlanner: null,
        functions: { resetQuota, pauseBreaks },
        log
      })

      expect(log.info).toHaveBeenCalledWith('Stretchly: resetting quota by shortcut')
      expect(resetQuota).toHaveBeenCalled()
      expect(pauseBreaks).not.toHaveBeenCalled()
    })

    it('does not call resetQuota for resetBreaksShortcut', () => {
      const log = { info: vi.fn() }
      const resetQuota = vi.fn()
      const resetBreaks = vi.fn()

      onShortcut({
        name: 'resetBreaksShortcut',
        settings: null,
        breakPlanner: null,
        functions: { resetQuota, resetBreaks },
        log
      })

      expect(resetQuota).not.toHaveBeenCalled()
      expect(resetBreaks).toHaveBeenCalled()
    })
  })

  describe('setupBreak', () => {
    it('registers resetQuotaShortcut and calls resetQuota when triggered', () => {
      const globalShortcut = { register: vi.fn().mockReturnValue(true) }
      const log = { info: vi.fn(), warn: vi.fn() }
      const resetQuota = vi.fn()

      setupBreak({
        name: 'resetQuotaShortcut',
        shortcutText: 'Ctrl+Shift+Q',
        settings: null,
        log,
        globalShortcut,
        breakPlanner: null,
        functions: { resetQuota }
      })

      expect(globalShortcut.register).toHaveBeenCalledWith('Ctrl+Shift+Q', expect.any(Function))
      globalShortcut.register.mock.calls[0][1]()
      expect(resetQuota).toHaveBeenCalled()
      expect(log.info).toHaveBeenCalledWith('Stretchly: resetQuotaShortcut registration successful (Ctrl+Shift+Q)')
    })
  })

  describe('registerBreakShortcuts', () => {
    it('includes resetQuotaShortcut when set', () => {
      const globalShortcut = { register: vi.fn().mockReturnValue(true) }
      const log = { info: vi.fn(), warn: vi.fn() }
      const resetQuota = vi.fn()

      const settings = { get: vi.fn((name) => name === 'resetQuotaShortcut' ? 'Ctrl+Shift+Q' : '') }

      registerBreakShortcuts({
        settings,
        log,
        globalShortcut,
        breakPlanner: null,
        functions: { resetQuota }
      })

      expect(globalShortcut.register).toHaveBeenCalledTimes(1)
      expect(globalShortcut.register).toHaveBeenCalledWith('Ctrl+Shift+Q', expect.any(Function))
    })

    it('skips resetQuotaShortcut when empty string', () => {
      const globalShortcut = { register: vi.fn().mockReturnValue(true) }
      const log = { info: vi.fn(), warn: vi.fn() }

      const settings = { get: vi.fn(() => '') }

      registerBreakShortcuts({
        settings,
        log,
        globalShortcut,
        breakPlanner: null,
        functions: {}
      })

      expect(globalShortcut.register).not.toHaveBeenCalled()
    })
  })
})
