# Elfhaus math status (v2, scatter route)

Final run 2026-10-25 CDT on RizzsSuperComp (24 cores), branch `math-elfhaus-v2`: 1,000,000 base/ante books, 200,000 per bonus mode, optimizer on. Rules per `design/SPEC.md` (scatter revision S1–S12) and `design/EVENTS.md`. Fixed prices (S9).

All 7 modes at 96.670% RTP and pass Stake 3-star (std/cost <= 60, CVaR 0.1%/cost <= 700, ETL40 <= 0.9) plus the 2-Star limits (P(>=5000x) <= 1%, CVaR raw <= 20,000, cost <= 1000x). 50,000x reachable in every mode. Metrics from `lut_metrics.py` on the published LUTs.

| Mode | Cost | RTP | Hit | Std/cost | CVaR/cost (raw) | ETL40 | P(>=5000x) | 50,000x | Books |
|---|---|---|---|---|---|---|---|---|---|
| base | 1 | 96.670% | 24.83% | 49.36 | 515 (515) | 0.693 | 0.0007% | 1 in 5,000,000 | 1,000,012 |
| ante | 3 | 96.670% | 24.97% | 40.22 | 514 (1,543) | 0.782 | 0.0031% | 1 in 5,000,000 | 1,000,012 |
| dare | 100 | 96.670% | 97.65% | 2.70 | 37 (3,684) | 0.012 | 0.007% | 1 in 500,000 | 200,012 |
| double_dare | 250 | 96.670% | 98.45% | 4.50 | 74 (18,465) | 0.196 | 0.950% | 1 in 500,000 | 200,012 |
| triple_dare | 600 | 96.670% | 99.33% | 2.16 | 32 (19,000) | 0.012 | 0.755% | 1 in 500,000 | 200,012 |
| mystery | 600 | 96.670% | 63.56% | 2.37 | 32 (19,000) | 0.012 | 0.747% | 1 in 10,743 | 200,012 |
| egw | 450 | 96.670% | 90.05% | 2.14 | 42 (19,000) | 0.029 | 0.610% | 1 in 500,000 | 200,012 |

Natural feature rates (weighted, per spin): base Dare 1 in 167, Double Dare 1 in 3,215, Triple Dare 1 in 238,528, Epic 1 in 917,555 (any bonus 1 in 159). Ante Dare 1 in 56, Double Dare 1 in 708, Triple Dare 1 in 33,317, Epic 1 in 75,681 (any bonus 1 in 51). Mystery buckets exact 50 / 37 / 10 / 3 (Epic 3%).

## Frontend follow-up
- New prices: Dare 100x, Double Dare 250x, Triple Dare 600x (Mystery 600x, EGW 450x, Ante 3x unchanged).
- Event changes: see `design/EVENTS.md` (scatter `S`, `cardFlip`, `guaranteedStacks`, new `freeSpinRetrigger`, `bonusUpgrade` removed, cap 20, carry-in in place, Mystery carry). Samples regenerated in `math/samples/`.
- Publish files (gitignored) are in `D:\dev\elfhaus-math\math\games\elfhaus\library\publish_files` on the PC. All 15 files changed. v1 backup: `D:\dev\elfhaus-math-backups\v1_final_20261025`.
