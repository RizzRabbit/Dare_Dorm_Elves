"""Re-weights existing books without re-simulating: python games/elfhaus/reweigh.py base[,ante]
Reads library/res_<mode>.json (saved by run_local.py), runs optimize.weigh with opt on, rewrites only
lookUpTable_<mode>_0.csv (book ids and payouts unchanged, so books_<mode>.jsonl.zst stays valid), updates
stats_summary.json and index.json (costs from reel_params.json)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import optimize, modes
from run_local import LIB, PUB, COSTS, WCAP_PROB


def main():
    stats_fn = os.path.join(LIB, "stats_summary.json")
    stats = json.load(open(stats_fn)) if os.path.exists(stats_fn) else {}
    for mode in sys.argv[1].split(","):
        res = [list(r) + [None, 0] for r in json.load(open(os.path.join(LIB, f"res_{mode}.json")))]
        lut = os.path.join(PUB, f"lookUpTable_{mode}_0.csv")
        with open(lut) as f:                      # the books file must be the one these results came from
            for r, line in zip(res, f):
                i, _, pay = line.strip().split(",")
                assert int(i) == r[0] and int(pay) == r[1], (mode, "res/LUT mismatch", line)
        weights, st = optimize.weigh(mode, res, COSTS[mode], WCAP_PROB.get(mode), True)
        old = stats.get(mode, {})
        for k in ("max_events", "total_events", "seconds"):
            if k in old: st[k] = old[k]
        with open(lut, "w") as f:
            for r, wt in zip(res, weights):
                f.write(f"{r[0]},{wt},{r[1]}\n")
        stats[mode] = st
        print(optimize.row(mode, st), flush=True)
    json.dump(stats, open(stats_fn, "w"), indent=1)
    index = {"modes": [{"name": m, "cost": float(COSTS[m]), "events": f"books_{m}.jsonl.zst",
                        "weights": f"lookUpTable_{m}_0.csv"} for m in modes.MODES]}
    json.dump(index, open(os.path.join(PUB, "index.json"), "w"), indent=4)
    print(optimize.table(stats))


if __name__ == "__main__":
    main()
