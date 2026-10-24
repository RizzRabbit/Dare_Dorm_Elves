"""Writes the EVENTS.md sample / force books (one per feature state) to math/samples/<name>.json (pretty JSON).
python games/elfhaus/make_samples.py   (uses the same reel strips as run_local.py; searches seeds until each
condition holds, then replays that seed with events on, so every sample is a real book of its mode)."""
import json, os, sys, random
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import game_calculations as gc, modes, run_local

OUT = os.path.join(HERE, "..", "..", "samples")


def adjacent(pat):
    return any(r + 1 in pat for r in pat)


CASES = [  # name, mode, variant, kwargs, condition(rnd)
    ("base_zero", "base", "", {}, lambda r: r.total == 0),
    ("base_win", "base", "", {}, lambda r: r.total > 0 and r.stats["respins"] == 0 and not r.stats["tier"]),
    ("base_respin3", "base", "", {}, lambda r: r.stats["respins"] == 3 and not r.stats["tier"]),
    ("base_dare", "base", "", {}, lambda r: r.stats["tier"] in ("dare",) and not r.stats["upgrade"]),
    ("base_dare_upgrade", "base", "", {}, lambda r: r.stats["upgrade"]),
    ("base_double", "base", "", {}, lambda r: r.stats["tier"] == "double_dare" and not r.stats["upgrade"]),
    ("base_triple", "base", "", {}, lambda r: r.stats["tier"] == "triple_dare"),
    ("base_hidden", "base", "", {}, lambda r: r.stats["tier"] == "hidden"),
    ("ante_trigger", "ante", "", {}, lambda r: r.stats["tier"] is not None),
    ("dare_buy", "dare", "", {}, lambda r: True),
    ("double_buy", "double_dare", "", {}, lambda r: True),
    ("triple_buy", "triple_dare", "", {}, lambda r: True),
    ("mystery_none", "mystery", "", {"bucket": "none"}, lambda r: True),
    ("mystery_double", "mystery", "", {"bucket": "double_dare"}, lambda r: True),
    ("mystery_triple", "mystery", "", {"bucket": "triple_dare"}, lambda r: True),
    ("mystery_hidden", "mystery", "", {"bucket": "hidden"}, lambda r: True),
    ("egw_nonadjacent", "egw", "", {}, lambda r: not adjacent(r.stats.get("egw_pattern", ()))),
    ("egw_adjacent", "egw", "", {}, lambda r: adjacent(r.stats.get("egw_pattern", ()))),
] + [(m + "_wincap", m, "wcap", {"bucket": "hidden"} if m == "mystery" else {}, lambda r: r.total >= gc.CAP_C)
     for m in modes.MODES]


def find(mode, variant, kw, cond, limit=3_000_000):
    S = modes.build_sets(mode, variant)
    for k in range(limit):
        random.seed(k)
        rnd = gc.Round(gc.Emitter(False))
        modes.play_round(mode, S, rnd, **kw)
        if cond(rnd):
            random.seed(k)
            rnd = gc.Round(gc.Emitter(True))
            modes.play_round(mode, S, rnd, **kw)
            assert cond(rnd)
            return rnd, k
    return None, None


def main(only=None):
    os.makedirs(OUT, exist_ok=True)
    for name, mode, variant, kw, cond in CASES:
        if only and name not in only: continue
        rnd, k = find(mode, variant, kw, cond)
        if rnd is None:
            print("NOT FOUND", name); continue
        bucket = kw.get("bucket")
        book = run_local.book_of(1, mode, rnd, run_local.criteria_of(mode, rnd, bucket))
        book["mode"] = mode
        json.dump(book, open(os.path.join(OUT, name + ".json"), "w"), indent=1)
        print(f"{name}: seed {k}, {rnd.total/100:.2f}x, {len(rnd.emit.events)} events", flush=True)


if __name__ == "__main__":
    main(sys.argv[1:] or None)
