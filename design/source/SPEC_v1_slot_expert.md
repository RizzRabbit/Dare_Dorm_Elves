# Dare Dorm – Elves: mechanics SPEC (P1.1)
Owner: Slot Expert. Status: DRAFT for user sign-off. Written 2026-10-22, 21:4x CDT.

This file is the single source of truth for every mechanic. It follows the user's locked plan in `PHASE1_BRIEF.md`, including the decision sections from 21:22, 21:25, 21:31 and 21:33 CDT. Where those sections conflict, the latest one wins: **21:33 overrides all earlier multiplier wording. There is no global multiplier.** Anything not locked is marked **[DEFAULT]** and listed in "Decisions for the user" (section 13).

Any number tagged **(to tune in math-SDK sim)** is a placeholder for the optimizer. It is not a promised RTP or frequency. The toy Monte Carlo results quoted in section 11 come from `toy_sim.py`, `toy_sim3.py`, `egw_check.py` and `examples_check.py` in this folder. They show how sensitive the design is to each lever, and they are not the math model.

---
## 1. Locked frame (from the user's plan; do not change)
- 5 reels × 4 rows, paid on **lines** (21:22). High volatility.
- Target RTP: 96.7% independently in every mode (see COMPLIANCE.md C4: the Engine band is 96.0–96.7%, so 96.7 is the top edge).
- Max win: **50,000x** the base bet. When the round total reaches 50,000x, the round **ends immediately and pays exactly 50,000x**.
- Wild: the elf. A full 4-high wild stack becomes one full-reel covering-pose elf wild.
- Wild multipliers (21:31/21:33): every wild has its own multiplier. A new wild starts at **x1** and gains **+1 per connection**. A completed 4-high stack's multiplier is the **sum of its four wild values**. Full-reel wilds on **non-adjacent** reels **add**; full-reel wilds on **adjacent** reels **merge and multiply**.
- Respins (21:31): symbols that connect with a wild are held and the rest of the board respins, **up to 3 respins** per spin. Wilds that land on a respin count toward triggers.
- Bonus triggers on the final board of a base spin: Dare = 4 wilds anywhere. Double Dare = a full stack. Triple Dare = a full stack + 2 more wilds. Hidden = 2 full stacks.
- Starting spins: Dare 8, Double Dare 10, Triple Dare 12, Hidden 14. Each **newly** completed stack awards +2 spins. The cap is **18 spins** per round.
- Buyable: Dare, Double Dare, Triple Dare, Mystery, EGW. Hidden is reachable only from base, Ante, or Mystery. All prices are open.
- Mystery: 50% no bonus / 37% Double Dare / 10% Triple Dare / 3% Hidden. On "no bonus", the player gets only that spin's line wins. **Every** Mystery buy plays the tease: 3 wilds stack, then a slow spin, then the bonus hits or it doesn't.
- EGW (Elves Gone Wild): a **single-spin** buy with 2–5 guaranteed full-reel stacks and no bonus round.
- Ante mode exists.
- Symbols: Dare bottle, red cup, pizza, lingerie, crown, phone with heart, "GOOD VIBES" neon, lips, cannabis leaf, and the elf wild portraits.

## 2. Grid, lines, paytable [DEFAULT, D1/D2]
**20 fixed lines**, paid left to right from reel 1, with 3+ of a kind on consecutive reels. Only the best win per line is paid. Row 0 is the top row.
```
L1 [0,0,0,0,0]  L2 [1,1,1,1,1]  L3 [2,2,2,2,2]  L4 [3,3,3,3,3]  L5 [0,1,2,1,0]
L6 [3,2,1,2,3]  L7 [1,0,0,0,1]  L8 [2,3,3,3,2]  L9 [0,1,0,1,0]  L10 [3,2,3,2,3]
L11 [1,2,1,2,1] L12 [2,1,2,1,2] L13 [0,0,1,0,0] L14 [3,3,2,3,3] L15 [1,1,0,1,1]
L16 [2,2,3,2,2] L17 [0,1,1,1,0] L18 [3,2,2,2,3] L19 [1,2,3,2,1] L20 [2,1,0,1,2]
```
Pays are in **line-bet units** (total bet = 20 line bets). The relative shape is proposed here, and the absolute scale is to tune in math-SDK sim.

| Tier | Symbol | id | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Wild | Elf wild (pays only on a line of pure wilds) | W | 25 | 100 | 500 |
| Premium 1 | Dare bottle | H1 | 25 | 100 | 500 |
| Premium 2 | Lips | H2 | 20 | 75 | 300 |
| Premium 3 | Lingerie | H3 | 15 | 50 | 200 |
| Premium 4 | Crown | H4 | 10 | 40 | 150 |
| Low 1 | Phone with heart | L1 | 5 | 20 | 80 |
| Low 2 | "GOOD VIBES" neon | L2 | 5 | 15 | 60 |
| Low 3 | Red cup | L3 | 4 | 10 | 40 |
| Low 4 | Pizza | L4 | 3 | 8 | 30 |
| Low 5 | Cannabis leaf | L5 | 3 | 8 | 30 |

- The **cannabis leaf is deliberately L5**, with the same pays as L4. If compliance forces a swap (COMPLIANCE C26), only the art changes and the math is untouched.
- The wild substitutes for every symbol. As in the math-SDK `LinesWins` rule, a line pays the larger of the pure-wild run and the first-non-wild symbol run.
- **Max board, before multipliers:** all 20 lines at 5×H1 or 5×W = 20 × 500 / 20 = **500x the bet**.
- SDK note: enter `config.paytable` in the unit the SDK lines sample expects (the line-bet value ÷ 20 if the SDK uses total-bet units). Confirm this against the sample `lines` game before coding.

## 3. Wilds, connections, multipliers (locked by 21:31/21:33 unless marked)
- **Connection [DEFAULT, D3]:** a wild *connects* when it sits inside the winning run of a paying line in that evaluation step.
- **Value:** a new wild = x1. It gains **+1 per connection**. In base and Ante that means once per evaluation step, so a spin plus 3 respins gives at most +4. In bonuses and EGW it is **once per spin sequence** [DEFAULT, R6]. A wild on several winning lines in the same step still gains only +1.
- **Full-reel wild:** when all 4 cells of a reel are wild, the reel becomes one full-reel wild. Its value is the **sum of the 4 cell values** at that moment. Example: a reel with cells x3, x3, x2, x1 becomes x9. A full-reel wild then gains +1 per connection as a single wild [DEFAULT, A4].
- **Line multiplier** (applied per line, not to the spin total). The winning run is split into groups:
  - each maximal run of **adjacent full-reel wilds** is one group, worth the **product** of its values (locked: adjacent stacks merge and multiply; for 3+ adjacent, see A1);
  - every other wild in the run (a single wild, or an isolated full-reel wild) is its own group, worth its value;
  - line multiplier = **sum of all groups** [DEFAULT, A2], or x1 if the run has no wild.
  - Example: full-reel wilds on R1 (x6), R2 (x5) and R4 (x7) give (6×5) + 7 = **x37**.
- **Line win** = paytable pay × line multiplier. **Spin win** = the sum of the line wins.
- **Merged display [DEFAULT, A6]:** adjacent full-reel wilds render as one wide elf wild with one badge, e.g. "x6 × x5 = x30".

## 4. Respins (locked by 21:31; details [DEFAULT])
1. After a spin, the board is evaluated. If at least one wild connected, a respin sequence starts.
2. **Held [R3]:** every wild on the board, plus every symbol in a winning run that contains a wild. Everything else respins.
3. **Count [R2]:** a hard maximum of 3 respins. The sequence stops early when a respin produces **no new wild-connected win**, meaning no new winning line through a wild and no wild connecting for the first time.
4. In each step: land the new cells, check stack completion and sum the values, evaluate the lines, then add +1 to the wilds that connected (per the growth rule in §3).
5. **Payment [R5]:** paid **once**, at the end of the sequence. The final board is evaluated with the wild values as they stood at that final evaluation. Earlier steps are not paid separately, so nothing is paid twice. The front end may show provisional values, but the win meter counts up only from the final evaluation (see COMPLIANCE C17).
6. **Where [R4]:** base, Ante, every bonus spin, and EGW. **Not** in the Mystery reveal spin [R9]. Respins never use up a free spin.
7. Wilds that land on respins count toward triggers (locked). Stacks completed on a respin count as newly completed for +2 spins in bonuses.

## 5. Base game and Ante
- No global multiplier. Line wins use the wild multipliers from §3. All wild values reset after the spin unless they carry into a bonus the spin triggered.
- **Triggers** are checked on the final board of the sequence, in this precedence [DEFAULT, D4]:

| Priority | Final-board condition | Award |
|---|---|---|
| 1 | ≥2 full-reel wilds | **Hidden**, 14 FS |
| 2 | 1 full-reel wild + ≥2 other wilds | **Triple Dare**, 12 FS |
| 3 | 1 full-reel wild (+ ≤1 other wild) | **Double Dare**, 10 FS |
| 4 | ≥4 wilds, no full-reel wild | **Dare**, 8 FS |

- A trigger spin **pays its own line wins first**, then the bonus plays inside the same book [D4].
- **Carry-in [DEFAULT, A5]:** full-reel wilds that triggered the bonus lock in place with their end-of-sequence value. The trigger wilds of a Dare carry in as sticky singles, keeping their values. The 2 extra wilds of a Triple carry in as sticky.
- **Ante [DEFAULT, D5]:** costs **1.25x**. Natural trigger rates are about **2×** base for all four tiers, which is done by weighting the reel strips (to tune in math-SDK sim). The mode name is `ante`.

## 6. Bonus tiers [starting spins and stacks locked; tier levers DEFAULT, A3]
| Tier | Start spins | Start stacks | Singles | Stack-completion odds | Max new stacks | Spins at cap |
|---|---|---|---|---|---|---|
| Dare | 8 | 0 | **sticky** (locked), keep growing | low; reels 2 and 4 at about 1/10 of reels 1/3/5 | 5 | 8+2×5 = **18** (reached exactly) |
| Double Dare | 10 | 1, locked | not sticky | low; reels 2/4 at about 1/10 | 4 | 10+2×4 = **18** (exactly) |
| Triple Dare | 12 | 1, locked + 2 sticky wilds | only the 2 trigger wilds stick | medium; reels 2/4 at about 1/10 | 4 | 12+2×3 = 18 at the **3rd** new stack; the 4th gives no spins |
| Hidden | 14 | 2, locked | not sticky | medium; **reels 2/4 normal**, so Hidden is the only tier where adjacency is common | 3 | 14+2×2 = 18 at the **2nd** new stack; the 3rd gives no spins |

- **Coordinator question (a), the stack/spin mapping, answered:** starting spins = 8 + 2 × (starting full stacks), and Triple's 2 extra wilds add the other +2. So Dare 8 has 0 stacks, Double 10 has 1, Triple 12 has 1 stack + 2 wilds, and Hidden 14 has 2. The 18 cap counts **free spins played**, not respins. +2 is awarded only for a **newly completed** stack. A locked stack never re-awards spins. Once the budget reaches 18, a further stack still locks and still multiplies, but it adds no spins.
- Where trigger stacks sit in **bought** bonuses [A5]: on reels drawn from {1, 3, 5}, so Hidden's 2 starting stacks are never adjacent at the start. Bought stacks start at x4, meaning 4 fresh x1 cells.
- In a bonus, wilds and stacks gain **+1 once per free spin** if they connected during that spin's sequence [R6].
- **No tier upgrades or retriggers into another tier** inside a bonus. Only +2 spins per new stack [D8].

## 7. EGW: Elves Gone Wild (single-spin buy)
- One spin with 2–5 guaranteed full-reel wilds. Each starts at **x4** (4 fresh x1 wilds). There is no bonus round, and a bonus never triggers from an EGW spin, even with 2+ stacks (locked).
- Respins are allowed [R4]. Wilds gain +1 once per spin sequence [R6]. The adjacency rules from §3 apply.
- **The stack pattern is drawn from a weighted table**, and that table is the EGW tail control. Toy per-pattern means, from `egw_check.py` (to tune in math-SDK sim):

| Stacks on reels | Toy mean | Toy min | Toy max | Reaches 50k? |
|---|---|---|---|---|
| 1,3 (non-adjacent) | 121x | 30x | 1,684x | no |
| 1,2 (adjacent) | 293x | 75x | 1,656x | no |
| 1,3,5 | 327x | 30x | 3,728x | no |
| 2,3,4 | 4,379x | 1,000x | 27,963x | no |
| 1,2,3 | 5,806x | 3,125x | 28,750x | no |
| 1,2,4,5 | 4,676x | 1,500x | 17,500x | no |
| 2,3,4,5 | 41,044x | 18,750x | 50,000x | 47% of the time |
| 1,2,3,4 / all 5 | 50,000x | — | — | always |

- So EGW **is** a 50,000x path, through 4+ adjacent stacks, and its max-win rate equals the weight given to those patterns. The recommended weight is **≤ 1 in 10,000 EGW spins** (see COMPLIANCE C10, CVaR). The price is open [D6]. With this paytable, even 2 non-adjacent stacks average about 121x, so a ~100x price needs leaner EGW reel strips, or the price lands nearer 150–250x (to tune in math-SDK sim).

## 8. Mystery buy
1. The book's outcome is drawn from the lookup table with weights fixed at exactly **50 / 37 / 10 / 3** (no bonus / Double / Triple / Hidden). The optimizer may reshape weights *within* each bucket but must not move weight between buckets (COMPLIANCE C20).
2. Reveal spin: 3 wilds land stacked on one reel (rows 0–2 or 1–3). The 4th cell of that reel slow-spins, which is the tease. There are no respins on the reveal spin [R9].
3. Results:
   - **No bonus:** the 4th cell lands a non-wild. The board holds **exactly** those 3 wilds and no others, so a Dare can never be implied. Line wins pay with the x1 wilds. The round ends.
   - **Double:** the 4th cell becomes a wild, completing a stack (x4). Double Dare follows.
   - **Triple:** stack + 2 more wilds land during the tease, then Triple Dare.
   - **Hidden:** stack + a second full-reel wild on a reel from {1, 3, 5}, then Hidden.
4. Dare is never a Mystery outcome. Mystery boards never show 4+ wilds without a stack.
5. Price = [0.5·E(no-bonus spin) + 0.37·E(Double) + 0.10·E(Triple) + 0.03·E(Hidden)] / 0.967, where E(Double), E(Triple) and E(Hidden) are the round values from the bonus sims. The toy figure is about 245x (section 11).

## 9. Order of resolution (one spin)
1. Load locked and sticky wilds. 2. Land the cells. 3. Complete stacks, summing values into full-reel wilds. 4. Evaluate lines: group adjacent stacks, multiply within groups, add the groups. 5. Apply +1 growth to the wilds that connected. 6. Respin decision (§4), then back to 2 for the respun cells. 7. **Pay the final evaluation** and add it to the round total. 8. **If the round total ≥ 50,000x, set it to 50,000x, emit `wincap`, and end the round**: no more respins, spins or reveals. 9. Bonus spins: add +2 per newly completed stack, capped at 18 total. 10. Base or Ante only: check triggers in precedence order (§5) and start the bonus inside the same book. 11. Mystery: reveal the outcome (§8).

## 10. Math-SDK mapping
- `index.json` lists **7 bet modes**: `base` (cost 1.0), `ante` (1.25), `dare`, `double_dare`, `triple_dare`, `mystery`, `egw`. The buy-mode costs are open. **Hidden is a freegame type, not a bet mode**: it has no cost, so it cannot have its own RTP (D7, COMPLIANCE C3). That is 7 of the 20 allowed modes.
- `BetMode(max_win=50000)` is set in every mode. The SDK caps `final_win = min(running_bet_win, wincap)` (math-sdk `src/state/state.py`). Add a `winCap` Distribution with `force_wincap: True` in every mode, so each mode actually contains max-win books (COMPLIANCE C13).
- Books need these events: `reveal`, `respinStart` {held}, `respinReveal`, `wildValue` {cell, from, to}, `stackComplete` {reel, parts, value}, `mergeGroup` {reels, product}, `winInfo` (per line: run, groups, multiplier), `setWin`, `freeSpinTrigger`, `updateFreeSpin` {played, total, cap: 18}, `mysteryTease` {reel, rows}, `mysteryOutcome`, `wincap`, `finalWin`. Every book's `payoutMultiplier` (x100 integer) must equal its lookup-table row.
- Suggested Distribution criteria per buy mode: `winCap`, `0` (where allowed), `adjacent` (books with an adjacent group), `basic`. For Mystery, use the four outcome buckets with fixed quotas.

## 11. Item 6, rebuilt for the 21:33 model: is 50,000x reachable but rare?
**Arithmetic.** A pure line board pays at most **500x**, the all-wild or 4-wild + 5×H1 board. The spin win is the sum of each line's pay × its line multiplier.

| Wild configuration on the winning run | Line multiplier | Board pay at that multiplier | Can one spin reach 50k? |
|---|---|---|---|
| Singles only (base, x1–x5 each) | additive, usually under x10 | at most a few hundred x | no |
| Non-adjacent stacks R1+R3+R5, x4 each | 4+4+4 = x12 | E9: 89x at x8 → about 134x at x12 | no; even at x21 each (x63) it is about 700x a spin |
| 2 adjacent, fresh | 4×4 = x16 | needs a 3,125x base board, which is impossible (max 500x) | no; values of 10 each (x100) need the 500x all-wild board |
| 3 adjacent, fresh / after +1 | x64 / x125 | R1–R3: every line ≥ W3 (25 lb) → ≥ 25x board | 3,125x minimum (EGW 1,2,3); reaches the cap at about x2,000, e.g. 13×13×13 |
| 3 adjacent R2–R4 at x8, x7, x9 | x504 | E12: about 33x board → 16,758x | not alone; the cap needs a total above 33,242x before it (E12) |
| **4 adjacent**, fresh / after +1 | x256 / x625 | R1–R4: every line ≥ W4 (100 lb) → ≥ 100x board | **25,600x / 62,500x: about one connection away from the cap** |
| 5 adjacent, fresh | x1,024 | 500x | 512,000x, so **always the cap** |

**Conclusion.** With singles and non-adjacent stacks, the 50,000x cap is effectively unreachable. It becomes reachable only through **adjacent** groups: 4+ adjacent stacks almost always reach it, and 3 adjacent stacks reach it only with grown values or a long run. The rarity of 50,000x is therefore the rarity of adjacency. Each adjacent pair (1-2, 2-3, 3-4, 4-5) includes reel 2 or reel 4, so **stack odds on reels 2 and 4 are the master lever.**

**What keeps it rare** (none of these changes a locked item):
1. Stack-completion odds per reel, with reels 2 and 4 at about 1/10 of reels 1, 3 and 5 except in Hidden.
2. Trigger and bought stacks placed on {1, 3, 5}.
3. Growth of +1 once per free spin in bonuses, not per respin.
4. The 18-spin cap.
5. The W4/W5 pays (100/500 lb), which set the floor for a 4-adjacent board.
6. The EGW pattern weights.
7. In Dare, sticky singles that make stacks, but at low wild density.

**Toy evidence** (`toy_sim3.py`; 3,000 rounds per tier; q = full stack per reel per spin = 0.002 on reels 1/3/5 and 0.0002 on 2/4; single-wild density 0.006; all to tune in math-SDK sim):

| Tier | Levers OFF (q=0.003, w=0.008, growth per step, any reel): P(50k) | Levers ON: mean round | Levers ON: P(50k) per round | Levers ON: P(≥5,000x) |
|---|---|---|---|---|
| Dare | 1 in 400 | ~24x | 0 in 3,000 (< 1 in 3,000) | 0 |
| Double Dare | 1 in 77 | ~178x | 0 in 3,000 (< 1 in 3,000) | 0.10% |
| Triple Dare | 1 in 14 | ~976x | about 1 in 1,500 | 1.3% |
| Hidden | 1 in 3 | ~2,382x | about 1 in 231 | 5.1% |

**Rough max-win frequency per mode with levers ON** (placeholder trigger rates per base spin: Dare 1/250, Double 1/1,200, Triple 1/6,000, Hidden 1/30,000; all to tune in math-SDK sim):
- **Base:** Σ (trigger rate × P(cap | tier)) is about 1.2e-7 (Triple) + 1.4e-7 (Hidden) + < 3e-7 (Double, Dare upper bound) ≈ **1 in 2–4 million base spins**. The doc guide is "more frequent than 1 in 10,000,000", so this passes.
- **Ante:** triggers are about 2×, so roughly **1 in 1–2 million Ante spins**.
- **Dare buy:** < 1 in 3,000 in the toy. It must be forced with `winCap` books so a 50,000x is actually present (C13). Target about 1 in 50,000–200,000 buys.
- **Double buy:** < 1 in 3,000. Target about 1 in 20,000–50,000.
- **Triple buy:** about 1 in 1,500. Target 1 in 3,000–6,000 to stay under the CVaR limit (C10).
- **Mystery:** 0.37 × <3e-4 + 0.10 × 6.7e-4 + 0.03 × 4.3e-3 ≈ **1 in 4,000–5,000 Mystery buys**.
- **EGW:** equals the weight of the cap patterns. Target **≤ 1 in 10,000**.

**Coordinator question (b), the math risk, answered for the new model:** the old doubling risk no longer applies. The new risk is that adjacent groups multiply. Without the levers, the toy hit the cap in 1 of 3 Hidden rounds and 1 of 14 Triple rounds, and 96.7% would then force near-empty reels. With the levers above, the rates fall to 1 in a few hundred to 1 in a few thousand bonus rounds, at buy prices that look plausible. The math-SDK sim must still confirm per-mode P(50k), P(≥5k) and CVaR against COMPLIANCE C8–C10.

**Toy buy prices** (mean / 0.967; to tune in math-SDK sim): Dare ~25–50x, Double ~180–240x, Triple ~1,000x (over the 2-Star 1,000× cost limit, see C8), Mystery ~245x, EGW ~150–250x unless the EGW strips are leaner.

## 12. Worked examples
Notation: rows are listed top (row 0) to bottom, and reels R1 to R5 run left to right. "lb" is line bets (20 lb = 1x the bet). Every final pay was recomputed with `examples_check.py`.

**E1: base line win, no wilds.**
```
H1 H1 H1 L2 L3
L4 H2 L1 H3 L5
L1 L3 H4 L4 L2
H3 L5 L2 L1 H4
```
L1 pays 3×H1 = 25 lb × x1. **Win 1.25x.** No wild connected, so there is no respin.

**E2: base spin with 3 respins that completes a stack (→ Double Dare).**
- Spin: R3 rows 0–1 are wilds W(x1). L1 `H2 H2 W` and L13 `H2 H2 W(row1)` connect. Both wilds grow to x2. Held: R1r0 H2, R2r0 H2, and the two wilds.
- Respin 1: R1r1 and R2r1 land L2 (L2 `L2 L2 W` is new), R1r2 and R2r2 land H4, and **R3r2 lands W x1** (L3 `H4 H4 W` is new). The connected wilds grow: R3 = x3, x3, x2.
- Respin 2: **R3r3 lands W x1**, so R3 is full. **Full-reel wild = 3+3+2+1 = x9.** New lines connect (e.g. L16 `H4 H4 W`), and the full wild grows to x10.
- Respin 3, the last allowed: the other cells respin and nothing new wins. Final board:
```
H2 H2 W  L1 L3
L2 L2 W  H3 L5
H4 H4 W  L2 L4
L3 H1 W  L4 H2
```
- Final evaluation at x10: L1 and L13 3×H2 (20 lb), L2 and L15 3×L2 (5 lb), L3 and L16 3×H4 (10 lb), giving 70 lb × 10 = 700 lb. **Win 35x, paid once.**
- The stack grows to x11 after the final step. The final board has 1 full-reel wild and no other wilds, so **Double Dare** triggers with R3 locked at **x11**.

**E3: a respin that triggers Dare.**
- Spin: R3r0 W(x1). L1 `L1 L1 W` connects, and the wild grows to x2.
- Respin 1: single wilds land at R4r1, R2r2 and R5r3. None of them makes a new winning line, so the sequence stops.
```
L1 L1 W  L4 H3
H3 L2 L5 W  L4
L4 W  L1 L2 L5
L2 L5 H2 L3 W
```
- Final evaluation: L1 3×L1 = 5 lb × x2 = 10 lb. **Win 0.5x.** The board has 4 wilds and no full reel, so **Dare** triggers (8 FS). The 4 wilds carry in as sticky with values x3 (after the final growth), x1, x1, x1.

**E4: Double Dare spin with a locked stack (continuing E2).** R3 is locked at x11.
```
H3 H3 W  H1 L1
L1 L2 W  L5 L4
H2 L4 W  L3 L3
L4 H3 W  H3 L2
```
L1 and L13 pay 3×H3 (15 lb). L6, L10 and L18 pay 3×L4 (3 lb). That is 39 lb × x11 = 429 lb. **Win 21.45x.** The respin adds nothing new. The stack connected, so it grows to **x12** for the next free spin, once per free spin. No new stack, so the spin count is unchanged.

**E5: Dare sticky wilds become a stack.**
- Free spin 2: sticky R2r0 (x2) and R2r1 (x2) are held. R2r2 lands W x1 and sticks.
- Free spin 3: R2r2 has grown to x3 after a connection. R2r3 lands W x2 after its own connection during that spin's respins.
- R2 is complete: **2+2+3+2 = x9**. This is a new stack, so **+2 spins** (8 → 10) and it locks.
```
L4 W  L4 L1 H3
L2 W  H2 L5 L1
L1 W  L3 H4 L2
H1 W  L5 L2 L4
```
L1 `L4 W L4` and L9 `L4 W L4` pay 3 lb × x9 each. **Win 2.7x.**

**E6: Triple Dare trigger.** R2 is full (x4), with single wilds at R4r1 and R5r3. That is 1 stack + 2 more wilds.
```
L3 W  H4 L1 L2
H4 W  L1 W  L5
L1 W  L5 L3 H3
L2 W  H1 L4 W
```
L7 pays 3×H4 = 10 lb × x4. L15 `H4 W H4 W` pays 4×H4 = 40 lb × (4 + 1) = x5 (an isolated stack plus a single adds). Total 240 lb. **Win 12x, then Triple Dare** (12 FS), with R2 locked at its end value and the 2 singles sticky.

**E7: Hidden trigger and precedence.** R1 and R3 are full (non-adjacent, so they add: 4+4 = x8).
```
W L2 W L4 H2
W H3 W L1 L3
W L4 W H3 L5
W L1 W L2 L4
```
Every line pays 3-of-a-kind of its R2 symbol × x8, for 1,248 lb. **Win 62.4x.** The board meets both the Hidden condition (2 stacks) and the Triple condition, and **Hidden wins on precedence** (14 FS).

**E8: adjacent and non-adjacent stacks together (Hidden spin).** Full-reel wilds on R1 x6 and R2 x5 (adjacent, so they multiply to x30), and R4 x7 (non-adjacent, so it adds): **line multiplier (6×5)+7 = x37**.
```
W W H2 W L3
W W L1 W H2
W W L4 W L4
W W H3 W L1
```
Each line's run is `W W [R3 symbol] W [R5]`. Examples: L7 `W W H2 W H2` = 5×H2 300 lb × 37 = 11,100. L1 `W W H2 W L3` = 4×H2 75 × 37. Total 48,803 lb. **Win 2,440x.**

**E9: EGW spin with stacks on R1, R3, R5.** These are non-adjacent and add. Each enters at x4. A run that ends at R4 contains R1 and R3, so its multiplier is **4+4 = x8**. R5's stack would add +4 only on a 5-of-a-kind, which needs R4 to match, and in this board it never does.
```
W L2 W H4 W
W H1 W L2 W
W L4 W H1 W
W L3 W L5 W
```
Each line pays 3-of-a-kind of its R2 symbol × (4+4), for 1,784 lb. **Win 89.2x.** The wilds then grow, and respins run (none adds anything here). A single spin, no bonus.

**E10: Mystery tease, "no bonus".** The book outcome is no bonus (50% bucket). R3 rows 0–2 show W x1, and R3r3 slow-spins and lands L2. The board has exactly 3 wilds and no respin.
```
L2 H4 W  L3 L1
H4 H4 W  L1 L5
L1 L3 W  H2 L4
L3 L5 L2 L4 H1
```
L2, L7 and L15 pay 3×H4 (10 lb). L6 and L18 pay 3×L3 (4 lb). Total 38 lb. **Win 1.9x. The round ends.**

**E11: Ante.** Same board as E1 at a cost of 1.25x. The win is 1.25x the base bet. Ante changes only the trigger frequency, not the pays.

**E12: 50,000x round end (Hidden).** The round total before free spin 11 is **36,000x**. R2 x8, R3 x7 and R4 x9 are adjacent, so they multiply to **x504**.
```
L5 W W W L2
H1 W W W L3
L3 W W W H1
L2 W W W L4
```
Every line pays 4-of-a-kind of its R1 symbol × 504, for 335,160 lb = 16,758x. 36,000 + 16,758 = 52,758, which is **at or above 50,000**. **50,000x is paid, the round ends immediately, and the 7 remaining spins and any respins are forfeited.** The `wincap` event plays.

## 13. Decisions for the user (still open only; locked items removed)
Format: **Recommended** / Alternative, with a one-line reason for each.

**Core**
- **D1 Line count and shapes:** **20 fixed lines (§2)**, which give a 500x board ceiling and clean adjacency math. / 40 lines: more hits, but the paytable has to scale down.
- **D2 Paytable tiers:** **§2 (H1 bottle, H2 lips, H3 lingerie, H4 crown; leaf as L5 for an easy swap)**, which puts the brand symbol on top and the riskiest art in the swappable slot. / Lips as H1: the face art reads as more premium.
- **D3 Connection definition:** **the wild is inside the winning run of a paying line**. That is objective and matches the SDK win info. / Any wild on a paying line, even beyond the run: easier to read, but it loosens control.
- **D4 Precedence and trigger-spin pay:** **Hidden > Triple > Double > Dare; the trigger spin pays its line wins**. This is standard, and the player is never short-changed. / The trigger spin pays nothing extra: a little cheaper, but it feels bad.
- **D5 Ante:** **1.25x for about 2× natural triggers**, the common Engine pattern, and no confirm dialog is needed (≤ 2x). / 1.5x for about 3× triggers: stronger, but still no confirm.
- **D6 Buy prices:** **solved by the optimizer at 96.7% each; the toy range is Dare 25–50x, Double 180–240x, Triple ~1,000x, Mystery ~245x, EGW 150–250x**, so the math sets the prices. / Fix round-number prices (e.g. 50/200/800/250/150) and tune the reels to fit: friendlier for marketing.
- **D7 Hidden's "own 96.7% RTP":** **treat Hidden as a freegame type inside base, Ante and Mystery (7 bet modes)**, because a mode that can't be bought has no cost, so it has no RTP. / Add a hidden-only buy mode: this contradicts the lock that Hidden isn't buyable.
- **D8 Retriggers inside a bonus:** **+2 spins per new stack only; no tier upgrades**. This keeps the 18 cap and the tier identity clean. / 2 new stacks in Dare or Double upgrade the round to Hidden: more exciting, but the tail gets harder.
- **D9 EGW stack-pattern weights:** **4+-adjacent patterns ≤ 1 in 10,000; mostly non-adjacent pairs and triples**. These weights are the max-win control. / Uniform random placement: simpler, but max-win becomes far too frequent (C10).

**21:31 questions (respins and per-wild multipliers)**
- **R1 New wild starting value:** LOCKED at 21:33, x1.
- **R2 Respin limit:** **a hard 3, stopping early when nothing new connects**. That bounds the growth steps. / The counter resets on each new connection (hold-and-win style): longer sequences and a fatter tail.
- **R3 What's held:** **all wilds + the symbols in winning runs through a wild**. That is the literal reading of the lock. / Also hold every symbol matching a connected symbol: more respin wins, higher base RTP.
- **R4 Where respins happen:** **base, Ante, bonuses and EGW; never the Mystery reveal; respins don't use free spins**, so the feature is everywhere and the 18 cap counts real spins. / No respins in EGW: the EGW price is easier to control.
- **R5 Payment timing:** **once, at the end of the sequence, on the final board**. There's no double pay, and each spin has one win figure. / Pay new line wins after each step: a livelier meter, but it needs careful no-double-count logic.
- **R6 Growth rule (replaces the dropped tier step):** **+1 per evaluation step in base and Ante; +1 once per spin sequence in bonuses and EGW**. Growth inside a bonus stays bounded at 18. / +1 per evaluation step everywhere: the literal "each connection", but the toy rates rose several-fold.
- **R7 Several full-reel wilds on one line:** LOCKED at 21:33 (adjacent multiply, non-adjacent add). See A1 and A2.
- **R8 Global multiplier:** LOCKED at 21:33, none.
- **R9 Mystery tease vs respins:** **no respins on the reveal spin; the slow spin of the 4th cell is the single decisive moment**, so the displayed odds map one-to-one to what the player sees. / Respins run, and the tease plays on the last respin: more action, but the presentation is harder to keep honest (C21).

**21:33 questions (adjacency)**
- **A1 3+ adjacent stacks:** **all multiply (product of the whole group)**, the default reading of "merge and multiply". / Multiply only the two highest values and add the rest: this caps the explosion from 4–5 adjacent stacks.
- **A2 Mixed adjacent and non-adjacent stacks:** **multiply within each adjacent group, then add the groups and singles**, as stated in the brief and in E8. / Multiply everything on the line: far more explosive.
- **A3 What distinguishes the tiers now:** **the §6 lever table: Dare sticky singles; Double locked stacks only; Triple adds 2 sticky wilds and higher stack odds; Hidden has normal reel-2/4 odds, so adjacency is common**. Each tier gets a distinct feel and a distinct price step. / Tiers differ only by starting stacks, spins and overall stack odds: simpler, but they feel samey.
- **A4 Growth unit for a full-reel wild:** **+1 to the whole wild**. / +4, one per cell: much faster growth.
- **A5 Trigger-stack placement and value:** **naturally triggered stacks keep their base values; bought stacks start at x4 on reels from {1, 3, 5}**. That is fair to natural triggers and avoids a free adjacency in buys. / Every bonus stack resets to x4 on any reel: simpler, but it gives Hidden buys-by-Mystery free adjacency.
- **A6 Merged-wild rendering (frontend):** **one wide wild with a combined badge "x6 × x5 = x30"**, which makes the multiply rule visible. / Separate reels joined by a link glow: cheaper art.

**What changed from my earlier answers.** Under the global-multiplier drafts I had proposed: (a) base pays at x1 with x2 on a stack connection; (b) EGW pays at x2/x3; (c) the multiplier applies to the total spin win. 21:31 and 21:33 replace all three:
- (a) base uses wild values (x1 + growth per respin step, reset after the spin);
- (b) EGW uses x4 stacks with adjacency rules and once-per-spin growth;
- (c) multipliers are now **per line**, the sum of the line's wild groups.

## 14. Item status vs PHASE1_BRIEF "Still open" list
1. Lines (locked) → D1. 2 → D2. 3 → D3. 4 (multiplier scope): obsolete, no global multiplier. 5 (+2 only for new stacks): locked and confirmed in §6. 6 → §11. 7 (spin cap): locked at 18. 8 → §6 and A3. 9 (EGW): locked as a single spin; price D6, weights D9. 10 → D4. 11 → D5. 12: locked. 13 → COMPLIANCE.md.
