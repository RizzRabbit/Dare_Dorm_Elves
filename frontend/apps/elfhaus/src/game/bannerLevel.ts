/** v20: the big-win banner level of a setWin. Book amounts are x100 of the base bet; edges = the round's mode edges
 *  (math WIN_LEVEL_EDGES_BY_MODE: the bonus buys DD / TD / Mystery / EGW size every tier x10, James 2026-10-30 19:28 CDT).
 *  Returns the level, or 0 when there is no banner: below the first banner level, at the max level (the max-win screen) or
 *  at the cap. Pure (tests import it). */
export function levelAt(x: number, edges: readonly number[]) { for (let i = 0; i < edges.length; i++) if (x < edges[i]) return i + 1; return edges.length + 1; }
export function bannerLevel(amount: number, edges: readonly number[], firstLevel: number, maxWinX: number) {
	const x = amount / 100, lv = levelAt(x, edges);
	return lv >= firstLevel && lv < edges.length + 1 && x < maxWinX ? lv : 0;
}
