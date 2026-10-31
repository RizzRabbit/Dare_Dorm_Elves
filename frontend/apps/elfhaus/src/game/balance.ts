/** v20: the strip balance at the end of a round (see game.ts finishRound). `endBal` is the end-round balance
 *  (NaN if none came back); a value that already holds this round's payout is the server truth and wins. */
export function creditedBalance(playBal: number, payout: number, endBal: number): number {
	const expected = playBal + Math.max(0, payout || 0);
	if (!Number.isFinite(endBal)) return expected;
	return endBal + 0.005 >= expected ? endBal : expected;
}
