import { ST, toStage } from './stage';
import { S } from './ui';
// Roxy (elfhaus-roxy-still): ONE painted still (static/assets/roxy/roxy_base.webp, 2x = 852x1728 backing for the
// 426x864 logical frame) plus small face overlays drawn source-over at their offsets (roxy.json). All motion is
// code-side, transform + opacity only: face crossfades / blinks on the canvas, body sway / breath / bounce as a CSS
// transform about her feet. Everything stays resident (~6.5 MB decoded); no frame sheets, no lazy decode.
// States: idle (base face, random blinks), anticipation (excited bounce loop, eager/excited faces),
// excited (one-shot; from anticipation = a small happy hop first), disappointed (one-shot; from anticipation = the
// bounce settles first). One-shots return to idle by themselves. Timings: elfhaus-roxy-still/INTEGRATION.md.
export type RoxyState = 'idle' | 'anticipation' | 'disappointed' | 'excited';
type Face = 'blink' | 'eager' | 'excited' | 'wink_eye' | 'disappointed';
const DIR = 'assets/roxy/';
let cv: HTMLCanvasElement | null = null, ctx: CanvasRenderingContext2D | null = null, sh: HTMLElement | null = null;
let want: RoxyState = 'idle';
export let roxySize = { w: 0, h: 0 };
let base: CanvasImageSource | null = null, PIV = [373.2, 1698], FIGH = 1660;
const faces = new Map<Face, { img: CanvasImageSource; x: number; y: number; w: number; h: number }>();
let bytes = 0;
/** Decoded Roxy bytes right now (debug / perf tooling: window.__roxyMem()). */
export function roxyMem() { return { MB: +(bytes / 2 ** 20).toFixed(1), by: { still: +(bytes / 2 ** 20).toFixed(1) } }; }
(window as any).__roxyMem = roxyMem;
const loadImg = async (url: string): Promise<CanvasImageSource> => {
	if (typeof createImageBitmap === 'function') {
		try { const r = await fetch(url); if (r.ok) return await createImageBitmap(await r.blob()); } catch { /* fall back */ }
	}
	return await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
};
async function load() {
	const meta = await (await fetch(DIR + 'roxy.json')).json();
	PIV = meta.pivot_feet; FIGH = (850 - 20) * (meta.w / meta.logical[0]);
	const [b, ...fs] = await Promise.all([loadImg(DIR + meta.base), ...Object.keys(meta.faces).map((n) => loadImg(`${DIR}roxy_face_${n}.webp`))]);
	base = b; bytes = meta.w * meta.h * 4;
	Object.entries(meta.faces as Record<Face, number[]>).forEach(([n, [x, y, w, h]], i) => { faces.set(n as Face, { img: fs[i], x, y, w, h }); bytes += w * h * 4; });
	roxySize = { w: meta.logical[0], h: meta.logical[1] };
	return meta;
}

// ---- motion constants (ms; calm pace, turbo shorter + smaller) ----
const turbo = () => !!S.turbo;
const reduced = () => document.body.classList.contains('calm') || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
const noMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const P = () => turbo()
	? { T: 500, A: 0.015, C: 0.26, SQ: 0.006, SX: 0.003, RAMP: 400, HOP: [110, 340, 120], HOP_A: 0.02, HOP_SQ: 0.009, DECAY: 300, XF: 120, EXC: 800, DIS: 800, ALT: 900 }
	: { T: 750, A: 0.025, C: 0.26, SQ: 0.012, SX: 0.006, RAMP: 1200, HOP: [180, 560, 200], HOP_A: 0.032, HOP_SQ: 0.016, DECAY: 600, XF: 300, EXC: 2200, DIS: 2000, ALT: 1500 };
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * x));

// ---- faces: state face crossfade + momentary pulse (blink / wink_eye) ----
let faceTo: Face | null = null, faceFrom: Face | null = null, fT0 = 0, fDur = 300;
function setFace(f: Face | null, t: number) {
	if (f === faceTo) return;
	faceFrom = faceTo; faceTo = f; fT0 = t; fDur = P().XF; dirty = true;
}
let pulse: { f: Face; t0: number; a: number; h: number; b: number } | null = null, nextBlink = 0;
const blinkAt = (t: number) => (nextBlink = t + 3500 + Math.random() * 2500);
function startPulse(f: Face, t: number, a: number, h: number, b: number) { pulse = { f, t0: t, a, h, b }; dirty = true; }

// ---- state machine ----
type Mode = 'idle' | 'ant' | 'hop' | 'settle';
let mode: Mode = 'idle', antT0 = 0, hopT0 = 0, hopPending = false, settleT0 = 0, untilIdle = 0, antAlt = 0, winkAt = 0;
let lastPh = 0, w = 0, dirty = true, lastT = 0; // w: sway/breath -> bounce hand-over weight
function enter(s: RoxyState, t: number) {
	const p = P();
	if (s === 'anticipation') {
		if (mode === 'ant' && !hopPending) return;
		if (mode !== 'ant') { antT0 = t; lastPh = 0; }
		mode = reduced() ? 'idle' : 'ant'; hopPending = false; untilIdle = 0;
		setFace('eager', t); antAlt = t + p.ALT; winkAt = turbo() ? 0 : t + 2200;
	} else if (s === 'excited') {
		if (mode === 'ant') { hopPending = true; } // hop at the next bounce contact (continuous), then hold excited
		setFace('excited', t); antAlt = 0; untilIdle = 0;
		if (mode !== 'ant') { untilIdle = t + p.EXC; winkAt = turbo() ? 0 : t + 900; }
	} else if (s === 'disappointed') {
		if (mode === 'ant') { mode = 'settle'; settleT0 = t; }
		setFace('disappointed', t); antAlt = 0; winkAt = 0; untilIdle = t + p.DIS; if (pulse?.f === 'blink') pulse = null;
	} else {
		if (mode === 'ant') { mode = 'settle'; settleT0 = t; }
		setFace(null, t); antAlt = 0; winkAt = 0; untilIdle = 0; hopPending = false;
	}
}
// bounce lift (2x px, up = positive) and squash for the anticipation loop at time t
function bounce(t: number) {
	const p = P(), ph = (((t - antT0) / p.T) % 1 + 1) % 1, env = ease((t - antT0) / p.RAMP);
	let lift = 0, sy = 0, sx = 0;
	if (ph < p.C) { const s = Math.sin((Math.PI * ph) / p.C); sy = -p.SQ * env * s; sx = p.SX * env * s; }
	else lift = p.A * FIGH * env * Math.sin((Math.PI * (ph - p.C)) / (1 - p.C));
	return { lift, sy, sx, ph };
}
function hop(t: number) {
	const p = P(), [a, b, c] = p.HOP, u = t - hopT0;
	let lift = 0, sy = 0, sx = 0;
	if (u < a) { const s = Math.sin((Math.PI * u) / a); sy = -p.HOP_SQ * s; sx = (p.HOP_SQ / 2) * s; }
	else if (u < a + b) lift = p.HOP_A * FIGH * Math.sin((Math.PI * (u - a)) / b);
	else if (u < a + b + c) { const s = Math.sin((Math.PI * (u - a - b)) / c); sy = -p.HOP_SQ * 0.8 * s; sx = (p.HOP_SQ / 2) * 0.8 * s; }
	return { lift, sy, sx, done: u >= a + b + c };
}
function motion(t: number) {
	const p = P(); let m = { lift: 0, sy: 0, sx: 0 };
	if (mode === 'ant') {
		const b = bounce(t);
		if (hopPending && !reduced()) {
			// queue the hop to the next contact so the loop flows straight into it
			if (b.ph < lastPh) { mode = 'hop'; hopT0 = t; hopPending = false; untilIdle = 0; }
		}
		lastPh = b.ph;
		if (mode === 'ant') m = b;
	}
	if (mode === 'hop') { const h = hop(t); m = h; if (h.done) { mode = 'idle'; untilIdle = t + p.EXC; winkAt = turbo() ? 0 : t + 300; } }
	if (mode === 'settle') {
		const k = 1 - ease((t - settleT0) / p.DECAY), b = bounce(t);
		m = { lift: b.lift * k, sy: b.sy * k, sx: b.sx * k };
		if (k <= 0) mode = 'idle';
	}
	return m;
}
function tick(t: number) {
	requestAnimationFrame(tick);
	if (!ctx || !cv || !base) return;
	const dt = Math.min(100, lastT ? t - lastT : 16); lastT = t;
	const p = P();
	if (want !== curState) { curState = want; enter(want, t); }
	// timed face beats
	if (antAlt && t >= antAlt && mode === 'ant') { setFace(faceTo === 'eager' ? 'excited' : 'eager', t); antAlt = t + p.ALT; }
	if (winkAt && t >= winkAt && faceTo === 'excited' && !pulse) { startPulse('wink_eye', t, 150, 450, 200); winkAt = 0; }
	if (untilIdle && t >= untilIdle && mode !== 'hop' && !hopPending) { untilIdle = 0; want = curState = 'idle'; cv.dataset.state = 'idle'; enter('idle', t); }
	if (!nextBlink) blinkAt(t);
	if (t >= nextBlink) { if (!pulse && faceTo !== 'disappointed') startPulse('blink', t, 90, 120, 90); blinkAt(t); }
	// body: sway + breath hand over to the bounce (w in over 0.4 s, out over 0.6 s), all about the feet
	const m = motion(t);
	const tgt = mode === 'idle' ? 0 : 1;
	w = tgt > w ? Math.min(1, w + dt / 400) : Math.max(0, w - dt / 600);
	const we = ease(w), calm = document.body.classList.contains('calm'), still = noMotion();
	const rot = still ? 0 : (calm ? 0.3 : 0.6 - 0.3 * we) * Math.sin((t / 6500) * Math.PI * 2);
	const br = still ? 0 : (calm ? 0.0015 : 0.003 * (1 - we)) * (1 - Math.cos((t / 4000) * Math.PI * 2));
	const k = roxySize.h / (cv.height || 1), ty = -(m.lift * k); // 2x px -> logical px (CSS scales with the element)
	const sc = (cv.clientHeight || roxySize.h) / roxySize.h;
	cv.style.transform = `translateY(${(ty * sc).toFixed(2)}px) rotate(${rot.toFixed(3)}deg) scale(${(1 + m.sx).toFixed(4)}, ${(1 + br + m.sy).toFixed(4)})`;
	if (sh) { const u = Math.min(1, m.lift / (0.035 * FIGH)); sh.style.transform = `scaleX(${(1 - 0.25 * u).toFixed(3)})`; sh.style.opacity = (0.9 * (1 - 0.45 * u)).toFixed(3); }
	// canvas: only redraw while a face fade or pulse runs
	const fp = (t - fT0) / fDur; let pa = 0;
	if (pulse) {
		const u = t - pulse.t0, { a, h, b } = pulse;
		pa = u < a ? ease(u / a) : u < a + h ? 1 : u < a + h + b ? 1 - ease((u - a - h) / b) : -1;
		if (pa < 0) { pulse = null; pa = 0; dirty = true; }
	}
	if (!dirty && fp >= 1 && !pulse) return;
	dirty = false;
	ctx.globalAlpha = 1; ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(base, 0, 0);
	const e = ease(fp);
	if (fp < 1 && faceFrom) draw(faceFrom, 1 - e);
	if (faceTo) draw(faceTo, fp < 1 ? e : 1);
	if (fp >= 1) faceFrom = null;
	if (pulse && pa > 0) draw(pulse.f, pa);
	ctx.globalAlpha = 1;
}
let curState: RoxyState = 'idle';
function draw(f: Face, a: number) { const o = faces.get(f); if (!o || a <= 0) return; ctx!.globalAlpha = a; ctx!.drawImage(o.img, o.x, o.y, o.w, o.h); }
/** Size and place Roxy: landscape = standing in the gutter left of the reels, ~full height, never over the
 *  reel frame; portrait = large behind the board (the board and HUD draw over her). */
export function placeRoxy(portrait: boolean, frameRect: DOMRect) {
	if (!cv || !roxySize.h) return;
	const W = ST.w, H = ST.h, ar = roxySize.w / roxySize.h;
	let h: number, left: number;
	let top: number | null = null;
	if (portrait) {
		// Board sits low; Roxy's head and shoulders fill the space between the title and the board, face offset
		// right of center so it is never behind the board or the title. Sheet fractions: hair top ~4%, face ~14%
		// (x ~43% of the width), shoulders ~27% of the height.
		const logoEl = document.getElementById('logo'); const logo = logoEl ? toStage(logoEl.getBoundingClientRect()) : null; 
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
	// aifix: soft contact shadow under her sneakers (landscape only; feet span ~14-76% of the sheet width, soles at ~97.8%)
	const sh = document.getElementById('roxySh');
	if (sh) { const w = h * ar; sh.style.display = top == null && show ? 'block' : 'none';
		sh.style.left = (left + w * 0.08) + 'px'; sh.style.width = (w * 0.76) + 'px'; sh.style.height = (h * 0.045) + 'px'; sh.style.top = (H - h * (0.022 + 0.0225)) + 'px'; }
	// portrait: only her head and shoulders, above the board. Cut her off just under the board frame's top edge: the
	// reel window is translucent, so anything lower showed her whole body (waist, thong) through and behind the cells.
	const bEl = document.getElementById('board'); const bTop = bEl ? toStage(bEl.getBoundingClientRect()).top : frameRect.top + 10;
	cv.style.clipPath = top == null ? '' : `inset(0 0 ${Math.max(0, h - (Math.min(bTop, frameRect.top + 10) - 1 - top))}px 0)`;
}
/** Starts Roxy: loads the still + faces (~0.24 MB), shows her, then resolves. */
export async function initRoxy(onReady: () => void) {
	cv = document.getElementById('roxy') as HTMLCanvasElement | null;
	if (!cv) return;
	let meta: any;
	try { meta = await load(); } catch (e) { console.warn('roxy assets missing', e); return; }
	cv.width = meta.w; cv.height = meta.h; ctx = cv.getContext('2d'); cv.dataset.state = 'idle';
	cv.style.transformOrigin = `${((PIV[0] / meta.w) * 100).toFixed(2)}% ${((PIV[1] / meta.h) * 100).toFixed(2)}%`; // her feet
	sh = document.getElementById('roxySh'); if (sh) sh.style.transformOrigin = '50% 50%';
	document.body.classList.add('hasRoxy'); onReady();
	requestAnimationFrame(tick);
}
/** Switch state: anticipation loops until changed; excited / disappointed return to idle by themselves. */
export function roxy(s: RoxyState) { want = s; if (cv) cv.dataset.state = s; }
export const roxyState = () => want;
(window as any).__roxy = roxy; // debug / perf tooling: window.__roxy('anticipation') etc.
