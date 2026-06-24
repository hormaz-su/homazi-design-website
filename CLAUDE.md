# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Static website hosted on GitHub Pages (repo `hormaz-su/homazi-design-website`). Two parts:

- **`index.html` + `assets/`** — the marketing/landing site (root).
- **`editor/`** — "Homazi Floor Editor", a client-side, no-build floor-plan design app (the bulk of the code). This is where almost all work happens.

There is no build step, no package manager, no test suite. Everything is hand-written ES modules loaded directly by the browser. Konva 9.3.16 is loaded from a CDN `<script>` tag in `editor/index.html` (global `Konva`), not bundled.

## Develop / run

```bash
cd website
python3 -m http.server 8000
# Editor: http://localhost:8000/editor/
# Landing: http://localhost:8000/
```

Deploy = push to `main`; GitHub Pages serves from the repo root. No CI, lint, or tests — verify changes by loading the editor in a browser. `window.__editor` (set in `main.js`) exposes `{ state, stage, layers, renderAll, renderObject, genId, pushHistory }` in the console for debugging.

All UI strings, comments, and commit messages are in Chinese — match that.

## Editor architecture

The editor is a **single shared mutable `state` object + render-from-state** design. There is no framework and no reactive binding; modules import the `state` singleton, mutate `state.objects`, then call a render function.

### Core data flow

1. **`scripts/state.js`** — the single source of truth. `state.objects` is a flat array of plain objects, each `{ id, type, ...props }`. Also holds `tool`, `theme`, `zoom`, `selectedId`/`multiSelectIds`, and the `history`/`historyIndex` undo stack. Exports a tiny pub/sub (`subscribe`/`emit`) used for cross-module events (`'theme:change'`, `'canvas:rerender'`, `'selection:change'`) and `genId(prefix)`.

2. **`scripts/renderer.js`** — translates `state.objects` → Konva nodes. `renderObject(obj)` switches on `obj.type` and builds the shape into the correct layer; `renderAll()` clears the content layers and rebuilds everything. **Every Konva node's `id()` equals its `obj.id`** — this is the link between state and canvas (`findNodeById`). Shape geometry (walls, doors with swing arcs, windows, compass, scale bar, dimensions) is defined here.

3. **`scripts/stage.js`** — owns the Konva `Stage` and the named `layers` object (z-ordered: `grid, walls, openings, furniture, lights, annotations, ui`). Handles the grid, zoom/pan, resize, and the **cm↔screen coordinate system**.

### Coordinate system (important)

The world unit is **centimeters**. Origin `(0,0)` is canvas center, +X right, +Y down. `state.scale` (default 5) means 1cm = 5px at 100% zoom; the Konva stage transform handles all scaling, so shapes are authored directly in cm. Convert screen→world with `screenToWorld()` / `getPointerWorld()` from `stage.js`. Object `x,y` is the **center point**; `w,h` are size in cm; walls use `points:[x1,y1,x2,y2]` instead.

### Object types

`wall` (points + thickness), `door`/`window` (openings), `furniture` (has `subtype`), `light` (has `subtype`), `text`, `dimension`, `scale`, `compass`. Furniture/light subtypes and their default sizes live in **`scripts/furniture.js`** (`FURNITURE_META`, `LIGHT_META`, `buildFurniture`, `buildLight`). This is the **single source of truth** for subtypes: `FURNITURE_SUBTYPES`/`LIGHT_SUBTYPES` are derived from the META keys there and re-exported through `scripts/ai/prompts.js` for the AI and validator. To add a subtype, edit `FURNITURE_META`/`LIGHT_META` (and add a matching builder in `furniture.js`) — nothing else needs the list updated.

### Tools

**`scripts/tools.js`** implements every tool (select, marquee, wall, door, window, text, dimension, scale, compass, delete). Pattern: `activateTool(name)` tears down the previous tool's listeners via a returned `cleanupFn`, then registers new `stage` event handlers. `placeOnClick()` is a factory for simple click-to-place tools. The select tool distinguishes a click (select) from a drag-on-empty (pan the board) via a pixel threshold.

### Persistence & history

**`scripts/history.js`** — `pushHistory()` serializes `state.objects` to JSON onto the undo stack (cap 50) **and** autosaves to `localStorage` key `homazi-floor-editor:autosave-v1`. Call `pushHistory()` after any committed mutation (place, move via `dragend`/`transformend`, property edit, AI apply). Undo/redo replace `state.objects` from JSON and `renderAll()`. Also handles new/import/export JSON and export PNG.

### Theme

**`scripts/theme.js`** — day/night toggle flips `<html data-theme>`. Canvas colors are **read from CSS variables** (`editor/styles/editor.css`) via `themeColors()`, so renderer code never hardcodes colors. A theme change emits `'theme:change'` → `stage.js` redraws the grid and emits `'canvas:rerender'` → `renderer.js` rebuilds all shapes with new colors.

### AI assistant (`scripts/ai/`)

Sidebar chat that drives the canvas via the **Zhipu GLM-4-Flash** API.

- **`config.js`** — endpoint, model, client throttle/timeout. ⚠ The API key is hardcoded in frontend JS and shipped publicly (intentional, demo-only — the key is rate/quota-limited on Zhipu's side). Do not treat it as a secret to protect, but don't add new secrets here.
- **`prompts.js`** — system prompt defining the cm coordinate system and a strict output contract: the model must return one JSON object `{ reply, actions }` where `actions` is a list of `{op, ...}` (`add`/`update`/`delete`/`clear`). Also builds the live canvas summary (`summarizeCanvas`, `listObjectIds`) sent as context.
- **`client.js`** — `fetch` wrapper with throttle + timeout + `extractJSON()` (strips ``` fences, repairs trailing commas).
- **`applier.js`** — the trust boundary. Validates/normalizes every action (whitelisted types & subtypes, numeric coercion, coordinate bounds, max 200 actions/batch), **dry-runs first and aborts the whole batch if any action is invalid** (no partial apply), **reassigns all ids** (ignores AI-supplied ids), then mutates `state` and calls `pushHistory()` + `renderAll()`.
- **`panel.js`** — chat UI, conversation history, quick-prompt buttons; orchestrates client → applier.

When adding a new object type or field that the AI should produce, update **both** `prompts.js` (schema description) and `applier.js` (validation whitelist) — `applier.js` silently drops fields not on its allow-lists.

## Conventions

- ES modules with relative imports; entry point is `editor/scripts/main.js` (`<script type="module">`). No transpilation — write browser-native JS.
- After mutating `state.objects` outside a tool's own flow, call `renderObject`/`renderAll` to sync the canvas and `pushHistory()` to make it undoable + autosaved.
- `main.js` is the wiring layer: it binds all DOM events (toolbar, topbar, keyboard shortcuts, library drag-and-drop, property panel) to the module functions. New UI hooks go here.
