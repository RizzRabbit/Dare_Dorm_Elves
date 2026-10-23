# Dare Dorm – Elves: final mechanics SPEC (v2)
Studio: **Rizzin Games**. Platform: **Stake Engine** (math-sdk + web-sdk).
Status: **FINAL for build.** Written 2026-10-23 CDT. It merges Slot Expert's v1 spec (`design/source/SPEC_v1_slot_expert.md`) with every user answer in `design/DECISIONS.md`. **Where they differ, DECISIONS.md wins.** The old §13 "Decisions for the user" is gone; the answers are in the **Locked decisions log (§0)**.

Tags: **[LOCKED]** = the user decided; the build agent must not change it. **[DEFAULT]** = a design default the build may tune within the stated bounds. **[ASSUMED – user to confirm]** = a reasonable reading still to confirm. **(tune)** = a placeholder number the math-sdk optimizer sets; it is not a promise.

The executable reference for §3–§4 is `design/prototypes/reference_rules.py`; every number in §12 comes from `design/prototypes/worked_examples.py` (output in `worked_examples_output.txt`).

---
## 0. Locked decisions log
| ID | Decision (user, 2026-10-22/23) |
|---|---|
| Frame | 5 reels × 4 rows, paid on **lines**, high volatility. Max win **50,000x** the base bet. RTP target **96.65–96.69% in every bet mode** (Stake ceiling is 96.70%, C-b). |
| D1 | **20 fixed lines** (§2). |
| D2 | All 4 premium symbols are **4 different sexy adult elf women**. The single-cell wild is **two sexy elves holding each other, posing**. Party objects become the low tier (proposal in §2). |
| D3 | A wild **connects** when it is **inside the winning run** of a paying line. |
| D4 | Trigger precedence **Hidden > Triple > Double > Dare**. The trigger spin **pays its own line wins**. |
| D5 | **Ante costs 1.25x** for about **2x** natural trigger rates. |
| D6 | **The optimizer sets all buy prices** at target RTP. |
| D7 | **Hidden is a freegame type**, reachable from base, Ante and Mystery only. **7 bet modes** (also settles C-a). |
| D8 | A new stack in a bonus gives **+2 spins only**. No tier upgrades, no retrigger into another tier. |
| D9 | EGW stack placement is **weighted**: patterns with **4+ adjacent stacks ≤ 1 in 10,000** buys; mostly non-adjacent pairs and triples. |
| R1 | A new wild starts at **x1**. |
| R2 | At most **3 respins** per spin; **stop early when nothing new connects**. |
| R3 | On a connection, the **non-wild symbols inside the connected winning run(s) are replaced** (respun). **Wilds lock in place.** Symbols not in any connection **stay put**; if a stayed symbol joins a later connection, it is replaced then. |
| R4 | Respins run **everywhere**: base, Ante, every bonus spin, EGW **and the Mystery spin**. Respins never use up a free spin. |
| R4-Mystery | On the Mystery spin, the respins **are** the reveal: **no more wilds land = no bonus; more wilds land = the bonus triggers**. Tier odds stay **50/37/10/3**. |
| R5 | **Every win pays at the respin step where it lands** (settled by R3). |
| R6 | Wild growth is **+1 per respin step in which the wild connects, everywhere** (base, Ante, bonuses, EGW, Mystery). The math controls the tail with reel and stack odds and must report if the limits can't hold. |
| A1 | **3 or more adjacent full-reel wilds all multiply together.** |
| A2 | Mixed line: **multiply within each adjacent group, then add the groups and the other wilds.** |
| A3 | Bonus tiers differ **only** by starting stacks/wilds, spin count and stack odds. No other per-tier levers. |
| A4 | A full-reel wild grows **+1 per connection** (as one wild). |
| A5 | A stack that **lands complete at once is x4** (four x1 wilds). A stack **built over respins is the sum of its grown values**. **Bought bonuses play a real trigger spin with respins**: no forced x4, no forced reels 1/3/5. Adjacency on buy triggers is controlled by reel/stack odds. |
| A6 | Adjacent merged stacks render as **one wide wild with new art per width (2/3/4/5 wide), each a progressively sexier elf**, with a **combined badge** (e.g. "x6 × x5 = x30"). |
| C-a/C-b | 7 bet modes; 96.65–96.69% target. |
| C-c | Keep the name **"Elves Gone Wild"** (user's call; trademark risk noted in CONTENT_RULES.md). |
| Art | **"Sexy college elves, not strippers"** (2026-10-23): casual flirty college wear, natural makeup, early-20s clearly adult, dorm props; merged wilds escalate hoodie → crop top + shorts → sleepshirt → towel → covering pose. See ART_BIBLE.md. |
| C-d | Art level follows the **Rack City Baddies (Donut Games, Stake Engine)** precedent; see `design/CONTENT_RULES.md`. |
| Disclaimer | Rules end with "… TM and © 2026 Engine." (same pattern as Vault Breakers). |

## 1. Game at a glance
- 5×4 grid, 20 lines, left to right from reel 1, 3+ of a kind on consecutive reels. Best win per line only.
- One special symbol: the **Elf Wild (W)**. No scatter. Bonuses trigger from wild counts and full-reel stacks.
- Every wild carries its own multiplier: starts x1, **+1 every respin step it connects**. Four wilds filling a reel merge into a **full-reel wild** worth the **sum** of the four. Adjacent full-reel wilds **multiply**; non-adjacent ones **add**.
- **Respins**: after any win that runs through a wild, the non-wild symbols of those runs are replaced, wilds stay locked; up to 3 respins; every step pays.
- Bonuses: **Dare 8 / Double Dare 10 / Triple Dare 12 / Hidden 14** free spins, +2 per newly completed stack, max **18** spins played.
- Buys: Dare, Double Dare, Triple Dare, **Mystery Spin** (50/37/10/3), **Elves Gone Wild** (one supercharged paid spin). Plus **Ante** (1.25x).

## 2. Grid, lines, symbols, paytable
Row 0 is the top row; reels R1–R5 left to right (0-based reel 0–4 in code).
```
L1 [0,0,0,0,0]  L2 [1,1,1,1,1]  L3 [2,2,2,2,2]  L4 [3,3,3,3,3]  L5 [0,1,2,1,0]
L6 [3,2,1,2,3]  L7 [1,0,0,0,1]  L8 [2,3,3,3,2]  L9 [0,1,0,1,0]  L10 [3,2,3,2,3]
L11 [1,2,1,2,1] L12 [2,1,2,1,2] L13 [0,0,1,0,0] L14 [3,3,2,3,3] L15 [1,1,0,1,1]
L16 [2,2,3,2,2] L17 [0,1,1,1,0] L18 [3,2,2,2,3] L19 [1,2,3,2,1] L20 [2,1,0,1,2]
```
Pays are in **line-bet units (lb)**; total bet = 20 lb, so `x bet = lb / 20`. Relative shape is [DEFAULT]; the absolute scale is (tune) but **keep the ratios** unless the math cannot hit the limits (then report).

| Tier | id | Symbol (art) [D2 proposal] | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Wild | W | Two college elves hugging, posing for a selfie (single cell); pays only on a pure-wild run | 25 | 100 | 500 |
| Premium 1 | H1 | **Elf "Roxy"** – platinum/pink ponytail, off-shoulder hoodie, crop tank, cutoffs, red cup | 25 | 100 | 500 |
| Premium 2 | H2 | **Elf "Jade"** – teal hair, oversized varsity jersey off one shoulder, knee socks | 20 | 75 | 300 |
| Premium 3 | H3 | **Elf "Vi"** – violet bob, tied-up flannel over a crop top, cutoffs, blowing a kiss | 15 | 50 | 200 |
| Premium 4 | H4 | **Elf "Coco"** – auburn messy bun, pajama-party shorts set, paper party crown | 10 | 40 | 150 |
| Low 1 | L1 | **DARE bottle** (unbranded neon bottle) | 5 | 20 | 80 |
| Low 2 | L2 | **Lips** (glossy pink kiss) | 5 | 15 | 60 |
| Low 3 | L3 | **"GOOD VIBES" neon sign** | 4 | 10 | 40 |
| Low 4 | L4 | **Red party cup** | 3 | 8 | 30 |
| Low 5 | L5 | **Cannabis leaf** (lowest; flagged, safe swap = **gaming controller**, art only, math unchanged) | 3 | 8 | 30 |

- **D2 proposal [ASSUMED – user to confirm]:** keep 5 lows = bottle, lips, GOOD VIBES neon, red cup, leaf (leaf lowest). Dropped to keep the reels readable: lingerie (now worn by the elves), crown (moved onto elf H4), phone-with-heart, pizza. Swap any of them back in 1:1 with zero math change.
- The wild substitutes for all symbols. A line pays the **larger** of the pure-wild run and the first-non-wild-symbol run (math-sdk `LinesWins` convention).
- Max board before multipliers: 20 × 500 lb / 20 = **500x**.
- SDK units: enter `config.paytable` in the unit the math-sdk lines sample (`games/0_0_lines`) uses. If it pays in total-bet units, divide these lb values by 20. Verify against the sample before coding (BUILD_PROMPT A2).

## 3. Wilds, connections, multipliers [LOCKED]
- **Connection (D3):** a wild connects in a step when it sits **inside the winning run** of a line that **pays in that step** (§4.3).
- **Value (R1/R6):** a new wild = **x1**. After each step's evaluation, every wild that connected in that step gains **+1** (once per step, however many lines it is on).
- **Full-reel wild (A4/A5):** when all 4 cells of a reel are wild, the reel becomes one full-reel wild worth the **sum** of the 4 cell values at that moment. A stack that lands complete in one go = 1+1+1+1 = **x4**. A stack built over respins keeps its grown values (e.g. 4+4+3+1 = x12, E3). From then on it grows +1 per step it connects, as one wild.
- **Line multiplier (A1/A2):** split the winning run into groups:
  - each maximal run of **adjacent full-reel wilds** is one group worth the **product** of their values;
  - every other wild in the run (a single-cell wild, or an isolated full-reel wild) is its own group worth its value;
  - **line multiplier = sum of the groups**, or x1 if the run contains no wild.
  - e.g. R1 x6, R2 x5, R4 x7 → (6×5) + 7 = **x37** (E5). R1 x2, R2 x3, R3 x4 + single x2 on R4 → 24 + 2 = **x26** (E6).
- **Line win** = pay (lb) × line multiplier. **Step win** = sum of line wins paid in that step.
- **No global multiplier** exists anywhere.
- Wild values **reset after every base/Ante/EGW/Mystery spin** unless they carry into a bonus that spin triggered.
- **Merged display (A6):** adjacent full-reel wilds render as one wide elf wild (2/3/4/5 wide art, escalating hoodie → crop top + shorts → sleepshirt → towel) with a combined badge "x6 × x5 = x30".

## 4. Respins [LOCKED]
1. **Step 0** = the spin itself. Land the cells, complete stacks (§3), evaluate (4.3), pay, grow.
2. If at least one paid line in this step **contains a wild** (a "connected run"), a respin follows. Otherwise the sequence ends.
3. **Pay rule (R5) and no-double-pay:** in every step, a line pays if its winning run contains **at least one cell that landed in this step** (step 0: every cell). A run made only of cells unchanged since the previous step was already paid and **does not pay again**. This is how "each win pays at the step it lands" is implemented.
4. **Replace (R3):** before the next step, every **non-wild cell inside a connected run paid in this step** is replaced with a fresh draw from the current reel set. **All wilds stay locked** (single and full-reel). Non-wild cells **not** in a connected run **stay put** (including cells of wins without a wild; those pay once and are not replaced).
5. In the new step, land the replacement cells (a replacement can be a wild, which starts x1), complete stacks, evaluate with 4.3, pay, grow.
6. **Stop (R2):** after the step where no paid line contains a wild, or after **respin 3** (step 3), whichever comes first.
7. **Where (R4):** base, Ante, every free spin, EGW and the Mystery spin. Respins never use a free spin.
8. Wilds landed on respins **count toward triggers** (checked on the final board) and toward new stacks (+2 spins in bonuses).
9. **Win cap check** after every step (§9).

> Note for the math build: `design/prototypes/toy_sim4.py` (the last toy) re-pays unchanged lines every step, which overstates RTP. Use rule 4.3 (as in `reference_rules.py`).

## 5. Base game and Ante
- Trigger check on the **final board** of the spin's sequence, precedence **D4**:

| Priority | Final-board condition | Award |
|---|---|---|
| 1 | ≥ 2 full-reel wilds | **Hidden**, 14 FS |
| 2 | 1 full-reel wild + ≥ 2 other wilds | **Triple Dare**, 12 FS |
| 3 | 1 full-reel wild + ≤ 1 other wild | **Double Dare**, 10 FS |
| 4 | ≥ 4 single wilds, no full-reel wild | **Dare**, 8 FS |

- The trigger spin **pays its own wins** (all steps), then the bonus plays inside the same book.
- **Carry-in [LOCKED by A5]:** every wild on the trigger's final board carries in at its **end-of-sequence value**: full-reel wilds stay locked, single wilds stay sticky. (Instant stack = x4 before growth; respin-built = grown sum.)
- **Ante (D5):** cost **1.25x**, same paytable and rules; reel strips weighted so natural trigger rates are about **2x** base for all four tiers (tune). Mode name `ante`.
- Base hit rate target ~20–28% (C11).

## 6. Bonus tiers [LOCKED except odds]
| Tier | Start spins | Start stacks / wilds | Stack-completion odds (tune) |
|---|---|---|---|
| Dare | 8 | ≥ 4 sticky single wilds (from trigger) | lowest |
| Double Dare | 10 | 1 locked full-reel wild (+ ≤ 1 sticky single) | low |
| Triple Dare | 12 | 1 locked full-reel wild + ≥ 2 sticky singles | medium |
| Hidden | 14 | ≥ 2 locked full-reel wilds (+ any sticky singles) | medium |

- **A3:** these are the only differences. Every other rule is identical across tiers.
- **Stickiness [ASSUMED – user to confirm]:** in **every** tier, all wilds (carried-in and newly landed) stay for the rest of the round with their values; full-reel wilds lock. Dare's sticky wilds were locked by the user; A3 (no per-tier levers) extends that to all tiers. This matches `toy_sim4.py`.
- **Spins:** each **newly completed** stack (in any step of any free spin) adds **+2 spins** (D8). A locked stack never re-awards. The round plays at most **18 free spins** (cap counts spins played, not respins). Once at 18, further stacks still lock and multiply but add no spins.
- No upgrades between tiers, no other retriggers (D8).
- Each free spin: load locked and sticky wilds → land the other cells → full respin sequence (§4) with growth → add the spin's wins → +2 per new stack (capped) → wincap check.
- **Bought bonuses (A5):** the book starts with a **real trigger spin** on dedicated buy-trigger reel strips, with respins and growth, paying its wins. The math redraws (rejection) until the final board's tier **equals the bought tier**. Its stacks may be instant (x4) or respin-built (grown sums), on **any** reels. No forced x4, no forced reels 1/3/5. Adjacency at the start is controlled by the buy-trigger strip odds (tune). Then the bonus plays from that board.

## 7. EGW – Elves Gone Wild (single-spin buy) [LOCKED]
- One paid spin, **no bonus ever** (even with 2+ stacks or 4+ wilds on the final board).
- Before the cells land, **2–5 full-reel wilds** are placed from a **weighted pattern table** (D9). Placed stacks are instant: **x4** each.
- Respins and growth run exactly as §4. Extra stacks can complete during respins and follow §3.
- **D9 weights:** patterns with **4+ adjacent stacks** ({1,2,3,4}, {2,3,4,5}, {1..5}) total **≤ 1 in 10,000** buys. Mostly non-adjacent pairs/triples. Starting table (from `toy_sim4.py`, tune):

| Pattern (reels) | weight | | Pattern | weight |
|---|---|---|---|---|
| 1,3 | 30 | | 1,2 / 4,5 | 4 each |
| 1,4 / 2,4 | 15 each | | 1,2,4 | 1.5 |
| 1,5 / 2,5 | 10 each | | 2,3 / 3,4 | 1 each |
| 1,3,5 | 12 | | 2,3,4 | 0.12 |
| 1,2,3 | 0.08 | | 1,2,4,5 | 0.04 |
| 2,3,4,5 | 0.005 | | 1,2,3,4 | 0.003 |
| 1,2,3,4,5 | 0.002 | | | |

- Price: optimizer (D6), toy range 150–250x (pre-R6; see §11).

## 8. Mystery Spin (buy) [LOCKED]
1. The outcome bucket is drawn with weights fixed at exactly **50 / 37 / 10 / 3** (no bonus / Double Dare / Triple Dare / Hidden). The optimizer may reshape weights **within** a bucket only (C20). CI check: bucket weight drift ≤ 0.001%.
2. **Reveal spin:** lands **exactly 3 wilds** with **at least one connected win**, so respins always run. [DEFAULT] the 3 wilds sit as a 3-high partial stack on one reel (the tease art); if stack completion through respins proves too rare to generate, the build may scatter them and must report it.
3. **The respins are the reveal (R4-Mystery):**
   - **No bonus:** no wild lands on any respin. The final board has exactly 3 wilds and no stack, so a Dare is never implied. All steps pay. The round ends.
   - **Double Dare / Triple Dare / Hidden:** wilds land on respins and the final board meets that tier's condition (§5 table). Stacks follow A5 (sum of grown values). Then the bonus plays (§6) in the same book.
   - Dare is never a Mystery outcome.
4. Generation: per bucket, rejection-sample reveal + respin sequences on Mystery strips until the final board matches the bucket.
5. The rules and buy dialog state: "Each Mystery Spin is a paid spin with respins. Bonus odds: no bonus 50%, Double Dare 37%, Triple Dare 10%, Hidden 3%. The result is decided before the reveal."
6. Price: optimizer (D6). Toy ~245x (pre-R6).

## 9. Order of resolution (one spin)
1. Load locked/sticky wilds (bonus) or placed stacks (EGW). 2. Land cells. 3. Complete stacks (sum values). 4. Evaluate lines (§3 groups) with the §4.3 pay rule. 5. Add the step win to the round total. 6. **If the round total ≥ 50,000x: set it to exactly 50,000x, emit `wincap`, end the round** (no more steps, spins or bonus). 7. Grow connected wilds +1. 8. Respin decision (§4.2/4.6); if yes, replace cells and go to 2. 9. Bonus spins: +2 per newly completed stack, capped at 18. 10. Base/Ante/Mystery: check the trigger (§5 / §8) and play the bonus in the same book. EGW: never.

## 10. Bet modes (math-sdk) [LOCKED list, prices tune]
| Mode (`index.json` name) | Player label | Cost | Toy range (pre-R6) | Notes |
|---|---|---|---|---|
| `base` | Spin | 1.0 | – | std ≥ 0.6 |
| `ante` | Ante | 1.25 | – | no confirm needed (≤ 2x) |
| `dare` | Dare | optimizer | 25–50x | buy-trigger spin then Dare |
| `double_dare` | Double Dare | optimizer | 180–240x | |
| `triple_dare` | Triple Dare | optimizer | ~1,000x | **must be ≤ 1,000x** (2-Star) |
| `mystery` | Mystery Spin | optimizer | ~245x | 50/37/10/3 |
| `egw` | Elves Gone Wild | optimizer | 150–250x | one spin |

- **Hidden is a freegame type, not a mode (D7).**
- **Price method (D6):** simulate the mode, measure the mean win, set `cost ≈ mean / 0.9667` rounded to a clean value, then let the optimizer reshape weights to land RTP in **96.65–96.69%**. Report the final costs.
- **Limits in every mode (2-Star, C6–C13):** RTP 96.65–96.69%; `max_win = 50000`; a `wincap` Distribution with `force_wincap: True` so 50,000x books **exist in every mode** (C13); P(win ≥ 5,000x) ≤ **1%** (raw, per round); mode cost ≤ **1,000x**; CVaR(0.1%) ≤ **20,000**; base std ≥ 0.6; hit rate no rarer than 1 in 50; max win realistically reachable (more often than ~1 in 10M); ≤ 20 modes; ≤ 10M events per mode.

## 11. Tail control and the R6 risk note
- **R6 risk:** growth **every step everywhere** plus pay-at-every-step fattens the tail. Two non-adjacent instant stacks (R1+R3) guarantee a pay on every respin, because any replaced R2 symbol completes a 3-of-a-kind: E4 is 350x on one base spin (it was 62x under the old pay-once rule); E9 (EGW R1/R3/R5) is 374x. Adjacent groups multiply grown values, so 3 adjacent at x5 each = x125.
- **The math controls it with odds, not rule changes:** (1) instant-stack and single-wild densities per reel, especially **reels 2 and 4** (every adjacent pair includes one of them); (2) buy-trigger strip odds; (3) EGW pattern weights (D9); (4) bonus stack odds per tier (A3); (5) the 18-spin cap; (6) the paytable scale. **The build agent must not change a locked rule to make the numbers work. If the limits in §10 cannot all hold, stop and report the best achievable figures per mode.**
- 50,000x is reached mainly through adjacent groups (4 adjacent ≈ always; 3 adjacent with growth). Toy figures from v1 (`toy_sim3.py`) predate R3/R5/R6 and are indicative only.

## 12. Worked examples (all recomputed by `prototypes/worked_examples.py`)
Rows top to bottom; R1..R5 left to right. `RnrK` = reel n, row K. Full step-by-step traces are in `prototypes/worked_examples_output.txt`. "AUTO" filler symbols in the script are illustrative replacement draws.

**E1 – base line win, no wild.**
```
H1 H1 H1 L2 L3
L4 H2 L1 H3 L5
L1 L3 H4 L4 L2
H3 L5 L2 L1 H4
```
L1 3×H1 = 25 lb × 1. **Win 1.25x.** No wild connected → no respin. (Ante: same board, same 1.25x win at 1.25x cost.)

**E2 – base respin (R3/R5/R6).**
```
H2 H2 W  L1 L3
L4 H3 L5 H3 L5
L1 L3 H4 L4 L2
H3 L5 L2 L1 H4
```
- Step 0: L1 `H2 H2 W` = 20 lb × x1 = 20 lb (1.0x). R3r0 grows to x2. Cells R1r0, R2r0 (the H2s) are replaced; everything else stays.
- Respin 1: they land L2, L2 → L1 `L2 L2 W` = 5 lb × x2 = 10 lb (0.5x). Wild → x3. R1r0, R2r0 replaced again.
- Respin 2: they land H4, L1 → nothing connects → stop.
- **Total 1.5x** (1.0 + 0.5, each paid at its own step).

**E3 – respins build a stack from grown wilds → Triple Dare.**
```
H2 H2 W  L1 L3
L4 W  W  L2 L5
L2 L3 L2 L4 L2
H3 L5 L3 L1 H4
```
- Step 0 pays 15.6x (8 lines incl. L12/L20 5×L2). R2r1, R3r0, R3r1 → x2.
- Respin 1: R3r2 lands W (x1); pays 14.95x; growth → R2r1 x3, R3r0 x3, R3r1 x3, R3r2 x2.
- Respin 2: R1r2 lands W; pays 38.85x; growth → x4, x4, x4, x3, R1r2 x2.
- Respin 3: R3r3 lands W → **R3 full-reel wild = 4 + 4 + 3 + 1 = x12** (not x4: built over respins, A5). Pays 109.7x (e.g. L12 5×L4 × (12 + 4 + 2) = x18). Growth → R3 x13, R2r1 x5, R1r2 x3.
- **Spin total 179.1x.** Final board: 1 full-reel wild + 2 other wilds → **Triple Dare** (12 FS), R3 locked at **x13**, singles sticky at x5 and x3.

**E4 – instant stacks, non-adjacent add, Hidden by precedence.**
```
W L2 W L4 H2
W H3 W L1 L3
W L4 W H3 L5
W L1 W L2 L4
```
- R1 and R3 land complete → **x4 each** (instant). Every line pays 3-of-a-kind of its R2 symbol × (4 + 4) = x8 → 62.4x.
- Every step replaces all of R2 (always connected), and each new R2 symbol pays again at the grown values (x10, x12, x14). **Total 350.1x**; stacks end at x8 each.
- Final board meets Hidden and Triple → **Hidden** wins on precedence (14 FS).

**E5 – mixed groups (first evaluation only).** R1 x6 and R2 x5 adjacent (×) and R4 x7 isolated (+).
```
W W H2 W L3
W W L1 W H2
W W L4 W L4
W W H3 W L1
```
Line multiplier **(6 × 5) + 7 = x37**. L7 `W W H2 W H2` = 5×H2 300 lb × 37 = 11,100 lb. Step 0 total 48,803 lb = **2,440.15x** (respins then continue on R3/R5).

**E6 – three adjacent all multiply (A1) plus a single (A2), first evaluation only.** R1 x2, R2 x3, R3 x4, single W x2 at R4r0.
```
W W W W  L3
W W W L1 H2
W W W L4 L4
W W W H3 L1
```
Group R1–R3 = 2 × 3 × 4 = x24. Lines through R4r0 add the single: x26 (L1 4×W 100 lb × 26 = 2,600 lb; L7 5×H2 300 × 26 = 7,800 lb). Step 0 total **1,262x**.

**E7 – Mystery Spin, bucket "no bonus" (respins are the reveal).**
```
L2 H4 W  L3 L1
H4 H4 W  L1 L5
L1 L3 W  H2 L4
L3 L5 L2 L4 H1
```
- Reveal: 3 wilds on R3r0–r2 (tease); 1.9x (L2/L7/L15 3×H4, L6/L18 3×L3). Wilds → x2.
- Respin 1: no wild lands; L5/L9/L17 3×L2 × x2 = 1.5x. Wilds → x3.
- Respin 2: no wild lands, nothing connects → stop. Exactly 3 wilds, no stack → **no bonus. Total 3.4x. Round ends.**

**E8 – Mystery Spin, bucket "Double Dare".**
```
L2 H4 W  L3 L1
H4 H4 W  L1 L5
H2 H2 W  H2 L4
L3 L5 L3 L4 H1
```
- Reveal pays 5.25x. Wilds → x2.
- Respin 1: **R2r2 lands W**; L10 `L3 W L3` now connects R3r3. Pays 4.1x.
- Respin 2: **R3r3 lands W → R3 = 2 + 3 + 3 + 1 = x9**. Pays 47.3x (x11 lines = 9 + single 2). R3 → x10.
- Respin 3: pays 35.75x. R3 → x11, R2r2 → x4.
- **Total 92.4x.** Final board: 1 full-reel + 1 other wild → **Double Dare** with R3 locked x11 and R2r2 sticky x4.

**E9 – EGW, pattern R1/R3/R5 (x4 each, instant).**
```
W L2 W H4 W
W H1 W L2 W
W L4 W H1 W
W L3 W L5 W
```
Step 0: every line 3-of-a-kind of its R2 symbol × (4 + 4) = 89.2x (R5 adds only on 5-of-a-kind runs). R2 is replaced each respin and pays again at grown values. **Total 374.5x.** No bonus.

**E10 – Double Dare free spin, locked stack grows per step.** R3 carried in at x13.
```
H3 H3 W  H1 L1
L1 L2 W  L5 L4
H2 L4 W  L3 L3
L4 H3 W  H3 L2
```
Step 0: L1/L13 3×H3, L6/L10/L18 3×L4 = 39 lb × 13 = 25.35x. Respins pay at x14, x15, x16. **Spin total 72.3x**; R3 ends at x17. No new stack → spin count unchanged.

**E11 – bonus spin count.** Dare starts at 8. Free spin 3 completes a stack (+2 → 10). Free spin 6 completes two stacks in one sequence (+4 → 14). Hidden starting at 14 + 2 new stacks = 18; a third new stack locks and multiplies but adds nothing (cap 18).

**E12 – 50,000x round end (Hidden).** Round total before this free spin: 36,000x. R2 x8 × R3 x7 × R4 x9 = **x504**.
```
L5 W W W L2
H1 W W W L3
L3 W W W H1
L2 W W W L4
```
Step 0: every line 4-of-a-kind of its R1 symbol × 504 = 335,160 lb = 16,758x. 36,000 + 16,758 ≥ 50,000 → **pay exactly 50,000x, emit `wincap`, end the round**; no respins, the remaining spins are forfeited.

## 13. What changed from v1 (contradictions resolved)
| v1 text | Now | Source |
|---|---|---|
| §4 R3: winners are **held**, the rest respins | Winners' non-wild cells are **replaced**; the rest **stays** | R3 |
| §4 R5: pay **once** at the end on the final board (E2 paid 35x once) | **Every step pays** with no double pay (§4.3); E2 rebuilt | R5/R3 |
| §3 growth once per spin sequence in bonuses/EGW | **+1 per step everywhere** | R6 |
| §4/§8: **no respins** on the Mystery reveal; 4th-cell slow spin decides | Mystery **respins are the reveal** | R4-Mystery |
| §6 bought stacks **x4 on reels {1,3,5}** | Bought bonuses play a **real trigger spin**; no forced x4/reels | A5 |
| §6 per-tier levers (Dare sticky only, reels 2/4 at 1/10 except Hidden) | Tiers differ only by start stacks/wilds, spins, stack odds; all wilds sticky [ASSUMED] | A3 |
| §2 H1 bottle / H2 lips / H3 lingerie / H4 crown | Premiums = 4 elves; objects are lows | D2 |
| §12 E7 62.4x, E9 89.2x | 350.1x / 374.5x (respins now pay) | R5/R6 |
| Toy sim pays unchanged lines each step | §4.3 no-double-pay rule | R5 |
