// design/EVENTS.md, one type per event. Coordinates: reveal.board is padded [reel][6 rows] (visible 1–4);
// every other event uses visible {reel 0-4, row 0-3}. Amounts = x play × 100.
import type { Tier } from './config';
export type Pos = { reel: number; row: number };
export type Sym = { name: string; wild?: boolean; multiplier?: number };
export type Locked = { fullReels: { reel: number; value: number }[]; singles: { reel: number; row: number; value: number }[] };
export type Group = { reels: number[]; values: number[]; product: number };
export type LineWin = { lineIndex: number; symbol: string; count: number; win: number; positions: Pos[];
	meta: { basePay: number; lineMult: number; connected: boolean; groups: any[] } };
type B<T extends string, P> = { index: number; type: T } & P;
export type BookEvent =
	| B<'reveal', { board: Sym[][]; paddingPositions: number[]; gameType: 'basegame' | 'freegame'; anticipation: number[]; locked: Locked }>
	| B<'stackComplete', { step: number; reel: number; parts: number[]; value: number; instant: boolean }>
	| B<'mergeGroups', { step: number; groups: Group[] }>
	| B<'winInfo', { step: number; totalWin: number; wins: LineWin[] }>
	| B<'updateStepWin', { amount: number }>
	| B<'wildGrow', { step: number; changes: ({ kind: 'single'; reel: number; row: number; from: number; to: number } | { kind: 'full'; reel: number; from: number; to: number })[] }>
	| B<'respinStart', { step: number; replace: Pos[]; locked: Locked; remaining: number }>
	| B<'respinReveal', { step: number; newSymbols: (Pos & Sym)[] }>
	| B<'respinEnd', { step: number; reason: 'noConnection' | 'maxRespins' | 'wincap' }>
	| B<'setWin', { amount: number; winLevel: number }>
	| B<'setTotalWin', { amount: number }>
	| B<'cardFlip', { odds: Record<string, number>; result: 'triple_dare' | 'hidden' }>
	| B<'freeSpinTrigger', { tier: Tier; totalFs: number; cap: number; carried: Locked; scatters: Pos[]; source: 'natural' | 'buy' | 'mystery' }>
	| B<'guaranteedStacks', { tier: Tier; stacks: { reel: number; value: number; absorbed: { row: number; value: number }[] }[]; locked: Locked }>
	| B<'updateFreeSpin', { amount: number; total: number; cap: number; tier?: Tier }>
	| B<'freeSpinRetrigger', { scatters: Pos[]; count: number; addedFs: number; totalFs: number; capped: boolean }>
	| B<'freeSpinEnd', { amount: number; winLevel: number }>
	| B<'mysteryStart', { odds: Record<string, number> }>
	| B<'mysteryResult', { outcome: 'none' | Tier }>
	| B<'egwStart', { reels: number[]; value: number }>
	| B<'buyTriggerStart', { tier: Tier }>
	| B<'wincap', { amount: number }>
	| B<'finalWin', { amount: number }>;
export type BookEventType = BookEvent['type'];
export type BookEventOf<T extends BookEventType> = Extract<BookEvent, { type: T }>;
