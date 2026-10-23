# EGW single-spin toy under the 21:33 model: mean/max spin win by guaranteed-stack PATTERN (reels 1-5).
# Stacks enter at x4 (4 fresh x1 wilds). Respins on, +1 once per spin per connected wild. To tune in math-SDK sim.
import random, toy_sim3 as T
T.GROW_ONCE=True
random.seed(4)
for pat in [(1,3),(1,2),(1,3,5),(2,3,4),(1,2,3),(1,2,4,5),(2,3,4,5),(1,2,3,4),(1,2,3,4,5)]:
    full={r-1:4 for r in pat}; n=3000
    res=[min(T.spin(full,{},0.006,0.0,False)[0],T.CAP) for _ in range(n)]
    print(f"stacks on reels {pat}: mean={sum(res)/n:9.1f}x  min={min(res):8.1f}x  max={max(res):8.1f}x  P(cap)={sum(x>=T.CAP for x in res)/n:.3f}")
