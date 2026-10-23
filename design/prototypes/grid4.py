import toy_sim4 as T, random, copy, sys
def B(a,b): return [a,b,a,b,a]
cfgs={
 'A':dict(PS=0.5, wb=B(0.004,0.001), qb=B(0.002,0.0002), sticky=True),
 'B':dict(PS=0.5, wb=B(0.003,0.0005), qb=B(0.0015,0.0001), sticky=True),
 'C':dict(PS=0.5, wb=B(0.006,0.0015), qb=B(0.002,0.0002), sticky=False),
 'D':dict(PS=0.5, wb=B(0.004,0.001), qb=B(0.002,0.0002), sticky='dare'),
}
for name,c in cfgs.items():
    if len(sys.argv)>1 and name not in sys.argv[1]: continue
    P=copy.deepcopy(T.P0); T.PSCALE=c['PS']
    P['qb']={t:c['qb'] for t in T.START}; P['wb']={t:c['wb'] for t in T.START}
    P['qt']={t:B(0.05,0.004) for t in T.START}; P['sticky']=c['sticky']
    random.seed(3); line=[]
    for t in ['dare','double','triple','hidden']:
        if c['sticky']=='dare': P['sticky']=(t=='dare')
        xs=[T.buy(t,P)[0] for _ in range(800)]; s=T.stats(xs)
        line.append(f"{t}: mean {s['mean']:.0f} p50k {s['p50k']:.4f} p5k {s['p5k']:.3f} cvar {s['cvar']:.0f}")
    print(name, c, '\n  '+'\n  '.join(line), flush=True)
