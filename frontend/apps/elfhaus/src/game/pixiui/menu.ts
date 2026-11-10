// Pixi settings pop-out, settings panel, game-info chrome, and autoplay panel.
// DOM stays the state / timing / input / a11y model. Rules body HTML is unchanged
// and stays a live scroll window so touch + wheel keep working (panels.ts Scroller).
import { Container, Graphics, Rectangle, Sprite } from 'pixi.js';
import { spr } from '../scene/atlas';
import { closePanel } from '../panels';
import { closePop, popOpen } from '../settings';
import { audioVol, setAudioVol } from '../audio';
import { animateUi, kickUi, onUiLayout, uiInteractive, uiScreen, viewH, viewW } from './stage';
import { bmFit, setBm, wordSpr, fitSpr } from './text';
import { icoBtn, makeSlider, makeStepper, makeSwitch, modalDimTex, nineUi, type UiSlider, type UiStepper } from './widgets';
import { makeRulesScroll, type RulesScroll } from './rules';
import { relaxUiTier } from './wins';
import { hudLayer } from './hud';

export const menuLayer = new Container();
menuLayer.label = 'uiPanels';
menuLayer.eventMode = 'passive';
menuLayer.sortableChildren = true;

const $ = (sel: string) => document.querySelector<HTMLElement>(sel);
const byId = (id: string) => document.getElementById(id);

type Box = { x: number; y: number; w: number; h: number };

function defaultModalBox(): Box {
	const pad = Math.max(10, Math.min(viewW, viewH) * 0.04);
	const w = Math.min(viewW - pad * 2, viewW < 520 ? viewW - pad * 2 : 440);
	const h = Math.min(viewH - pad * 2, viewH < 700 ? viewH - pad * 2 : Math.min(viewH * 0.88, 640));
	return { x: (viewW - w) / 2, y: (viewH - h) / 2, w, h };
}

function defaultPopBox(): Box {
	const btn = byId('menuBtn');
	const br = rec(btn);
	const w = Math.min(230, viewW - 16);
	const rowH = 46;
	const h = 5 * (rowH + 4) + 20;
	let x = 8, y = 8;
	if (br) { x = br.x; y = br.y + br.h + 8; }
	if (x + w > viewW - 8) x = Math.max(8, viewW - 8 - w);
	if (y + h > viewH - 120) y = Math.max(8, (br ? br.y + br.h + 8 : 8));
	return { x, y, w, h };
}

function phoneView() {
	return document.body.classList.contains('portrait') || document.body.classList.contains('phone') || viewW < 500;
}


function rec(el: Element | null): Box | null {
	if (!el) return null;
	const r = el.getBoundingClientRect();
	if (!r.width && !r.height) return null;
	return { x: r.x, y: r.y, w: r.width, h: r.height };
}

function opacityOf(el: HTMLElement | null) {
	if (!el) return 0;
	if (el.classList.contains('hidden')) return 0;
	const inline = el.style.opacity;
	if (inline) {
		const o = parseFloat(inline);
		if (Number.isFinite(o)) return o;
	}
	try {
		const o = parseFloat(getComputedStyle(el).opacity);
		if (Number.isFinite(o) && o > 0) return o;
	} catch { /* detached */ }
	return 1;
}

function overlayShown(id: string) {
	const el = byId(id);
	return !!el && !el.classList.contains('hidden');
}

function clickEl(el: Element | null) {
	if (el && el instanceof HTMLElement) el.click();
}

function clickId(id: string) {
	clickEl(byId(id));
}

const boxKey = new WeakMap<Container, string>();

function resetBg(c: Container, name: string, w: number, h: number, k = 2) {
	const key = `${name}:${Math.round(w)}x${Math.round(h)}:${k}`;
	if (boxKey.get(c) === key && c.children.length) return;
	for (const ch of c.children.slice()) {
		if ((ch as Container).label === 'uiPlate') c.removeChild(ch);
	}
	const plate = nineUi(name, Math.max(8, w), Math.max(8, h), k);
	plate.label = 'uiPlate';
	c.addChildAt(plate, 0);
	boxKey.set(c, key);
}

function putAt(c: Container, r: Box) {
	c.position.set(r.x, r.y);
	c.visible = true;
}


/** Swap a sprite that shares an atlas texture. Never destroy the texture (atlasTex / word sprites). */
function setSpr(parent: Container, prev: Sprite | null, next: Sprite | null) {
	if (prev) {
		parent.removeChild(prev);
		try { prev.destroy({ texture: false, textureSource: false }); } catch { /* */ }
	}
	if (next) parent.addChild(next);
	return next;
}

function putLabel(host: Container, prev: Sprite | null, text: string, box: Box, font: 'font_ink' | 'font_cream', align: 'left' | 'center' = 'left') {
	const key = 'bm:' + text + ':' + font + ':' + align;
	if (prev?.label === key) {
		prev.anchor.set(align === 'center' ? 0.5 : 0, 0.5);
		prev.position.set(align === 'center' ? box.x + box.w / 2 : box.x, box.y + box.h / 2);
		return prev;
	}
	const s = bmFit(text, font, Math.min(22, Math.max(10, box.h * 0.7)), Math.max(8, box.w), Math.max(8, box.h), align);
	if (s) {
		s.label = key;
		s.anchor.set(align === 'center' ? 0.5 : 0, 0.5);
		s.eventMode = 'none';
		s.position.set(align === 'center' ? box.x + box.w / 2 : box.x, box.y + box.h / 2);
	}
	return setBm(host, prev, s);
}

function putWord(host: Container, prev: Sprite | null, name: string, box: Box) {
	const key = 'w:' + name + ':' + Math.round(box.w) + 'x' + Math.round(box.h);
	if (prev?.label === key) {
		prev.position.set(box.x + box.w / 2, box.y + box.h / 2);
		return prev;
	}
	let s: Sprite | null = null;
	try {
		s = wordSpr(name);
		s.label = key;
		s.eventMode = 'none';
		fitSpr(s, box.w, box.h);
		s.position.set(box.x + box.w / 2, box.y + box.h / 2);
	} catch { s = null; }
	return setSpr(host, prev, s);
}

function icoAt(host: Container, prev: Sprite | null, frame: string, box: Box) {
	const key = 'ico:' + frame + ':' + Math.round(box.w) + 'x' + Math.round(box.h);
	if (prev?.label === key) {
		prev.position.set(box.x + box.w / 2, box.y + box.h / 2);
		return prev;
	}
	let s: Sprite | null = null;
	try {
		s = spr('ui', frame);
		s.label = key;
		s.anchor.set(0.5);
		s.eventMode = 'none';
		const k = Math.min(box.w, box.h) / Math.max(1, Math.max(s.texture.width, s.texture.height));
		s.scale.set(k);
		s.position.set(box.x + box.w / 2, box.y + box.h / 2);
	} catch { s = null; }
	return setSpr(host, prev, s);
}

function makeDim(onTap: () => void) {
	const s = modalDimTex ? new Sprite(modalDimTex) : new Sprite();
	s.eventMode = 'static';
	s.cursor = 'pointer';
	s.visible = false;
	s.alpha = 0;
	s.hitArea = new Rectangle(0, 0, 8, 8);
	const fit = () => {
		s.position.set(0, 0);
		s.width = Math.max(8, viewW);
		s.height = Math.max(8, viewH);
		s.hitArea = new Rectangle(0, 0, viewW, viewH);
	};
	fit();
	onUiLayout(fit);
	s.on('pointertap', (e) => { e.stopPropagation(); onTap(); });
	return s;
}

export function panelsVisible() {
	return popOpen() || overlayShown('settings') || overlayShown('menu') || overlayShown('autoMenu');
}

// ---------- pop-out menu ----------
let popCatch: Sprite, popRoot: Container, popPlate: Container, popRows: Container, popSlide: Container, popSlidePlate: Container;
let popSlider: UiSlider;
let popLabs: Sprite[] = [];
let popIcos: Sprite[] = [];
let popSlideKey = '';

function pmIcoFrame(row: HTMLElement) {
	const open = row.getAttribute('aria-expanded') === 'true';
	const muted = row.id === 'pmMute' && row.classList.contains('on');
	const mus = audioVol('mus'), sfx = audioVol('sfx');
	switch (row.id) {
		case 'pmInfo': return 'ico_info_ink';
		case 'pmMusic': return open ? 'ico_x_ink' : (!mus ? 'ico_mute_ink' : 'ico_music_ink');
		case 'pmSound': return open ? 'ico_x_ink' : (!sfx ? 'ico_mute_ink' : 'ico_sound_ink');
		case 'pmMute': return muted ? 'ico_sound_ink' : 'ico_mute_ink';
		default: return 'ico_chev_ink';
	}
}

function syncPop() {
	const el = byId('popMenu');
	if (!el || !popOpen()) {
		popRoot.visible = false;
		popCatch.visible = false;
		popSlide.visible = false;
		return;
	}
	const r0 = rec(el) || defaultPopBox();
	if (!r0) { popRoot.visible = false; popCatch.visible = false; return; }
	let r = r0;
	popCatch.visible = true;
	popCatch.alpha = 0.001;
	popCatch.width = viewW;
	popCatch.height = viewH;
	popCatch.hitArea = new Rectangle(0, 0, viewW, viewH);
	putAt(popRoot, { x: 0, y: 0, w: viewW, h: viewH });
	popRoot.alpha = opacityOf(el);
	putAt(popPlate, r);
	resetBg(popPlate, 'plate_cream', r.w, r.h, 2);
	popPlate.label = 'uiPanel';

	const rows = Array.from(el.querySelectorAll<HTMLElement>('.pmRow'));
	while (popLabs.length < rows.length) popLabs.push(null as unknown as Sprite);
	while (popIcos.length < rows.length) popIcos.push(null as unknown as Sprite);
	const rowH = Math.max(36, (r.h - 16) / Math.max(1, rows.length) - 4);
	rows.forEach((row, i) => {
		const rr = rec(row) || { x: r.x + 8, y: r.y + 8 + i * (rowH + 4), w: r.w - 16, h: rowH };
		if (!rr) return;
		const plate = popRows.children[i] as Container | undefined;
		let host = plate;
		if (!host) {
			host = new Container();
			host.eventMode = 'static';
			host.cursor = 'pointer';
			host.on('pointertap', (e) => { e.stopPropagation(); clickEl(row); });
			popRows.addChild(host);
		}
		putAt(host, rr);
		resetBg(host, 'row_plate', rr.w, rr.h, 2.4);
		host.hitArea = new Rectangle(0, 0, rr.w, rr.h);
		const icoSlot = rec(row.querySelector('.pmIco, .pmI')) || { x: rr.x + 8, y: rr.y + (rr.h - 22) / 2, w: 22, h: 22 };
		const span = row.querySelector('span');
		const labX = Math.max(icoSlot.x + icoSlot.w + 8, (rec(span)?.x ?? icoSlot.x + icoSlot.w + 8));
		const labR = { x: labX, y: rr.y, w: Math.max(8, rr.x + rr.w - 10 - labX), h: rr.h };
		popIcos[i] = icoAt(host, popIcos[i], pmIcoFrame(row), { x: icoSlot.x - rr.x, y: icoSlot.y - rr.y, w: icoSlot.w, h: icoSlot.h });
		const text = (span?.textContent || '').trim();
		popLabs[i] = putLabel(host, popLabs[i], text, { x: labR.x - rr.x, y: 0, w: labR.w, h: rr.h }, 'font_ink', 'left');
	});
	while (popRows.children.length > rows.length) popRows.removeChild(popRows.children[popRows.children.length - 1]);

	const openItem = el.querySelector<HTMLElement>('.pmItem.open');
	const slide = openItem?.querySelector<HTMLElement>('.pmSlide') || null;
	if (!slide) {
		popSlide.visible = false;
		popSlideKey = '';
		return;
	}
	const openRow = rec(openItem.querySelector('.pmRow')) || rec(openItem) || r;
	let sr: Box = { x: r.x + r.w + 14, y: openRow.y + (openRow.h - 42) / 2, w: 182, h: 42 };
	// Phone / narrow: always park the slider under the card so it cannot sit
	// on the logo. Never flip it above the card on those sizes.
	const under = { x: r.x, y: r.y + r.h + 8, w: Math.max(r.w, 182), h: 42 };
	if (phoneView() || sr.x + sr.w > viewW - 8) sr = under;
	if (sr.y + sr.h > viewH - 6) {
		if (phoneView()) {
			const need = sr.y + sr.h - (viewH - 6);
			r = { ...r, y: Math.max(6, r.y - need) };
			putAt(popPlate, r);
			resetBg(popPlate, 'plate_cream', r.w, r.h, 2);
			sr = { x: r.x, y: r.y + r.h + 8, w: Math.max(r.w, 182), h: 42 };
		} else {
			sr = { ...sr, y: Math.max(6, r.y - 8 - sr.h) };
		}
	}
	if (sr.x < 6) sr = { ...sr, x: 6 };
	putAt(popSlide, sr);
	popSlide.alpha = 1;
	resetBg(popSlidePlate, 'plate_cream', sr.w, sr.h, 2.4);
	const tr = rec(slide.querySelector('.pmTr')) || { x: sr.x + 16, y: sr.y + (sr.h - 16) / 2, w: sr.w - 32, h: Math.max(12, sr.h * 0.4) };
	popSlider.position.set(tr.x - sr.x, tr.y - sr.y);
	popSlider.layout(tr.w, tr.h);
	const k = (openItem!.dataset.k || 'mus') as 'mus' | 'sfx';
	const v = audioVol(k);
	if (popSlideKey !== k) {
		popSlideKey = k;
		popSlider.set(v);
	} else if (Math.abs(popSlider.value() - v) > 0.001) {
		popSlider.set(v);
	}
	popSlide.visible = true;
}

// ---------- generic modal chrome (settings / auto / info) ----------
type ModalUi = {
	root: Container;
	dim: Sprite;
	panel: Container;
	close: Container & { size: number };
	body: Container;
	titleSpr: Sprite | null;
	id: string;
};

function makeModal(id: string): ModalUi {
	const root = new Container();
	root.visible = false;
	root.eventMode = 'passive';
	const dim = makeDim(() => closePanel('#' + id));
	const panel = new Container();
	panel.label = 'uiPanel';
	panel.eventMode = 'none';
	const body = new Container();
	body.eventMode = 'passive';
	const close = icoBtn('btn_close', 44, () => closePanel('#' + id));
	close.label = 'uiClose';
	root.addChild(dim, panel, body, close);
	menuLayer.addChild(root);
	return { root, dim, panel, body, close, titleSpr: null, id };
}

function syncModalChrome(ui: ModalUi, titleWord: string | null, titleFallback: string, opts?: { title?: boolean }) {
	const el = byId(ui.id);
	if (!overlayShown(ui.id) || !el) {
		ui.root.visible = false;
		return null;
	}
	const modal = el.querySelector('.modal') as HTMLElement | null;
	const r = rec(modal) || defaultModalBox();
	if (!r) { ui.root.visible = false; return null; }
	ui.root.visible = true;
	ui.root.alpha = opacityOf(el);
	ui.dim.visible = true;
	ui.dim.alpha = Math.max(0.35, opacityOf(el));
	putAt(ui.panel, r);
	resetBg(ui.panel, 'plate_cream', r.w, r.h, 2);
	// Pin the close control to the plate's top-right. The hidden .mX box can
	// report a stale / zero rect while the modal paint is filtered out.
	ui.close.position.set(r.x + r.w - ui.close.size - 6, r.y + 6);
	if (opts?.title === false) {
		if (ui.titleSpr) ui.titleSpr.visible = false;
	} else {
		const title = el.querySelector('.mHead h2, h2');
		const tr = rec(title) || { x: r.x + 20, y: r.y + 10, w: r.w - 80, h: 32 };
		if (ui.titleSpr) ui.titleSpr.visible = true;
		if (titleWord) {
			ui.titleSpr = putWord(ui.root, ui.titleSpr, titleWord, tr);
			if (!ui.titleSpr) ui.titleSpr = putLabel(ui.root, ui.titleSpr, titleFallback, tr, 'font_ink', 'left');
		} else {
			ui.titleSpr = putLabel(ui.root, ui.titleSpr, (title?.textContent || titleFallback).trim(), tr, 'font_ink', 'left');
		}
	}
	return { el, modal, r };
}

// ---------- settings ----------
let setUi: ModalUi;
const setSw: { snd?: ReturnType<typeof makeSwitch>; turbo?: ReturnType<typeof makeSwitch> } = {};
const setSl: { mus?: UiSlider; sfx?: UiSlider } = {};
const setLabs: { snd?: Sprite | null; mus?: Sprite | null; sfx?: Sprite | null; turbo?: Sprite | null } = {};
let setBuilt = false;

function ensureSettings() {
	if (setBuilt) return;
	setBuilt = true;
	setSw.snd = makeSwitch(() => clickId('stSnd'));
	setSw.turbo = makeSwitch(() => clickId('stTurbo'));
	setSl.mus = makeSlider((v) => { setAudioVol('mus', v); });
	setSl.sfx = makeSlider((v) => { setAudioVol('sfx', v); });
	setUi.body.addChild(setSw.snd, setSw.turbo, setSl.mus, setSl.sfx);
}

function syncSettings() {
	ensureSettings();
	const info = syncModalChrome(setUi, 'w_settings', 'SETTINGS');
	setUi.body.visible = !!info;
	if (!info) return;
	const rowH = 48, rowGap = 8, rowX = info.r.x + 16, rowW = info.r.w - 32;
	let rowY = info.r.y + 56;
	const placeRow = (sel: string, kind: 'sw' | 'sl', key: 'snd' | 'mus' | 'sfx' | 'turbo') => {
		const row = $(sel);
		const rr = rec(row) || { x: rowX, y: rowY, w: rowW, h: rowH };
		rowY += rowH + rowGap;
		if (!row) return;
		let plate = setUi.body.children.find((c) => c.label === 'row:' + key) as Container | undefined;
		if (!plate) {
			plate = new Container();
			plate.label = 'row:' + key;
			plate.eventMode = 'none';
			setUi.body.addChildAt(plate, 0);
		}
		putAt(plate, rr);
		resetBg(plate, 'row_plate', rr.w, rr.h, 2);
		const lab = rec(row.querySelector('.lbl')) || { x: rr.x + 12, y: rr.y, w: rr.w * 0.4, h: rr.h };
		const word = key === 'mus' ? 'w_music' : key === 'snd' ? 'w_sound' : null;
		const text = (row.querySelector('.lbl')?.textContent || '').trim();
		if (word) {
			const sprW = putWord(plate, (setLabs[key] as Sprite | null) || null, word, { x: lab.x - rr.x, y: lab.y - rr.y, w: lab.w, h: lab.h });
			setLabs[key] = sprW || putLabel(plate, setLabs[key] || null, text, { x: lab.x - rr.x, y: 0, w: lab.w, h: rr.h }, 'font_ink', 'left');
		} else {
			setLabs[key] = putLabel(plate, setLabs[key] || null, text, { x: lab.x - rr.x, y: 0, w: lab.w, h: rr.h }, 'font_ink', 'left');
		}
		if (kind === 'sw') {
			const swEl = row.querySelector('.sw') as HTMLElement | null;
			const sr = rec(swEl) || { x: rr.x + rr.w - 76, y: rr.y + (rr.h - 36) / 2, w: 64, h: 36 };
			const sw = key === 'snd' ? setSw.snd! : setSw.turbo!;
			sw.position.set(sr.x, sr.y);
			const k = sr.h / sw.H;
			sw.scale.set(k);
			sw.set(swEl?.classList.contains('on') || swEl?.getAttribute('aria-checked') === 'true');
		} else {
			const slEl = row.querySelector('.stSl') as HTMLElement | null;
			const sr = rec(slEl) || { x: rr.x + rr.w * 0.4, y: rr.y + (rr.h - 16) / 2, w: rr.w * 0.5, h: 16 };
			const sl = key === 'mus' ? setSl.mus! : setSl.sfx!;
			sl.position.set(sr.x, sr.y);
			sl.layout(sr.w, sr.h);
			const v = audioVol(key as 'mus' | 'sfx');
			if (Math.abs(sl.value() - v) > 0.001) sl.set(v);
		}
	};
	placeRow('#stSndRow', 'sw', 'snd');
	placeRow('#stMusRow', 'sl', 'mus');
	placeRow('#stSfxRow', 'sl', 'sfx');
	placeRow('#stTurboRow', 'sw', 'turbo');
}

// ---------- autoplay ----------
let autoUi: ModalUi;
let autoSwBonus: ReturnType<typeof makeSwitch>, autoSwFeat: ReturnType<typeof makeSwitch>;
let autoLabs: Record<string, Sprite | null> = {};
let autoErrSpr: Sprite | null = null;
let autoStartLab: Sprite | null = null;
let autoStartBtn: Container | null = null;
let autoChips: Container;
let autoAdv: Container;
let autoScroll: Container;
let autoScrollMask: Graphics | null = null;
let autoSteppers: Record<string, UiStepper> = {};
let autoScrollY = 0;
let autoDrag: { y: number; s: number } | null = null;

function stepAmt(id: string, dir: number) {
	const el = byId(id) as HTMLInputElement | null;
	if (!el) return;
	const cur = el.value.trim() === '' ? 0 : Number(el.value.replace(',', '.'));
	const base = Number.isFinite(cur) ? cur : 0;
	const step = Math.max(1, Math.round(base ? Math.pow(10, Math.max(0, Math.floor(Math.log10(base)) - 1)) : 1));
	let next = base + dir * step;
	if (next <= 0) el.value = '';
	else el.value = String(next);
	el.dispatchEvent(new Event('input', { bubbles: true }));
	el.dispatchEvent(new Event('change', { bubbles: true }));
}

function ensureAuto() {
	if (autoStartBtn) return;
	autoSwBonus = makeSwitch(() => clickId('stBonus'));
	autoSwFeat = makeSwitch(() => clickId('stFeat'));
	autoChips = new Container();
	autoAdv = new Container();
	autoScroll = new Container();
	autoScroll.eventMode = 'static';
	autoScroll.on('pointerdown', (e) => { autoDrag = { y: e.global.y, s: autoScrollY }; e.stopPropagation(); });
	autoScroll.on('pointermove', (e) => {
		if (!autoDrag) return;
		autoScrollY = autoDrag.s - (e.global.y - autoDrag.y);
		kickUi();
		e.stopPropagation();
	});
	const end = () => { autoDrag = null; };
	autoScroll.on('pointerup', end);
	autoScroll.on('pointerupoutside', end);
	autoScroll.on('pointercancel', end);
	autoScroll.on('wheel', (e: any) => { autoScrollY += (e.deltaY ?? 0); kickUi(); e.stopPropagation?.(); });
	autoStartBtn = new Container();
	autoStartBtn.eventMode = 'static';
	autoStartBtn.cursor = 'pointer';
	autoStartBtn.on('pointertap', (e) => { e.stopPropagation(); clickId('autoStart'); });
	autoSteppers.stLoss = makeStepper(() => stepAmt('stLoss', -1), () => stepAmt('stLoss', 1));
	autoSteppers.stWin = makeStepper(() => stepAmt('stWin', -1), () => stepAmt('stWin', 1));
	autoSteppers.stUp = makeStepper(() => stepAmt('stUp', -1), () => stepAmt('stUp', 1));
	autoScroll.addChild(autoChips, autoAdv, autoSwBonus, autoSwFeat, autoSteppers.stLoss, autoSteppers.stWin, autoSteppers.stUp);
	autoUi.body.addChild(autoScroll, autoStartBtn);
}

function syncAuto() {
	ensureAuto();
	const info = syncModalChrome(autoUi, 'w_autoplay', 'AUTOPLAY');
	autoUi.body.visible = !!info;
	if (!info) return;
	const r = info.r;
	const pad = 14;
	const startH = Math.max(44, Math.min(56, r.h * 0.1));
	const startY = r.y + r.h - pad - startH;
	const bodyTop = r.y + 52;
	const bodyH = Math.max(80, startY - 10 - bodyTop);
	autoScroll.position.set(r.x, bodyTop);
	autoScroll.hitArea = new Rectangle(0, 0, r.w, bodyH);
	if (!autoScrollMask) {
		autoScrollMask = new Graphics();
		autoScroll.addChildAt(autoScrollMask, 0);
	}
	autoScrollMask.clear();
	autoScrollMask.rect(0, 0, r.w, bodyH).fill(0xffffff);
	autoScroll.mask = autoScrollMask;

	const placeY = (c: Container, x: number, yy: number) => { c.position.set(x, yy); (c as any)._layY = yy; };
	placeY(autoChips, 0, 0);
	placeY(autoAdv, 0, 0);

	const innerW = r.w - pad * 2;
	let y = 4;
	const counts = byId('autoCounts');
	const chips = counts ? Array.from(counts.querySelectorAll<HTMLElement>('button')) : [];
	while (autoChips.children.length < chips.length) {
		const c = new Container();
		c.eventMode = 'static';
		c.cursor = 'pointer';
		const i = autoChips.children.length;
		c.on('pointertap', (e) => {
			e.stopPropagation();
			const b = byId('autoCounts')?.querySelectorAll('button')[i] as HTMLElement | undefined;
			clickEl(b || null);
		});
		autoChips.addChild(c);
	}
	while (autoChips.children.length > chips.length) autoChips.removeChild(autoChips.children[autoChips.children.length - 1]);
	const n = Math.max(1, chips.length);
	const cols = n > 4 ? 5 : Math.max(1, n);
	const gap = 6;
	const cw = (innerW - gap * (cols - 1)) / cols;
	const ch = 40;
	chips.forEach((b, i) => {
		const col = i % cols, row = Math.floor(i / cols);
		const rr = rec(b) || { x: r.x + pad + col * (cw + gap), y: bodyTop + y + row * (ch + gap), w: cw, h: ch };
		const c = autoChips.children[i] as Container;
		// positions inside the scroll container (local)
		placeY(c, pad + col * (cw + gap), y + row * (ch + gap));
		resetBg(c, (b.classList.contains('on') || b.getAttribute('aria-checked') === 'true') ? 'btn_gold' : 'btn_pine', cw, ch, 2);
		c.hitArea = new Rectangle(0, 0, cw, ch);
		autoLabs['chip' + i] = putLabel(c, autoLabs['chip' + i] || null, (b.textContent || '').trim(), { x: 0, y: 0, w: cw, h: ch }, 'font_cream', 'center');
		void rr;
	});
	y += Math.ceil(n / cols) * (ch + gap) + 6;

	const ab = byId('abRow');
	const rowH = 44;
	{
		let plate = autoScroll.children.find((c) => c.label === 'row:bonus') as Container | undefined;
		if (!plate) {
			plate = new Container();
			plate.label = 'row:bonus';
			autoScroll.addChildAt(plate, 0);
		}
		placeY(plate, pad, y);
		resetBg(plate, 'row_plate', innerW, rowH, 2);
		autoLabs.bonus = putLabel(plate, autoLabs.bonus || null, (ab?.querySelector('.lbl')?.textContent || 'AUTO-PLAY BONUS').trim(), { x: 12, y: 0, w: innerW * 0.62, h: rowH }, 'font_ink', 'left');
		const swEl = byId('stBonus');
		placeY(autoSwBonus, pad + innerW - 72, y + (rowH - 36) / 2);
		autoSwBonus.scale.set(36 / autoSwBonus.H);
		autoSwBonus.set(!!swEl?.classList.contains('on'));
	}
	y += rowH + 8;

	const advBtn = byId('advBtn');
	{
		let btn = autoScroll.children.find((c) => c.label === 'advBtn') as Container | undefined;
		if (!btn) {
			btn = new Container();
			btn.label = 'advBtn';
			btn.eventMode = 'static';
			btn.cursor = 'pointer';
			btn.on('pointertap', (e) => { e.stopPropagation(); clickId('advBtn'); });
			autoScroll.addChild(btn);
		}
		placeY(btn, pad, y);
		btn.hitArea = new Rectangle(0, 0, innerW, 32);
		const open = advBtn?.getAttribute('aria-expanded') === 'true' || !byId('adv')?.classList.contains('hidden');
		autoLabs.adv = putLabel(btn, autoLabs.adv || null, (advBtn?.textContent || 'ADVANCED').trim(), { x: 8, y: 0, w: innerW - 36, h: 32 }, 'font_ink', 'left');
		autoLabs.chev = icoAt(btn, autoLabs.chev || null, 'ico_chev_ink', { x: innerW - 28, y: 8, w: 16, h: 16 });
		if (autoLabs.chev) autoLabs.chev.scale.y = Math.abs(autoLabs.chev.scale.y) * (open ? -1 : 1);
		y += 36;
	}

	const adv = byId('adv');
	const advOpen = !!adv && !adv.classList.contains('hidden');
	autoAdv.visible = advOpen;
	autoSwFeat.visible = advOpen;
	for (const s of Object.values(autoSteppers)) s.visible = advOpen;
	if (advOpen && adv) {
		const rows = Array.from(adv.querySelectorAll<HTMLElement>('.row'));
		while (autoAdv.children.length < rows.length) {
			const c = new Container();
			c.eventMode = 'none';
			autoAdv.addChild(c);
		}
		while (autoAdv.children.length > rows.length) autoAdv.removeChild(autoAdv.children[autoAdv.children.length - 1]);
		rows.forEach((row, i) => {
			const c = autoAdv.children[i] as Container;
			placeY(c, pad, y);
			resetBg(c, 'row_plate', innerW, rowH, 2);
			autoLabs['adv' + i] = putLabel(c, autoLabs['adv' + i] || null, (row.querySelector('.lbl')?.textContent || '').trim(), { x: 12, y: 0, w: innerW * 0.48, h: rowH }, 'font_ink', 'left');
			const inp = row.querySelector('input') as HTMLInputElement | null;
			const sw = row.querySelector('.sw') as HTMLElement | null;
			if (inp) {
				const st = autoSteppers[inp.id];
				if (st) {
					const swd = Math.min(180, innerW * 0.46);
					st.visible = true;
					placeY(st, pad + innerW - swd - 8, y + (rowH - 32) / 2);
					st.layout(swd, 32);
					const val = inp.value.trim() || inp.placeholder || 'Off';
					autoLabs['step' + inp.id] = putLabel(st.field, autoLabs['step' + inp.id] || null, val, { x: 0, y: 0, w: st.fieldSize().w, h: st.fieldSize().h }, 'font_ink', 'center');
				}
			} else if (sw) {
				placeY(autoSwFeat, pad + innerW - 72, y + (rowH - 36) / 2);
				autoSwFeat.scale.set(36 / autoSwFeat.H);
				autoSwFeat.set(sw.classList.contains('on'));
			}
			y += rowH + 6;
		});
	}

	const err = byId('autoErr');
	const errText = (err?.textContent || '').trim();
	if (errText) {
		autoErrSpr = putLabel(autoScroll, autoErrSpr, errText, { x: pad, y, w: innerW, h: 28 }, 'font_ink', 'left');
		if (autoErrSpr) autoErrSpr.visible = true;
		y += 30;
	} else if (autoErrSpr) autoErrSpr.visible = false;

	const contentH = y + 8;
	const maxS = Math.max(0, contentH - bodyH);
	autoScrollY = Math.max(0, Math.min(maxS, autoScrollY));
	for (const ch of autoScroll.children) {
		if (ch === autoScrollMask) continue;
		if ((ch as any)._layY == null) (ch as any)._layY = ch.y;
		ch.y = (ch as any)._layY - autoScrollY;
	}

	if (autoStartBtn) {
		putAt(autoStartBtn, { x: r.x + pad, y: startY, w: innerW, h: startH });
		resetBg(autoStartBtn, 'btn_go', innerW, startH, 2);
		autoStartBtn.hitArea = new Rectangle(0, 0, innerW, startH);
		const wr = { x: innerW * 0.18, y: startH * 0.18, w: innerW * 0.64, h: startH * 0.64 };
		autoStartLab = putWord(autoStartBtn, autoStartLab, 'w_start', wr) || putLabel(autoStartBtn, autoStartLab, (byId('autoStart')?.textContent || 'START').trim(), { x: 0, y: 0, w: innerW, h: startH }, 'font_cream', 'center');
	}
}

// ---------- game info (rules + paytable) ----------
let infoUi: ModalUi;
let rulesScroll: RulesScroll | null = null;

function syncInfo() {
	const info = syncModalChrome(infoUi, null, 'GAME INFO', { title: false });
	if (!info) {
		if (rulesScroll) rulesScroll.visible = false;
		return;
	}
	if (!rulesScroll) {
		rulesScroll = makeRulesScroll();
		infoUi.body.addChild(rulesScroll);
	}
	rulesScroll.visible = true;
	const r = info.r;
	const title = byId('rulesTitle');
	const tr = rec(title) || { x: r.x + 20, y: r.y + 10, w: r.w - 80, h: 32 };
	infoUi.titleSpr = putLabel(infoUi.root, infoUi.titleSpr, (title?.textContent || 'GAME INFO').trim(), tr, 'font_ink', 'left');
	if (infoUi.titleSpr) infoUi.titleSpr.visible = true;
	const top = Math.max(tr.y + tr.h, r.y + 44) + 6;
	rulesScroll.position.set(r.x + 16, top);
	rulesScroll.layout(r.w - 32, Math.max(80, r.y + r.h - 16 - top));
	const body = byId('rulesBody');
	rulesScroll.setHtml(body?.innerHTML || '');
}

function syncPanels() {
	syncPop();
	syncSettings();
	syncAuto();
	syncInfo();
	const cover = overlayShown('settings') || overlayShown('menu') || overlayShown('autoMenu');
	hudLayer.visible = !cover;
	relaxUiTier();
	return true;
}

let built = false;

export async function initPanels() {
	if (built) return;
	built = true;
	menuLayer.zIndex = 3;
	popCatch = modalDimTex ? new Sprite(modalDimTex) : new Sprite();
	popCatch.alpha = 0.001;
	popCatch.visible = false;
	popCatch.eventMode = 'static';
	popCatch.on('pointertap', (e) => { e.stopPropagation(); closePop(); });
	popRoot = new Container();
	popRoot.visible = false;
	popPlate = new Container();
	popPlate.eventMode = 'none';
	popRows = new Container();
	popSlide = new Container();
	popSlide.visible = false;
	popSlidePlate = new Container();
	popSlidePlate.eventMode = 'none';
	popSlider = makeSlider((v) => {
		const open = document.querySelector<HTMLElement>('#popMenu .pmItem.open');
		const input = open?.querySelector<HTMLInputElement>('input');
		if (!input) return;
		input.value = String(Math.round(v * 100));
		input.dispatchEvent(new Event('input', { bubbles: true }));
	});
	popSlide.addChild(popSlidePlate, popSlider);
	popRoot.addChild(popPlate, popRows, popSlide);
	menuLayer.addChild(popCatch, popRoot);

	setUi = makeModal('settings');
	autoUi = makeModal('autoMenu');
	infoUi = makeModal('menu');

	uiScreen.sortableChildren = true;
	hudLayer.zIndex = 0;
	menuLayer.zIndex = 10;
	uiScreen.addChild(menuLayer);
	document.body.classList.add('pixiPanels');
	animateUi(() => syncPanels());
	onUiLayout(() => { syncPanels(); kickUi(); });
	let q = 0;
	const poke = () => { if (!q) q = requestAnimationFrame(() => { q = 0; syncPanels(); kickUi(); }); };
	const obs = new MutationObserver(poke);
	for (const id of ['popMenu', 'settings', 'autoMenu', 'menu']) {
		const el = byId(id);
		if (el) obs.observe(el, { attributes: true, childList: true, characterData: true, subtree: true, attributeFilter: ['class', 'aria-checked', 'aria-expanded', 'aria-hidden'] });
	}
	addEventListener('elfhaus:audio', poke);
	syncPanels();
	kickUi();
}
