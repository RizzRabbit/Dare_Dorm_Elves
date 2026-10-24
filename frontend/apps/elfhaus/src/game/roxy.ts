// Full-body Roxy: plays the keyed roxy_full_* atlases (static/assets/atlases, scripts/pack-atlases.py) on a canvas
// with a tiny frame-stepper (no Pixi in this DOM renderer). States per atlases/README.md: idle (loop),
// anticipation (loop), disappointed / excited (once, then back to idle).
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
function tick(t: number) {
	requestAnimationFrame(tick);
	if (!ctx || !cv || t - last < 1000 / FPS) return;
	last = t;
	if (want !== state && anims.has(want)) { state = want; frame = 0; cv.dataset.state = state; }
	let fr = anims.get(state); if (!fr?.length) return;
	if (frame >= fr.length) {
		frame = 0;
		if (!LOOP[state]) { want = state = 'idle'; cv.dataset.state = state; fr = anims.get('idle') as Frame[]; }
	}
	const f = fr[frame++];
	ctx.clearRect(0, 0, cv.width, cv.height);
	ctx.drawImage(f.img, f.x, f.y, f.w, f.h, f.dx, f.dy, f.w, f.h);
}
/** Size and place Roxy: landscape = standing in the gutter left of the reels, ~full height, never over the
 *  reel frame; portrait = large behind the board (the board and HUD draw over her). */
export function placeRoxy(portrait: boolean, frameRect: DOMRect) {
	if (!cv || !roxySize.h) return;
	const W = innerWidth, H = innerHeight, ar = roxySize.w / roxySize.h;
	let h: number, left: number;
	if (portrait) { h = Math.min(H * 0.9, (W * 1.05) / ar); left = W - h * ar * 0.9; }
	else {
		const gutter = frameRect.left - 8; // the sheet's left ~11% is empty, so it may hang off-screen a little
		h = Math.min(H * 0.98, gutter / (ar * 0.89)); left = gutter - h * ar;
	}
	const show = portrait || h >= H * 0.45;
	cv.style.visibility = show ? 'visible' : 'hidden';
	cv.style.height = h + 'px'; cv.style.width = h * ar + 'px'; cv.style.left = left + 'px';
}
/** Starts Roxy; resolves once the idle loop can show (then the other states load in the background). */
export async function initRoxy(onReady: () => void) {
	cv = document.getElementById('roxy') as HTMLCanvasElement | null;
	if (!cv) return;
	try { await load('idle'); } catch (e) { console.warn('roxy atlas missing', e); return; }
	cv.width = roxySize.w; cv.height = roxySize.h; ctx = cv.getContext('2d'); cv.dataset.state = 'idle';
	document.body.classList.add('hasRoxy'); onReady();
	requestAnimationFrame(tick);
	for (const s of ['anticipation', 'excited', 'disappointed'] as RoxyState[]) load(s).catch((e) => console.warn('roxy', s, e));
}
/** Switch state: loops stay until changed; one-shots return to idle by themselves. */
export function roxy(s: RoxyState) { want = s; }
export const roxyState = () => want;
