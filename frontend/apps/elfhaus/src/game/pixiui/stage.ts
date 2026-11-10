// Full-viewport Pixi overlay for game UI (buy menu, confirm, feature intro, later HUD / panels).
// One Application, never destroyed (Pixi 8 shared batch pool). Fixed design resolution per layout,
// scaled uniformly (contain) into the viewport.
import { Application, Container, Sprite, Texture } from 'pixi.js';
import { Assets } from 'pixi.js';
import { TZ } from '../layers';
import { watchCanvas } from '../diag';

export type LayoutKind = 'phonePort' | 'tabletPort' | 'square' | 'land';

export const DESIGNS: Record<LayoutKind, { w: number; h: number }> = {
	phonePort: { w: 390, h: 844 },
	tabletPort: { w: 768, h: 1024 },
	square: { w: 1024, h: 768 },
	land: { w: 1280, h: 800 },
};

export function layoutKind(vw: number, vh: number): LayoutKind {
	const r = vw / Math.max(1, vh);
	if (r < 0.72) return 'phonePort';
	if (r < 0.95) return 'tabletPort';
	if (r < 1.2) return 'square';
	return 'land';
}

export const isPortrait = (k: LayoutKind) => k === 'phonePort' || k === 'tabletPort';

let app: Application | null = null, appP: Promise<Application | null> | null = null;
/** Unscaled, covers the real viewport (dim / backdrop). */
export const uiScreen = new Container();
/** Design-space root: position + uniform scale. All cards / panels live here. */
export const uiRoot = new Container();
export const uiLayer = new Container();

export let uiScale = 1, uiKind: LayoutKind = 'phonePort', viewW = 0, viewH = 0, designW = 390, designH = 844;

const relayout = new Set<() => void>();
export const onUiLayout = (f: () => void) => { relayout.add(f); return () => relayout.delete(f); };

const tickers = new Set<() => boolean>();
let dirty = false;

export const uiApp = () => app;
export function animateUi(t: () => boolean) { tickers.add(t); kickUi(); }
export function kickUi() { if (!app) return; dirty = true; app.ticker.start(); }

let uiZ = TZ.hud;
/** HUD lives under popMenu / DOM panels (z 45 / 80). Pixi modals raise the canvas above them. */
export function setUiTier(tier: 'hud' | 'modal') {
	uiZ = tier === 'modal' ? 85 : TZ.hud;
	document.body.classList.toggle('pixiUiModal', tier === 'modal');
	const cv = app?.canvas as HTMLCanvasElement | undefined;
	if (cv) cv.style.zIndex = String(uiZ);
}
export function uiInteractive(on: boolean) {
	const cv = app?.canvas as HTMLCanvasElement | undefined;
	if (cv) cv.style.pointerEvents = on ? 'auto' : 'none';
}


function place() {
	if (!app) return;
	const vv = window.visualViewport;
	const vw = Math.max(1, Math.round(vv?.width ?? window.innerWidth));
	const vh = Math.max(1, Math.round(vv?.height ?? window.innerHeight));
	viewW = vw; viewH = vh;
	uiKind = layoutKind(vw, vh);
	const D = DESIGNS[uiKind];
	designW = D.w; designH = D.h;
	const cv = app.canvas as HTMLCanvasElement;
	const r = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
	if (app.renderer.resolution !== r) app.renderer.resolution = r;
	if (app.renderer.width !== vw || app.renderer.height !== vh) app.renderer.resize(vw, vh);
	cv.style.cssText = `position:fixed;left:0;top:0;width:${vw}px;height:${vh}px;pointer-events:${cv.style.pointerEvents || 'none'};z-index:${uiZ};touch-action:none`;
	uiScale = Math.min(vw / D.w, vh / D.h);
	uiRoot.scale.set(uiScale);
	uiRoot.position.set((vw - D.w * uiScale) / 2, (vh - D.h * uiScale) / 2);
	relayout.forEach((f) => f());
	kickUi();
}

export function initUiStage() {
	return (appP ??= (async () => {
		const a = new Application();
		try {
			await a.init({ backgroundAlpha: 0, antialias: true, preference: 'webgl', autoDensity: false, hello: false, sharedTicker: false, autoStart: false, width: 8, height: 8 });
		} catch (e) {
			console.warn('ui stage', e);
			return null;
		}
		const cv = a.canvas as HTMLCanvasElement;
		cv.id = 'uiStage';
		cv.setAttribute('aria-hidden', 'true');
		// Must live outside #root: that node is translated + scaled (stage.ts), and a viewport-sized
		// canvas parented there is itself scaled (it overflowed or shrank on every non-1:1 window).
		document.body.appendChild(cv);
		watchCanvas(cv, 'ui');
		uiScreen.eventMode = 'passive';
		uiRoot.eventMode = 'passive';
		uiLayer.eventMode = 'passive';
		uiLayer.sortableChildren = true;
		a.stage.eventMode = 'static';
		a.stage.hitArea = { contains: (x: number, y: number) => x >= 0 && y >= 0 && x <= (viewW || 1) && y <= (viewH || 1) };
		a.stage.addChild(uiScreen, uiRoot);
		uiRoot.addChild(uiLayer);
		app = a;
		place();
		let q = 0;
		const later = () => { if (!q) q = requestAnimationFrame(() => { q = 0; place(); }); };
		addEventListener('resize', later);
		visualViewport?.addEventListener('resize', later);
		addEventListener('orientationchange', () => { setTimeout(later, 120); setTimeout(later, 500); });
		a.ticker.add(() => {
			let live = false;
			for (const t of tickers) { if (t()) live = true; else tickers.delete(t); }
			a.render();
			dirty = false;
			if (!live && !tickers.size) a.ticker.stop();
		});
		return a;
	})());
}

/** Stretch a texture over the real viewport (the dim). Lives on uiScreen, not the scaled root. */
export function fillScreen(tex: Texture) {
	const s = new Sprite(tex);
	s.eventMode = 'static';
	const fit = () => { s.position.set(0, 0); s.width = viewW; s.height = viewH; };
	fit();
	onUiLayout(fit);
	uiScreen.addChild(s);
	return s;
}

export async function loadUiImage(url: string): Promise<Texture> {
	return Assets.load(url) as Promise<Texture>;
}
