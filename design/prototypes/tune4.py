import toy_sim4 as T, random, sys, json, copy
def run(P, nb=20000, nbuy=1500, modes=('base','dare','double','triple','hidden','egw','mnb')):
    random.seed(7); out={}
    for m in modes:
        if m=='base':
            res=[T.base_spin(P) for _ in range(nb)]; xs=[r[0] for r in res]
            trig={t:sum(r[2]==t for r in res)/nb for t in T.START}
            line=[T.sequence({}, {}, P['q'], P['w'])[0] for _ in range(nb)]
            s=T.stats(xs); s['trig']=trig; s['line_only']=sum(line)/nb
        elif m=='egw': s=T.stats([T.egw(P)[0] for _ in range(nbuy*4)])
        elif m=='mnb': s=T.stats([T.mystery_nobonus(P)[0] for _ in range(nbuy*4)])
        else: s=T.stats([T.buy(m,P)[0] for _ in range(nbuy)])
        out[m]=s
        print(m, {k:(round(v,5) if isinstance(v,float) else v) for k,v in s.items()}, flush=True)
    return out
if __name__=='__main__':
    P=copy.deepcopy(T.P0); exec(sys.argv[1] if len(sys.argv)>1 else '')
    run(P, *(int(a) for a in sys.argv[2:4]))
