// Win banners, feature totals, toasts, popups and count-up typography on the Pixi UI stage.
// Timing, skip, audio and count math stay in the existing DOM functions (ui.ts, maxwin.ts,
// bookEventHandlerMap.ts). This layer copies live boxes and text each frame and hides the
// painted DOM chrome. Elf canvases and the max-win title sheet stay in the DOM (under the
// typography, over the dim) so their sprite.ts / ElfRig motion is unchanged.
import { Assets, Container, Sprite, Texture } from 'pixi.js';
import { gsap } from 'gsap';
import { poseOf } from '../board/motion';
import { nine } from '../scene/atlas';
import { animateUi, kickUi, onUiLayout, setUiTier, uiInteractive, uiScreen, viewH, viewW } from './stage';
import { bmFit, setBm, typeRow, wordSpr, fitSpr } from './text';
import { modalDimTex, nineUi } from './widgets';
import { hudLayer } from './hud';
import { ensureElfFx } from './winelves';
import { ART, S, wait } from '../ui';
import { ST } from '../stage';

export const winsLayer = new Container();
winsLayer.label = 'uiWins';
winsLayer.eventMode = 'passive';
winsLayer.sortableChildren = true;

const $ = (sel: string) => document.querySelector<HTMLElement>(sel);
const shown = (el: HTMLElement | null) => !!el && !el.classList.contains('hidden');

function rect(el: Element | null) {
	if (!el) return null;
	const r = el.getBoundingClientRect();
	if (!r.width && !r.height) return null;
	return { x: r.x, y: r.y, w: r.width, h: r.height };
}

function opacityOf(el: HTMLElement | null) {
	if (!el) return 0;
	return baseOpacity(el) * (poseOf(el)?.op ?? 1);
}
function baseOpacity(el: HTMLElement) {
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

type Box = { x: number; y: number; w: number; h: number };
function winBoxes() {
	const cx = viewW / 2;
	return {
		title: { x: viewW * 0.08, y: viewH * 0.16, w: viewW * 0.84, h: Math.max(48, viewH * 0.12) },
		amt: { x: viewW * 0.08, y: viewH * 0.40, w: viewW * 0.84, h: Math.max(52, viewH * 0.14) },
		x: { x: cx - 60, y: viewH * 0.56, w: 120, h: 32 },
		hint: { x: viewW * 0.12, y: viewH * 0.86, w: viewW * 0.76, h: 28 },
		card: { x: viewW * 0.08, y: viewH * 0.22, w: viewW * 0.84, h: Math.min(viewH * 0.56, 420) },
	};
}


/** Place a Pixi container on its state host's box; the host's motion pose (board/motion playMotion) scales it about the box centre. */
function placeIn(c: Container, r: Box, el?: HTMLElement | null) {
	const p = el ? poseOf(el) : null;
	if (p && (p.sx !== 1 || p.sy !== 1 || p.tx || p.ty)) {
		const ox = r.w * (Number.isNaN(p.ox) ? 0.5 : p.ox), oy = r.h * (Number.isNaN(p.oy) ? 0.5 : p.oy);
		c.pivot.set(ox, oy);
		c.position.set(r.x + ox + p.tx * r.w + p.px, r.y + oy + p.ty * r.h + p.py);
		c.scale.set(p.sx, p.sy);
	} else {
		c.pivot.set(0, 0);
		c.scale.set(1, 1);
		c.position.set(r.x, r.y);
	}
	c.visible = true;
}

function fitWord(name: string, w: number, h: number) {
	try {
		const s = wordSpr(name);
		fitSpr(s, w, h);
		s.eventMode = 'none';
		return s;
	} catch {
		return null;
	}
}

function setType(parent: Container, prev: Container | null, text: string, r: Box, label?: string) {
	if (prev && prev.parent) prev.parent.removeChild(prev);
	if (!text) return null;
	const row = typeRow(text, Math.max(8, r.w), Math.max(8, r.h));
	row.eventMode = 'none';
	row.position.set(r.w / 2, r.h / 2);
	if (label) row.label = label;
	parent.addChild(row);
	return row;
}


/** Visible box for a titleType element (prefer the glyph row). Fall back to font-size inside the card. */
function glyphBox(el: HTMLElement | null, cardR: Box, fallbackY: number, fallbackH: number): Box | null {
	if (!el) return null;
	const row = el.querySelector('.tgRow') as HTMLElement | null;
	const r = rect(row) || rect(el);
	const fs = parseFloat(getComputedStyle(el).fontSize) || fallbackH;
	const h = Math.max(fallbackH, fs);
	if (r && r.w >= 8 && r.h >= 8) return r;
	return { x: cardR.x + 24, y: cardR.y + fallbackY, w: Math.max(8, cardR.w - 48), h };
}

function putType(card: Container, prev: Container | null, text: string, local: Box, cardR: Box, abs: Box, label?: string) {
	let row = prev;
	if (!row) row = setType(card, prev, text, local, label);
	else if (row.parent !== card) card.addChild(row);
	if (!row) return null;
	row.position.set(abs.x - cardR.x + abs.w / 2, abs.y - cardR.y + abs.h / 2);
	const tw = Math.max(1, row.pivot.x * 2 || 1);
	const th = Math.max(1, row.pivot.y * 2 || 1);
	row.scale.set(Math.min(abs.w / tw, abs.h / th));
	return row;
}


let built = false;
let toastRoot: Container, toastBg: Container, toastTxt: Sprite | null = null, toastSub: Sprite | null = null;
let bannerRoot: Container, bannerBg: Container, bannerTxt: Sprite | null = null;
let bigRoot: Container, bigTitle: Container, bigGhost: Container, bigAmt: Container, bigChip: Container;
let bigTitleSpr: Sprite | null = null, bigGhostSpr: Sprite | null = null, bigAmtSpr: Sprite | null = null, bigXSpr: Sprite | null = null;
let lastBwTitle = '', lastBwAmt = '', lastBwX = '', lastBwGhost = '';
let maxRoot: Container, maxTitle: Sprite, maxAmtBox: Container, maxXSpr: Sprite | null = null, maxAmtSpr: Sprite | null = null, maxHint: Container | null = null;
let lastMwX = '', lastMwAmt = '', lastMwHint = '';
let outroRoot: Container, outroDim: Sprite | null = null, outroCard: Container, outroTitle: Container | null = null, outroAmt: Container | null = null, outroHint: Container | null = null;
let lastOtAmt = '', lastOtHint = '';
let fsRoot: Container, fsDim: Sprite | null = null, fsCard: Container, fsBig: Container | null = null, fsSub: Container | null = null;
let lastFsBig = '', lastFsSub = '';
let flipRoot: Container, flipDim: Sprite | null = null, flipCard: Sprite, flipName: Sprite | null = null;
let flyRoot: Container;
const flySpr = new Map<HTMLElement, Container>();
let lastFlipFront = '', lastFlipBack = '', lastFlipName = '';
let msgRoot: Container, msgDim: Sprite | null = null, msgCard: Container, msgTitleSpr: Sprite | null = null, msgBodySpr: Sprite | null = null, msgBtn: Container, msgBtnLab: Sprite | null = null;

const WIN_IDS = ['bigwin', 'maxwin', 'outro', 'fsMore', 'cardFlip', 'msg', 'resumeCard'] as const;
const MODAL_IDS = ['buyMenu', 'bmConfirm', 'intro', ...WIN_IDS] as const;

function idShown(id: string) {
	const el = document.getElementById(id);
	return !!el && !el.classList.contains('hidden');
}

export function winsVisible() {
	return WIN_IDS.some(idShown);
}

/** Raise or lower the UI canvas without stealing taps meant for the DOM overlay hosts. */
export function relaxUiTier() {
	const pop = document.getElementById('popMenu')?.classList.contains('open');
	const panel = ['settings', 'menu', 'autoMenu'].some(idShown);
	const modal = MODAL_IDS.some(idShown) || !!pop || panel;
	if (modal) {
		setUiTier('modal');
		const hits = idShown('buyMenu') || idShown('bmConfirm') || idShown('intro') || idShown('settings') || idShown('menu') || idShown('autoMenu') || !!pop;
		uiInteractive(hits);
	} else {
		uiInteractive(false);
		setUiTier('hud');
	}
}

function nineAt(name: string, w: number, h: number, k = 2) {
	const s = nine('ui', name, Math.max(8, w), Math.max(8, h), k);
	s.eventMode = 'none';
	return s;
}

function makeDim() {
	if (!modalDimTex) return null;
	const s = new Sprite(modalDimTex);
	s.eventMode = 'none';
	s.visible = false;
	s.alpha = 0;
	const fit = () => { s.position.set(0, 0); s.width = viewW; s.height = viewH; };
	fit();
	onUiLayout(fit);
	return s;
}

const boxKey = new WeakMap<Container, string>();

function resetBg(c: Container, name: string, w: number, h: number, k = 2) {
	const key = `${name}:${Math.round(w)}x${Math.round(h)}:${k}`;
	if (boxKey.get(c) === key && c.children.length) return;
	const keep: Container[] = [];
	for (const ch of c.children.slice()) {
		if ((ch as Container).label === "uiPlate") { c.removeChild(ch); continue; }
		keep.push(ch as Container);
	}
	const plate = nineAt(name, w, h, k);
	plate.label = "uiPlate";
	c.addChildAt(plate, 0);
	for (const ch of keep) if (ch.parent !== c) c.addChild(ch);
	boxKey.set(c, key);
}

function ensure() {
	if (built) return;
	winsLayer.zIndex = 2;

	toastRoot = new Container(); toastRoot.label = 'uiToast'; toastRoot.zIndex = 1; toastRoot.visible = false;
	toastBg = new Container(); toastBg.eventMode = 'none'; toastRoot.addChild(toastBg);
	bannerRoot = new Container(); bannerRoot.label = 'uiBanner'; bannerRoot.zIndex = 2; bannerRoot.visible = false;
	bannerBg = new Container(); bannerBg.eventMode = 'none'; bannerRoot.addChild(bannerBg);

	bigRoot = new Container(); bigRoot.label = 'uiBigWin'; bigRoot.zIndex = 8; bigRoot.visible = false; bigRoot.eventMode = 'none';
	bigTitle = new Container(); bigGhost = new Container(); bigAmt = new Container(); bigChip = new Container();
	bigTitle.eventMode = 'none'; bigGhost.eventMode = 'none'; bigAmt.eventMode = 'none'; bigChip.eventMode = 'none';
	bigRoot.addChild(bigGhost, bigTitle, bigAmt, bigChip);

	maxRoot = new Container(); maxRoot.label = 'uiMaxWin'; maxRoot.zIndex = 9; maxRoot.visible = false; maxRoot.eventMode = 'none';
	maxTitle = new Sprite(Texture.EMPTY); maxTitle.anchor.set(0.5); maxTitle.eventMode = 'none';
	maxAmtBox = new Container(); maxAmtBox.eventMode = 'none';
	maxRoot.addChild(maxTitle, maxAmtBox);

	outroRoot = new Container(); outroRoot.label = 'uiOutro'; outroRoot.zIndex = 6; outroRoot.visible = false; outroRoot.eventMode = 'none';
	outroCard = new Container(); outroCard.label = 'uiPanel'; outroCard.eventMode = 'none';
	outroRoot.addChild(outroCard);

	fsRoot = new Container(); fsRoot.label = 'uiFsMore'; fsRoot.zIndex = 5; fsRoot.visible = false; fsRoot.eventMode = 'none';
	fsCard = new Container(); fsCard.label = 'uiPanel'; fsCard.eventMode = 'none';
	fsRoot.addChild(fsCard);

	flipRoot = new Container(); flipRoot.label = 'uiCardFlip'; flipRoot.zIndex = 7; flipRoot.visible = false; flipRoot.eventMode = 'none';
	flyRoot = new Container(); flyRoot.label = 'uiFly'; flyRoot.zIndex = 12; flyRoot.eventMode = 'none';
	flipCard = new Sprite(Texture.EMPTY); flipCard.anchor.set(0.5); flipCard.eventMode = 'none';
	flipRoot.addChild(flipCard);

	msgRoot = new Container(); msgRoot.label = 'uiMsg'; msgRoot.zIndex = 10; msgRoot.visible = false; msgRoot.eventMode = 'none';
	msgCard = new Container(); msgCard.label = 'uiPanel'; msgCard.eventMode = 'none';
	msgBtn = new Container(); msgBtn.eventMode = 'static'; msgBtn.cursor = 'pointer';
	msgBtn.on('pointertap', (e) => { e.stopPropagation(); document.getElementById('msgOk')?.click(); });
	msgRoot.addChild(msgCard);

	resumeRoot = new Container(); resumeRoot.label = 'uiResume'; resumeRoot.zIndex = 11; resumeRoot.visible = false;
	resumeCardC = new Container(); resumeCardC.label = 'uiPanel'; resumeCardC.eventMode = 'none';
	resumeBtnR = new Container(); resumeBtnS = new Container();
	resumeBtnR.eventMode = 'static'; resumeBtnR.cursor = 'pointer';
	resumeBtnS.eventMode = 'static'; resumeBtnS.cursor = 'pointer';
	resumeBtnR.on('pointertap', (e) => { e.stopPropagation(); document.getElementById('rcResume')?.click(); });
	resumeBtnS.on('pointertap', (e) => { e.stopPropagation(); document.getElementById('rcSkip')?.click(); });
	resumeRoot.addChild(resumeCardC, resumeBtnR, resumeBtnS);

	replayRoot = new Container(); replayRoot.label = 'uiReplay'; replayRoot.zIndex = 4; replayRoot.visible = false;
	replayBg = new Container(); replayBg.eventMode = 'none';
	replayBtn = new Container(); replayBtn.eventMode = 'static'; replayBtn.cursor = 'pointer';
	replayBtn.on('pointertap', (e) => { e.stopPropagation(); document.getElementById('replayPlay')?.click(); });
	replayRoot.addChild(replayBg, replayBtn);

	winsLayer.addChild(toastRoot, bannerRoot, fsRoot, outroRoot, flipRoot, bigRoot, maxRoot, msgRoot, resumeRoot, replayRoot, flyRoot);
	uiScreen.addChild(winsLayer);
	built = true;
	onUiLayout(() => { syncWins(); kickUi(); });
	watchDom();
	animateUi(() => { syncWins(); return true; });
}

function watchDom() {
	const ids = ['banner', 'stepToast', 'bigwin', 'maxwin', 'outro', 'fsMore', 'cardFlip', 'msg', 'resumeCard', 'replayBar'];
	const obs = new MutationObserver(() => { syncWins(); kickUi(); });
	for (const id of ids) {
		const el = document.getElementById(id);
		if (!el) continue;
		obs.observe(el, { attributes: true, childList: true, characterData: true, subtree: true, attributeFilter: ['class', 'style', 'data-tier', 'data-max', 'data-waiting'] });
	}
}

function syncToast(el: HTMLElement | null, root: Container, bg: Container, which: 'toast' | 'banner') {
	if (!shown(el)) {
		root.visible = false;
		return;
	}
	const boardBox = () => {
		const raw = Document.prototype.getElementById.call(document, 'board') as HTMLElement | null;
		if (!raw) return null;
		const b = HTMLElement.prototype.getBoundingClientRect.call(raw);
		if (!b.width) return null;
		if (which === 'banner') return { x: b.x + 16, y: b.y + 8, w: Math.max(80, b.width - 32), h: 36 };
		return { x: b.x + 16, y: b.y + b.height - 44, w: Math.max(80, b.width - 32), h: 40 };
	};
	const r = rect(el) || boardBox();
	if (!r) { root.visible = false; return; }
	const small = el.querySelector('small');
	const main = (el.childNodes.length && small)
		? Array.from(el.childNodes).filter((n) => n !== small).map((n) => n.textContent || '').join('').trim()
		: (el.textContent || '').trim();
	const sub = small?.textContent?.trim() || '';
	const padX = Math.max(10, r.h * 0.28), padY = Math.max(4, r.h * 0.18);
	let boxW = r.w, boxH = r.h;
	if (which === 'toast' && sub) {
		const need = padY + 18 + 4 + 14 + padY;
		if (boxH < need) boxH = need;
	}
	placeIn(root, { ...r, w: boxW, h: boxH });
	root.alpha = opacityOf(el);
	resetBg(bg, 'toast', boxW, boxH, 2);
	const mainH = sub ? Math.max(16, (boxH - padY * 2 - 4) * 0.58) : boxH - padY * 2;
	const mainBox = { x: padX, y: padY, w: boxW - padX * 2, h: Math.max(8, mainH) };
	if (which === 'banner') {
		if (bannerTxt?.label !== 'bm:' + main) bannerTxt = setBm(root, bannerTxt, bmFit(main, 'font_ink', Math.min(28, mainBox.h), mainBox.w, mainBox.h));
		if (bannerTxt) {
			bannerTxt.anchor.set(0.5, 0.5);
			bannerTxt.position.set(r.w / 2, r.h / 2);
		}
	} else {
		if (toastTxt?.label !== 'bm:' + main) toastTxt = setBm(root, toastTxt, bmFit(main, 'font_ink', Math.min(28, mainBox.h), mainBox.w, mainBox.h));
		if (toastTxt) {
			toastTxt.anchor.set(0.5, 0.5);
			toastTxt.position.set(boxW / 2, sub ? padY + mainBox.h / 2 : boxH / 2);
		}
		if (sub) {
			const subBoxH = Math.max(12, boxH - mainBox.h - padY * 2);
			if (toastSub?.label !== 'bm:' + sub) toastSub = setBm(root, toastSub, bmFit(sub, 'font_ink', Math.min(14, subBoxH), mainBox.w, subBoxH));
			if (toastSub) {
				toastSub.anchor.set(0.5, 0.5);
				toastSub.position.set(boxW / 2, padY + mainBox.h + subBoxH / 2);
			}
		} else if (toastSub) {
			toastSub = setBm(root, toastSub, null);
		}
	}
}

function titleFrame(el: HTMLElement | null) {
	const tier = (el?.dataset.tier || (el?.textContent || '').split(' ')[0] || '').toLowerCase();
	if (!tier || tier === 'label') return '';
	return 't_title_' + tier + 'win';
}

function paintTitle(host: Container, prev: Sprite | null, frame: string, r: Box) {
	if (prev && prev.parent) prev.parent.removeChild(prev);
	if (!frame) return null;
	const s = fitWord(frame, r.w, r.h);
	if (!s) return null;
	s.position.set(r.w / 2, r.h / 2);
	host.addChild(s);
	return s;
}

function syncBig() {
	const B = $('#bigwin');
	if (!shown(B)) { bigRoot.visible = false; lastBwTitle = lastBwAmt = lastBwX = lastBwGhost = ''; return; }
	bigRoot.visible = true;
	bigRoot.alpha = opacityOf(B);
	// Dim stays on the DOM overlay so elves / sunburst (z 50) sit under typography (canvas z 85).
	const T = B.querySelector<HTMLElement>('.bwTier');
	const G = B.querySelector<HTMLElement>('.bwGhost');
	const A = B.querySelector<HTMLElement>('.bwAmt');
	const X = B.querySelector<HTMLElement>('.bwX');
	const fb = winBoxes();
	const tr = rect(T) || (T ? fb.title : null), gr = rect(G), ar = rect(A) || (A ? fb.amt : null), xr = rect(X) || (X ? fb.x : null);
	if (T && tr) {
		placeIn(bigTitle, tr, T);
		bigTitle.alpha = opacityOf(T);
		const frame = titleFrame(T);
		const key = frame + '|' + (T.textContent || '');
		if (key !== lastBwTitle) {
			lastBwTitle = key;
			if (bigTitleSpr && bigTitleSpr.parent) bigTitleSpr.parent.removeChild(bigTitleSpr);
			bigTitleSpr = frame ? paintTitle(bigTitle, null, frame, { x: 0, y: 0, w: tr.w, h: tr.h }) : null;
			if (!bigTitleSpr && T.textContent) {
				const row = typeRow(T.textContent, tr.w, tr.h);
				row.position.set(tr.w / 2, tr.h / 2);
				bigTitle.addChild(row);
				bigTitleSpr = null;
			}
		} else if (bigTitleSpr) {
			fitSpr(bigTitleSpr, tr.w, tr.h);
			bigTitleSpr.position.set(tr.w / 2, tr.h / 2);
		}
	} else bigTitle.visible = false;
	if (G && gr && opacityOf(G) > 0.02) {
		placeIn(bigGhost, gr, G);
		bigGhost.alpha = opacityOf(G);
		const gFrame = titleFrame(G);
		const gKey = gFrame + '|' + (G.textContent || '');
		if (gKey !== lastBwGhost) {
			lastBwGhost = gKey;
			if (bigGhostSpr && bigGhostSpr.parent) bigGhostSpr.parent.removeChild(bigGhostSpr);
			bigGhostSpr = gFrame ? paintTitle(bigGhost, null, gFrame, { x: 0, y: 0, w: gr.w, h: gr.h }) : null;
		} else if (bigGhostSpr) {
			fitSpr(bigGhostSpr, gr.w, gr.h);
			bigGhostSpr.position.set(gr.w / 2, gr.h / 2);
		}
	} else {
		bigGhost.visible = false;
		lastBwGhost = '';
	}
	if (A && ar) {
		placeIn(bigAmt, ar, A);
		bigAmt.alpha = opacityOf(A);
		const txt = (A.textContent || '').trim();
		if (txt !== lastBwAmt) {
			lastBwAmt = txt;
			const px = Math.max(12, parseFloat(getComputedStyle(A).fontSize) || ar.h * 0.8);
			bigAmtSpr = setBm(bigAmt, bigAmtSpr, bmFit(txt, 'font_gold', px, ar.w, ar.h));
			if (bigAmtSpr) { bigAmtSpr.anchor.set(0.5, 0.5); bigAmtSpr.position.set(ar.w / 2, ar.h / 2); }
		} else if (bigAmtSpr) bigAmtSpr.position.set(ar.w / 2, ar.h / 2);
	} else bigAmt.visible = false;
	if (X) {
		let box = xr && xr.w >= 24 && xr.h >= 16 ? xr : null;
		const amtCx = ar ? ar.x + ar.w / 2 : 0;
		// Hidden typography can leave .bwX as a short inline box off to the side; sit a ticket under the amount.
		if (!box || (ar && Math.abs(box.x + box.w / 2 - amtCx) > 48)) {
			const tw = Math.max(88, ar ? Math.min(160, ar.w * 0.5) : 88), th = 32;
			box = { x: (ar ? amtCx : (X.getBoundingClientRect().x || 0)) - tw / 2, y: ar ? ar.y + ar.h + 8 : (box?.y || 0), w: tw, h: th };
		}
		placeIn(bigChip, box);
		bigChip.alpha = Math.max(opacityOf(X), 0.95);
		resetBg(bigChip, 'chip_cream', box.w, box.h, 1);
		const txt = (X.textContent || '').trim();
		if (txt !== lastBwX || !bigXSpr || bigXSpr.parent !== bigChip) {
			lastBwX = txt;
			const px = Math.max(14, Math.min(22, box.h * 0.6));
			bigXSpr = setBm(bigChip, bigXSpr, bmFit(txt, 'font_gold', px, box.w * 0.86, box.h * 0.7));
			if (bigXSpr) { bigXSpr.anchor.set(0.5, 0.5); bigXSpr.position.set(box.w / 2, box.h / 2); }
		} else if (bigXSpr) bigXSpr.position.set(box.w / 2, box.h / 2);
	} else bigChip.visible = false;
}

function syncMax() {
	const M = $('#maxwin');
	if (!shown(M) && !M?.classList.contains('on')) { maxRoot.visible = false; lastMwX = lastMwAmt = lastMwHint = ''; return; }
	if (!shown(M)) { maxRoot.visible = false; return; }
	maxRoot.visible = true;
	maxRoot.alpha = opacityOf(M);
	const tier = M.querySelector<HTMLElement>('.mwTier');
	const xEl = M.querySelector<HTMLElement>('.mwX');
	const aEl = M.querySelector<HTMLElement>('.mwAmt');
	const hint = M.querySelector<HTMLElement>('.mwHint');
	const fb = winBoxes();
	const tr = rect(tier) || (tier ? fb.title : null);
	const cv = tier?.querySelector('canvas') as HTMLCanvasElement | null;
	if (tr && cv && cv.width && cv.height) {
		if (maxTitle.texture.source.resource !== cv) {
			try { maxTitle.texture = Texture.from(cv); } catch { /* */ }
		} else {
			try { maxTitle.texture.source.update(); } catch { /* */ }
		}
		maxTitle.visible = true;
		maxTitle.position.set(tr.x + tr.w / 2, tr.y + tr.h / 2);
		maxTitle.width = tr.w;
		maxTitle.height = tr.h;
		maxTitle.alpha = opacityOf(tier || M);
	} else if (tr) {
		// Before the sheet paints, show the static packed title.
		if (maxTitle.texture === Texture.EMPTY || (maxTitle.texture.source.resource && 'tagName' in (maxTitle.texture.source.resource as object))) {
			try {
				const s = fitWord('t_title_maxwin', tr.w, tr.h);
				if (s) maxTitle.texture = s.texture;
			} catch { /* */ }
		}
		maxTitle.visible = true;
		maxTitle.position.set(tr.x + tr.w / 2, tr.y + tr.h / 2);
		maxTitle.width = tr.w;
		maxTitle.height = tr.h;
		maxTitle.alpha = opacityOf(tier || M);
	} else maxTitle.visible = false;
	if (xEl) {
		const xr = rect(xEl);
		if (xr) {
			const txt = (xEl.textContent || '').trim();
			if (txt !== lastMwX) {
				lastMwX = txt;
				const px = Math.max(16, parseFloat(getComputedStyle(xEl).fontSize) || xr.h);
				maxXSpr = setBm(maxRoot, maxXSpr, bmFit(txt, 'font_gold', px, xr.w, xr.h));
			}
			if (maxXSpr) {
				maxXSpr.anchor.set(0.5, 0.5);
				maxXSpr.position.set(xr.x + xr.w / 2, xr.y + xr.h / 2);
				maxXSpr.visible = true;
				maxXSpr.alpha = opacityOf(xEl);
			}
		}
	} else if (maxXSpr) maxXSpr.visible = false;
	if (aEl) {
		const ar = rect(aEl);
		if (ar) {
			placeIn(maxAmtBox, ar);
			resetBg(maxAmtBox, 'chip_cream', ar.w, ar.h, 2);
			const txt = (aEl.textContent || '').trim();
			if (txt !== lastMwAmt) {
				lastMwAmt = txt;
				const px = Math.max(12, parseFloat(getComputedStyle(aEl).fontSize) || ar.h * 0.7);
				maxAmtSpr = setBm(maxAmtBox, maxAmtSpr, bmFit(txt, 'font_gold', px, ar.w * 0.9, ar.h * 0.7));
				if (maxAmtSpr) { maxAmtSpr.anchor.set(0.5, 0.5); maxAmtSpr.position.set(ar.w / 2, ar.h / 2); }
			} else if (maxAmtSpr) maxAmtSpr.position.set(ar.w / 2, ar.h / 2);
			maxAmtBox.alpha = opacityOf(aEl);
		}
	} else maxAmtBox.visible = false;
	if (hint) {
		const hr = rect(hint);
		const txt = (hint.textContent || '').trim();
		const hide = !M.classList.contains('held') && opacityOf(hint) < 0.05;
		if (hr && txt && !hide) {
			if (txt !== lastMwHint) {
				lastMwHint = txt;
				if (maxHint && maxHint.parent) maxHint.parent.removeChild(maxHint);
				maxHint = typeRow(txt, hr.w, hr.h);
				maxHint.eventMode = 'none';
				maxRoot.addChild(maxHint);
			}
			if (maxHint) {
				maxHint.position.set(hr.x + hr.w / 2, hr.y + hr.h / 2);
				maxHint.visible = true;
				maxHint.alpha = opacityOf(hint);
			}
		} else if (maxHint) maxHint.visible = false;
	}
}

function syncCard(overlay: HTMLElement | null, root: Container, dim: Sprite | null, card: Container, kind: 'outro' | 'fsMore') {
	if (!shown(overlay)) {
		root.visible = false;
		if (dim) dim.visible = false;
		if (kind === 'outro') { lastOtAmt = lastOtHint = ''; outroTitle = outroAmt = outroHint = null; }
		else { lastFsBig = lastFsSub = ''; fsBig = fsSub = null; }
		return;
	}
	root.visible = true;
	if (dim) {
		dim.visible = true;
		dim.alpha = (kind === 'fsMore' ? 0.35 : 0.88) * opacityOf(overlay);
		dim.width = viewW;
		dim.height = viewH;
	}
	root.alpha = 1;
	const host = overlay.querySelector<HTMLElement>('.card');
	const r = rect(host) || winBoxes().card;
	if (!host || !r) { card.visible = false; return; }
	placeIn(card, r, host);
	card.alpha = opacityOf(host) * opacityOf(overlay);
	resetBg(card, 'sign_plate', r.w, r.h, 2);
	if (kind === 'outro') {
		const title = host.querySelector<HTMLElement>('.tierName');
		const amtSrc = host.querySelector<HTMLElement>('.otAmt');
		const amt = host.querySelector<HTMLElement>('.otAmtG, .ttTwin') || amtSrc;
		const hint = host.querySelector<HTMLElement>('.otHint');
		const tr = glyphBox(title, r, 18, 56);
		const ar = glyphBox(amt || amtSrc, r, 18 + 56 + 10, Math.max(70, r.h * 0.32));
		const hr = glyphBox(hint, r, r.h - 52, 36);
		if (title && tr) {
			const txt = (title.dataset.tt || 'TOTAL WIN').replace(/\s+/g, ' ').trim() || 'TOTAL WIN';
			outroTitle = putType(card, outroTitle, txt, { x: 0, y: 0, w: tr.w, h: tr.h }, r, tr, 'uiTitle');
		}
		if ((amt || amtSrc) && ar) {
			const txt = ((amtSrc || amt)!.textContent || '').trim();
			if (txt !== lastOtAmt || !outroAmt || outroAmt.parent !== card) {
				lastOtAmt = txt;
				outroAmt = setType(card, outroAmt, txt, { x: 0, y: 0, w: ar.w, h: Math.max(ar.h, r.h * 0.28) });
			}
			if (outroAmt) outroAmt.position.set(ar.x - r.x + ar.w / 2, ar.y - r.y + ar.h / 2);
		}
		if (hint && hr) {
			const txt = (hint.dataset.tt || hint.textContent || '').trim() || 'TAP TO CONTINUE';
			if (txt !== lastOtHint || !outroHint || outroHint.parent !== card) {
				lastOtHint = txt;
				outroHint = setType(card, outroHint, txt, { x: 0, y: 0, w: hr.w, h: hr.h });
			}
			if (outroHint) {
				outroHint.position.set(hr.x - r.x + hr.w / 2, hr.y - r.y + hr.h / 2);
				outroHint.alpha = overlay.classList.contains('landed') ? 1 : opacityOf(hint);
			}
		}
	} else {
		const big = host.querySelector<HTMLElement>('.fmBig');
		const sub = host.querySelector<HTMLElement>('.fmSub');
		const br = glyphBox(big, r, 12, 80);
		const sr = glyphBox(sub, r, r.h - 64, 40);
		if (big && br) {
			const txt = (big.dataset.tt || big.textContent || '').trim();
			if (txt !== lastFsBig || !fsBig || fsBig.parent !== card) {
				lastFsBig = txt;
				fsBig = setType(card, fsBig, txt, { x: 0, y: 0, w: br.w, h: br.h }, 'uiTitle');
			}
			if (fsBig) fsBig.position.set(br.x - r.x + br.w / 2, br.y - r.y + br.h / 2);
		}
		if (sub && sr) {
			const txt = (sub.dataset.tt || sub.textContent || 'FREE SPINS').trim();
			if (txt !== lastFsSub || !fsSub || fsSub.parent !== card) {
				lastFsSub = txt;
				fsSub = setType(card, fsSub, txt, { x: 0, y: 0, w: sr.w, h: sr.h });
			}
			if (fsSub) fsSub.position.set(sr.x - r.x + sr.w / 2, sr.y - r.y + sr.h / 2);
		}
	}
}

function syncFlip() {
	if (flipDrive) return;
	const O = $('#cardFlip');
	if (!shown(O)) { flipRoot.visible = false; if (flipDim) flipDim.visible = false; return; }
	flipRoot.visible = true;
	if (flipDim) {
		flipDim.visible = true;
		flipDim.alpha = 0.88 * opacityOf(O);
	}
	flipRoot.alpha = opacityOf(O);
	const pass = O.querySelector<HTMLElement>('.cpPass') || O.querySelector<HTMLElement>('.cfCard');
	const pr = rect(pass);
	const front = O.querySelector<HTMLImageElement>('.cpFront img');
	const back = O.querySelector<HTMLImageElement>('.cpBack img');
	// Which face: matrix3d m11 (cos of rotateY) < 0 means the back is toward us.
	let backOn = false;
	const xf = pass ? getComputedStyle(pass).transform : '';
	if (xf.startsWith('matrix3d')) {
		const m = xf.slice(9, -1).split(',').map(Number);
		backOn = m[0] < 0;
	} else if (O.querySelector('.cpPass')) {
		// 2d fallback: very narrow width near the midpoint of the turn also flips later
		backOn = !!O.querySelector('.cfName.pop');
	}
	const src = (backOn ? back : front)?.currentSrc || (backOn ? back : front)?.src || '';
	if (src && src !== (backOn ? lastFlipBack : lastFlipFront)) {
		if (backOn) lastFlipBack = src; else lastFlipFront = src;
		try { flipCard.texture = Texture.from(src); } catch { /* */ }
	}
	if (pr) {
		flipCard.visible = true;
		flipCard.position.set(pr.x + pr.w / 2, pr.y + pr.h / 2);
		const tw = Math.max(1, flipCard.texture.width), th = Math.max(1, flipCard.texture.height);
		const k = Math.min(pr.w / tw, pr.h / th);
		flipCard.scale.set((backOn ? -1 : 1) * k, k);
		flipCard.alpha = opacityOf(pass || O);
	} else flipCard.visible = false;
	const name = O.querySelector<HTMLElement>('.cfName');
	const img = name?.querySelector('img.tTitle') as HTMLImageElement | null;
	const nr = rect(name);
	if (name && nr && name.classList.contains('pop') && img?.src) {
		if (img.src !== lastFlipName) {
			lastFlipName = img.src;
			if (flipName && flipName.parent) flipName.parent.removeChild(flipName);
			flipName = new Sprite(Texture.from(img.src));
			flipName.anchor.set(0.5);
			flipName.eventMode = 'none';
			flipRoot.addChild(flipName);
		}
		if (flipName) {
			flipName.visible = true;
			fitSpr(flipName, nr.w, nr.h);
			flipName.position.set(nr.x + nr.w / 2, nr.y + nr.h / 2);
			flipName.alpha = opacityOf(name);
		}
	} else if (flipName) flipName.visible = false;
}

function syncMsg() {
	const M = $('#msg');
	if (!shown(M)) { msgRoot.visible = false; if (msgDim) msgDim.visible = false; lastMsg = ''; return; }
	msgRoot.visible = true;
	if (msgDim) { msgDim.visible = true; msgDim.alpha = 0.88; }
	const modal = M.querySelector<HTMLElement>('.modal') || M;
	const r = rect(modal) || winBoxes().card;
	if (!r) { msgCard.visible = false; return; }
	placeIn(msgCard, r);
	resetBg(msgCard, 'plate_cream', r.w, r.h, 2);
	const title = $('#msgTitle'), body = $('#msgBody'), ok = $('#msgOk');
	const tr = rect(title), br = rect(body), kr = rect(ok);
	const key = [title?.textContent, body?.textContent, ok?.textContent, r.w, r.h].join('|');
	if (key !== lastMsg) {
		lastMsg = key;
		if (title && tr) {
			const px = Math.max(16, parseFloat(getComputedStyle(title).fontSize) || 22);
			msgTitleSpr = setBm(msgCard, msgTitleSpr, bmFit((title.textContent || '').trim(), 'font_cream', px, tr.w, tr.h));
			if (msgTitleSpr) { msgTitleSpr.anchor.set(0.5, 0.5); msgTitleSpr.position.set(tr.x - r.x + tr.w / 2, tr.y - r.y + tr.h / 2); msgTitleSpr.label = 'uiTitle'; }
		}
		if (body && br) {
			const px = Math.max(13, parseFloat(getComputedStyle(body).fontSize) || 15);
			msgBodySpr = setBm(msgCard, msgBodySpr, bmFit((body.textContent || '').trim(), 'font_ink', px, br.w, br.h));
			if (msgBodySpr) { msgBodySpr.anchor.set(0.5, 0); msgBodySpr.position.set(br.x - r.x + br.w / 2, br.y - r.y); }
		}
	} else {
		if (msgTitleSpr && tr) msgTitleSpr.position.set(tr.x - r.x + tr.w / 2, tr.y - r.y + tr.h / 2);
		if (msgBodySpr && br) msgBodySpr.position.set(br.x - r.x + br.w / 2, br.y - r.y);
	}
	if (ok && kr) {
		if (!msgBtn.parent) msgCard.addChild(msgBtn);
		msgBtn.position.set(kr.x - r.x, kr.y - r.y);
		msgBtn.removeChildren();
		try { msgBtn.addChild(nineUi('btn_pine', kr.w, kr.h, 2)); } catch { msgBtn.addChild(nineAt('btn_pine', kr.w, kr.h, 2)); }
		const lab = bmFit((ok.textContent || 'OK').trim(), 'font_cream', Math.min(22, kr.h * 0.45), kr.w * 0.8, kr.h * 0.55);
		if (lab) { lab.anchor.set(0.5, 0.5); lab.position.set(kr.w / 2, kr.h / 2); lab.eventMode = 'none'; msgBtn.addChild(lab); }
	}
}

let lastMsg = '';
let resumeRoot: Container, resumeCardC: Container, resumeBtnR: Container, resumeBtnS: Container;
let resumeTitle: Sprite | null = null, resumeLine: Sprite | null = null, resumeLabR: Sprite | null = null, resumeLabS: Sprite | null = null;
let replayRoot: Container, replayBg: Container, replayBtn: Container;
let replayLab: Sprite | null = null, replayPlayLab: Sprite | null = null;

let lastTier = false;


function syncFlyGems() {
	if (!flyRoot) return false;
	const layer = document.getElementById('flyLayer');
	const live = new Set<HTMLElement>();
	if (layer) for (const c of layer.querySelectorAll<HTMLElement>('.fly')) {
		live.add(c);
		let spr = flySpr.get(c);
		const txt = (c.textContent || '').replace(/\s+/g, ' ').trim();
		if (!spr) {
			const r = c.getBoundingClientRect();
			spr = typeRow(txt || 'x', Math.max(16, r.width || 48), Math.max(12, r.height || 24));
			spr.eventMode = 'none';
			flyRoot.addChild(spr);
			flySpr.set(c, spr);
		}
		const r = c.getBoundingClientRect();
		spr.visible = true;
		const fp = poseOf(c), sk = ST.s || 1;
		spr.position.set(r.x + r.width / 2 + (fp ? (fp.tx * r.width + fp.px * sk) : 0), r.y + r.height / 2 + (fp ? (fp.ty * r.height + fp.py * sk) : 0));
		spr.alpha = Math.max(0, Math.min(1, parseFloat(c.style.opacity || '') || opacityOf(c)));
		if (fp) spr.scale.set(fp.sx, fp.sy);
		else try {
			const xf = getComputedStyle(c).transform;
			if (xf.startsWith('matrix(')) {
				const m = xf.slice(7, -1).split(',').map(Number);
				const sc = Math.hypot(m[0], m[1]) || 1;
				spr.scale.set(sc);
			} else if (xf.startsWith('matrix3d(')) {
				const m = xf.slice(9, -1).split(',').map(Number);
				const sc = Math.hypot(m[0], m[1]) || 1;
				spr.scale.set(sc);
			}
		} catch { /* */ }
	}
	for (const [el, spr] of [...flySpr]) {
		if (live.has(el)) continue;
		if (spr.parent) spr.parent.removeChild(spr);
		flySpr.delete(el);
	}
	flyRoot.visible = live.size > 0;
	return live.size > 0;
}

function syncWins() {
	if (!built) return false;
	syncToast($('#stepToast'), toastRoot, toastBg, 'toast');
	syncToast($('#banner'), bannerRoot, bannerBg, 'banner');
	syncBig();
	syncMax();
	syncCard($('#outro'), outroRoot, outroDim, outroCard, 'outro');
	syncCard($('#fsMore'), fsRoot, fsDim, fsCard, 'fsMore');
	syncFlip();
	syncMsg();
	syncResume();
	syncReplay();
	const flying = syncFlyGems();
	const modal = winsVisible();
	if (modal !== lastTier) { lastTier = modal; relaxUiTier(); }
	const cover = idShown('bigwin') || idShown('maxwin') || idShown('outro') || idShown('fsMore') || idShown('cardFlip') || idShown('msg');
	hudLayer.visible = !cover;
	return modal || flying || shown($('#banner')) || shown($('#stepToast'));
}


function syncResume() {
	const R = document.getElementById('resumeCard') as HTMLElement | null;
	if (!shown(R)) { resumeRoot.visible = false; return; }
	resumeRoot.visible = true;
	const r = rect(R.querySelector('.modal')) || winBoxes().card;
	placeIn(resumeCardC, r);
	resetBg(resumeCardC, 'plate_cream', r.w, r.h, 2);
	const title = document.getElementById('rcTitle');
	const line = document.getElementById('rcLine');
	const a = document.getElementById('rcResume');
	const b = document.getElementById('rcSkip');
	const tw = r.w - 40, th = 32;
	resumeTitle = setBm(resumeCardC, resumeTitle, bmFit((title?.textContent || '').trim() || 'RESUME', 'font_cream', 22, tw, th));
	if (resumeTitle) { resumeTitle.anchor.set(0.5, 0.5); resumeTitle.position.set(r.w / 2, 36); }
	const linePx = Math.max(15, 10 / Math.max(0.2, parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s') || '1') * parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tbm') || '1'))); // min ~10 screen px on landscape phones
	resumeLine = setBm(resumeCardC, resumeLine, bmFit((line?.textContent || '').trim(), 'font_ink', linePx, tw, 48));
	if (resumeLine) { resumeLine.anchor.set(0.5, 0); resumeLine.position.set(r.w / 2, 58); }
	const bw = Math.min(160, (r.w - 48) / 2), bh = 44, by = r.h - 24 - bh;
	placeIn(resumeBtnR, { x: r.x + 16, y: r.y + by, w: bw, h: bh });
	placeIn(resumeBtnS, { x: r.x + r.w - 16 - bw, y: r.y + by, w: bw, h: bh });
	resetBg(resumeBtnR, 'btn_go', bw, bh, 2);
	resetBg(resumeBtnS, 'btn_pine', bw, bh, 2);
	resumeLabR = setBm(resumeBtnR, resumeLabR, bmFit((a?.textContent || 'RESUME').trim(), 'font_cream', 16, bw * 0.9, bh * 0.6));
	if (resumeLabR) { resumeLabR.anchor.set(0.5, 0.5); resumeLabR.position.set(bw / 2, bh / 2); }
	resumeLabS = setBm(resumeBtnS, resumeLabS, bmFit((b?.textContent || 'SKIP').trim(), 'font_cream', 16, bw * 0.9, bh * 0.6));
	if (resumeLabS) { resumeLabS.anchor.set(0.5, 0.5); resumeLabS.position.set(bw / 2, bh / 2); }
}

function syncReplay() {
	const R = document.getElementById('replayBar') as HTMLElement | null;
	if (!shown(R)) { replayRoot.visible = false; return; }
	const r = rect(R) || { x: 8, y: 8, w: Math.min(viewW - 16, 360), h: 36 };
	replayRoot.visible = true;
	placeIn(replayRoot, r);
	resetBg(replayBg, 'toast', r.w, r.h, 2);
	const mode = document.getElementById('replayMode');
	const pre = (R.querySelector('.rpPre')?.textContent || 'REPLAY · ') + (mode?.textContent || '');
	replayLab = setBm(replayRoot, replayLab, bmFit(pre.trim(), 'font_ink', 14, r.w * 0.62, r.h * 0.7));
	if (replayLab) { replayLab.anchor.set(0, 0.5); replayLab.position.set(10, r.h / 2); }
	const btn = document.getElementById('replayPlay');
	const bw = Math.min(90, r.w * 0.28), bh = r.h - 8;
	placeIn(replayBtn, { x: r.x + r.w - bw - 6, y: r.y + 4, w: bw, h: bh });
	// replayBtn is child of replayRoot, so local coords:
	replayBtn.position.set(r.w - bw - 6, 4);
	resetBg(replayBtn, 'btn_go', bw, bh, 2);
	replayPlayLab = setBm(replayBtn, replayPlayLab, bmFit((btn?.textContent || 'PLAY').trim(), 'font_cream', 14, bw * 0.9, bh * 0.7));
	if (replayPlayLab) { replayPlayLab.anchor.set(0.5, 0.5); replayPlayLab.position.set(bw / 2, bh / 2); }
}

export async function initWins() {
	ensure();
	if (!outroDim) { outroDim = makeDim(); if (outroDim) outroRoot.addChildAt(outroDim, 0); }
	if (!fsDim) { fsDim = makeDim(); if (fsDim) fsRoot.addChildAt(fsDim, 0); }
	if (!flipDim) { flipDim = makeDim(); if (flipDim) flipRoot.addChildAt(flipDim, 0); }
	if (!msgDim) { msgDim = makeDim(); if (msgDim) msgRoot.addChildAt(msgDim, 0); }
	document.body.classList.add('pixiWins');
	ensureElfFx();
	kickUi();
	return true;
}

export const winsOpen = winsVisible;


let flipDrive = false;
const FLIP_BACK: Record<'triple_dare' | 'hidden', string> = {
	triple_dare: 'assets/stacks/still/WM3_R2-4.webp',
	hidden: 'assets/stacks/still/WM5_R1-5.webp',
};
const FLIP_TITLE: Record<'triple_dare' | 'hidden', string> = {
	triple_dare: 't_bonus_doubleblack',
	hidden: 't_bonus_powder',
};

async function loadTex(src: string) {
	if (!src) return Texture.EMPTY;
	try {
		const t = await Assets.load(src);
		return t instanceof Texture ? t : Texture.from(src);
	} catch {
		try { return Texture.from(src); } catch { return Texture.EMPTY; }
	}
}

/** Pixi-only ski-pass flip. Same timings as the previous presentation; skip holds after the turn. */
export async function playCardFlip(result: 'triple_dare' | 'hidden') {
	ensure();
	const O = document.getElementById('cardFlip') as HTMLElement;
	O.dataset.tier = result;
	O.classList.remove('hidden', 'out');
	flipDrive = true;
	setUiTier('modal');
	uiInteractive(true);
	flipRoot.visible = true;
	flipRoot.alpha = 1;
	flipRoot.eventMode = 'static';
	flipRoot.cursor = 'pointer';
	if (flipDim) { flipDim.visible = true; flipDim.alpha = 0.88; flipDim.eventMode = 'static'; flipDim.cursor = 'pointer'; }

	const front = await loadTex(String(ART.S || ''));
	const back = await loadTex(FLIP_BACK[result]);
	flipCard.texture = front;
	flipCard.visible = true;
	if (flipName) flipName.visible = false;

	const cell = Math.min(viewW, viewH) * 0.18;
	const cw = cell * 2.4, ch = cw * (320 / 240);
	const cx = viewW / 2, cy = viewH * 0.46;
	const fitK = (tex: Texture) => Math.min(cw / Math.max(1, tex.width), ch / Math.max(1, tex.height));
	let baseK = fitK(front);
	const st = { y: cy + ch * 0.45, sx: baseK * 0.6, sy: baseK * 0.6, rot: 0, flip: 0, a: 0 };
	const apply = () => {
		const mid = st.flip;
		const backOn = mid >= 0.5;
		const tex = backOn ? back : front;
		if (flipCard.texture !== tex) { flipCard.texture = tex; baseK = fitK(tex); }
		const squashX = Math.max(0.05, Math.abs(Math.cos(mid * Math.PI)));
		const bump = 1 + 0.12 * Math.sin(mid * Math.PI);
		flipCard.position.set(cx, st.y);
		flipCard.scale.set((backOn ? -1 : 1) * Math.abs(st.sx) * squashX * bump, st.sy * bump);
		flipCard.rotation = st.rot * Math.PI / 180;
		flipCard.alpha = st.a;
		kickUi();
	};
	apply();

	let skip = () => {};
	const tapped = new Promise<void>((r) => { skip = r; });
	O.onclick = () => skip();
	const onPtr = () => skip();
	flipRoot.on('pointertap', onPtr);

	const k = S.turbo ? 0.45 : 1;
	await gsap.to(st, { a: 1, y: cy - ch * 0.04, sx: baseK * 1.06, sy: baseK * 0.94, duration: 0.36 * k * 0.7, ease: 'power2.out', onUpdate: apply });
	await gsap.to(st, { y: cy, sx: baseK, sy: baseK, duration: 0.36 * k * 0.3, ease: 'power2.inOut', onUpdate: apply });
	await wait(S.turbo ? 80 : 260);
	await gsap.to(st, { sx: baseK * 1.04, sy: baseK * 0.95, rot: -3, duration: 0.32 * k * 0.4, ease: 'sine.inOut', onUpdate: apply });
	await gsap.to(st, { sx: baseK * 0.97, sy: baseK * 1.04, rot: 3, duration: 0.32 * k * 0.35, ease: 'sine.inOut', onUpdate: apply });
	await gsap.to(st, { sx: baseK, sy: baseK, rot: 0, duration: 0.32 * k * 0.25, ease: 'sine.inOut', onUpdate: apply });
	await gsap.to(st, { flip: 1, duration: 0.56 * k, ease: 'power2.inOut', onUpdate: apply });

	const nrW = Math.min(620, viewW * 0.86), nrH = Math.max(48, viewH * 0.12);
	if (flipName && flipName.parent) flipName.parent.removeChild(flipName);
	flipName = fitWord(FLIP_TITLE[result], nrW, nrH);
	if (flipName) {
		flipName.position.set(cx, cy + ch * 0.62);
		flipName.alpha = 0;
		flipName.visible = true;
		flipRoot.addChild(flipName);
		gsap.fromTo(flipName, { alpha: 0 }, { alpha: 1, duration: 0.25 * k, ease: 'back.out(1.6)', onUpdate: () => kickUi() });
	}

	await Promise.race([wait(S.turbo ? 900 : 1700), tapped]);
	O.onclick = null;
	flipRoot.off('pointertap', onPtr);
	O.classList.add('out');
	await gsap.to(flipRoot, { alpha: 0, duration: 0.25, onUpdate: () => kickUi() });
	if (flipDim) { flipDim.visible = false; flipDim.eventMode = 'none'; }
	flipRoot.eventMode = 'none';
	O.classList.add('hidden');
	O.classList.remove('out');
	flipDrive = false;
	flipRoot.visible = false;
	flipRoot.alpha = 1;
	kickUi();
}
