"""Elfhaus rules engine (design/SPEC.md §3-§9, DECISIONS.md LOCKED).

Port of design/prototypes/reference_rules.py with the same semantics, plus the full round flow
(respins, triggers, free spins, Mystery, EGW) and design/EVENTS.md event emission.

Board convention: sym[reel][row], reel 0-4, row 0-3 (top -> bottom). Pays in line-bet units (lb), 20 lb = 1x bet.
All money inside the engine is integer centi-x (x bet * 100) = lb * mult * 5, so there is no float drift.
Randomness: the module-level `random` (seeded per simulation by the math-sdk) is the only RNG.
"""
import random

ROWS, REELS = 4, 5
CAP_C = 5_000_000            # 50,000x in centi-x
SPIN_CAP = 20                # free spins played per round (SPEC v2 §6)
MAX_RESPINS = 3
START_FS = {"dare": 8, "double_dare": 10, "triple_dare": 10, "hidden": 14}   # Epic 12 -> 14 (user 2026-10-26)
SC = "S"                     # Dare Card scatter (SPEC v2 §2): no pay, max 1 per reel, triggers by count
SCATTER_TIER = {3: "dare", 4: "double_dare", 5: "flip"}
FLIP_ODDS = {"triple_dare": 75, "hidden": 25}   # 5-scatter card flip (base / ante / Mystery); TD buy skips it
GUARANTEE = {"triple_dare": 1, "hidden": 2}     # full-reel wilds guaranteed at bonus start (animated in)
GUAR_WEIGHTS = [1, 0.3, 0.6, 3, 4]
GUAR_MIN_VAL = {"triple_dare": 4, "hidden": 6}   # Epic guaranteed stacks start at x6 (was x4), user 2026-10-26
GUAR_ADJ = 0.1                                  # weight factor for a placed stack next to an existing stack              # default reel weights for placed guarantee stacks (per mode in reel_params)
TIERS = ("dare", "double_dare", "triple_dare", "hidden")
MYSTERY_ODDS = {"none": 50, "double_dare": 37, "triple_dare": 10, "hidden": 3}
LINES = [[0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],[3,3,3,3,3],[0,1,2,1,0],[3,2,1,2,3],[1,0,0,0,1],[2,3,3,3,2],
         [0,1,0,1,0],[3,2,3,2,3],[1,2,1,2,1],[2,1,2,1,2],[0,0,1,0,0],[3,3,2,3,3],[1,1,0,1,1],[2,2,3,2,2],
         [0,1,1,1,0],[3,2,2,2,3],[1,2,3,2,1],[2,1,0,1,2]]
PAY = {"W": (25,100,500), "H1": (25,100,500), "H2": (20,75,300), "H3": (15,50,200), "H4": (10,40,150),
       "L1": (5,20,80), "L2": (5,15,60), "L3": (4,10,40), "L4": (3,8,30), "L5": (3,8,30)}
W = "W"


# ---------------------------------------------------------------- line evaluation (SPEC §2-§4.3)
def line_mult(run, sym, sv, full):
    """A1/A2: adjacent full-reel wilds multiply as a group; singles / isolated full reels add. Returns (mult, groups)."""
    m, i, groups = 0, 0, []
    n = len(run)
    while i < n:
        r, row = run[i]
        if r in full:
            p, reels, vals = 1, [], []
            while i < n and run[i][0] in full:
                v = full[run[i][0]]
                p *= v; reels.append(run[i][0]); vals.append(v); i += 1
            m += p
            if len(reels) > 1:
                groups.append({"type": "merge", "reels": reels, "values": vals, "product": p})
            else:
                groups.append({"type": "full", "reel": reels[0], "value": vals[0]})
        else:
            if sym[r][row] == W:
                v = sv[(r, row)]
                m += v
                groups.append({"type": "single", "reel": r, "row": row, "value": v})
            i += 1
    return max(1, m), groups


def evaluate(sym, sv, full, detail=False):
    """Every winning line on this board pays (R5). Returns (lb_total, connected wild keys, cells to replace, wins).
    connected keys: ('F', reel) for full reels, (reel,row) for singles. cells to replace: non-wild cells of every
    winning line (R3). wins: list of per-line dicts when detail=True."""
    lb, conw, resp, wins = 0, set(), set(), []
    for li, ln in enumerate(LINES):
        c0, c1, c2 = sym[0][ln[0]], sym[1][ln[1]], sym[2][ln[2]]
        cells = (c0, c1, c2, sym[3][ln[3]], sym[4][ln[4]])
        base = W
        for s in cells:
            if s != W:
                base = s; break
        n = 0
        for s in cells:
            if s == base or s == W: n += 1
            else: break
        wn = 0
        for s in cells:
            if s == W: wn += 1
            else: break
        if n < 3 and wn < 3:
            continue
        ps = PAY[base][n-3] if n >= 3 and base != SC else 0
        pw = PAY[W][wn-3] if wn >= 3 else 0
        if ps >= pw: k, s_, p = n, base, ps
        else: k, s_, p = wn, W, pw
        if p == 0:
            continue
        run = [(r, ln[r]) for r in range(k)]
        m, groups = line_mult(run, sym, sv, full)
        lb += p * m
        haswild = False
        for c in run:
            if sym[c[0]][c[1]] == W:
                haswild = True
                conw.add(("F", c[0]) if c[0] in full else c)
            else:
                resp.add(c)
        if detail:
            wins.append({"lineIndex": li + 1, "symbol": s_, "count": k, "win": p * m * 5,
                         "positions": [{"reel": r, "row": row} for r, row in run],
                         "meta": {"basePay": p, "lineMult": m, "connected": haswild, "groups": groups}})
    return lb, conw, resp, wins


def scatters(sym):
    return [(r, row) for r in range(REELS) for row in range(ROWS) if sym[r][row] == SC]


def scatter_tier(n):
    """SPEC v2 §2: 3 = Dare, 4 = Double Dare, 5 = card flip (Triple Dare / Epic). Returns None, a tier or 'flip'."""
    return SCATTER_TIER.get(min(n, 5))


def anticipation_of(sym):
    """Slow-spin every reel after the 2nd landed scatter (a 3rd scatter would trigger)."""
    out, seen = [0] * REELS, 0
    for r in range(REELS):
        if seen >= 2: out[r] = 1
        if any(sym[r][row] == SC for row in range(ROWS)): seen += 1
    return out


def merge_groups(full):
    out, reels = [], sorted(full)
    i = 0
    while i < len(reels):
        j = i
        while j + 1 < len(reels) and reels[j+1] == reels[j] + 1: j += 1
        if j > i:
            g = reels[i:j+1]; vals = [full[r] for r in g]; p = 1
            for v in vals: p *= v
            out.append({"reels": g, "values": vals, "product": p})
        i = j + 1
    return out


def win_level(c, key):
    x = c / 100
    if key == "standard":
        edges = [0.1, 1, 2, 5, 15, 30, 50, 100, 50000]
    else:
        edges = [1, 5, 10, 20, 50, 100, 500, 2000, 50000]
    for i, e in enumerate(edges):
        if x < e: return i + 1
    return 10


# ---------------------------------------------------------------- reel strips
class Strip:
    """One reel set = 5 strips (lists of symbol names)."""
    def __init__(self, name, reels):
        self.name, self.reels = name, reels

    def land(self):
        """Random stop per reel; returns (cells[reel][4], padded[reel][6], stops)."""
        cells, pad, stops = [], [], []
        for strip in self.reels:
            L = len(strip); s = random.randrange(L)
            col = [strip[(s + k) % L] for k in range(-1, ROWS + 1)]
            pad.append(col); cells.append(col[1:5]); stops.append(s)
        return cells, pad, stops

    def cell(self, reel):
        strip = self.reels[reel]
        return strip[random.randrange(len(strip))]


def sym_obj(name, value=None):
    if name == W:
        return {"name": W, "wild": True, "multiplier": value if value is not None else 1}
    return {"name": name}


class Emitter:
    """Collects EVENTS.md events (or nothing when disabled, for fast tuning sims)."""
    def __init__(self, on=True):
        self.on, self.events = on, []

    def __call__(self, typ, **kw):
        if self.on:
            ev = {"index": len(self.events), "type": typ}
            ev.update(kw)
            self.events.append(ev)


def locked_obj(full, sv):
    return {"fullReels": [{"reel": r, "value": full[r]} for r in sorted(full)],
            "singles": [{"reel": r, "row": row, "value": v} for (r, row), v in sorted(sv.items())]}


# ---------------------------------------------------------------- round state
class Round:
    """One book. total = round win so far (centi-x), base_c / free_c split for the SDK."""
    def __init__(self, emit):
        self.emit = emit
        self.total = 0
        self.base_c = 0
        self.free_c = 0
        self.capped = False
        self.stats = {"tier": None, "upgrade": False, "fs_played": 0, "max_mult": 0, "respins": 0}

    def add(self, c, gametype):
        """Adds a step win; returns True if the round hit the 50,000x cap (SPEC §9.6)."""
        room = CAP_C - self.total
        if c >= room:
            c = room; self.capped = True
        self.total += c
        if gametype == "freegame": self.free_c += c
        else: self.base_c += c
        return self.capped


def play_sequence(rnd, sym, sv, full, respin_strip, gametype, landed=None, pad=None, stops=None,
                  anticipation=None, reveal_locked=None, respin_filter=None, emit_reveal=True,
                  fs_reveal_groups=False):
    """SPEC §4 step loop on an already-landed board. sym is mutated. sv: single wild values {(r,row): v},
    full: {reel: value}. landed: set of cells that landed in step 0 (for `instant`).
    respin_filter(cell, name) may veto a replacement draw (Mystery buckets); returns False to redraw the round.
    Returns (spin_win_c, new_stacks list, ok flag)."""
    emit = rnd.emit
    if emit_reveal and emit.on:
        board = [[sym_obj(n) for n in col] for col in pad]
        for r in range(REELS):
            for row in range(ROWS):
                if r in full:
                    board[r][row + 1] = sym_obj(W, full[r])
                elif sym[r][row] == W:
                    board[r][row + 1] = sym_obj(W, sv.get((r, row), 1))
        emit("reveal", board=board, paddingPositions=stops, gameType=gametype,
             anticipation=anticipation or [0] * REELS,
             locked=reveal_locked if reveal_locked is not None else locked_obj({}, {}))
    last_groups = None
    if fs_reveal_groups and full:
        g = merge_groups(full)
        if g:
            emit("mergeGroups", step=0, groups=g); last_groups = g
    spin_win, new_stacks, step = 0, [], 0
    landed = set(landed) if landed is not None else {(r, row) for r in range(REELS) for row in range(ROWS)}
    while True:
        # stack completion: sum the 4 values (A4/A5)
        changed = False
        for r in range(REELS):
            if r not in full and sym[r][0] == W and sym[r][1] == W and sym[r][2] == W and sym[r][3] == W:
                parts = [sv.pop((r, row)) for row in range(ROWS)]
                full[r] = sum(parts)
                new_stacks.append(r); changed = True
                emit("stackComplete", step=step, reel=r, parts=parts, value=full[r],
                     instant=all((r, row) in landed for row in range(ROWS)))
        if changed and emit.on:
            g = merge_groups(full)
            if g != last_groups and (g or last_groups):
                emit("mergeGroups", step=step, groups=g); last_groups = g
        lb, conw, resp, wins = evaluate(sym, sv, full, detail=emit.on)
        c = lb * 5
        if c:
            spin_win += c
            capped = rnd.add(c, gametype)
            if emit.on:
                tw = c if not capped else c  # winInfo reports this step's line wins as evaluated
                emit("winInfo", step=step, totalWin=tw, wins=wins)
                emit("updateStepWin", amount=spin_win)
            if capped:
                emit("respinEnd", step=step, reason="wincap")
                return spin_win, new_stacks, True
        # growth +1 per connected wild (R6)
        if conw:
            changes = []
            for k in sorted(conw, key=lambda x: (x[1], -1) if x[0] == "F" else (x[0], x[1])):
                if k[0] == "F":
                    r = k[1]; full[r] += 1
                    changes.append({"kind": "full", "reel": r, "from": full[r] - 1, "to": full[r]})
                else:
                    sv[k] += 1
                    changes.append({"kind": "single", "reel": k[0], "row": k[1], "from": sv[k] - 1, "to": sv[k]})
            if emit.on:
                emit("wildGrow", step=step, changes=changes)
                if any(ch["kind"] == "full" for ch in changes):
                    g = merge_groups(full)
                    if g != last_groups and (g or last_groups):
                        emit("mergeGroups", step=step, groups=g); last_groups = g
        if not conw:
            if c or step > 0:
                emit("respinEnd", step=step, reason="noConnection")
            break
        if step == MAX_RESPINS:
            emit("respinEnd", step=step, reason="maxRespins")
            break
        step += 1
        rnd.stats["respins"] += 1
        repl = sorted(resp)
        emit("respinStart", step=step, replace=[{"reel": r, "row": row} for r, row in repl],
             locked=locked_obj(full, sv), remaining=MAX_RESPINS - step)
        new = []
        for (r, row) in repl:
            name = respin_strip.cell_at(r, row, step) if hasattr(respin_strip, "cell_at") else respin_strip.cell(r)
            while name == SC and any(sym[r][x] == SC for x in range(ROWS)):
                name = respin_strip.cell(r)         # max 1 scatter per reel
            if respin_filter is not None and not respin_filter((r, row), name):
                return spin_win, new_stacks, False
            sym[r][row] = name
            if name == W:
                sv[(r, row)] = 1
                new.append({"reel": r, "row": row, "name": W, "wild": True, "multiplier": 1})
            else:
                new.append({"reel": r, "row": row, "name": name})
        landed = set(repl)
        emit("respinReveal", step=step, newSymbols=new)
    return spin_win, new_stacks, True


def wilds_from_board(sym, full):
    """Single wild values for a freshly landed board (each new wild = x1)."""
    return {(r, row): 1 for r in range(REELS) if r not in full for row in range(ROWS) if sym[r][row] == W}


def end_spin_events(rnd, spin_win):
    if spin_win > 0:
        rnd.emit("setWin", amount=spin_win, winLevel=win_level(spin_win, "standard"))
    rnd.emit("setTotalWin", amount=rnd.total)


def track_max(rnd, full, sv):
    m = 0
    for v in full.values(): m = max(m, v)
    for v in sv.values(): m = max(m, v)
    g = merge_groups(full)
    for x in g: m = max(m, x["product"])
    if m > rnd.stats["max_mult"]: rnd.stats["max_mult"] = m


# ---------------------------------------------------------------- base-type spin (base / ante / buy trigger / Mystery)
def base_spin(rnd, land_strip, respin_strip):
    """Lands a board and plays the full respin sequence. Returns (spin_win, sym, sv, full).
    Reels after the 2nd landed scatter carry `anticipation` (slow spin)."""
    sym, pad, stops = land_strip.land()
    full = {}
    sv = wilds_from_board(sym, full)
    win, _, _ = play_sequence(rnd, sym, sv, full, respin_strip, "basegame", pad=pad, stops=stops,
                              anticipation=anticipation_of(sym))
    track_max(rnd, full, sv)
    return win, sym, sv, full


def _pick(weights, k, exclude=()):
    pool = [r for r in range(REELS) if r not in exclude]; out = []
    for _ in range(k):
        if not pool: break
        r = random.choices(pool, weights=[weights[x] for x in pool])[0]
        out.append(r); pool.remove(r)
    return out


def place_guarantee(rnd, tier, full, sv, weights):
    """SPEC v2 §6: Triple Dare starts with >= 1 and Epic (hidden) with >= 2 full-reel wilds. Stacks already carried
    in count; missing ones are placed on weighted reels. A placed stack absorbs any carried singles on its reel:
    value = max(4, sum of those singles + 1 per empty cell)."""
    need = GUARANTEE.get(tier, 0) - len(full)
    if need <= 0:
        return
    placed = []
    picks = []
    for _ in range(need):                # Epic pairs mostly non-adjacent (like EGW D9): reels next to a stack x0.1
        w = [weights[x] * (GUAR_ADJ if (x - 1 in full or x + 1 in full or x - 1 in picks or x + 1 in picks) else 1)
             for x in range(REELS)]
        picks += _pick(w, 1, exclude=set(full) | set(picks))
    for r in picks:
        absorbed = [{"row": row, "value": sv.pop((r, row))} for row in range(ROWS) if (r, row) in sv]
        val = max(GUAR_MIN_VAL.get(tier, 4), sum(x["value"] for x in absorbed) + (ROWS - len(absorbed)))
        full[r] = val
        placed.append({"reel": r, "value": val, "absorbed": absorbed})
    rnd.emit("guaranteedStacks", tier=tier, stacks=placed, locked=locked_obj(full, sv))
    if rnd.emit.on:
        g = merge_groups(full)
        if g: rnd.emit("mergeGroups", step=0, groups=g)


def retrigger_spins(n):
    """SPEC v2 §6 (user 2026-10-25): in a free spin, 2 scatters = +2 spins, 3 or more = +5."""
    return 5 if n >= 3 else 2 if n == 2 else 0


# ---------------------------------------------------------------- free spins (SPEC v2 §6)
def play_bonus(rnd, tier, full, sv, fs_strips, source, guar_weights=GUAR_WEIGHTS, trigger_scatters=()):
    """fs_strips: {tier: Strip} for this mode. Plays in the same book. Dare: nothing sticks (carry ignored).
    Double/Triple/Epic: trigger wilds carry in place and every wild stays locked for the whole bonus."""
    emit = rnd.emit
    rnd.stats["tier"] = tier
    budget = START_FS[tier]
    if tier == "dare":
        full, sv = {}, {}
    else:
        full, sv = dict(full), dict(sv)
    emit("freeSpinTrigger", tier=tier, totalFs=budget, cap=SPIN_CAP, carried=locked_obj(full, sv), source=source,
         scatters=[{"reel": r, "row": row} for r, row in trigger_scatters])
    place_guarantee(rnd, tier, full, sv, guar_weights)
    track_max(rnd, full, sv)
    lock_full, lock_sv = full, sv
    fs_total = 0
    spin_no = 0
    while spin_no < budget and not rnd.capped:
        spin_no += 1
        rnd.stats["fs_played"] = spin_no
        emit("updateFreeSpin", amount=spin_no, total=budget, cap=SPIN_CAP, tier=tier)
        strip = fs_strips[tier]
        sym, pad, stops = strip.land()
        cur_full, cur_sv = dict(lock_full), dict(lock_sv)
        for r in cur_full:
            for row in range(ROWS): sym[r][row] = W; pad[r][row + 1] = W
        for (r, row) in cur_sv: sym[r][row] = W; pad[r][row + 1] = W
        landed = set()
        for r in range(REELS):
            if r in cur_full: continue
            for row in range(ROWS):
                if (r, row) in cur_sv: continue
                landed.add((r, row))
                if sym[r][row] == W: cur_sv[(r, row)] = 1
        reveal_locked = locked_obj(lock_full, lock_sv)
        win, new_stacks, _ = play_sequence(rnd, sym, cur_sv, cur_full, strip, "freegame", landed=landed,
                                           pad=pad, stops=stops, reveal_locked=reveal_locked,
                                           fs_reveal_groups=True)
        track_max(rnd, cur_full, cur_sv)
        fs_total += win
        if rnd.capped:
            break
        end_spin_events(rnd, win)
        if tier == "dare":
            lock_full, lock_sv = {}, {}          # Dare: plain free spins, nothing sticks
        else:
            lock_full, lock_sv = dict(cur_full), dict(cur_sv)
        sc = scatters(sym)
        add = retrigger_spins(len(sc))
        if add:
            nb = min(budget + add, SPIN_CAP)
            rnd.stats["retriggers"] = rnd.stats.get("retriggers", 0) + 1
            emit("freeSpinRetrigger", scatters=[{"reel": r, "row": row} for r, row in sc], count=len(sc),
                 addedFs=nb - budget, totalFs=nb, capped=nb >= SPIN_CAP)
            budget = nb
    if rnd.capped:
        emit("wincap", amount=CAP_C)
        emit("setTotalWin", amount=rnd.total)
    emit("freeSpinEnd", amount=rnd.free_c, winLevel=win_level(rnd.free_c, "endFeature"))
    return fs_total


def finish(rnd, wincap_emitted=False):
    rnd.emit("finalWin", amount=rnd.total)
    return rnd.total


def _tail(rnd, win):
    """After a base-type spin: wincap or setWin/setTotalWin. Returns True if the round is over (capped)."""
    if rnd.capped:
        rnd.emit("wincap", amount=CAP_C)
        rnd.emit("setTotalWin", amount=rnd.total)
        return True
    end_spin_events(rnd, win)
    return False


def card_flip(rnd, result=None):
    """5 scatters (base / ante / Mystery): the Dare Card flips to Triple Dare or Epic (hidden), FLIP_ODDS."""
    if result is None:
        result = random.choices(list(FLIP_ODDS), weights=list(FLIP_ODDS.values()))[0]
    rnd.emit("cardFlip", odds=dict(FLIP_ODDS), result=result)
    rnd.stats["flip"] = result
    return result


# ---------------------------------------------------------------- whole rounds per mode
def round_base(rnd, S):
    """base / ante. S = mode strip dict: spin, respin, fs {tier: Strip}, guar (weights)."""
    win, sym, sv, full = base_spin(rnd, S["spin"], S["respin"])
    if _tail(rnd, win):
        return finish(rnd)
    sc = scatters(sym)
    t = scatter_tier(len(sc))
    if t == "flip":
        t = card_flip(rnd)
    if t:
        play_bonus(rnd, t, full, sv, S["fs"], "natural", S.get("guar", GUAR_WEIGHTS), sc)
    return finish(rnd)


BUY_SCATTERS = {"dare": 3, "double_dare": 4, "triple_dare": 5, "hidden": 5}   # hidden: tuning harness only


def round_buy(rnd, S, tier, max_tries=200000):
    """dare / double_dare / triple_dare buy: a real trigger spin on the mode's buy-trigger strips (dense scatters),
    redrawn until its final board shows exactly the bought scatter count. Triple Dare buys skip the card flip."""
    need = BUY_SCATTERS[tier]
    for _ in range(max_tries):
        rnd.__init__(Emitter(rnd.emit.on))
        rnd.emit("buyTriggerStart", tier=tier)
        win, sym, sv, full = base_spin(rnd, S["spin"], S["respin"])
        sc = scatters(sym)
        if len(sc) != need:
            continue
        if _tail(rnd, win):
            rnd.stats["tier"] = tier
            return finish(rnd)
        play_bonus(rnd, tier, full, sv, S["fs"], "buy", S.get("guar", GUAR_WEIGHTS), sc)
        return finish(rnd)
    raise RuntimeError("buy trigger rejection exhausted for " + tier)


MYSTERY_SCATTERS = {"none": 2, "double_dare": 4, "triple_dare": 5, "hidden": 5}


def round_mystery(rnd, S, bucket, max_tries=400000):
    """SPEC v2 §8. bucket drawn upstream at exact 50/37/10/3. One normal paid spin on Mystery's strips: reels 1-2
    always show a scatter (the 2-scatter tease), reels 3-5 slow-spin and decide: none = 2 scatters in total,
    Double Dare = 4, Triple Dare / Epic = 5 + card flip showing the bucket. Respins run as usual; the count is taken
    on the final board (redrawn until it matches the bucket). The bonus starts from THIS board's wilds (carried,
    sticky) plus the tier's guaranteed stacks."""
    need = MYSTERY_SCATTERS[bucket]
    for _ in range(max_tries):
        rnd.__init__(Emitter(rnd.emit.on))
        rnd.emit("mysteryStart", odds=dict(MYSTERY_ODDS))
        win, sym, sv, full = base_spin(rnd, S["spin"], S["respin"])
        sc = scatters(sym)
        if len(sc) != need or not {0, 1} <= {r for r, _ in sc}:
            continue                       # the tease: reels 1 and 2 always show the Dare Card
        if _tail(rnd, win):
            rnd.emit("mysteryResult", outcome=bucket)
            rnd.stats["tier"] = None if bucket == "none" else bucket
            return finish(rnd)
        if need == 5:
            card_flip(rnd, bucket)
        rnd.emit("mysteryResult", outcome=bucket)
        if bucket != "none":
            play_bonus(rnd, bucket, full, sv, S["fs"], "mystery", S.get("guar", GUAR_WEIGHTS), sc)
        return finish(rnd)
    raise RuntimeError("mystery rejection exhausted for " + bucket)


EGW_PATTERNS = [((0,2),30),((0,3),15),((1,3),15),((0,4),10),((1,4),10),((0,2,4),12),((0,1),4),((3,4),4),
                ((0,1,3),1.5),((1,2),1),((2,3),1),((1,2,3),0.12),((0,1,2),0.08),((0,1,3,4),0.04),
                ((1,2,3,4),0.005),((0,1,2,3),0.003),((0,1,2,3,4),0.002)]


def round_egw(rnd, S, patterns=EGW_PATTERNS, pattern=None):
    """SPEC §7: 2-5 placed x4 full reels, one spin with respins, never a bonus."""
    emit = rnd.emit
    if pattern is None:
        pattern = random.choices([p for p, _ in patterns], weights=[w for _, w in patterns])[0]
    emit("egwStart", reels=list(pattern), value=4)
    sym, pad, stops = S["spin"].land()
    full = {r: 4 for r in pattern}
    for r in pattern:
        for row in range(ROWS):
            sym[r][row] = W; pad[r][row + 1] = W
    landed = {(r, row) for r in range(REELS) if r not in full for row in range(ROWS)}
    sv = wilds_from_board(sym, full)
    win, _, _ = play_sequence(rnd, sym, sv, full, S["respin"], "basegame", landed=landed, pad=pad, stops=stops,
                              reveal_locked=locked_obj(full, {}), fs_reveal_groups=True)
    rnd.stats["egw_pattern"] = pattern
    track_max(rnd, full, sv)
    _tail(rnd, win)
    return finish(rnd)
