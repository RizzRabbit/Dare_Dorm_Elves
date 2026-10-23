# Toy Monte Carlo v4 for Dare Dorm - Elves, matching DECISIONS.md (2026-10-22, LOCKED).
# NOT the math model: every number is a placeholder "toy sim, to tune in math-SDK".
# Rules: 20 lines, 5x4. Wild x1, +1 per respin step it connects in (R6). Full reel = sum of its 4 cells
# (instant stack = 4 x x1 = x4, A5). Line mult: adjacent full reels multiply, other wilds add (A1/A2).
# Respins (R3): after each evaluation, non-wild cells IN connected winning runs (runs containing a wild, D3)
# are replaced; wilds lock; all other cells stay. Max 3 respins, stop when nothing connects (R2).
# Every step pays (R5). Bonus wilds: all wilds sticky in every tier (A3 uniform; Dare sticky is locked).
import random, sys, math
ROWS, REELS, CAP, SPIN_CAP = 4, 5, 50_000.0, 18
LINES=[[0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],[3,3,3,3,3],[0,1,2,1,0],[3,2,1,2,3],[1,0,0,0,1],[2,3,3,3,2],
 [0,1,0,1,0],[3,2,3,2,3],[1,2,1,2,1],[2,1,2,1,2],[0,0,1,0,0],[3,3,2,3,3],[1,1,0,1,1],[2,2,3,2,2],
 [0,1,1,1,0],[3,2,2,2,3],[1,2,3,2,1],[2,1,0,1,2]]
PAY={'W':(25,100,500),'H1':(25,100,500),'H2':(20,75,300),'H3':(15,50,200),'H4':(10,40,150),
 'L1':(5,20,80),'L2':(5,15,60),'L3':(4,10,40),'L4':(3,8,30),'L5':(3,8,30)}
SYMS=['H1','H2','H3','H4','L1','L2','L3','L4','L5']
WT=[2,3,4,5,8,9,10,11,11]
PSCALE=1.0   # global pay scale lever (pays)
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
    """returns win (x bet), connected wild ids, cells to respin, per-line detail"""
    win=0.0; conw=set(); resp=set(); det=[]
    for i,ln in enumerate(LINES):
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
        m=line_mult(run,sym,sv,full); p=max(ps,pw)*PSCALE
        win+=p*m/len(LINES); det.append((i+1,k,base if ps>=pw else 'W',p,m))
        wc=[c for c in run if sym[c[0]][c[1]]=='W']
        if wc:
            conw|={('F',c[0]) if c[0] in full else c for c in wc}
            resp|={c for c in run if sym[c[0]][c[1]]!='W'}
    return win,conw,resp,det
def draw(w, wt): return 'W' if random.random()<w else random.choices(SYMS,wt)[0]
def wl(w): return w if isinstance(w,(list,tuple)) else [w]*REELS
def sequence(full, sticky, q, w, wt=WT, preset=None, prior=0.0, trace=None):
    """One spin + up to 3 respins. full {reel:val} locked; sticky {(r,row):val}.
    Returns (spin win, full, singles{cell:val}, new_stacks, capped)."""
    full=dict(full); sym=[[None]*ROWS for _ in range(REELS)]; sv={}; w=wl(w)
    for r in range(REELS):
        if r in full: sym[r]=['W']*ROWS; continue
        if preset is None and random.random()<q[r]:
            sym[r]=['W']*ROWS
            for row in range(ROWS): sv[(r,row)]=1
            continue
        for row in range(ROWS):
            if (r,row) in sticky: sym[r][row]='W'; sv[(r,row)]=sticky[(r,row)]
            else:
                s=preset[r][row] if preset else draw(w[r],wt); sym[r][row]=s
                if s=='W': sv[(r,row)]=preset_val(preset,r,row) if preset else 1
    new=[]; tot=0.0; step=0
    while True:
        for r in range(REELS):
            if r not in full and all(sym[r][row]=='W' for row in range(ROWS)):
                full[r]=sum(sv.pop((r,row)) for row in range(ROWS)); new.append(r)
        win,conw,resp,det=evaluate(sym,sv,full)
        if trace is not None: trace.append(dict(step=step,board=[[sym[r][row] for r in range(REELS)] for row in range(ROWS)],
            full=dict(full),sv=dict(sv),win=win,det=det,conw=sorted(map(str,conw)),resp=sorted(resp)))
        tot+=win
        if prior+tot>=CAP: return CAP-prior, full, sv, new, True
        for c in conw:
            if c[0]=='F': full[c[1]]+=1
            else: sv[c]+=1
        if not conw or not resp or step==3: break
        step+=1
        for (r,row) in resp:
            s=draw(w[r],wt); sym[r][row]=s
            if s=='W': sv[(r,row)]=1
    return tot, full, sv, new, False
def preset_val(p,r,row): return 1
def tier_of(full, sv):
    nf=len(full); ns=len(sv)
    if nf>=2: return 'hidden'
    if nf==1: return 'triple' if ns>=2 else 'double'
    return 'dare' if ns>=4 else None
START={'dare':8,'double':10,'triple':12,'hidden':14}
def bonus(tier, full, sv, P, prior=0.0):
    q=P['qb'][tier]; w=P['wb'][tier]; budget=START[tier]; played=0; tot=0.0
    sticky=dict(sv) if P['sticky'] else {}
    while played<budget:
        played+=1
        win,full,sv2,new,cap=sequence(full,sticky,q,w,prior=prior+tot)
        tot+=win
        if cap: return tot,True
        if P['sticky']: sticky=sv2
        budget=min(budget+2*len(new),SPIN_CAP)
    return tot,False
def buy(tier, P):
    """real trigger spin on buy-trigger strips, rejection until the final board is exactly this tier"""
    qt,wt_=P['qt'][tier],P['wt'][tier]
    while True:
        win,full,sv,new,cap=sequence({}, {}, qt, wt_)
        if cap: return CAP,True
        if tier_of(full,sv)==tier: break
    b,cap=bonus(tier,full,sv,P,prior=win)
    return win+b,cap
def egw(P):
    pats,wts=zip(*P['egw'])
    pat=random.choices(pats,wts)[0]
    win,full,sv,new,cap=sequence({r-1:4 for r in pat},{},[0]*5,P['wegw'])
    return win,cap
def mystery_nobonus(P):
    """3 stacked wilds on one reel, respins land no new wilds (bucket 'no bonus')"""
    r=random.randrange(5); top=random.randrange(2)
    st={(r,top+i):1 for i in range(3)}
    win,full,sv,new,cap=sequence({},st,[0]*5,0.0)
    return win,cap
def base_spin(P, ante=False):
    q=P['qa'] if ante else P['q']; w=P['wa'] if ante else P['w']
    win,full,sv,new,cap=sequence({},{},q,w)
    if cap: return CAP,True,None
    t=tier_of(full,sv)
    if t:
        b,cap=bonus(t,full,sv,P,prior=win); return win+b,cap,t
    return win,False,None
def stats(xs, cost=1.0):
    n=len(xs); m=sum(xs)/n; s=sorted(xs,reverse=True); k=max(1,n//1000)
    return dict(mean=m, rtp_at_cost=m/cost, p50k=sum(x>=CAP for x in xs)/n, p5k=sum(x>=5000 for x in xs)/n,
                cvar=sum(s[:k])/k, maxv=s[0], hit=sum(x>0 for x in xs)/n,
                std=(sum((x-m)**2 for x in xs)/n)**0.5)
P0=dict(
  q=[0.0015,0.0004,0.0015,0.0004,0.0015], w=0.035,       # base strips: instant-stack odds per reel, single-wild density
  qa=[0.003,0.0008,0.003,0.0008,0.003], wa=0.042,        # ante strips (~2x triggers)
  qb={'dare':[0.004,0.0005,0.004,0.0005,0.004],'double':[0.004,0.0005,0.004,0.0005,0.004],
      'triple':[0.005,0.0006,0.005,0.0006,0.005],'hidden':[0.005,0.0006,0.005,0.0006,0.005]},
  wb={'dare':0.010,'double':0.008,'triple':0.008,'hidden':0.008},
  qt={t:[0.05,0.004,0.05,0.004,0.05] for t in START}, wt={'dare':0.10,'double':0.03,'triple':0.06,'hidden':0.03},
  egw=[((1,3),30),((1,4),15),((2,4),15),((1,5),10),((2,5),10),((1,3,5),12),((1,2),4),((4,5),4),((1,2,4),1.5),((2,3),1),((3,4),1),
       ((2,3,4),0.12),((1,2,3),0.08),((1,2,4,5),0.04),((2,3,4,5),0.005),((1,2,3,4),0.003),((1,2,3,4,5),0.002)],
  wegw=0.004, sticky=True)
