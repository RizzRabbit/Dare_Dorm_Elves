// Elfhaus static game config (SPEC §1–§10, DECISIONS). Mode costs/RTP come from modes.generated.json,
// which scripts/sync-config.mjs writes from the math publish files (PROVISIONAL defaults until then).
import generated from './modes.generated.json';

export const GAME_ID = 'elfhaus';
export const VERSION = '1.0.0';
export const REELS = 5;
export const ROWS = 4;
export const MAX_WIN_X = 50000;
export const SPIN_CAP = 18;
export const CONFIRM_ABOVE_X = 2;

// SPEC §2 (row 0 = top)
export const LINES: number[][] = [
	[0, 0, 0, 0, 0], [1, 1, 1, 1, 1], [2, 2, 2, 2, 2], [3, 3, 3, 3, 3], [0, 1, 2, 1, 0],
	[3, 2, 1, 2, 3], [1, 0, 0, 0, 1], [2, 3, 3, 3, 2], [0, 1, 0, 1, 0], [3, 2, 3, 2, 3],
	[1, 2, 1, 2, 1], [2, 1, 2, 1, 2], [0, 0, 1, 0, 0], [3, 3, 2, 3, 3], [1, 1, 0, 1, 1],
	[2, 2, 3, 2, 2], [0, 1, 1, 1, 0], [3, 2, 2, 2, 3], [1, 2, 3, 2, 1], [2, 1, 0, 1, 2],
];

// Pays in line-bet units for 3/4/5 of a kind; total play = 20 line units, so x play = lb / 20.
export const PAYTABLE: Record<string, [number, number, number]> = {
	W: [25, 100, 500], H1: [25, 100, 500], H2: [20, 75, 300], H3: [15, 50, 200], H4: [10, 40, 150],
	L1: [5, 20, 80], L2: [5, 15, 60], L3: [4, 10, 40], L4: [3, 8, 30], L5: [3, 8, 30],
};
export const SYMBOL_NAMES: Record<string, string> = {
	H1: 'Roxy', H2: 'Jade', H3: 'Vi', H4: 'Coco', L1: 'Bottle', L2: 'Lips', L3: 'Phone', L4: 'Red Cup', L5: 'Leaf', W: 'Wild',
};

export const START_FS = { dare: 8, double_dare: 10, triple_dare: 10, hidden: 10 } as const;
export const MYSTERY_ODDS = { none: 50, double_dare: 37, triple_dare: 10, hidden: 3 } as const;
export type Tier = keyof typeof START_FS;
export const TIER_LABEL: Record<Tier, string> = { dare: 'Dare', double_dare: 'Double Dare', triple_dare: 'Triple Dare', hidden: 'Hidden' };

export type ModeKey = 'base' | 'ante' | 'dare' | 'double_dare' | 'triple_dare' | 'mystery' | 'egw';
export const BUY_MODES: ModeKey[] = ['dare', 'double_dare', 'triple_dare', 'mystery', 'egw'];
export const MODE_LABEL: Record<ModeKey, string> = {
	base: 'Spin', ante: 'Ante', dare: 'Dare', double_dare: 'Double Dare', triple_dare: 'Triple Dare', mystery: 'Mystery Spin', egw: 'Elves Gone Wild',
};
type ModeInfo = { cost: number; rtp: number | null; maxWinX: number; pBonus?: number | null };
export const MODES: Record<ModeKey, ModeInfo> = (generated as any).modes;
export const MODES_SOURCE: string = (generated as any).source;
export const isProvisional = () => MODES_SOURCE.startsWith('PROVISIONAL');
// Ante price comes from the math index (modes.generated.json); 3x as of math 6a1be1b.
export const ANTE_COST: number = MODES.ante?.cost ?? 3;
export const fmtX = (x: number) => `${+x.toFixed(2)}x`;
const oneIn = (m: ModeKey, fallback: number) => `about 1 in ${MODES[m]?.pBonus ? Math.round(1 / MODES[m].pBonus!) : fallback}`;
export const MODE_DESC: Record<ModeKey, string> = {
	base: 'A normal spin.',
	ante: `Costs ${fmtX(ANTE_COST)} the play amount; a bonus triggers naturally ${oneIn('ante', 68)} spins, versus ${oneIn('base', 190)} in base play. Same symbols, wins and rules.`,
	dare: 'One real trigger spin (with respins, it wins as normal), then 8 free spins. Dare wilds clear after each spin; the first completed full-reel wild upgrades the bonus once to Double Dare (+2 spins).',
	double_dare: 'One real trigger spin, then 10 free spins starting with 1 locked full-reel wild. All wilds stay locked and keep growing.',
	triple_dare: 'One real trigger spin, then 10 free spins starting with 1 locked full-reel wild and 2 or more sticky wilds.',
	mystery: 'One spin with a 3-wild tease and respins; the respins are the reveal. Every Mystery Spin shows a 3-wild tease; the result was decided before the reveal and the odds are 50/37/10/3 (No bonus 50% · Double Dare 37% · Triple Dare 10% · Hidden 3%).',
	egw: 'One supercharged spin: 2 to 5 full-reel wilds (x4 each) are placed before the reels land, then respins. It never awards free spins.',
};

