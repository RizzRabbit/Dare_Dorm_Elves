"""Development helper: re-weights saved Mystery results (library/res_mystery.json) under candidate bucket odds.
python games/elfhaus/odds_search.py none,double,triple,hidden [cost] ..."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import optimize
res = [tuple(r) + (0, 0) for r in json.load(open(os.path.join(HERE, "library", "res_mystery.json")))]
res = [r[:5] + (None, 0) for r in res]
for arg in sys.argv[1:]:
    parts = arg.split(":"); o = [float(v) for v in parts[0].split(",")]
    optimize.SHARES = dict(zip(["none", "double_dare", "triple_dare", "hidden"], [v / 100 for v in o]))
    cost = float(parts[1]) if len(parts) > 1 else None
    if cost is None:   # price from the untilted mean
        _, st0 = optimize.weigh("mystery", res, 1.0, None, False); cost = round(st0["rtp"] / 0.9667 / 5) * 5
    _, st = optimize.weigh("mystery", res, cost, None, True)
    print(arg, "cost", cost, optimize.row("mystery", st), st["tilt"])
