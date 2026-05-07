---
name: playwright-cli
description: Web browser automation via playwright-cli bash tool. Token-efficient alternative to Playwright MCP — CLI outputs land on disk (file paths returned), not injected into context. Use for product QA web testing.
---

# /playwright-cli

Browser automation skill using `playwright-cli` (Microsoft official CLI, `@playwright/cli`).

**Why CLI over MCP**: Official benchmark shows MCP uses ~114K tokens vs CLI ~27K for the same flow (4x difference). Long sessions (30+ steps) see 4-10x gap. CLI outputs land on disk; only file paths enter context. See `docs/notes/2026-04-13-playwright-mcp-vs-cli.md`.

---

## Prerequisites

```bash
# Verify playwright-cli is available
playwright-cli --version
```

---

## Session Management (Profile Persistence)

**Always use `--profile`** to reuse browser session and cookies across calls.

```bash
# Open browser once per QA session (headed for first login)
playwright-cli open --profile=$HOME/.playwright-profiles/<project-name> <start-URL>

# Navigate without re-opening (use goto, not open)
playwright-cli goto <another-URL>

# Close at end of QA session
playwright-cli close
```

For **first-time login** to authenticated sites, use headed mode:
```bash
playwright-cli open --config=/tmp/playwright-headed.json \
  --profile=$HOME/.playwright-profiles/<site-name> \
  <URL>
# User logs in manually in the browser window, then close
```

Where `/tmp/playwright-headed.json`:
```json
{ "browser": { "browserName": "chromium", "launchOptions": { "headless": false } } }
```

Subsequent sessions reuse cookie — no re-login needed.

---

## Core Commands

```bash
# Navigation
playwright-cli goto <URL>

# Interaction
playwright-cli click <css-selector>
playwright-cli fill <css-selector> "<value>"
playwright-cli press <css-selector> <key>            # e.g., Enter, Tab
playwright-cli select <css-selector> "<option>"

# Evidence capture (outputs to disk, returns path)
playwright-cli screenshot <output-path.png>
playwright-cli snapshot                               # accessibility tree → disk YAML

# State management
playwright-cli state-save <path.json>
playwright-cli state-load <path.json>
```

---

## Token-Efficient Patterns

### Snapshot economy (prefer over screenshot)
- Use `snapshot` for functional verification (reads accessibility tree)
- Use `screenshot` only for visual judgment
- Only capture at decision points, not after every step

### Profile persistence
- One `open` per QA session; use `goto` for page changes
- Never `open` / `close` in a loop

### Parallel concurrency limit
- **Maximum 2 playwright-cli instances running simultaneously**
- Concurrent sessions on the same profile directory will conflict — copy profile dir for second session

---

## Skill Boundaries

- ✅ Web project product QA (navigation, click, form, screenshot, snapshot)
- ✅ Authenticated sites (via persistent profile + headed first login)
- ❌ Mobile testing — use Maestro MCP or Appium MCP instead
- ❌ Sandboxed environments without filesystem access — use Playwright MCP as fallback
- ❌ CAPTCHA / WAF bypass — not possible; note in QA report
