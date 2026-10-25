# Elfhaus: approved assets (single source of truth)

Branch `final` is the integration branch. It holds **only** work the user has approved. If something is not listed under
"Approved and in the build", it must not be in this branch. All dates are 2026-10-25 (America/Chicago) unless noted.

## How to add an item
- An item moves to **Approved and in the build** only after the user approves it, and **in the same commit that imports it**
  (the commit edits this file and adds the art/code together).
- Until then it lives under **In progress / awaiting approval** with its worker folder or branch.
- When the user rejects something, move it to **Rejected / do not use** with the reason.
- Never carry a `DRYRUN ART` / `DRYRUN PATCHES` commit. Never cherry-pick from a branch wholesale: list the commit here first.

## Approved and in the build
| Item | Source (path / commit) | Approved |
|---|---|---|
| Lounge background, base + free spins (with FS swap) | `/workspace/elfhaus-bg/final_lounge`; commits 4652153, 4aa1fc4 (in base 0b51f91) | 2026-10-25 ~12:45 PM |
| Board frame B2 "Lounge Alcove" | `/workspace/elfhaus-bg/board_frame/r2`; commit 0b51f91 | 2026-10-25 ~1:25 PM |
| Stone ELFHAUS logo, unchanged | already in base (frontend-elfhaus) | 2026-10-25 (user: "the stone title can stay") |
| Merge animation motion: lean-in, flash cut, group scale-up, letters ignite | 0e83f90 lineage (in base) | 2026-10-25 1:01 PM |
| Stacks r8d sheets (cutout halos removed, one ink colour per group; 60 ids, 363.5 MB decoded total, 11.7 MB webp; WM5 join + idle + letters 29.2 MB peak). Replaces round 8c | `/workspace/elfhaus-frameless/stacks_anim/out/sheets` (report.json 16:28) copied into `static/assets/stacks` (index.json unchanged, same 60 ids). Status: **in** | 2026-10-25 4:44 PM ("It all looks good to me") |
| Glowing wild frames, thick + bright | 322951a + ffaaacd (here 6de02f7, 5d27bf9) | 2026-10-25 ~3:15 PM |
| Multipliers shown separately, count up, re-merge (also on growth); no doubled badges | 7a4b98a (in base) + 24e2471 (here bf02f56) | 2026-10-25 |
| Board tempo ~2x calmer, turbo = old timings, Space/tap skips | 766bb71 (here a08f4a0), `src/game/tempo.ts` | 2026-10-25 ~4:00 PM |
| Smooth stacks frame crossfade while slowed | 12396d3 (here 92c4e8c) | 2026-10-25 ~4:20 PM |
| Win screens: per-elf max-win / big-win sheets (elfrig), slowed ~2x (TEMPO 1.8), lazy decode; p3d max-win title | `/workspace/elfhaus-restyle/winscreens_preview/motion.patch` (15:01 build, sha256 8fb9d3f0…40e8); `maxwin_p3d/sheets/maxwin_title.webp` | 2026-10-25 (max-win slowed motion) |
| Symbols v3: painted H1–H4, L1–L5, S with neon outline win glow (`_win` = `_glow`), sheets at 12/15 fps; reel blur strips regenerated | `/workspace/elfhaus-symbols-v3/import` via `import-art.mjs symbols`, then `gen_reelblur.py` | 2026-10-25 ~4:30 PM ("go with what we had already decided") |
| Lounge retouch v3 (clean stair rail, string lights, smooth window sky, corbels on pilasters, ferns, side props, static grain; neon trim unchanged) + carved neon win titles matching the stone logo | `/workspace/elfhaus-brand-v3` lounge/background*.webp (2560x1440 / 1440x2560) -> `assets/final/webp/bg_*` (manifest keys background, background_portrait, background_fs, background_fs_portrait); titles/maxwin_title_sheet.webp -> `src/assets/maxwin/maxwin_title.webp` (same 2256x656 atlas, maxwin_title.json unchanged); all 9 titles/*.webp -> `assets/final/titles/`. Status: **in**. Note: title_<tier>win code hookup (manifest keys + countup) is **pending, owned by aifix**; process/ not imported | 2026-10-25 4:44 PM ("It all looks good to me") |
| Win-screen cast v6 (new per-elf max-win / big-win cast sheets with face patches, pre-blurred Lounge plate behind the max win, four-point sparkles and star glints removed); slowed timings (SLOW 2, TEMPO 1.8) and the max-win title kept | `/workspace/elfhaus-restyle/winscreens_preview/motion.patch` (16:40, sha256 55291b32; built on dryrun 6cf2410) applied with `git apply --3way` over the r5 version already here (motion_r5.patch = sha 8fb9d3f0); conflicts resolved to v6 (sheets/atlases, sparkle + featPop removal, maxwin bg loader). Status: **in** | 2026-10-25 4:44 PM ("It all looks good to me") |
| Per-elf face reactions after a full-reel stack merges (R1 Roxy grin/wink/ahegao, R2 Jade, R3 Vi, R4 Coco, R5 Delilah; ~2.6-2.75 s at 12 fps, ~100 KB webp, ~1.1 MB decoded all five; built on stacks r8d) | `/workspace/elfhaus-stack-react/out/stack_react_R1..R5.{webp,atlas.json}` -> `static/assets/stacks/` (not listed in index.json); `out/INTEGRATION.md` -> `docs/STACK_REACT_INTEGRATION.md`. Status: **in** (hooked into stackIn's calm stack-from-singles path: body holds merge_idle frame 0, `stack_react_R<n>` plays once at 12 fps on a `stk_react` layer, then idle; letters + frame draw in alongside; turbo / tap / merge go straight to idle; a win bounce on that reel waits for the reaction) | 2026-10-25 4:44 PM ("It all looks good to me") |
| AI-audit code fixes (aifix): no sparkles (a411067, 6b3a3d2), calm wild landing (002e837, no longer on hold), per-reel single wilds W_R1..W_R5 (1f47d9c), pink circles/rings removed (de3e825), outline win glow (95134cd + cdd41b6: uses the symbols-v3 `symbol_*_glow.webp`; wilds now use their own outline glows, see the wild-glow row; the temp `webp/glow/` files and `gen-temp-glow.py` are deleted), splash Lounge plate (5a2a65b), buy cards with in-game art (6b1a3a0), rules trim (fdcdb16), no lavender loader flash (ce3bbe9), one HUD icon language (d000e2b), side Roxy contact shadow (6a17c61), FS intro/outro card + win-title type system using brand-v3 `assets/final/titles` (f6a2f14), minimal settings panel (6b4b1b4), static grain + glow budget (075dd33) | branch `aifix`, cherry-picked in order onto final (here 2c2d2c7 69126e8 319f0ab 709db78 ee11157 0449260 c66284e 6c1be8b c0c0b89 c922c77 e7a0ccb 8e046ed 462d1c4 515a0cc 6c61780 c2c8ef3). Conflict: Game.svelte (f6a2f14): kept aifix's START intro button, kept final's cast-v6 #maxwin markup (no inline background_fs). Status: **in** | 2026-10-25 ~4:57 PM |
| Calm reel spin + gentle landing (58cf6b0) and full-reel wild forming from the merging singles (cf05fe3); turbo unchanged | branch `spinfix`, here 484b606, 8ef1f8a (80adff0 skipped: duplicate of 1f47d9c). Status: **in** | 2026-10-25 ~4:57 PM |
| Max-win backdrop re-made from the brand-v3 Lounge (no old bokeh dots) + falling paper confetti removed from the max win (big-win / FS cards already confetti-free via aifix featfx); turbo/skip unchanged | `src/assets/maxwin/maxwin_bg_land.webp` 1280x720 / `maxwin_bg_port.webp` 720x1280 from `static/art/background.webp` / `background_portrait.webp` (= brand-v3 lounge plates, base not _fs, as before): LANCZOS resize, PIL GaussianBlur r=5, x0.817 (land) / x0.811 (port), webp q85 method 6 (recipe fitted against the old files, MSE ~2.4). `maxwin_confetti` sheet + json deleted; confetti tiles removed from `maxwin.ts`. Status: **in** | 2026-10-25 ~5:15 PM (calm-screen rule) |
| Wild win glows (W single + per-reel W_R1..W_R5): neon outline traced from each wild PNG's own alpha, the exact symbols-v3 recipe (crisp line just outside the outline + white-hot core + r7/r18 bloom, transparent centre, radii scaled to sprite size); colours = the elf's v3 neon (W/R1 #FF4FB0, R2 #2EF2D8, R3 #B46BFF, R4 #FF5468), R5 Delilah #4F8BFF (her blue band). No discs or rings. Temp `assets/final/webp/glow/` + `scripts/gen-temp-glow.py` removed; manifest `*_glow` keys now list only real art | `scripts/gen-wild-glow.py` -> `assets/final/webp/wild_<K>_glow.webp` (manifest `W_glow`, `W_R1_glow`..`W_R5_glow`; shown via `ui.ts` `glowLayer`, same as the symbols). Status: **in** | 2026-10-25 ~5:45 PM (closes the open wild-glow item; same style as approved symbols v3) |
| Splash backdrop re-made from the brand-v3 Lounge (aifix 6 had used the older `elfhaus-bg/final_lounge` plate) | `src/assets/intro/splash_bg_land.webp` 1920x1080 / `splash_bg_port.webp` 1080x1920 from `assets/final/webp/bg_base_noroxy_1920x1080.webp` / `bg_base_mobile_noroxy_1080x1920.webp` (brand-v3): LANCZOS resize, GaussianBlur 9, then aifix 6's own darken + vignette re-applied as a smooth per-pixel gain map fitted against the old splash (MSE 8.4 / 12.6), webp q85. Status: **in** | 2026-10-25 ~5:50 PM (closes audit 3) |
| Vi (H3) symbol iris matched to the lavender used by her stacks, reactions and cast (audit 20 drift). Local edit only: iris-coloured pixels inside the open eye (512 box 172,140-198,166; x2 on the 1024 PNG), hue +2 (OpenCV) toward the stack iris, saturation x0.62, value x1.06, feathered mask; hair, skin and everything else untouched. Unused `fx/sym_H3` win strip (SYM_STRIPS off) and the 192 px motion-blur reel strips not regenerated (iris not visible there) | `assets/final/webp/symbol_H3.webp`, `assets/final/symbol_H3.png`. Status: **in** | 2026-10-25 ~5:55 PM (user: match Vi's eyes to the majority) |
| House-rule pass: loader bar animates `transform: scaleX` (was width), big-win title lift uses `translate` (was `top`, now on the board tempo), buy-card hover no longer transitions border/box-shadow, duplicate `<i>` switch knob hidden (Ante / Stop on feature showed two dots; the knob is `.sw::after` translateX). Retired working title scrubbed from ART_BIBLE.md / DECISIONS.md / this file (left only in README.md's GitHub repo URL, which is the repo's real name, not shipped). Checked: no nipples/genitals in symbols, wilds, stacks, win-screen cast, reactions, buy cards; Lounge is plum/neon, not brown; turbo = tempo 1 and tap/Space skip unchanged | `static/elfhaus.css` (end block), `src/game/loader.ts`, `assets/ART_BIBLE.md`, `design/DECISIONS.md`. Status: **in** | 2026-10-25 ~6:00 PM (standing rules) |
| Pipeline/QA commits | 2c88dba fd709ea 477db47 576e609 0f992c6 9b509d6 11b3200 (import guard, dev PORT, egw_wm5 book, runbook, tsc fixes) | n/a (tooling) |

## Approved but held (do not import yet)
| Item | Source | Rule |
|---|---|---|
| Painted-3D Roxy | `/workspace/elfhaus-roxy-p3d/out` (out_v2 fixes in progress) | Import with `node scripts/import-art.mjs roxy …` only when ALL her animations are done, incl. the max-win group and stack/merge. The base keeps the current Roxy atlases. |

## In progress / awaiting user approval (not in the build)
| Item | Where |
|---|---|
| Roxy out_v2 fixes (incl. the mouth hole) | `/workspace/elfhaus-roxy-p3d` |

## Rejected / do not use
| Item | Why |
|---|---|
| Symbols r2 `/workspace/elfhaus-symbols-r2` | second take; keeps Jade's "27", dull lows, no neon outline glow |
| Exterior and Hallway backgrounds | rejected |
| Dorm background | gone; fallback PNG only, never shown |
| `layout.patch` | obsolete, superseded by motion.patch |
| f16cc93, 3211a0a, 6b4034b | dry-run-only commits (3211a0a carries Roxy p3d, fx_wfexpand, wild statics; 6b4034b the r4 motion.patch) |
| Logo redesign, incl. hand-inked logo `/workspace/elfhaus-logo-r2` | user keeps the stone ELFHAUS title |
| Lounge retouch `/workspace/elfhaus-bg/lounge_r2` | tones down the neon; user said keep the neon |
| Pink rings/circles on wilds and symbols | "remnants of the circle symbols"; removal is in aifix |
| Four-point sparkles / lens-flare stars | AI tell (audit 1) |

## Standing rules
- Never nipples or genitals. Adults only.
- The retired working title (see design/DECISIONS.md history) never appears in the game, its code, strings, filenames or metadata.
- The theme is not brown.
- Sprite sheets only; animate transform and opacity only.
- Calm screen, minimal text.
- painted3d_v2 everywhere, no face shadows.
- Animations at a calm speed (about 2x slower than the old default); turbo and tap/Space skip stay fast.
- Keep the neon (win titles, Lounge trim, symbol win glow).
- Stake allows weed, alcohol and skimpy outfits (the leaf stays; outfits may be more revealing within the rule above).
- Avoid AI tells (garbled text, bad hands, sparkles, plates/rings, mismatched characters).
- ONE build zip at the end.
