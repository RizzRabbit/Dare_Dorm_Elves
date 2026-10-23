"""Computes every worked example in design/SPEC.md §12 with reference_rules.py.
Run: python3 worked_examples.py   (prints each step; the final line of each block is the spin win)
Phase A unit tests must reproduce every TOTAL below exactly (see BUILD_PROMPT.md A7)."""
from reference_rules import play

def ex(name, *a, **k):
    print(f"\n=== {name}")
    t, full, sv = play(*a, **k)
    print(f"  end state: full-reel wilds {{{', '.join(f'R{r+1}: x{v}' for r, v in full.items())}}}; "
          f"single wilds {{{', '.join(f'R{c[0]+1}r{c[1]}: x{v}' for c, v in sv.items())}}}")
    return t

R = {}
R['E1'] = ex("E1 base line win, no wild (no respin)", """
H1 H1 H1 L2 L3
L4 H2 L1 H3 L5
L1 L3 H4 L4 L2
H3 L5 L2 L1 H4""")
R['E2'] = ex("E2 base respin: connected symbols are replaced, wild locks and grows, each step pays", """
H2 H2 W  L1 L3
L4 H3 L5 H3 L5
L1 L3 H4 L4 L2
H3 L5 L2 L1 H4""", steps=[{(0,0):'L2',(1,0):'L2'}, {(0,0):'H4',(1,0):'L1'}])
R['E3'] = ex("E3 base respins build a stack (sum of grown values) -> Triple Dare trigger", """
H2 H2 W  L1 L3
L4 W  W  L2 L5
L2 L3 L2 L4 L2
H3 L5 L3 L1 H4""", steps=[{(0,0):'L3',(0,1):'H4',(0,2):'H1',(1,0):'L5',(2,2):'W',(3,1):'H3',(4,2):'L4'},
 {(0,0):'L4',(0,1):'L1',(0,2):'W'}, {(0,0):'L2',(0,1):'L5',(1,2):'H1',(2,3):'W',(3,1):'L4'}])
R['E4'] = ex("E4 instant stacks (x4 each) on R1+R3, non-adjacent add -> Hidden by precedence", """
W L2 W L4 H2
W H3 W L1 L3
W L4 W H3 L5
W L1 W L2 L4""", steps=[{(1,0):'L3',(1,1):'L5',(1,2):'L4',(1,3):'L5'},
 {(1,0):'H4',(1,1):'L1',(1,2):'L2',(1,3):'H1'}, 'AUTO'])
R['E5'] = ex("E5 mixed groups, first evaluation only: R1 x6 * R2 x5 adjacent (x30) + R4 x7 isolated = x37", """
W W H2 W L3
W W L1 W H2
W W L4 W L4
W W H3 W L1""", full={0:6,1:5,3:7}, max_steps=0)
R['E6'] = ex("E6 three adjacent full reels all multiply: R1 x2 * R2 x3 * R3 x4 = x24 (+ single on R4 x2 = x26 where in run)", """
W W W W  L3
W W W L1 H2
W W W L4 L4
W W W H3 L1""", full={0:2,1:3,2:4}, sticky={(3,0):2}, max_steps=0)
R['E7'] = ex("E7 Mystery spin, bucket NO BONUS: 3 wilds connect, respins land no new wild -> round ends", """
L2 H4 W  L3 L1
H4 H4 W  L1 L5
L1 L3 W  H2 L4
L3 L5 L2 L4 H1""", steps=[{(0,1):'L5',(0,3):'H1',(1,0):'L1',(1,1):'L2',(1,2):'H3'},{(0,0):'H3',(1,1):'L4'}])
R['E8'] = ex("E8 Mystery spin, bucket DOUBLE DARE: respins land wilds and complete R3 -> Double Dare", """
L2 H4 W  L3 L1
H4 H4 W  L1 L5
H2 H2 W  H2 L4
L3 L5 L3 L4 H1""", steps=[{(0,1):'L5',(0,2):'H3',(1,0):'L1',(1,1):'H1',(1,2):'W',(3,2):'L4'},
 {(0,1):'L4',(0,2):'L1',(0,3):'H2',(2,3):'W'}, 'AUTO'])
R['E9'] = ex("E9 EGW spin, weighted pattern R1/R3/R5 (instant x4 each)", """
W L2 W H4 W
W H1 W L2 W
W L4 W H1 W
W L3 W L5 W""", full={0:4,2:4,4:4}, steps=['AUTO','AUTO','AUTO'])
R['E10'] = ex("E10 Double Dare free spin: R3 carried in locked at x13, it grows every step it connects", """
H3 H3 W  H1 L1
L1 L2 W  L5 L4
H2 L4 W  L3 L3
L4 H3 W  H3 L2""", full={2:13}, steps=['AUTO','AUTO','AUTO'])
R['E12'] = ex("E12 wincap: Hidden free spin with R2 x8 * R3 x7 * R4 x9 = x504; round total before it 36,000x", """
L5 W W W L2
H1 W W W L3
L3 W W W H1
L2 W W W L4""", full={1:8,2:7,3:9}, max_steps=0)
print("\nSUMMARY (x bet):", {k: v/20 for k, v in R.items()})
print("E12 round: 36000 + %.2f = %.2f >= 50000 -> pay exactly 50000x, emit wincap, end round" % (R['E12']/20, 36000 + R['E12']/20))
