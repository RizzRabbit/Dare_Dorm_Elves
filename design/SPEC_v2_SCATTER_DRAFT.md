# Elfhaus SPEC v2 (SCATTER) – DRAFT, local only
Status: **DRAFT for user decisions**, 2026-10-25 CDT. Based on `design/SPEC.md` (v1 FINAL, commit 6a1be1b). Nothing here is built or pushed.
Tags: **[USER]** = decided by the user; **[PROPOSED]** = recommended default awaiting a yes; **[OPEN]** = see §8.

## 0. Why v2 / the Mystery reel swap (root cause)
- The swap is in the **math, not the frontend**. SPEC §8.4 (LOCKED) says "Nothing carries into the bonus … The bonus starts fresh … with the board that defines its tier", and `round_mystery()` does exactly that: `play_bonus(rnd, bucket, mystery_start_board(...))` places brand-new x4 stacks (95% on reel 5) instead of the tease board.
- Evidence (`math/samples/mystery_double.json`): the tease ends with **reel 1 stack x10 + R3r2 single x3** (event 20 `wildGrow`), then event 25 `freeSpinTrigger{source:"mystery", carried:{fullReels:[{reel:4,value:4}]}}` and free spin 1's `reveal.locked` = reel 5 x4. The frontend `reveal` handler (`bookEventHandlerMap.ts`) just draws `ev.board`/`ev.locked`, so it faithfully shows the jump. EVENTS.md even tells the frontend to "clear the reveal wilds".
- A straight carry-over prototype (scratch branch `scratch-mystery-carry`, 20k books) was **not viable**: tease stacks sit mostly on reel 1 (59%) / reel 3 (32%) at x5–x14, so Mystery went to **250% RTP at 600x**, Hidden bucket ~100% wincap, P(≥5,000x) 3.0%; even at 2,000x it fails P(≥5k) and CVaR. v2 below fixes the expectation problem structurally: the bonus always starts from the real trigger board, and trigger-board wild odds are tuned for that.

## 1. Scatter symbol [PROPOSED]
- New symbol **S = "Dare Card"**: a glossy pink playing card with a lipstick kiss and "DARE" on it (ties to the tier names). Alt: a "Dorm Party" invite envelope. If the Dare Card is chosen, re-skin L1 (currently a "DARE bottle") to an unlabeled neon bottle so two symbols don't say DARE. No restricted words baked in (CONTENT_RULES).
- Lands on **all 5 reels**, **max 1 per reel** (strip spacing ≥ 4), so 0–5 scatters per board. Not a wild; never substitutes; does **not pay** [PROPOSED].
- Counted on the **final board** of the spin's respin sequence (respin strips carry scatters at the same density; scatters are never in a winning line, so landed scatters stay put) [PROPOSED].

## 2. Triggers (base and ante) [PROPOSED mapping]
| Scatters on final board | Award | Start spins [OPEN] |
|---|---|---|
| 3 | **Dare** | 8 |
| 4 | **Double Dare** | 10 |
| 5 | **Triple Dare**, or **Epic (Hidden)** on a hidden reveal (proposed 1 in 4 of 5-scatter triggers) | 10 / 12 |
- 6 scatters is impossible at 1 per reel on 5×4, so Epic needs a rule: **recommended: 5 scatters → "card flip" hidden reveal, 75% Triple Dare / 25% Epic** (fixed odds stated in the rules). Alternatives in §8.
- Wild counts and stacks **no longer trigger anything** (v1 §5 table and D4 precedence retired).
- The trigger spin pays its own line wins (unchanged).

## 3. Bonus rules
- **Carry-in [USER]:** every wild on the trigger spin's final board carries into the bonus **in place** as a sticky wild at its end-of-sequence value (stack = locked full reel, single = sticky single). The bonus starts **from the trigger board's wilds**, never a fresh board. Applies to natural, bought and Mystery triggers.
- **Stickiness:** Double Dare / Triple Dare / Epic: all wilds (carried and new) stay locked for the whole bonus and keep growing (v1 D10 unchanged). **Dare [PROPOSED]:** carried trigger wilds stay sticky for the whole bonus; wilds that land during Dare clear after each spin (keeps Dare the light tier).
- **Guaranteed stacks [USER]:** Triple Dare starts with **at least 1** full-reel wild, Epic with **at least 2**, animated in after the intro. [PROPOSED] If the trigger board already has stacks they count toward the guarantee; missing stacks are placed on weighted reels (favoring reels 4–5; Epic pairs mostly non-adjacent, like EGW D9), value **x4, or the sum of any carried cells on that reel with x1 for empty cells, whichever is higher**.
- **Extra spins [USER, DECIDED 2026-10-25]:** in a free spin, **2 scatters = +2 spins, 3 or more = +5 spins** (counted on that spin's final board). **Replaces** v1's "+2 per new stack" and the dropped "+1 per newly locked wild"; new stacks add **no** spins.
  - Applies to **all bonus tiers** (Dare, Double Dare, Triple Dare, Epic) [PROPOSED].
  - **Cap [PROPOSED]: 20 free spins played per round** (v1 was 18); retriggers past the cap add nothing. Free-spin scatter strips are tuned per tier.
  - Effect: at a free-spin visible-scatter rate of 5%/reel, P(2) ≈ 2.1%, P(3+) ≈ 0.12% per spin ⇒ ≈ +0.05 spins per spin (≈ +0.5 per 10-spin bonus, most bonuses get none). Because sticky wilds keep growing, each extra spin is worth more than the last, so retriggers fatten the bonus tail (more volatility); the cap and the per-tier fs scatter density are the levers. Base 3-star impact is small at these rates; the bonus-buy modes' P(≥5,000x) / CVaR are what it pushes, controlled by fs scatter density, cap 20 and the optimizer.
- **Dare → Double Dare upgrade on a stack (v1 D8/D10): [PROPOSED] removed** (tiers now come from scatters; keeps it simple).
- Unchanged: respins inside free spins, growth, merges, 50,000x cap per round.

## 4. Mapping of current mechanics under v2
| Mechanic (v1) | v2 |
|---|---|
| Triggers by wild count/stack (§5, D4) | **Replaced** by scatter count (§2). |
| Respins (R2–R5: wild connection, max 3, replace winning cells, pay every step) | **Unchanged.** Scatters don't take part. Refill on new lock is [OPEN]. |
| Wild growth +1 per connecting step (R6), stacks = sum (A4/A5) | Unchanged. |
| Merges / multiplier combine (A1/A2/A6: adjacent stacks multiply, others add) | Unchanged, including frontend combine animation. |
| Carry-in (v1 §5: grown values; Dare spin 1 only) | Grown values carry and stay sticky for the whole bonus in every tier (Dare too). |
| +2 spins per new stack, cap 18 | **Replaced**: scatter retrigger +2 / +5, cap 20 (proposed). |
| Dare→DD upgrade | Removed (proposed). |
| Hidden | Renamed **Epic** in UI (mode-name rules permitting); freegame type, reached by 5-scatter reveal or Mystery; not buyable (proposed). |
| Buys (A5: real trigger spin redrawn until tier matches) | Buy books play a real trigger spin redrawn until it shows the bought scatter count (3/4/5); its wilds carry. Buy-trigger strips keep wild odds low so carried wilds stay modest. |
| Costs: Dare 50, DD 225, TD 700, Mystery 600, EGW 450 | **Dare 100x [USER].** DD ≈ 250–350x, TD ≈ 600–900x (keep ≤ 1,000x), Mystery re-priced by sim (≈ 500–750x), EGW unchanged (450x) – all set by sim/optimizer. |
| Mystery (§8: wild tease, respins reveal, fresh start board) | **Scatter tease:** every Mystery spin lands **2 scatters**; the respins/slow reveal decide 50/37/10/3: none = no more scatters; DD = reaches 4; TD = 5 + card flip shows TD; Epic = 5 + card flip shows Epic. The bonus starts from the **actual Mystery board's wilds** + tier guarantees. Fixes the reel swap. |
| EGW (§7) | Unchanged; EGW strips carry **no scatters** (never a bonus). |
| Ante (3x since the 3-star retune) | Same rules; ante strips raise scatter density for ~2.5–3x the base bonus rate; re-check 3-star. |
| Max win 50,000x, wincap books in every mode | Unchanged. |
| 7 bet modes | Unchanged list (base, ante, dare, double_dare, triple_dare, mystery, egw). |

## 5. Base trigger-rate estimate (scatters only, analytic + 2M-spin MC check)
P = chance a scatter is visible on a reel (density per stop × 4), reels independent, max 1 per reel.
| Visible P per reel | exactly 3 (Dare) | exactly 4 (DD) | 5 (TD/Epic) | any bonus |
|---|---|---|---|---|
| flat 8% | 1 in 231 | 1 in 5,307 | 1 in 305,176 | 1 in 221 |
| flat 9% | 1 in 166 | 1 in 3,350 | 1 in 169,351 | 1 in 158 |
| flat 10% | 1 in 123 | 1 in 2,222 | 1 in 100,000 | 1 in 117 |
| flat 12% | 1 in 75 | 1 in 1,096 | 1 in 40,188 | 1 in 70 |
| shaped 14/9/11/14/16% | 1 in 64 | 1 in 901 | 1 in 32,210 | 1 in 60 |
| ante flat 13% | 1 in 60 | 1 in 805 | 1 in 26,933 | 1 in 56 |
MC at flat 12%: 1 in 75 / 1 in 1,136 / 1 in 33,898 (matches). Respins add a little (few cells re-drawn).
**Suggested start:** base ≈ 8–9% (any bonus ≈ 1 in 160–220, v1 base was 1 in 190), ante ≈ 13% at 3x. 5-scatter tiers are very rare naturally; that's normal for top tiers and Mystery/buys cover access.
For reference (dropped wild-count idea, current base reels): ≥3 wilds 1 in 37, ≥4 1 in 128, ≥5 1 in 548, ≥6 1 in 3,493.

## 6. Feasibility (96.67%, 50,000x, Stake 3-star)
- **RTP 96.67%:** achievable in every mode; the optimizer/LUT tilt plus strip tuning handle it. Base splits roughly into line game + bonuses (e.g. Dare 1/200 × ~97x avg ≈ 0.49 of RTP), so base line pays/wild odds get lowered.
- **3-star base (std ≤ 60, CVaR(0.1%)/cost ≤ 700, ETL40 ≤ 0.9):** today 52.0 / 539 / 0.741. Scatters separate bonus frequency from wild density, which helps: wild odds can drop (less base tail) while bonuses stay reachable. ETL40 ≈ bonus share of RTP (≈ 0.5–0.65) fits. Std and CVaR depend on the DD/TD/Epic tail, controlled by carried-wild odds, fs strips and the cap; expected to fit, but **must be re-verified by a full run**.
- **Main risk:** carried grown wilds (the Mystery prototype showed reel-1 x10 stacks explode RTP). Fix: trigger, buy-trigger and Mystery strips keep wilds rare, especially reel-1/2 stacks; guaranteed stacks favor reels 4–5.
- **50,000x:** still reachable mainly via adjacent multiplied stacks in TD/Epic; wincap books generated as now.
- **Cost:** full rebuild (all 7 modes, new books/LUTs/index); about 15 min per 200k-book mode on 24 cores. Frontend needs: scatter symbol and art, scatter-count trigger intro, retrigger banner, guaranteed-stack animation, Mystery scatter tease and card flip, and **no** board swap at bonus start.

## 7. Decided by the user
- Scatter route; trigger wilds carry in as sticky; TD guarantees 1 stack and Epic 2 at bonus start (animated); Dare buy 100x.
- Extra spins: 2 scatters +2, 3+ scatters +5 inside bonuses; "+1 per locked wild" dropped.

## 8. Open questions (recommended default in **bold**)
1. Tier mapping / Epic: **3 = Dare, 4 = DD, 5 = TD, with a 25% card-flip upgrade of 5-scatter triggers to Epic**. Alternatives: Epic = 5 scatters + ≥1 stack on the trigger board; Epic Mystery-only; allow 2 scatters per reel so 6 can land.
2. Scatter placement: **all 5 reels, max 1 per reel, counted after respins**.
3. Scatters pay? **No** (alternative: small scatter pay of 2/10/50x for 3/4/5).
4. Start spins: **Dare 8, DD 10, TD 10, Epic 12**.
5. Retrigger scope and cap: **all tiers, 20 spins max per round**.
6. Dare stickiness: **carried trigger wilds sticky for the whole bonus; new Dare wilds clear each spin; no Dare→DD upgrade**.
7. Guaranteed stacks: **trigger-board stacks count toward the guarantee; missing ones placed on reels 4–5-weighted, x4 or the carried sum if higher**.
8. Epic buyable? **No**: reached by 5-scatter reveal and Mystery (keeps it "hidden" and avoids a >1,000x price).
9. Buy costs: **Dare 100x (set); DD, TD, Mystery set by sim (expected ≈ 300x / ≈ 800x / ≈ 600x), TD ≤ 1,000x; EGW stays 450x**.
10. Respins refill on a new wild lock (Hold & Win style)? **No** (keep max 3, no reset); it raises per-spin volatility in every mode and threatens base 3-star. If wanted, bonus-only with a cap of 6 respin steps.
11. Mystery reveal: **2-scatter tease; reveal to 4 (DD) or 5 + card flip (TD/Epic); 50/37/10/3 unchanged; bonus starts from the Mystery board's wilds**.
12. Scatter art: **"Dare Card"** (re-skin L1 bottle without the DARE label), or "Dorm Party" invite.
