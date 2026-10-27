// v3.16f (#194): shrink-to-fit for the HUD readout values (BALANCE / BET-PLAY / WIN) on landscape phones (body.tb).
// The CSS size stays the default; only a value wider than its box gets a smaller inline font-size, set at once
// (no transition), down to FIT_FLOOR of the CSS size. Below the floor the CSS ellipsis is the last resort.
// Runs on every value change (MutationObserver: setStrip, count-ups), on resize / layout and once fonts are ready.
// Desktop and portrait (no body.tb, or body.portrait) never get an inline size, so they are unchanged.
// v3.16i: the text width is measured fractionally (a Range's getBoundingClientRect), not with whole-px scrollWidth,
// and the value must fit with 1 layout px to spare, so a sub-pixel overflow can no longer leave the CSS ellipsis drawn.
// Cost per value change: one measure (one forced layout) when the current size still fits snugly (count-up frames);
// otherwise one write computed from that measure (letter-spacing kept out of the scaling) plus one verify measure,
// with at most two shrink-only corrections; a grow that overshoots falls back to the size already seen to fit.
export const FIT_FLOOR = 0.6;
const IDS = ['#balance', '#bet', '#win'];
const SPARE = 1; // layout px kept free inside the box
const SNUG = 0.93; // a fitting value smaller than its CSS size is left alone while it fills >= 93% of the room
// (text width is not linear in font-size: glyph advances snap per size, measured up to ~5% off, so a tighter band oscillates)
const active = () => document.body.classList.contains('tb') && !document.body.classList.contains('portrait');
/** Counters (also on window.__elfhausFit for the measure scripts): value changes handled, measures (forced layouts), writes. */
export const fitStats = { changes: 0, measures: 0, writes: 0 };
(globalThis as any).__elfhausFit = fitStats;
const baseSize = new WeakMap<HTMLElement, number>();
// The value is a flex item that shrinks to its text, so its own box says nothing about the room left; the room is the
// .m readout's content box minus the label and the gap (row layout), or the whole content box (stacked, <=300px tall).
type Geo = { pad: number; gap: number; col: boolean };
const geo = new WeakMap<HTMLElement, Geo>();
function readGeo(el: HTMLElement) {
	const cs = getComputedStyle(el.parentElement!), n = (v: string) => parseFloat(v) || 0;
	const g = { pad: n(cs.paddingLeft) + n(cs.paddingRight) + n(cs.borderLeftWidth) + n(cs.borderRightWidth), gap: n(cs.columnGap), col: cs.flexDirection.startsWith('column') };
	geo.set(el, g); return g;
}
const range = typeof document !== 'undefined' ? document.createRange() : null;
/** Fractional text width and the room for it, both in screen px (the stage transform cancels out); k = screen px per
 *  layout px. All reads, no writes in between: one forced layout. */
function measure(el: HTMLElement) {
	fitStats.measures++;
	range!.selectNodeContents(el);
	const tw = range!.getBoundingClientRect().width, p = el.parentElement!, pr = p.getBoundingClientRect();
	const k = p.offsetWidth ? pr.width / p.offsetWidth : 1, g = geo.get(el) ?? readGeo(el);
	let room = pr.width - g.pad * k;
	if (!g.col) for (const c of Array.from(p.children)) if (c !== el) room -= c.getBoundingClientRect().width + g.gap * k;
	return { tw, limit: room - SPARE * k, k };
}
/** reset: drop the inline size first and re-read the CSS size (layout / resize / fonts); value changes reuse it. */
export function fitValue(el: HTMLElement, reset = true) {
	if (!active()) { if (el.style.fontSize) el.style.fontSize = ''; return; }
	fitStats.changes++;
	let base = baseSize.get(el);
	if (reset || base === undefined) { el.style.fontSize = ''; base = parseFloat(getComputedStyle(el).fontSize); baseSize.set(el, base); readGeo(el); }
	const floor = base * FIT_FLOOR;
	let size = el.style.fontSize ? parseFloat(el.style.fontSize) : base;
	let m = measure(el);
	if (!m.limit || m.limit <= 0) return;
	if (m.tw <= m.limit && (size >= base || m.tw >= m.limit * SNUG)) return; // fits (snugly, or at full size)
	const ls = (parseFloat(getComputedStyle(el).letterSpacing) || 0) * (el.textContent || '').length * m.k; // does not scale
	let fitSize = m.tw <= m.limit ? size : 0; // largest size seen to fit this text
	for (let i = 0; i < 3; i++) { // one computed step, then at most two shrink-only corrections
		let want = Math.floor(size * Math.max(0, m.limit - ls) / Math.max(1e-6, m.tw - ls) * 0.995 * 100) / 100;
		if (m.tw > m.limit) want = Math.min(want, Math.floor(size * 0.99 * 100) / 100); // over: always go down
		const next = Math.max(floor, Math.min(base, want));
		if (next === size) break;
		size = next; fitStats.writes++;
		el.style.fontSize = size >= base ? '' : size + 'px';
		m = measure(el);
		if (m.tw <= m.limit) { if (size > fitSize) fitSize = size; return; }
		if (size <= floor) return;
	}
	// still over after the bounded steps: fall back to the size already seen to fit (same text, so no re-measure)
	if (m.tw > m.limit && fitSize && fitSize < size) { fitStats.writes++; el.style.fontSize = fitSize >= base ? '' : fitSize + 'px'; }
}
export function fitStrip() { for (const q of IDS) { const el = document.querySelector<HTMLElement>(q); if (el) fitValue(el, true); } }
let fitting = false;
export function initStripFit() {
	const mo = new MutationObserver((recs) => {
		if (fitting) return; fitting = true;
		try { for (const el of new Set(recs.map((r) => (r.target.nodeType === 1 ? r.target : r.target.parentElement) as HTMLElement))) if (el) fitValue(el, false); }
		finally { mo.takeRecords(); fitting = false; }
	});
	for (const q of IDS) { const el = document.querySelector(q); if (el) mo.observe(el, { childList: true, characterData: true, subtree: true }); }
	document.fonts?.ready.then(fitStrip);
	fitStrip();
}
