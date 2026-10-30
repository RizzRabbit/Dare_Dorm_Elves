// Smooth amount count-ups (WIN field, big-win banner, total-win card). One rAF per element, time-based ease-out that
// slows into the target and always lands exactly on it. Only textContent changes (tabular digits + a min-width box
// in CSS, so nothing reflows around it). The places are fixed to the target's places for the whole count so the
// width never jitters. A skip eases onto the final value (SETTLE_MS). Turbo halves the time. v3.17: the whole part
// eases, the decimals churn fast until the landing (churnValue); the big-win banner is skipped one checkpoint at a
// time (countTiers().next(), winstage.ts).
import { moneyWin as money, moneyDigits } from './format'; // v3.16i: count-ups are wins only: exact amounts

type Run = { raf: number; to: number; done: () => void; settle: () => void };
const runs = new Map<HTMLElement, Run>();
const shown = new WeakMap<HTMLElement, number>();
const easeOut = (u: number) => 1 - Math.pow(1 - u, 3);
/** v3.17: a skip settles to the end value over this long (eased), never a hard snap. */
export const SETTLE_MS = 200;
/** v3.17 (James 2026-10-30): "a slow crawl for the 00.--, the --.00 / --.0000 move fast at the slow down still". The
 *  WHOLE part follows the eased curve (it crawls into a checkpoint); the decimals churn on their own fast clock
 *  (a full 0-99 cycle every ~115 ms, time-based so 60 / 120 / 144 Hz look the same) and only land on the true cents
 *  when the stage lands. `cap` = the stage's end value: the churn never shows more than it inside cap's whole unit. */
const CHURN = 1 / 115;
export function churnValue(v: number, d: number, now: number, cap = Infinity) {
	if (d <= 0) return Math.floor(v);
	const i = Math.floor(v), p = 10 ** d;
	let f = Math.floor(((now * CHURN) % 1) * p);
	if (i >= Math.floor(cap)) f = Math.floor(f * Math.max(0, cap - Math.floor(cap))); // in cap's last unit: stay under cap
	return i + Math.min(f, p - 1) / p;
}
/** Write text without replacing the text node (no node churn per frame). */
function put(el: HTMLElement, txt: string) {
	const n = el.firstChild;
	if (n && n.nodeType === 3 && !n.nextSibling) { if ((n as Text).data !== txt) (n as Text).data = txt; }
	else el.textContent = txt;
}

/** Duration for a win of `x` times the bet: ~0.4 s for small wins up to ~2.6 s for very big ones. */
export function countMs(x: number, turbo = false) {
	const ms = Math.min(2600, 400 + 700 * Math.log10(1 + Math.max(0, x)));
	return Math.round(turbo ? ms * 0.5 : ms);
}
/** Set without animation (and cancel a running count). */
export function setAmount(el: HTMLElement, v: number) {
	const r = runs.get(el); if (r) { cancelAnimationFrame(r.raf); runs.delete(el); r.done(); }
	shown.set(el, v); put(el, money(v));
}
export const shownAmount = (el: HTMLElement) => shown.get(el) ?? 0;
/** Count `el` from what it shows now (or `from`) to `to` over `ms`. Resolves when it lands (or after a skip's settle). */
export function countTo(el: HTMLElement, to: number, ms: number, from?: number) {
	const prev = runs.get(el); if (prev) { cancelAnimationFrame(prev.raf); runs.delete(el); prev.done(); }
	const a = from ?? shown.get(el) ?? 0;
	if (ms <= 0 || a === to) { setAmount(el, to); return Promise.resolve(); }
	const d = moneyDigits(to), churn = to - a >= 1 && d > 0;
	let t0 = performance.now(), from0 = a, dur = ms, ease = easeOut;
	return new Promise<void>((done) => {
		const run: Run = { raf: 0, to, done, settle: () => { const now = performance.now(); from0 = shown.get(el) ?? a; t0 = now; dur = Math.min(SETTLE_MS, Math.max(1, t0 + dur - now)); ease = easeOut; } };
		const step = (now: number) => {
			const u = Math.min(1, (now - t0) / dur);
			if (u >= 1) { runs.delete(el); shown.set(el, to); put(el, money(to, d)); done(); return; }
			const v = from0 + (to - from0) * ease(u); shown.set(el, v);
			put(el, money(churn ? churnValue(v, d, now, to) : v, d));
			run.raf = requestAnimationFrame(step);
		};
		runs.set(el, run); run.raf = requestAnimationFrame(step);
	});
}
/** Skip every running count: each eases onto its final value over SETTLE_MS (no hard snap) and then resolves. */
export function skipCounts() { runs.forEach((r) => r.settle()); }
/** Land every running count now (used when the screen is torn down). */
export function finishCounts() {
	runs.forEach((r, el) => { cancelAnimationFrame(r.raf); shown.set(el, r.to); put(el, money(r.to)); r.done(); });
	runs.clear();
}
export const counting = () => runs.size > 0;
export const isCounting = (el: HTMLElement) => runs.has(el);

// ---------- anticipatory big-win count (the banner amount) ----------
// paced2 (James 2026-10-29): our original count-up motion, tuned to an industry-standard pacing reference. Count in "x the bet" space through the tier thresholds
// below the win. Each tier: RACE (fast blur) up to ~1% under the threshold, CRAWL the last 1% for ~1 s (1.1-1.5 s
// for the higher tiers; the whole number barely moves while the cents tick, easing into exactly the threshold),
// HOLD the exact threshold ~0.25 s while onTier pops the new title, then JUMP well ahead (+30-60% of the threshold,
// capped below the next crawl zone and below the final amount) and race on. After the top tier for this win it races
// to the final amount, eases the last unit and stops. Closed-form on rAF time; tap skips to the end; turbo = 0.45x.
// v3.19 (James 2026-10-30 18:02 CDT): the stages come from the math's win levels (Stake Engine standard winLevel, carried
// by every setWin book event; the edges are synced from the math into modes.generated.json). The frontend only maps
// a level to an approved stage visual (presentation, no thresholds of its own):
//   levels 1-5 (< 15x)  a normal win (line presentation, no banner)
//   level 6 (15-30x) BIG WIN · 7 (30-50x) MEGA WIN · 8 (50-100x) SUPER WIN · 9 (100x up to the cap) EPIC WIN
//   level 10 (the cap) the MAX WIN screen (wincap event, maxwin.ts). LEGENDARY WIN has no math level and is not shown.
export const STAGE_OF_LEVEL: Record<number, string> = { 6: 'BIG WIN', 7: 'MEGA WIN', 8: 'SUPER WIN', 9: 'EPIC WIN' };
export type BigTier = { x: number; name: string; level: number };
/** Math win level of x (x bet) for a level-edge table: 1 + the index of the first edge above it (math win_level). */
export function levelOf(x: number, edges: readonly number[]) { for (let i = 0; i < edges.length; i++) if (x < edges[i]) return i + 1; return edges.length + 1; }
/** The banner stages from the math's edges: level L starts at edges[L - 2] (x bet). */
export function buildBigTiers(edges: readonly number[]): BigTier[] {
	return Object.entries(STAGE_OF_LEVEL).map(([l, name]) => ({ level: +l, name, x: edges[+l - 2] }))
		.filter((t) => Number.isFinite(t.x)).sort((a, b) => a.level - b.level);
}
/** Set from the synced math (ui.ts calls setWinLevels(MATH.winLevels.standard) at load). */
export let BIG_TIERS: BigTier[] = [];
export let WIN_EDGES: readonly number[] = [];
export function setWinLevels(edges: readonly number[]) { WIN_EDGES = edges; BIG_TIERS = buildBigTiers(edges); }
/** The max-win level (one past the last edge): the wincap screen, never the banner. */
export const maxLevel = () => WIN_EDGES.length + 1;
type Key = { t0: number; t1: number; v0: number; v1: number; ease: (u: number) => number; tier?: number; kind?: string };
const CRAWL_FRAC = 0.01;                                   // crawl zone = last 1% of each threshold
const CRAWL_MS = [1000, 1100, 1200, 1350, 1500];           // per stage (Big, Mega, Super, Epic; a 5th is spare)
const JUMP = [0.6, 0.5, 0.45, 0.5, 0.3];                   // jump after the pop, fraction of the threshold
// v3.17: the hold on the exact threshold is only as long as the title pop (no dead pause); the time it gave up goes to
// the race so a win still runs the same overall length.
const HOLD_MS = 120, RACE_MS = 600, RACE_PLUS = 130, LAST_MS = 420;
const race = (u: number) => 1 - Math.pow(1 - u, 1.6);     // fast, a light brake at the end (no stop)
const raceIn = (u: number) => u * (0.35 + 0.65 * u);       // first leg, from 0
const crawlOut = (u: number) => 1 - Math.pow(1 - u, 1.6); // eases into exactly the threshold
const settle = (u: number) => 1 - Math.pow(1 - u, 3);
/** Build the timeline (ms) for a win of X times the bet at math win level `level` (the book's winLevel; from the
 *  synced edges when absent). The stages shown are the ones at or below that level. */
export function tierPlan(X: number, turbo = false, level?: number) {
	const k = turbo ? 0.45 : 1, keys: Key[] = [];
	let t = 0, v = 0;
	const lvl = Number.isFinite(level) ? level! : levelOf(X, WIN_EDGES);
	const tiers = BIG_TIERS.map((b, i) => ({ ...b, i })).filter((b) => b.level <= lvl && b.x <= X);
	const push = (dur: number, v1: number, ease: (u: number) => number, kind: string, tier?: number) => {
		keys.push({ t0: t, t1: t + dur, v0: v, v1, ease, kind, tier }); t += dur; v = v1;
	};
	tiers.forEach((b, n) => {
		const cs = b.x * (1 - CRAWL_FRAC);
		if (v < cs) push((RACE_MS + RACE_PLUS) * k, cs, v === 0 ? raceIn : race, 'race');
		push(CRAWL_MS[b.i] * k, b.x, crawlOut, 'crawl', b.i);                // tier fires when the crawl lands
		push(HOLD_MS * k, b.x, () => 0, 'hold');
		const nx = tiers[n + 1], cap = nx ? b.x + (nx.x * (1 - CRAWL_FRAC) - b.x) * 0.75 : b.x + (X - b.x) * 0.55;
		const j = Math.min(b.x * (1 + JUMP[b.i]), cap);
		if (j > v) v = j;                                                     // the jump: next key starts here
	});
	if (X > v) {
		if (tiers.length === 0) { push(countMs(X) * k, X, settle, 'race'); return { keys, total: t, tiers }; }
		const last = Math.min(1, (X - v) * 0.15);                             // ease the last unit or so
		if (X - last > v + 0.5) push(RACE_MS * k, X - last, race, 'race'); // tiny remainder: settle only
		push(LAST_MS * k, X, settle, 'settle');
	}
	return { keys, total: t, tiers };
}
/** Value (x bet) at plan time t. */
function xAt(keys: Key[], X: number, t: number, unit: number) {
	for (const kk of keys) if (t < kk.t1) {
		let x = kk.v0 + (kk.v1 - kk.v0) * kk.ease((t - kk.t0) / (kk.t1 - kk.t0));
		if (kk.kind === 'crawl' && unit > 0) x = Math.min(x, kk.v1 - 0.01 / unit); // shows under the threshold until it lands, so the title pops on the landing frame
		return { x, k: kk };
	}
	return { x: X, k: null as Key | null };
}
export type TierCount = Promise<void> & {
	/** Staged skip: ease (SETTLE_MS) to the next checkpoint (the next tier's threshold, else the final amount). */
	next: () => void;
};
/** Run the tier count on `el`; values shown are x * unit (money). The whole part follows the curve; the decimals churn
 *  (churnValue) and land exactly on each threshold and on the final amount. */
export function countTiers(el: HTMLElement, X: number, unit: number, opts: { turbo?: boolean; level?: number; onTier?: (i: number) => void; onX?: (x: number) => void; onLand?: () => void } = {}): TierCount {
	const prev = runs.get(el); if (prev) { cancelAnimationFrame(prev.raf); runs.delete(el); prev.done(); }
	const { keys, total } = tierPlan(X, opts.turbo, opts.level), d = moneyDigits(X * unit);
	let t0 = performance.now(), fired = -1, lastX = 0;
	let warp: { w0: number; x0: number; tc: number; xc: number; dur: number } | null = null;
	const fire = (upto: number) => { for (const kk of keys) if (kk.tier !== undefined && kk.tier > fired && kk.t1 <= upto) { fired = kk.tier; opts.onTier?.(kk.tier); } };
	// the next checkpoint after plan time t: the end of the next tier's crawl, else the end
	const nextCp = (t: number) => { for (const kk of keys) if (kk.tier !== undefined && kk.tier > fired && kk.t1 > t) return kk.t1; return total; };
	const cpVal = (tc: number) => { if (tc >= total) return X; for (const kk of keys) if (kk.t1 === tc && kk.kind === 'crawl') return kk.v1; return xAt(keys, X, tc, unit).x; };
	let resolve!: () => void;
	const p = new Promise<void>((r) => (resolve = r)) as TierCount;
	const finish = () => { runs.delete(el); shown.set(el, X * unit); put(el, money(X * unit, d)); run.done(); };
	const run: Run = {
		raf: 0, to: X * unit, done: () => { fire(Infinity); opts.onX?.(X); opts.onLand?.(); resolve(); },
		settle: () => { const now = performance.now(); warp = { w0: now, x0: lastX, tc: total, xc: X, dur: (opts.turbo ? 0.6 : 1) * SETTLE_MS }; },
	};
	p.next = () => {
		if (!runs.has(el)) return;
		const now = performance.now();
		if (warp) { t0 = now - warp.tc; fire(warp.tc); lastX = warp.xc; warp = null; } // a skip during a settle: land that one first
		const tc = nextCp(now - t0);
		warp = { w0: now, x0: lastX, tc, xc: cpVal(tc), dur: (opts.turbo ? 0.6 : 1) * SETTLE_MS };
	};
	const step = (now: number) => {
		let x: number, exact = false, cap = X;
		if (warp) {
			const w = Math.min(1, (now - warp.w0) / warp.dur);
			if (w >= 1) { t0 = now - warp.tc; x = warp.xc; exact = true; const tc = warp.tc; warp = null; fire(tc); if (tc >= total) { lastX = X; finish(); return; } }
			else { x = warp.x0 + (warp.xc - warp.x0) * settle(w); cap = warp.xc; }
		} else {
			const t = now - t0;
			if (t >= total) { lastX = X; finish(); return; }
			const r = xAt(keys, X, t, unit); x = r.x;
			if (r.k) { cap = r.k.v1; exact = r.k.kind === 'hold'; }
			fire(t);
		}
		lastX = x; opts.onX?.(x);
		const v = x * unit; shown.set(el, v);
		put(el, money(exact ? v : churnValue(v, d, now, cap * unit), d));
		run.raf = requestAnimationFrame(step);
	};
	runs.set(el, run); run.raf = requestAnimationFrame(step);
	return p;
}
