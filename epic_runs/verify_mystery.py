import zstandard, io, json, re, hashlib, numpy as np
OLD=r"D:\dev\elfhaus-math\math\games\elfhaus\library"; NEW=r"D:\dev\elfhaus-math-epic\math\games\elfhaus\library"
def lut(p):
    W={}
    for l in open(p):
        a,b,c=l.split(","); W[int(a)]=(int(b),int(c))
    return W
def lines(fn):
    with open(fn,"rb") as f, zstandard.ZstdDecompressor().stream_reader(f) as rd:
        for l in io.TextIOWrapper(rd,encoding="utf-8"): yield l
oW=lut(OLD+r"\publish_files\lookUpTable_mystery_0.csv"); nW=lut(NEW+r"\publish_files\lookUpTable_mystery_0.csv")
ores=json.load(open(OLD+r"\res_mystery.json")); bucket={r[0]:r[4] for r in ores}
none=set(i for i,b in bucket.items() if b=="none")
print("none weights identical:", all(oW[i]==nW[i] for i in none), "ids identical:", sorted(oW)==sorted(nW))
oh={}; 
for l in lines(OLD+r"\publish_files\books_mystery.jsonl.zst"):
    i=int(re.search(r'"id":(\d+)',l[:40]).group(1))
    if i in none: oh[i]=hashlib.md5(l.encode()).hexdigest()
same=0; bad=0; nb={}; seen=0; prev=0; order=True; ev={}
for l in lines(NEW+r"\publish_files\books_mystery.jsonl.zst"):
    b=json.loads(l); i=b["id"]; seen+=1; order&= i>prev; prev=i
    if b["payoutMultiplier"]!=nW[i][1] or b["events"][-1]["amount"]!=b["payoutMultiplier"]: bad+=1
    if i in none: same+= hashlib.md5(l.encode()).hexdigest()==oh[i]
    else:
        crit=b["criteria"]; nb[i]=crit
        if crit in("hidden","wincap"):
            for e in b["events"]:
                if e["type"]=="freeSpinTrigger": ev.setdefault("fs",set()).add(e["totalFs"])
                if e["type"]=="guaranteedStacks": ev.setdefault("gv",set()).update(s["value"] for s in e["stacks"] if not s["absorbed"])
print("books", seen, "in id order", order, "payout/LUT mismatches", bad, "none books byte-identical", same, "/", len(none))
print("Epic freeSpinTrigger totalFs seen:", ev.get("fs"), " guaranteed stack values (no absorbed singles):", sorted(ev.get("gv",[]))[:5])
def wq(x,w,q):
    o=np.argsort(x);c=np.cumsum(w[o])/w.sum();return x[o][np.searchsorted(c,q)]
nres=json.load(open(NEW+r"\res_mystery.json")); tot=sum(v[0] for v in nW.values())
for bk in ("none","double_dare","triple_dare","hidden"):
    ids=[r[0] for r in nres if r[4]==bk]; x=np.array([nW[i][1]/100 for i in ids]); w=np.array([nW[i][0] for i in ids],float)
    print(f"{bk}: books={len(x)} share={w.sum()/tot:.5f} mean={(w*x).sum()/w.sum():.1f} contrib={(w*x).sum()/tot:.2f}x min={x.min():.1f} p1={wq(x,w,.01):.0f} p5={wq(x,w,.05):.0f} median={wq(x,w,.5):.0f} P(>600x)={w[x>600].sum()/w.sum()*100:.2f}% P(<=600x)={w[x<=600].sum()/w.sum()*100:.2f}% P(50000x)={w[x>=50000].sum()/w.sum()*100:.3f}%")
