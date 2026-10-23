# BUILD_PROMPT – build Dare Dorm – Elves for Stake Engine
This file is for a **local coding agent** (Cursor, Claude Code, Codex, …) running on the user's computer with this repo checked out. Paste §1 into the agent as the task; it then works through §3–§7 in order and ticks the checklists.

---
## 1. The prompt (copy-paste this)
```
You are building "Dare Dorm – Elves", a Stake Engine slot by Rizzin Games, from the repo in the current folder.

Read first, in this order: AGENTS.md, BUILD_PROMPT.md (all of it), design/SPEC.md, design/EVENTS.md,
design/CONTENT_RULES.md, assets/ART_BIBLE.md. design/SPEC.md is the single source of truth for mechanics.
design/DECISIONS.md holds the user's original answers; if anything conflicts, DECISIONS.md wins, then SPEC.md.

Hard rules:
1. Never change anything in BUILD_PROMPT.md §8 ("Rules you must not change without asking the user").
   If a limit can't be met without changing one, STOP and report the best numbers you achieved per mode.
2. The math must reproduce every worked example in SPEC.md §12 exactly (design/prototypes/worked_examples.py
   is the reference). Write those as unit tests before writing the simulator.
3. Work phase by phase (A → B → C → D). Finish each phase's acceptance checks before starting the next.
   Commit after each passing phase with a message "phase X: ...". Do not push secrets or large book files
   to git (books/LUTs go in math/games/dare_dorm_elves/library/, which is git-ignored except index.json + stats).
4. The frontend never decides outcomes: it only plays books.
5. Be economical: run small sims (10k–50k) while developing; run the full sims only once in Phase B.
6. At the end, print the Definition-of-done table (BUILD_PROMPT.md §9) with real numbers.
Start with Phase A0 (environment) now.
```

---
## 2. Prerequisites
| Tool | Version | Notes |
|---|---|---|
| Python | **≥ 3.12** (math-sdk README) | `python3 --version` |
| Rust + Cargo | stable (1.80+) | needed by the math-sdk optimizer (`optimization_program/`, Cargo) – https://rustup.rs |
| Make | any | `make setup` in the math-sdk |
| Node.js | **22.16.0** (web-sdk README) | use nvm/fnm: `nvm install 22.16.0` |
| pnpm | **10.5.0** | `npm install -g pnpm@10.5.0` (or `corepack enable`) |
| zstd | any | to inspect `.jsonl.zst` books (`zstd -d`) |
| git, gh | any | |

Official SDKs (verified 2026-10-23; the old `github.com/StakeEngine/*` URLs redirect to `engineio`):
- math-sdk: **https://github.com/engineio/math-sdk** (main). Docs: https://engineio.github.io/math-sdk/ . Sample games: `games/0_0_lines` (start here: lines + paylines), `0_0_expwilds`, `0_0_cluster`, `0_0_ways`, `0_0_scatter`, `template`.
- web-sdk: **https://github.com/engineio/web-sdk** (main). Svelte 5 + PixiJS 8 + Turborepo. Sample apps: `apps/lines` (start here), `apps/cluster`, `apps/ways`, `apps/scatter`.
- Stake Engine docs: https://stake-engine.com/docs (approval guidelines: `/docs/approval-guidelines`, math verification, front-end communication, jurisdiction requirements, RGS).

### Template: how Vault Breakers (same studio, approved build pipeline) is laid out
The studio's previous game `RizzRabbit/vault-breakers` (private; use it only if you have access, **read-only, never modify or push it**) is the pattern to mirror:
```
vault-breakers/
  math/                         = a full copy of math-sdk (src/, utils/, optimization_program/, setup.py, requirements.txt)
    games/vault_breakers/        = the game folder (copied from the SDK template, then edited)
      game_config.py             GameConfig: game_id, wincap, rtp, num_reels/num_rows, paytable, reels dict
                                 {"BR0":"BR0.csv",...}, bet_modes=[BetMode(name, cost, rtp, max_win, is_feature,
                                 is_buybonus, distributions=[Distribution(criteria="wincap", quota, win_criteria,
                                 conditions={"reel_weights":{...}, "force_wincap":True, "force_freegame":True}), ...])]
      gamestate.py               GameState.run_spin(sim) / run_freespin()  (the per-book game loop)
      game_override.py           reset_book, reset_fs_spin, draw_board, check_freespin_entry, tier logic
      game_executables.py        game-specific actions that emit events
      game_calculations.py       win evaluation helpers
      game_events.py             custom event constructors (one function per custom event)
      game_optimization.py       OptimizationSetup: per-mode ConstructConditions/Scaling/Parameters
      reels/BR0.csv BR1.csv FR0.csv   reel strips (one column per reel)
      run.py                     official runner (num_sim_args, run_conditions)
      run_local.py               local driver: python3 run_local.py <base_n> <bonus_n> <sims 0/1> <opt 0/1>
      audit_books.py, lut_stats.py    post-run checks (books vs LUT, per-mode stats)
      library/                   generated: books/, lookup_tables/, configs/, optimization_files/,
                                 publish_files/ (index.json, books_<mode>.jsonl.zst, lookUpTable_<mode>_0.csv),
                                 stats_summary.json
    EVENTS.md                    event schema for the frontend  (ours: design/EVENTS.md)
    samples/                     pretty JSON sample books per case (used by the frontend mock)
  frontend/                      = web-sdk monorepo trimmed to one app; SDK packages vendored in packages/
    apps/vault-breakers/src/game/{config.ts, meta.ts, bookEventHandlerMap.ts, typesBookEvent.ts, ...}
    apps/vault-breakers/src/mock/{mockRgs.ts, books/*.json}   offline mock RGS (?mock=true, &book=<name>)
    apps/vault-breakers/src/components/*.svelte              Board, ReelSymbol, FreeSpinIntro, ...
  docs/ RULES.md DESIGN.md SUBMISSION.md PROMO.md
```
Patterns worth copying (generic): a `wincap` Distribution with `force_wincap: True` in **every** mode; `run_local.py` for quick runs; `audit_books.py` hashing books vs LUT; mock RGS that serves real sample books by mode with `&book=wincap`; `sweeps_en` language file for social mode; bet levels always from the RGS `authenticate` response; rules page generated from `config.ts`/`index.json` so numbers can't drift; disclaimer text (below).

---
## 3. Phase A – math game folder
Target layout (create it):
```
math/                                  # clone of engineio/math-sdk at a pinned commit (record it in math/SDK_VERSION)
  games/dare_dorm_elves/
    game_config.py  gamestate.py  game_override.py  game_executables.py  game_calculations.py
    game_events.py  game_optimization.py  run.py  run_local.py  audit_books.py  lut_stats.py
    reels/ BR0.csv (base) BR1.csv (ante) BT_dare.csv BT_double.csv BT_triple.csv (buy-trigger spins)
           MY0.csv (mystery reveal/respins) EG0.csv (egw) FR_dare.csv FR_double.csv FR_triple.csv FR_hidden.csv
    tests/ test_rules.py test_examples.py test_events.py
  samples/                             # pretty sample books (Phase B)
```
**A0 Environment**
```bash
git clone https://github.com/engineio/math-sdk.git math && cd math && git rev-parse HEAD > SDK_VERSION
make setup && source env/bin/activate
python games/0_0_lines/run.py          # sanity: the sample builds
cp -r games/0_0_lines games/dare_dorm_elves
```
**A1 Config** (`game_config.py`): `game_id="dare_dorm_elves"`, `working_name="Dare Dorm - Elves"`, `wincap=50000.0`, `rtp=0.9667`, `num_reels=5`, `num_rows=[4]*5`, `include_padding=True`, 20 `paylines` exactly as SPEC §2 (dict 1..20 → row list), symbols `W,H1..H4,L1..L5` with `special_symbols={"wild":["W"], "multiplier":["W"]}`, paytable from SPEC §2 in the unit `0_0_lines` uses (check: if the sample pays total-bet units, divide lb by 20). 7 `BetMode`s: `base`(1.0), `ante`(1.25), `dare`, `double_dare`, `triple_dare`, `mystery`, `egw` (costs: placeholder from SPEC §10 toy range, final set in Phase B). Every mode `max_win=50000`, `rtp=0.9667`, and a `Distribution(criteria="wincap", force_wincap=True, ...)`.
**A2 Line evaluation** (`game_calculations.py`): don't rely on the SDK's default line multiplier logic. Implement SPEC §3 exactly: run detection (best of pure-wild run vs symbol run), groups (adjacent full-reel wilds multiply, others add), line multiplier = sum of groups (min 1), and the **§4.3 no-double-pay rule** (pay a line only if its run has ≥1 cell landed this step). Port `design/prototypes/reference_rules.py::evaluate/line_mult` and keep the same semantics.
**A3 Wild state:** per-cell values `sv[(reel,row)]`, full reels `full[reel]`. Stack completion sums the 4 values (instant = 4). Growth +1 per connected wild per step (full reel as one wild).
**A4 Respin loop** (`game_executables.py`): steps 0..3 per SPEC §4: replace only non-wild cells of connected paid runs (draw fresh symbols from the current reel strip at random stops for those cells; document the method), wilds lock, others stay; stop on no connection or after step 3; wincap check every step. Emit the EVENTS.md events (`winInfo`, `updateStepWin`, `wildGrow`, `stackComplete`, `mergeGroups`, `respinStart`, `respinReveal`, `respinEnd`).
**A5 Triggers + free games** (`game_override.py`, `gamestate.py`): final-board tier with precedence (SPEC §5), trigger spin pays, carry-in at end values, tiers Dare 8 / Double 10 / Triple 12 / Hidden 14, all wilds sticky, +2 per newly completed stack, max 18 spins played, no tier change. Hidden is a freegame type only.
**A6 Modes:**
- `ante`: BR1 strips, ~2× trigger rates.
- `dare`/`double_dare`/`triple_dare`: `buyTriggerStart`, then a real trigger spin on BT_* strips; redraw until the final-board tier == bought tier (A5: no forced x4/no forced reels).
- `mystery`: `mysteryStart`; bucket by **fixed** weights 50/37/10/3 (implement as 4 Distributions with quotas and lock their summed LUT weights in Phase B); reveal exactly 3 wilds with ≥1 connection; respins = reveal; no-bonus = no wild lands on respins; bonus buckets = rejection-sample until the final board matches the tier; `mysteryResult`; then the bonus.
- `egw`: `egwStart`; draw a pattern from the D9 weighted table (SPEC §7), place x4 full reels, one spin with respins, **never** a bonus.
**A7 Unit tests** (`tests/`, run with `pytest games/dare_dorm_elves/tests -q`):
- `test_examples.py`: one test per SPEC §12 example, feeding the exact boards and replacement cells (copy from `design/prototypes/worked_examples.py`) into your evaluator/respin engine and asserting the totals and end states:

| Ex | Total (x bet) | End state to assert |
|---|---|---|
| E1 | 1.25 | no respin |
| E2 | 1.50 | R3r0 = x3, 2 respins played |
| E3 | 179.10 | R3 full x13 (built as 4+4+3+1=12), singles R2r1 x5, R1r2 x3; tier = triple_dare |
| E4 | 350.10 | R1 x8, R3 x8; tier = hidden |
| E5 (step 0 only) | 2440.15 | line mult 37 |
| E6 (step 0 only) | 1262.00 | mults 24 and 26 |
| E7 | 3.40 | 3 wilds x3, no bonus |
| E8 | 92.40 | R3 full x11 (built 2+3+3+1=9), R2r2 x4; tier = double_dare |
| E9 | 374.50 | R1 x8, R3 x8, R5 x5; no bonus |
| E10 | 72.30 | R3 x17 |
| E12 | step 16758.00 → round 50000 | wincap event, round ends |
- `test_rules.py`: wild in run only (D3); stale run not re-paid; non-connected win not replaced; max 3 respins; Dare never from Mystery; EGW never triggers; spin cap 18 (incl. +2 at 17 → 18, not 19); A1/A2 group math; precedence table.
- `test_events.py`: a book's events follow EVENTS.md sequences; `finalWin.amount == payoutMultiplier`; coordinates in range.
**A acceptance:** `pytest -q` all green; `python games/dare_dorm_elves/run_local.py 2000 200 1 0` produces books for all 7 modes without errors.

---
## 4. Phase B – simulation + optimization (all 7 modes)
1. **Rough tune** reel strips/weights with small sims (e.g. 50k base, 10k per buy) using `lut_stats.py` until each mode's raw (pre-optimizer) RTP is in ~90–100% and its tail looks controllable. Levers, in order (SPEC §11): reel-2/4 wild & stack density, buy-trigger strip odds, EGW pattern weights, bonus stack odds per tier, paytable scale. **Never change a §8 rule.**
2. **Set prices (D6):** for each buy, `cost ≈ mean_win / 0.9667`, rounded to a clean number (Triple must be ≤ 1000). Record in `game_config.py`.
3. **Full run:** base 1,000,000; ante 1,000,000; dare/double_dare/triple_dare/mystery/egw 200,000 each (raise to ≤ 1M if a tail metric is noisy). Then the optimizer (`run_optimization: True`) per mode with `game_optimization.py` conditions: `wincap` (force), `0` where allowed, `basegame`, `freegame` per tier, Mystery 4 buckets.
   ```bash
   cd math && source env/bin/activate
   python games/dare_dorm_elves/run.py               # sims + optimization + analysis + format checks
   python games/dare_dorm_elves/audit_books.py        # books vs LUT payout + hash check
   python games/dare_dorm_elves/lut_stats.py          # prints the acceptance table below
   ```
4. **Acceptance – every mode must pass (print this table):**

| Check | Pass condition |
|---|---|
| RTP | **96.65% ≤ RTP ≤ 96.69%** |
| Max win | max payoutMultiplier **== 50000.00** present in the LUT with weight > 0 (C13) |
| Max-win frequency | more often than **1 in 10,000,000** (report 1 in N) |
| Tail | **P(win ≥ 5,000x) ≤ 1.0%** (raw, per round) |
| CVaR 0.1% (absolute) | ≤ **20,000** |
| Cost | **≤ 1,000x** (and base = 1.0, ante = 1.25) |
| Base std dev | ≥ 0.6 (base) |
| Hit rate | base 20–28% target; never rarer than 1 in 50 |
| Mystery buckets | LUT weight shares 50.000 / 37.000 / 10.000 / 3.000% (±0.001%) |
| EGW 4+ adjacent | ≤ 1 in 10,000 |
| Books | `finalWin == payoutMultiplier == LUT payout` for 100% of books; ≤ 10M events/mode |
| Natural triggers | report rate per tier for base and ante (ante ≈ 2× base) |
5. **If any check fails after honest tuning: STOP.** Write `math/REPORT.md` with the best achievable numbers per mode, which check fails, and which locked rule causes it, then ask the user. Do not bend a rule, change the cap, or relax a limit.
6. Write sample books (EVENTS.md "Sample books") to `math/samples/` (pretty JSON) and copy them to the frontend mock.
7. `library/publish_files/` must contain `index.json` (7 modes, names exactly as SPEC §10), `books_<mode>.jsonl.zst`, `lookUpTable_<mode>_0.csv` (`id,probability,payout`, uint64).

---
## 5. Phase C – frontend (web-sdk / PixiJS)
```bash
git clone https://github.com/engineio/web-sdk.git /tmp/web-sdk
mkdir frontend && cp -r /tmp/web-sdk/{packages,package.json,pnpm-workspace.yaml,turbo.json,pnpm-lock.yaml} frontend/
mkdir -p frontend/apps && cp -r /tmp/web-sdk/apps/lines frontend/apps/dare-dorm-elves
cd frontend && pnpm install && pnpm --filter dare-dorm-elves dev     # rename the package to "dare-dorm-elves"
```
(Vault Breakers did the same from `apps/cluster` and vendored the packages so the folder builds alone.)
Implement in `apps/dare-dorm-elves/src/`:
1. `game/config.ts`: gameID, `maxWin: 50000`, 5×4, 20 paylines, paytable, 7 bet modes with costs/RTP **generated from `math/.../publish_files/index.json` + stats** (script `scripts/sync-config.mjs`), free-spin table (8/10/12/14, +2, cap 18), Mystery odds.
2. `game/typesBookEvent.ts` + `bookEventHandlerMap.ts`: one handler per EVENTS.md event; unknown events throw in dev.
3. Board: 5×4 reels, padded reveal, anticipation; **respin animation** (flash connected cells → pop replaced cells → drop new cells; wilds show lock ring); per-step win count-up that never decreases.
4. Wilds: single wild sprite + multiplier badge; `wildGrow` tick; `stackComplete` fuse animation to the full-reel elf (WF) with sum count-up; `mergeGroups` → swap to **merged wide art WM2–WM5** with the **combined badge "x6 × x5 = x30"** and a group outline; non-adjacent stacks keep separate badges.
5. Free spins: intros per tier (Dare/Double/Triple/Hidden), counter "SPINS n/total", "+2" pop, cap 18 messaging, outro with total.
6. **Buy menu** ("Get Bonus" in social mode): 5 cards (Dare, Double Dare, Triple Dare, Mystery Spin, Elves Gone Wild) with live cost × bet, RTP and max win per mode; **confirm dialog for any mode > 2× bet**; Mystery card + dialog show "50% no bonus / 37% Double Dare / 10% Triple Dare / 3% Hidden – decided before the reveal".
7. **Ante** toggle (1.25×, no confirm), shown in the bet panel; disabled during a round.
8. **Mystery reveal:** `mysteryStart` → spin with anticipation on the partial-stack reel → each respin is a reveal beat → `mysteryResult` banner → bonus or end.
9. **EGW:** `egwStart` → placed full reels slam in → respins → result. Never shows a bonus intro.
10. Win levels / big-win banners; **MAX WIN** banner on `wincap`; `finalWin` settles.
11. **Mobile + popout:** portrait layout (reels top, controls bottom), landscape, and 400×225 popout without distortion; test merged wide wilds at all sizes.
12. **Rules/info page** generated from config: mechanics (SPEC §1–§8 in player language), paytable, per-mode cost/RTP/max win, wild multiplier formula + min/max observed values from stats (C15), Mystery odds, "All characters are adults.", and the disclaimer:
    > Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Engine.
13. **Social mode:** `sweeps_en` strings (no "bet/buy/pay/bonus buy"; use "play", "Get Bonus", "wins", "respin"); test with `?social=true` and currencies XSC/XGC (no "$").
14. **RGS:** keep the SDK's `authenticate` / `play` / `end-round` / replay flow; bet levels from `authenticate`; resume an active round on reload.
15. **Mock + replay testing:** `src/mock/mockRgs.ts` + `src/mock/books/*.json` (Phase B samples); `?mock=true&book=<name>` forces a book (e.g. `mystery_none`, `egw_adjacent`, `base_wincap`); `?replay=true&...` plays a replay. Add Playwright smoke tests: load, spin each mode once via mock, wincap book reaches MAX WIN, mobile viewport screenshot.
16. Art: placeholders from `assets/concepts/` until production art (ART_BIBLE) is delivered; keep asset keys stable (`H1..H4, L1..L5, W, WF, WM2..WM5, badge_*`).
**C acceptance:** `pnpm build` succeeds (static site in `apps/dare-dorm-elves/build`), lint clean, every sample book plays end-to-end in the mock with the win meter equal to `finalWin`, social-mode scan finds no restricted words (`grep -riE "\b(bet|buy|pay|pays|paid|wager|cash|money)\b"` on the sweeps strings and rendered UI text), mobile/popout screenshots OK.

---
## 6. Phase D – Stake Engine upload checklist
- [ ] Math: upload the folder `math/games/dare_dorm_elves/library/publish_files/` (index.json + 7 × books `.jsonl.zst` + 7 × `lookUpTable_<mode>_0.csv`). Mode names identical in math, frontend and replay.
- [ ] Frontend: upload `frontend/apps/dare-dorm-elves/build/` (static; served at `https://{team}.cdn.stakeengine.org/{gameID}/{version}/index.html`; never hard-code `rgs_url`).
- [ ] COMPLIANCE.md items: C1 stateless; C2 7 modes; C4 RTP 96.65–96.69; C5 base 1.0 & std ≥ 0.6; C6 50,000x; C7 realism; C8 cost ≤ 1000x; C9 P(≥5k) ≤ 1%; C10 CVaR ≤ 20k; C11 hit rate; C12 books/LUT match; C13 max win real per mode; C14 costs described; C15 multiplier values listed; C16 feature access/retriggers described; C17 meter only counts up; C18 confirm > 2×; C20 Mystery odds match LUT; C21 Mystery wording; C24–C27 art per CONTENT_RULES; C29 EGW name risk accepted by user; C31 unique assets & popout; C32 RTP/max win per mode in rules; C33 disclaimer; C34 social wording; C35 social currencies/sub-cent.
- [ ] Test in the Studio play modal: every mode, social mode toggle, replay links, mobile.
- [ ] Submission blurb (theme + mechanics), description tag, "All characters are adults."
- [ ] Optional: ask Engine Support for a content pre-check (concept sheet) and confirm the Mystery mode.
- [ ] After approval no math/mode/mechanic changes are allowed (C23): freeze everything first.

---
## 7. Repo hygiene
- `.gitignore`: `math/env/`, `math/games/*/library/books*`, `library/lookup_tables`, `library/optimization_files`, `*.jsonl.zst` (keep `publish_files/index.json` and `stats_summary.json`), `frontend/node_modules`, `build/`.
- Upload artifacts via the Stake dashboard, not git.

---
## 8. Rules you must not change without asking the user (locked)
1. 5×4 grid, **20 lines** (SPEC §2), left to right, 3+.
2. Wild connects only **inside the winning run** (D3).
3. Wild starts **x1**; **+1 per respin step it connects, everywhere** (R1/R6). Full-reel wild = **sum of its 4 values**; instant stack = **x4**; grows +1 as one wild (A4/A5).
4. **Adjacent full-reel wilds multiply (3+ all multiply), non-adjacent add; mixed = multiply within groups then add** (A1/A2). No global multiplier.
5. Respins: **replace non-wild symbols of connected runs, wilds lock, others stay; max 3; stop when nothing new connects; every step pays** (R2/R3/R5); everywhere incl. Mystery and EGW (R4); respins don't use free spins.
6. Triggers & precedence **Hidden > Triple > Double > Dare**; trigger spin pays (D4).
7. Bonuses **8/10/12/14** spins, **+2 per newly completed stack, cap 18**, no tier upgrades (D8); tiers differ only by start stacks/wilds, spins and stack odds (A3).
8. Bought bonuses play a **real trigger spin**: no forced x4, no forced reels (A5).
9. Mystery odds **50/37/10/3**; the respins are the reveal; no new wilds = no bonus (R4-Mystery).
10. EGW = **one paid spin, 2–5 placed stacks, never a bonus**; 4+ adjacent ≤ 1/10,000 (D9).
11. **Ante 1.25x** ≈ 2× triggers (D5). **7 bet modes**; Hidden not buyable (D7). Prices set by the optimizer (D6).
12. RTP **96.65–96.69%** every mode; **max win 50,000x** (round ends at the cap); 2-Star limits (cost ≤ 1000x, P(≥5k) ≤ 1%).
13. Theme/art ceiling per CONTENT_RULES.md; **all characters clearly adult**; name "Elves Gone Wild" stays.
14. Paytable **ratios** (scale may tune); symbol roles (4 elves premium, objects low).
15. **Art direction: "These are sexy college elves. Not strippers."** Casual flirty college wear (crop tops, cutoffs, varsity jerseys/hoodies off the shoulder, Greek-letter tees, tied flannel, pajama sets, bikini under an open hoodie, knee socks, scrunchies, messy buns), natural playful makeup, early-20s clearly adult women (never childlike), dorm props (string lights, posters, red cups, bunk bed). Sexy through fit and pose, **no club/stripper glam** (no sequins, latex, stripper heels, pole/club staging). Merged wilds escalate in college wear: 2-wide hoodie → 3-wide crop top + shorts → 4-wide sleepshirt → 5-wide towel after a shower → covering pose (full-reel/finale). See assets/ART_BIBLE.md.

## 9. Definition of done
| # | Item | Evidence |
|---|---|---|
| 1 | All Phase A tests pass incl. every SPEC §12 example | `pytest -q` output |
| 2 | 7 modes pass every Phase B check | `lut_stats.py` table (RTP, max win, 1-in-N, P(≥5k), CVaR, cost, std, hit rate) |
| 3 | Books ↔ LUT ↔ finalWin match 100% | `audit_books.py` |
| 4 | Mystery buckets exact; EGW adjacency ≤ 1/10k; Ante ≈ 2× triggers | stats |
| 5 | `publish_files/` complete | file list |
| 6 | Frontend builds; every sample book plays in mock; replay works | `pnpm build`, Playwright run |
| 7 | Buy menu + confirm > 2×, Ante toggle, Mystery reveal, EGW, merged wide wilds + combined badge, wincap banner | screenshots/video |
| 8 | Mobile portrait/landscape + 400×225 popout OK | screenshots |
| 9 | Rules page complete with per-mode RTP/max win, multiplier formula and ranges, disclaimer "TM and © 2026 Engine." | screenshot |
| 10 | Social mode clean (no restricted words; XSC/XGC) | scan output |
| 11 | Art passes CONTENT_RULES §4 checklist | checklist |
| 12 | `math/REPORT.md` with final costs and all numbers; no locked rule changed | file |
