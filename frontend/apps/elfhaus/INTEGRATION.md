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
* Per-reel art (stacks_v2): each reel has a fixed elf (1 Roxy, 2 Jade, 3 Vi, 4 Coco, 5 Delilah), so every contiguous run has its own art.
  Add the overlay's reels as a 1-based suffix: `_R<n>` for a single full reel, `_R<first>-<last>` for a merge,
  e.g. `merge_idle_WM3_R2-4`, `letters_ignite_WF_R5`. The runtime uses the reel-specific sheet when it is imported and falls
  back to the plain `<anim>_<variant>` sheet, so both kinds can coexist.
  Static set to test: `node scripts/import-art.mjs stacks /workspace/elfhaus-frameless/stacks_v2/dropin_static/per_reel`.
* Atlas schema (same as `sym_<K>`):
  `{"image": "<file>.webp", "anims": {"<anim>": {"fps": 20, "loop": false, "frames": [[x,y,w,h], ...]}}, "size": [W, H]}`.
  The anim with the file's name is played, or the first one if that name is missing.
  Each frame is drawn over the whole overlay, so make frames at the overlay's aspect (1 x 4 cells per reel).
  Trimmed frames (optional, per anim): `"canvas": [W, H]` plus frames `[x, y, w, h, ox, oy]` draw each frame 1:1 at `(ox, oy)` on a
  W x H canvas that is then stretched over the overlay (stacks_anim uses this for `letters_ignite`: only the letter band is stored).
* Animated set (all 15 runs x 4-5 anims, 60 sheets): `/workspace/elfhaus-frameless/stacks_anim/build_anim.py` builds them from stacks_v2
  into `stacks_anim/out/sheets` (`report.json` has the decoded MB per sheet), then import that folder.
* Runtime (`src/game/stacks.ts`). Sheets decode ON DEMAND (all 60 decoded would be ~680 MB); only `index.json` is read at start:
  * `merge_idle` + `letters_ignite` decode when an overlay shows (placeholder until then); `stack_form` when `reveal` /
    `respinReveal` see 2+ wilds on a reel that is not full (`stackPrefetch`); `merge_join` as soon as 2+ adjacent wild overlays
    are on the board; `merge_win` when the win starts. Sheets nothing needs are closed after 4 s.
  * `stack_form` plays once when a reel completes (it replaces the squash and flash placeholder), then `merge_idle` loops.
    `letters_ignite` restarts with it (its blank lead-in frames wait for the build-up).
  * Merge (`mergefx.ts`): the singles' bodies (snapshots on one stage over the merged area, so no inner borders; their letters
    fade) lean / slide together with an elastic overshoot, squash at contact under a rising white-pink bloom, then a HARD cut at
    the bloom's peak to the merged overlay (never a cross-dissolve). `merge_join` is GROUP ONLY: it starts at about a single's
    size, bottom anchored, and scales up into the group pose with an elastic settle, then hair / heads settle; `letters_ignite`
    starts at the cut and its blank lead-in waits for the settle. `merge_join` plays then `merge_idle`. Without it, the placeholder group art
    does the same scale-up as a transform. The group art may be drawn larger than the singles (heads or legs cropped):
    the merged overlay clips everything to exactly the merged reels' area.
  * `letters_ignite` plays at the letters beat and holds its last frame. It replaces the CSS `.mLets` letters.
  * `merge_win` loops while a win line runs through the wild. Its frames carry the letters, so the letters layer is hidden meanwhile.
* **Any missing sheet keeps today's placeholder**, so sheets can land one at a time.
  Today `index.json` is `{"sheets": []}`, so everything is placeholder.

## Per-reel wild expand (fx_wfexpand_R1..R5)
```
node scripts/import-art.mjs fx /workspace/elfhaus-restyle/out/static/art
```
* The `wfexpand` row of `fx_wild` bakes ONE elf (reel 1, Roxy). Per-reel sheets `fx_wfexpand_R<n>.{webp,json}` (n = 1-based reel;
  anim `wfexpand`, sym atlas schema) are copied to `static/assets/fx/` and listed in `static/assets/fx/index.json` (`{"sheets": []}` = none).
  The same command copies a new `fx_wild.webp` (same atlas) to its manifest source `assets/final/fx/fx_wild.webp`.
* Runtime (`wildfx.ts`): `wfExpand(ov)` plays the overlay's reel sheet. Only the compressed bytes are fetched at start; a sheet
  decodes on demand (`warmExpand(reel)` runs at the stack squash / before guaranteed stacks) and is freed 4 s after use, like
  Roxy's states. If a sheet isn't decoded within 220 ms the elf frame is skipped (the shine still plays).
  With no per-reel sheet: the elf frame is skipped when that reel's stack sheets (`merge_idle` / `stack_form`) are loaded,
  otherwise the old `fx_wild` row plays (placeholder art only).

## Wild statics: overlay placeholder + bonus-buy cards (WF, WM2..WM5)
```
node scripts/import-art.mjs wilds /workspace/elfhaus-restyle/out/proposed_wild_statics
```
* Names in: `WF.webp`, `WM2.webp`, `WM3.webp`, `WM4.webp`, `WM5.webp` (transparent is fine, same sizes: 384 x 1536 per reel).
* `static/art/` is generated (`sync-art.mjs` copies the `art-manifest.json` sources on dev/build), so they are written to:
  `assets/final/webp/wild_WF_fullreel.webp`, `wild_WM2_two_elves.webp`, `wild_WM3_three_elves.webp`, `wild_WM4_four_elves.webp`,
  `wild_WM5_five_elves.webp`.
* Cards (`game.ts` CARD_ART): Double Dare = WM2, Triple Dare = WM3, Elves Gone Wild = WF (`.bArt` cover crop on #2A2433, EGW
  biased to the top). WM2..WM5 / WF are also the merged / full-reel overlay art while no stack sheet is loaded.

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

## Max-win / big-win cast (round 6 art)
* Cast (painted3d_v2, no face shadows): max win Coco | Jade | Delilah | Roxy | Vi, Delilah centre-front; big win (and legendary,
  1000x+) Vi | Roxy | Coco. Each elf has her own pose, face and accent-colour outfit. Roxy's art is mirrored so her raised cup
  points into the group.
* Sheets `src/assets/{maxwin,bigwin}/*_elf_{name}.webp` + `src/game/{maxwin,bigwin}/*.json`. The atlas schema is unchanged,
  but a state frame can now be a face patch `[x, y, w, h, ox, oy]`: `elfrig.draw()` draws the full base frame, clears the
  patch rect and draws the patch 1:1 at (ox, oy). Plain `[x, y, w, h]` full frames still work.
* Group frames (CSS aspect-ratio): `.mwGroup` 1467/796 (portrait width 132vw), `.bwGroup` 778/564.
* Background: `maxwin_bg_land.webp` / `maxwin_bg_port.webp` are pre-blurred Lounge plates (no CSS filter). `maxwin.ts`
  decodes the plate with the sheets (`preloadMaxWin`), waits for it before the entrance and drops it in `releaseMaxWin`.
* Removed: the four-point sparkles (`maxwin_sparkle` sheet + `.mwSpark`), the star glint (`featPop`) on the big-win tier titles
  and on the TOTAL WIN outro. The free-spins intro banner keeps `featPop`.
* Decoded memory: max-win sheets 8.5 MB (+ about 6 MB of per-elf canvases); big-win sheets 3.2 MB. All are lazy-loaded and
  released after the screen closes. Motion is unchanged (`SLOW = 2`, `TEMPO = 1.8`, the PEAK timeline, the per-elf rigs).
