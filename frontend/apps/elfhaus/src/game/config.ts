// Elfhaus static game config (SPEC §1–§10, DECISIONS). Every math-owned value (mode costs / RTP, paytable, lines, max
// win, spin cap, free-spin counts, Epic stack start and grow step, Mystery odds, ...) comes from modes.generated.json,
// which scripts/sync-config.mjs writes from the math (math-snapshot/, refreshed by scripts/sync-math.mjs). The frontend
// never types a win value itself; math.fallback.json is only a safety net (test-books.mjs fails if it drifts).
import generated from './modes.generated.json';
import fallback from './math.fallback.json';

type MathCfg = typeof fallback;
const G: MathCfg = { ...fallback, ...((generated as any).math || {}) };
export const MATH: MathCfg & { source?: string } = G;

export const GAME_ID = 'elfhaus';
export const VERSION = '1.0.0';
export const REELS = 5;
export const ROWS = 4;
export const MAX_WIN_X: number = G.maxWinX;   // math CAP_C / 100
export const SPIN_CAP: number = G.spinCap;   // math SPIN_CAP
export const MAX_RESPINS: number = G.maxRespins;
export const CONFIRM_ABOVE_X = 2;

// SPEC §2 (row 0 = top), math LINES
export const LINES: number[][] = G.lines;

// Pays in line-bet units for 3/4/5 of a kind; total play = 20 line units, so x play = lb / 20.
export const PAYTABLE = G.paytable as Record<string, [number, number, number]>; // math PAY
export const SYMBOL_NAMES: Record<string, string> = {
	H1: 'Roxy', H2: 'Jade', H3: 'Vi', H4: 'Coco', L1: 'Bottle', L2: 'Lips', L3: 'Phone', L4: 'Red Cup', L5: 'Leaf', W: 'Wild', S: 'Dare Card',
};

export const START_FS: { dare: number; double_dare: number; triple_dare: number; hidden: number } = G.startFs; // math START_FS
export const EPIC_STACK_X: number = G.epic.stackX;     // math GUAR_MIN_VAL.hidden (math v2: x16; display reads the book value)
export const EPIC_GROW_STEP: number = G.epic.step;     // math GROW_STEP.hidden (math v2: +2 per step)
export const GROW_STEP: number = G.growStep.default;   // every other tier and base play (+1)
export const GUARANTEE: { triple_dare: number; hidden: number } = G.guarantee; // full-reel wilds guaranteed at bonus start
export const RETRIGGER = G.retrigger;                  // free-spin retrigger: 2 Dare Cards / 3 or more
export const EGW_STACK_X: number = G.egwStackX;        // EGW full-reel wild value
export const MYSTERY_ODDS: { none: number; double_dare: number; triple_dare: number; hidden: number } = G.mysteryOdds;
export type Tier = 'dare' | 'double_dare' | 'triple_dare' | 'hidden';
export const TIER_LABEL: Record<Tier, string> = { dare: 'Dare', double_dare: 'Double Dare', triple_dare: 'Triple Dare', hidden: 'Epic' }; // math tier id 'hidden' = UI name Epic (EVENTS.md)

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
export const ANTE_COST: number = MODES.ante?.cost ?? G.costs.ante;
export const fmtX = (x: number) => `${+x.toFixed(2)}x`;
/** 'about 1 in N' natural bonus odds for a mode (math index pBonus, fallback N). */
export const oneIn = (m: ModeKey, fallback: number) => `about 1 in ${MODES[m]?.pBonus ? Math.round(1 / MODES[m].pBonus!) : fallback}`;
// v3.13: mode descriptions moved to copy.ts (social-aware, scanned by test-books.mjs).

