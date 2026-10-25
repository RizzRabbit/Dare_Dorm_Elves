// One shared scale for the whole game. Everything (background, Roxy, board, HUD, overlays, loader) lives in #root, a
// design stage laid out at fixed design pixels and fitted to the window with a single transform: scale(s).
// Landscape stage is 1080 design px tall, portrait stage 390 design px wide (the 1920x1080 / 390x844 references
// render 1:1); the other side follows the window's aspect within a range, so the stage fills the screen and only
// extreme aspects letterbox. Proportions between board, Roxy, background and UI are therefore identical at every
// window size. CSS uses var(--vw)/var(--vh) (1% of the stage) instead of vw/vh; JS converts screen rects with toStage().
export const ST = { w: 1920, h: 1080, s: 1, ox: 0, oy: 0, portrait: false, tb: 1 };
// Legible-text floor: under one shared scale a phone in landscape renders the 1080-px-tall stage at s ~0.35, so
// 13 design-px labels land at ~4.7 screen px. --tb ("text boost") is the factor that brings UI / win text back to
// about the sizes portrait phones show (labels ~9-10 px, values ~13-15 px): tb = clamp(1, TB_MIN / s, TB_MAX).
// It is 1 whenever s >= TB_MIN (every desktop / laptop window and portrait), so those layouts are untouched;
// CSS only applies it under body.tb (elfhaus.css "legible text floor").
const TB_MIN = 0.66, TB_MAX = 2.2;
const LAND_H = 1080, LAND_AR: [number, number] = [1.25, 2.4];   // stage width / height
const PORT_W = 390, PORT_AR: [number, number] = [1.5, 2.4];     // stage height / width
const clamp = (v: number, [a, b]: [number, number]) => Math.min(b, Math.max(a, v));

export function fitStage() {
	// The visible box, not the layout viewport: in an iOS Safari / Stake iframe innerHeight can include area under the
	// browser bars, which pushed the top of the stage (logo, Roxy's head) off screen. Take the smallest non-zero size.
	const de = document.documentElement, vv = window.visualViewport;
	const pick = (...a: (number | null | undefined)[]) => Math.min(...a.filter((x): x is number => !!x && x > 0)) || 1;
	const vw = pick(innerWidth, de.clientWidth, vv && vv.width * vv.scale), vh = pick(innerHeight, de.clientHeight, vv && vv.height * vv.scale);
	const portrait = vh > vw * 1.1;
	let w: number, h: number;
	if (portrait) { w = PORT_W; h = Math.round(PORT_W * clamp(vh / vw, PORT_AR)); }
	else { h = LAND_H; w = Math.round(LAND_H * clamp(vw / vh, LAND_AR)); }
	const s = Math.min(vw / w, vh / h), ox = (vw - w * s) / 2, oy = (vh - h * s) / 2;
	const tb = portrait ? 1 : Math.min(TB_MAX, Math.max(1, TB_MIN / s));
	Object.assign(ST, { w, h, s, ox, oy, portrait, tb });
	document.body.classList.toggle('tb', tb > 1.001);
	document.body.classList.toggle('portrait', portrait); // same rule for the loader, the game and every CSS layer
	const r = document.documentElement.style;
	r.setProperty('--dw', w + 'px'); r.setProperty('--dh', h + 'px'); r.setProperty('--s', String(s));
	r.setProperty('--tb', tb.toFixed(3)); r.setProperty('--tbs', Math.min(tb, 1.5).toFixed(3)); r.setProperty('--tbm', Math.min(tb, 1.6).toFixed(3));
	r.setProperty('--ox', ox + 'px'); r.setProperty('--oy', oy + 'px');
	r.setProperty('--vw', w / 100 + 'px'); r.setProperty('--vh', h / 100 + 'px'); r.setProperty('--vmin', Math.min(w, h) / 100 + 'px');
	return ST;
}
/** A screen-space DOMRect (getBoundingClientRect) in stage design px. */
export function toStage(r: DOMRect) {
	const x = (r.left - ST.ox) / ST.s, y = (r.top - ST.oy) / ST.s, w = r.width / ST.s, h = r.height / ST.s;
	return { left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, x, y } as DOMRect;
}
