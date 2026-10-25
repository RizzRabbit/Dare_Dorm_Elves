"""Elfhaus local runner: python games/elfhaus/run_local.py <base_n> <bonus_n> <sims 0/1> <opt 0/1>

Simulates every bet mode with full EVENTS.md books, writes the Stake publish files and prints the acceptance table.
The output format is the math-sdk publish layout (index.json, books_<mode>.jsonl.zst, lookUpTable_<mode>_0.csv with
id,weight,payout as uint64). The optimizer step is a weight tilt (see optimize.py) instead of the SDK's Rust program.
"""
import json, os, sys, random, time, io
from multiprocessing import Pool
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import game_calculations as gc, modes, make_reels, optimize

LIB = os.path.join(HERE, "library")
PUB = os.path.join(LIB, "publish_files")
TMP = os.path.join(LIB, "temp_books")
CFG = json.load(open(os.path.join(HERE, "reel_params.json")))
COSTS = CFG["costs"]
# wincap books per mode (generated on the mode's hot "_wcap" strip set, SDK force_wincap equivalent) and their
# total LUT probability
WCAP_BOOKS = CFG.get("wcap_books", 12)
WCAP_PROB = CFG.get("wcap_prob", {})
SEED = 20261024
MYSTERY_BOOK_SPLIT = {"none": 0.4, "double_dare": 0.4, "triple_dare": 0.12, "hidden": 0.08}


def criteria_of(mode, rnd, bucket):
    if rnd.total >= gc.CAP_C: return "wincap"
    if mode == "mystery": return bucket
    if rnd.stats["tier"]: return "freegame"
    return "basegame" if rnd.total > 0 else "0"


def book_of(bid, mode, rnd, crit):
    ev = rnd.emit.events
    assert ev[-1]["type"] == "finalWin" and ev[-1]["amount"] == rnd.total, (mode, bid)
    return {"id": bid, "payoutMultiplier": rnd.total, "events": ev, "criteria": crit,
            "baseGameWins": rnd.base_c / 100, "freeGameWins": rnd.free_c / 100}


_S = {}
def _sets(mode, variant):
    k = (mode, variant)
    if k not in _S: _S[k] = modes.build_sets(mode, variant)
    return _S[k]


def _work(args):
    """Plays one chunk of books into its own temp jsonl; returns [(id, payout, criteria, tier, egw_pattern)]."""
    mode, start, jobs, seed = args
    random.seed(seed)
    out, path = [], os.path.join(TMP, f"{mode}_{start:09d}.jsonl")
    with open(path, "w") as f:
        for i, (bucket, wcap) in enumerate(jobs):
            bid = start + i
            for attempt in range(1, 2000001):
                rnd = gc.Round(gc.Emitter(True))
                modes.play_round(mode, _sets(mode, "wcap" if wcap else ""), rnd, bucket=bucket)
                if not wcap or rnd.total >= gc.CAP_C: break
            else:
                raise RuntimeError(f"{mode}: no wincap book found")
            crit = criteria_of(mode, rnd, bucket)
            f.write(json.dumps(book_of(bid, mode, rnd, crit), separators=(",", ":")) + "\n")
            out.append((bid, rnd.total, crit, rnd.stats["tier"], bucket, rnd.stats.get("egw_pattern"),
                        len(rnd.emit.events)))
    return out


def simulate(mode, n, procs=os.cpu_count() or 8):
    jobs = []
    if mode == "mystery":
        # book counts per bucket are a fixed split for coverage; the LUT normalises each bucket to MYSTERY_ODDS
        for b, share in MYSTERY_BOOK_SPLIT.items():
            jobs += [(b, False)] * int(round(n * share))
        jobs += [("hidden", True)] * WCAP_BOOKS
    else:
        jobs = [(None, False)] * n + [(None, True)] * WCAP_BOOKS
    # spread the (slow, rejection-sampled) wincap jobs over the chunks instead of leaving them all in the last one
    wc = [j for j in jobs if j[1]]; jobs = [j for j in jobs if not j[1]]
    step = max(1, len(jobs) // max(1, len(wc)))
    for i, j in enumerate(wc):
        jobs.insert(min(len(jobs), i * (step + 1)), j)
    k = max(1, -(-len(jobs) // (procs * 4)))
    chunks = [(mode, 1 + s, jobs[s:s + k], SEED + modes.MODES.index(mode) * 100000 + s // k)
              for s in range(0, len(jobs), k)]
    with Pool(procs) as p:
        res = [r for part in p.map(_work, chunks) for r in part]
    return res, [os.path.join(TMP, f"{mode}_{c[1]:09d}.jsonl") for c in chunks]


def write_publish(mode, res, files, weights):
    import zstandard
    os.makedirs(PUB, exist_ok=True)
    cctx = zstandard.ZstdCompressor(level=19, threads=-1)
    with open(os.path.join(PUB, f"books_{mode}.jsonl.zst"), "wb") as fo:
        with cctx.stream_writer(fo) as w:
            for fn in files:
                with open(fn, "rb") as fi:
                    for line in fi: w.write(line)
    with open(os.path.join(PUB, f"lookUpTable_{mode}_0.csv"), "w") as f:
        for r, wt in zip(res, weights):
            f.write(f"{r[0]},{wt},{r[1]}\n")


def main():
    base_n, bonus_n = int(sys.argv[1]), int(sys.argv[2])
    do_sims, do_opt = sys.argv[3] == "1", sys.argv[4] == "1"
    only = sys.argv[5].split(",") if len(sys.argv) > 5 else modes.MODES
    if not os.path.isdir(os.path.join(HERE, "reels")) or not os.listdir(os.path.join(HERE, "reels")):
        make_reels.main()
    os.makedirs(TMP, exist_ok=True)
    stats_fn = os.path.join(LIB, "stats_summary.json")
    stats = json.load(open(stats_fn)) if os.path.exists(stats_fn) else {}
    for mode in only:
        if not do_sims: continue
        t = time.time()
        n = base_n if mode in ("base", "ante") else bonus_n
        if mode == "mystery": n = max(100, n // 100 * 100)
        res, files = simulate(mode, n)
        json.dump([list(r[:5]) for r in res], open(os.path.join(LIB, f"res_{mode}.json"), "w"))
        weights, st = optimize.weigh(mode, res, COSTS[mode], WCAP_PROB.get(mode), do_opt)
        write_publish(mode, res, files, weights)
        for fn in files: os.remove(fn)
        st["seconds"] = round(time.time() - t, 1)
        stats[mode] = st
        print(optimize.row(mode, st), flush=True)
    json.dump(stats, open(stats_fn, "w"), indent=1)
    index = {"modes": [{"name": m, "cost": float(COSTS[m]), "events": f"books_{m}.jsonl.zst",
                        "weights": f"lookUpTable_{m}_0.csv"} for m in modes.MODES]}
    os.makedirs(PUB, exist_ok=True)
    json.dump(index, open(os.path.join(PUB, "index.json"), "w"), indent=4)
    print(optimize.table(stats))


if __name__ == "__main__":
    main()
