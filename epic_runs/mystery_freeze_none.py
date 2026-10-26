"""Mystery rebalance with the no-bonus bucket frozen: the published 'none' books (events + LUT weights, same ids) are kept
byte-for-byte; Double Dare / Triple Dare / Epic books come from the new v2-epic run and their within-bucket tilt is
re-solved so the mode returns to 96.670%. Bucket shares stay exactly 50/37/10/3."""
import sys, os, json, io, re
G = r"D:\dev\elfhaus-math-epic\math\games\elfhaus"; sys.path.insert(0, G)
import numpy as np, zstandard, optimize as O
OLD = r"D:\dev\elfhaus-math\math\games\elfhaus\library"; NEW = os.path.join(G, "library")
COST = 600; TOTAL = 10 ** 17
old_res = json.load(open(os.path.join(OLD, "res_mystery.json")))
oldW = {}
for l in open(os.path.join(OLD, "publish_files", "lookUpTable_mystery_0.csv")):
    a, b, c = l.split(","); oldW[int(a)] = (int(b), int(c))
new_res = json.load(open(os.path.join(NEW, "res_mystery.json")))
none_ids = sorted(r[0] for r in old_res if r[4] == "none")
rest_ids = sorted(r[0] for r in old_res if r[4] != "none")
new_rest = [r for r in new_res if r[4] != "none"]          # in id order
assert len(rest_ids) == len(new_rest), (len(rest_ids), len(new_rest))
idmap = {r[0]: i for r, i in zip(new_rest, rest_ids)}       # new id -> assigned (old non-none) id
oldtot = sum(v[0] for v in oldW.values())
p_none = np.array([oldW[i][0] for i in none_ids], float) / oldtot
x_none = np.array([oldW[i][1] / 100 for i in none_ids])
print("none share", p_none.sum(), "none contrib", (p_none * x_none).sum())
# re-solve the tilt for DD/TD/Epic only
x = np.array([r[1] / 100 for r in new_rest]); groups = np.array([r[4] for r in new_rest])
gshare = {k: v for k, v in O.SHARES.items() if k != "none"}
cap = np.zeros(len(x), bool); target = O.TARGET * COST - (p_none * x_none).sum()
# full-mode P5k / CVaR need the none part too
def full(p): return np.concatenate([x_none, x]), np.concatenate([p_none, p])
b = d = 0.0
def solve(b, d):
    a = O._solve_a(x, groups, gshare, cap, 0.0, b, d, target)
    p = O._probs(x, groups, gshare, cap, 0.0, a, b, d); X, P = full(p)
    return a, p, float(P[X >= 5000].sum()), O.cvar(X, P)
a, p, v, cv = solve(b, d)
for _ in range(6):
    if v > O.P5K_MAX:
        lo, hi = -20.0, b
        for _ in range(40):
            bm = (lo + hi) / 2
            if solve(bm, d)[2] > O.P5K_MAX: hi = bm
            else: lo = bm
        b = lo; a, p, v, cv = solve(b, d)
    if cv > O.CVAR_MAX:
        lo, hi = -20.0, d
        for _ in range(40):
            dm = (lo + hi) / 2
            if solve(b, dm)[3] > O.CVAR_MAX: hi = dm
            else: lo = dm
        d = lo; a, p, v, cv = solve(b, d)
    if v <= O.P5K_MAX and cv <= O.CVAR_MAX: break
print("tilt", a, b, d)
w_rest = np.maximum(1, np.round(p * oldtot)).astype(np.uint64)
W = {i: (oldW[i][0], oldW[i][1]) for i in none_ids}
for r, wt in zip(new_rest, w_rest): W[idmap[r[0]]] = (int(wt), r[1])
ids = sorted(W); res = []; noneset = set(none_ids)
oldb = {r[0]: r for r in old_res}; newb = {idmap[r[0]]: r for r in new_rest}
for i in ids:
    r = oldb[i] if i in noneset else newb[i]
    res.append([i, W[i][1], r[2], r[3], r[4]])
wv = np.array([W[i][0] for i in ids], float); pw = wv / wv.sum(); xs = np.array([W[i][1] / 100 for i in ids])
st = O.stats("mystery", [r + [None, 0] for r in res], xs, pw, COST); st.pop("max_events", None); st.pop("total_events", None); st["tilt"] = {"a": round(a, 6), "b": round(b, 6), "d": round(d, 6), "none": "frozen (published v2)"}
print(O.row("mystery", st))
print({k: v for k, v in st.items() if not isinstance(v, (dict, list))})
# write publish files (streamed merge in id order)
pub = os.path.join(NEW, "publish_files"); tmpb = os.path.join(pub, "books_mystery.merged.jsonl.zst")
dctx = zstandard.ZstdDecompressor()
def lines(fn):
    with open(fn, "rb") as f, zstandard.ZstdDecompressor().stream_reader(f) as rd:
        for l in io.TextIOWrapper(rd, encoding="utf-8"): yield l
newl = (l for l in lines(os.path.join(pub, "books_mystery.jsonl.zst")))
noneset = set(none_ids); n_none = n_new = 0
SKIP = os.path.exists(tmpb) and os.path.getsize(tmpb) > 100_000_000   # merged books already written by a previous pass
if not SKIP:
  with open(tmpb, "wb") as fo, zstandard.ZstdCompressor(level=19, threads=-1).stream_writer(fo) as w:
    for l in lines(os.path.join(OLD, "publish_files", "books_mystery.jsonl.zst")):
        bid = int(re.search(r'"id"\s*:\s*(\d+)', l[:80]).group(1))
        if bid in noneset:
            w.write(l.encode()); n_none += 1
        else:
            while True:
                nl = next(newl); bk = json.loads(nl)
                if bk["id"] in idmap: break
            bk["id"] = bid; assert bk["payoutMultiplier"] == W[bid][1]
            w.write((json.dumps(bk, separators=(",", ":")) + "\n").encode()); n_new += 1
newl.close()
print("books written: none kept", n_none, "new DD/TD/Epic", n_new)
os.replace(tmpb, os.path.join(pub, "books_mystery.jsonl.zst"))
with open(os.path.join(pub, "lookUpTable_mystery_0.csv"), "w") as f:
    for i in ids: f.write(f"{i},{W[i][0]},{W[i][1]}\n")
json.dump(res, open(os.path.join(NEW, "res_mystery.json"), "w"))
S = json.load(open(os.path.join(NEW, "stats_summary.json"))); S["mystery"] = st
json.dump(S, open(os.path.join(NEW, "stats_summary.json"), "w"), indent=1)





