"""Fast tuning harness (no events, no SDK): python games/elfhaus/tune.py <mode> <n> [variant]
Builds strips in memory from reel_params.json, simulates n rounds on 8 processes, prints raw stats."""
import json, os, sys, random, time
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import game_calculations as gc, modes, make_reels

def _init(mode, variant):
    global S, MODE, FORCE
    FORCE = None
    if "@" in mode:            # "base@double_dare": that mode's bonus tier forced via a dense-scatter trigger spin
        mode, FORCE = mode.split("@")
    P = json.load(open(os.path.join(modes.HERE, "reel_params.json")))
    params = P["strips"]; params.update(make_reels.wcap_strips(P))
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
    for pre, f in json.loads(os.environ.get("ELF_SCALE_S", "{}")).items():
        for nm in params:
            if nm.startswith(pre) and "s" in params[nm]:
                params[nm] = dict(params[nm]); params[nm]["s"] = [min(0.24, x * f) for x in params[nm]["s"]]
    for pre, v in json.loads(os.environ.get("ELF_SET", "{}")).items():   # ELF_SET='{"prefix": {"rot": 3}}'
        for nm in params:
            if nm.startswith(pre): params[nm] = dict(params[nm], **v)
    reels = {nm: make_reels.build_strip(nm, params[nm], 1000 + names.index(nm)) for nm in need}
    S = modes.build_sets(mode, variant, reels); MODE = mode
    if FORCE:
        hot = dict(params[S["spin"].name]); hot["s"] = [0.24] * 5; hot["q"] = [x * 1 for x in hot.get("q", [0]*5)]
        S["spin"] = gc.Strip("hot", make_reels.build_strip("hot", hot, 7))

def _work(args):
    seed, n = args
    random.seed(seed)
    out = []
    for i in range(n):
        rnd = gc.Round(gc.Emitter(False))
        bucket = None
        if MODE == "mystery":
            bucket = random.choices(list(gc.MYSTERY_ODDS), weights=list(gc.MYSTERY_ODDS.values()))[0]
        if FORCE: gc.round_buy(rnd, S, FORCE)
        else: modes.play_round(MODE, S, rnd, bucket=bucket)
        st = rnd.stats
        out.append((i, rnd.total, None, st["tier"], bucket, st.get("egw_pattern"), 0, rnd.base_c,
                    st["fs_played"], st.get("retriggers", 0), st.get("flip"), rnd.free_c))
    return out

def run(mode, n, variant="", procs=8, seed=0):
    chunks = [(seed * 1000 + i, n // procs) for i in range(procs)]
    with Pool(procs, initializer=_init, initargs=(mode, variant)) as p:
        res = [x for part in p.map(_work, chunks) for x in part]
    return res

def summarize(mode, res, cost):
    import numpy as np, optimize
    N = len(res); tot = np.array([r[1] / 100 for r in res])
    mean = tot.mean()
    tiers = {}
    for r in res:
        if r[3]: tiers[r[3]] = tiers.get(r[3], 0) + 1
    print(f"{mode}: N={N} raw RTP={mean/cost*100:.2f}% hit={(tot>0).mean()*100:.2f}% std/c={tot.std()/cost:.2f} "
          f"P5k={(tot>=5000).mean()*100:.3f}% caps={(tot>=50000).sum()} max={tot.max():.0f} "
          f"base_share={sum(r[7] for r in res)/max(1,sum(r[1] for r in res)):.3f}")
    for t, c in sorted(tiers.items()):
        fsw = np.array([r[1]/100 for r in res if r[3] == t]); fp = [r[8] for r in res if r[3] == t]
        fv = np.array([r[11]/100 for r in res if r[3] == t])
        print(f"   {t}: 1 in {N/c:.1f}  mean {fsw.mean():.1f}x fsmean {fv.mean():.1f}x med {np.median(fsw):.0f}  >=5k {np.mean(fsw>=5000)*100:.2f}%"
              f"  spins {np.mean(fp):.2f}  capped20 {np.mean(np.array(fp)>=20)*100:.1f}%")
    if os.environ.get("ELF_OPT", "1") == "1":
        res7 = [r[:7] for r in res]
        if not (tot >= 50000).any():                      # stand-in wincap book so the optimizer has one
            res7.append((N, 5000000, None, "x", res[0][4], None, 0))
        try:
            _, st = optimize.weigh(mode, res7, cost, None, True)
            print(f"   OPT rtp={st['rtp']*100:.3f}% std/c={st['std']:.2f} cvar/c={st['cvar_per_cost']:.0f} "
                  f"etl40={st['etl40']:.3f} hit={st['hit_rate']*100:.2f}% p5k={st['p5k']*100:.3f}% "
                  f"tilt={st['tilt'].get('a', st['tilt'].get('a0'))} rates={ {k: round(v) for k, v in st['tier_rates'].items() if v} }")
        except Exception as e:
            print("   OPT failed:", repr(e)[:200])

if __name__ == "__main__":
    mode, n = sys.argv[1], int(sys.argv[2]); variant = sys.argv[3] if len(sys.argv) > 3 else ""
    cost = json.load(open(os.path.join(modes.HERE, "reel_params.json")))["costs"][mode.split("@")[0]]
    t = time.time(); res = run(mode, n, variant)
    summarize(mode, res, cost); print(f"  {time.time()-t:.1f}s")
