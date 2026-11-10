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

// ---------- fix8: the free-spins bar ("<TIER>  FREE SPIN n / N") in the banners layer ----------
// The DOM #fsBar stays the state model (bookEventHandlerMap writes its text and toggles .hidden; mkboard places it on
// the sill); body.pixiBoard hides its paint and this pill is drawn at its box: cranberry fill, ink border + drop,
// gold tier, cream count (the chalet.css look).
const FS_CRAN = 0xa61c34, GOLD = 0xf5c542;
let fsRoot: Container | null = null, fsBg: Graphics, fsTier: Text, fsCnt: Text, fsOn = false;
function fsBuild() {
	fsRoot = new Container(); fsRoot.label = 'fsBar'; fsRoot.alpha = 0; fsRoot.visible = false;
	fsBg = new Graphics();
	fsTier = new Text({ text: '', style: { fontFamily: 'Lilita One', fill: GOLD, fontSize: 16, letterSpacing: 0.6, stroke: { color: INK, width: 3 } } });
	fsCnt = new Text({ text: '', style: { fontFamily: 'Lilita One', fill: CREAM, fontSize: 16, letterSpacing: 0.6, stroke: { color: INK, width: 3 } } });
	fsRoot.addChild(fsBg, fsTier, fsCnt); layer.banners.addChild(fsRoot);
}
function fsPaint() {
	const el = document.getElementById('fsBar'), fr = document.getElementById('frame');
	if (!fsRoot || !el || !fr) return;
	const fb = fr.getBoundingClientRect(), r = el.getBoundingClientRect(), k = fb.width / (fr.offsetWidth || 1) || 1;
	const tier = (document.getElementById('fsTier')?.textContent || '').trim(), cnt = (document.getElementById('fsCount')?.textContent || '').trim();
	const h = Math.max(22, r.height / k || 30), fs = h * 0.5, padX = h * 0.6, gap = h * 0.45, res = resolution();
	for (const t of [fsTier, fsCnt]) { t.resolution = res; t.style.fontSize = fs; t.style.stroke = { color: INK, width: Math.max(2, fs * 0.16) }; t.anchor.set(0, 0.5); }
	fsTier.text = tier; fsCnt.text = cnt;
	const w = padX * 2 + fsTier.width + (tier ? gap : 0) + fsCnt.width, bw = Math.max(2, h * 0.09);
	fsBg.clear().roundRect(-w / 2, -h / 2 + h * 0.08, w, h, h / 2).fill(INK)
		.roundRect(-w / 2, -h / 2, w, h, h / 2).fill(FS_CRAN).stroke({ width: bw, color: INK, alignment: 1 });
	fsTier.position.set(-w / 2 + padX, h * 0.02); fsCnt.position.set(-w / 2 + padX + fsTier.width + (tier ? gap : 0), h * 0.02);
	fsRoot.position.set(Math.round((r.left + r.width / 2 - fb.left) / k), Math.round((r.top + r.height / 2 - fb.top) / k));
	kick();
}
function fsSync() {
	if (document.body.classList.contains('pixiHud')) { if (fsRoot) fsRoot.visible = false; return; }
	const el = document.getElementById('fsBar'); if (!el) return;
	if (!fsRoot) fsBuild();
	const on = !el.classList.contains('hidden');
	fsPaint();
	if (on !== fsOn) {
		fsOn = on; const r = fsRoot!, a0 = r.alpha, to = on ? 1 : 0, t0 = performance.now(), D = rm() ? 150 : 220; r.visible = true;
		animate(() => { const u = Math.min(1, (performance.now() - t0) / D); r.alpha = a0 + (to - a0) * u; if (u >= 1 && !to) r.visible = false; return u < 1; });
	}
}
/** Start drawing the free-spins bar in the board stage (once). */
export async function startFsBanner() {
	if (document.body.classList.contains('pixiHud')) return;
	const el = document.getElementById('fsBar'); if (!el || !(await boardStage())) return;
	new MutationObserver(fsSync).observe(el, { attributes: true, attributeFilter: ['class', 'style'], childList: true, subtree: true, characterData: true });
	onLayout(fsSync); window.addEventListener('resize', () => requestAnimationFrame(fsSync));
	void document.fonts?.ready.then(fsSync);
	fsSync();
}
