# Legacy DOM / hidden-UI archive

This folder holds snapshots of Elfhaus front-end systems that were already replaced (or are being replaced) by Pixi / TypeScript state, but were still sitting in the live tree hidden with `display:none`, `visibility:hidden`, `opacity:0`, off-screen positioning, `aria-hidden`, off-document hosts, or JS `.hidden` toggles.

**Nothing in this folder may be imported by the game.** It lives at the repo root, outside `frontend/apps/elfhaus/src`. The SvelteKit build does not include it. `scripts/package-release.mjs` fails the zip if any `archive/` or `legacy-dom-ui/` path appears in the package.

Pre-rebuild tag: **`pre-layout-rebuild`** → commit **`311ef87`** (the shipped intro CSS repair). Snapshots under `snapshots/311ef87/` are taken from that commit, with original paths under `frontend/apps/elfhaus/`. The CSS resolver `hostcss.ts` was already deleted earlier; its snapshot is from **`c581df5`** (the last commit that still had it; removed in `d34b951`).

Replacement for layout and chrome placement is `docs/layout-architecture.md` and `src/game/layout.ts` (one Pixi root, one layout pass). Hidden HUD / board / overlay hosts that still carry live state are replaced with plain TypeScript state objects, then the DOM copy is removed from the game. This README is the audit of record; update a row when a live copy leaves `src/`.

---

## 0. Genuine accessibility (stays in the game)

| What | Why it stays |
|---|---|
| `#srHud.sr-only` in `Game.svelte` / `game.ts` | Visually hidden live region (`aria-live="polite"`) for balance, win and status announcements. Off-screen + clipped on purpose so only assistive tech hears it. |

Not accessibility, even when they use `aria-hidden` or `.sr-only` styles:

- `#uiHostTree` (off-screen, `opacity:0`, `clip-path`, `aria-hidden`) is the hidden visual state model, not a screen-reader tree.
- `#top` / `#hud` in `Game.svelte` are empty visual shells (`opacity:0` / `pointer-events:none`, `aria-hidden`).
- `#stepToast` has `aria-live` but lives inside the off-screen host tree, so it does not reliably reach a screen reader. Announcements belong on `#srHud`.

---

## 1. Audit: hidden or leftover systems

Status key:

- **archived-removed** — snapshot here; live file or link already gone from the game.
- **snapshot, still live** — frozen copy of the pre-rebuild file; a copy in `src/` is still imported and must be replaced, then deleted (not imported from here).
- **keep** — not archived; documented so the audit is complete.

### 1.1 Already replaced, still hidden or empty (remove from the game)

| Item | What it was | Source commit | Replacement | Status |
|---|---|---|---|---|
| DOM splash markup `.spBg`, `.spStage`, `#lGo`, `#lBar`, `label.spSkip` | `Game.svelte` loader HTML; `intro.ts` `layout()` built feature cards into `.spStage` and wired the “Don't show this again” checkbox to `elfhaus.skipSplash`. After the Pixi vestibule shipped, CSS (`#loader.px .spStage { display:none }` and the 311ef87 `body.introOn` rules) hid it. The skip row stayed a DOM control, which is why leftover CSS comment debris could unhide the splash and break the laptop intro. | `311ef87` (`Game.svelte`, `intro.ts`, `src/assets/intro/splash_layout.json`) | Pixi intro (`introPixi.ts`) plus a Pixi skip checkbox on the intro layer, same `elfhaus.skipSplash` key. No CSS hide rule required. | snapshot, still live — delete in this rebuild |
| Splash / skip CSS | Hide + place rules in `elfhaus.css`, `resub-fix.css`; chalet paint for `#lGo` / `.spCard` / `.spSkip`. | `311ef87` (those three stylesheets) | None. Visual CSS shrinks to the canvas host. | snapshot, still live — strip with the splash |
| Empty stylesheets `board.css`, `skin.css`, `notile.css` | Intentionally empty comment-only sheets, still linked from `app.html` after paint moved to Pixi. | `311ef87` | Nothing. Links removed from `app.html`; files removed from `static/`. | **archived-removed** |
| `#sting` DOM images (`.stBox`, `.stGlow`, `.stLogo`, `.stGlint`) | Markup in `Game.svelte`. `intro.ts` `runSting()` already removes `.stBox` and paints the sting on a short-lived Pixi canvas. | `311ef87` (`Game.svelte`, `intro.ts`) | Existing Pixi sting. Drop the unused `<img>` markup. | snapshot, still live — delete markup in this rebuild |
| `applyCam` CSS camera | `introPixi.ts` CSS-scales `#bg`, `#scene`, `#app` to 0.72 during the vestibule (a second camera; `#uiStage` was outside it). | `311ef87` (`introPixi.ts`) | One layout transform. Door-push stays a Pixi animation on the intro layer only. The leftover no-op `applyCam` / `CAM0` / `camEls` / `unCam` were deleted after `da49043`. | **archived-removed** |
| `mkGeo` inner 1080/1920 fit + `snapGeo` + `t48` screen-px floors | Second contain-fit and a after-the-fact snap into the window letterbox; 48 px UI floors that do not shrink with the board. | `311ef87` (`mkboard.ts`, `stage.ts`) | `src/game/layout.ts`: one design table and one uniform scale, including a `wide` (16:9) kind. | snapshot, still live — delete in this rebuild |
| `hostcss.ts` CSS resolver | Selector engine that computed host boxes and styles from page CSS. Dropped in `d34b951`. | last present in **`c581df5`**; deleted in `d34b951` | `uilayout.ts` + `board/hostlayout.ts` tables (themselves a stepping stone; see 1.2). | **archived-removed** (already gone from `src/`; snapshot only) |
| `sprite.ts` `blendPlan()` | Unused export (no importers). Remaining `play()` / `frameCSS()` still feed hidden canvases and a lock-icon CSS path (`fx.ts`). | `311ef87` (`sprite.ts`) | Drop `blendPlan` with the sprite-DOM path once FX is Pixi-native. | snapshot, still live (unused function) |

### 1.2 Hidden but still the live state model (replace with TS state, then remove)

These are imported and required for a working game today. Pixi is already the visible paint; the DOM is a hidden source of truth. That is the wrong split. Each one gets a plain TypeScript state object (or the layout table), then the DOM host leaves the game.

| Item | What it was | Source commit | Replacement | Status |
|---|---|---|---|---|
| `#uiHostTree` / `uihosts.ts` | Off-document tree (`position:fixed; left:-10000px; opacity:0; clip-path:inset(50%); aria-hidden`) holding the full HUD, board (`#frame/#board/#cells/#strips`), fly layer, and every overlay/menu. `installUiHosts()` patches `getBoundingClientRect`, `offsetWidth`, and `getComputedStyle` so the rest of the game can pretend the tree is on-page. | `311ef87` | Plain TS state for HUD, board cells, and overlays. Click targets are Pixi. Geometry comes from `layout.ts`. | snapshot, still live |
| `uilayout.ts` | Length/box stand-in written to replace `hostcss.ts`. Still walks hidden host elements and inline CSS. | `311ef87` | Layout tables + widget state. No host CSS lengths. | snapshot, still live |
| `board/hostlayout.ts` | TypeScript rule table for board/symbol host boxes and filters (including `brightness(0.48)` dim, a source of leftover tints). | `311ef87` | Board state in TS (cell dim, glow, filter, rect) applied directly on Pixi sprites. | snapshot, still live |
| `board/mirror.ts` | Walks the hidden board DOM and draws Pixi sprites (tint from CSS `brightness`, teal win glow, non-uniform CSS scales). | `311ef87` | Pixi board reads TS board state. Reset tint / glow after each spin (silhouette and eye-white fixes live here). | snapshot, still live |
| `pixiui/hud.ts`, `menu.ts`, `wins.ts`, `stage.ts` | Pixi chrome that still samples the hidden tree (`getComputedStyle`, class toggles, `visibility:hidden` for jurisdiction / replay). `uiStage` is a second contain-scale on `document.body`. | `311ef87` | Same Pixi chrome, fed by TS state; one root transform from `layout.ts` (no second scale). | snapshot, still live |
| Overlay / menu / banner / card DOM in the host tree | `#intro`, `#outro`, `#bigwin`, `#cardFlip`, `#maxwin`, `#fsMore`, `#buyMenu`, `#bmConfirm`, `#autoMenu`, `#popMenu`, `#settings`, `#menu`, `#msg`, `#resumeCard`, `#banner`, `#stepToast`, `#fsBar`, `#replayBar`, plus JS `.hidden` / `visibility` toggles in `game.ts`, `ui.ts`, `bookEventHandlerMap.ts`, `settings.ts`, `cardflip.ts`, `maxwin.ts`. | `311ef87` (`uihosts.ts` template and the toggle sites) | TS overlay state already partially mirrored by `pixiui/*`. Drop the DOM copies once every reader uses the object. | snapshot, still live (in `uihosts.ts`) |
| `#top` / `#hud` shells in `Game.svelte` | In-document, `aria-hidden`; `#top` forced `opacity:0`; `#hud` `pointer-events:none`. `game.ts` still reads `offsetHeight`. | `311ef87` | `layout.ts` reserved sizes. | snapshot, still live |
| `symrig.css` / `symdepth.css` | Frame-class CSS for symbol hosts, still linked so `mirror` / `symrig` can place sheet frames. | `311ef87` | `board/symframes.ts` + atlas JSON. The `.webp` sheets stay in the game. Unlinked from `app.html` and removed from `static/` after `da49043`; labeled copies are in `snapshots/311ef87/…/static/`. | **archived-removed** |
| `sprite.ts` `play()` canvases + `fx.ts` `frameCSS()` | Sprite animations are painted onto canvases parented under hidden hosts so `mirror` can sample them; lock icon still uses CSS background frames. | `311ef87` | Play sheets into Pixi textures / the board stage directly. | snapshot, still live |

### 1.3 Audited and kept (not hidden replacements)

| Item | Finding |
|---|---|
| `#preL` first-paint loader in `app.html` | Real boot splash before JS, hidden during the sting / when ready, then removed. Not the feature-card DOM splash. Keep until a Pixi-only first paint exists. |
| `roxy.ts` | Live facade over `roxyrig` + `scene/scene.ts`. Not a hidden DOM Roxy. The old `roxy_full_*` sheets are already omitted from the zip by `package-release.mjs`. |
| `#bg` / `#scene` | Visible room (cover background). The only element that should keep a different scale. |
| Imported game modules under `src/game/` | A full import graph of `src/` (excluding `node_modules` and `src/mock`) found no orphan TS/Svelte module. Hidden systems are still wired, not dead files. |
| Official tests and `scripts/sprites/*` generators | Build/test tools, not runtime UI. Stay. |

---

## 2. Snapshot index

Each snapshot file starts with an archive banner (source commit, original path, and what replaced it). JSON snapshots have a sibling `.note` file instead, so the JSON stays valid.


```
snapshots/311ef87/frontend/apps/elfhaus/
  src/app.html
  src/assets/intro/splash_layout.json
  src/components/Game.svelte
  src/game/intro.ts
  src/game/introPixi.ts
  src/game/uihosts.ts
  src/game/uilayout.ts
  src/game/mkboard.ts
  src/game/stage.ts
  src/game/sprite.ts
  src/game/fx.ts
  src/game/board/hostlayout.ts
  src/game/board/mirror.ts
  src/game/pixiui/{stage,hud,menu,wins}.ts
  static/{elfhaus,resub-fix,chalet,board,notile,skin,symrig,symdepth}.css

snapshots/c581df5/frontend/apps/elfhaus/src/game/hostcss.ts
```

When a live file is removed from the game, leave the snapshot here and mark the row **archived-removed**. Do not add new imports of these paths. Do not copy them back into `src/`.
