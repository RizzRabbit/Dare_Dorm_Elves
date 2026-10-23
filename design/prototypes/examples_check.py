# Recomputes the final-board pays of the SPEC.md worked examples with toy_sim3's evaluator (21:33 model).
import toy_sim3 as T
def ev(name, rows, full={}, singles={}):
    sym=[[rows[row][r] for row in range(4)] for r in range(5)]
    sv={(r,row):v for (r,row),v in singles.items()}
    tot=0; parts=[]
    for i,ln in enumerate(T.LINES):
        cells=[sym[r][ln[r]] for r in range(5)]
        base=next((s for s in cells if s!='W'),'W'); n=0
        for s in cells:
            if s==base or s=='W': n+=1
            else: break
        wn=0
        for s in cells:
            if s=='W': wn+=1
            else: break
        if n<3: continue
        ps=T.PAY[base][n-3]; pw=T.PAY['W'][wn-3] if wn>=3 else 0
        k=n if ps>=pw else wn; lab=f"{k}x{base if ps>=pw else 'W'}"
        run=[(r,ln[r]) for r in range(k)]
        m=T.line_mult(run,sym,sv,full); p=max(ps,pw)*m
        tot+=p; parts.append(f"L{i+1} {lab} {max(ps,pw)}lb x{m}={p}")
    print(f"{name}: " + "; ".join(parts) + f" | total {tot} lb = {tot/20:g}x bet")
ev('E1 base',[['H1','H1','H1','L2','L3'],['L4','H2','L1','H3','L5'],['L1','L3','H4','L4','L2'],['H3','L5','L2','L1','H4']])
ev('E2 step0',[['H2','H2','W','L1','L3'],['L4','L3','W','H3','L5'],['L1','L3','H4','L2','L4'],['L5','H1','L3','L4','H2']],singles={(2,0):1,(2,1):1})
ev('E2 final',[['H2','H2','W','L1','L3'],['L2','L2','W','H3','L5'],['H4','H4','W','L2','L4'],['L3','H1','W','L4','H2']],full={2:10})
ev('E3 final',[['L1','L1','W','L4','H3'],['H3','L2','L5','W','L4'],['L4','W','L1','L2','L5'],['L2','L5','H2','L3','W']],singles={(2,0):2,(3,1):1,(1,2):1,(4,3):1})
ev('E4 double',[['H3','H3','W','H1','L1'],['L1','L2','W','L5','L4'],['H2','L4','W','L3','L3'],['L4','H3','W','H3','L2']],full={2:11})
ev('E5 adj+nonadj',[['W','W','H2','W','L3'],['W','W','L1','W','H2'],['W','W','L4','W','L4'],['W','W','H3','W','L1']],full={0:6,1:5,3:7})
ev('E9 EGW 1,3,5',[['W','L2','W','H4','W'],['W','H1','W','L2','W'],['W','L4','W','H1','W'],['W','L3','W','L5','W']],full={0:4,2:4,4:4})
ev('E11 cap',[['L5','W','W','W','L2'],['H1','W','W','W','L3'],['L3','W','W','W','H1'],['L2','W','W','W','L4']],full={1:8,2:7,3:9})
ev('E6 triple trig',[['L3','W','H4','L1','L2'],['H4','W','L1','W','L5'],['L1','W','L5','L3','H3'],['L2','W','H1','L4','W']],full={1:4},singles={(3,1):1,(4,3):1})
ev('E7 hidden trig',[['W','L2','W','L4','H2'],['W','H3','W','L1','L3'],['W','L4','W','H3','L5'],['W','L1','W','L2','L4']],full={0:4,2:4})
ev('E5 dare stack',[['L4','W','L4','L1','H3'],['L2','W','H2','L5','L1'],['L1','W','L3','H4','L2'],['H1','W','L5','L2','L4']],full={1:9})
