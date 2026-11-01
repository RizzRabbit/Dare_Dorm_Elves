// Staged win presentation (James 2026-10-30): every section of a win is its own event that the player taps through.
//   a  = the initial win glow / line draw-on and hold        (winlines.ts)
//   b  = the lines counting one by one (more than one line)  (winlines.ts)
//   c  = the WIN meter count-up to the step total            (winlines.ts)
//   bw:<TIER> ... = each big-win tier checkpoint             (ui.ts bigWin, countup.ts countTiers next())
//   bw:final = the count from the top tier to the win amount, bw:landed = the landed banner (a skip closes it)
// A skip (one tap, or a double tap: taps within COALESCE_MS of an accepted skip count as one) ends exactly the
// current stage: it jumps to that stage's end state with a short eased settle, then the next stage starts normally.
// Taps that land between two stages of a presentation are consumed (they never skip ahead). Stages always end on
// their own (autoplay / turbo never wait on a tap).
export const COALESCE_MS = 350;
type Stage = { name: string; skip: () => void };
let cur: Stage | null = null, lastSkip = -1e9, depth = 0;
export type StageEv = [kind: 'start' | 'skip' | 'end', name: string, t: number];
const evs: StageEv[] = [];
const log = (k: StageEv[0], n: string) => { evs.push([k, n, Math.round(performance.now())]); if (evs.length > 400) evs.splice(0, 100); };
if (typeof window !== 'undefined' && (import.meta as any).env?.DEV) (window as any).__winStages = evs; // dev: the stage order for the e2e

/** A win presentation is running (playWins / bigWin); taps go to skipStage only. Nested calls are counted. */
export function presenting(on: boolean) { depth = Math.max(0, depth + (on ? 1 : -1)); if (!depth) cur = null; }
export const winPresenting = () => depth > 0 || cur !== null;
export function beginStage(name: string, skip: () => void) { cur = { name, skip }; log('start', name); }
export function endStage(name: string) { if (cur?.name === name) cur = null; log('end', name); }
/** A tap that was used for something else (a slam stop): its double-tap partner must not skip the first win stage. */
export function noteTap(now = performance.now()) { lastSkip = now; }
/** Skip the current stage. Returns true when the tap was taken by the win presentation (skipped or coalesced). */
export function skipStage(now = performance.now()) {
	if (!winPresenting()) return false;
	if (now - lastSkip < COALESCE_MS) return true;
	if (!cur) return true; // between stages: consumed
	lastSkip = now; const s = cur; cur = null; log('skip', s.name); s.skip(); return true;
}
/** Run `body` as stage `name`; `skip` makes it finish early (it must still resolve). */
export async function stage<T>(name: string, skip: () => void, body: () => Promise<T>): Promise<T> {
	beginStage(name, skip);
	try { return await body(); } finally { endStage(name); }
}
/** Test hook: reset the module state. */
export function _resetStages() { cur = null; lastSkip = -1e9; depth = 0; evs.length = 0; }
export const _stageLog = () => evs;
