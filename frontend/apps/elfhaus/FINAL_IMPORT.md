# Final art import runbook (from the 2026-10-25 dry run on `dryrun-final`)

All commands are copy-paste. Paths: `FE=/workspace/elfhaus-fe` (branch `frontend-elfhaus`), app `FE/frontend/apps/elfhaus`.
Budget: about 10 minutes (anim build ~1 min, imports seconds, test + build ~1 min, QA shots ~10 min because `base_wincap` plays 10 free spins).

## 0. Preconditions
- The art workers have signed off: stacks letter wrap (`/workspace/elfhaus-frameless/stacks_v2`), win-screen motion
  (`/workspace/elfhaus-restyle/winscreens_preview/motion.patch`), Roxy (`/workspace/elfhaus-roxy-p3d/out`). Don't build while
  `stacks_v2/groups/*.png` are still being written (check the mtimes are stable: `ls -l --time-style=+%T stacks_v2/groups`).
- `static/assets/stacks/index.json` is `{"sheets": []}` on `frontend-elfhaus` by standing rule. Step 3 fills it; that needs the go-ahead.
- Clean tree, up to date: `cd $FE && git status --short && git pull --rebase`.
- `export COREPACK_HOME=$HOME/.cache/corepack`

## 1. Pipeline fixes (once): cherry-pick from `dryrun-final`
```
cd $FE && git cherry-pick 2c88dba fd709ea 477db47 <this runbook's commit>
# 2c88dba import-art stacks guard | fd709ea dev server PORT | 477db47 egw_wm5 QA book | runbook: `git log -1 dryrun-final -- frontend/apps/elfhaus/FINAL_IMPORT.md`
```
Never cherry-pick the `DRYRUN ART` / `DRYRUN PATCHES` commits.

## 2. Build the animated stacks sheets
`STACKS_SRC` must be the **stacks_v2 root** (the default). It reads `lineups.json`, `groups/` and `letters/` there.
`stacks_v2/dropin_static` has none of those and fails with `FileNotFoundError: .../dropin_static/lineups.json`.
`--out` keeps the old `out/` untouched.
```
cd /workspace/elfhaus-frameless/stacks_anim
/workspace/rembgenv/bin/python build_anim.py --qa -j 6 --out out_final        # ~60 s; 60 sheets
python3 -c "import json;d=json.load(open('out_final/report.json'));print(d['total_decoded_mb'],'MB decoded,',d['total_file_mb'],'MB files')"
```
Dry run: 60 sheets, 677 MB decoded (all of them, never all at once), 26.4 MB of webp. Look at `out_final/qa/` before importing.

## 3. Import (from the app dir)
```
cd $FE/frontend/apps/elfhaus
node scripts/import-art.mjs stacks /workspace/elfhaus-frameless/stacks_v2/dropin_static/per_reel   # statics: merge_idle + letters_ignite x15
node scripts/import-art.mjs stacks /workspace/elfhaus-frameless/stacks_anim/out_final/sheets       # 60 animated sheets
node scripts/import-art.mjs fx     /workspace/elfhaus-restyle/out/static/art                       # fx_wfexpand_R1..5 + fx_wild.webp
node scripts/import-art.mjs wilds  /workspace/elfhaus-restyle/out/proposed_wild_statics            # WF, WM2..WM5 statics
node scripts/import-art.mjs roxy   /workspace/elfhaus-roxy-p3d/out                                 # p3d -> roxy_full_* (old pages removed)
python3 -c "import json;print(len(json.load(open('static/assets/stacks/index.json'))['sheets']),'stack ids (expect 60)')"
```
- The animated set covers every id in the static set, so the statics can be skipped. With the guard (step 1), a 1-frame static
  never overwrites an animated sheet, so the order doesn't matter. **Without the guard, import the statics FIRST.**
- `stacks_v2/dropin_static/stock_names` (WM5 only, no `_R` suffix) is not needed: per-reel ids win.
- `roxy` ignores `flicker.json` (a QA report). Expect 24 files (4 states x 3 pages); old page 3+ files are deleted.
- Add `--dry` to any line to preview.

## 4. Win screens
`winscreens_preview/motion.patch` (round 4: per-elf maxwin/bigwin sheets + `elfrig.ts`) **supersedes `layout.patch`**. 5 of layout's 6 hunks are
already inside motion.patch; the 6th (the maxwin.ts group `peak` timing) targets code that motion.patch replaces. Applying both conflicts.
```
cd $FE
git apply --check /workspace/elfhaus-restyle/winscreens_preview/motion.patch && git apply /workspace/elfhaus-restyle/winscreens_preview/motion.patch
# only if the restyle worker re-exported the title: take it when it differs (the .json didn't change in the dry run)
cmp frontend/apps/elfhaus/src/assets/maxwin/maxwin_title.webp /workspace/elfhaus-restyle/maxwin_p3d/sheets/maxwin_title.webp || \
  cp /workspace/elfhaus-restyle/maxwin_p3d/sheets/maxwin_title.webp frontend/apps/elfhaus/src/assets/maxwin/
```
- Do NOT copy `maxwin_p3d/sheets/maxwin_group.*` or `maxwin_p3d/bigwin/sheets/bigwin_group.*`: motion.patch deletes the group
  sheets (round 3). Copying them back would put 3.3 + 1.7 MB of unused webp into the eager `import.meta.glob`.
- If motion.patch was re-exported against a different base and `--check` fails, try `git apply -3`. The overlap with the B2 frame
  CSS is nil (the B2 block sits at the end of elfhaus.css).
- motion.patch also edits `sprite.ts`; make sure nobody else has sprite.ts changes in flight.

## 5. Verify
```
cd $FE/frontend/apps/elfhaus
pnpm test && pnpm build && du -sb build
node $FE/frontend/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/bin/tsc --noEmit -p . --ignoreDeprecations 6.0 | grep -c "error TS"   # dry run: 256 (after 1a fix), identical to frontend-elfhaus 0b51f91 (pre-existing: JSON modules, config/fx/intro/ui)
```
Dry run: build 53,356,494 B (was 27,480,845 B). Stacks are +27.7 MB of that, Roxy p3d atlases 8.2 MB.

## 6. QA shots + decoded memory
```
PORT=3012 pnpm dev &      # needs the PORT fix; 3001 is the main checkout, 3011 another worker's
cd /workspace/elfhaus-shots/tool && SUF=_final PORT=3012 node dry.mjs 1920x1080 390x844
```
Writes `/workspace/elfhaus-shots/dryrun/{base,freespins,wm5_join,wm5_idle,bigwin,maxwin_gawk,maxwin_peak}_<vp>_final.png` and prints, per scene,
console errors and live decoded bitmaps by category (stacks / roxy / maxwin / bigwin / fx / other).
Use `BIGBOOK=base_hidden` for the >=1000x big win with the elf layer. The WM5 merge uses `?book=egw_wm5`.
Dry-run figures (1920x1080): idle ≈ 172 MB decoded (symbols/ui 65, fx 48, Roxy idle 29, maxwin 26 + bigwin 4 preloaded),
WM5 merge +83 MB stacks (merge_join_WM5 31.6, merge_idle_WM5 17.6, letters_ignite_WM5 9.7, singles).

## 7. Commit (small, in this order) and push only when told
1. `elfhaus art: stacks anim + static sheets (60), index.json` (static/assets/stacks)
2. `elfhaus art: fx_wfexpand R1-5, fx_wild, wild statics` (static/assets/fx, assets/final/...)
3. `elfhaus art: Roxy p3d` (static/assets/atlases/roxy_full_*)
4. `elfhaus: win-screen motion round 4 (motion.patch)` (+ maxwin_title if changed)
Then `git pull --rebase`, re-run `pnpm test && pnpm build`, push without force.

## Known issues from the dry run (not fixed: owned by other workers or by design)
- **Size:** +25.9 MB in the build, almost all of it the 60 stacks sheets (26.4 MB webp). The biggest are merge_join_WM5 1.38 MB, merge_win_WM5 0.87 MB, merge_join_WM4_* 1.3 MB.
  To trim, lower `RES` in build_anim.py (WM4/WM5 merge_join, merge_win) or the WebP quality. That's the stacks_anim owner's call.
- **Memory peak:** a WM5 merge decodes 83 MB of stacks sheets on top of ~172 MB of idle bitmaps. maxwin (26 MB) and bigwin (4 MB) per-elf
  sheets are decoded at idle by `preloadMaxWin` and stay decoded until a max win. Fetching only (decoding on demand) would free ~30 MB
  on mobile. That's in motion.patch's maxwin.ts / bigwinElves.ts (restyle owner).
- **Merge badges:** during `merge_join` the singles' multiplier badges overlap ("x4x4" at reels 1-2, the left one clipped at the board edge)
  for about 0.5 s before the product badge. mergefx.ts (stacks owner). Visible in `wm5_join_*`.
- **Letters:** the WM5 `letters_ignite` last frame is faint (translucent tattoo letters). It matches the static drop-in pixel for pixel, so it's the art
  (letter wrap still in progress), not the import.
- **Worktree setup:** `pnpm install --frozen-lockfile` fails (the lockfile is stale on frontend-elfhaus). In a fresh worktree use
  `pnpm install --offline --no-frozen-lockfile` then `git checkout frontend/pnpm-lock.yaml`. tsc isn't linked there; use the main checkout's.
- Don't edit vite.config / package.json while a dev server runs on a worktree: vite restarts and can exit (that killed one QA pass).
