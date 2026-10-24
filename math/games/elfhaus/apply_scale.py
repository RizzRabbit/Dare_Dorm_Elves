"""python games/elfhaus/apply_scale.py <prefix> <factor>: bakes a tuning factor into reel_params.json."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); fn = os.path.join(HERE, "reel_params.json")
p = json.load(open(fn)); pre, f = sys.argv[1], float(sys.argv[2])
for nm, v in p["strips"].items():
    if nm.startswith(pre):
        v["w"] = [round(x * f, 7) for x in v["w"]]
        if "q" in v: v["q"] = [round(x * f, 8) for x in v["q"]]
json.dump(p, open(fn, "w"), indent=1)
