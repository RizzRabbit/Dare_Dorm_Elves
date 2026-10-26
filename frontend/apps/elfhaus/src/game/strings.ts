// Player-facing wording. Social mode (?social=true or a social currency) never shows
// the restricted words (C34; full list in scripts/test-books.mjs): "Get Bonus", "play", "wins", "Ante".
let social = false;
export const setSocial = (s: boolean) => (social = s);
export const isSocial = () => social;
const T = {
	buyTitle: ['BUY BONUS', 'GET BONUS'],
	buyBtn: ['BUY', 'GET'],
	buyAria: ['Bonus buy', 'Get bonus'],
	betLabel: ['BET', 'PLAY'],
	betDown: ['Decrease bet', 'Decrease play amount'],
	betUp: ['Increase bet', 'Increase play amount'],
	noFunds: ['Insufficient balance for this bet.', 'Insufficient balance for this play.'],
	ofBet: ['x bet', 'x play'],
} as const;
export const t = (k: keyof typeof T, vars: Record<string, string> = {}) =>
	T[k][social ? 1 : 0].replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? '');
