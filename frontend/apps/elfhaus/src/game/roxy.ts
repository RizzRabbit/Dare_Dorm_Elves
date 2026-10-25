// Full-body Roxy: plays the keyed roxy_full_* atlases (static/assets/atlases, scripts/pack-atlases.py) on a canvas
// with a tiny frame-stepper (no Pixi in this DOM renderer). States per atlases/README.md: idle (resting frame +
// occasional full clip, see below), anticipation (loop), disappointed / excited (once, then back to idle).
export type RoxyState = 'idle' | 'anticipation' | 'disappointed' | 'excited';
type Frame = { img: HTMLImageElement; x: number; y: number; w: number; h: number; dx: number; dy: number };
const FPS = 12, LOOP: Record<RoxyState, boolean> = { idle: true, anticipation: true, disappointed: false, excited: false };
const DIR = 'assets/atlases/';
const anims = new Map<RoxyState, Frame[]>();
let cv: HTMLCanvasElement | null = null, ctx: CanvasRenderingContext2D | null = null;
let state: RoxyState = 'idle', want: RoxyState = 'idle', frame = 0, last = 0;
export let roxySize = { w: 0, h: 0 };

const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
async function load(s: RoxyState) {
	const name = `roxy_full_${s}`;
	const first = await (await fetch(`${DIR}${name}_0.json`)).json();
	const pages = [first, ...(await Promise.all((first.meta.related_multi_packs || []).map((p: string) => fetch(DIR + p).then((r) => r.json()))))];
	const frames: Frame[] = [];
	for (const pg of pages) {
		const img = await loadImg(DIR + pg.meta.image);
		for (const n of pg.animations[name]) {
			const f = pg.frames[n];
			roxySize = { w: f.sourceSize.w, h: f.sourceSize.h };
			frames.push({ img, x: f.frame.x, y: f.frame.y, w: f.frame.w, h: f.frame.h, dx: f.spriteSourceSize.x, dy: f.spriteSourceSize.y });
		}
	}
	anims.set(s, frames);
}
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
	if (want !== state && anims.has(want)) {
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
		setFrame(fr[(rest + 1 + clipPos) % fr.length], t);
		if (++clipPos >= fr.length) { resting = true; cv.dataset.idle = 'rest'; schedule(t); }
		return;
	}
	if (frame >= fr.length) {
		if (LOOP[state]) frame = 0;
		else { want = 'idle'; step(t); return; }
	}
	setFrame(fr[frame++], t);
}
const blit = (f: Frame) => ctx!.drawImage(f.img, f.x, f.y, f.w, f.h, f.dx, f.dy, f.w, f.h);
function tick(t: number) {
	requestAnimationFrame(tick);
	if (!ctx || !cv) return;
	if (!nextClipAt) schedule(t);
	// slow sway about her feet: ±0.6° over ~5s, plus a 3px bob on a slightly different period
	const rot = 0.6 * Math.sin((t / 5200) * Math.PI * 2), bob = 3 * Math.sin((t / 4300) * Math.PI * 2 + 1);
	cv.style.transform = `translateY(${bob.toFixed(2)}px) rotate(${rot.toFixed(3)}deg)`;
	if (t - last >= 1000 / FPS) { last = t; step(t); }
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
 *  reel frame; portrait = large behind the board (the board and HUD draw over her). */
export function placeRoxy(portrait: boolean, frameRect: DOMRect) {
	if (!cv || !roxySize.h) return;
	const W = innerWidth, H = innerHeight, ar = roxySize.w / roxySize.h;
	let h: number, left: number;
	let top: number | null = null;
	if (portrait) {
		// Board sits low; Roxy's head and shoulders fill the space between the title and the board, face offset
		// right of center so it is never behind the board or the title. Sheet fractions: hair top ~4%, face ~14%
		// (x ~43% of the width), shoulders ~27% of the height.
		const logo = document.getElementById('logo')?.getBoundingClientRect();
		const y0 = logo && logo.height ? logo.bottom - 8 : 8;
		const space = Math.max(80, frameRect.top - y0);
		h = Math.min(H * 1.2, (W * 1.25) / ar, space / 0.27);
		top = y0 - h * 0.04;
		left = Math.min(W * 0.6 - h * ar * 0.43, W - h * ar * 0.62);
	} else {
		const gutter = frameRect.left - 8; // the sheet's left ~11% is empty, so it may hang off-screen a little
		h = Math.min(H * 0.98, gutter / (ar * 0.89)); left = gutter - h * ar;
	}
	const show = portrait || h >= H * 0.45;
	cv.style.visibility = show ? 'visible' : 'hidden';
	cv.style.height = h + 'px'; cv.style.width = h * ar + 'px'; cv.style.left = left + 'px';
	cv.style.top = top == null ? '' : top + 'px'; cv.style.bottom = top == null ? '' : 'auto';
	// portrait: cut her off at the board's bottom edge so nothing of her shows between the board and the controls
	cv.style.clipPath = top == null ? '' : `inset(0 0 ${Math.max(0, h - (frameRect.bottom - 6 - top))}px 0)`;
}
/** Starts Roxy: calls onReady as soon as the idle loop can show; resolves once every state's sheets are loaded
 *  (the loading screen waits on it). */
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
export function roxy(s: RoxyState) { want = s; }
export const roxyState = () => want;
