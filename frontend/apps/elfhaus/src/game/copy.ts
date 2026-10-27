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
/** v3.16 (#235): Menu, Info, Music / Sound, closing panels, the intro skip box and replay PLAY. */
export const controlsUi = () =>
	' The menu button opens Info (these rules) and the Music and Sound volume sliders. Close a panel with the small X in its top corner, Esc or a tap outside it; drag or swipe to scroll it.' +
	' "Don\'t show this again" on the intro screen skips it next time. In a replay, PLAY shows the recorded round and PLAY AGAIN repeats it.' +
	' If a round was left unfinished, a card asks first: RESUME plays it to the end, SKIP shows the result straight away.'; // v3.16d (#235)
/** v3.16c (James): resume card for an unfinished round. amount = the round's final win at its own stake, or null when
 *  unknown or 0 (v3.16d: never "collect $0.00"). Social mode never says "collect": skip shows the result. */
export const resumeCopy = (social: boolean, amount: string | null) => ({
	title: 'Unfinished round',
	line: social
		? (amount ? `Resume to watch it, or skip to see your result (${amount}).` : 'Resume to watch it, or skip to see your result.')
		: (amount ? `Resume to watch it, or skip to collect ${amount}.` : 'Resume or skip to finish.'),
	resume: 'RESUME', skip: 'SKIP',
});
/** v3.16 (#77): fixed player text per RGS error code (social-safe); the server's own message is never shown. */
const ERR_TEXT: Record<string, string> = {
	ERR_VAL: 'The request was not accepted. Please try again.',
	ERR_IS: 'Your session is no longer valid. Please reload the game.',
	ERR_ATE: 'Your session has expired. Please reload the game.',
	ERR_GLE: 'You have reached a limit set on your account.',
	ERR_LOC: 'This game is not available in your location.',
	ERR_MAINTENANCE: 'The game is under maintenance. Please try again later.',
	ERR_RGS_URL: 'The game could not find its server. Please reload the game.',
	ERR_BET_LEVELS: 'The game could not load its settings. Please reload the game.',
	ERR_REPLAY: 'This replay could not be loaded.',
};
export const errorText = (code: string) => ERR_TEXT[code] || 'Something went wrong. Please check your connection and try again.';
export const ERROR_TEXTS = Object.values(ERR_TEXT);
