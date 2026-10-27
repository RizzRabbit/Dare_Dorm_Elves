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
// Count in "x the bet" space through the tier thresholds below the win: each leg accelerates out of the last tier,
// eases toward the next one, then crawls the last few percent (tension) before it crosses; crossing calls onTier
// (title swap + pop) and the next leg speeds off again. Past 1000x the remaining legs run much faster. The final
// leg eases out into the exact amount. Everything is closed-form on rAF time; tap skips to the end.
export const BIG_TIERS = [
	{ x: 10, name: 'BIG WIN' }, { x: 25, name: 'MEGA WIN' }, { x: 50, name: 'SUPER WIN' }, { x: 100, name: 'EPIC WIN' }, { x: 1000, name: 'LEGENDARY WIN' },
] as const;
type Key = { t0: number; t1: number; v0: number; v1: number; ease: (u: number) => number; tier?: number };
const easeInOut = (u: number) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
const easeIn = (u: number) => u * u * (0.4 + 0.6 * u);
const crawl = (u: number) => 0.5 - Math.cos(Math.PI * u) / 2;
const easeOutQuart = (u: number) => 1 - Math.pow(1 - u, 4);
/** Build the timeline (ms) for a win of X times the bet. */
export function tierPlan(X: number, turbo = false) {
	const k = turbo ? 0.45 : 1, keys: Key[] = [];
	let t = 0, v = 0;
	const tiers = BIG_TIERS.map((b, i) => ({ ...b, i })).filter((b) => b.x <= X);
	tiers.forEach((b) => {
		const fast = v >= 1000, leg = (fast ? 260 : b.x === 1000 ? 820 : b.x === 10 ? 420 : 460) * k;
		const near = b.x * (b.x === 10 ? 0.9 : 0.94), cr = (fast ? 0 : 260) * k;
		keys.push({ t0: t, t1: t + leg, v0: v, v1: near, ease: v === 0 ? easeIn : easeInOut }); t += leg;
		keys.push({ t0: t, t1: t + cr, v0: near, v1: b.x, ease: crawl, tier: b.i }); t += cr; v = b.x;
	});
	if (X > v) {
		const fast = v >= 1000, r = Math.log10(X / Math.max(1, v) + 1);
		const leg = (fast ? 380 + 260 * r : v === 0 ? countMs(X) : 320 + 420 * r) * k;
		keys.push({ t0: t, t1: t + leg, v0: v, v1: X, ease: fast ? easeOutQuart : easeOut }); t += leg;
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
			let x = X; for (const kk of keys) if (t < kk.t1) { x = kk.v0 + (kk.v1 - kk.v0) * kk.ease((t - kk.t0) / (kk.t1 - kk.t0)); break; }
			fire(t); opts.onX?.(x);
			shown.set(el, x * unit); const txt = money(x * unit, d); if (el.textContent !== txt) el.textContent = txt;
			run.raf = requestAnimationFrame(step);
		};
		runs.set(el, run); run.raf = requestAnimationFrame(step);
	});
}
