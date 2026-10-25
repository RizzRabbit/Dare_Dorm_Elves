# Elfhaus math status

Final run 2026-10-24 on RizzsSuperComp (24 cores): 1,000,000 base/ante books, 200,000 per bonus mode, optimizer on. Spin counts Dare 8, Double/Triple/Hidden 10, +2 per new stack, cap 18. Mystery per SPEC section 8 (50/37/10/3, fresh start board).

**3-star retune (2026-10-24, user: "we need a 3 star game"):** base and ante were reweighted to pass Stake's 3-star limits, and ante was re-priced from 1.25x to **3x** (user). The bonus modes (dare, double_dare, triple_dare, mystery, egw) are unchanged: same books, same LUTs.

All 7 modes at 96.670% RTP, P(>=5000x) under 1%, 50,000x reachable in every mode.

| Mode | Cost | RTP | Hit rate | Max win (freq) | P(>=5000x) | CVaR 0.1% (raw x) | Std/cost | Books |
|---|---|---|---|---|---|---|---|---|
| base | 1 | 96.670% | 23.59% | 50000x (1 in 5,000,000) | 0.001% | 539 | 52.00 | 1,000,012 |
| ante | 3 | 96.670% | 23.50% | 50000x (1 in 5,000,000) | 0.004% | 1,620 | 35.01 | 1,000,012 |
| dare | 50 | 96.670% | 97.28% | 50000x (1 in 500,000) | 0.112% | 17,012 | 13.32 | 200,012 |
| double_dare | 225 | 96.670% | 97.94% | 50000x (1 in 500,000) | 0.903% | 19,000 | 4.80 | 200,012 |
| triple_dare | 700 | 96.670% | 98.72% | 50000x (1 in 500,000) | 0.820% | 19,000 | 1.86 | 200,012 |
| mystery | 600 | 96.670% | 100.00% | 50000x (1 in 9,794) | 0.876% | 19,000 | 2.38 | 200,012 |
| egw | 450 | 96.670% | 89.58% | 50000x (1 in 500,000) | 0.660% | 19,000 | 2.15 | 200,012 |

## 3-star checks, base and ante (`python games/elfhaus/lut_metrics.py <lut> <cost>`)

Per-stake values are divided by the mode cost. ETL40 is the RTP (in cost units) paid by wins above 40x cost, which matches Stake's report (old ante 0.824 against Stake's 0.825).

| Metric (limit) | base before | base after | ante before (1.25x) | ante after (3x) |
|---|---|---|---|---|
| Std/cost (3-star <= 60) | 99.55 | **52.00** | 98.27 | **35.01** (raw 105.0) |
| CVaR 0.1% / cost (3-star <= 700) | 762 (Stake: 885.5) | **539** | 824 | **540** |
| ETL40 (3-star <= 0.9, 2-star <= 0.8) | 0.771 | **0.741** | 0.824 | **0.843** |
| Hit rate | 23.59% | 23.59% | 23.02% | 23.50% |
| Natural feature rate | 1 in 276 | 1 in 190 | 1 in 294 | **1 in 68** |
| P(>=5000x) | 0.0027% | 0.0010% | 0.0040% | 0.0044% |
| Max win 50,000x | 1 in 5M | 1 in 5M | 1 in 5M | 1 in 5M |

Our CVaR came out below Stake's 885.5 on the old LUTs (we couldn't reproduce how Stake computes it exactly), so the target is 540, which leaves margin even if Stake's figure runs 16% higher. Standard deviation and ETL match Stake exactly.

Ante's feature rates per round: Dare 1 in 157, Double Dare 1 in 126, Triple Dare 1 in 3,334, Hidden 1 in 40,547. For base: Dare 1 in 334, Double 1 in 454, Triple 1 in 12,901.

Ante still fails the 2-star ETL40 (0.843 against 0.8), but 3-star allows 0.9. Forcing it under 0.78 would push nearly all of ante's RTP into the 20x-100x range, so we didn't.

## What changed
- `optimize.py`: base and ante use `weigh_3star`, an exponential reweighting of the RTP-centred power tilt that:
  - holds RTP, the zero-win share (hit rate) and the 50,000x probability fixed
  - raises the share of RTP paid by wins up to 40x cost until CVaR/cost is 540
  - pins ante's natural feature rate at 1 in 70
  - adds a variance term only if std/cost would be over 52 (base needs it, ante doesn't)

  The targets are in `THREE_STAR`. The bonus modes still use the old `weigh`.
- `reel_params.json`: the ante cost is 3 (was 1.25). The `ante_spin` stack density `q` is x3 (rarity order kept), which roughly triples the raw trigger rate. Ante's single wilds, respin strips and freegame strips are unchanged, so ante still plays like base.
- `reweigh.py` (new): re-weights existing books from `library/res_<mode>.json` without re-simulating. It rewrites only that mode's LUT and checks that ids and payouts match. Base was redone this way, so `books_base.jsonl.zst` is unchanged. Ante was re-simulated with `run_local.py 1000000 200000 1 1 ante`.
- `lut_metrics.py` (new): computes RTP, hit rate, std, CVaR, ETL40, P(>=5000x) and RTP per band from any LUT.

## Frontend follow-up
**The frontend must change the ante price and toggle label from 1.25x to 3x.** Nothing in the frontend repo was touched.

Publish files (books_*.jsonl.zst, lookUpTable_*_0.csv, index.json) are in math/games/elfhaus/library/publish_files on the user's PC; they are gitignored because of size (~790 MB). For the re-upload, only books_ante, lookUpTable_ante, lookUpTable_base and index.json changed. Backup of the pre-retune base/ante files: D:\dev\elfhaus-math-backups\backup_ante1p25_20261024_1950.
