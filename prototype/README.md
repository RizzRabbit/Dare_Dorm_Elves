# Elfhaus: functional frontend prototype
**PROTOTYPE – untuned math.** Plain HTML/JS/CSS, no build, no dependencies.

## Run
```bash
cd prototype && python3 -m http.server 8765     # then open http://localhost:8765
node tests/run_tests.js                         # JS engine vs SPEC §12 vs reference_rules.py
./shoot.sh                                      # re-capture reference_frames/ (headless Chrome)
```
Space = spin. **DEV** (top right) = scenario replays E1–E12 (+E2b, E11) with expected-vs-actual, autoplay sanity, book dump.
`?frame=base|respin|fullreel|merged|intro|bonus|mystery|buy|bigwin|wincap|dev` freezes a reference state.

## Files
- `engine.js`: exact port of `design/prototypes/reference_rules.py` + toy book generators (base, ante, 3 buys, Mystery, EGW, free spins) that emit `design/EVENTS.md` events. Works in browser and Node.
- `app.js`: renderer. It **only replays book events** (same split as Stake: math → books → frontend).
- `tests/run_tests.js`, `shoot.sh`, `reference_frames/`, `REFERENCE_FRAME.md` (layout spec for the real web-sdk build).

## Placeholders
Art: only background (v3 bright), logo, single wild (`wild_single` v3) and H1 Roxy (v3) are real concepts; the full-reel and merged wilds are styled placeholder tiles ("ONE ELF" / "ELF 1..N" + "N ELVES" label) because the old swimwear concept breaks the thong-bikini-only rule; H2–H4 and L1–L5 are styled text tiles. No sound, no Spine. Toy reel parameters are v2 (wilds weighed down, rarity reel 2 < 3 < 1 < 4–5; see engine.js P); toy buy prices Dare 40x, Double 210x, Triple 1000x, Mystery 245x, EGW 200x. No RGS: a local $1,000 demo balance.
