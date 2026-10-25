# Elfhaus math status

Final run 2026-10-24 on RizzsSuperComp (24 cores): 1,000,000 base/ante books, 200,000 per bonus mode, optimizer on. Spin counts Dare 8, Double/Triple/Hidden 10, +2 per new stack, cap 18. Mystery per SPEC section 8 (50/37/10/3, fresh start board).

All 7 modes at 96.670% RTP, P(>=5000x) under 1%, 50,000x reachable in every mode.

| Mode | Cost | RTP | Hit rate | Max win (freq) | P(>=5000x) | CVaR 0.1% | Std/cost | Books |
|---|---|---|---|---|---|---|---|---|
| base | 1 | 96.670% | 23.59% | 50000x (1 in 5,000,000) | 0.003% | 762 | 99.55 | 1,000,012 |
| ante | 1.25 | 96.670% | 23.02% | 50000x (1 in 5,000,000) | 0.004% | 1,030 | 98.27 | 1,000,012 |
| dare | 50 | 96.670% | 97.28% | 50000x (1 in 500,000) | 0.112% | 17,012 | 13.32 | 200,012 |
| double_dare | 225 | 96.670% | 97.94% | 50000x (1 in 500,000) | 0.903% | 19,000 | 4.80 | 200,012 |
| triple_dare | 700 | 96.670% | 98.72% | 50000x (1 in 500,000) | 0.820% | 19,000 | 1.86 | 200,012 |
| mystery | 600 | 96.670% | 100.00% | 50000x (1 in 9,794) | 0.876% | 19,000 | 2.38 | 200,012 |
| egw | 450 | 96.670% | 89.58% | 50000x (1 in 500,000) | 0.660% | 19,000 | 2.15 | 200,012 |

Publish files (books_*.jsonl.zst, lookUpTable_*_0.csv, index.json) are in math/games/elfhaus/library/publish_files on the user's PC; they are gitignored because of size (~780 MB).
