"""LUT weighting for Elfhaus (stands in for the math-sdk optimizer) plus the acceptance stats.

Every non-wincap book i gets weight  w_i ∝ (1 + x_i)^a * exp(b * [x_i >= 5000] + d * [x_i >= 15000]),  x = payout in x bet.
a sets the RTP to the 96.67% centre, b (<= 0) keeps P(win >= 5,000x) under 0.95%, d (<= 0) keeps CVaR(0.1%) under
19,000. Wincap books (50,000x) share a fixed total probability. Mystery buckets are normalised to exactly
50/37/10/3 % with the same (a, b, d). Weights are uint64 integers summing to about 1e17. With opt off, weights are flat
(per bucket for Mystery).
"""
import math
import numpy as np

TARGET = 0.9667
P5K_MAX = 0.0095
CVAR_MAX = 19000.0
TOTAL = 10 ** 17
DEFAULT_WCAP_P = {"base": 2e-7, "ante": 2e-7}
from game_calculations import MYSTERY_ODDS
SHARES = {k: v / 100 for k, v in MYSTERY_ODDS.items()}


def _probs(x, groups, gshare, cap, pcap, a, b, d):
    lw = a * np.log1p(x) + b * (x >= 5000) + d * (x >= 15000)
    p = np.zeros_like(x)
    for g, share in gshare.items():
        m = (groups == g) & ~cap
        if not m.any(): continue
        e = np.exp(lw[m] - lw[m].max())
        p[m] = e / e.sum() * share * (1 - pcap)
    if cap.any():
        p[cap] = pcap / cap.sum()
    return p


def cvar(x, p, q=0.001):
    o = np.argsort(-x); xs, ps = x[o], p[o]
    c = np.cumsum(ps); k = np.searchsorted(c, q)
    take = ps[:k + 1].copy(); take[-1] -= c[k] - q if k < len(c) and c[k] > q else 0
    return float((xs[:k + 1] * take).sum() / take.sum())


def _solve_a(x, groups, gshare, cap, pcap, b, d, target):
    lo, hi = -3.0, 3.0
    for _ in range(80):
        a = (lo + hi) / 2
        m = float((_probs(x, groups, gshare, cap, pcap, a, b, d) * x).sum())
        if m > target: hi = a
        else: lo = a
    return a


def weigh(mode, res, cost, pcap, opt):
    x = np.array([r[1] / 100 for r in res])
    cap = x >= 50000
    if mode == "mystery":
        cap = np.zeros_like(cap)      # Mystery wincap books stay inside their bucket's fixed share
    groups = np.array([r[4] if mode == "mystery" else "all" for r in res])
    gshare = SHARES if mode == "mystery" else {"all": 1.0}
    if pcap is None:
        pcap = DEFAULT_WCAP_P.get(mode, 2e-6)
    target = TARGET * cost
    a = b = d = 0.0
    if opt:
        def p5(b, d):
            a = _solve_a(x, groups, gshare, cap, pcap, b, d, target)
            p = _probs(x, groups, gshare, cap, pcap, a, b, d)
            return a, p, float(p[x >= 5000].sum())
        a, p, v = p5(0.0, 0.0)
        if v > P5K_MAX:
            lo, hi = -20.0, 0.0
            for _ in range(40):
                b = (lo + hi) / 2
                a, p, v = p5(b, d)
                if v > P5K_MAX: hi = b
                else: lo = b
            b = lo; a, p, v = p5(b, d)
        if cvar(x, p) > CVAR_MAX:
            lo, hi = -20.0, 0.0
            for _ in range(40):
                d = (lo + hi) / 2
                a, p, v = p5(b, d)
                if cvar(x, p) > CVAR_MAX: hi = d
                else: lo = d
            d = lo
        a = _solve_a(x, groups, gshare, cap, pcap, b, d, target)
    p = _probs(x, groups, gshare, cap, pcap, a, b, d)
    w = np.maximum(1, np.round(p * TOTAL)).astype(np.uint64)
    pw = w.astype(np.float64) / float(w.sum())
    st = stats(mode, res, x, pw, cost)
    st["tilt"] = {"a": round(a, 6), "b": round(b, 6), "d": round(d, 6), "wincap_prob": pcap}
    return [int(v) for v in w], st


def stats(mode, res, x, p, cost):
    mean = float((x * p).sum())
    st = {"cost": cost, "books": len(res), "rtp": mean / cost, "hit_rate": float(p[x > 0].sum()),
          "max_win": float(x.max()), "p_max": float(p[x >= 50000].sum()), "p5k": float(p[x >= 5000].sum()),
          "cvar_0_1pct": cvar(x, p), "std": float(math.sqrt(((x - mean) ** 2 * p).sum())) / cost,
          "raw_mean": float(x.mean()), "raw_p5k": float((x >= 5000).mean()),
          "max_events": max(r[6] for r in res), "total_events": int(sum(r[6] for r in res))}
    tiers = {}
    for r, pi in zip(res, p):
        if r[3]: tiers[r[3]] = tiers.get(r[3], 0.0) + pi
    st["tier_rates"] = {t: (1 / v if v else None) for t, v in tiers.items()}
    if mode == "mystery":
        st["bucket_shares"] = {b: float(sum(pi for r, pi in zip(res, p) if r[4] == b)) for b in SHARES}
    if mode == "egw":
        adj4 = 0.0
        for r, pi in zip(res, p):
            pat = r[5] or ()
            run = best = 0
            for k in range(5):
                run = run + 1 if k in pat else 0; best = max(best, run)
            if best >= 4: adj4 += pi
        st["p_adj4"] = adj4
    return st


def row(mode, st):
    pm = st["p_max"]
    return (f"| {mode} | {st['cost']:g} | {st['rtp']*100:.3f}% | {st['hit_rate']*100:.2f}% | {st['max_win']:.0f}x "
            f"(1 in {1/pm:,.0f}) | {st['p5k']*100:.3f}% | {st['cvar_0_1pct']:,.0f} | {st['std']:.2f} | {st['books']:,} |")


def table(stats):
    from modes import MODES
    h = ("| Mode | Cost | RTP | Hit rate | Max win (freq) | P(>=5000x) | CVaR 0.1% | Std/cost | Books |\n"
         "|---|---|---|---|---|---|---|---|---|")
    return h + "\n" + "\n".join(row(m, stats[m]) for m in MODES if m in stats)
