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
| Per-elf face reactions after a full-reel stack merges (R1 Roxy grin/wink/ahegao, R2 Jade, R3 Vi, R4 Coco, R5 Delilah; ~2.6-2.75 s at 12 fps, ~100 KB webp, ~1.1 MB decoded all five; built on stacks r8d) | `/workspace/elfhaus-stack-react/out/stack_react_R1..R5.{webp,atlas.json}` -> `static/assets/stacks/` (not listed in index.json); `out/INTEGRATION.md` -> `docs/STACK_REACT_INTEGRATION.md`. Status: **assets in, hookup pending with spinfix** (stackIn is being rewritten there; turbo/tap skip straight to idle) | 2026-10-25 4:44 PM ("It all looks good to me") |
| AI-audit code fixes (aifix): no sparkles (a411067, 6b3a3d2), calm wild landing (002e837, no longer on hold), per-reel single wilds W_R1..W_R5 (1f47d9c), pink circles/rings removed (de3e825), outline win glow (95134cd + cdd41b6: uses the symbols-v3 `symbol_*_glow.webp`; the temp `webp/glow/` files are only a fallback and are not copied into the build), splash Lounge plate (5a2a65b), buy cards with in-game art (6b1a3a0), rules trim (fdcdb16), no lavender loader flash (ce3bbe9), one HUD icon language (d000e2b), side Roxy contact shadow (6a17c61), FS intro/outro card + win-title type system using brand-v3 `assets/final/titles` (f6a2f14), minimal settings panel (6b4b1b4), static grain + glow budget (075dd33) | branch `aifix`, cherry-picked in order onto final (here 2c2d2c7 69126e8 319f0ab 709db78 ee11157 0449260 c66284e 6c1be8b c0c0b89 c922c77 e7a0ccb 8e046ed 462d1c4 515a0cc 6c61780 c2c8ef3). Conflict: Game.svelte (f6a2f14): kept aifix's START intro button, kept final's cast-v6 #maxwin markup (no inline background_fs). Status: **in** | 2026-10-25 ~4:57 PM |
| Calm reel spin + gentle landing (58cf6b0) and full-reel wild forming from the merging singles (cf05fe3); turbo unchanged | branch `spinfix`, here 484b606, 8ef1f8a (80adff0 skipped: duplicate of 1f47d9c). Status: **in** | 2026-10-25 ~4:57 PM |
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
- "Dare Dorm" never appears in the game.
- The theme is not brown.
- Sprite sheets only; animate transform and opacity only.
- Calm screen, minimal text.
- painted3d_v2 everywhere, no face shadows.
- Animations at a calm speed (about 2x slower than the old default); turbo and tap/Space skip stay fast.
- Keep the neon (win titles, Lounge trim, symbol win glow).
- Stake allows weed, alcohol and skimpy outfits (the leaf stays; outfits may be more revealing within the rule above).
- Avoid AI tells (garbled text, bad hands, sparkles, plates/rings, mismatched characters).
- ONE build zip at the end.
