"""Mode -> strip-set wiring (SPEC §10/§11 per-mode reel sets) and a round dispatcher shared by the SDK
gamestate and the fast tuning harness."""
import json, os, random
import game_calculations as gc

HERE = os.path.dirname(os.path.abspath(__file__))
MODES = ["base", "ante", "dare", "double_dare", "triple_dare", "mystery", "egw"]
FS_TIERS = {"base": gc.TIERS, "ante": gc.TIERS, "dare": ("dare",), "double_dare": ("double_dare",),
            "triple_dare": ("triple_dare",), "mystery": ("double_dare", "triple_dare", "hidden"), "egw": ()}
_PARAMS = None


def params():
    global _PARAMS
    if _PARAMS is None:
        _PARAMS = json.load(open(os.path.join(HERE, "reel_params.json")))
    return _PARAMS


def strip_names(mode, variant=""):
    """variant '' = normal, 'wcap' = the force_wincap distribution's strip set."""
    p = mode + ("_wcap" if variant else "")
    names = {"spin": p + "_spin", "respin": p + "_respin"}
    names["fs"] = {t: p + "_fs_" + t for t in FS_TIERS[mode]}
    return names


def all_strip_names(variants=("", "wcap")):
    out = []
    for m in MODES:
        for v in variants:
            n = strip_names(m, v)
            for k, x in n.items():
                if k == "fs": out += list(x.values())
                else: out.append(x)
    return out


def load_csv(name):
    cols = None
    with open(os.path.join(HERE, "reels", name + ".csv")) as f:
        for line in f:
            parts = line.strip().split(",")
            if cols is None: cols = [[] for _ in parts]
            for i, s in enumerate(parts): cols[i].append(s)
    return cols


def build_sets(mode, variant="", reels=None):
    """reels: {name: 5 columns}; defaults to reading reels/*.csv."""
    names = strip_names(mode, variant)
    get = (lambda n: gc.Strip(n, reels[n])) if reels is not None else (lambda n: gc.Strip(n, load_csv(n)))
    S = {}
    for k, v in names.items():
        S[k] = {t: get(n) for t, n in v.items()} if k == "fs" else get(v)
    S["guar"] = params().get("guar", {}).get(mode, gc.GUAR_WEIGHTS)
    return S


def play_round(mode, S, rnd, bucket=None, egw_pattern=None):
    if mode in ("base", "ante"):
        return gc.round_base(rnd, S)
    if mode in ("dare", "double_dare", "triple_dare"):
        return gc.round_buy(rnd, S, mode)
    if mode == "mystery":
        if bucket is None:
            bucket = random.choices(list(gc.MYSTERY_ODDS), weights=list(gc.MYSTERY_ODDS.values()))[0]
        return gc.round_mystery(rnd, S, bucket)
    if mode == "egw":
        return gc.round_egw(rnd, S, pattern=egw_pattern)
    raise ValueError(mode)
