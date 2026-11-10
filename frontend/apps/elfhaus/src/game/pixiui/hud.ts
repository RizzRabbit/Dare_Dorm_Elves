// Pixi HUD / bet bar: a 1:1 port of the approved DOM layout (painted hud_bar, gold +/- and spin).
// Positions are taken from the live mkPlace() boxes (viewport CSS px) so each layout stays pixel-true.
// The DOM nodes stay as the state model (game.ts writes text / disabled / classes); their paint is hidden.
import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { atlasTex, nine, spr } from '../scene/atlas';
import { ST } from '../stage';
import { kickUi, onUiLayout, uiApp, uiScreen } from './stage';
import { bmFit, fitSpr, wordSpr } from './text';
import { hit, nineUi } from './widgets';
import { syncHostLayout, uiHostTree } from '../uihosts';

export const hudLayer = new Container();
hudLayer.label = 'uiHud';
hudLayer.eventMode = 'passive';
hudLayer.sortableChildren = true;

let built = false, buyIconTex: Texture | null = null;
let bar: Container, barBg: Container;
const btns: Record<string, HudBtn> = {};
let buy: Container, buyBg: Container, buyDisc: Sprite | null = null, buyLab: Container | null = null;
let spin: Container, spinPlate: Sprite, spinIco: Sprite, autoNSpr: Sprite | null = null;
let arm: Container, armBg: Container, armTxt: Sprite | null = null, armX: Sprite | null = null;
type Field = { root: Container; lab: Container | null; val: Sprite | null };
const fields: Record<string, Field> = {};
let fsRoot: Container, fsBg: Container, fsTierSpr: Sprite | null = null, fsCntSpr: Sprite | null = null;
let logoSpr: Sprite | null = null, logoTex: Texture | null = null;

type HudBtn = Container & { plate: Container; ico: Sprite; base: 'btn_pine' | 'btn_gold'; icoOn: string; icoOff?: string; icoSize: number };

const $ = (id: string) => document.getElementById(id);

function rect(el: Element | null) {
	if (!el) return null;
	const r = el.getBoundingClientRect();
	if (!r.width && !r.height) return null;
	return { x: r.x, y: r.y, w: r.width, h: r.height };
}

function clearKids(c: Container) {
	const ch = c.removeChildren();
	for (const n of ch) {
		if (n instanceof Sprite && n.texture && n.texture !== Texture.EMPTY && n.texture.source?.label?.includes?.('paint')) {
			try { n.texture.destroy(true); } catch { /* */ }
		}
	}
}

function nineAt(name: string, w: number, h: number, k: number) {
	const s = nine('ui', name, w, h, k);
	s.eventMode = 'none';
	return s;
}

function iconIn(parent: Container, frame: string, box: number, frac: number) {
	const i = spr('ui', frame);
	i.anchor.set(0.5);
	i.eventMode = 'none';
	const k = (box * frac) / Math.max(1, Math.max(i.texture.width, i.texture.height));
	i.scale.set(k);
	i.position.set(box / 2, box / 2);
	parent.addChild(i);
	return i;
}

function setPlate(c: Container, name: string, w: number, h: number, k: number) {
	clearKids(c);
	c.addChild(nineAt(name, w, h, k));
}

function clickDom(id: string) {
	const el = $(id) as HTMLButtonElement | null;
	el?.click();
}

function makeBtn(id: string, base: HudBtn['base'], icoSize: number, icoOn: string, icoOff?: string): HudBtn {
	const c = new Container() as HudBtn;
	c.label = 'uiHudBtn';
	c.eventMode = 'static';
	c.cursor = 'pointer';
	const plate = new Container();
	plate.eventMode = 'none';
	c.addChild(plate);
	c.plate = plate;
	c.base = base;
	c.icoOn = icoOn;
	c.icoOff = icoOff;
	c.icoSize = icoSize;
	c.ico = new Sprite(Texture.EMPTY);
	c.on('pointertap', (e) => { e.stopPropagation(); clickDom(id); });
	c.on('pointerdown', () => { c.alpha = 0.92; kickUi(); });
	c.on('pointerup', () => { c.alpha = 1; kickUi(); });
	c.on('pointerupoutside', () => { c.alpha = 1; kickUi(); });
	hudLayer.addChild(c);
	btns[id] = c;
	return c;
}

function paintBtn(b: HudBtn, el: HTMLElement, r: { x: number; y: number; w: number; h: number }) {
	b.position.set(r.x, r.y);
	b.visible = true;
	const dis = (el as HTMLButtonElement).disabled || el.classList.contains('off') || el.getAttribute('aria-disabled') === 'true';
	const on = el.classList.contains('on') || el.classList.contains('active') || el.getAttribute('aria-pressed') === 'true';
	const vis = getComputedStyle(el).visibility;
	if (vis === 'hidden' && el.style.visibility === 'hidden') { /* jurisdiction hide */ b.visible = false; return; }
	// element can be visibility:hidden via pixiHud; still layout
	let frame = dis ? b.base + '_off' : on ? 'btn_gold' : b.base;
	try { atlasTex('ui', frame); } catch { frame = b.base; }
	setPlate(b.plate, frame, r.w, r.h, 2);
	let icoName = on && b.icoOff ? b.icoOff : b.icoOn;
	if (idOf(b) === 'autoBtn' && (on || el.classList.contains('running'))) icoName = 'ico_stop';
	if (b.ico.parent) b.ico.parent.removeChild(b.ico);
	try {
		b.ico = iconIn(b, icoName, Math.min(r.w, r.h), b.icoSize);
	} catch { /* */ }
	hit(b, r.w, r.h);
	b.alpha = dis ? 0.55 : 1;
	const pk = kOf(idOf(b));
	b.pivot.set(r.w / 2, r.h / 2);
	b.position.set(r.x + r.w / 2, r.y + r.h / 2);
	b.scale.set(pk);
}

function idOf(b: HudBtn) {
	return Object.keys(btns).find((k) => btns[k] === b) || '';
}

function wordIn(name: string, w: number, h: number, gold = false) {
	try {
		const key = gold && (() => { try { atlasTex('titles', name + '_gold'); return name + '_gold'; } catch { return name; } })() || name;
		const s = wordSpr(key);
		const tw = Math.max(1, s.texture.width), th = Math.max(1, s.texture.height);
		s.scale.set(Math.min(w / tw, h / th));
		s.eventMode = 'none';
		return s;
	} catch {
		return null;
	}
}

function placeWord(parent: Container, prev: Container | null, name: string, r: { x: number; y: number; w: number; h: number }, gold = false, align: 'left' | 'center' | 'right' = 'center') {
	if (prev && prev.parent) prev.parent.removeChild(prev);
	const s = wordIn(name, r.w, r.h, gold);
	if (!s) return null;
	const ax = align === 'left' ? 0 : align === 'right' ? 1 : 0.5;
	if (s instanceof Sprite) s.anchor.set(ax, 0.5);
	s.position.set(r.x + r.w * ax, r.y + r.h / 2);
	parent.addChild(s);
	return s;
}

function placeBm(parent: Container, prev: Sprite | null, text: string, font: string, r: { x: number; y: number; w: number; h: number }, align: 'left' | 'center' | 'right' = 'center') {
	if (prev) {
		if (prev.parent) prev.parent.removeChild(prev);
		const t = prev.texture;
		if (t && t !== Texture.EMPTY) try { t.destroy(true); } catch { /* */ }
	}
	const px = Math.max(10, r.h * 0.92);
	const s = bmFit(text, font, px, r.w, r.h, align === 'left' ? 'left' : 'center');
	if (!s) return null;
	s.eventMode = 'none';
	if (align === 'left') { s.anchor.set(0, 0.5); s.position.set(r.x, r.y + r.h / 2); }
	else if (align === 'right') { s.anchor.set(1, 0.5); s.position.set(r.x + r.w, r.y + r.h / 2); }
	else { s.anchor.set(0.5, 0.5); s.position.set(r.x + r.w / 2, r.y + r.h / 2); }
	parent.addChild(s);
	return s;
}

function fieldAlign(sel: string): 'left' | 'center' | 'right' {
	const portrait = document.body.classList.contains('portrait');
	if (sel === 'bet') return 'center';
	if (portrait) return 'left';
	return sel === 'balance' ? 'right' : 'left';
}

function wordKey(label: string) {
	const t = label.trim().toUpperCase();
	if (t === 'PLAY' || t === 'BET') return 'w_bet';
	if (t === 'BALANCE') return 'w_balance';
	if (t === 'WIN') return 'w_win';
	return '';
}

function build() {
	if (built) return;
	bar = new Container(); bar.label = 'uiHudBar'; bar.eventMode = 'none';
	barBg = new Container(); barBg.eventMode = 'none'; bar.addChild(barBg);
	hudLayer.addChild(bar);
	makeBtn('menuBtn', 'btn_pine', 0.62, 'ico_menu');
	makeBtn('turboBtn', 'btn_pine', 0.62, 'ico_turbo');
	makeBtn('autoBtn', 'btn_pine', 0.62, 'ico_auto');
	makeBtn('betDown', 'btn_gold', 0.55, 'ico_minus_ink');
	makeBtn('betUp', 'btn_gold', 0.55, 'ico_plus_ink');

	buy = new Container(); buy.label = 'uiHudBtn'; buy.eventMode = 'static'; buy.cursor = 'pointer';
	buyBg = new Container(); buyBg.eventMode = 'none'; buy.addChild(buyBg);
	buy.on('pointertap', (e) => { e.stopPropagation(); clickDom('buyBtn'); });
	hudLayer.addChild(buy);

	spin = new Container(); spin.label = 'uiHudBtn'; spin.eventMode = 'static'; spin.cursor = 'pointer';
	spinPlate = new Sprite(Texture.EMPTY); spinPlate.anchor.set(0.5); spinPlate.eventMode = 'none';
	spinIco = new Sprite(Texture.EMPTY); spinIco.anchor.set(0.5); spinIco.eventMode = 'none';
	spin.addChild(spinPlate, spinIco);
	spin.on('pointertap', (e) => { e.stopPropagation(); clickDom('spinBtn'); });
	hudLayer.addChild(spin);

	arm = new Container(); arm.label = 'uiArm'; arm.eventMode = 'static'; arm.cursor = 'pointer';
	armBg = new Container(); armBg.eventMode = 'none'; arm.addChild(armBg);
	arm.on('pointertap', (e) => { e.stopPropagation(); clickDom('armTag'); });
	arm.visible = false;
	hudLayer.addChild(arm);

	for (const id of ['balance', 'bet', 'win'] as const) {
		const root = new Container(); root.eventMode = 'none'; root.label = 'uiMeter';
		hudLayer.addChild(root);
		fields[id] = { root, lab: null, val: null };
	}

	fsRoot = new Container(); fsRoot.label = 'uiFsBar'; fsRoot.eventMode = 'none'; fsRoot.visible = false;
	fsBg = new Container(); fsBg.eventMode = 'none'; fsRoot.addChild(fsBg);
	hudLayer.addChild(fsRoot);

	uiScreen.addChildAt(hudLayer, 0);
	built = true;
}

function paintBar() {
	const r = rect($('hud'));
	if (!r) { bar.visible = false; return; }
	bar.visible = true;
	const out = 10 * (ST.s || 1);
	bar.position.set(r.x - out, r.y - out);
	clearKids(barBg);
	barBg.addChild(nineAt('hud_bar', r.w + 2 * out, r.h + 2 * out, 2.2));
}

function paintSpin() {
	const el = $('spinBtn') as HTMLButtonElement | null;
	const r = rect(el);
	if (!el || !r) { spin.visible = false; return; }
	spin.visible = true;
	spin.position.set(r.x, r.y);
	hit(spin, r.w, r.h);
	const dis = !!el.disabled;
	const busy = el.classList.contains('busy');
	const auto = el.classList.contains('auto');
	const stop = el.classList.contains('stop') || (busy && !!document.querySelector('#cells .cell.spinning, #strips .cspin'));
	try { spinPlate.texture = atlasTex('ui', dis ? 'spin_plate_busy' : 'spin_plate'); } catch { /* */ }
	const side = Math.min(r.w, r.h) * 1.12;
	const tw = Math.max(1, spinPlate.texture.width), th = Math.max(1, spinPlate.texture.height);
	const k = Math.min(side / tw, side / th);
	spinPlate.scale.set(k);
	spinPlate.position.set(r.w / 2, r.h / 2);
	const icoName = (auto || stop) ? 'ico_stop_ink' : 'ico_spin_ink';
	try {
		spinIco.texture = atlasTex('ui', icoName);
		const ik = (Math.min(r.w, r.h) * 0.48) / Math.max(1, Math.max(spinIco.texture.width, spinIco.texture.height));
		spinIco.scale.set(ik);
	} catch { /* */ }
	spinIco.position.set(r.w / 2, r.h / 2);
	spin.alpha = dis ? 0.7 : 1;
	const sk = kOf('spinBtn');
	spin.pivot.set(r.w / 2, r.h / 2);
	spin.position.set(r.x + r.w / 2, r.y + r.h / 2);
	spin.scale.set(sk);
	const n = $('autoN')?.textContent || '';
	if (autoNSpr) {
		if (autoNSpr.parent) autoNSpr.parent.removeChild(autoNSpr);
		const t = autoNSpr.texture;
		if (t && t !== Texture.EMPTY) try { t.destroy(true); } catch { /* */ }
		autoNSpr = null;
	}
	if (n) {
		autoNSpr = bmFit(n, 'font_ink', Math.max(10, r.h * 0.22), r.w * 0.6, r.h * 0.28, 'center');
		if (autoNSpr) {
			autoNSpr.anchor.set(0.5, 0.5);
			autoNSpr.position.set(r.w / 2, r.h * 0.78);
			autoNSpr.eventMode = 'none';
			spin.addChild(autoNSpr);
		}
	}
}

function paintBuy() {
	const el = $('buyBtn') as HTMLButtonElement | null;
	const r = rect(el);
	if (!el || !r) { buy.visible = false; return; }
	buy.visible = true;
	buy.position.set(r.x, r.y);
	hit(buy, r.w, r.h);
	const mkP = el.classList.contains('mkP');
	const dis = !!el.disabled;
	clearKids(buyBg);
	try { buyBg.addChild(nineAt(mkP ? 'btn_pine' : 'buy_plate', r.w, r.h, 2)); } catch { buyBg.addChild(nineAt('btn_pine', r.w, r.h, 2)); }
	if (buyDisc) { if (buyDisc.parent) buyDisc.parent.removeChild(buyDisc); }
	const disc = el.querySelector('.disc') as HTMLElement | null;
	const dr = rect(disc);
	if (buyIconTex && dr) {
		buyDisc = new Sprite(buyIconTex);
		buyDisc.eventMode = 'none';
		// The img is painted at 123% of the disc, offset like board.css.
		const iw = dr.w * 1.2308, ih = dr.h * 1.2308;
		buyDisc.width = iw; buyDisc.height = ih;
		buyDisc.position.set(dr.x - r.x - 0.1154 * dr.w, dr.y - r.y - 0.226 * dr.h);
		buy.addChild(buyDisc);
	}
	const lr = rect($('buyLbl'));
	if (buyLab && buyLab.parent) buyLab.parent.removeChild(buyLab);
	buyLab = null;
	const social = ($('buyLbl')?.textContent || '').toUpperCase().includes('GET');
	if (lr) {
		if (social) {
			const s = bmFit('GET BONUS', 'font_cream', Math.max(10, lr.h), lr.w, lr.h, 'center');
			if (s) { s.eventMode = 'none'; s.anchor.set(0.5, 0.5); s.position.set(lr.x - r.x + lr.w / 2, lr.y - r.y + lr.h / 2); buy.addChild(s); buyLab = s; }
		} else {
			// Tall (mkV) plates: the CSS line-box is a short strip (~12px) but the painted word
			// is width-contained in the label and sits in the band under the disc. Fit that band.
			let boxW = lr.w, boxH = lr.h, cy = lr.y - r.y + lr.h / 2;
			if (!mkP) {
				const discBottom = dr ? (dr.y - r.y + dr.h) : r.h * 0.45;
				const band = Math.max(lr.h, r.h - discBottom - 4);
				boxH = band;
				cy = discBottom + (r.h - discBottom) / 2;
			}
			const w = wordIn('w_buy_bonus', boxW, boxH, false);
			if (w) { w.position.set(lr.x - r.x + lr.w / 2, cy); buy.addChild(w); buyLab = w; }
		}
	}
	buy.alpha = dis ? 0.5 : 1;
}

function paintArm() {
	const el = $('armTag');
	const r = rect(el);
	const hidden = !el || el.classList.contains('hidden') || !r || r.w < 4;
	arm.visible = !hidden;
	if (hidden || !el || !r) return;
	arm.position.set(r.x, r.y);
	hit(arm, r.w, r.h);
	clearKids(armBg);
	armBg.addChild(nineAt('pill_gold', r.w, r.h, 2));
	if (armTxt) {
		if (armTxt.parent) armTxt.parent.removeChild(armTxt);
		const t = armTxt.texture;
		if (t && t !== Texture.EMPTY) try { t.destroy(true); } catch { /* */ }
		armTxt = null;
	}
	const txt = (el.querySelector('.t') as HTMLElement | null)?.textContent || '';
	const pad = Math.max(8, r.h * 0.35);
	armTxt = bmFit(txt, 'font_ink', Math.max(9, r.h * 0.62), Math.max(8, r.w - pad * 2 - r.h * 0.5), r.h * 0.8, 'center');
	if (armTxt) {
		armTxt.anchor.set(0.5, 0.5);
		armTxt.eventMode = 'none';
		armTxt.position.set(r.w * 0.46, r.h / 2);
		arm.addChild(armTxt);
	}
	if (armX) { if (armX.parent) armX.parent.removeChild(armX); }
	try {
		armX = spr('ui', 'ico_x_ink');
		armX.anchor.set(0.5);
		armX.eventMode = 'none';
		const s = (r.h * 0.45) / Math.max(1, Math.max(armX.texture.width, armX.texture.height));
		armX.scale.set(s);
		armX.position.set(r.w - r.h * 0.38, r.h / 2);
		arm.addChild(armX);
	} catch { armX = null; }
}

function paintFields() {
	for (const id of ['balance', 'bet', 'win'] as const) {
		const span = $(id);
		const lab = span ? (span.previousElementSibling as HTMLElement | null) || document.querySelector(`label[for="${id}"], #${id === 'bet' ? 'betLabel' : ''}`) as HTMLElement | null : null;
		const f = fields[id];
		const align = fieldAlign(id);
		const lr = rect(lab);
		const vr = rect(span);
		if (!lr && !vr) { f.root.visible = false; continue; }
		f.root.visible = true;
		const key = wordKey(lab?.textContent || (id === 'bet' ? 'BET' : id.toUpperCase()));
		if (lr && key) f.lab = placeWord(f.root, f.lab, key, lr, true, align);
		f.val = placeBm(f.root, f.val, (span?.textContent || '').trim(), 'font_cream', vr || lr!, align);
		if (id === 'win') f.root.scale.set(meterK);
	}
}

function paintFs() {
	const el = $('fsBar');
	const on = !!el && !el.classList.contains('hidden');
	fsRoot.visible = on;
	if (!on || !el) return;
	const tier = ($('fsTier')?.textContent || '').trim();
	const cnt = ($('fsCount')?.textContent || '').trim();
	const host = rect(el) || rect($('frame'));
	if (!host) return;
	const frame = $('frame');
	const fr = rect(frame);
	const maxW = fr ? Math.max(80, fr.w - 40) : Math.max(80, host.w || 280);
	const h = Math.max(22, host.h || 28);
	if (fsTierSpr) { if (fsTierSpr.parent) fsTierSpr.parent.removeChild(fsTierSpr); try { fsTierSpr.texture.destroy(true); } catch { /* */ } fsTierSpr = null; }
	if (fsCntSpr) { if (fsCntSpr.parent) fsCntSpr.parent.removeChild(fsCntSpr); try { fsCntSpr.texture.destroy(true); } catch { /* */ } fsCntSpr = null; }
	clearKids(fsBg);
	const pad = h * 0.55, gap = h * 0.4;
	let used = pad * 2;
	const tBox = Math.max(40, maxW * 0.55), cBox = Math.max(40, maxW * 0.4);
	fsTierSpr = bmFit(tier, 'font_gold', h * 0.5, tBox, h * 0.8, 'left');
	fsCntSpr = bmFit(cnt, 'font_cream', h * 0.5, cBox, h * 0.8, 'left');
	const tw = fsTierSpr ? fsTierSpr.width : 0;
	const cw = fsCntSpr ? fsCntSpr.width : 0;
	used = pad * 2 + tw + (tier && cnt ? gap : 0) + cw;
	const w = Math.min(maxW, Math.max(used, h * 2.4));
	fsBg.addChild(nineAt('pill_cran', w, h, 2));
	fsRoot.position.set(host.x + host.w / 2 - w / 2, host.y + host.h / 2 - h / 2);
	if (fsTierSpr) {
		fsTierSpr.anchor.set(0, 0.5);
		fsTierSpr.eventMode = 'none';
		fsTierSpr.position.set(pad, h / 2);
		fsRoot.addChild(fsTierSpr);
	}
	if (fsCntSpr) {
		fsCntSpr.anchor.set(0, 0.5);
		fsCntSpr.eventMode = 'none';
		fsCntSpr.position.set(pad + tw + (tier ? gap : 0), h / 2);
		fsRoot.addChild(fsCntSpr);
	}
}

function paintLogo() {
	const top = document.getElementById('top');
	const logo = document.getElementById('logo') || top;
	const r = rect(logo) || rect(top);
	if (!r || !logoTex) {
		if (logoSpr) logoSpr.visible = false;
		return;
	}
	if (!logoSpr) {
		logoSpr = new Sprite(logoTex);
		logoSpr.eventMode = 'none';
		logoSpr.label = 'uiLogo';
		logoSpr.anchor.set(0.5, 0.5);
		hudLayer.addChild(logoSpr);
	}
	logoSpr.texture = logoTex;
	logoSpr.visible = true;
	logoSpr.position.set(r.x + r.w / 2, r.y + r.h / 2);
	const tw = Math.max(1, logoTex.width), th = Math.max(1, logoTex.height);
	const k = Math.min(r.w / tw, r.h / th);
	logoSpr.scale.set(k);
}

function paintAll() {
	syncHostLayout();
	paintLogo();
	paintBar();
	for (const id of ['menuBtn', 'turboBtn', 'autoBtn', 'betDown', 'betUp']) {
		const el = $(id);
		const r = rect(el);
		if (el && r) paintBtn(btns[id], el, r);
		else if (btns[id]) btns[id].visible = false;
	}
	paintBuy();
	paintSpin();
	paintArm();
	paintFields();
	paintFs();
	kickUi();
}

let hudRaf = 0;
/** immediate=true paints this frame (after mkPlace). Otherwise one rAF, so count-ups don't rebuild every mutation. */
export function layoutHud(immediate = false) {
	if (!built) return;
	if (immediate) {
		if (hudRaf) { cancelAnimationFrame(hudRaf); hudRaf = 0; }
		paintAll();
		return;
	}
	if (hudRaf) return;
	hudRaf = requestAnimationFrame(() => { hudRaf = 0; paintAll(); });
}

export function syncHud() { layoutHud(); }

function hudItems(): [string, Container][] {
	return [
		['menuBtn', btns.menuBtn], ['turboBtn', btns.turboBtn], ['autoBtn', btns.autoBtn],
		['betDown', btns.betDown], ['betUp', btns.betUp],
		['buyBtn', buy], ['spinBtn', spin], ['armTag', arm],
	];
}

function hudTarget(x: number, y: number): { id: string; node: Container } | null {
	if (!built) return null;
	let hitN: { id: string; node: Container } | null = null;
	for (const [id, n] of hudItems()) {
		if (!n || !n.visible) continue;
		const b = n.getBounds();
		if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) hitN = { id, node: n };
	}
	return hitN;
}

export function hudHit(x: number, y: number) {
	return !!hudTarget(x, y);
}

function boxOf(n: Container | null | undefined, vis = true) {
	if (!n) return null;
	try {
		const b = n.getBounds();
		return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1), vis: vis && n.visible };
	} catch { return null; }
}

export function hudRects() {
	const out: Record<string, ReturnType<typeof boxOf>> = {
		hud: boxOf(bar),
		menuBtn: boxOf(btns.menuBtn),
		turboBtn: boxOf(btns.turboBtn),
		autoBtn: boxOf(btns.autoBtn),
		betDown: boxOf(btns.betDown),
		betUp: boxOf(btns.betUp),
		buyBtn: boxOf(buy),
		spinBtn: boxOf(spin),
		armTag: boxOf(arm),
		balance: boxOf(fields.balance?.root),
		bet: boxOf(fields.bet?.root),
		win: boxOf(fields.win?.root),
		fsBar: boxOf(fsRoot),
	};
	return out;
}


let press: { id: string; node: Container; ptr: number } | null = null;
const pressK: Record<string, number> = {};
let meterK = 1;
let meterTw: gsap.core.Tween | null = null;

function kOf(id: string) { return pressK[id] ?? 1; }

export function punchWinMeter() {
	const n = fields.win?.root; if (!n) return;
	meterTw?.kill();
	meterK = 1;
	const proxy = { k: 1 };
	meterTw = gsap.to(proxy, {
		k: 1.18, duration: 0.28 * 0.35, ease: cssEase('cubic-bezier(.3,1.5,.5,1)'),
		onUpdate: () => { meterK = proxy.k; n.scale.set(meterK); kickUi(); },
		onComplete: () => {
			meterTw = gsap.to(proxy, {
				k: 1, duration: 0.28 * 0.65, ease: cssEase('cubic-bezier(.3,1.5,.5,1)'),
				onUpdate: () => { meterK = proxy.k; n.scale.set(meterK); kickUi(); },
				onComplete: () => { meterK = 1; n.scale.set(1); kickUi(); },
			});
		},
	});
}


function canvasLive() {
	const cv = uiApp()?.canvas as HTMLCanvasElement | undefined;
	return !!cv && cv.style.pointerEvents === 'auto';
}

function onHudDown(e: PointerEvent) {
	if (!built || !document.body.classList.contains('pixiHud') || canvasLive()) return;
	const t = hudTarget(e.clientX, e.clientY);
	if (!t) return;
	press = { id: t.id, node: t.node, ptr: e.pointerId };
	t.node.alpha = 0.92;
	const proxy = { k: 0.84 };
	pressK[t.id] = 0.84;
	gsap.killTweensOf(proxy);
	gsap.to(proxy, {
		keyframes: [
			{ k: 0.84, duration: 0 },
			{ k: 1.04, duration: 0.2 * 0.6, ease: cssEase('cubic-bezier(.3,1.55,.45,1)') },
			{ k: 1, duration: 0.2 * 0.4, ease: cssEase('cubic-bezier(.3,1.55,.45,1)') },
		],
		onUpdate: () => { pressK[t.id] = proxy.k; kickUi(); },
		onComplete: () => { pressK[t.id] = 1; kickUi(); },
	});
	kickUi();
	e.stopPropagation();
}

function onHudUp(e: PointerEvent) {
	if (!press || press.ptr !== e.pointerId) return;
	const { id, node } = press;
	press = null;
	node.alpha = 1;
	kickUi();
	const still = hudTarget(e.clientX, e.clientY)?.id === id;
	if (still) clickDom(id);
	e.stopPropagation();
}

function onHudCancel(e: PointerEvent) {
	if (!press || press.ptr !== e.pointerId) return;
	press.node.alpha = 1;
	press = null;
	kickUi();
}

export async function initHud() {
	if (built) return;
	try { buyIconTex = await Assets.load('art/buy_icon.webp') as Texture; } catch { buyIconTex = null; }
	try { logoTex = await Assets.load('art/logo.webp') as Texture; } catch { logoTex = null; }
	build();
	onUiLayout(() => layoutHud(true));
	document.body.classList.add('pixiHud');
	const mo = new MutationObserver(() => layoutHud());
	const tree = uiHostTree();
	if (tree) mo.observe(tree, { attributes: true, attributeFilter: ['class', 'disabled', 'aria-pressed', 'aria-checked', 'style'], subtree: true, childList: true, characterData: true });
	const hud = $('hud'), fs = $('fsBar');
	if (hud && hud !== tree && !tree?.contains(hud)) mo.observe(hud, { attributes: true, attributeFilter: ['class', 'disabled', 'aria-pressed', 'aria-checked', 'style'], subtree: true, childList: true, characterData: true });
	if (fs) mo.observe(fs, { attributes: true, attributeFilter: ['class', 'style'], subtree: true, childList: true, characterData: true });
	document.addEventListener('pointerdown', onHudDown, { capture: true });
	document.addEventListener('pointerup', onHudUp, { capture: true });
	document.addEventListener('pointercancel', onHudCancel, { capture: true });
	layoutHud(true);
	requestAnimationFrame(() => layoutHud(true));
	setTimeout(() => layoutHud(true), 120);
}
