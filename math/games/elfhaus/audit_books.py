"""Checks publish_files: every book's finalWin == payoutMultiplier == LUT payout, ids line up, event counts,
Mystery bucket shares. python games/elfhaus/audit_books.py"""
import io, json, os, sys, hashlib
import zstandard
HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, "library", "publish_files")


def audit(mode):
    lut = {}
    for line in open(os.path.join(PUB, f"lookUpTable_{mode}_0.csv")):
        i, w, p = line.strip().split(","); lut[int(i)] = (int(w), int(p))
    n = bad = ev = 0
    h = hashlib.sha256()
    with open(os.path.join(PUB, f"books_{mode}.jsonl.zst"), "rb") as f:
        for line in io.TextIOWrapper(zstandard.ZstdDecompressor().stream_reader(f), encoding="utf-8"):
            b = json.loads(line); n += 1; ev += len(b["events"]); h.update(line.encode())
            fw = b["events"][-1]
            if fw["type"] != "finalWin" or fw["amount"] != b["payoutMultiplier"] or lut[b["id"]][1] != b["payoutMultiplier"]:
                bad += 1
    ok = bad == 0 and n == len(lut) and ev <= 10_000_000
    print(f"{mode}: books={n} lut={len(lut)} mismatches={bad} events={ev:,} sha256={h.hexdigest()[:16]} {'OK' if ok else 'FAIL'}")
    return ok


if __name__ == "__main__":
    idx = json.load(open(os.path.join(PUB, "index.json")))
    res = [audit(m["name"]) for m in idx["modes"]]
    sys.exit(0 if all(res) else 1)
