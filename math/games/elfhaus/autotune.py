"""Bisection tuner (development only): python games/elfhaus/autotune.py <mode> <target_mean_x> <n> <prefix>[,<prefix>..] [lo hi]
Scales w/q of every strip matching the prefixes by one factor f (rarity ratios kept) until the raw mean hits the
target, then prints f. Apply the result with apply_scale.py."""
import json, os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tune

def mean_at(mode, pres, f, n, seed):
    os.environ["ELF_SCALE"] = json.dumps({p: f for p in pres})
    res = tune.run(mode, n, seed=seed)
    tot = [r[0] / 100 for r in res]
    return sum(tot) / len(tot), sum(1 for t in tot if t >= 5000) / len(tot), res

if __name__ == "__main__":
    mode, target, n = sys.argv[1], float(sys.argv[2]), int(sys.argv[3])
    pres = sys.argv[4].split(",")
    lo, hi = (float(sys.argv[5]), float(sys.argv[6])) if len(sys.argv) > 6 else (0.05, 20.0)
    for it in range(9):
        f = math.sqrt(lo * hi)
        m, p5, _ = mean_at(mode, pres, f, n, it + 1)
        print(f"  f={f:.4f} mean={m:.4f} P5k={p5*100:.3f}%", flush=True)
        if m > target: hi = f
        else: lo = f
        if abs(m / target - 1) < 0.01: break
    print("RESULT", mode, f)
