# Elfhaus layout architecture

## Current contract (Stake 3-kind + EXPAND)

Kind selection matches Stake's web-sdk (`createLayout.svelte.ts`). `ratio = innerWidth / innerHeight`:

| ratio | kind | design | chrome |
|---|---|---|---|
| `<= 0.8` | `portrait` | 1080×1920 | stacked: reels use the width, controls under the board |
| `0.8 < r < 1.3` | `tablet` | 1920×1920 | stacked |
| `>= 1.3` | `landscape` | 1920×1080 | controls beside the reels; short-landscape / mobile when `min(w,h) <= 480` |

Within a kind, scale is uniform: `scale = min(vw/designW, vh/designH)`, then Phaser EXPAND (`W = vw/scale`, `H = vh/scale`, `ox = oy = 0`) so there is no letterbox. The board stays a fixed design size, centred. HUD, menu, Buy Bonus and Roxy anchor to the expanded edges and `env(safe-area-inset-*)`. Roxy is placed in spare space or hidden when there is no room (never over the board). The cover background is the only non-uniform element.

The previous five kinds (`phonePort` / `tabletPort` / `square` / `land` / `wide`) are archived at `archive/pre-stake-layout/`. Resize recomputes from `innerWidth` / `innerHeight` on resize events only (no permanent ticker). Intro, buy menu and confirm each have a portrait, tablet and landscape panel; all text stays inside its panel.

---

This document originally described the pre-EXPAND five-kind system (historical audit below). This document is the contract for a single layout system. It records every scale and layout path that exists on `311ef87`, why they compete (and why the game looks “slightly skewed”), and the target: one Pixi app, one root container, one layout pass, one uniform transform.

Approved looks stay: the bet bar style and relative positions, tablet-portrait Buy under the board next to autoplay, Roxy peeking over the logo on portrait, square/landscape Roxy larger with the board shifted left, Buy above spin. Win and balance formatting are not part of this work.

---

## 1. What exists today (audit)

Coordinate spaces currently in play at the same time:

| Space | Origin | Units | Used by |
|---|---|---|---|
| Viewport / screen | window top-left | CSS pixels | `viewSize()`, `#bg` / `#scene` cover, `uiStage` canvas, `snapGeo` safe edges, shadows, some Roxy placement |
| Stage | `#root` top-left | design px (`ST.w` × `ST.h`) | `#root` children, `introCv`, board host, most `mkPlace` CSS |
| Mockup | `mkGeo` `D` | 1080-tall portrait or 1920-wide landscape | board / HUD / spin / buy / logo in `mkGeo()` |
| Intro “1920×1080” | mixed | screen px then ÷ `ST.s` | `introPixi.geo()`, cards, doors, TAP TO START |
| Board canvas | `#stage` | offsetWidth / clientWidth, sometimes a second CSS scale | `board/stage.ts`, banners, wintrail |

`ST` (`stage.ts`) is the published stage: `{ w, h, s, ox, oy, vw, vh, kind }`.  
`s = min(vw/w, vh/h)`, `ox/oy` centre the letterbox. That *is* a uniform contain scale — but it is not the only one.

### 1.1 `stage.ts` — aspect bucket + CSS contain

- Kinds: `phonePort` (390×844), `tabletPort` (768×1024), `square` (1024×768), `land` (1280×800).
- Bucket: `r = vw/vh`; `<0.72` phone, `<0.95` tablet portrait, `<1.45` square, else land.
- **16:9 (1.78) and 16:10 (1.6) both become `land`.** A 1200×675 (16:9) window letterboxes a 16:10 design: `s = 675/800 = 0.84375`, 60 px of side slack. The board cannot grow into that slack because the design itself is 16:10.
- Writes `--dw/--dh/--s/--ox/--oy` plus text-boost `--tb`, panel zoom `--mz`, and `--t48` (48 screen px expressed in design px).
- `#root` is `width: var(--dw); height: var(--dh); transform: translate(ox,oy) scale(s)`.
- `#bg` and `#scene` live *outside* `#root` and cover the window (the one intended exception: a cover background).
- `capResolution()` is `min(2, dpr)`.
- `onStageChange` hooks resize, orientation, `visualViewport`, `visibilitychange`, `pageshow`, `ResizeObserver`, and a DPR media-query.
- `toStage()` converts a screen `DOMRect` back into stage px by dividing by `ST.s`. This exists because other systems still read DOM rects.

**Why it competes:** the contain scale is correct in isolation, but every other system below either repeats it, mixes it with a second fit, or sizes some chrome in *screen* pixels (`ST.tap / ST.s`). `--tb` and `--mz` are extra scale fudges on type and panels.

### 1.2 `mkGeo()` / `snapGeo()` (`mkboard.ts`) — a second design and a second fit

`mkGeo()` does not lay out in `ST.w` × `ST.h`. It authors a *mockup* (`D = 1080 × …` in portrait, `D = 1920 × …` in landscape), places the board and HUD in that space, then `fit(D)` contain-scales it into the stage: a **second** letterbox (`k`, `ox`, `oy`) inside the first.

`t48(k) = (ceil(ST.tap / ST.s) + 2) / k` sizes spin / plus / minus / auto / turbo with a *screen-pixel* floor (48 px, or 28 in compact). As the uniform scale shrinks, those controls grow in design units so they stay 48 screen px. The board has no such floor, so it shrinks while the HUD, spin, buy and logo stay large. This is the main “board too small, UI too big” mechanism, and it hits **every** kind, not only 16:9.

`snapGeo()` then translates bottom chrome into the *window* letterbox and can stretch a nearly full-width HUD to the screen’s side safe edges. It converts through `g.k`, `ST.s`, `ST.ox`, `ST.oy`, and `ST.vw/vh` in one function — three spaces at once. That shift is a second, after-the-fact layout pass, and it can change relative positions the mockup just authored.

Per-view notes already encoded here (keep):

- Phone portrait: 2-row bet bar, spin in the bar, turbo / auto / buy in the gap, Roxy peeks over the logo.
- Tablet portrait: buy, turbo, auto | spin in a row under the board; board fills width; Roxy peek above the logo.
- Square / land: board shifted left, right-stack buy above spin above auto / turbo, Roxy on the right, HUD under the board.

`phl` (phone-landscape rails) is compiled but `PHL_MAX_H = 0`, so it never runs.

### 1.3 `#root` CSS transform vs `uiStage` (a second Pixi contain)

`pixiui/stage.ts` is a **separate** `Application`. Its canvas is `position:fixed` on `document.body`, sized to the *viewport* (`st.vw` × `st.vh`), then `uiRoot.scale.set(st.s)` and `uiRoot.position.set(st.ox, st.oy)`. The comment is explicit: it cannot live inside `#root` or it would be scaled twice.

So the game has two independent implementations of the same contain scale, on two canvases, parented in two different trees, resized by two different listener sets. If either pass is late, skipped, or uses a different `w/h/s`, HUD and board disagree — the “skewed” look.

`uiStage` resolution uses `capResolution()` (`min(2, dpr)`). Intro and some other canvases do not (see 1.6).

### 1.4 Board Pixi app (`board/stage.ts`)

A third `Application`, parented under `#stage` inside `#root` (so it *does* inherit the CSS contain scale). Size comes from `offsetWidth` / `offsetHeight`, and a CSS-to-layout factor `sc = getBoundingClientRect().width / offsetWidth`. Resolution is `min(3, cssScale * dpr)` — a **third** cap, not `min(2, dpr)`.

`wintrail.ts` computes `sx` and `sy` separately from `offsetWidth / clientWidth` and `offsetHeight / clientHeight`. If those ratios ever differ, the trail is **non-uniform** (`scale.x !== scale.y`). `banners.ts` also reads `clientWidth` / `getBoundingClientRect`.

### 1.5 Room / Roxy (`scene/scene.ts`)

A fourth `Application` on `#scene`, outside `#root`, cover-fitted to the viewport (correct for the room). Roxy and shadows are then placed from a mix of:

- `mkGeo` design units × `k` (portrait / tablet), and
- `getBoundingClientRect()` of `#frame`, `#hud`, `#buyBtn` in *screen* space (landscape).

Comments in the file say “Shadows live on the room (screen space). Use viewport rects, not stage design px.” That is a second camera: the room is in screen space, the board is in stage space, Roxy is stitched together from both.

### 1.6 Intro vestibule (`introPixi.ts`) + leftover DOM splash (`intro.ts`)

A fifth `Application` (`#introCv`), parented *inside* `#root` (design px + CSS scale).

`geo(ST.w, ST.h)` immediately multiplies by `ST.s` and works in screen pixels, then `ks = min(W/1920, H/1080)`, `k = ks/ST.s`. Cards, doors and TAP are authored in that mixed space. This is a **fourth** contain fit (against 1920×1080), and it does not share `mkGeo` or the stage design tables.

The intro camera CSS-scales `#bg`, `#scene`, and `#app` to `0.72` around the doorway. `#introCv` is inside `#root`; `#uiStage` is not. Anything forgotten by `applyCam` (HUD canvas, skip row, letterbox) floats at full size over a shrunken world. That is a second camera, and it is why Stake-iframe boots looked “broken” until the 2d7c7f8 / 311ef87 patches.

Renderer resolution here is `min(2, max(0.5, ST.s * dpr))` — not `capResolution()`.

**Legacy DOM splash still exists.** `intro.ts` still builds `.spStage` / `.spBg` / `#lGo` / `#lBar` and the “Don't show this again” `<label class="spSkip">`. The Pixi intro is supposed to replace that art; CSS (`#loader.px .spStage { display:none }`, plus 311ef87’s hardened `body.introOn` rules) hides it. On 311ef87 those rules work again only because leftover comment debris (`room (` and friends) was repaired. The rebuild must **delete the DOM splash entirely** and draw the skip checkbox in Pixi, so nothing depends on CSS to hide legacy DOM.

### 1.7 Studio sting (`intro.ts` `runSting`)

A sixth, short-lived `Application` inside `#sting`. Sized from `clientWidth` / `innerWidth`, not the layout object.

### 1.8 `uihosts.ts` / `uilayout.ts` / `hostlayout.ts` / `mirror.ts`

HUD and board chrome are still “laid out” as DOM (or off-document hosts). `uilayout` approximates CSS box math; `hostlayout` walks computed styles; `uihosts` patches `getBoundingClientRect`, `offsetWidth`, `clientWidth`. `mirror.ts` reads those hosts and draws Pixi sprites.

`mirror` applies CSS `scale(sx, sy)` into a 2D matrix (`m.scale(p[0], p[1] ?? p[0])`). Land-squash and merge motion are authored as non-uniform CSS scales, so the Pixi mirror can have `scale.x !== scale.y` by design for a squash — but a stale scale, or a `brightness()` of 0, is not a squash:

```ts
const tint = (br: number) => { const v = Math.round(clamp01(br) * 255); return (v<<16)|(v<<8)|v; };
sp.tint = c.glow ? 0xffffff : tint(c.br);
```

A leftover `filter: brightness(0)` (or a parsed 0) tints the **colour** sprite black while the `.symGlow` / `stk_glow` copy stays white and is recoloured teal. That is the Stake-dev screenshot: non-wilds as black silhouettes with a cyan outline; elf and wild rigs (more layers, different host filters) can still show colour. The same tint on a wild `fig` would hide baked eye whites. Compare with main `4d02bfd` when fixing; do not add a new shader if a reset of `br` / tint / glow flags is enough.

### 1.9 Leftover host CSS (`elfhaus.css`, `resub-fix.css`, `chalet.css`, …)

Thousands of lines still size `#hud`, `#loader`, `.spEl`, panels, typography floors, `--tb/--mz`, and splash cards. 311ef87 showed that **broken comment debris** (`room (`, an unclosed v3.9 comment, leftover `rest (` in `resub-fix.css`) can swallow later rules and re-show hidden DOM. Game-visual CSS must be stripped down to the canvas host (and a page background). Layout and chrome live in the layout table + Pixi.

### 1.10 Per-element scale fudges

- `--tb` / `body.tb`: text boost `clamp(1, 0.66/s, 2.2)` on short landscape stages.
- `--mz`: panel zoom `0.95/s`.
- `t48` / `sb()` in `mkGeo`: 48 (or 28) screen-px control floor.
- `logo.s`, `bonus.s`, `ic` icon scales: authored per mockup, then passed through `k` and sometimes `ST.s`.
- Intro `root.scale.set(G.k)` and card `scale / ks`.
- Board filter resolution vs UI resolution vs intro resolution.

Each is a local attempt to “keep this bit readable,” and each fights the uniform contain.

### 1.11 DPR and resize

| Path | Resolution | Resize hooks |
|---|---|---|
| `stage.capResolution` | `min(2, dpr)` | `onStageChange` (resize, vv, orientation, RO, DPR, visibility, pageshow) |
| `pixiui/stage` | `capResolution()` | its own resize / vv / orientation / DPR |
| `game.ts` `layout()` | via `fitStage` | its own `ResizeObserver` + intro unwrap |
| `introPixi.size` | `min(2, max(0.5, ST.s * dpr))` | resize / vv + `build()` |
| `board/stage` | `min(3, cssScale * dpr)` | board relayout |
| `scene` | its own cap / cover | `placeScene` on layout |

Several passes can run in different orders on a Stake iframe that boots `0×0` or `visibility:hidden` (the 311ef87 path). The target is **one** function, resolution **`min(dpr, 2)`**.

### 1.12 DOM rects feeding Pixi (non-exhaustive)

`getBoundingClientRect` / `offsetWidth` / `clientWidth` are read in `scene/scene.ts` (Roxy, shadows), `board/stage.ts`, `board/banners.ts`, `wintrail.ts` (`sx`/`sy`), `pixiui/menu.ts`, `pixiui/wins.ts`, `settings.ts` (`toStage`), `skin.ts`, `introPixi.toScreen`, and through the `uihosts` patches. Any of these can see a mid-camera or mid-resize tree and disagree with the layout table.

---

## 2. Why it looks “skewed”

“Skewed” here is almost never a single typo in `scale.x` vs `scale.y`. It is **two (or five) systems disagreeing**, plus a few actually non-uniform scales:

1. Stage contain (`#root` CSS) vs UI contain (`uiRoot` in a viewport-sized canvas).
2. `mkGeo`’s inner 1920/1080 fit + `snapGeo` screen-edge translation vs the stage contain — chrome moves in a different space from the board.
3. Screen-pixel UI floors (`t48`) vs a uniformly shrinking board — UI wins, board loses, on **every** design, worse when `land` is letterboxed inside 16:9.
4. Intro’s 1920×1080 screen-space geo + CSS camera `scale(0.72)` on only some layers.
5. Room in screen space, board in stage space, Roxy and shadows from DOM rects.
6. Real non-uniform scales: `wintrail` `sx`/`sy`, CSS squash copied by `mirror`, sprite `kx/ky` from frame vs box.
7. Brightness/tint in `mirror` (black silhouettes + teal glow; missing wild eye whites) looking like a “broken” board.

Patches (hide this canvas, snap that HUD, harden that CSS rule) fix one disagreement and leave the others. The rebuild deletes the extras.

---

## 3. Target architecture

### 3.1 One pass, one transform

```
layoutPass(vw, vh, dpr, safe) → Layout
```

- Pick a design kind from aspect ratio (see 3.3).
- Design size is `W` × `H` in **design units** (the table’s native size).
- **One uniform transform:** `scale = min(vw/W, vh/H)`, `ox = (vw - W*scale)/2`, `oy = (vh - H*scale)/2`.
- `resolution = min(dpr, 2)`.
- The cover background (room) is the only element that uses a different scale (cover: `max(vw/roomW, vh/roomH)`), and it is a sibling of the design root, not a second camera for gameplay chrome.
- Every scene (intro, base, free spins, overlays) **reads this same `Layout` object**. No scene has its own camera scale. Intro doors, cards and TAP TO START are rows in the table, not a 0.72 CSS zoom.

### 3.2 One Pixi app, one root

One `Application`. Stage graph:

- `cover` — room / snow / bonus grade; cover-scaled; does not move gameplay.
- `root` — design space. `root.position = (ox, oy)`, `root.scale.set(scale)` (uniform). Children:
  - `board` (frame, cells, symbols, win glow, merge, trails)
  - `hud` (bar, meters, plus/minus)
  - `chrome` (logo, spin, buy, auto, turbo, menu)
  - `roxy` (same design space, not a screen-space stitch)
  - `intro` (wall, doors, cards, TAP, skip checkbox)
  - `overlays` (menus, rules, banners, toasts, max win)

No `#root` CSS `transform`. No second contain on `uiStage`. No intro CSS `scale` on `#app`. Canvases that cannot be merged on day one must still be sized and transformed from **this same `Layout`** (same `W,H,scale,ox,oy,resolution`) and must not introduce a second fit. The end state is one canvas.

### 3.3 Design kinds and tables

Each kind is a **pure data table** in design units: board rect, logo, Roxy, HUD bar (and the three meter fields), spin, buy, autoplay, turbo, menu, intro cards, intro doors, TAP, skip, win-banner slot, popup slot, safe insets.

| Kind | Design | Aspect rule (vw/vh) |
|---|---|---|
| `phonePort` | 390 × 844 | `r < 0.72` |
| `tabletPort` | 768 × 1024 | `r < 0.95` |
| `square` | 1024 × 768 | `r < 1.45` |
| `land` (16:10) | 1280 × 800 | `r < 1.70` |
| `wide` (16:9) | 1920 × 1080 | `r ≥ 1.70` |

`wide` is required so 1200×675, 1280×720, 1920×1080, 2560×1440 fill the viewport instead of letterboxing the 16:10 table. 2560×1600 stays `land` (1.6) and fills with no letterbox.

The **board gets the largest axis-aligned rect the design allows** (square cells, frame insets, reserved columns/rows for chrome and Roxy). HUD, spin, buy, auto, turbo and logo are sized **around** that rect, in the same units, with the approved relative positions. They are not given a screen-pixel size floor that fights the uniform scale. Touch targets are authored in design units so that at the design’s native size they meet 48 px (or the compact 28 px policy); they then scale with everything else.

Edge-anchored chrome (HUD to the bottom safe edge, menu to the top-left inset) is positioned in **design space** from `safe` insets converted once: `insetDesign = screenInset / scale`. Never a second scale, never `snapGeo` after the fact.

### 3.4 No DOM / CSS layout, no DOM rect reads

- Delete `.spStage`, `.spBg`, `#lGo`, `#lBar`, and the DOM `label.spSkip`. The skip checkbox is a Pixi control on the intro layer, wired to the same `elfhaus.skipSplash` key.
- Pixi placement comes from `Layout`, not `getBoundingClientRect` / `offsetWidth`.
- Host DOM, if any remains for accessibility, is a mirror *of* the layout table, never the source of it. `uihosts` patches and `toStage()` go away once nothing reads them.
- Game-visual CSS is reduced to the canvas host: the fullscreen canvas, a page background colour, and `html,body { margin:0; overflow:hidden }`. No `#root { transform }`, no splash, no HUD grid, no `--tb/--mz` typography layout.

### 3.5 Re-layout

One function, called on resize, orientation, and DPR change (including Stake iframe boot from 0×0 or `visibility:hidden` — ignore viewports under 32 px and apply the last good layout until a real size arrives):

```
onViewportChange → measure (vw, vh, dpr, safe) → layoutPass() → apply(Layout)
```

`apply` sets `root.scale` / `root.position`, renderer size and resolution, and the positions of board, HUD, chrome, Roxy, and intro from the table. Every consumer reads the new object; none keeps a private camera.

### 3.6 Motion

Idle breathe, land squash, merge, and intro card motion may still use non-uniform *animation* scales on a sprite, starting and ending at `scale.x === scale.y`. At rest, and on every container that is a layout ancestor, `scale.x === scale.y`. Win trails use a single uniform factor.

### 3.7 Colour / glow / eyes

Symbol colour is not a layout problem, but it is a leftover *state* problem in the same mirror path. The layout rebuild resets sprite `tint` to `0xffffff` and brightness to 1 after each spin / tumble / dim / win, turns glow layers off when the cell is not winning, and does not leave `brightness(0)` on a host. Eye whites on elf wilds are existing sheet frames (or the whites baked into `fig`); they must stay visible in idle, land, and merge. No new assets. No win-format changes.

---

## 4. What gets deleted (not wrapped)

- `mkGeo` inner `fit(D)` + `snapGeo` screen-space translation (replaced by the table).
- Intro `geo()` screen-px path and `applyCam` CSS scale on `#bg` / `#scene` / `#app`.
- DOM splash: `intro.ts` panel/card builder, `.spStage` / `.spBg` / `#lGo` / `#lBar` / DOM `.spSkip`.
- `#root` CSS contain transform; `--tb`, `--mz`, `--t48` as layout drivers.
- `toStage()`, `uihosts` geometry patches, and Pixi code that places from DOM rects.
- Duplicate resize/DPR listener farms (one hook remains).
- Disagreeing resolution caps (`min(3, cssScale*dpr)`, `ST.s * dpr`).

`fitStage` / `ST` may remain as a thin façade over `layoutPass` during the swap, then go.

---

## 5. Verification (Stake-style iframe, unzipped zip)

Viewports, all at DPR 1 unless noted: 360×640, 390×844, 768×1024, 1024×768, 1024×680, 1200×675, 1280×720, 1280×800, 1366×768, 1920×1080, 2560×1440, 2560×1600, and 1280×800 at DPR 2. Plus a live resize sweep.

Programmatic: `scale.x === scale.y` on every layout container; board fully in view; no chrome out of bounds. Stills after real spins (loss, win, tumble, merge, buy, intro, free spins, menus): symbols full colour, wild eye whites present, intro cards inside the frame, doors and TAP TO START visible. Official tests: known failures only (books social 3, banner 3, balance 1).

Report **board size as a percentage of the viewport, before and after, per view.** “Before” is `311ef87` as measured on the unzipped zip in the same harness.

Never touch the Stake dev instance, audio, math, or books. Pixi only, existing assets only, no new packages.

## 6. Archive of hidden / replaced systems

The rebuild does not just delete retired DOM, CSS, and camera code. Snapshots and the full hidden-UI audit live in `archive/legacy-dom-ui/` (README is the audit list). That folder is excluded from the Svelte build and from the release zip, and nothing in it may be imported by the game. The pre-rebuild baseline is git tag `pre-layout-rebuild` (`311ef87`). Hidden hosts that still carry live state (`#uiHostTree`, board/HUD mirrors, overlays) are replaced with plain TypeScript state objects before their DOM copies leave the game. `#srHud` stays as the intentional screen-reader live region.
