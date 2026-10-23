"""Reference implementation of the LOCKED Dare Dorm - Elves spin rules (design/SPEC.md §3-§4).
Small, slow, deterministic. Used to compute every worked example in SPEC.md §12.
The math-sdk game (Phase A) must reproduce these numbers exactly (see tests in BUILD_PROMPT.md).
Board: sym[reel][row], reel 0-4 (R1-R5), row 0-3 (top to bottom). Pays in line bets (lb); 20 lb = 1x bet."""
ROWS, REELS = 4, 5
LINES = [[0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],[3,3,3,3,3],[0,1,2,1,0],[3,2,1,2,3],[1,0,0,0,1],[2,3,3,3,2],
 [0,1,0,1,0],[3,2,3,2,3],[1,2,1,2,1],[2,1,2,1,2],[0,0,1,0,0],[3,3,2,3,3],[1,1,0,1,1],[2,2,3,2,2],
 [0,1,1,1,0],[3,2,2,2,3],[1,2,3,2,1],[2,1,0,1,2]]
PAY = {'W':(25,100,500),'H1':(25,100,500),'H2':(20,75,300),'H3':(15,50,200),'H4':(10,40,150),
       'L1':(5,20,80),'L2':(5,15,60),'L3':(4,10,40),'L4':(3,8,30),'L5':(3,8,30)}

def parse(txt):
    rows = [r.split() for r in txt.strip().splitlines()]
    return [[rows[row][r] for row in range(ROWS)] for r in range(REELS)]

def line_mult(run, sym, sv, full):
    """A1/A2: adjacent full-reel wilds multiply as a group; other wilds (singles, isolated full reels) add."""
    m, i = 0, 0
    while i < len(run):
        r, row = run[i]
        if r in full:
            p = 1
            while i < len(run) and run[i][0] in full:
                p *= full[run[i][0]]; i += 1
            m += p
        else:
            if sym[r][row] == 'W': m += sv[(r, row)]
            i += 1
    return max(1, m)

def evaluate(sym, sv, full):
    """Pays every winning line on THIS step's board (R5, user-locked): no 'newly landed cell' filter.
    Non-wild cells of connected runs are replaced each respin, so repeat pays come from newly formed
    lines; an all-wild line pays again at every step at its grown value. Returns (lb, connected wild keys, cells to respin, detail)."""
    lb, conw, resp, det = 0, set(), set(), []
    for i, ln in enumerate(LINES):
        cells = [sym[r][ln[r]] for r in range(REELS)]
        base = next((s for s in cells if s != 'W'), 'W'); n = 0
        for s in cells:
            if s in (base, 'W'): n += 1
            else: break
        wn = 0
        for s in cells:
            if s == 'W': wn += 1
            else: break
        if n < 3 and wn < 3: continue
        ps = PAY[base][n-3] if n >= 3 else 0
        pw = PAY['W'][wn-3] if wn >= 3 else 0
        k, s_ = (n, base) if ps >= pw else (wn, 'W')
        run = [(r, ln[r]) for r in range(k)]
        m = line_mult(run, sym, sv, full); p = max(ps, pw)
        lb += p * m; det.append(f"L{i+1} {k}x{s_} {p}lb x{m} = {p*m}lb")
        wc = [c for c in run if sym[c[0]][c[1]] == 'W']
        if wc:
            conw |= {('F', c[0]) if c[0] in full else c for c in wc}
            resp |= {c for c in run if sym[c[0]][c[1]] != 'W'}
    return lb, conw, resp, det

def play(board, steps=(), full=None, sticky=None, verbose=True, max_steps=3):
    """board: initial grid text. steps: list of {(reel,row): sym} replacements for each respin (must cover
    exactly the cells to respin). full: locked full reels {reel: value}. sticky: {(reel,row): value}.
    Returns (total lb, full, singles)."""
    sym = parse(board); full = dict(full or {}); sv = {}
    for r in range(REELS):
        for row in range(ROWS):
            if sym[r][row] == 'W': sv[(r, row)] = (sticky or {}).get((r, row), 1)
    for r in full:
        for row in range(ROWS): sym[r][row] = 'W'; sv.pop((r, row), None)
    total, step = 0, 0
    while True:
        for r in range(REELS):                                   # stack completion: sum the 4 values
            if r not in full and all(sym[r][row] == 'W' for row in range(ROWS)):
                full[r] = sum(sv.pop((r, row)) for row in range(ROWS))
                if verbose: print(f"  step{step}: R{r+1} full-reel wild = x{full[r]}")
        lb, conw, resp, det = evaluate(sym, sv, full)
        total += lb
        if verbose:
            print(f"  step{step}: pays {lb}lb ({lb/20}x): " + "; ".join(det))
        for c in conw:                                            # R6: +1 per step connected
            if c[0] == 'F': full[c[1]] += 1
            else: sv[c] += 1
        if verbose and conw:
            print(f"  step{step}: grow -> full {dict((f'R{k+1}',v) for k,v in full.items())} singles {dict((f'R{k[0]+1}r{k[1]}',v) for k,v in sv.items())}")
        if not conw or step == min(3, max_steps): break         # R2 (max_steps<3 only for illustration)
        step += 1
        rep = steps[step-1] if step-1 < len(steps) else None
        if rep == 'AUTO':   # illustration filler: replace every respin cell with a dead symbol pattern
            rep = {c: ['L5', 'L3', 'H4', 'L1'][(c[0] + c[1]) % 4] for c in resp}
        if rep is None:
            print(f"  STOP: step{step} needs replacements for {sorted(resp)}"); return total, full, sv
        assert set(rep) == resp, f"step{step}: replacements {sorted(rep)} != respin cells {sorted(resp)}"
        for c, s in rep.items():
            sym[c[0]][c[1]] = s
            if s == 'W': sv[c] = 1
    if verbose: print(f"  TOTAL {total}lb = {total/20}x")
    return total, full, sv
