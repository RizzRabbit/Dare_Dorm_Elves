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
        plain = rng.choices(SYMS, weights=symw, k=n_plain)
        assert n_plain >= len(tokens), name
        slots = sorted(rng.sample(range(n_plain), len(tokens)))
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


def main():
    params = json.load(open(os.path.join(HERE, "reel_params.json")))
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
