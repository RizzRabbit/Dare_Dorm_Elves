import { ST, toStage } from './stage';
// Full-body Roxy: plays the keyed roxy_full_* atlases (static/assets/atlases, scripts/pack-atlases.py) on a canvas
// with a tiny frame-stepper (no Pixi in this DOM renderer). States per atlases/README.md: idle (resting frame +
// occasional full clip, see below), anticipation (loop), disappointed / excited (once, then back to idle).
export type RoxyState = 'idle' | 'anticipation' | 'disappointed' | 'excited';
type Page = { url: string; blob: Promise<Blob | null> | null; img: CanvasImageSource | null; dec: Promise<void> | null; bytes: number };
type Frame = { pg: Page; x: number; y: number; w: number; h: number; dx: number; dy: number };
const FPS = 12, LOOP: Record<RoxyState, boolean> = { idle: true, anticipation: true, disappointed: false, excited: false };
const DIR = 'assets/atlases/';
const anims = new Map<RoxyState, Frame[]>(), pagesOf = new Map<RoxyState, Page[]>();
let cv: HTMLCanvasElement | null = null, ctx: CanvasRenderingContext2D | null = null;
let state: RoxyState = 'idle', want: RoxyState = 'idle', frame = 0, last = 0;
export let roxySize = { w: 0, h: 0 };

// Memory: pages are ~2000x1650 RGBA, ~12 MB each decoded (14 pages = ~168 MB if all were kept). Only idle stays
// decoded. The other states keep just their compressed WebP Blobs (~1.4 MB a state) and are decoded on demand when
// roxy(state) is asked for, page by page (page 0 first, so she can start after one decode); they are close()d
// FREE_MS after she has gone back to idle. Decoding stays off the main thread (fetch -> blob -> createImageBitmap):
// drawing from an <img> left Chrome to decode lazily at commit on the main thread (90-280 ms long tasks, 4x trace).
// If a page is not decoded yet when its frame is due, she holds the current frame. Data-driven: any page count
// (meta.related_multi_packs), any frame size (sourceSize), held frames as repeated names in the animation list
// (elfhaus-roxy-p3d's 8-unique-fps loops), so a re-rendered set drops in with `import-art.mjs roxy <dir>`.
const RESIDENT: RoxyState[] = ['idle'], FREE_MS = 4000;
const loadEl = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const bitmaps = typeof createImageBitmap === 'function';
const fetchBlob = (pg: Page) => (pg.blob ||= fetch(pg.url).then((r) => (r.ok ? r.blob() : null)).catch(() => null));
function decodePage(pg: Page) {
	return (pg.dec ||= (async () => {
		const b = bitmaps ? await fetchBlob(pg) : null;
		let img: CanvasImageSource | null = null;
		if (b) try { img = await createImageBitmap(b); } catch { /* fall through */ }
		pg.img = img || (await loadEl(pg.url));
	})().catch((e) => { pg.dec = null; console.warn('roxy page', pg.url, e); }));
}
function freePage(pg: Page) { const i = pg.img as ImageBitmap | null; pg.img = null; pg.dec = null; if (i && typeof i.close === 'function') i.close(); }
async function load(s: RoxyState) {
	const name = `roxy_full_${s}`;
	const first = await (await fetch(`${DIR}${name}_0.json`)).json();
	const jsons = [first, ...(await Promise.all((first.meta.related_multi_packs || []).map((p: string) => fetch(DIR + p).then((r) => r.json()))))];
	const frames: Frame[] = [], pages: Page[] = [];
	for (const js of jsons) {
		const pg: Page = { url: DIR + js.meta.image, blob: null, img: null, dec: null, bytes: js.meta.size.w * js.meta.size.h * 4 };
		pages.push(pg);
		for (const n of js.animations[name] || Object.values(js.animations)[0] as string[]) {
			const f = js.frames[n];
			roxySize = { w: f.sourceSize.w, h: f.sourceSize.h };
			frames.push({ pg, x: f.frame.x, y: f.frame.y, w: f.frame.w, h: f.frame.h, dx: f.spriteSourceSize.x, dy: f.spriteSourceSize.y });
		}
	}
	anims.set(s, frames); pagesOf.set(s, pages);
	if (RESIDENT.includes(s)) await Promise.all(pages.map(decodePage));
	else await Promise.all(pages.map(fetchBlob)); // compressed only; the loading screen covers the download
}
/** Decode a state's pages in order (page 0 first). */
function warm(s: RoxyState) { const pg = pagesOf.get(s); if (pg) pg.reduce((p, x) => p.then(() => decodePage(x)), Promise.resolve()); }
const lastUsed: Partial<Record<RoxyState, number>> = {};
function sweep(t: number) {
	for (const [s, pages] of pagesOf) {
		if (RESIDENT.includes(s) || s === state || s === want) { lastUsed[s] = t; continue; }
		if (t - (lastUsed[s] || 0) > FREE_MS) pages.forEach((pg) => pg.img && freePage(pg));
	}
}
/** Decoded Roxy bytes right now (debug / perf tooling: window.__roxyMem()). */
export function roxyMem() {
	const by: Record<string, number> = {}; let total = 0;
	for (const [s, pages] of pagesOf) { const b = pages.reduce((a, p) => a + (p.img ? p.bytes : 0), 0); by[s] = +(b / 2 ** 20).toFixed(1); total += b; }
	return { MB: +(total / 2 ** 20).toFixed(1), by };
}
(window as any).__roxyMem = roxyMem;
// Idle behaviour: she holds a resting frame (eyes open, no wink) with a slight code-driven sway, and every 15-30s
// plays the full idle clip once. The clip is played rotated (REST+1 .. end, 0 .. REST) so it starts right after
// and ends exactly on the resting pose; state switches cross-fade over ~150ms so nothing pops.
const REST = 8, FADE_MS = 150;
let resting = true, clipPos = 0, nextClipAt = 0, cur: Frame | null = null, fadeFrom: Frame | null = null, fadeT0 = 0;
const schedule = (t: number) => (nextClipAt = t + 15000 + Math.random() * 15000);
function setFrame(f: Frame, t: number, fade = false) {
	if (fade && cur && cur !== f) { fadeFrom = cur; fadeT0 = t; }
	cur = f;
}
function step(t: number) {
	if (!cv) return;
	const ok = (f?: Frame) => !!f?.pg.img;
	if (want !== state && ok(anims.get(want)?.[want === 'idle' ? Math.min(REST, anims.get(want)!.length - 1) : 0])) {
		state = want; frame = 0; cv.dataset.state = state;
		if (state === 'idle') { resting = true; schedule(t); }
		const fr = anims.get(state) as Frame[];
		setFrame(state === 'idle' ? fr[Math.min(REST, fr.length - 1)] : fr[frame++], t, true);
		return;
	}
	const fr = anims.get(state); if (!fr?.length) return;
	if (state === 'idle') {
		const rest = Math.min(REST, fr.length - 1);
		if (resting) {
			if (t >= nextClipAt) { resting = false; clipPos = 0; cv.dataset.idle = 'clip'; }
			else { setFrame(fr[rest], t, cur !== fr[rest]); return; }
		}
		const nf = fr[(rest + 1 + clipPos) % fr.length]; if (!ok(nf)) return;
		setFrame(nf, t);
		if (++clipPos >= fr.length) { resting = true; cv.dataset.idle = 'rest'; schedule(t); }
		return;
	}
	if (frame >= fr.length) {
		if (LOOP[state]) frame = 0;
		else { want = 'idle'; step(t); return; }
	}
	if (!ok(fr[frame])) { warm(state); return; } // page still decoding: hold
	setFrame(fr[frame++], t);
}
const blit = (f: Frame) => { if (f.pg.img) ctx!.drawImage(f.pg.img, f.x, f.y, f.w, f.h, f.dx, f.dy, f.w, f.h); };
let swept = 0;
function tick(t: number) {
	requestAnimationFrame(tick);
	if (!ctx || !cv) return;
	if (!nextClipAt) schedule(t);
	// slow sway about her feet: ±0.6° over ~5s, plus a 3px bob on a slightly different period
	const rot = 0.6 * Math.sin((t / 5200) * Math.PI * 2), bob = 3 * Math.sin((t / 4300) * Math.PI * 2 + 1);
	cv.style.transform = `translateY(${bob.toFixed(2)}px) rotate(${rot.toFixed(3)}deg)`;
	if (t - last >= 1000 / FPS) { last = t; step(t); }
	if (t - swept > 1000) { swept = t; sweep(t); }
	if (!cur) return;
	ctx.clearRect(0, 0, cv.width, cv.height);
	ctx.globalAlpha = 1; blit(cur);
	if (fadeFrom) {
		const p = (t - fadeT0) / FADE_MS;
		if (p >= 1) fadeFrom = null;
		else { ctx.globalAlpha = 1 - p; blit(fadeFrom); ctx.globalAlpha = 1; }
	}
}
/** Size and place Roxy: landscape = standing in the gutter left of the reels, ~full height, never over the
 *  reel frame; portrait = head to waist above the board, in front of the board's crown (marquee), cut off at the
 *  board's top edge so she never covers the reels or the HUD. */
export function placeRoxy(portrait: boolean, frameRect: DOMRect) {
	if (!cv || !roxySize.h) return;
	const W = ST.w, H = ST.h, ar = roxySize.w / roxySize.h;
	let h: number, left: number;
	let top: number | null = null;
	// portrait: Roxy lives inside #app so she can sit above the crown (z-index) yet under the logo, HUD and overlays;
	// landscape: back to her place before #app (behind the whole game column, as before).
	const app = document.getElementById('app');
	if (app) { if (portrait && cv.parentElement !== app) app.appendChild(cv); else if (!portrait && cv.parentElement === app) app.before(cv); }
	const bEl = document.getElementById('board'); const bTop = bEl ? toStage(bEl.getBoundingClientRect()).top : frameRect.top + 10;
	const cut = Math.min(bTop, frameRect.top + 10) - 1;
	if (portrait) {
		// Head to waist between the title and the board (user rule: on mobile Roxy is never hidden behind the board).
		// Sheet fractions (idle): hair top ~3%, face ~14% (x ~43% of the width), waist ~43%, thong ~45%. Her waist sits on
		// the cut line at the board's top edge (see clipPath below), so everything above it shows; she draws over the
		// crown (z-index, CSS body.portrait #roxy) and under the logo, overlays and HUD.
		const logoEl = document.getElementById('logo'); const logo = logoEl ? toStage(logoEl.getBoundingClientRect()) : null;
		const y0 = logo && logo.height ? logo.bottom - 8 : 8;
		const space = Math.max(60, cut - y0);
		h = Math.min(space / 0.41, H * 0.66);
		top = cut - h * 0.44;
		left = Math.min(W * 0.6 - h * ar * 0.43, W - h * ar * 0.62);
	} else {
		const gutter = frameRect.left - 8; // the sheet's left ~11% is empty, so it may hang off-screen a little
		h = Math.min(H * 0.98, gutter / (ar * 0.89)); left = gutter - h * ar;
	}
	const show = portrait || h >= H * 0.45;
	cv.style.visibility = show ? 'visible' : 'hidden';
	cv.style.height = h + 'px'; cv.style.width = h * ar + 'px'; cv.style.left = left + 'px';
	cv.style.top = top == null ? '' : top + 'px'; cv.style.bottom = top == null ? '' : 'auto';
	// aifix: soft contact shadow under her sneakers (landscape only; feet span ~14-76% of the sheet width, soles at ~97.8%)
	const sh = document.getElementById('roxySh');
	if (sh) { const w = h * ar; sh.style.display = top == null && show ? 'block' : 'none';
		sh.style.left = (left + w * 0.08) + 'px'; sh.style.width = (w * 0.76) + 'px'; sh.style.height = (h * 0.045) + 'px'; sh.style.top = (H - h * (0.022 + 0.0225)) + 'px'; }
	// portrait: cut her off at the board frame's top edge, so she never covers the reels.
	cv.style.clipPath = top == null ? '' : `inset(0 0 ${Math.max(0, h - (cut - top))}px 0)`;
}
/** Starts Roxy: calls onReady as soon as the idle loop can show; resolves once every state's sheets are downloaded
 *  (the loading screen waits on it; only idle is decoded, see RESIDENT). */
export async function initRoxy(onReady: () => void) {
	cv = document.getElementById('roxy') as HTMLCanvasElement | null;
	if (!cv) return;
	try { await load('idle'); } catch (e) { console.warn('roxy atlas missing', e); return; }
	cv.width = roxySize.w; cv.height = roxySize.h; ctx = cv.getContext('2d'); cv.dataset.state = 'idle'; cv.dataset.idle = 'rest';
	cur = anims.get('idle')![Math.min(REST, anims.get('idle')!.length - 1)];
	document.body.classList.add('hasRoxy'); onReady();
	requestAnimationFrame(tick);
	await Promise.all((['anticipation', 'excited', 'disappointed'] as RoxyState[]).map((s) => load(s).catch((e) => console.warn('roxy', s, e))));
}
/** Switch state: loops stay until changed; one-shots return to idle by themselves. */
export function roxy(s: RoxyState) { want = s; lastUsed[s] = performance.now(); warm(s); }
export const roxyState = () => want;
