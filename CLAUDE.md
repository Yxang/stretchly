# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Stretchly is a cross-platform Electron desktop app that schedules mini-breaks and long breaks to encourage healthy computer use. It is published to GitHub Releases, Homebrew, winget, Microsoft Store, Chocolatey, Flathub, Snap, and the Mac App Store. Target runtime is Node.js as pinned in `.nvmrc` (currently `24.14.0`); `package.json` has `"type": "module"`, so all `.js` files are ESM.

## Common commands

```bash
npm start              # run the app via electron (production-like)
npm run dev            # dev run with --remote-debugging-port=9222 (chrome://inspect or http://localhost:9222)
npm test               # vitest run (CI mode, single-pass)
npm run coverage       # vitest run --coverage (istanbul, lcov)
npm run tdd            # vitest --watch
npm run lint           # StandardJS lint (enforced by a husky pre-commit hook)
npm run pack           # electron-builder --dir (unpacked build)
npm run dist           # electron-builder build (produces installers)
```

Run a single test file with `npx vitest run test/scheduler.js` (or any path matching the `test/*.?(c|m)[jt]s` include in `vitest.config.ts`).

The husky `pre-commit` hook runs `npm run lint`. `npm install` triggers `electron-builder install-app-deps` via `postinstall`; on Python ≥3.12 systems you may need `pip install setuptools` because `distutils` was removed.

## Code style

- StandardJS — no semicolons, 2-space indent; `standard` globals are declared in `package.json` (`it`, `describe`, `before`, etc., plus Electron/renderer-side globals like `Audio`, `Notification`, `__electronLog`).
- Prefer self-explanatory code over comments (see `.github/copilot-instructions.md`).
- Cross-platform: code must work on Windows, macOS, and Linux; platform detection lives in `app/platform.js` and `app/utils/utils.js` (`insideFlatpak`, `insideSnap`, `insideWindowsStore`, `insideWindowsPortable`).

## Architecture

Electron app with a single main process and multiple renderer windows. Entry point: `app/main.js` (see `"main"` in `package.json`).

### Main process (`app/main.js`)

Owns all native state: tray icon, global shortcuts, window lifecycle, persistent settings (`electron-store`), i18n (`i18next` + `i18next-fs-backend` from `app/locales/*.json`), power events, idle detection, and the break schedule. It instantiates a single `BreaksPlanner` and translates its events into window show/hide and tray updates.

### Scheduling core (`app/breaksPlanner.js` + `app/utils/scheduler.js`)

`BreaksPlanner` is an `EventEmitter` that drives the entire break state machine. `Scheduler` is a thin `setTimeout` wrapper whose `reference` field identifies *which* stage is pending (`startMicrobreak`, `startMicrobreakNotification`, `finishMicrobreak`, `startBreak`, …). The planner emits semantic events (`startMicrobreak`, `finishBreak`, `updateToolTip`, etc.); `main.js` listens and opens/closes the appropriate BrowserWindow.

Three side managers feed into the planner and can pause/resume it:

- `NaturalBreaksManager` (`app/utils/naturalBreaksManager.js`) — watches `node-desktop-idle-v2` to suppress breaks while the user is already idle.
- `DndManager` (`app/utils/dndManager.js`) — reads OS "Do Not Disturb" state (`windows-focus-assist`, `macos-notification-state`, D-Bus on Linux via `@particle/dbus-next`).
- `AppExclusionsManager` (`app/utils/appExclusionsManager.js`) — uses `ps-list` to pause or force-resume breaks when user-configured apps are running.

When modifying break timing or pause/resume logic, changes almost always belong here, not in `main.js`. Guard conditions in this file frequently check `this.scheduler.reference` to avoid interrupting an active break window.

### Renderer windows

Each window is a separate HTML entry under `app/` with a matching `*-renderer.js` and `*-preload.mjs`. Preload scripts expose a minimal API via `contextBridge` (`app/electron-bridge.mjs`, `app/utils/context-bridge-exposers.js`) — renderers never use `nodeIntegration` and must reach the main process through `ipcRenderer.invoke`/`send`.

Windows: `break` (long break), `microbreak`, `preferences`, `welcome`, `contributor-preferences`, `process`.

### Other notable modules

- `app/utils/defaultSettings.js` — single source of truth for every user-configurable setting and its default. Adding a new setting means extending this file *and* updating the preferences window + `electron-store` schema usage.
- `app/utils/appIcon.js` — tray icon and menu, including monochrome/inverted variants and per-OS template icon handling.
- `app/utils/commands.js` — CLI-style commands triggered by global shortcuts or tray menu.
- `app/utils/ideasLoader.js`, `defaultBreakIdeas.js`, `defaultMicrobreakIdeas.js`, `sanitizeIdea.js` — stretch/idea text shown during breaks; user ideas are sanitised with `dompurify`.
- `app/utils/versionChecker.js` — "new version available" notifications.
- `app/utils/statusMessages.js`, `htmlTranslate.js` — i18n helpers shared by renderers.

### Logging convention

The app uses `electron-log`. Follow the existing prefix convention in log messages:
- `System: ...` for OS-level events (resume, lock, DnD change).
- `Stretchly: ...` for app-level state changes (pausing, resuming, break started).

### Tests

`vitest` (globals enabled, `forks` pool). Tests live in `test/` and import modules directly from `app/` — they are unit tests for utilities and managers, not Electron integration tests. CI runs on Ubuntu/macOS/Windows and expects a D-Bus session on Linux (see `.github/workflows/tests.yml`); tests that hit `DndManager` on Linux require `DBUS_SESSION_BUS_ADDRESS` to be set.

## Workflow expectations (from CONTRIBUTING.md)

- Open a GitHub issue and get agreement before implementing a feature — PRs without a prior accepted issue may be closed.
- Add new contributors to `README.md` and user-visible changes to `CHANGELOG.md`.
- Do not bump the version in `package.json`; the maintainer owns releases.
