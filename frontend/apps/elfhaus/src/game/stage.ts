// One shared scale for the whole game. Everything (background, Roxy, board, HUD, overlays, loader) lives in #root, a
// design stage laid out at fixed design pixels and fitted to the window with a single transform: scale(s).
// Landscape stage is 1080 design px tall, portrait stage 390 design px wide (the 1920x1080 / 390x844 references
// render 1:1); the other side follows the window's aspect within a range, so the stage fills the screen and only
// extreme aspects letterbox. Proportions between board, Roxy, background and UI are therefore identical at every
// window size. CSS uses var(--vw)/var(--vh) (1% of the stage) instead of vw/vh; JS converts screen rects with toStage().
export const ST = { w: 1920, h: 1080, s: 1, ox: 0, oy: 0, portrait: false };
const LAND_H = 1080, LAND_AR: [number, number] = [1.25, 2.4];   // stage width / height
const PORT_W = 390, PORT_AR: [number, number] = [1.5, 2.4];     // stage height / width
const clamp = (v: number, [a, b]: [number, number]) => Math.min(b, Math.max(a, v));

export function fitStage() {
	const vw = innerWidth, vh = innerHeight, portrait = vh > vw * 1.1;
	let w: number, h: number;
	if (portrait) { w = PORT_W; h = Math.round(PORT_W * clamp(vh / vw, PORT_AR)); }
	else { h = LAND_H; w = Math.round(LAND_H * clamp(vw / vh, LAND_AR)); }
	const s = Math.min(vw / w, vh / h), ox = (vw - w * s) / 2, oy = (vh - h * s) / 2;
	Object.assign(ST, { w, h, s, ox, oy, portrait });
	const r = document.documentElement.style;
	r.setProperty('--dw', w + 'px'); r.setProperty('--dh', h + 'px'); r.setProperty('--s', String(s));
	r.setProperty('--ox', ox + 'px'); r.setProperty('--oy', oy + 'px');
	r.setProperty('--vw', w / 100 + 'px'); r.setProperty('--vh', h / 100 + 'px'); r.setProperty('--vmin', Math.min(w, h) / 100 + 'px');
	return ST;
}
/** A screen-space DOMRect (getBoundingClientRect) in stage design px. */
export function toStage(r: DOMRect) {
	const x = (r.left - ST.ox) / ST.s, y = (r.top - ST.oy) / ST.s, w = r.width / ST.s, h = r.height / ST.s;
	return { left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, x, y } as DOMRect;
}
