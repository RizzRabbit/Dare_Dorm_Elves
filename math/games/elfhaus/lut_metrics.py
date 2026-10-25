"""Stake-style metrics from a lookUpTable CSV (id,weight,payout_cents).
usage: python lut_metrics.py <lut.csv> <cost> [more lut cost pairs...]"""
import sys
import numpy as np

BANDS = [0, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 1e18]


def load(fn):
    a = np.loadtxt(fn, delimiter=",", dtype=np.float64)
    return a[:, 2] / 100.0, a[:, 1] / a[:, 1].sum()


def cvar(x, p, q=0.001):
    o = np.argsort(-x, kind="stable"); xs, ps = x[o], p[o]
    c = np.cumsum(ps); k = int(np.searchsorted(c, q))
    take = ps[:k + 1].copy()
    if c[k] > q: take[-1] -= c[k] - q
    return float((xs[:k + 1] * take).sum() / take.sum())


def metrics(x, p, cost):
    mean = float((x * p).sum())
    std = float(np.sqrt(((x - mean) ** 2 * p).sum()))
    m = {"rtp": mean / cost, "hit": float(p[x > 0].sum()), "std_raw": std, "std_cost": std / cost,
         "cvar_raw": cvar(x, p), "cvar_cost": cvar(x, p) / cost,
         "etl40": float((x * p)[x > 40 * cost].sum() / mean),
         "etl40_raw": float((x * p)[x > 40].sum() / mean),
         "p5k": float(p[x >= 5000].sum()), "p5k_cost": float(p[x >= 5000 * cost].sum()),
         "p_max": float(p[x >= 50000].sum()), "max": float(x.max()), "p_zero": float(p[x == 0].sum())}
    m["max_1_in"] = 1 / m["p_max"] if m["p_max"] else float("inf")
    return m


def bands(x, p, cost):
    mean = float((x * p).sum()); out = []
    for lo, hi in zip(BANDS[:-1], BANDS[1:]):
        s = (x / cost >= lo) & (x / cost < hi) if lo else (x > 0) & (x / cost < hi)
        out.append((lo, hi, float(p[s].sum()), float((x * p)[s].sum() / mean)))
    return out


def report(name, x, p, cost):
    m = metrics(x, p, cost)
    print(f"== {name} cost={cost}")
    print("  " + "  ".join(f"{k}={v:.6g}" for k, v in m.items()))
    for lo, hi, pr, sh in bands(x, p, cost):
        print(f"   [{lo:>6g},{hi:>6g})x  prob={pr:.3e}  rtp_share={sh*100:6.2f}%")
    return m


if __name__ == "__main__":
    a = sys.argv[1:]
    for fn, cost in zip(a[0::2], a[1::2]):
        x, p = load(fn); report(fn, x, p, float(cost))
