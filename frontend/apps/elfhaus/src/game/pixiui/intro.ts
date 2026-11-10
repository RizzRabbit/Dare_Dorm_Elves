// Feature-intro card (Bunny Slope, Black Diamond, Double Black, Powder Day, Secret Santa, Wild Winter Spins).
// Sign plate, masked posed art, painted title, title-lettering spin count, START. START / overlay tap
// (after a 300 ms leftover-tap guard) and Space/Enter (via the hidden #intro .cont) all start the bonus.
import { Container, Sprite } from 'pixi.js';
import { gsap } from 'gsap';
import { nineUi, startBtn, hit, modalDimTex } from './widgets';
import { artWindow } from './elves';
import { bmFit, centerSpr, fitSpr, typeRow, wordSpr } from './text';
import { designH, designW, fillScreen, isPortrait, kickUi, onUiLayout, setUiTier, uiInteractive, uiKind, uiLayer } from './stage';
import { confirmVisible, buyVisible } from './buy';

export type IntroState = { mode: string; spins: string };

const TITLE_FRAME: Record<string, string> = {
	dare: 't_bonus_bunny',
	double_dare: 't_bonus_blackdiamond',
	triple_dare: 't_bonus_doubleblack',
	mystery: 't_bonus_santa',
	egw: 't_bonus_wildwinter',
	hidden: 't_bonus_powder',
};

const reduced = () => matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const root = new Container();
root.label = 'introRoot';
root.visible = false;
root.zIndex = 3;

let dim: Sprite | null = null;
let card: Container | null = null;
let last: IntroState | null = null;
let built = false;
let shownAt = 0;
let onStart: (() => void) | null = null;

function modeTitle(mode: string, maxW: number, maxH: number) {
	const frame = TITLE_FRAME[mode];
	if (frame) {
		try {
			const s = wordSpr(frame);
			fitSpr(s, maxW, maxH);
			s.label = 'uiTitle';
			return s;
		} catch { /* */ }
	}
	return bmFit(mode.toUpperCase(), 'font_cream', Math.min(32, maxH), maxW, maxH);
}

function tryStart() {
	if (performance.now() - shownAt < 300) return;
	onStart?.();
}

function layout() {
	if (!card || !last) return;
	card.removeAllListeners();
	card.removeChildren();
	const kind = uiKind, portrait = isPortrait(kind);
	const W = designW, H = designH;
	const cardW = Math.min(portrait ? (kind === 'tabletPort' ? 560 : 350) : 520, W - 28);
	const inner = 18;
	const artH = Math.min(cardW * 0.78, portrait ? (kind === 'phonePort' ? 260 : 340) : 250);
	const titleH = kind === 'phonePort' ? 56 : 72;
	const spinH = kind === 'phonePort' ? 36 : 46;
	const btnW = Math.min(240, cardW - inner * 2), btnH = 64;
	const cardH = inner + artH + 10 + titleH + 8 + spinH + 14 + btnH + inner;
	const h = Math.min(cardH, H - 20);
	card.addChild(nineUi('sign_plate', cardW, h, 2));
	card.position.set((W - cardW) / 2, Math.max(10, (H - h) / 2));
	card.label = 'uiPanel';
	hit(card, cardW, h);
	card.cursor = 'default';
	card.on('pointertap', (e) => { e.stopPropagation(); tryStart(); });

	const art = artWindow(last.mode, cardW - inner * 2, artH);
	art.position.set(inner, inner);
	card.addChild(art);

	const title = modeTitle(last.mode, cardW - inner * 2, titleH);
	if (title) {
		if (title instanceof Sprite) centerSpr(title, cardW / 2, inner + artH + 8 + titleH / 2);
		else title.position.set(cardW / 2, inner + artH + 8 + titleH / 2);
		card.addChild(title);
	}
	const spins = typeRow(last.spins, cardW - inner * 2, spinH);
	spins.position.set(cardW / 2, inner + artH + 8 + titleH + 8 + spinH / 2);
	card.addChild(spins);

	const btn = startBtn(btnW, btnH, tryStart);
	btn.position.set((cardW - btnW) / 2, inner + artH + 8 + titleH + 8 + spinH + 14);
	btn.label = 'uiStart';
	try {
		const lab = wordSpr('w_start');
		fitSpr(lab, btnW * 0.7, btnH * 0.5);
		lab.position.set(btnW / 2, btnH / 2);
		lab.eventMode = 'none';
		btn.addChild(lab);
	} catch {
		const lab = typeRow('START', btnW * 0.7, btnH * 0.5);
		lab.position.set(btnW / 2, btnH / 2);
		lab.eventMode = 'none';
		btn.addChild(lab);
	}
	card.addChild(btn);
	kickUi();
}

function ensure() {
	if (built) return;
	root.eventMode = 'passive';
	if (modalDimTex) {
		dim = fillScreen(modalDimTex);
		dim.alpha = 0.88;
		dim.visible = false;
		dim.eventMode = 'static';
		dim.cursor = 'pointer';
		dim.on('pointertap', () => tryStart());
	}
	card = new Container();
	root.addChild(card);
	uiLayer.addChild(root);
	built = true;
	onUiLayout(() => { if (root.visible && last) layout(); });
}

export function showFeatureIntro(s: IntroState, start: () => void) {
	ensure();
	last = s;
	onStart = start;
	shownAt = performance.now();
	layout();
	root.visible = true;
	if (dim) dim.visible = true;
	setUiTier('modal');
	uiInteractive(true);
	if (card) {
		gsap.killTweensOf(card);
		gsap.killTweensOf(card.scale);
		const calm = !reduced();
		card.alpha = 0;
		if (calm) card.scale.set(0.92);
		gsap.to(card, { alpha: 1, duration: 0.45, ease: 'power2.out', onUpdate: kickUi });
		if (calm) gsap.to(card.scale, { x: 1, y: 1, duration: 0.45, ease: 'power2.out', onUpdate: kickUi });
	}
	if (dim) {
		dim.alpha = 0;
		gsap.to(dim, { alpha: 0.88, duration: 0.45, ease: 'power2.out', onUpdate: kickUi });
	}
	kickUi();
}

export function hideFeatureIntro() {
	if (!root.visible) return;
	onStart = null;
	const done = () => {
		root.visible = false;
		if (dim) dim.visible = false;
		if (!buyVisible() && !confirmVisible()) { uiInteractive(false); setUiTier('hud'); }
		kickUi();
	};
	if (card) {
		gsap.killTweensOf(card);
		gsap.killTweensOf(card.scale);
		const calm = !reduced();
		gsap.to(card, { alpha: 0, duration: 0.3, ease: 'power2.in', onUpdate: kickUi, onComplete: done });
		if (calm) gsap.to(card.scale, { x: 0.96, y: 0.96, duration: 0.3, ease: 'power2.in', onUpdate: kickUi });
		if (dim) gsap.to(dim, { alpha: 0, duration: 0.3, ease: 'power2.in', onUpdate: kickUi });
	} else done();
}

export const introVisible = () => root.visible;
