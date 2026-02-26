# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Chrome extension (Manifest V3) for managing and inserting AI prompt templates. Pure vanilla JavaScript — no build tools, no bundlers, no TypeScript. Files are loaded directly by Chrome.

## Loading the Extension for Testing

There is no build step. To test changes:

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this directory
4. After code changes, click the reload button on the extension card

Reload is required after every change to `background.js`, `db.js`, `manifest.json`, or `options.js`/`options.html`. Changes to `content.js` and `panel.css` require reloading the target page.

## Commit Style

One-line commit messages using the conventional commits format: `type: short description`. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`.

## Releasing

Releases are triggered by pushing a git tag matching `v*`. The CI workflow (`.github/workflows/cd.yml`) zips the extension files and creates a GitHub Release. To release:

```bash
git tag v1.x.x
git push origin v1.x.x
```

## Architecture

The extension has three execution contexts that cannot share memory directly:

| Context | Files | Runs in |
|---|---|---|
| Service Worker | `background.js`, `db.js` | Extension background |
| Content Script | `content.js`, `panel.css` | Every web page |
| Options Page | `options.js`, `options.html`, `options.css`, `db.js` | Extension tab |

**Critical constraint:** Content scripts cannot access the extension's IndexedDB directly due to origin isolation. They must request data via `chrome.runtime.sendMessage({ action: 'getPrompts' })` which the background service worker handles. `content.js` caches the response for 5 seconds to avoid latency on hotkey press.

**Data storage split:**
- Prompts → IndexedDB (`PromptManagerDB`, `prompts` store) — bypasses the 5MB `chrome.storage.local` limit
- Hotkey config (`triggerConfig`) → `chrome.storage.local` — small, needs synchronous-style access

**Prompt schema:**
```json
{ "id": "uuid-v4-string", "title": "...", "content": "... {{variable}} ..." }
```

## Key Implementation Details

**Text injection** (`content.js:injectIntoActiveElement`): Resolves the target element via `resolveTarget()`, then dispatches to one of two insertion functions:
- `insertIntoInputField()` for `textarea`/`input`: direct `.value` manipulation with `selectionStart`/`selectionEnd`
- `insertIntoContentEditable()` for `contenteditable`: Selection API + `insertNode()`, then fires `InputEvent` for React/Vue compatibility

**Variable auto-selection** (`content.js:focusVariable`): After injection, searches backwards through the DOM text nodes for the first `{{...}}` match using a reversed-string scan (`findTextBackwards`), then walks forward (`walkForward`) to calculate the end position for selection range.

**Context menu**: Built dynamically by `background.js:createMenus()`. Must be rebuilt whenever prompts change — options page sends `{ action: 'updateMenus' }` after any CRUD operation.

**Migration**: On `onInstalled`, `background.js` checks `chrome.storage.local` for a legacy `prompts` key and migrates it to IndexedDB, then removes it.

## Testing

Playwright E2E tests in `tests/`. Run with:

```bash
npm test                    # run all tests
npx playwright show-report  # view HTML report after a run
```

**Setup (first time):** `npm install && npx playwright install chromium`

### Playwright extension testing gotchas
- `context` is a reserved built-in fixture (test-scoped) — use `browserContext` for the worker-scoped persistent context
- `chrome.tabs.query({})` returns tabs without `url` (needs `tabs` permission not in manifest) — use `{ active: true, lastFocusedWindow: true }` + `page.bringToFront()` instead
- Content scripts in `file://` pages don't have `chrome.tabs` — get tab IDs from the service worker only

## Constraints

- No frameworks, no TypeScript — plain ES2020+ JavaScript. `package.json` exists for devDependencies (Playwright) only; no runtime dependencies.
- Manifest V3: no `document.execCommand`, service worker instead of background page
- `db.js` uses a CommonJS-style export guard (`if (typeof module !== 'undefined')`) so it works both as an `importScripts()` target in the service worker and as a `<script>` tag in the options page
