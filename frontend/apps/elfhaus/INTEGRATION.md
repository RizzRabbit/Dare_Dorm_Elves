# Elfhaus frontend: art drop-in and integration notes

Art lands by **file copy only**. `scripts/import-art.mjs` does the copying (add `--dry` to see what it would do first).
After any import, run `pnpm test && pnpm build` and commit the copied files. `static/art/` is regenerated on every
dev/build (`scripts/sync-art.mjs`); never edit it by hand.

## Symbols (and wilds, fx sheets, cut masters)
```
node scripts/import-art.mjs symbols /workspace/elfhaus-frameless/final
python3 scripts/sprites/gen_reelblur.py      # reel blur strips from the new symbol art
```
* `<dir>/assets/**` goes to the repo `assets/**` (e.g. `assets/final/webp/symbol_H1.webp`, `assets/final/fx/*`, `assets/final/cut/*`),
  and `<dir>/src/**` goes to the app `src/**` (e.g. `src/game/fx/sym_<K>.atlas.json`).
* `art-manifest.json` maps keys to these paths. If the file names stay the same, there is nothing else to change.
* Per-symbol win sheets: `fx.ts` globs `src/game/fx/*.atlas.json`. Each one's image is the ART key with the same name (`sym_<K>`).
  The atlas schema is the one below.

## Splash / intro panels
```
node scripts/import-art.mjs splash /workspace/elfhaus-polish/out/splash
```
This copies `panel_*`, `splash_*` and `sting_*` (`.webp`/`.json`) into `src/assets/intro/`. They are picked up by `import.meta.glob`
and `splash_layout.json`.
**Copy rule:** never show a full-reel or merged wild below x4 (a full reel is the sum of its 4 wilds, each at least x1).
The live copy (`egw_merge` in `splash_layout.json`, `LOADER_CARDS` in `loader.ts`) uses `x4 × x5 = x20`.

## Stacked / merged wild sheets (stacks_v1, MERGE_ANIM.md)
```
node scripts/import-art.mjs stacks <dir>
```
* Names: `<anim>_<variant>[.atlas].(webp|json)`. `anim` is one of `stack_form`, `merge_join`, `letters_ignite`, `merge_idle` or `merge_win`.
  `variant` is one of `WF` (single full reel), `WM2`, `WM3`, `WM4` or `WM5`.
  The files are copied to `static/assets/stacks/<anim>_<variant>.{webp,json}`, and the ids are merged into `static/assets/stacks/index.json`.
* Atlas schema (same as `sym_<K>`):
  `{"image": "<file>.webp", "anims": {"<anim>": {"fps": 20, "loop": false, "frames": [[x,y,w,h], ...]}}, "size": [W, H]}`.
  The anim with the file's name is played, or the first one if that name is missing.
  Each frame is drawn over the whole overlay, so make frames at the overlay's aspect (1 x 4 cells per reel).
* Runtime (`src/game/stacks.ts`):
  * `stack_form` plays once when a reel completes (it replaces the squash and flash placeholder), then `merge_idle` loops.
  * `merge_join` plays once at the merge hit, then `merge_idle`.
  * `letters_ignite` plays at the letters beat and holds its last frame. It replaces the CSS `.mLets` letters.
  * `merge_win` loops while a win line runs through the wild.
* **Any missing sheet keeps today's placeholder**, so sheets can land one at a time.
  Today `index.json` is `{"sheets": []}`, so everything is placeholder.

## Roxy (full-body character)
```
node scripts/import-art.mjs roxy /workspace/elfhaus-roxy-p3d/out
```
* Takes `roxy_<tag>_<state>_<page>.{json,webp}`: the `roxy_full_*` set, or the painted-3D `roxy_p3d_*` set from `tools/pack.py`.
  The states are `idle`, `anticipation`, `disappointed` and `excited`.
  The set is renamed to `roxy_full_*` (file names, `meta.image`, `related_multi_packs`, frame and anim keys).
  The old pages are removed first, so a different page count drops in cleanly.
  If a folder holds several sets, pick one with `--tag=p3d`.
* Data-driven:
  * any page count (`meta.related_multi_packs`)
  * any frame size (`sourceSize`)
  * held frames: repeated names in the animation list, as in the 8-unique-fps loops of p3d
  * the playback tick is 12 fps
  * idle rests on frame 8
* Memory (`src/game/roxy.ts`): only **idle** stays decoded.
  * The other states keep only their compressed WebP blobs, downloaded during the loading screen.
  * A state is decoded off the main thread when `roxy(state)` asks for it, page 0 first.
  * It is `close()`d 4 s after she is back to idle.
  * If a page is not decoded in time, she holds the current frame. The state switch already cross-fades over 150 ms.
  * Tune this with `RESIDENT` / `FREE_MS`.
  * `window.__roxyMem()` reports the decoded MB per state.

## Wild multipliers (display rules)
* Every wild shows **one pink gem** in its **top-left corner**: a single wild cell, a full reel, or a merged group.
  A merged group shows its product.
* `ui.MX_NUDGE` moves the gem per art key (in cell fractions) if a new art set puts a face in that corner.
  The current set needs no nudge.
* A single wild or a lone full reel ticks +1 on its gem, with a pop.
* A merged group grows (`mergefx.growIn`):
  * the total splits into one gem per reel corner
  * the changed reels tick +1
  * the gems fly back, and the total shows the running product (e.g. x5, then x30) and counts up
  * this takes about 1.3 s; tap or turbo snaps to the end
* A fresh merge (`mergefx.mergeIn`) flies each reel's gem into the group's corner gem the same way.
* Only transform and opacity are animated.

## Phone-landscape text floor
* `stage.ts fitStage` computes `tb = clamp(1, 0.66 / s, 2.2)` in landscape only (`s` is the single stage scale).
  When `tb > 1` it sets `body.tb` and the CSS vars:
  * `--tb` for HUD and banner text
  * `--tbs = min(tb, 1.5)` for in-cell text
  * `--tbm = min(tb, 1.6)` for modal zoom
* The rules are in the "Legible text floor" block at the end of `static/elfhaus.css`.
  Desktop (s ≥ 0.66) and portrait are untouched.
