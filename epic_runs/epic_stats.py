"""Epic distribution per route + lut_metrics from the worktree's run_local output (weighted by the LUTs)."""
import json, numpy as np, os
L = r"D:\dev\elfhaus-math-epic\math\games\elfhaus\library"
def wq(x, w, q):
    o = np.argsort(x); c = np.cumsum(w[o]) / w.sum(); return x[o][np.searchsorted(c, q)]
st = json.load(open(os.path.join(L, "stats_summary.json")))
for m in ("base", "ante", "mystery"):
    s = st[m]; print(f"{m}: RTP={s['rtp']*100:.3f}% hit={s['hit_rate']*100:.2f}% std/cost={s['std']:.2f} CVaR/cost={s['cvar_per_cost']:.1f} ETL40={s['etl40']:.3f} P5k={s['p5k']*100:.4f}% tiers={s.get('tier_rates')} tilt={s.get('tilt')}")
r = json.load(open(os.path.join(L, "res_mystery.json"))); W = {}
for l in open(os.path.join(L, "publish_files", "lookUpTable_mystery_0.csv")):
    a, b, c = l.split(","); W[int(a)] = (int(b), int(c))
tot = sum(v[0] for v in W.values())
for bk in ("none", "double_dare", "triple_dare", "hidden"):
    x = np.array([W[q[0]][1] / 100 for q in r if q[4] == bk]); w = np.array([W[q[0]][0] for q in r if q[4] == bk], float)
    print(f"mystery {bk}: books={len(x)} share={w.sum()/tot:.4f} mean={(w*x).sum()/w.sum():.1f} contrib={(w*x).sum()/tot:.2f}x "
          f"min={x.min():.0f} p1={wq(x,w,.01):.0f} p5={wq(x,w,.05):.0f} median={wq(x,w,.5):.0f} P(>600x)={w[x>600].sum()/w.sum()*100:.2f}%")
