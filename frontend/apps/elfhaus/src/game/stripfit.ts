// v3.16f (#194): shrink-to-fit for the HUD readout values (BALANCE / BET-PLAY / WIN) on landscape phones (body.tb).
// The CSS size stays the default; only a value wider than its box gets a smaller inline font-size, set at once
// (no transition), down to FIT_FLOOR of the CSS size. Below the floor the CSS ellipsis is the last resort.
// Runs on every value change (MutationObserver: setStrip, count-ups), on resize / layout and once fonts are ready.
// Desktop and portrait (no body.tb, or body.portrait) never get an inline size, so they are unchanged.
export const FIT_FLOOR = 0.6;
const IDS = ['#balance', '#bet', '#win'];
const active = () => document.body.classList.contains('tb') && !document.body.classList.contains('portrait');
export function fitValue(el: HTMLElement) {
	el.style.fontSize = '';
	if (!active()) return;
	const cw = el.clientWidth, sw = el.scrollWidth;
	if (!cw || sw <= cw + 0.5) return;
	const base = parseFloat(getComputedStyle(el).fontSize);
	el.style.fontSize = Math.max(base * FIT_FLOOR, Math.floor(base * (cw / sw) * 0.98 * 100) / 100) + 'px';
}
export function fitStrip() { for (const q of IDS) { const el = document.querySelector<HTMLElement>(q); if (el) fitValue(el); } }
let fitting = false;
export function initStripFit() {
	const mo = new MutationObserver((recs) => {
		if (fitting) return; fitting = true;
		try { for (const el of new Set(recs.map((r) => (r.target.nodeType === 1 ? r.target : r.target.parentElement) as HTMLElement))) if (el) fitValue(el); }
		finally { mo.takeRecords(); fitting = false; }
	});
	for (const q of IDS) { const el = document.querySelector(q); if (el) mo.observe(el, { childList: true, characterData: true, subtree: true }); }
	document.fonts?.ready.then(fitStrip);
	fitStrip();
}
