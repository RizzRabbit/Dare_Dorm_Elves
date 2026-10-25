// SpriteAnim: tiny shared frame-based sprite player (no Pixi in this DOM renderer).
// A sheet = one image + JSON atlas {anims: {name: {fps, loop, frames: [[x,y,w,h], ...]}}, size:[W,H]}.
// play() draws an animation into a pooled <canvas> placed inside a host element (so it can sit behind or in
// front of DOM content via CSS classes) and advances it on one shared rAF ticker. Options: loop / once, hold
// the last frame, reverse, fps override, delay. Static frames can be shown without a canvas via frameCSS()
// (CSS background-position into the same sheet), which survives innerHTML re-renders.
export type Atlas = { size: [number, number]; anims: Record<string, { fps: number; loop: boolean; frames: number[][] }> };
type Sheet = { img: CanvasImageSource; atlas: Atlas; src: string };
export type PlayOpts = { cls?: string; style?: string; loop?: boolean; hold?: boolean; reverse?: boolean; fps?: number; delay?: number; prepend?: boolean; onEnd?: () => void };
export type Anim = { cv: HTMLCanvasElement; sheet: Sheet; frames: number[][]; fps: number; loop: boolean; hold: boolean; t0: number; last: number; done: boolean; onEnd?: () => void };

const sheets = new Map<string, Sheet>();
const pool: HTMLCanvasElement[] = [];
const live = new Set<Anim>();
let raf = 0;

export function loadSheet(id: string, src: string, atlas: Atlas) {
	return new Promise<void>((res, rej) => {
		const img = new Image();
		// decoded once during loading into an ImageBitmap that canvases draw from, so a sheet is never lazily
		// (re)decoded on the main thread mid-spin (an <img> source can be evicted and re-decoded at commit)
		img.onload = () => img.decode().catch(() => {})
			.then(() => (typeof createImageBitmap === 'function' ? createImageBitmap(img).catch(() => img) : img))
			.then((bm: CanvasImageSource) => { warm(bm); sheets.set(id, { img: bm, atlas, src }); res(); });
		img.onerror = rej; img.src = src;
	});
}
let warmCv: HTMLCanvasElement | null = null;
function warm(img: CanvasImageSource) { try { warmCv ||= document.createElement('canvas'); warmCv.width = warmCv.height = 1; warmCv.getContext('2d')!.drawImage(img, 0, 0, 1, 1); } catch { /* ignore */ } }
export const hasSheet = (id: string) => sheets.has(id);

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
	const [x, y, w, h] = a.frames[i], ctx = a.cv.getContext('2d')!;
	ctx.clearRect(0, 0, a.cv.width, a.cv.height); ctx.drawImage(a.sheet.img, x, y, w, h, 0, 0, a.cv.width, a.cv.height);
}
function tick(t: number) {
	raf = 0;
	for (const a of live) {
		if (!a.cv.isConnected && t - a.t0 > 50) { stop(a); continue; }
		if (t < a.t0) continue;
		let i = Math.floor(((t - a.t0) / 1000) * a.fps);
		if (i >= a.frames.length) {
			if (a.loop) i %= a.frames.length;
			else { draw(a, a.frames.length - 1); live.delete(a); a.onEnd?.(); if (!a.hold) stop(a); continue; }
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
	const cv = take(frames[0][2], frames[0][3]);
	if (o.cls) cv.className += ' ' + o.cls;
	if (o.style) cv.setAttribute('style', o.style);
	o.prepend ? host.prepend(cv) : host.appendChild(cv);
	const a: Anim = { cv, sheet, frames, fps: o.fps || def.fps, loop: o.loop ?? def.loop, hold: !!o.hold, t0: performance.now() + (o.delay || 0), last: -1, done: false, onEnd: o.onEnd };
	cv.getContext('2d')!.clearRect(0, 0, cv.width, cv.height);
	live.add(a);
	if (!raf) raf = requestAnimationFrame(tick);
	return a;
}
