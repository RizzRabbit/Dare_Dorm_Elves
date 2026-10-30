/** Math 6de1363 (James 17:06 CDT): the round's payout is rounded DOWN to 0.1x at finalWin (finalWin = payoutMultiplier),
 *  while the running events (winInfo / updateStepWin / setWin / setTotalWin / freeSpinEnd) keep the exact 0.05x amounts.
 *  The rounding comes off the free-spin wins first, else the base wins (same rule as the math's finish()).
 *  Rewrite only the round's closing amounts so the last things the player sees land on the paid amount:
 *   - the trailing setTotalWin events that carry the exact round total -> finalWin (flagged `payout` so the meter may step down),
 *   - the bonus TOTAL WIN (last freeSpinEnd) -> its amount minus the rounding, when the free wins cover it,
 *   - otherwise the base spin's setWin (the big-win banner count-up target) -> its amount minus the rounding.
 *  Running amounts inside the round are left as the book has them. Capped rounds are exact and pass through. Pure data. */
type Ev = { type: string; amount?: number; [k: string]: unknown };
export function payoutFlow<T extends Ev>(events: T[]): T[] {
	const fi = events.map((e) => e.type).lastIndexOf('finalWin');
	if (fi < 0 || events.some((e) => e.type === 'wincap')) return events;
	const F = Number(events[fi].amount);
	let ti = -1;
	for (let i = fi - 1; i >= 0; i--) if (events[i].type === 'setTotalWin') { ti = i; break; }
	if (ti < 0 || !Number.isFinite(F)) return events;
	const T0 = Number(events[ti].amount), d = T0 - F;
	if (!(d > 0)) return events;
	const out = events.slice();
	for (let i = ti; i >= 0; i--) {
		const e = out[i];
		if (e.type === 'setTotalWin') { if (e.amount !== T0) break; out[i] = { ...e, amount: F, payout: true }; }
		else if (e.type === 'setWin' || e.type === 'winInfo' || e.type === 'updateStepWin') break;
	}
	const before = (type: string, end: number) => { for (let i = end - 1; i >= 0; i--) if (out[i].type === type) return i; return -1; };
	const fe = before('freeSpinEnd', fi);
	if (fe >= 0 && Number(out[fe].amount) >= d) out[fe] = { ...out[fe], amount: Number(out[fe].amount) - d };
	else {
		// no bonus (or the free wins are smaller than the rounding): the base spin's win carries it
		const ft = before('freeSpinTrigger', fi);
		let sw = -1;
		if (ft >= 0) sw = before('setWin', ft); else sw = before('setWin', fi);
		if (sw >= 0 && Number(out[sw].amount) >= d) out[sw] = { ...out[sw], amount: Number(out[sw].amount) - d };
	}
	return out;
}
