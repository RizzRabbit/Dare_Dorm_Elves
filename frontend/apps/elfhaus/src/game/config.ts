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
	H1: 'Star', H2: 'Sled', H3: 'Skis', H4: 'Cocoa', L1: 'Bell', L2: 'Bauble', L3: 'Gift', L4: 'Candy Cane', L5: 'Mulled Wine', W: 'Wild', S: 'Ski Pass',
};

export const START_FS: { dare: number; double_dare: number; triple_dare: number; hidden: number } = G.startFs; // math START_FS
export const EPIC_STACK_X: number = G.epic.stackX;     // math GUAR_MIN_VAL.hidden (math v2: x16; display reads the book value)
export const EPIC_GROW_STEP: number = G.epic.step;     // math GROW_STEP.hidden (math v2: +2 per step)
export const GROW_STEP: number = G.growStep.default;   // every other tier and base play (+1)
export const GUARANTEE: { triple_dare: number; hidden: number } = G.guarantee; // full-reel wilds guaranteed at bonus start
export const RETRIGGER = G.retrigger;                  // free-spin retrigger: 2 Ski Passes / 3 or more
export const EGW_STACK_X: number = G.egwStackX;        // EGW full-reel wild value
/** Math win_level edges (x bet): standard (setWin) and endFeature (freeSpinEnd); the big-win stages map onto these. */
export const WIN_LEVELS: { standard: number[]; endFeature: number[]; byMode?: Record<string, number[]> } = G.winLevels;
/** math WIN_LEVEL_EDGES_BY_MODE (James 2026-10-30 19:28 CDT): the bonus buys DD / TD / Mystery / EGW size every banner tier x10. */
/** 2026-11-05 (James: MEGA in Wild Winter Spins on the real Stake test): the RGS mode string normalised (case, spaces,
 *  UI names) so a bought round never falls back to the standard edges by a spelling. */
const MODE_ALIAS: Record<string, string> = { wild_winter: 'egw', wildwinter: 'egw', wild_winter_spins: 'egw', bunny_slope: 'dare', black_diamond: 'double_dare', double_black: 'triple_dare', secret_santa: 'mystery' };
export const normMode = (mode?: string) => { const m = String(mode ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_'); return MODE_ALIAS[m] || m; };
export const winEdgesFor = (mode?: string): number[] => { const m = normMode(mode); return (m && WIN_LEVELS.byMode?.[m]) || WIN_LEVELS.standard; };
export const MYSTERY_ODDS: { none: number; double_dare: number; triple_dare: number; hidden: number } = G.mysteryOdds;
export type Tier = 'dare' | 'double_dare' | 'triple_dare' | 'hidden';
export const TIER_LABEL: Record<Tier, string> = { dare: 'Bunny Slope', double_dare: 'Black Diamond', triple_dare: 'Double Black', hidden: 'Powder Day' }; // math tier ids unchanged; Winter Chalet UI names (math 'hidden' = Powder Day)

export type ModeKey = 'base' | 'ante' | 'dare' | 'double_dare' | 'triple_dare' | 'mystery' | 'egw';
export const BUY_MODES: ModeKey[] = ['dare', 'double_dare', 'triple_dare', 'mystery', 'egw'];
/** Winter Chalet: hand-lettered title art per bonus (ART['bonus_' + key]); math ids unchanged. */
export const TITLE_ART: Record<string, string> = { dare: 'bunny', double_dare: 'blackdiamond', triple_dare: 'doubleblack', hidden: 'powder', mystery: 'santa', egw: 'wildwinter' };
export const MODE_LABEL: Record<ModeKey, string> = {
	base: 'Spin', ante: 'Ante', dare: 'Bunny Slope', double_dare: 'Black Diamond', triple_dare: 'Double Black', mystery: 'Secret Santa', egw: 'Wild Winter Spins',
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

