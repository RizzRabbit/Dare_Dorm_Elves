// Pixi Buy Bonus menu + confirm card. Layout is in the current design resolution (stage.ts):
// portrait = 3 cards on top, 2 centred below; landscape / square = one row of 5.
import { Container, Sprite } from 'pixi.js';
import { gsap } from 'gsap';
import type { ModeKey } from '../config';
import { TITLE_ART } from '../config';
import { nineUi, icoBtn, makeSwitch, goBtn, hit, modalDimTex } from './widgets';
import { artWindow } from './elves';
import { bmFit, buyTitleSpr, centerSpr, fitSpr, wordSpr, typeRow } from './text';
import { designH, designW, fillScreen, isPortrait, kickUi, onUiLayout, setUiTier, uiInteractive, uiKind, uiLayer } from './stage';
import { relaxUiTier } from './wins';
import { introVisible } from './intro';

export type BuyCardState = { mode: ModeKey; price: string; x: string; off: boolean; armed: boolean };
export type BuyState = {
	social: boolean;
	betLabel: string;
	betValue: string;
	anteOn: boolean;
	anteCost: string;
	turboOn: boolean;
	turboHidden: boolean;
	buyOff: boolean;
	canBetDown: boolean;
	canBetUp: boolean;
	cards: BuyCardState[];
};
export type ConfirmState = {
	mode: ModeKey | 'ante';
	title: string;
	desc: string;
	amount: string;
	per: string;
	x: string;
	note: string;
	button: string;
	hint: string;
};
export type BuyHooks = {
	onCard: (m: ModeKey) => void;
	onBet: (d: number) => void;
	onAnte: () => void;
	onTurbo: () => void;
	onClose: () => void;
	onConfirmYes: () => void;
	onConfirmCancel: () => void;
};

const TITLE_FRAME: Record<string, string> = {
	dare: 't_bonus_bunny',
	double_dare: 't_bonus_blackdiamond',
	triple_dare: 't_bonus_doubleblack',
	mystery: 't_bonus_santa',
	egw: 't_bonus_wildwinter',
	hidden: 't_bonus_powder',
};

let hooks: BuyHooks | null = null;
export const setBuyHooks = (h: BuyHooks) => { hooks = h; };

const reduced = () => matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const buyRoot = new Container();
buyRoot.label = 'buyRoot';
buyRoot.visible = false;
const confirmRoot = new Container();
confirmRoot.label = 'confirmRoot';
confirmRoot.visible = false;

let buyDim: Sprite | null = null, confirmDim: Sprite | null = null;
let panel: Container | null = null;
let titleSlot: Container | null = null;
let betLabelSpr: Sprite | null = null, betValSpr: Sprite | null = null;
let anteCostSpr: Sprite | null = null;
let anteSw: ReturnType<typeof makeSwitch> | null = null;
let turboSw: ReturnType<typeof makeSwitch> | null = null;
let turboRow: Container | null = null;
let cardsHost: Container | null = null;
let downBtn: Container & { icon: Sprite; size: number } | null = null;
let upBtn: Container & { icon: Sprite; size: number } | null = null;
let last: BuyState | null = null;
let lastConfirm: ConfirmState | null = null;
let built = false;
let cfCard: Container | null = null;
let cfTitle: Container | null = null, cfDesc: Sprite | null = null, cfAmt: Sprite | null = null, cfNote: Sprite | null = null, cfHint: Sprite | null = null;

function ticketK(w: number) { return Math.max(1, 200 / Math.max(120, w)); }

function modeTitle(mode: string, maxW: number, maxH: number) {
	const frame = TITLE_FRAME[mode] || (TITLE_ART[mode] ? 't_bonus_' + TITLE_ART[mode] : '');
	if (frame) {
		try {
			const s = wordSpr(frame);
			fitSpr(s, maxW, maxH);
			s.label = 'uiTitle';
			return s;
		} catch { /* fall through */ }
	}
	const s = bmFit(mode.toUpperCase(), 'font_cream', Math.min(22, maxH), maxW, maxH);
	if (s) s.label = 'uiTitle';
	return s;
}

function makeCard(st: BuyCardState, w: number, h: number) {
	const c = new Container();
	c.label = 'uiCard';
	c.eventMode = 'static';
	(c as Container & { mode: string }).mode = st.mode;
	const frame = st.off ? 'card_ticket_off' : st.armed ? 'card_ticket_armed' : 'card_ticket';
	let bg;
	try { bg = nineUi(frame === 'card_ticket_off' ? 'card_ticket' : frame, w, h, ticketK(w)); }
	catch { bg = nineUi('plate_cream', w, h, 2); }
	bg.alpha = st.off ? 0.55 : 1;
	c.addChild(bg);
	if (st.off && frame === 'card_ticket_off') {
		try {
			const off = nineUi('card_ticket_off', w, h, ticketK(w));
			off.alpha = 0.9;
			c.addChild(off);
		} catch { /* no off plate */ }
	}
	const inset = Math.max(8, w * 0.06);
	const band = Math.max(64, Math.min(h * 0.38, h - 72));
	const artY = Math.max(6, inset * 0.7);
	const artH = Math.max(48, h - band - artY);
	const art = artWindow(st.mode, w - inset * 2, artH);
	art.position.set(inset, artY);
	c.addChild(art);

	const tw = w - inset * 2;
	const textTop = artY + artH + 2;
	const avail = Math.max(24, h - textTop - 6);
	const titleH = avail * 0.44, priceH = avail * 0.3, xH = avail * 0.26;
	const title = modeTitle(st.mode, tw, titleH);
	if (title) {
		if (title instanceof Sprite) centerSpr(title, w / 2, textTop + titleH / 2);
		else title.position.set(w / 2, textTop + titleH / 2);
		c.addChild(title);
	}
	const price = bmFit(st.price, 'font_gold', Math.min(18, priceH), tw, priceH);
	if (price) {
		price.label = 'uiPrice';
		centerSpr(price, w / 2, textTop + titleH + priceH / 2);
		c.addChild(price);
	}
	const xSpr = bmFit(st.x.toUpperCase(), 'font_ink', Math.min(15, xH), tw, xH);
	if (xSpr) {
		xSpr.label = 'uiX';
		centerSpr(xSpr, w / 2, textTop + titleH + priceH + xH / 2);
		c.addChild(xSpr);
	}
	hit(c, w, h);
	c.cursor = st.off ? 'default' : 'pointer';
	c.alpha = st.off ? 0.72 : 1;
	c.on('pointertap', (e) => {
		e.stopPropagation();
		if (st.off) return;
		hooks?.onCard(st.mode);
	});
	return c;
}

function layoutBuy() {
	if (!built || !panel || !cardsHost || !last) return;
	const kind = uiKind;
	const portrait = isPortrait(kind);
	const W = designW, H = designH;
	const margin = kind === 'phonePort' ? 10 : 24;
	const panelW = Math.min(W - margin * 2, portrait ? (kind === 'tabletPort' ? 720 : 370) : Math.min(1200, W - 40));
	const inner = kind === 'phonePort' ? 14 : 22;
	const titleH = kind === 'phonePort' ? 36 : 48;
	const rowH = kind === 'phonePort' ? 40 : 48;
	const gap = kind === 'phonePort' ? 8 : 12;
	const nCards = last.buyOff ? 0 : last.cards.length;
	const cols = portrait ? 3 : Math.max(1, nCards || 5);
	const cardGap = gap;
	const cardW = nCards ? (panelW - inner * 2 - cardGap * (cols - 1)) / cols : 0;
	const cardRows = portrait && nCards ? 2 : 1;
	const turboH = last.turboHidden ? 0 : rowH + gap;
	const headerH = inner + titleH + gap + rowH + gap + rowH + turboH;
	const maxPanel = H - margin * 2;
	const cardsBudget = Math.max(80, maxPanel - headerH - inner);
	const wantH = nCards ? Math.min(cardW * 1.72, portrait ? (kind === 'tabletPort' ? 300 : 210) : 300) : 0;
	const fitH = nCards ? Math.floor((cardsBudget - (cardRows - 1) * cardGap) / cardRows) : 0;
	const cardH = nCards ? Math.max(120, Math.min(wantH, fitH)) : 0;
	const cardsH = nCards ? cardRows * cardH + (cardRows - 1) * cardGap : 0;
	const panelH = Math.min(maxPanel, headerH + cardsH + inner);
	const panelX = (W - panelW) / 2;
	const panelY = Math.max(margin, (H - panelH) / 2);

	// rebuild panel chrome size
	panel.removeAllListeners();
	panel.removeChildren();
	titleSlot = new Container();
	const bg = nineUi('plate_cream', panelW, panelH, 2);
	panel.addChild(bg);
	panel.position.set(panelX, panelY);
	panel.label = 'uiPanel';
	hit(panel, panelW, panelH);
	panel.cursor = 'default';
	panel.on('pointertap', (e) => e.stopPropagation());

	const close = icoBtn('btn_close', Math.max(36, titleH * 0.9), () => hooks?.onClose());
	close.position.set(panelW - inner - close.size, inner - 4);
	close.label = 'uiClose';
	panel.addChild(close);

	const title = buyTitleSpr(last.social, panelW - inner * 2 - 48, titleH);
	titleSlot = new Container();
	if (title) { title.position.set(panelW / 2, inner + titleH / 2); titleSlot.addChild(title); }
	panel.addChild(titleSlot);

	let y = inner + titleH + gap;
	const betRow = new Container();
	betRow.addChild(nineUi('row_plate', panelW - inner * 2, rowH, 2));
	betRow.position.set(inner, y);
	downBtn = icoBtn(last.canBetDown ? 'ico_minus' : 'ico_minus_ink', rowH * 0.7, () => hooks?.onBet(-1));
	upBtn = icoBtn(last.canBetUp ? 'ico_plus' : 'ico_plus_ink', rowH * 0.7, () => hooks?.onBet(1));
	downBtn.position.set(8, (rowH - downBtn.height) / 2);
	upBtn.position.set(panelW - inner * 2 - 8 - upBtn.width, (rowH - upBtn.height) / 2);
	downBtn.alpha = last.canBetDown ? 1 : 0.4;
	upBtn.alpha = last.canBetUp ? 1 : 0.4;
	betRow.addChild(downBtn, upBtn);
	const mid = (panelW - inner * 2) / 2;
	betLabelSpr = bmFit(last.betLabel, 'font_ink', Math.min(13, rowH * 0.32), mid, rowH * 0.36);
	if (betLabelSpr) betLabelSpr.position.set(mid, 3);
	betValSpr = bmFit(last.betValue, 'font_gold', Math.min(20, rowH * 0.42), mid, rowH * 0.5);
	if (betValSpr) betValSpr.position.set(mid, rowH * 0.38);
	if (betLabelSpr) betRow.addChild(betLabelSpr);
	if (betValSpr) betRow.addChild(betValSpr);
	panel.addChild(betRow);

	y += rowH + gap;
	const anteRow = new Container();
	anteRow.addChild(nineUi('row_plate', panelW - inner * 2, rowH, 2));
	anteRow.position.set(inner, y);
	try {
		const al = wordSpr('w_ante');
		fitSpr(al, 80, rowH * 0.55);
		al.position.set(16 + al.width / 2, rowH / 2);
		anteRow.addChild(al);
	} catch {
		const al = bmFit('ANTE', 'font_ink', 16, 80, rowH * 0.5, 'left');
		if (al) { al.anchor.set(0, 0.5); al.position.set(14, rowH / 2); anteRow.addChild(al); }
	}
	anteCostSpr = bmFit(last.anteCost, 'font_ink', Math.min(13, rowH * 0.32), panelW * 0.45, rowH * 0.7, 'left');
	if (anteCostSpr) { anteCostSpr.anchor.set(0, 0.5); anteCostSpr.position.set(100, rowH / 2); anteRow.addChild(anteCostSpr); }
	anteSw = makeSwitch(() => hooks?.onAnte());
	anteSw.set(last.anteOn);
	anteSw.position.set(panelW - inner * 2 - 10 - anteSw.W, (rowH - anteSw.H) / 2);
	anteRow.addChild(anteSw);
	panel.addChild(anteRow);

	y += rowH + gap;
	turboRow = new Container();
	turboRow.visible = !last.turboHidden;
	if (!last.turboHidden) {
		turboRow.addChild(nineUi('row_plate', panelW - inner * 2, rowH, 2));
		turboRow.position.set(inner, y);
		const tl = bmFit('TURBO', 'font_ink', 16, 120, rowH * 0.55, 'left');
		if (tl) { tl.anchor.set(0, 0.5); tl.position.set(14, rowH / 2); turboRow.addChild(tl); }
		turboSw = makeSwitch(() => hooks?.onTurbo());
		turboSw.set(last.turboOn);
		turboSw.position.set(panelW - inner * 2 - 10 - turboSw.W, (rowH - turboSw.H) / 2);
		turboRow.addChild(turboSw);
		y += rowH + gap;
	}
	panel.addChild(turboRow);

	cardsHost = new Container();
	cardsHost.position.set(inner, y);
	if (!last.buyOff) {
		const top = last.cards.slice(0, portrait ? 3 : last.cards.length);
		const bot = portrait ? last.cards.slice(3) : [];
		top.forEach((st, i) => {
			const card = makeCard(st, cardW, cardH);
			card.position.set(i * (cardW + cardGap), 0);
			cardsHost!.addChild(card);
		});
		if (bot.length) {
			const used = bot.length * cardW + (bot.length - 1) * cardGap;
			const ox = ((cols * cardW + (cols - 1) * cardGap) - used) / 2;
			bot.forEach((st, i) => {
				const card = makeCard(st, cardW, cardH);
				card.position.set(ox + i * (cardW + cardGap), cardH + cardGap);
				cardsHost!.addChild(card);
			});
		}
	}
	panel.addChild(cardsHost);
	kickUi();
}

function ensureBuy() {
	if (built) return;
	buyRoot.eventMode = 'passive';
	if (modalDimTex) {
		buyDim = fillScreen(modalDimTex);
		buyDim.alpha = 0.88;
		buyDim.visible = false;
		buyDim.eventMode = 'static';
		buyDim.cursor = 'pointer';
		buyDim.on('pointertap', () => hooks?.onClose());
	}
	panel = new Container();
	cardsHost = new Container();
	buyRoot.addChild(panel);
	uiLayer.addChild(buyRoot);
	built = true;
	onUiLayout(() => { if (buyRoot.visible && last) layoutBuy(); });
}

export function paintBuyMenu(s: BuyState) {
	last = s;
	if (!built) ensureBuy();
	if (buyRoot.visible) layoutBuy();
}

export function showBuyMenu() {
	setUiTier('modal');
	ensureBuy();
	if (last) layoutBuy();
	buyRoot.visible = true;
	buyRoot.alpha = 1;
	if (buyDim) buyDim.visible = true;
	uiInteractive(true);
	if (panel) {
		gsap.killTweensOf(panel);
		gsap.killTweensOf(panel.scale);
		if (reduced()) { panel.alpha = 1; panel.scale.set(1); }
		else {
			panel.alpha = 0; panel.scale.set(0.96);
			gsap.to(panel, { alpha: 1, duration: 0.46, ease: 'power2.out', onUpdate: kickUi });
			gsap.to(panel.scale, { x: 1, y: 1, duration: 0.46, ease: 'power2.out', onUpdate: kickUi });
		}
	}
	if (buyDim) {
		gsap.killTweensOf(buyDim);
		if (reduced()) buyDim.alpha = 0.88;
		else { buyDim.alpha = 0; gsap.to(buyDim, { alpha: 0.88, duration: 0.46, ease: 'power2.out', onUpdate: kickUi }); }
	}
	kickUi();
}

export function hideBuyMenu() {
	if (!buyRoot.visible && !confirmRoot.visible) return;
	hideBuyConfirm();
	const done = () => {
		buyRoot.visible = false;
		if (buyDim) buyDim.visible = false;
		relaxUiTier();
		kickUi();
	};
	if (panel && buyRoot.visible) {
		gsap.killTweensOf(panel);
		gsap.killTweensOf(panel.scale);
		if (reduced()) {
			panel.alpha = 0; panel.scale.set(1);
			if (buyDim) { gsap.killTweensOf(buyDim); buyDim.alpha = 0; }
			done();
		} else {
			gsap.to(panel, { alpha: 0, duration: 0.36, ease: 'power2.in', onUpdate: kickUi, onComplete: done });
			gsap.to(panel.scale, { x: 0.96, y: 0.96, duration: 0.36, ease: 'power2.in', onUpdate: kickUi });
			if (buyDim) gsap.to(buyDim, { alpha: 0, duration: 0.36, ease: 'power2.in', onUpdate: kickUi });
		}
	} else done();
}

function layoutConfirm(s: ConfirmState) {
	if (!cfCard) return;
	cfCard.removeAllListeners();
	cfCard.removeChildren();
	const kind = uiKind;
	const W = designW, H = designH;
	const portrait = isPortrait(kind);
	const cardW = Math.min(portrait ? (kind === 'tabletPort' ? 520 : 340) : 480, W - 32);
	const inner = 18;
	const artH = Math.min(cardW * 0.72, portrait ? 280 : 240);
	const titleH = 52;
	const btnW = Math.min(240, cardW - inner * 2), btnH = 56;
	// measure text after we have widths
	const cardH = inner + artH + 8 + titleH + 90 + 70 + btnH + 36 + inner;
	const bg = nineUi('plate_cream', cardW, Math.min(cardH, H - 24), 2);
	cfCard.addChild(bg);
	cfCard.position.set((W - cardW) / 2, Math.max(12, (H - Math.min(cardH, H - 24)) / 2));
	cfCard.label = 'uiPanel';
	hit(cfCard, cardW, Math.min(cardH, H - 24));
	cfCard.cursor = 'default';

	const art = artWindow(s.mode, cardW - inner * 2, artH);
	art.position.set(inner, inner);
	cfCard.addChild(art);

	cfTitle = modeTitle(s.mode === 'ante' ? 'ante' : s.mode, cardW - inner * 2, titleH);
	if (!cfTitle) {
		const t = bmFit(s.title, 'font_cream', 28, cardW - inner * 2, titleH);
		cfTitle = t;
	}
	if (cfTitle) {
		if (cfTitle instanceof Sprite) centerSpr(cfTitle, cardW / 2, inner + artH + 8 + titleH / 2);
		else cfTitle.position.set(cardW / 2, inner + artH + 8 + titleH / 2);
		cfCard.addChild(cfTitle);
	}
	let y = inner + artH + 8 + titleH + 6;
	cfDesc = bmFit(s.desc, 'font_ink', 15, cardW - inner * 2, 70);
	if (cfDesc) { cfDesc.position.set(cardW / 2, y); cfCard.addChild(cfDesc); y += (cfDesc.height * cfDesc.scale.y) + 8; }
	const amt = bmFit(`${s.amount}  ${s.per}  ${s.x}`, 'font_gold', 18, cardW - inner * 2, 28);
	if (amt) { amt.label = 'uiPrice'; amt.position.set(cardW / 2, y); cfCard.addChild(amt); cfAmt = amt; y += amt.height * amt.scale.y + 8; }
	cfNote = bmFit(s.note, 'font_ink', 13, cardW - inner * 2, 56);
	if (cfNote) { cfNote.position.set(cardW / 2, y); cfCard.addChild(cfNote); y += cfNote.height * cfNote.scale.y + 12; }

	const btn = goBtn(btnW, btnH, () => hooks?.onConfirmYes());
	btn.position.set((cardW - btnW) / 2, y);
	btn.label = 'uiConfirm';
	try {
		const lab = wordSpr('w_confirm');
		fitSpr(lab, btnW * 0.8, btnH * 0.55);
		lab.position.set(btnW / 2, btnH / 2);
		lab.eventMode = 'none';
		btn.addChild(lab);
	} catch {
		const lab = typeRow(s.button || 'CONFIRM', btnW * 0.8, btnH * 0.55);
		lab.position.set(btnW / 2, btnH / 2);
		lab.eventMode = 'none';
		btn.addChild(lab);
	}
	cfCard.addChild(btn);
	y += btnH + 8;
	cfHint = bmFit(s.hint, 'font_ink', 12, cardW - inner * 2, 20);
	if (cfHint) { cfHint.position.set(cardW / 2, y); cfCard.addChild(cfHint); }

	// Cancel: any tap on the card that did not start on CONFIRM (and is not a drag).
	let x0 = 0, y0 = 0, pid = -1, moved = false, downYes = false;
	const onDown = (e: { pointerId: number; global: { x: number; y: number }; target: unknown }) => {
		pid = e.pointerId; x0 = e.global.x; y0 = e.global.y; moved = false;
		let t: unknown = e.target;
		downYes = false;
		while (t && typeof t === 'object' && 'label' in (t as object)) {
			if ((t as Container).label === 'uiConfirm') { downYes = true; break; }
			t = (t as Container).parent;
		}
	};
	cfCard.on('pointerdown', onDown);
	cfCard.on('pointermove', (e) => { if (e.pointerId === pid && !moved && Math.hypot(e.global.x - x0, e.global.y - y0) > 6) moved = true; });
	cfCard.on('pointerup', (e) => {
		const yes = downYes, wasMoved = moved;
		moved = false; downYes = false; pid = -1;
		if (wasMoved) return;
		if (yes) return;
		e.stopPropagation();
		hooks?.onConfirmCancel();
	});
	kickUi();
}

export function showBuyConfirm(s: ConfirmState) {
	setUiTier('modal');
	if (!confirmRoot.parent) {
		confirmRoot.eventMode = 'passive';
		if (modalDimTex) {
			confirmDim = fillScreen(modalDimTex);
			confirmDim.alpha = 0.88;
			confirmDim.eventMode = 'static';
			confirmDim.cursor = 'pointer';
			confirmDim.on('pointertap', () => hooks?.onConfirmCancel());
		}
		cfCard = new Container();
		confirmRoot.addChild(cfCard);
		uiLayer.addChild(confirmRoot);
		confirmRoot.zIndex = 2;
		buyRoot.zIndex = 1;
		uiLayer.sortableChildren = true;
		onUiLayout(() => { if (confirmRoot.visible && cfCard && lastConfirm) layoutConfirm(lastConfirm); });
	}
	lastConfirm = s;
	layoutConfirm(s);
	confirmRoot.visible = true;
	// One dim only: the buy menu's dim already covers the board when confirm opens on top of it.
	if (confirmDim) confirmDim.visible = !buyRoot.visible;
	uiInteractive(true);
	if (cfCard) {
		gsap.killTweensOf(cfCard);
		gsap.killTweensOf(cfCard.scale);
		if (reduced()) { cfCard.alpha = 1; cfCard.scale.set(1); }
		else {
			cfCard.alpha = 0; cfCard.scale.set(0.96);
			gsap.to(cfCard, { alpha: 1, duration: 0.36, ease: 'power2.out', onUpdate: kickUi });
			gsap.to(cfCard.scale, { x: 1, y: 1, duration: 0.36, ease: 'power2.out', onUpdate: kickUi });
		}
	}
	if (confirmDim) {
		gsap.killTweensOf(confirmDim);
		if (reduced()) confirmDim.alpha = 0.88;
		else { confirmDim.alpha = 0; gsap.to(confirmDim, { alpha: 0.88, duration: 0.36, ease: 'power2.out', onUpdate: kickUi }); }
	}
	kickUi();
}

export function hideBuyConfirm() {
	if (!confirmRoot.visible) return;
	const done = () => {
		confirmRoot.visible = false;
		if (confirmDim) confirmDim.visible = false;
		relaxUiTier();
		kickUi();
	};
	if (cfCard) {
		gsap.killTweensOf(cfCard);
		gsap.killTweensOf(cfCard.scale);
		if (reduced()) {
			cfCard.alpha = 0; cfCard.scale.set(1);
			if (confirmDim) { gsap.killTweensOf(confirmDim); confirmDim.alpha = 0; }
			done();
		} else {
			gsap.to(cfCard, { alpha: 0, duration: 0.36, ease: 'power2.in', onUpdate: kickUi, onComplete: done });
			gsap.to(cfCard.scale, { x: 0.96, y: 0.96, duration: 0.36, ease: 'power2.in', onUpdate: kickUi });
			if (confirmDim) gsap.to(confirmDim, { alpha: 0, duration: 0.36, ease: 'power2.in', onUpdate: kickUi });
		}
	} else done();
}

export const buyVisible = () => buyRoot.visible;
export const confirmVisible = () => confirmRoot.visible;

export function tapBuyCard(i: number) {
	const m = last?.cards[i]?.mode;
	if (!m || last?.cards[i]?.off) return false;
	hooks?.onCard(m);
	return true;
}
