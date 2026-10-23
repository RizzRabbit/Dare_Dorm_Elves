# Elfhaus — Phase 1 (Design Lock) brief
Owner: Coordinator. The user's plan is the authority. Proposed defaults below are NOT locked until the user signs off on SPEC.md.

## Locked by user plan (2026-10-22)
- 5x4, high volatility, Stake Engine. 96.7% RTP independently in EVERY mode: base, Dare, Double Dare, Triple Dare, Hidden, Ante, Mystery, Elves Gone Wild (EGW). Max win 50,000x.
- Base is low-hit; most RTP and nearly all max-win potential sit in the bonuses and EGW.
- Stacked wilds: a full 4-high wild stack on a reel transforms into one full-reel covering-pose elf wild.
- Multiplier starts x2 and doubles on a full-stack connection, once per spin max.
- +2 free spins per completed full stack in bonus modes.
- Triggers: Dare = 4 wilds anywhere (10 FS, sticky wilds). Double Dare = full 4-high stack (feature upgrade, the full-reel wild locks). Triple Dare = full stack + 2 more wilds (6 wilds). Hidden = 2 full stacks (top tier).
- All bonuses can trigger in base. Buyable outright: Dare, Double Dare, Triple Dare (prices TBD by math). Hidden is only reachable in base or through Mystery.
- Mystery Spin buy: 50% no bonus / 37% Double Dare / 10% Triple Dare / 3% Hidden. The whole buy must hit 96.7%.
- EGW: premium spins at ~100x. Every spin guarantees 2–5 full-stack wilds (they become full-reel elves). They drive the multiplier and award +2 spins per stack. EGW is the primary 50,000x path.
- Ante mode exists (cost TBD).
- Symbols: Dare bottle, red cup, pizza, lingerie, crown, phone with heart, "GOOD VIBES" neon, lips, cannabis leaf, plus elf wild portraits.

## Still open (Slot Expert proposes, the user decides)
1. Pay structure: lines vs ways (default 1,024 ways, left to right).
2. Paytable tiers for the 9 symbols (which are premium vs low).
3. What counts as a "connection": the full-reel wild must be part of a winning way that spin (default).
4. Multiplier scope: base resets each spin, bonus persists for the round (default).
5. Doubling and +2 trigger only on NEWLY completed stacks; locked/sticky stacks don't re-trigger (default). Without this, sticky stacks loop.
6. Multiplier cap. EGW guarantees 2–5 stacks every spin, so an uncapped doubling multiplier blows past 50,000x within about 10 spins. A cap and/or an EGW spin count is required. Propose numbers.
7. Free-spin cap per round (default 50).
8. Starting spins and differences per tier (user's own open item): whether higher bonuses add starting spins or only better wild/multiplier behavior. Propose options.
9. EGW spin count, and whether EGW is a buy or a bet mode.
10. Trigger precedence (default Hidden > Triple > Double > Dare). Also: does a base spin that triggers a bonus also pay its line wins?
11. Ante: cost and effect (e.g. higher trigger chance).
12. Mystery "no bonus" outcome: what does the player get (one normal paid spin?) so the buy can still hold 96.7%.
13. Stake Engine constraints on Mystery/random-outcome buys and max-win presentation.

## Compliance risks to verify against current Stake Engine docs (cite lines, no guesses)
- Theme/art: the covering-pose implied-nudity wild, "revealing" flanking elves, the lingerie symbol. Check what Stake Engine's art/content approval allows; all characters must be clearly adult.
- The cannabis leaf symbol: check drug-imagery rules and jurisdictions.
- A random-outcome buy (Mystery) and an 8-mode menu: check the bet-mode rules and the cross-mode RTP limits.
- Social/sweeps wording (baseline: /workspace/vb-review/ENGINE_REVIEW_CHECKLIST.md).

## User decisions, 2026-10-22 21:22 CDT (these override the defaults above)
- Pay structure: LINES, not ways, to keep payouts controllable. Line count and shapes are for Slot Expert to propose.
- EGW is a SINGLE-SPIN buy (~100x, price still open). One spin, 2–5 guaranteed full-reel stacks. No bonus round follows.
- Mystery buy: if no bonus lands, the player gets only that spin's line wins. Anticipation sequence on EVERY Mystery buy: 3 wilds stack somewhere on the board, then a slow-spin tease, then the bonus either hits or doesn't (frontend + book events must support this).
- Starting spins follow the starting stacks: Dare 8, Double Dare 10, Triple Dare 12, Hidden 14.
- LOCKED stacks DO trigger the multiplier doubling EVERY spin (once per spin max). This is the intended volatility. No separate multiplier cap: the 50,000x cap ends the round.
- Spin cap 18 (max 5 full stacks on 5 reels). Reading: +2 per NEWLY completed stack, so a locked stack does not re-award spins each spin (otherwise the 18 cap can't hold). Confirm in the spec.
- All buy prices are still open (math solves them).
- Coordinator's open questions for the spec: (a) the stack/spin mapping (Dare 8 = 0 stacks, Double 10 = 1, Triple 12 = 1 stack + 2 wilds, Hidden 14 = 2 stacks); write down exactly how the 18 cap applies to each tier. (b) Math risk: Double Dare starts with a locked stack, so it doubles every spin (x2 to about x2,048 over 10 spins), and Backend must show it doesn't hit 50,000x so often that 96.7% forces near-empty reels. Quantify the max-win frequency per mode in the report.

## User decision, 2026-10-22 21:25 CDT: ADDITIVE multiplier (replaces doubling)
- The multiplier still starts at x2 and steps up at most once per spin when a full stack (locked or new) connects.
- Dare and Double Dare: +1 per spin (x2, x3, x4, ...).
- Triple Dare ("epic") and Hidden: +2 per spin (x2, x4, x6, ...).
- Max over 18 spins is about x20 (Dare/Double) or about x38 (Triple/Hidden). The 50,000x cap still ends the round.
- The doubling risk note above is now obsolete. Spec still to define: the base game and EGW single-spin step (default: x2, +1 on a connection, reset each spin) and whether the multiplier is per-spin total or per line.

## User decision, 2026-10-22 21:31 CDT: RESPINS + PER-WILD MULTIPLIERS (refines the 21:25 multiplier)
- Respins: symbols that connect with a wild are held and the rest of the board respins, up to 3 respins per spin.
- A bonus can trigger on a respin (wilds landing during respins count toward the Dare/Double/Triple/Hidden triggers).
- Every wild carries its own multiplier, which goes up by 1 on each connection.
- When a reel's 4-high stack completes, the four wilds' multiplier values ADD together to give the full-reel wild's multiplier.
- The tier steps from 21:25 (+1 in Dare/Double, +2 in Triple/Hidden) now need restating in terms of per-wild growth. Slot Expert to propose.
Open for the spec (propose a default plus one alternative each):
1. A new wild's starting value (x1 or x2?).
2. Is the 3-respin limit a hard 3, or does the counter reset when a new connection lands?
3. Exactly what's held: only the wilds plus the symbols on winning lines through them, or more?
4. Do respins happen in base, in bonuses, and in EGW? Does a respin use up a free spin? (Default: no.)
5. Are wins paid after each respin or once at the end of the sequence?
6. How the tier step applies in bonuses: does a locked full-reel wild's multiplier keep growing each spin (+1 Dare/Double, +2 Triple/Hidden)?
7. Two or more full-reel wilds on one line: are their multipliers added or multiplied? (Default: added, for controllability.)
8. Is there still a global spin multiplier (x2 start), or is it replaced entirely by the wild multipliers? (Default: replaced.)
9. How the Mystery tease (3 stacked wilds + slow spin) interacts with respins.

## User decision, 2026-10-22 21:33 CDT (overrides 21:25/21:31 where they conflict)
- There is NO global multiplier, and there never was. Ignore every "x2 start" or global/tier-step multiplier wording above. Multipliers live only on wilds.
- A new wild starts at x1 and goes up by 1 per connection.
- A completed 4-high stack's multiplier = the sum of its four wild values.
- Full-reel stacks that are NOT adjacent: their multipliers ADD.
- Full-reel stacks on ADJACENT reels MERGE, and their multipliers MULTIPLY.
Still for the spec: does a run of 3+ adjacent stacks multiply all together (default yes)? How do adjacent groups combine with non-adjacent stacks on the same line (default: multiply within each adjacent group, then add the groups)? What, if anything, differs between bonus tiers now that the +1/+2 tier step is gone (propose)? Does a merged wild render as one wide symbol (frontend)?
