// ATDD stubs for T-203: main.js save-setting handler + schedulingModeChanged listener
// Written from spec (IF-2, AC 2.2) BEFORE dev implementation.
// These tests are EXPECTED TO FAIL until dev-t203 implements the IPC handler changes.
//
// NOTE: app/main.js registers ipcMain handlers at module top-level — the entire file
// executes on import and requires Electron's ipcMain. It cannot be required/imported
// in a vitest unit test environment without a full Electron mock.
//
// Strategy: use static source-code assertions (grep on the file text) as a lightweight
// proxy for "handler is wired correctly". This is safe and deterministic. The headed
// integration checklist (AC 2.7, integration checks #1-#5) covers runtime behavior.

import { describe, it } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { resolve, dirname } from 'path'
import 'chai/register-should'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const mainSrc = readFileSync(resolve(__dirname, '../app/main.js'), 'utf8')

describe('main.js save-setting IPC handler — schedulingMode branch (v1.22 T-203 ATDD)', function () {
  // Case 6: save-setting with key=schedulingMode must call breakPlanner.setSchedulingMode
  // Spec: IF-2 — inside ipcMain.on('save-setting', ...) handler:
  //   if (key === 'schedulingMode') { breakPlanner.setSchedulingMode(value) }
  it('save-setting handler calls breakPlanner.setSchedulingMode(value) when key === schedulingMode', function () {
    // Static assertion: the source must contain key check + setSchedulingMode call
    const hasKeyCheck = /key === ['"]schedulingMode['"]/.test(mainSrc)
    const hasSetSchedulingModeCall = /breakPlanner\.setSchedulingMode\(/.test(mainSrc)
    hasKeyCheck.should.equal(true,
      'app/main.js must contain `key === "schedulingMode"` branch in save-setting handler (IF-2)')
    hasSetSchedulingModeCall.should.equal(true,
      'app/main.js must call breakPlanner.setSchedulingMode() in save-setting handler (IF-2)')
  })

  // Case 7: schedulingModeChanged listener must be registered and call updateTray
  // Spec: IF-2 — in main.js planner init section:
  //   breakPlanner.on('schedulingModeChanged', ({ mode, oldMode }) => { ...; updateTray() })
  it('breakPlanner.on("schedulingModeChanged") listener is registered and calls updateTray() (IF-2)', function () {
    const hasListener = /breakPlanner\.on\(['"]schedulingModeChanged['"]/.test(mainSrc)
    hasListener.should.equal(true,
      'app/main.js must register breakPlanner.on("schedulingModeChanged", ...) listener (IF-2)')
    // Also verify updateTray() appears somewhere after the listener registration
    // (crude but catches the absence entirely)
    const listenerIdx = mainSrc.indexOf("breakPlanner.on('schedulingModeChanged'") !== -1
      ? mainSrc.indexOf("breakPlanner.on('schedulingModeChanged'")
      : mainSrc.indexOf('breakPlanner.on("schedulingModeChanged"')
    const updateTrayAfter = mainSrc.indexOf('updateTray()', listenerIdx) !== -1
    updateTrayAfter.should.equal(true,
      'app/main.js schedulingModeChanged listener must call updateTray() (IF-2)')
  })
})
