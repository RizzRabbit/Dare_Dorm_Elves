"""LUT weighting for Elfhaus (stands in for the math-sdk optimizer) plus the acceptance stats.

Every non-wincap book i gets weight  w_i ∝ (1 + x_i)^a * exp(b * [x_i >= 5000] + d * [x_i >= 15000]),  x = payout in x bet.
a sets the RTP to the 96.67% centre, b (<= 0) keeps P(win >= 5,000x) under 0.95%, d (<= 0) keeps CVaR(0.1%) under
19,000. Wincap books (50,000x) share a fixed total probability. Mystery buckets are normalised to exactly
50/37/10/3 % with the same (a, b, d). Weights are uint64 integers summing to about 1e17. With opt off, weights are flat
(per bucket for Mystery).

Base and ante (3-star, user 2026-10-24) use weigh_3star instead: starting from the RTP-centred power tilt p0, the
weights are an exponential reweighting of p0 that (i) holds RTP, the zero-win share (hit rate) and the 50,000x
probability fixed, (ii) raises the share of RTP paid by wins up to 40x cost until CVaR(0.1%)/cost reaches its target,
(iii) optionally pins the natural feature trigger rate, and (iv) adds a variance term only if std/cost is still too
high. Form: p_i = p0_i * exp(l1*ln(1+y_i) + l2*min(y_i,40) + l3*[bonus_i] + l4*y_i^2) / Z, y = payout / cost, with the\nl's solved so mean payout, low-band share, trigger rate (and std) hit their targets exactly.
"""
import math
import numpy as np

TARGET = 0.9667
P5K_MAX = 0.0095
CVAR_MAX = 19000.0
TOTAL = 10 ** 17
DEFAULT_WCAP_P = {"base": 2e-7, "ante": 2e-7}
# Stake 3-star limits: base std/cost <= 60, CVaR(0.1%)/cost <= 700, ETL(>40x cost) <= 0.9 (0.8 for 2-star).
# Targets carry margin; etl40 (optional) also caps ETL(>40x cost). bonus_rate = natural feature trigger probability per round (None = left free).
THREE_STAR = {"base": {"cvar_cost": 540.0, "std_cost": 52.0, "bonus_rate": None},
              "ante": {"cvar_cost": 540.0, "std_cost": 52.0, "bonus_rate": 1 / 70}}
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
    if opt and mode in THREE_STAR:
        return weigh_3star(mode, res, cost, pcap)
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


def _tilt(p0, F, G, t, iters=300):
    """Exponential tilt q_i = p0_i * exp(F_i . lam) / Z solved so that E_q[G] = t (Newton, damped on the residual).
    With G = F this is the minimum-KL reweighting; here G holds the constraints (mean payout, low-band share, trigger
    rate) and F the shape terms (log payout, low band, trigger, payout^2). Returns (q, lam, max relative error)."""
    lam = np.zeros(F.shape[1]); lp0 = np.log(p0); sc = np.maximum(np.abs(t), 1e-12)

    def q_of(l):
        s = lp0 + F @ l; s = s - s.max(); q = np.exp(s); return q / q.sum()

    def resid(l):
        q = q_of(l); return q, (q @ G - t) / sc
    q, r = resid(lam); err = float(np.abs(r).max())
    for _ in range(iters):
        if err < 1e-11: break
        mg, mf = q @ G, q @ F
        J = ((G * q[:, None]).T @ F - np.outer(mg, mf)) / sc[:, None]
        step = np.linalg.lstsq(J, r, rcond=None)[0]; a = 1.0
        while a > 1e-10:
            q2, r2 = resid(lam - a * step)
            if np.abs(r2).max() < err or not np.isfinite(err): break
            a /= 2
        lam = lam - a * step; q, r = q2, r2; err = float(np.abs(r).max())
    return q, lam, err


def etl(x, p, cost, k=40):
    """Stake ETL(k x cost): RTP (in cost units) paid by wins above k x cost."""
    return float((x * p)[x > k * cost].sum() / cost)


def weigh_3star(mode, res, cost, pcap):
    cfg = THREE_STAR[mode]
    x = np.array([r[1] / 100 for r in res]); y = x / cost
    cap = x >= 50000; zero = x == 0; nz = ~cap & ~zero
    bonus = np.array([1.0 if r[3] else 0.0 for r in res])
    if pcap is None:
        pcap = DEFAULT_WCAP_P.get(mode, 2e-6)
    groups = np.array(["all"] * len(res)); target = TARGET * cost
    a0 = _solve_a(x, groups, {"all": 1.0}, cap, pcap, 0.0, 0.0, target)
    p0 = _probs(x, groups, {"all": 1.0}, cap, pcap, a0, 0.0, 0.0)
    pz = float(p0[zero].sum()); M = 1.0 - pz - pcap
    ycap = float(y[cap].mean()) if cap.any() else 0.0
    q0 = p0[nz] / p0[nz].sum()
    low = np.minimum(y[nz], 40.0) / 40.0
    G0, F0 = [y[nz]], [np.log1p(y[nz])]
    base_t = [(TARGET - pcap * ycap) / M]           # conditional mean of y on paying non-cap books
    if cfg["bonus_rate"] is not None:
        G0.append(bonus[nz]); F0.append(bonus[nz]); base_t.append(cfg["bonus_rate"] / M)

    def build(lt, std_t=None):
        G = G0 + [low]; F = F0 + [low]; t = base_t + [lt]
        if std_t is not None:
            sq = (y[nz] / 100.0) ** 2
            G = G + [sq]; F = F + [sq]
            t = t + [((std_t ** 2 + TARGET ** 2) - pcap * ycap ** 2) / M / 1e4]
        q, lam, err = _tilt(q0, np.stack(F, 1), np.stack(G, 1), np.array(t))
        p = np.zeros_like(x); p[nz] = q * M; p[zero] = p0[zero] / p0[zero].sum() * pz
        if cap.any(): p[cap] = pcap / cap.sum()
        return p, lam, err

    def measure(p):
        mean = float((x * p).sum())
        return cvar(x, p) / cost, math.sqrt(float(((x - mean) ** 2 * p).sum())) / cost, etl(x, p, cost)

    def too_hot(p):
        c, _, e = measure(p)
        return c > cfg["cvar_cost"] or e > cfg.get("etl40", 1.0)
    lt0 = float(q0 @ low)
    p, lam, err = build(lt0)
    lo, hi = lt0, min(0.98, lt0 * 6)
    if too_hot(p):
        for _ in range(50):                                 # CVaR falls as more RTP is paid by <= 40x wins
            mid = (lo + hi) / 2; p, lam, err = build(mid)
            if err > 1e-6 or too_hot(p): lo = mid
            else: hi = mid
        lt = hi; p, lam, err = build(lt)
    else:
        lt = lt0
    std_t = None
    if measure(p)[1] > cfg["std_cost"]:
        std_t = cfg["std_cost"]; p, lam, err = build(lt, std_t)
    assert err < 1e-6, (mode, "3-star reweighting did not converge", err)
    w = np.maximum(1, np.round(p * TOTAL)).astype(np.uint64)
    pw = w.astype(np.float64) / float(w.sum())
    st = stats(mode, res, x, pw, cost)
    st["tilt"] = {"method": "3star_minkl", "a0": round(a0, 6), "lambda": [float(v) for v in lam],
                  "low40_share_target": lt, "std_term": std_t, "wincap_prob": pcap, **cfg}
    return [int(v) for v in w], st


def stats(mode, res, x, p, cost):
    mean = float((x * p).sum())
    st = {"cost": cost, "books": len(res), "rtp": mean / cost, "hit_rate": float(p[x > 0].sum()),
          "max_win": float(x.max()), "p_max": float(p[x >= 50000].sum()), "p5k": float(p[x >= 5000].sum()),
          "cvar_0_1pct": cvar(x, p), "std": float(math.sqrt(((x - mean) ** 2 * p).sum())) / cost,
          "cvar_per_cost": cvar(x, p) / cost, "std_raw": float(math.sqrt(((x - mean) ** 2 * p).sum())),
          "etl40": etl(x, p, cost), "p_bonus": float(p[np.array([bool(r[3]) for r in res])].sum()),
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
