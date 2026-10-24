# MATH_HANDOFF – finish the Elfhaus math (branch `math-elfhaus`)

## Setup
- Python 3.13 (3.11+ fine). `cd math && python -m venv .venv && . .venv/bin/activate` (Windows: `.venv\Scripts\activate`) then `pip install -r requirements.txt && pip install -e .`
- All Elfhaus code: `math/games/elfhaus/`. Rules: `design/SPEC.md` (source of truth), `design/DECISIONS.md`, `design/EVENTS.md` (book event contract), `design/COMPLIANCE.md`.

## Files
- `game_calculations.py` mechanics (START_FS, MYSTERY_ODDS, play_bonus, round_mystery, mystery_start_board)
- `modes.py` 7 bet modes; `reel_params.json` costs + per-mode strip weights; `make_reels.py` builds `reels/*.csv`
- `run_local.py` simulate all modes, write `library/publish_files/` (index.json, books_<mode>.jsonl.zst, lookUpTable_<mode>_0.csv), print acceptance table
- `optimize.py` LUT weighting (RTP to 96.67%, P(>=5000x) < 0.95%, CVaR(0.1%) < 19,000; Mystery buckets fixed 50/37/10/3)
- `tune.py`, `autotune.py`, `odds_search.py`, `apply_scale.py` tuning helpers; `audit_books.py` book checks; `make_samples.py` -> `math/samples/*.json`; `tests/test_events.py`

## Commands (run from `math/`)
- Quick: `python games/elfhaus/run_local.py 20000 5000 1 1 base,dare` (args: base_n bonus_n sims 0/1 optimize 0/1 [modes])
- Full: `python games/elfhaus/run_local.py 1000000 200000 1 1 base,ante,dare,double_dare,triple_dare,egw,mystery` (multiprocessing Pool; uses all cores). Last full run took ~4h on a small cloud box.
- Samples: `python games/elfhaus/make_samples.py`; tests: `python -m pytest games/elfhaus/tests`

## Last full results (OLD spin counts 8/10/12/14 – must be redone)
| mode | cost | RTP | hit | P(>=5000x) |
|---|---|---|---|---|
| base | 1 | 96.670% | 23.53% | 0.003% |
| ante | 1.25 | 96.670% | 23.06% | 0.004% |
| dare | 50 | 96.670% | 97.36% | 0.111% |
| double_dare | 225 | 96.670% | 97.94% | 0.913% |
| triple_dare | 700 | 96.670% | 98.82% | 0.827% |
| egw | 450 | 96.670% | 89.54% | 0.667% |
| mystery | (600 target) | not final – new spec (SPEC §8 rev. 2026-10-24) only partly run; run was stopped |

## Remaining work
1. **Spin counts (user 2026-10-24):** `START_FS = {"dare": 8, "double_dare": 10, "triple_dare": 10, "hidden": 10}`. +2 per newly completed stack, cap 18, Dare->Double Dare upgrade +2 once. Update SPEC §1, §5, §6, §8 text (currently say 10/12/14).
2. **Mystery** exactly per SPEC §8: odds fixed 50/37/10/3; tease = normal spin with ≥1 wild in a connected win on any reel; respins are the reveal; reveal decides tier only; bonus starts fresh on Mystery's own FS reels with that tier's defining board at starting values (DD 1 stack x4; TD 1 stack x4 + 2 singles x1; Hidden 2 stacks x4). Verify `round_mystery` / `mystery_start_board` match, then tune price + strips.
3. Retune and full-run all 7 modes: each RTP 96.65–96.69%, 50,000x reachable in every mode, cost ≤ 1000x, P(>=5000x) ≤ 1%.
4. Regenerate publish_files + samples, run tests and audit_books, write `MATH_STATUS.md` with the per-mode table, merge to `main`.

## Rules / pitfalls
- Don't change mechanics (SPEC is locked by the owner). Tune strips, stack odds, prices and LUT weights only. If a target can't be met, stop and explain in MATH_STATUS.md.
- `library/temp_books/` gets huge (3.6 GB for a full run) and is git-ignored, as are publish books/LUTs and reels CSVs; regenerate them.
- Mystery generation is rejection sampling; if a bucket exhausts `max_tries`, adjust Mystery strip weights, not the rules.
- Never force-push. Don't touch `frontend/`.
