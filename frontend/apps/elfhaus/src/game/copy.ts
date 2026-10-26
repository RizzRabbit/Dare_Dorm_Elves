// v3.13 player-facing copy for the bonus menu confirm card, the Turbo toggle and the cost-related rules lines.
// Dependency-free (values come in through CopyCtx) so scripts/test-books.mjs can render every string in social mode
// and scan it for the restricted words (Stake social casino: no bet / buy / pay / wager / cash / money / credit /
// currency / stake / fund / purchase / cost / price wording).
export type CopyMode = 'ante' | 'dare' | 'double_dare' | 'triple_dare' | 'mystery' | 'egw';
export type CopyCtx = {
	social: boolean;
	anteX: string;     // '3x'
	anteOdds: string;  // 'about 1 in 68'
	baseOdds: string;  // 'about 1 in 190'
	fs: { dare: number; double_dare: number; triple_dare: number };
	odds: { none: number; double_dare: number; triple_dare: number; hidden: number };
};

/** Rules "Modes" paragraph descriptions (the long form). */
export function modeDesc(m: CopyMode, c: CopyCtx): string {
	switch (m) {
		case 'ante': return c.social
			? `Plays for ${c.anteX} the play amount; a bonus triggers naturally ${c.anteOdds} spins, versus ${c.baseOdds} in base play. Same symbols, wins and rules.`
			: `Costs ${c.anteX} the bet; a bonus triggers naturally ${c.anteOdds} spins, versus ${c.baseOdds} in base play. Same symbols, wins and rules.`;
		case 'dare': return `One real trigger spin with 3 Dare Cards (it wins as normal), then ${c.fs.dare} free spins. Dare wilds clear after each spin.`;
		case 'double_dare': return `One real trigger spin with 4 Dare Cards, then ${c.fs.double_dare} free spins. The trigger spin's wilds stay in place; all wilds stay locked and keep growing.`;
		case 'triple_dare': return `One real trigger spin with 5 Dare Cards, then ${c.fs.triple_dare} free spins. The trigger spin's wilds stay in place, with at least 1 full-reel wild guaranteed.`;
		case 'mystery': return `One spin that always lands 2 Dare Cards; the remaining reels are the reveal. The result was decided before the spin: No bonus ${c.odds.none}% · Double Dare ${c.odds.double_dare}% · Triple Dare ${c.odds.triple_dare}% · Epic ${c.odds.hidden}%. A bonus continues on the same board.`;
		case 'egw': return 'One supercharged spin: 2 to 5 reels land wilds that grow into full-reel wilds (x4 each) once the spin stops, then respins. It never awards free spins.';
	}
}

/** Confirm card body: 1-2 sentences, same facts as the rules. */
export function shortDesc(m: CopyMode, c: CopyCtx): string {
	switch (m) {
		case 'ante': return `Bonuses trigger more often: ${c.anteOdds} spins instead of ${c.baseOdds}. Same symbols, wins and rules.`;
		case 'dare': return `3 Dare Cards. ${c.fs.dare} free spins, wilds reset.`;
		case 'double_dare': return `4 Dare Cards. ${c.fs.double_dare} free spins, sticky wilds that grow.`;
		case 'triple_dare': return `5 Dare Cards. ${c.fs.triple_dare} free spins, sticky wilds, a full-reel wild guaranteed.`;
		case 'mystery': return `One spin that always lands 2 Dare Cards; the other reels reveal the result. No bonus ${c.odds.none}% · Double Dare ${c.odds.double_dare}% · Triple Dare ${c.odds.triple_dare}% · Epic ${c.odds.hidden}%.`;
		case 'egw': return '2 to 5 full-reel wilds (x4 each) with respins. No scatters.';
	}
}

/** Everything on the confirm card except the art. amount = the formatted per-spin amount, x = '100x'. */
export function confirmCopy(m: CopyMode, c: CopyCtx, name: string, amount: string, x: string) {
	return {
		title: name.toUpperCase(),
		desc: shortDesc(m, c),
		amount,
		per: c.social ? 'PER PLAY' : 'PER SPIN',
		x: c.social ? `${x} play` : `${x} bet`,
		note: 'Stays on for every spin until you turn it off.',
		button: 'CONFIRM',
		hint: 'Tap anywhere to cancel',
	};
}

export const turboCopy = (_social: boolean) => ({ label: 'TURBO', sub: 'faster animations', aria: 'Turbo' });
/** Rules mode table, second column. */
export const costHeader = (social: boolean) => (social ? 'Play for' : 'Cost');
/** Rules "Controls": the bonus-menu sentence. anteX = '3x'. */
export function controlsBonus(c: CopyCtx) {
	return `The bonus button opens the bonus menu: tap Ante (${c.anteX}) or a bonus to see what it does, then confirm it to switch it on. ` +
		`An active mode stays on for every spin (and autoplay) until you tap its tag above the spin button or switch it off in the bonus menu; ` +
		(c.social ? `each spin is played for that mode's amount.` : `each spin costs that mode's price.`);
}
export const controlsTurbo = () => ' Turbo (the lightning button, or the switch in the bonus menu) speeds up animations.';
export const controlsAuto = (c: CopyCtx) =>
	' Autoplay runs 10 to 1,000 spins with optional stops (net loss, single win, balance increase, feature trigger); net loss and gain count ' +
	(c.social ? "each spin's full play amount." : "each spin's full cost.") + ' It also stops on any error or low balance; press the spin button to stop it.';
