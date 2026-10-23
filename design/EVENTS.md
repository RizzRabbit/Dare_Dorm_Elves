# Dare Dorm – Elves: book event schema
The contract between the math (`math/games/dare_dorm_elves/game_events.py`) and the frontend (`frontend/apps/dare-dorm-elves/src/game/typesBookEvent.ts` + `bookEventHandlerMap.ts`). Modeled on Vault Breakers' `math/EVENTS.md`. **Implement exactly these names and fields**; if the math needs a change, update this file first and keep both sides in sync.

## Conventions
- Every event: `{"index": n, "type": "<name>", ...}`, `index` 0-based within the book.
- **Amounts** (`amount`, `win`, `totalWin`) are integers = bet multiplier × 100 (`150` = 1.5x). Round line wins to 0.01x before summing; the book's `payoutMultiplier` must equal `finalWin.amount` and the lookup-table row.
- **Coordinates:** `reveal.board` uses the math-sdk padded layout (`include_padding = True`): `board[reel][row]`, 6 rows per reel, visible rows **1–4**. **Every other event uses visible 0-based coordinates `{reel: 0-4, row: 0-3}`.** (Vault Breakers mixed two systems in its win events; we don't.)
- Symbol objects: `{"name": "H1"}`; wilds `{"name": "W", "wild": true, "multiplier": 1}`.
- `step`: 0 = the spin itself, 1–3 = respins.
- `gameType`: `"basegame"` (base, ante, the buy-trigger spin, the Mystery spin, EGW) or `"freegame"`.

## Events
### reveal
New board at the start of each base/buy/Mystery/EGW spin and each free spin (respins use `respinReveal`, not `reveal`).
- `board`, `paddingPositions` (5 ints), `gameType`, `anticipation` (5 ints; >0 = slow-spin that reel, e.g. a 3-wild partial stack's reel).
- `locked`: `{fullReels: [{reel, value}], singles: [{reel, row, value}]}`: wilds carried in (free spins) or placed (EGW) **before** the cells landed.

### stackComplete
A reel became a full-reel wild in this step.
- `step`, `reel`, `parts`: the 4 cell values top→bottom, `value` (sum), `instant` (true if all 4 landed in this step → value 4).

### mergeGroups
Emitted whenever the set of adjacent full-reel groups changes (after a `stackComplete` or a `wildGrow` that touches a group), and once after each free-spin `reveal` if groups exist.
- `step`, `groups`: `[{reels: [0,1], values: [6,5], product: 30}]` (only groups of ≥ 2 adjacent reels). The frontend swaps in the 2/3/4/5-wide merged scene (2/3/4/5 elves) and the combined badge "x6 × x5 = x30".

### winInfo
The line wins **paid in this step**: every winning line on this step's board, including all-wild lines that pay again (SPEC §4.3).
- `step`, `totalWin` (this step), `wins[]`:
  - `lineIndex` (1–20), `symbol`, `count` (3–5), `win`
  - `positions`: the run's cells `[{reel,row}]`
  - `meta`: `{basePay: lb, lineMult, connected: bool, groups: [{type: "merge", reels, values, product} | {type: "full", reel, value} | {type: "single", reel, row, value}]}`

### updateStepWin
Running win of the current spin (all steps so far), after each `winInfo`. `amount`.

### wildGrow
After each step's pay. `step`, `changes`: `[{kind: "single", reel, row, from, to} | {kind: "full", reel, from, to}]` (+1 each).

### respinStart
A respin follows. `step` (1–3, the step about to play), `replace`: cells to be replaced `[{reel,row}]` (the non-wild cells of **every** winning line this step, wild or not, SPEC §4.4), `locked`: all wilds `{fullReels, singles}`, `remaining`: respins left after this one.

### respinReveal
The replacement cells land. `step`, `newSymbols`: `[{reel, row, name, wild?, multiplier?}]`.

### respinEnd
`step` (last step played), `reason`: `"noConnection"` | `"maxRespins"` | `"wincap"`.

### setWin
Spin win (all steps), only if > 0. `amount`, `winLevel` (1–10, standard scale as VB).

### setTotalWin
Round running total after each spin (base + all free spins so far). `amount`.

### freeSpinTrigger
- `tier`: `"dare"` | `"double_dare"` | `"triple_dare"` | `"hidden"`
- `totalFs` (8/10/12/14), `cap`: 18
- `carried`: `{fullReels: [{reel, value}], singles: [{reel, row, value}]}`
- `source`: `"natural"` | `"buy"` | `"mystery"`

### updateFreeSpin
Before each free spin's `reveal`. `amount` (1-based spin number), `total`, `cap`: 18.

### freeSpinRetrigger
A free spin completed new stacks. `newStacks`: reels, `addedFs` (2 × new stacks, after cap), `totalFs`, `capped` (bool).

### bonusUpgrade
Dare only, at most once per round (SPEC §6, D10). After a Dare free spin's `setTotalWin` when that spin completed a stack: `from`: `"dare"`, `to`: `"double_dare"`, `spinsAdded` (2, after the 18 cap), `totalFs` (new budget), `stackReel` (reel of the upgrading stack), `locked` (`{fullReels, singles}` that stay locked from now on, same shape as `carried`). Any other new stacks in the same spin follow as `freeSpinRetrigger`. Later `updateFreeSpin` events carry `tier: "double_dare"`.

### freeSpinEnd
`amount` (free-spins win), `winLevel` (endFeature scale).

### mysteryStart
First event of a Mystery book, before the reveal: `odds`: `{"none": 50, "double_dare": 37, "triple_dare": 10, "hidden": 3}`. **Never reveals the outcome.**

### mysteryResult
After the Mystery spin's last `respinEnd`: `outcome` (`"none"` | tier). If not `"none"`, a `freeSpinTrigger` with `source: "mystery"` follows.

### egwStart
First event of an EGW book: `reels`: the placed pattern (e.g. `[0,2,4]`), `value`: 4.

### buyTriggerStart
First event of a `dare`/`double_dare`/`triple_dare` book: `tier`. Tells the frontend the next spin is the bought trigger spin.

### wincap
Round reached 50,000x: `amount` = 5000000. Play stops at once (no further events except `setTotalWin`, `freeSpinEnd` if in FS, and `finalWin`).

### finalWin
Last event of every book. `amount` = `payoutMultiplier`.

## Sequences
**Base / Ante spin:** `reveal` → [`stackComplete`?/`mergeGroups`?] → `winInfo` → `updateStepWin` → `wildGrow` → (`respinStart` → `respinReveal` → [`stackComplete`/`mergeGroups`] → `winInfo`? → `updateStepWin` → `wildGrow`)×≤3 → `respinEnd` → `setWin`? → `setTotalWin` → (`freeSpinTrigger` → free spins) → `finalWin`.
A losing spin: `reveal` → `setTotalWin` → `finalWin`.

**Free spin:** `updateFreeSpin` → `reveal` (with `locked`) → `mergeGroups`? → same step loop → `respinEnd` → `setWin`? → `setTotalWin` → `bonusUpgrade`? (Dare only, once) → `freeSpinRetrigger`? … → `freeSpinEnd` → `finalWin`.

**Bought bonus:** `buyTriggerStart` → base-spin sequence (real trigger spin) → `freeSpinTrigger{source:"buy"}` → free spins → `finalWin`.

**Mystery:** `mysteryStart` → base-spin sequence (≥ 1 respin always) → `mysteryResult` → (`freeSpinTrigger{source:"mystery"}` → free spins) → `finalWin`.

**EGW:** `egwStart` → `reveal` (with `locked.fullReels`) → `mergeGroups`? → step loop → `setWin`? → `setTotalWin` → `finalWin`. Never `freeSpinTrigger`.

**Wincap anywhere:** … `winInfo` → `updateStepWin` → `respinEnd{reason:"wincap"}` → `wincap` → `setTotalWin` → (`freeSpinEnd`) → `finalWin`.

## Sample books
Phase B writes one real book per case to `math/samples/` (JSON, pretty): `base_zero`, `base_win`, `base_respin3`, `base_dare`, `base_double`, `base_triple`, `base_hidden`, `ante_trigger`, `dare_buy`, `double_buy`, `triple_buy`, `mystery_none`, `mystery_double`, `mystery_triple`, `mystery_hidden`, `egw_nonadjacent`, `egw_adjacent`, `<mode>_wincap` for all 7 modes. The frontend mock uses these (VB pattern: `src/mock/books/`).
