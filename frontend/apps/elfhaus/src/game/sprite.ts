// SpriteAnim: tiny shared frame-based sprite player (no Pixi in this DOM renderer).
// A sheet = one image + JSON atlas {anims: {name: {fps, loop, frames: [[x,y,w,h], ...]}}, size:[W,H]}.
// play() draws an animation into a pooled <canvas> placed inside a host element (so it can sit behind or in
// front of DOM content via CSS classes) and advances it on one shared rAF ticker. Options: loop / once, hold
// the last frame, reverse, fps override, delay. Static frames can be shown without a canvas via frameCSS()
// (CSS background-position into the same sheet), which survives innerHTML re-renders.
// Tempo: on the board every sheet plays at fps / ANIM_TEMPO (tempo.ts spriteRate; turbo = 1), and its delay stretches
// with it; `rate` overrides that per play (1 = the sheet's own pace, e.g. the reel-stop land flashes).
// Trimmed frames (optional): an anim may set canvas:[W,H] and give frames as [x,y,w,h,ox,oy]; each frame is then drawn
// 1:1 at (ox,oy) on a W x H canvas (e.g. the stack letters band, so mostly-empty frames cost no sheet memory).
// Frame crossfade (opt-in, `blend`; the stacks sheets): when a sheet is slowed down (rate > 1, so never in turbo) calm
// frames dissolve into the next one, eased, over the frame interval instead of stepping. Two layers composited in the
// anim's ONE canvas: frame N at alpha 1-f, then N+1 added ('lighter') at alpha f; with premultiplied pixels that is the
// exact opacity mix (1-f)*N + f*N+1 (no edge halo, no coverage dip). Same decoded sheet, no 2nd canvas, no extra memory.
// No ghosting: each frame pair is measured once per sheet (planOf); pairs that move or jump (flash cut, ignition) cut
// instead of blending and are held shorter. See PLAN.
import { spriteRate } from './tempo';
export type Atlas = { size: [number, number]; anims: Record<string, { fps: number; loop: boolean; frames: number[][]; canvas?: [number, number] }> };
type Sheet = { img: CanvasImageSource; atlas: Atlas; src: string };
export type PlayOpts = { cls?: string; style?: string; loop?: boolean; hold?: boolean; reverse?: boolean; fps?: number; delay?: number; prepend?: boolean; rate?: number; blend?: boolean; onEnd?: () => void };
export type Anim = { cv: HTMLCanvasElement; sheet: Sheet; frames: number[][]; fps: number; loop: boolean; hold: boolean; t0: number; last: number; done: boolean; onEnd?: () => void; plan?: Plan; lastF?: number };

const sheets = new Map<string, Sheet>();
const pool: HTMLCanvasElement[] = [];
const live = new Set<Anim>();
let raf = 0;

export function loadSheet(id: string, src: string, atlas: Atlas) {
	const done = (bm: CanvasImageSource) => { warm(bm); sheets.set(id, { img: bm, atlas, src }); };
	// Decoded once into an ImageBitmap that canvases draw from, so a sheet is never lazily (re)decoded mid-spin.
	// fetch -> blob -> createImageBitmap decodes OFF the main thread; createImageBitmap(<img>) copied the decoded
	// pixels on the main thread (2.3 s long task for the max-win group sheet at 4x throttle), so it is only the fallback.
	const viaImg = () => new Promise<void>((res, rej) => {
		const img = new Image();
		img.onload = () => img.decode().catch(() => {})
			.then(() => (typeof createImageBitmap === 'function' ? createImageBitmap(img).catch(() => img) : img))
			.then((bm: CanvasImageSource) => { done(bm); res(); });
		img.onerror = rej; img.src = src;
	});
	if (typeof createImageBitmap !== 'function' || typeof fetch !== 'function') return viaImg();
	return fetch(src).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.blob(); })
		.then((b) => createImageBitmap(b)).then(done).catch(viaImg);
}
let warmCv: HTMLCanvasElement | null = null;
function warm(img: CanvasImageSource) { try { warmCv ||= document.createElement('canvas'); warmCv.width = warmCv.height = 1; warmCv.getContext('2d')!.drawImage(img, 0, 0, 1, 1); } catch { /* ignore */ } }
export const hasSheet = (id: string) => sheets.has(id);
/** Decoded sheet + atlas, for players that draw frames themselves (elfrig.ts per-elf puppets). */
export const sheetOf = (id: string) => sheets.get(id);
/** Drop a sheet's decoded texture (lazy celebration sheets after their show); it reloads on the next loadSheet(). */
export function unloadSheet(id: string) {
	const s = sheets.get(id); if (!s) return;
	for (const a of [...live]) if (a.sheet === s) stop(a);
	if (typeof ImageBitmap !== 'undefined' && s.img instanceof ImageBitmap) s.img.close();
	else if (s.img instanceof HTMLImageElement) s.img.src = '';
	sheets.delete(id);
}

/** Inline CSS that shows one frame of `anim` as a background, scaled to the element's box. */
export function frameCSS(id: string, anim: string, idx: number) {
	const s = sheets.get(id); if (!s) return '';
	const fr = s.atlas.anims[anim]?.frames; if (!fr) return '';
	const [x, y, w, h] = fr[idx < 0 ? fr.length + idx : idx], [W, H] = s.atlas.size;
	return `background-image:url(${s.src});background-repeat:no-repeat;background-size:${(W / w) * 100}% ${(H / h) * 100}%;` +
		`background-position:${W === w ? 0 : (x / (W - w)) * 100}% ${H === h ? 0 : (y / (H - h)) * 100}%;`;
}

function take(w: number, h: number) {
	const cv = pool.pop() || document.createElement('canvas');
	if (cv.width !== w) cv.width = w; if (cv.height !== h) cv.height = h;
	cv.className = 'spr'; cv.removeAttribute('style'); cv.setAttribute('aria-hidden', 'true');
	return cv;
}
export function stop(a: Anim) {
	live.delete(a); a.done = true;
	a.cv.remove(); if (pool.length < 48) pool.push(a.cv);
}
function frame(ctx: CanvasRenderingContext2D, img: CanvasImageSource, fr: number[], W: number, H: number, k = 1) {
	const [x, y, w, h, ox, oy] = fr;
	if (ox !== undefined) ctx.drawImage(img, x, y, w, h, ox * k, oy * k, w * k, h * k); // trimmed frame, 1:1 at its offset
	else ctx.drawImage(img, x, y, w, h, 0, 0, W, H);
}
function draw(a: Anim, i: number, j = -1, f = 0) {
	const ctx = a.cv.getContext('2d')!, W = a.cv.width, H = a.cv.height;
	ctx.clearRect(0, 0, W, H);
	if (j < 0 || f <= 0) { frame(ctx, a.sheet.img, a.frames[i], W, H); return; }
	ctx.globalAlpha = 1 - f; frame(ctx, a.sheet.img, a.frames[i], W, H);
	ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = f; frame(ctx, a.sheet.img, a.frames[j], W, H);
	ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}
// ---- crossfade plan, per frame pair i -> i+1: c = share of (opaque) thumbnail pixels changing by > 25 %; from it the
// blend window w (share of the interval that dissolves; 0 = straight cut) and the frame's hold d (in slowed intervals).
// A dissolve between two poses that MOVE shows both poses at once (a ghost), so moving frames are never blended: they cut,
// and are held shorter instead (d 0.6, ~12.5 fps on a 15 fps sheet) so the motion reads as motion, not as a slideshow.
// Calm pairs (idle breathing, glow, the held pose) blend over the whole interval; a big jump (flash cut, the letters'
// ignition, a loop wrap) cuts the same way. Measured (QA blendPlan): idle 0-0.01, win loop 0-0.3,
// join / build-up motion 0.3-0.6, flash / ignition 0.75-1.
const PLAN: [number, number, number][] = [[0.15, 1, 1], [0.3, 0.3, 0.8], [0.6, 0, 0.6], [2, 0, 0.6]]; // [c <=, w, d]
type Plan = { c: number[]; w: number[]; d: number[]; cum: number[]; total: number };
const plans = new WeakMap<number[][], Plan>();
let thumb: CanvasRenderingContext2D | null = null;
function planOf(sheet: Sheet, frames: number[][], cw: number, ch: number): Plan {
	let pl = plans.get(frames); if (pl) return pl;
	const n = frames.length, TW = 24, TH = Math.max(8, Math.round((TW * ch) / cw)), k = TW / cw, c: number[] = [];
	thumb ||= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
	try {
		const px: Uint8ClampedArray[] = [];
		thumb!.canvas.width = TW; thumb!.canvas.height = TH;
		for (const fr of frames) { thumb!.clearRect(0, 0, TW, TH); frame(thumb!, sheet.img, fr, TW, TH, k); px.push(thumb!.getImageData(0, 0, TW, TH).data); }
		for (let i = 0; i < n; i++) {
			const A = px[i], B = px[(i + 1) % n]; let big = 0, any = 0;
			for (let p = 0; p < A.length; p += 4) {
				if (Math.max(A[p + 3], B[p + 3]) < 8) continue; any++;
				if (Math.max(Math.abs(A[p] - B[p]), Math.abs(A[p + 1] - B[p + 1]), Math.abs(A[p + 2] - B[p + 2]), Math.abs(A[p + 3] - B[p + 3])) > 64) big++;
			}
			c.push(any ? +(big / any).toFixed(3) : 0);
		}
	} catch { c.length = 0; for (let i = 0; i < n; i++) c.push(1); } // unreadable: plain steps
	const w: number[] = [], d: number[] = [], cum: number[] = []; let total = 0;
	c.forEach((x, i) => { const [, wi, di] = PLAN.find(([m]) => x <= m)!; w.push(wi); d.push(i === n - 1 ? 1 : di); cum.push(total); total += d[i]; });
	pl = { c, w, d, cum, total }; plans.set(frames, pl); return pl;
}
/** QA: the crossfade plan (change c, blend window w, hold d per frame) of a loaded sheet's anim; null when not loaded. */
export function blendPlan(id: string, name: string) {
	const s = sheets.get(id), df = s?.atlas.anims[name]; if (!s || !df) return null;
	return planOf(s, df.frames, df.canvas ? df.canvas[0] : df.frames[0][2], df.canvas ? df.canvas[1] : df.frames[0][3]);
}
const ease = (x: number) => x * x * (3 - 2 * x); // smoothstep: soft in and out of every dissolve
function tick(t: number) {
	raf = 0;
	for (const a of live) {
		if (!a.cv.isConnected && t - a.t0 > 50) { stop(a); continue; }
		if (t < a.t0) continue;
		if (a.plan) { // crossfade: i -> i+1 (wraps when looping; a one-shot's last frame just holds)
			const P = a.plan, n = a.frames.length; let u = ((t - a.t0) / 1000) * a.fps;
			if (u >= P.total) {
				if (!a.loop) { draw(a, n - 1); live.delete(a); a.onEnd?.(); if (!a.hold && !a.done) stop(a); continue; }
				u %= P.total;
			}
			let i = 0; while (i < n - 1 && P.cum[i + 1] <= u) i++;
			const p = (u - P.cum[i]) / P.d[i], j = i + 1 < n ? i + 1 : a.loop ? 0 : -1, w = j < 0 ? 0 : P.w[i];
			const f = w > 0 && p > 1 - w ? Math.round(ease(Math.min(1, (p - (1 - w)) / w)) * 32) / 32 : 0;
			if (i !== a.last || f !== a.lastF) { a.last = i; a.lastF = f; draw(a, i, j, f); }
			continue;
		}
		let i = Math.floor(((t - a.t0) / 1000) * a.fps);
		if (i >= a.frames.length) {
			if (a.loop) i %= a.frames.length;
			else { draw(a, a.frames.length - 1); live.delete(a); a.onEnd?.(); if (!a.hold && !a.done) stop(a); continue; } // onEnd may already have stopped it (and reused its pooled canvas)
		}
		if (i !== a.last) { a.last = i; draw(a, i); }
	}
	if (live.size) raf = requestAnimationFrame(tick);
}

/** Play sheet `id` animation `name` inside `host`. Returns null when the sheet is not loaded (effects are optional). */
export function play(id: string, name: string, host: Element, o: PlayOpts = {}): Anim | null {
	const sheet = sheets.get(id); const def = sheet?.atlas.anims[name];
	if (!sheet || !def || !host.isConnected) return null;
	const frames = o.reverse ? [...def.frames].reverse() : def.frames;
	const cv = def.canvas ? take(def.canvas[0], def.canvas[1]) : take(frames[0][2], frames[0][3]);
	if (o.cls) cv.className += ' ' + o.cls;
	if (o.style) cv.setAttribute('style', o.style);
	o.prepend ? host.prepend(cv) : host.appendChild(cv);
	const rate = o.rate ?? spriteRate(host);
	const a: Anim = { cv, sheet, frames, fps: (o.fps || def.fps) / rate, loop: o.loop ?? def.loop, hold: !!o.hold, t0: performance.now() + (o.delay || 0) * rate, last: -1, done: false, onEnd: o.onEnd };
	if (o.blend && rate > 1 && frames.length > 1) a.plan = planOf(sheet, frames, cv.width, cv.height); // slowed only: turbo / own pace keep the plain step
	if (o.delay) cv.getContext('2d')!.clearRect(0, 0, cv.width, cv.height);
	else { a.last = 0; draw(a, 0); } // first frame now: a hand-off (one-shot -> loop) never shows an empty canvas for a frame
	live.add(a);
	if (!raf) raf = requestAnimationFrame(tick);
	return a;
}
