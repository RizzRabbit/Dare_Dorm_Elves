"""Natural Epic (base/ante): collect real 5-scatter trigger boards, replay the Epic on each board with OLD (12 FS, x4 stacks) and NEW (14 FS, x6) rules."""
import sys, os, random, time, json
G = r"D:\dev\elfhaus-math-epic\math\games\elfhaus"; sys.path.insert(0, G); os.chdir(G)
import numpy as np
from multiprocessing import Pool
def work(args):
    mode, seed, secs = args
    import game_calculations as gc, modes
    random.seed(seed); S = modes.build_sets(mode); boards = []; spins = 0; t = time.time()
    while time.time() - t < secs:
        rnd = gc.Round(gc.Emitter(False)); win, sym, sv, full = gc.base_spin(rnd, S["spin"], S["respin"]); spins += 1
        if rnd.capped: continue
        sc = gc.scatters(sym)
        if gc.scatter_tier(len(sc)) == "flip": boards.append((rnd.total, dict(full), dict(sv), sc))
    out = {}
    for name, fs, gv in (("old", 12, 4), ("new", 14, 6)):
        gc.START_FS["hidden"] = fs; gc.GUAR_MIN_VAL["hidden"] = gv; random.seed(seed + 7); r = []
        for t0, full, sv, sc in boards:
            rnd = gc.Round(gc.Emitter(False)); rnd.total = t0; rnd.base_c = t0
            gc.play_bonus(rnd, "hidden", dict(full), dict(sv), S["fs"], "natural", S.get("guar", gc.GUAR_WEIGHTS), sc)
            r.append(rnd.total / 100)
        out[name] = r
    return spins, out
if __name__ == "__main__":
    secs = int(sys.argv[1]) if len(sys.argv) > 1 else 300
    for mode in ("ante", "base"):
        with Pool(24) as p: res = p.map(work, [(mode, 1000 + i, secs) for i in range(24)])
        spins = sum(r[0] for r in res)
        for name in ("old", "new"):
            x = np.array([v for r in res for v in r[1][name]])
            print(f"{mode} {name}: boards={len(x)} spins={spins:,} min={x.min():.0f} p1={np.percentile(x,1):.0f} p5={np.percentile(x,5):.0f} "
                  f"median={np.median(x):.0f} mean={x.mean():.0f} P(<200x)={(x<200).mean()*100:.2f}% P(>=200x)={(x>=200).mean()*100:.2f}% P(50000x)={(x>=50000).mean()*100:.1f}%", flush=True)
        json.dump({n: [v for r in res for v in r[1][n]] for n in ("old", "new")}, open(rf"D:\dev\elfhaus-math-epic\epic_runs\natural_{mode}.json", "w"))
