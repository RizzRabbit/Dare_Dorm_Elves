"""Book/event sanity per mode on the real strips (EVENTS.md): finalWin == round total, coordinates in range,
reveal board is 5 reels x 6 padded rows, a round never exceeds the 50,000x cap."""
import os, random, sys
import pytest
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
import game_calculations as gc, modes, make_reels

if not os.path.isdir(os.path.join(HERE, "reels")) or not os.listdir(os.path.join(HERE, "reels")):
    make_reels.main()


def _coords(ev):
    for k in ("replace", "newSymbols"):
        for c in ev.get(k, []):
            assert 0 <= c["reel"] < 5 and 0 <= c["row"] < 4
    if "reel" in ev and ev["type"] in ("stackComplete",):
        assert 0 <= ev["reel"] < 5


@pytest.mark.parametrize("mode", modes.MODES)
def test_books(mode):
    random.seed(7)
    S = modes.build_sets(mode)
    for _ in range(40):
        rnd = gc.Round(gc.Emitter(True))
        modes.play_round(mode, S, rnd)
        ev = rnd.emit.events
        assert ev[-1]["type"] == "finalWin" and ev[-1]["amount"] == rnd.total <= gc.CAP_C
        assert [e["index"] for e in ev] == list(range(len(ev)))
        for e in ev:
            _coords(e)
            if e["type"] == "reveal":
                assert len(e["board"]) == 5 and all(len(c) == 6 for c in e["board"])
        if mode == "egw":
            assert not any(e["type"] == "freeSpinTrigger" for e in ev)
        if mode == "mystery":
            assert ev[0]["type"] == "mysteryStart"
            assert not any(e["type"] == "freeSpinTrigger" and e["tier"] == "dare" for e in ev)
        _v2(mode, ev)


def _v2(mode, ev):
    """SPEC v2: scatter triggers, card flip, Dare not sticky, retrigger +2/+5 with cap 20, guaranteed stacks."""
    assert not any(e["type"] == "bonusUpgrade" for e in ev)
    for e in ev:
        if e["type"] == "reveal":
            for col in e["board"]:
                assert sum(1 for c in col[1:5] if c["name"] == "S") <= 1      # max one scatter per reel
    trig = [e for e in ev if e["type"] == "freeSpinTrigger"]
    if not trig:
        return
    t = trig[0]; tier = t["tier"]
    n_sc = len(t["scatters"])
    flips = [e for e in ev if e["type"] == "cardFlip"]
    if mode == "triple_dare":
        assert not flips and n_sc == 5
    elif tier in ("triple_dare", "hidden"):
        assert n_sc == 5 and len(flips) == 1 and flips[0]["result"] == tier
    if mode != "mystery":
        assert n_sc == {"dare": 3, "double_dare": 4, "triple_dare": 5, "hidden": 5}[tier]
    if tier == "dare":
        assert t["carried"] == {"fullReels": [], "singles": []}
        for e in ev:
            if e["type"] == "reveal" and e["gameType"] == "freegame":
                assert e["locked"] == {"fullReels": [], "singles": []}
    g = [e for e in ev if e["type"] == "guaranteedStacks"]
    need = {"triple_dare": 1, "hidden": 2}.get(tier, 0)
    if need and len(t["carried"]["fullReels"]) < need:
        assert len(g) == 1 and len(g[0]["locked"]["fullReels"]) >= need
    else:
        assert not g
    fs = [e for e in ev if e["type"] == "updateFreeSpin"]
    assert len(fs) <= gc.SPIN_CAP and fs[0]["total"] == gc.START_FS[tier]
    for e in ev:
        if e["type"] == "freeSpinRetrigger":
            assert e["addedFs"] <= (5 if e["count"] >= 3 else 2) and e["totalFs"] <= gc.SPIN_CAP
