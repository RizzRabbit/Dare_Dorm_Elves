// Board frame B2 "Lounge Alcove" (art: /workspace/elfhaus-bg/board_frame/r2, README.md + frames.json).
// Layers in #app, back to front: #alcoveAmbient (CSS light spill + contact shadow) < #alcoveRecess (plum back wall) <
// #alcoveLedge (9-slice mantel under the HUD) < #board (transparent) < #alcoveCrown (crown + pilasters + drapes, with the
// three .tw twinkle layers in the same box) < #fsBar / #top logo. Portrait: #alcoveRail (v3.7, a crop of the crown's beam
// moulding) closes the frame under the board, behind the pilaster bases. Every rect is derived from #board, #hud and --cell in
// stage px, so nothing is a fixed-size image. Free spins: setAlcoveFs() fades the _fs crown / recess in on opacity
// (called from bg.ts setBg, the same path that swaps the room plate).
import { ART } from './ui';
import { ST, toStage } from './stage';

// frames.json: crown_png.size, crown_png.board_in_png [x, y, w, h] (exported PNG px)
const F = {
	landscape: { size: [1474, 1177], board: [147, 222, 1180, 944] },
	portrait: { size: [1603, 1351], board: [160, 313, 1283, 1026] },
} as const;
const PAD = 0.045, BLEED = 0.12;                   // opening padding and back-wall bleed under the lips, x cell
const LEDGE = { top: 0.31, side: 0.40, bottom: 0.21 }; // border-image widths x cell (slices 100/130/69/130 of 2044x245)
const ids = ['alcoveAmbient', 'alcoveRecess', 'alcoveLedge', 'alcoveCrown', 'alcoveRail', 'alcoveGlow'] as const;
// v3.12 frame neon halo (scripts/gen-frame-glow.py): the crown png + PAD px on every side, so it's placed as the crown box grown by PAD x u
const GLOW_PAD = 160;
const RAIL = { x0: 100, x1: 1503, h: 48 }; // portrait rail: pilaster centre to centre and its height, in crown png px
let built = false, orient = '';

function build() {
	const app = document.getElementById('app'), top = document.getElementById('top'); if (!app) return false;
	const html = `<div id="alcoveAmbient"></div>`
		+ `<div id="alcoveGlow"></div>`
		+ `<div id="alcoveRecess"><i class="avBase"></i><i class="avFs"></i></div>`
		+ `<div id="alcoveLedge"></div>`
		+ `<div id="alcoveRail"></div>`
		+ `<div id="alcoveCrown"><i class="avBase"></i><i class="avFs"></i><i class="tw tw0"></i><i class="tw tw1"></i><i class="tw tw2"></i></div>`;
	const wrap = document.createElement('div'); wrap.id = 'alcove'; wrap.setAttribute('aria-hidden', 'true'); wrap.innerHTML = html;
	app.insertBefore(wrap, top || app.firstChild);
	// re-place when anything in the column changes size without a window resize (fonts, HUD text, the fsBar appearing)
	let q = 0; const ro = new ResizeObserver(() => { cancelAnimationFrame(q); q = requestAnimationFrame(placeAlcove); });
	for (const id of ['top', 'stage', 'board', 'hud', 'fsBar']) { const el = document.getElementById(id); if (el) ro.observe(el); }
	return (built = true);
}
const url = (k: string) => (ART[k] ? `url(${ART[k]})` : 'none');
const box = (el: HTMLElement, x: number, y: number, w: number, h: number) => {
	el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = w + 'px'; el.style.height = h + 'px';
};
/** Art present? (the frame falls back to the plain board when the alcove art is missing) */
export const hasAlcove = () => !!(ART.alcove_crown_landscape && ART.alcove_crown_portrait);

/** Place every alcove layer from the current #board / #hud rects. Call at the end of layout(). */
export function placeAlcove() {
	if (!hasAlcove()) return;
	if (!built && !build()) return;
	document.body.classList.add('alcove');
	const o = ST.portrait ? 'portrait' : 'landscape', f = F[o], cell = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cell')) || 100;
	const $ = (id: string) => document.getElementById(id) as HTMLElement;
	const [amb, rec, led, cr, rail, glow] = ids.map($);
	if (o !== orient) {
		orient = o;
		const set = (el: HTMLElement, sel: string, k: string) => { (el.querySelector(sel) as HTMLElement).style.backgroundImage = url(k); };
		set(rec, '.avBase', `alcove_recess_${o}`); set(rec, '.avFs', `alcove_recess_fs_${o}`);
		set(cr, '.avBase', `alcove_crown_${o}`); set(cr, '.avFs', `alcove_crown_fs_${o}`);
		[0, 1, 2].forEach((i) => set(cr, `.tw${i}`, `alcove_twinkle${i}_${o}`));
		led.style.borderImageSource = url('alcove_ledge');
		glow.style.backgroundImage = url(`alcove_glow_${o}`);
		rail.style.backgroundImage = o === 'portrait' ? url('alcove_rail_portrait') : 'none';
	}
	const b = toStage($('board').getBoundingClientRect()), h = toStage($('hud').getBoundingClientRect());
	// crown (+ twinkles): uniform scale u, board_in_png aligned on #board
	const u = b.width / f.board[2], cx = b.left - f.board[0] * u, cy = b.top - f.board[1] * u, cw = f.size[0] * u, ch = f.size[1] * u;
	box(cr, cx, cy, cw, ch);
	const gp = GLOW_PAD * u; box(glow, cx - gp, cy - gp, cw + 2 * gp, ch + 2 * gp);
	// portrait bottom rail: right under the board (2 px onto its transparent 6 px border, the cells stay >= 4 px clear)
	if (o === 'portrait') box(rail, cx + RAIL.x0 * u, b.bottom - 2, (RAIL.x1 - RAIL.x0) * u, RAIL.h * u);
	// recess: board + pad + bleed on every side
	const e = (PAD + BLEED) * cell;
	box(rec, b.left - e, b.top - e, b.width + 2 * e, b.height + 2 * e);
	// ledge: just under the opening, through the HUD to the stage bottom; as wide as the HUD or the crown base, whichever is wider
	const ledgeTop = b.bottom + PAD * cell - 2, ledgeBot = Math.max(h.bottom + 0.2 * cell, ST.h + 2);
	const lx = Math.min(h.left - 0.08 * cell, cx + 0.15 * cell), rx = Math.max(h.right + 0.08 * cell, cx + cw - 0.15 * cell);
	box(led, lx, ledgeTop, rx - lx, ledgeBot - ledgeTop);
	led.style.borderWidth = `${LEDGE.top * cell}px ${LEDGE.side * cell}px ${LEDGE.bottom * cell}px`;
	// ambience: pink spill (radius 1.6 x board width) + contact shadow, centred on the board
	const r = 1.6 * b.width;
	box(amb, b.left + b.width / 2 - r, b.top + b.height / 2 - r, 2 * r, 2 * r);
	nudgeFsBar();
}
/** Landscape: the free-spins bar hangs on the crown beam right under the logo. Where the text boost (phone landscape)
 *  makes it taller than its lane it would cover the logo's foot, so push it down by the overlap (static transform). */
function nudgeFsBar() {
	const bar = document.getElementById('fsBar'), logo = document.querySelector('#logo img, #logo') as HTMLElement | null;
	if (!bar) return;
	bar.style.translate = '';
	if (ST.portrait || bar.classList.contains('hidden') || !logo) return;
	const l = toStage(logo.getBoundingClientRect()), f = toStage(bar.getBoundingClientRect());
	const over = l.bottom + 2 - f.top;
	if (over > 0) bar.style.translate = `0 ${Math.ceil(over)}px`;
}
/** Base <-> free-spins crown / recess (opacity crossfade, the base layer stays underneath so nothing flashes). */
export function setAlcoveFs(on: boolean) {
	document.getElementById('alcoveCrown')?.classList.toggle('fs', on);
	document.getElementById('alcoveRecess')?.classList.toggle('fs', on);
}
/** Preload the current orientation's _fs crown / recess so the first free-spins swap has them decoded. */
export function warmAlcove(preload: (u: string) => unknown) {
	const o = ST.portrait ? 'portrait' : 'landscape';
	for (const k of [`alcove_crown_fs_${o}`, `alcove_recess_fs_${o}`]) if (ART[k]) preload(ART[k] as string);
}
