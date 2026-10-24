"""Builds every reel strip CSV in reels/ from reel_params.json (deterministic, seeded).

Each strip set = 5 reels of equal length L. Per reel r: `w[r]` = share of positions holding an isolated single
wild, `q[r]` = share of positions starting a 4-high WWWW block (a stop on it lands an instant x4 stack).
Non-wild positions follow `sym` weights (SPEC §2 symbols). Respin strips are used for single-cell draws
(each replaced cell = one random stop), so only their W share matters there.
Rarity rule (SPEC §11, LOCKED): wild frequency per reel 2 < 3 < 1 < 4-5 in every set with wilds. Checked here.
Run: python games/elfhaus/make_reels.py
"""
import json, math, os, random

HERE = os.path.dirname(os.path.abspath(__file__))
SYMS = ["H1", "H2", "H3", "H4", "L1", "L2", "L3", "L4", "L5"]
DEFAULT_SYM = [2, 3, 4, 5, 8, 9, 10, 11, 11]


def build_strip(name, p, seed):
    rng = random.Random(seed)
    w, q = p["w"], p.get("q", [0] * 5)
    symw = p.get("sym", DEFAULT_SYM)
    dens = [x for x in list(w) + list(q) if x > 0]
    # strips are capped at 60,000 stops; a density below 6/60,000 can't keep the rarity order after rounding,
    # so a near-zero strip is lifted uniformly (ratios kept) until its rarest positive density is 6/60,000
    if dens and min(dens) < 1e-4 and not p.get("L"):
        k = 1e-4 / min(dens)
        w = [x * k for x in w]; q = [x * k for x in q]
        dens = [x * k for x in dens]
    L = p.get("L") or int(min(60000, max(1000, math.ceil(max(4 / d for d in dens)) if dens else 1000)))
    reels = []
    for r in range(5):
        nq = int(round(q[r] * L)); nw = int(round(w[r] * L))
        if q[r] > 0 and nq == 0: nq = 1
        if w[r] > 0 and nw == 0: nw = 1
        n_plain = L - 4 * nq - nw
        # place blocks/singles as tokens between plain symbols, never touching each other
        tokens = ["Q"] * nq + ["S"] * nw
        rng.shuffle(tokens)
        # optional per-reel symbol mix: "rot": k rotates the weight vector by k*r on reel r (fewer cross-reel
        # matches = fewer connections; a strip-composition lever, paytable untouched)
        k = p.get("rot", 0) * r % len(SYMS)
        sw = symw[-k:] + symw[:-k] if k else symw
        plain = rng.choices(SYMS, weights=sw, k=n_plain)
        assert n_plain > 0, name
        # dense respin strips (single-cell draws only) may need tokens next to each other
        slots = sorted(rng.sample(range(n_plain), len(tokens)) if n_plain >= len(tokens)
                       else rng.choices(range(n_plain), k=len(tokens)))
        out, ti, si = [], 0, 0
        for i, s in enumerate(plain):
            out.append(s)
            while ti < len(slots) and slots[ti] == i:
                out += ["W"] * (4 if tokens[ti] == "Q" else 1); ti += 1
        assert len(out) == L, (name, len(out), L)
        reels.append(out)
    return reels


def wild_freq(reels):
    return [sum(1 for s in col if s == "W") / len(col) for col in reels]


def check_rarity(name, reels, p):
    w, q = p["w"], p.get("q", [0] * 5)
    for arr, lab in ((w, "w"), (q, "q")):
        if sum(arr) == 0: continue
        ok = arr[1] < arr[2] < arr[0] < min(arr[3], arr[4])
        assert ok, f"{name}: {lab} violates rarity 2<3<1<4-5: {arr}"
    f = wild_freq(reels)
    if sum(f) > 0:
        assert f[1] < f[2] < f[0] < min(f[3], f[4]), f"{name}: realised W freq violates rarity: {f}"


def wcap_strips(params):
    """Hot strip set per mode for the wincap books (SDK force_wincap equivalent): every w/q of that mode's strips
    times wcap_scale[mode], so the rarity order is kept."""
    out = {}
    for mode, f in params.get("wcap_scale", {}).items():
        for nm, p in params["strips"].items():
            if nm.startswith(mode + "_") and "_wcap_" not in nm:
                if mode == "dare" and nm.startswith("double_"): continue
                fe = min([f] + [0.25 / x for x in p["w"] if x] + [0.05 / x for x in p.get("q", []) if x])
                if mode == "mystery" and "_fs_" not in nm:
                    fe = 1.0   # Mystery tease/reveal strips stay as-is; only its fresh-start bonus reels run hot
                q = dict(p); q["w"] = [x * fe for x in p["w"]]
                if "q" in p: q["q"] = [x * fe for x in p["q"]]
                out[mode + "_wcap_" + nm[len(mode) + 1:]] = q
    return out


def main():
    params = json.load(open(os.path.join(HERE, "reel_params.json")))
    params["strips"].update(wcap_strips(params))
    os.makedirs(os.path.join(HERE, "reels"), exist_ok=True)
    for i, (name, p) in enumerate(sorted(params["strips"].items())):
        reels = build_strip(name, p, 1000 + i)
        if not p.get("no_rarity_check"):
            check_rarity(name, reels, p)
        with open(os.path.join(HERE, "reels", name + ".csv"), "w") as f:
            for k in range(len(reels[0])):
                f.write(",".join(col[k] for col in reels) + "\n")
    print("wrote", len(params["strips"]), "strips")


if __name__ == "__main__":
    main()
