// fix7 banners layer (stage.ts BL.banners): the RESPINS counter drawn in the board stage, not DOM. One cream pill with
// the 3 respin dots, centred on the frame's bottom rail and kept INSIDE the frame (the DOM #rsCtr straddled the frame's
// bottom edge and its lower half / dots went under the HUD rail at 390x844). Look kept from the approved pill: cream
// fill, ink border + drop, Lilita One ink label, cranberry lit dots, sand dim dots.
import { Container, Graphics, Text } from 'pixi.js';
import { boardStage, layer, animate, kick, resolution, onLayout } from './stage';

const INK = 0x26140f, CREAM = 0xfbf3e4, CRAN = 0xa61c34, DIM = 0xcdbba0, MAX = 3;
let root: Container | null = null, bg: Graphics, label: Text, dots: Graphics[] = [];
let shown = false, litN = MAX, h = 30, a0 = 0, aT = 0, t0 = 0;
const rm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function build() {
	root = new Container(); root.label = 'rsCtr'; root.alpha = 0; root.visible = false;
	bg = new Graphics(); label = new Text({ text: 'RESPINS', style: { fontFamily: 'Lilita One', fill: INK, fontSize: 16, letterSpacing: 0.6 } });
	root.addChild(bg, label);
	for (let i = 0; i < MAX; i++) { const d = new Graphics(); dots.push(d); root.addChild(d); }
	layer.banners.addChild(root);
	onLayout(place);
}
function paint() {
	if (!root) return;
	const fs = h * 0.5, dr = h * 0.17, gap = h * 0.16, padX = h * 0.45, bw = Math.max(1.5, h * 0.08);
	label.resolution = resolution(); label.style.fontSize = fs;
	const tw = label.width, w = padX * 2 + tw + h * 0.22 + MAX * dr * 2 + (MAX - 1) * gap;
	bg.clear().roundRect(-w / 2, -h / 2 + h * 0.08, w, h, h / 2).fill(INK)
		.roundRect(-w / 2, -h / 2, w, h, h / 2).fill(CREAM).stroke({ width: bw, color: INK, alignment: 1 });
	label.anchor.set(0, 0.5); label.position.set(-w / 2 + padX, h * 0.03);
	let x = -w / 2 + padX + tw + h * 0.22 + dr;
	dots.forEach((d, i) => { d.clear().circle(0, 0, dr).fill(i < litN ? CRAN : DIM).stroke({ width: 1.5, color: INK, alpha: i < litN ? 1 : 0.5 }); d.position.set(x, 0); x += dr * 2 + gap; });
}
/** Re-fit to the frame: centred on the bottom rail, the whole pill inside the frame. */
export function place() {
	const fr = document.getElementById('frame'), bd = document.getElementById('board');
	if (!root || !fr || !bd) return;
	const rail = Math.max(8, fr.clientHeight - (bd.offsetTop + bd.offsetHeight));
	h = Math.round(Math.min(40, Math.max(24, rail * 1.1)));
	root.position.set(Math.round(fr.clientWidth / 2), Math.round(Math.min(fr.clientHeight - h / 2 - 3, bd.offsetTop + bd.offsetHeight + rail / 2)));
	paint(); kick();
}
function fade(to: number) {
	if (!root) return;
	a0 = root.alpha; aT = to; t0 = performance.now(); root.visible = true;
	const D = rm() ? 150 : 220;
	animate(() => {
		if (!root) return false;
		const u = Math.min(1, (performance.now() - t0) / D);
		root.alpha = a0 + (aT - a0) * u;
		// the approved pop-in: scale .6 -> 1 with a small overshoot (reduced motion: fade only)
		const s = aT > a0 && !rm() ? 0.6 + 0.4 * (1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2)) : 1;
		root.scale.set(s);
		if (u >= 1 && aT === 0) root.visible = false;
		return u < 1;
	});
}
export async function respinBanner(on: boolean, n = litN) {
	if (!(await boardStage())) return;
	if (!root) { build(); place(); }
	if (n !== litN) { litN = n; paint(); kick(); }
	if (on !== shown) { shown = on; fade(on ? 1 : 0); }
}
/** One dot changes (dim or relight): a short pulse on it. */
export function pulseDot(i: number) {
	const d = dots[i]; if (!d) return; const t = performance.now();
	animate(() => { const u = Math.min(1, (performance.now() - t) / 260); d.scale.set(1 + 0.35 * Math.sin(Math.PI * u)); return u < 1; });
}
