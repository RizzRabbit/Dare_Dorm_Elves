// SpriteAnim: tiny shared frame-based sprite player (no Pixi in this DOM renderer).
// A sheet = one image + JSON atlas {anims: {name: {fps, loop, frames: [[x,y,w,h], ...]}}, size:[W,H]}.
// play() draws an animation into a pooled <canvas> placed inside a host element (so it can sit behind or in
// front of DOM content via CSS classes) and advances it on one shared rAF ticker. Options: loop / once, hold
// the last frame, reverse, fps override, delay. Static frames can be shown without a canvas via frameCSS()
// (CSS background-position into the same sheet), which survives innerHTML re-renders.
// Trimmed frames (optional): an anim may set canvas:[W,H] and give frames as [x,y,w,h,ox,oy]; each frame is then drawn
// 1:1 at (ox,oy) on a W x H canvas (e.g. the stack letters band, so mostly-empty frames cost no sheet memory).
export type Atlas = { size: [number, number]; anims: Record<string, { fps: number; loop: boolean; frames: number[][]; canvas?: [number, number] }> };
type Sheet = { img: CanvasImageSource; atlas: Atlas; src: string };
export type PlayOpts = { cls?: string; style?: string; loop?: boolean; hold?: boolean; reverse?: boolean; fps?: number; delay?: number; prepend?: boolean; onEnd?: () => void };
export type Anim = { cv: HTMLCanvasElement; sheet: Sheet; frames: number[][]; fps: number; loop: boolean; hold: boolean; t0: number; last: number; done: boolean; onEnd?: () => void };

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
function draw(a: Anim, i: number) {
	const [x, y, w, h, ox, oy] = a.frames[i], ctx = a.cv.getContext('2d')!;
	ctx.clearRect(0, 0, a.cv.width, a.cv.height);
	if (ox !== undefined) ctx.drawImage(a.sheet.img, x, y, w, h, ox, oy, w, h); // trimmed frame, 1:1 at its offset
	else ctx.drawImage(a.sheet.img, x, y, w, h, 0, 0, a.cv.width, a.cv.height);
}
function tick(t: number) {
	raf = 0;
	for (const a of live) {
		if (!a.cv.isConnected && t - a.t0 > 50) { stop(a); continue; }
		if (t < a.t0) continue;
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
	const a: Anim = { cv, sheet, frames, fps: o.fps || def.fps, loop: o.loop ?? def.loop, hold: !!o.hold, t0: performance.now() + (o.delay || 0), last: -1, done: false, onEnd: o.onEnd };
	if (o.delay) cv.getContext('2d')!.clearRect(0, 0, cv.width, cv.height);
	else { a.last = 0; draw(a, 0); } // first frame now: a hand-off (one-shot -> loop) never shows an empty canvas for a frame
	live.add(a);
	if (!raf) raf = requestAnimationFrame(tick);
	return a;
}
