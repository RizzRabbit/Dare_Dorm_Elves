# Toy Monte Carlo v3 (21:33 lock): NO global multiplier. Wilds start x1, +1 per connection.
# Full stack value = sum of its 4 wilds. Line multiplier = sum over wild groups in the winning run, where
# a group of ADJACENT full-reel wilds multiplies (product) and every other wild (single or non-adjacent
# stack) adds. Respins: hold wilds + symbols on winning lines through a wild; hard max 3; stop early when
# nothing new is held; pay once at the end. 20 lines, 5x4. NOT the math model: every input is a
# placeholder "to tune in math-SDK sim".
import random, sys
from toy_sim import LINES, PAY, SYMS, WT
ROWS, REELS, CAP, SPIN_CAP = 4, 5, 50_000.0, 18
GROW_ONCE=False          # lever: +1 counted once per spin sequence instead of per evaluation step
QREEL=[1,1,1,1,1]        # lever: per-reel stack-completion weight (e.g. reels 2 and 4 rarer)
START_REELS=None         # lever: reels the trigger stacks may sit on
def line_mult(run, sym, sv, full):
    m=0; r=0; k=len(run)
    while r<k:
        if r in full:
            p=1
            while r<k and r in full: p*=full[r]; r+=1
            m+=p
        else:
            c=run[r]
            if sym[c[0]][c[1]]=='W': m+=sv[c]
            r+=1
    return max(1,m)
def evaluate(sym, sv, full):
    win=0.0; conw=set(); held=set()
    for ln in LINES:
        cells=[sym[r][ln[r]] for r in range(REELS)]
        base=next((s for s in cells if s!='W'),'W'); n=0
        for s in cells:
            if s==base or s=='W': n+=1
            else: break
        wn=0
        for s in cells:
            if s=='W': wn+=1
            else: break
        if n<3: continue
        ps=PAY[base][n-3]; pw=PAY['W'][wn-3] if wn>=3 else 0
        k=n if ps>=pw else wn
        run=[(r,ln[r]) for r in range(k)]
        win+=max(ps,pw)*line_mult(run,sym,sv,full)/len(LINES)
        wc=[c for c in run if sym[c[0]][c[1]]=='W']
        if wc: conw|={('F',c[0]) if c[0] in full else c for c in wc}; held|=set(run)
    return win,conw,held
def spin(full, sticky, w, q, persist):
    """full {reel:value} carried locked stacks; sticky {(r,row):value}. Returns win, newly completed {reel:value}"""
    full=dict(full); sym=[[None]*ROWS for _ in range(REELS)]; sv={}
    def fill(r,row):
        if (r,row) in sticky: sym[r][row]='W'; sv[(r,row)]=sticky[(r,row)]
        elif random.random()<w: sym[r][row]='W'; sv[(r,row)]=1
        else: sym[r][row]=random.choices(SYMS,WT)[0]
    for r in range(REELS):
        if r in full or random.random()<q*QREEL[r]:
            if r not in full: full[r]=4
            for row in range(ROWS): sym[r][row]='W'
        else:
            for row in range(ROWS): fill(r,row)
    held=set(); steps=0; grown=set()
    while True:
        # complete stacks formed by singles (value = sum of the 4)
        for r in range(REELS):
            if r not in full and all(sym[r][row]=='W' for row in range(ROWS)):
                full[r]=sum(sv[(r,row)] for row in range(ROWS))
        win,conw,h=evaluate(sym,sv,full)
        if GROW_ONCE: conw-=grown
        grown|=conw
        for c in conw:                       # +1 per connection, each evaluation step
            if c[0]=='F': full[c[1]]+=1
            else: sv[c]+=1
        nh=(h|{(r,row) for r in range(REELS) for row in range(ROWS) if sym[r][row]=='W'})-held
        held|=nh
        if steps==3 or not conw or not nh: break
        steps+=1
        for r in range(REELS):
            for row in range(ROWS):
                if (r,row) not in held: fill(r,row)
    if persist:   # True: every single wild sticks; 'own': only wilds that were already sticky keep (and grow)
        for (r,row),v in sv.items():
            if r not in full and (persist is True or (r,row) in sticky): sticky[(r,row)]=v
    return win, full
def bonus(spins, n_start, start_val, extra2, sticky_singles, q, w):
    full={r:start_val for r in random.sample(START_REELS or range(REELS),n_start)}; sticky={}
    if extra2:
        r=random.choice([x for x in range(REELS) if x not in full]); sticky={(r,0):1,(r,1):1}
    tot=0; played=0; budget=spins
    while played<budget:
        played+=1
        win,newfull=spin(full,sticky,w,q,sticky_singles)
        if not sticky_singles and extra2: pass
        added=[r for r in newfull if r not in full]
        full=newfull
        for r in added:
            for row in range(ROWS): sticky.pop((r,row),None)
        budget=min(budget+2*len(added),SPIN_CAP)
        tot+=win
        if tot>=CAP: return CAP
    return tot
TIERS={'dare':(8,0,4,False,True),'double':(10,1,4,False,False),'triple':(12,1,4,True,'own'),'hidden':(14,2,4,False,False)}
if __name__=='__main__':
    random.seed(33); n=int(sys.argv[1]); q=float(sys.argv[2]); w=float(sys.argv[3])
    if len(sys.argv)>4 and sys.argv[4]=='levers':
        GROW_ONCE=True; QREEL=[1,0.1,1,0.1,1]; START_REELS=[0,2,4]
        print('levers ON: grow once per spin, reels 2/4 stack odds x0.1, trigger stacks on reels 1/3/5')
    print(f"q={q} w={w} n={n}")
    for t,a in TIERS.items():
        res=[bonus(*a,q,w) for _ in range(n)]
        m=sum(res)/n; h=sum(x>=CAP for x in res)/n; b=sum(x>=5000 for x in res)/n
        print(f"  {t:7s} mean={m:8.1f}x P(50k)={h:.4f} ({'1 in %s'%format(round(1/h),',') if h else '0/%d'%n}) P(>=5k)={b:.4f} price~{m/0.967:,.0f}x",flush=True)
