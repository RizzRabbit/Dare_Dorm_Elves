// The unified board Pixi stage (fix7, James 2026-11-04 "do it the right way now"): ONE Pixi app, one canvas in #frame,
// holding the board and its FX in a fixed scene graph (zIndex + sortableChildren, never addChild order):
//   frameBack   frame back + reel backing                     (phase 2: still the #mkFrame DOM canvas under the cells)
//   reels       symbols; mask on the reel-strip container ONLY while spinning   (phase 2: still DOM #cells)
//   winGlow     silhouette win glow, under the symbols (only its halo shows)
//   symFx       merge trails / puffLayer() / xN badges, no mask   (puff live now; trails + badges phase 2)
//   lines       win lines (painted fx-atlas parts)            (live)
//   winAmt      win amount labels                             (phase 2: DOM .wlAmt)
//   lip         frame-front lip: oversize art tucks behind the frame (live)
//   banners     RESPINS counter (board/banners.ts, live); and the free-spins bar (startFsBanner)
// Coordinates: #frame-local layout px, offset by `pad` (the canvas overhangs the frame so FX can leave the window).
// Rendered once per frame at device px (stage CSS scale x devicePixelRatio, capped 3), only while something is live.
import { Application, Container, Sprite, Texture } from 'pixi.js';
import { FRZ } from '../layers';
import { watchCanvas } from '../diag';

export const BL = { frameBack: 0, winGlow: 5, reels: 10, symFx: 30, lines: 40, winAmt: 50, lip: 60, banners: 70 } as const;
export type BLayer = keyof typeof BL;
let app: Application | null = null, appP: Promise<Application | null> | null = null, fr: HTMLElement | null = null;
export let pad = 0;
export const layer = {} as Record<BLayer, Container>;
// boardfx: every layer sits in one fx root, pivoted on the frame centre; base transform = identity (boardfx.ts)
let fxRoot: Container | null = null, fxX = 0, fxY = 0, fxS = 1, cx = 0, cy = 0;
const applyFx = () => { if (!fxRoot) return; fxRoot.pivot.set(cx, cy); fxRoot.position.set(cx + fxX, cy + fxY); fxRoot.scale.set(fxS); };
/** boardfx: board offset (layout px) + scale about the frame centre; (0, 0, 1) is the exact base. */
export function setBoardFx(x: number, y: number, s: number) { fxX = x; fxY = y; fxS = s; applyFx(); kick(); }
const tickers = new Set<() => boolean>();   // each returns true while it still needs frames
let dirty = false;

function place() {
	if (!app || !fr) return;
	const cv = app.canvas as HTMLCanvasElement, w = fr.offsetWidth, h = fr.offsetHeight; pad = Math.round(Math.max(w, h) * 0.12);
	const sc = fr.getBoundingClientRect().width / Math.max(1, w);
	const r = Math.min(3, Math.max(1, sc * (window.devicePixelRatio || 1)));
	cv.style.cssText = `position:absolute;left:${-pad}px;top:${-pad}px;width:${w + 2 * pad}px;height:${h + 2 * pad}px;pointer-events:none;z-index:${FRZ.fx}`;
	if (app.renderer.resolution !== r) app.renderer.resolution = r;
	if (app.renderer.width !== w + 2 * pad || app.renderer.height !== h + 2 * pad) app.renderer.resize(w + 2 * pad, h + 2 * pad);
	for (const c of Object.values(layer)) c.position.set(pad, pad);   // layers draw in frame-local px
	cx = pad + w / 2; cy = pad + h / 2; applyFx();
	relayout.forEach((f) => f()); kick();
}
const relayout = new Set<() => void>();
/** Re-run `f` whenever the frame is laid out again (resize / orientation / stage fit). */
export const onLayout = (f: () => void) => { relayout.add(f); return () => relayout.delete(f); };
export function boardStage() {
	return (appP ??= (async () => {
		fr = document.getElementById('frame'); if (!fr) return null;
		const a = new Application();
		try { await a.init({ backgroundAlpha: 0, antialias: true, preference: 'webgl', autoDensity: false, hello: false, sharedTicker: false, autoStart: false, width: 8, height: 8 }); }
		catch (e) { console.warn('board stage', e); return null; }
		const cv = a.canvas as HTMLCanvasElement; cv.id = 'boardStage'; cv.setAttribute('aria-hidden', 'true');
		const stage = Document.prototype.getElementById.call(document, 'stage') as HTMLElement | null;
		(stage || document.body).appendChild(cv); watchCanvas(cv, 'board');
		a.stage.sortableChildren = true; fxRoot = new Container(); fxRoot.label = 'boardFx'; fxRoot.sortableChildren = true; a.stage.addChild(fxRoot);
		for (const n of Object.keys(BL) as BLayer[]) { const c = new Container(); c.label = n; c.zIndex = BL[n]; c.sortableChildren = true; layer[n] = c; fxRoot.addChild(c); }
		app = a; place();
		// resize + the frame's own ResizeObserver both fire on one resize: coalesced into one place() per frame
		let q = 0; const later = () => { if (!q) q = requestAnimationFrame(() => { q = 0; place(); }); };
		addEventListener('resize', later);
		if (stage) new ResizeObserver(later).observe(stage);
		else new ResizeObserver(later).observe(fr);
		a.ticker.add(() => { let live = false; for (const t of tickers) { if (t()) live = true; else tickers.delete(t); } a.render(); dirty = false; if (!live && !tickers.size) a.ticker.stop(); });
		return a;
	})());
}
/** The board stage app once made (null before boardStage() resolved). */
export const stageApp = () => app;
/** Drive `t` every frame until it returns false (then the stage idles: no frames while nothing moves). */
export function animate(t: () => boolean) { tickers.add(t); kick(); }
/** Something changed: render one frame. */
export function kick() { if (!app) return; dirty = true; app.ticker.start(); }
/** The centre of an element in frame-local layout px (walks offsetParents: exact at any stage scale / DPR). */
export function centreOf(el: HTMLElement) {
	let x = el.offsetWidth / 2, y = el.offsetHeight / 2;
	for (let e: HTMLElement | null = el; e && e !== fr; e = e.parentElement) { x += e.offsetLeft; y += e.offsetTop; }
	return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}
/** The stage's render resolution (device px per layout px). */
export const resolution = () => app?.renderer.resolution ?? Math.min(3, window.devicePixelRatio || 1);
export const isDirty = () => dirty;
let lip: Sprite | null = null;
/** mkboard.ts hands over the painted frame-front lip (a canvas in frame-local px). */
let back: Sprite | null = null;
/** fix8: the frame back (board panel, shadows, timber frame, trim: mkboard.ts drawFrame) as the stage's bottom layer. */
export function setFrameBack(cv: HTMLCanvasElement, x: number, y: number, w: number, h: number) {
	void boardStage().then((a) => {
		if (!a) return;
		const old = back?.texture; if (!back) { back = new Sprite(); back.label = 'frameBack'; back.zIndex = -1; layer.frameBack.addChild(back); }
		back.texture = Texture.from(cv); old?.destroy(true);
		back.position.set(x, y); back.width = w; back.height = h; kick();
	});
}
export function setLip(cv: HTMLCanvasElement, x: number, y: number, w: number, h: number) {
	void boardStage().then((a) => {
		if (!a) return;
		const old = lip?.texture; if (!lip) { lip = new Sprite(); lip.label = 'lip'; layer.lip.addChild(lip); }
		lip.texture = Texture.from(cv); old?.destroy(true);
		lip.position.set(x, y); lip.width = w; lip.height = h; kick();
	});
}

/** Re-place the board canvas after mkPlace sizes #frame / #stage. */
export function relayoutBoard() { place(); }
