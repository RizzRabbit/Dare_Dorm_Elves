"""Fast tuning harness (no events, no SDK): python games/elfhaus/tune.py <mode> <n> [variant]
Builds strips in memory from reel_params.json, simulates n rounds on 8 processes, prints raw stats."""
import json, os, sys, random, time
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import game_calculations as gc, modes, make_reels

def _init(mode, variant):
    global S, MODE
    params = json.load(open(os.path.join(modes.HERE, "reel_params.json")))["strips"]
    need = set()
    n = modes.strip_names(mode, variant)
    for k, v in n.items(): need |= set(v.values()) if k == "fs" else {v}
    names = sorted(params)
    # ELF_SCALE='{"prefix": factor, ...}' scales w and q of every strip whose name starts with prefix (tuning only)
    for pre, f in json.loads(os.environ.get("ELF_SCALE", "{}")).items():
        for nm in params:
            if nm.startswith(pre):
                params[nm] = dict(params[nm]); params[nm]["w"] = [x * f for x in params[nm]["w"]]
                if "q" in params[nm]: params[nm]["q"] = [x * f for x in params[nm]["q"]]
    for pre, v in json.loads(os.environ.get("ELF_SET", "{}")).items():   # ELF_SET='{"prefix": {"rot": 3}}'
        for nm in params:
            if nm.startswith(pre): params[nm] = dict(params[nm], **v)
    reels = {nm: make_reels.build_strip(nm, params[nm], 1000 + names.index(nm)) for nm in need}
    S = modes.build_sets(mode, variant, reels); MODE = mode

def _work(args):
    seed, n = args
    random.seed(seed)
    out = []
    for _ in range(n):
        rnd = gc.Round(gc.Emitter(False))
        modes.play_round(MODE, S, rnd)
        st = rnd.stats
        out.append((rnd.total, rnd.base_c, st["tier"], st["upgrade"], st["fs_played"], st["max_mult"]))
    return out

def run(mode, n, variant="", procs=8, seed=0):
    chunks = [(seed * 1000 + i, n // procs) for i in range(procs)]
    with Pool(procs, initializer=_init, initargs=(mode, variant)) as p:
        res = [x for part in p.map(_work, chunks) for x in part]
    return res

def summarize(mode, res, cost):
    N = len(res); tot = [r[0] / 100 for r in res]
    mean = sum(tot) / N
    import statistics
    tiers = {}
    for r in res:
        if r[2]: tiers[r[2]] = tiers.get(r[2], 0) + 1
    hit = sum(1 for t in tot if t > 0) / N
    p5k = sum(1 for t in tot if t >= 5000) / N
    caps = sum(1 for t in tot if t >= 50000)
    srt = sorted(tot, reverse=True); k = max(1, N // 1000)
    cvar = sum(srt[:k]) / k
    print(f"{mode}: N={N} mean={mean:.4f}x RTP@cost{cost}={mean/cost*100:.2f}% hit={hit*100:.2f}% "
          f"std={statistics.pstdev(tot)/cost:.2f} P5k={p5k*100:.4f}% caps={caps} max={max(tot):.1f} cvar0.1%={cvar:.0f} "
          f"base_share={sum(r[1] for r in res)/max(1,sum(r[0] for r in res)):.3f}")
    for t, c in sorted(tiers.items()):
        fsw = [r[0]/100 for r in res if r[2] == t]
        print(f"   {t}: 1 in {N/c:.1f}  mean round {sum(fsw)/len(fsw):.1f}x  med={sorted(fsw)[len(fsw)//2]:.0f}  >=5k={sum(1 for v in fsw if v>=5000)/len(fsw)*100:.1f}%  up={sum(1 for r in res if r[2]==t and r[3])}")

if __name__ == "__main__":
    mode, n = sys.argv[1], int(sys.argv[2]); variant = sys.argv[3] if len(sys.argv) > 3 else ""
    cost = json.load(open(os.path.join(modes.HERE, "reel_params.json")))["costs"][mode]
    t = time.time(); res = run(mode, n, variant)
    summarize(mode, res, cost); print(f"  {time.time()-t:.1f}s")
