"""SPEC §12 worked examples (inputs copied from design/prototypes/worked_examples.py)."""
import game_calculations as gc

def parse(txt):
    rows = [r.split() for r in txt.strip().splitlines()]
    return [[rows[row][r] for row in range(4)] for r in range(5)]

FILL = ['L5', 'L3', 'H4', 'L1']

class Scripted:
    def __init__(self, steps): self.steps = steps
    def cell_at(self, r, row, step):
        rep = self.steps[step - 1] if step - 1 < len(self.steps) else 'AUTO'
        if rep != 'AUTO' and (r, row) in rep: return rep[(r, row)]
        return FILL[(r + row) % 4]

def run(board, steps=(), full=None, sticky=None, pre_total=0):
    sym = parse(board); full = dict(full or {})
    for r in full:
        for row in range(4): sym[r][row] = 'W'
    sv = {(r, row): (sticky or {}).get((r, row), 1) for r in range(5) if r not in full for row in range(4) if sym[r][row] == 'W'}
    rnd = gc.Round(gc.Emitter(True)); rnd.total = pre_total
    pad = [['L5'] + sym[r] + ['L5'] for r in range(5)]
    win, ns, ok = gc.play_sequence(rnd, sym, sv, full, Scripted(list(steps)), 'basegame', pad=pad, stops=[0]*5)
    return win, full, sv, rnd

def first_eval(board, full, sticky=None):
    sym = parse(board)
    sv = {(r, row): (sticky or {}).get((r, row), 1) for r in range(5) if r not in full for row in range(4) if sym[r][row] == 'W'}
    lb, _, _, wins = gc.evaluate(sym, sv, full, detail=True)
    return lb * 5, wins

def test_E1():
    w, full, sv, rnd = run("""H1 H1 H1 L2 L3
L4 H2 L1 H3 L5
L1 L3 H4 L4 L2
H3 L5 L2 L1 H4""")
    assert w == 125 and rnd.stats['respins'] == 0

def test_E2():
    w, full, sv, rnd = run("""H2 H2 W  L1 L3
L4 H3 L5 H3 L5
L1 L3 H4 L4 L2
H3 L5 L2 L1 H4""", [{(0,0):'L2',(1,0):'L2'}, {(0,0):'H4',(1,0):'L1'}])
    assert w == 150 and sv == {(2,0): 3} and rnd.stats['respins'] == 2

def test_E2b():
    w, full, sv, rnd = run("""H2 H2 W  L1 L3
L4 H3 L5 H3 L5
L1 L3 H4 L4 L2
H1 H1 H1 L1 H4""", [{(0,0):'L2',(1,0):'L2',(0,3):'H4',(1,3):'L5',(2,3):'L3'}, {(0,0):'H4',(1,0):'L1'}])
    assert w == 275

def test_E3():
    w, full, sv, rnd = run("""H2 H2 W  L1 L3
L4 W  W  L2 L5
L2 L3 L2 L4 L2
H3 L5 L3 L1 H4""", [{(0,0):'L3',(0,1):'H4',(0,2):'H1',(1,0):'L5',(2,2):'W',(3,1):'H3',(4,2):'L4'},
 {(0,0):'L4',(0,1):'L1',(0,2):'W'}, {(0,0):'L2',(0,1):'L5',(1,2):'H1',(2,3):'W',(3,1):'L4'}])
    assert w == 17910 and full == {2: 13} and sv == {(1,1): 5, (0,2): 3}
    assert gc.tier_of(full, sv) == 'triple_dare'
    sc = [e for e in rnd.emit.events if e['type'] == 'stackComplete'][0]
    assert sc['value'] == 12 and sc['parts'] == [4, 4, 3, 1] and sc['instant'] is False

def test_E4():
    w, full, sv, rnd = run("""W L2 W L4 H2
W H3 W L1 L3
W L4 W H3 L5
W L1 W L2 L4""", [{(1,0):'L3',(1,1):'L5',(1,2):'L4',(1,3):'L5'}, {(1,0):'H4',(1,1):'L1',(1,2):'L2',(1,3):'H1'}, 'AUTO'])
    assert w == 35010 and full == {0: 8, 2: 8} and gc.tier_of(full, sv) == 'hidden'

def test_E5():
    c, wins = first_eval("""W W H2 W L3
W W L1 W H2
W W L4 W L4
W W H3 W L1""", {0:6, 1:5, 3:7})
    assert c == 244015 and all(x['meta']['lineMult'] == 37 for x in wins)

def test_E6():
    c, wins = first_eval("""W W W W  L3
W W W L1 H2
W W W L4 L4
W W W H3 L1""", {0:2, 1:3, 2:4}, {(3,0): 2})
    assert c == 126200 and {x['meta']['lineMult'] for x in wins} == {24, 26}

def test_E7():
    w, full, sv, rnd = run("""L2 H4 W  L3 L1
H4 H4 W  L1 L5
L1 L3 W  H2 L4
L3 L5 L2 L4 H1""", [{(0,1):'L5',(0,3):'H1',(1,0):'L1',(1,1):'L2',(1,2):'H3'}, {(0,0):'H3',(1,1):'L4'}])
    assert w == 340 and not full and sv == {(2,0): 3, (2,1): 3, (2,2): 3} and gc.tier_of(full, sv) is None

def test_E8_E13():
    w, full, sv, rnd = run("""L2 H4 W  L3 L1
H4 H4 W  L1 L5
H2 H2 W  H2 L4
L3 L5 L3 L4 H1""", [{(0,1):'L5',(0,2):'H3',(1,0):'L1',(1,1):'H1',(1,2):'W',(3,2):'L4'},
 {(0,1):'L4',(0,2):'L1',(0,3):'H2',(2,3):'W'}, 'AUTO'])
    assert w == 9240 and full == {2: 11} and sv == {(1,2): 4} and gc.tier_of(full, sv) == 'double_dare'

def test_E9():
    w, full, sv, rnd = run("""W L2 W H4 W
W H1 W L2 W
W L4 W H1 W
W L3 W L5 W""", ['AUTO']*3, full={0:4, 2:4, 4:4})
    assert w == 37450 and full == {0:8, 2:8, 4:5}

def test_E10():
    w, full, sv, rnd = run("""H3 H3 W  H1 L1
L1 L2 W  L5 L4
H2 L4 W  L3 L3
L4 H3 W  H3 L2""", ['AUTO']*3, full={2:13})
    assert w == 7230 and full == {2: 17}

def test_E12_wincap():
    board = """L5 W W W L2
H1 W W W L3
L3 W W W H1
L2 W W W L4"""
    c, _ = first_eval(board, {1:8, 2:7, 3:9})
    assert c == 1675800
    w, full, sv, rnd = run(board, ['AUTO']*3, full={1:8, 2:7, 3:9}, pre_total=3_600_000)
    assert rnd.total == gc.CAP_C and rnd.capped
    types = [e['type'] for e in rnd.emit.events]
    assert types[-1] == 'respinEnd' and rnd.emit.events[-1]['reason'] == 'wincap' and 'respinStart' not in types
