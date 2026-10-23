# NOTE (21:33 model): only LINES, PAY, SYMS, WT here are current (imported by toy_sim3.py). The __main__ block below is the obsolete 21:25 additive-global-multiplier toy; ignore its output.
# Toy Monte Carlo for Elfhaus (ADDITIVE multiplier, 20 lines, 5x4).
# NOT the math model. Every input is a placeholder "to tune in math-SDK sim".
# Shows: how often additive-multiplier rounds reach the 50,000x round cap, and which levers matter.
import random, sys
ROWS, REELS, CAP, SPIN_CAP = 4, 5, 50_000.0, 18
LINES = [  # 20 fixed lines, row index per reel (0 = top)
 [0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],[3,3,3,3,3],[0,1,2,1,0],[3,2,1,2,3],[1,0,0,0,1],[2,3,3,3,2],
 [0,1,0,1,0],[3,2,3,2,3],[1,2,1,2,1],[2,1,2,1,2],[0,0,1,0,0],[3,3,2,3,3],[1,1,0,1,1],[2,2,3,2,2],
 [0,1,1,1,0],[3,2,2,2,3],[1,2,3,2,1],[2,1,0,1,2]]
PAY = {  # line-bet units for 3/4/5 of a kind; total bet = 20 line bets
 'W':(25,100,500),'H1':(25,100,500),'H2':(20,75,300),'H3':(15,50,200),'H4':(10,40,150),
 'L1':(5,20,80),'L2':(5,15,60),'L3':(4,10,40),'L4':(3,8,30),'L5':(3,8,30)}
SYMS = ['H1','H2','H3','H4','L1','L2','L3','L4','L5']
WT   = [ 2,   3,   4,   5,   8,   9,  10,  11,  11]   # bonus-reel weights (placeholder)
def evaluate(board, stack_reels):
    """board[r][row]; returns (win in x total bet, connected?)"""
    win=0.0; conn=False
    for ln in LINES:
        cells=[board[r][ln[r]] for r in range(REELS)]
        base=next((s for s in cells if s!='W'),'W')
        n=0
        for s in cells:
            if s==base or s=='W': n+=1
            else: break
        if n>=3:
            # best of symbol pay vs pure-wild prefix pay
            wn=0
            for s in cells:
                if s=='W': wn+=1
                else: break
            p=max(PAY[base][n-3], PAY['W'][wn-3] if wn>=3 else 0)
            win+=p/len(LINES)
            if any(r in stack_reels for r in range(n)): conn=True
    return win, conn
def run_round(start_spins, start_stacks, extra_wilds, sticky, step, q, w):
    stacks=set(random.sample(range(1,REELS),start_stacks)) if start_stacks else set()
    stuck=set()
    if extra_wilds:
        r=random.choice([x for x in range(1,REELS) if x not in stacks])
        stuck|={(r,0),(r,1)}
    mult=2; tot=0.0; played=0; budget=start_spins
    while played<budget:
        played+=1
        board=[[random.choices(SYMS,WT)[0] for _ in range(ROWS)] for _ in range(REELS)]
        new=0
        for r in range(REELS):
            if r in stacks: board[r]=['W']*ROWS; continue
            if random.random()<q:                       # natural full stack lands
                board[r]=['W']*ROWS; stacks.add(r); new+=1; continue
            for row in range(ROWS):
                if (r,row) in stuck or random.random()<w:
                    board[r][row]='W'
                    if sticky: stuck.add((r,row))
            if all(board[r][row]=='W' for row in range(ROWS)):
                stacks.add(r); new+=1
        budget=min(budget+2*new, SPIN_CAP)               # +2 per NEWLY completed stack, cap 18
        win,conn=evaluate(board,stacks)
        if conn: mult+=step                              # step first, then pay
        tot+=win*mult
        if tot>=CAP: return CAP
    return tot
TIERS={ # start spins, start stacks, +2 wilds, sticky singles, step
 'dare':(8,0,False,True,1),'double':(10,1,False,False,1),
 'triple':(12,1,True,True,2),'hidden':(14,2,False,True,2)}
if __name__=='__main__':
    random.seed(5); n=int(sys.argv[1]) if len(sys.argv)>1 else 20000
    for q,w in ((0.010,0.010),(0.020,0.020),(0.030,0.035)):
        print(f"q(full stack/reel/spin)={q} w(single wild/cell/spin)={w}")
        for t,a in TIERS.items():
            res=[run_round(*a,q,w) for _ in range(n)]
            m=sum(res)/n; h=sum(x>=CAP for x in res)/n; b=sum(x>=5000 for x in res)/n
            print(f"  {t:7s} mean={m:8.1f}x  P(50k)={h:.5f} ({'1 in %s'%format(round(1/h),',') if h else '0 hits'})  P(>=5k)={b:.4f}  price@96.7%~{m/0.967:,.0f}x")
