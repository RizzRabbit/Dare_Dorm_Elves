// Smooth amount count-ups (WIN field, big-win banner, total-win card). One rAF per element, time-based ease-out that
// slows into the target and always lands exactly on it. Only textContent changes (tabular digits + a min-width box
// in CSS, so nothing reflows around it). The places are fixed to the target's places for the whole count so the
// width never jitters. Tap anywhere skips to the final value. Turbo halves the time.
import { moneyWin as money, moneyDigits } from './format'; // v3.16i: count-ups are wins only: exact amounts

type Run = { raf: number; to: number; done: () => void };
const runs = new Map<HTMLElement, Run>();
const shown = new WeakMap<HTMLElement, number>();
const easeOut = (u: number) => 1 - Math.pow(1 - u, 3);

/** Duration for a win of `x` times the bet: ~0.4 s for small wins up to ~2.6 s for very big ones. */
export function countMs(x: number, turbo = false) {
	const ms = Math.min(2600, 400 + 700 * Math.log10(1 + Math.max(0, x)));
	return Math.round(turbo ? ms * 0.5 : ms);
}
/** Set without animation (and cancel a running count). */
export function setAmount(el: HTMLElement, v: number) {
	const r = runs.get(el); if (r) { cancelAnimationFrame(r.raf); runs.delete(el); r.done(); }
	shown.set(el, v); el.textContent = money(v);
}
export const shownAmount = (el: HTMLElement) => shown.get(el) ?? 0;
/** Count `el` from what it shows now (or `from`) to `to` over `ms`. Resolves when it lands (or is skipped). */
export function countTo(el: HTMLElement, to: number, ms: number, from?: number) {
	const prev = runs.get(el); if (prev) { cancelAnimationFrame(prev.raf); runs.delete(el); prev.done(); }
	const a = from ?? shown.get(el) ?? 0;
	if (ms <= 0 || a === to) { setAmount(el, to); return Promise.resolve(); }
	const d = moneyDigits(to), t0 = performance.now();
	return new Promise<void>((done) => {
		const run: Run = { raf: 0, to, done };
		const step = (now: number) => {
			const u = Math.min(1, (now - t0) / ms);
			if (u >= 1) { runs.delete(el); shown.set(el, to); el.textContent = money(to); done(); return; }
			const v = a + (to - a) * easeOut(u); shown.set(el, v);
			const txt = money(v, d); if (el.textContent !== txt) el.textContent = txt;
			run.raf = requestAnimationFrame(step);
		};
		runs.set(el, run); run.raf = requestAnimationFrame(step);
	});
}
/** Finish every running count now (tap to skip). */
export function skipCounts() {
	runs.forEach((r, el) => { cancelAnimationFrame(r.raf); shown.set(el, r.to); el.textContent = money(r.to); r.done(); });
	runs.clear();
}
export const counting = () => runs.size > 0;
// v3.15d: "zip" = the player tapped twice during this win presentation (winlines.ts). The big-win banner that follows
// lands on its final tier and amount at once instead of counting through the tiers. Cleared once used / per round.
let zip = false;
export const setZip = (v: boolean) => { zip = v; };
export const zipped = () => zip;

// ---------- anticipatory big-win count (the banner amount) ----------
// paced2 (James 2026-10-29, ref: Waylanders Forge on Stake). Count in "x the bet" space through the tier thresholds
// below the win. Each tier: RACE (fast blur) up to ~1% under the threshold, CRAWL the last 1% for ~1 s (1.1-1.5 s
// for the higher tiers; the whole number barely moves while the cents tick, easing into exactly the threshold),
// HOLD the exact threshold ~0.25 s while onTier pops the new title, then JUMP well ahead (+30-60% of the threshold,
// capped below the next crawl zone and below the final amount) and race on. After the top tier for this win it races
// to the final amount, eases the last unit and stops. Closed-form on rAF time; tap skips to the end; turbo = 0.45x.
export const BIG_TIERS = [
	{ x: 10, name: 'BIG WIN' }, { x: 25, name: 'MEGA WIN' }, { x: 50, name: 'SUPER WIN' }, { x: 100, name: 'EPIC WIN' }, { x: 1000, name: 'LEGENDARY WIN' },
] as const;
type Key = { t0: number; t1: number; v0: number; v1: number; ease: (u: number) => number; tier?: number; kind?: string };
const CRAWL_FRAC = 0.01;                                   // crawl zone = last 1% of each threshold
const CRAWL_MS = [1000, 1100, 1200, 1350, 1500];           // per tier (Big .. Legendary)
const JUMP = [0.6, 0.5, 0.45, 0.5, 0.3];                   // jump after the pop, fraction of the threshold
const HOLD_MS = 250, RACE_MS = 600, LAST_MS = 420;
const race = (u: number) => 1 - Math.pow(1 - u, 1.6);     // fast, a light brake at the end (no stop)
const raceIn = (u: number) => u * (0.35 + 0.65 * u);       // first leg, from 0
const crawlOut = (u: number) => 1 - Math.pow(1 - u, 1.6); // eases into exactly the threshold
const settle = (u: number) => 1 - Math.pow(1 - u, 3);
/** Build the timeline (ms) for a win of X times the bet. */
export function tierPlan(X: number, turbo = false) {
	const k = turbo ? 0.45 : 1, keys: Key[] = [];
	let t = 0, v = 0;
	const tiers = BIG_TIERS.map((b, i) => ({ ...b, i })).filter((b) => b.x <= X);
	const push = (dur: number, v1: number, ease: (u: number) => number, kind: string, tier?: number) => {
		keys.push({ t0: t, t1: t + dur, v0: v, v1, ease, kind, tier }); t += dur; v = v1;
	};
	tiers.forEach((b, n) => {
		const cs = b.x * (1 - CRAWL_FRAC);
		if (v < cs) push(RACE_MS * k, cs, v === 0 ? raceIn : race, 'race');
		push(CRAWL_MS[b.i] * k, b.x, crawlOut, 'crawl', b.i);                // tier fires when the crawl lands
		push(HOLD_MS * k, b.x, () => 0, 'hold');
		const nx = tiers[n + 1], cap = nx ? b.x + (nx.x * (1 - CRAWL_FRAC) - b.x) * 0.75 : b.x + (X - b.x) * 0.55;
		const j = Math.min(b.x * (1 + JUMP[b.i]), cap);
		if (j > v) v = j;                                                     // the jump: next key starts here
	});
	if (X > v) {
		if (tiers.length === 0) { push(countMs(X) * k, X, settle, 'race'); return { keys, total: t }; }
		const last = Math.min(1, (X - v) * 0.15);                             // ease the last unit or so
		if (X - last > v + 0.5) push(RACE_MS * k, X - last, race, 'race'); // tiny remainder: settle only
		push(LAST_MS * k, X, settle, 'settle');
	}
	return { keys, total: t };
}
/** Run the tier count on `el`; values shown are x * unit (money). */
export function countTiers(el: HTMLElement, X: number, unit: number, opts: { turbo?: boolean; onTier?: (i: number) => void; onX?: (x: number) => void } = {}) {
	const prev = runs.get(el); if (prev) { cancelAnimationFrame(prev.raf); runs.delete(el); prev.done(); }
	const { keys, total } = tierPlan(X, opts.turbo), d = moneyDigits(X * unit), t0 = performance.now();
	let fired = -1;
	const fire = (upto: number) => { for (const kk of keys) if (kk.tier !== undefined && kk.tier > fired && kk.t1 <= upto) { fired = kk.tier; opts.onTier?.(kk.tier); } };
	return new Promise<void>((resolve) => {
		const run: Run = { raf: 0, to: X * unit, done: () => { fire(Infinity); opts.onX?.(X); resolve(); } };
		const step = (now: number) => {
			const t = now - t0;
			if (t >= total) { runs.delete(el); shown.set(el, X * unit); el.textContent = money(X * unit); run.done(); return; }
			let x = X; for (const kk of keys) if (t < kk.t1) {
				x = kk.v0 + (kk.v1 - kk.v0) * kk.ease((t - kk.t0) / (kk.t1 - kk.t0));
				if (kk.kind === 'crawl' && unit > 0) x = Math.min(x, kk.v1 - 0.01 / unit); // shows .99 until it lands, so the title pops on the landing frame
				break;
			}
			fire(t); opts.onX?.(x);
			shown.set(el, x * unit); const txt = money(x * unit, d); if (el.textContent !== txt) el.textContent = txt;
			run.raf = requestAnimationFrame(step);
		};
		runs.set(el, run); run.raf = requestAnimationFrame(step);
	});
}
