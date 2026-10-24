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
    for _ in range(15):
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
