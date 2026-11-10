// Public API for the Pixi game-UI overlay (buy menu, confirm, intro, HUD, win banners).
import { Container } from 'pixi.js';
import { loadAtlas } from '../scene/atlas';
import { initUiStage, uiApp, uiInteractive, uiKind, uiScale, designW, designH, viewW, viewH, kickUi } from './stage';
import { loadUiText } from './text';
import { loadElfArt } from './elves';
import { loadUiWidgets } from './widgets';
import { buyVisible, confirmVisible, tapBuyCard } from './buy';
import { introVisible } from './intro';
import { initHud, layoutHud, syncHud, hudHit, hudRects } from './hud';
import { initWins, winsVisible, relaxUiTier } from './wins';
import { banner, toast, hideToast, bigWin } from '../ui';
import { maxWinCelebration } from '../maxwin';
import { titleType, titleTypeMirror } from '../titletype';
import { ninePanel, CARD } from '../ninepanel';

export { setBuyHooks, paintBuyMenu, showBuyMenu, hideBuyMenu, showBuyConfirm, hideBuyConfirm, type BuyState, type BuyCardState, type ConfirmState, type BuyHooks } from './buy';
export { showFeatureIntro, hideFeatureIntro, type IntroState } from './intro';
export { layoutHud, syncHud, hudHit, hudRects } from './hud';
export { uiKind, uiScale, designW, designH, isPortrait } from './stage';

let on = false;
export const uiPixiOn = () => on;

export async function initUiPixi(): Promise<boolean> {
	if (on) return true;
	const app = await initUiStage();
	if (!app) return false;
	try {
		await Promise.all([loadAtlas('ui'), loadAtlas('titles'), loadUiText(), loadElfArt(), loadUiWidgets()]);
	} catch (e) {
		console.warn('ui pixi assets', e);
		return false;
	}
	on = true;
	document.body.classList.add('pixiUi');
	await initHud();
	await initWins();
	kickUi();
	installBounds();
	return true;
}

type Issue = { label: string; parent: string; why: string; box: number[]; pb: number[] };

function boxOf(c: Container) {
	const b = c.getBounds();
	return { x: b.x, y: b.y, w: b.width, h: b.height };
}

function contains(p: { x: number; y: number; w: number; h: number }, c: { x: number; y: number; w: number; h: number }, eps = 1.75) {
	return c.x >= p.x - eps && c.y >= p.y - eps && c.x + c.w <= p.x + p.w + eps && c.y + c.h <= p.y + p.h + eps;
}

function walk(n: { label?: string; children?: readonly unknown[] } | null | undefined, acc: Container[], labels: Set<string>, seen?: Set<unknown>, depth = 0) {
	if (!n || depth > 48) return;
	const seenSet = seen || new Set<unknown>();
	if (seenSet.has(n)) return;
	seenSet.add(n);
	if (n.label && labels.has(n.label)) acc.push(n as Container);
	const kids = n.children;
	if (kids) for (const ch of kids) walk(ch as { label?: string; children?: readonly unknown[] }, acc, labels, seenSet, depth + 1);
}

/** Programmatic bounds: no title / price / multiplier / art window outside its card or panel, no panel off-screen. */
export function uiBounds() {
	const app = uiApp();
	const issues: Issue[] = [];
	if (!app || !on) return { ok: false, ready: false, issues: [{ label: 'ui', parent: '', why: 'not ready', box: [], pb: [] }], kind: uiKind, design: [designW, designH], scale: uiScale, view: [viewW, viewH] };
	const labels = ['uiCard', 'uiPanel', 'uiTitle', 'uiPrice', 'uiX', 'uiArt', 'uiConfirm', 'uiStart', 'uiClose'] as const;
	const nodes: Container[] = [];
	walk(app.stage, nodes, new Set(labels));
	const screen = { x: 0, y: 0, w: viewW, h: viewH };
	for (const n of nodes) {
		if (n.visible === false) continue;
		let b: { x: number; y: number; w: number; h: number };
		try { b = boxOf(n); } catch { continue; }
		if (n.label === 'uiPanel' || n.label === 'uiCard') {
			if (!contains(screen, b, 2)) issues.push({ label: n.label, parent: 'screen', why: 'outside viewport', box: [b.x, b.y, b.w, b.h], pb: [0, 0, viewW, viewH] });
		}
		// titles, prices, multipliers, art windows must stay inside their card / panel
		if (n.label === 'uiTitle' || n.label === 'uiPrice' || n.label === 'uiX' || n.label === 'uiArt' || n.label === 'uiConfirm' || n.label === 'uiStart') {
			let p: Container | null = n.parent;
			while (p && p.label !== 'uiCard' && p.label !== 'uiPanel') p = p.parent;
			if (p) {
				const pb = boxOf(p);
				if (!contains(pb, b, 2)) issues.push({ label: n.label, parent: p.label, why: 'outside card/panel', box: [b.x, b.y, b.w, b.h], pb: [pb.x, pb.y, pb.w, pb.h] });
			}
		}
	}
	const cardBoxes = nodes.filter((n) => n.label === 'uiCard' && n.visible !== false).map((n) => {
		try {
			const b = boxOf(n);
			return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.w.toFixed(1), h: +b.h.toFixed(1) };
		} catch { return { x: 0, y: 0, w: 0, h: 0 }; }
	});
	const found = nodes.map((n) => n.label);
	return {
		ok: issues.length === 0,
		ready: true,
		open: { buy: buyVisible(), confirm: confirmVisible(), intro: introVisible(), wins: winsVisible() },
		kind: uiKind,
		design: [designW, designH],
		scale: +uiScale.toFixed(4),
		view: [viewW, viewH],
		cards: cardBoxes,
		found,
		stageKids: app.stage.children.length,
		issues,
	};
}

function installBounds() {
	(globalThis as unknown as { __elfUi: Record<string, unknown> }).__elfUi = {
		bounds: uiBounds,
		ready: () => on,
		interactive: uiInteractive,
		tapCard: (i: number) => tapBuyCard(i),
		confirmYes: () => { const h = (globalThis as any).__elfBuyConfirmYes; if (typeof h === 'function') h(); },
		hudHit: (x: number, y: number) => hudHit(x, y),
		layoutHud,
		hudRects,
		winsOpen: winsVisible,
		relaxTier: relaxUiTier,
		banner,
		toast,
		hideToast,
		bigWin,
		maxWin: maxWinCelebration,
		previewOutro: (amountText: string) => {
			const O = document.getElementById('outro'); if (!O) return;
			const amt = O.querySelector('.otAmt') as HTMLElement | null;
			if (amt) { titleTypeMirror(amt); amt.textContent = amountText; }
			titleType(O.querySelector('.tierName') as HTMLElement, 'TOTAL WIN');
			titleType(O.querySelector('.otHint') as HTMLElement, 'TAP TO CONTINUE');
			ninePanel(O.querySelector('.card') as HTMLElement, CARD);
			O.classList.add('landed'); O.classList.remove('hidden');
		},
		hideOutro: () => document.getElementById('outro')?.classList.add('hidden'),
		previewFsMore: (added: number) => {
			const O = document.getElementById('fsMore'); if (!O) return;
			const big = O.querySelector('.fmBig') as HTMLElement | null;
			titleType(big, added > 0 ? `+${added}` : 'MAX 20');
			O.dataset.max = added > 0 ? '' : '1';
			titleType(O.querySelector('.fmSub') as HTMLElement, 'FREE SPINS');
			ninePanel(O.querySelector('.card') as HTMLElement, CARD);
			O.classList.remove('hidden');
		},
		hideFsMore: () => document.getElementById('fsMore')?.classList.add('hidden'),
		previewMsg: (title: string, body: string) => {
			const t = document.getElementById('msgTitle'), b = document.getElementById('msgBody'), M = document.getElementById('msg');
			if (t) t.textContent = title; if (b) b.textContent = body; M?.classList.remove('hidden');
		},
		hideMsg: () => document.getElementById('msg')?.classList.add('hidden'),
	};
}
