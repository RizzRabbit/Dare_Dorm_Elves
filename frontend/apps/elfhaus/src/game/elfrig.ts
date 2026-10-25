// ElfRig: per-elf puppet layers for the win screens (max win: Coco | Jade | Delilah | Roxy | Vi; big win: Vi | Roxy | Coco).
// Each elf is her OWN sprite sheet (full base frame + one face patch per drawn expression + blush / heart overlays) on her own canvas, and gets
// transform/opacity-only secondary motion here: idle bob + sway (own period/phase), squash-and-stretch + head tilt on every
// expression change, a hop on the peak, shoulder-giggle shakes on laughs, a staggered ease-out-back rise-in.
// Expressions step on a fixed 30 fps clock (even frame durations; every change runs through 1-4 drawn in-between frames
// - anticipation squint, half-rolled eyes / half-open mouth, half-lids - so nothing ever cross-fades two faces). Motion
// updates every rAF from one shared clock; nothing is stepped by setTimeout. Each elf sheet carries a bleed band under
// the elves stacked above her, so the small relative motion never opens a seam.
import { sheetOf } from './sprite';

export type Step = [state: string, frames: number];
export type Fx = 'squash' | 'tilt' | 'tilt0' | 'hop' | 'giggle';
export type ElfCfg = { id: string; trans: Record<string, Step[]>; fx: Record<string, Fx[]>; blush?: Record<string, number>; heartOn?: string;
	blink?: [string, string, number, number]; base: string };     // blink: [state, base, minMs, maxMs]
type Meta = { anims: Record<string, { frames: number[][]; canvas?: [number, number] }>; box: [number, number, number, number]; group: [number, number]; z: number; head: [number, number]; states: string[] };
type Ev = { k: Fx; t: number; a: number };
const FPS = 30, FMS = 1000 / FPS;
/** Global tempo of the elf motion (1 = round-4 speed). Stretches idle periods, the in-between holds, squash/tilt/hop,
 *  the blush/heart ramps, the rise-in and its stagger; idle amplitudes shrink a little as it slows. Timelines in
 *  maxwin.ts / bigwinElves.ts scale their beats with TEMPO (see there). */
export const SLOW = 2;                            // <- the one speed knob: 2 = half the round-4 speed
export const TEMPO = 1.8;                         // stretch for the scripted beats (ahegao holds, gaps between elves)
const AMP = 1 / Math.pow(SLOW, 0.4);              // smaller idle bob/sway when slower
const GIGGLE_MS = 280;                            // one shoulder bounce: ~3.6 Hz
const T_ = (ms: number) => ms * SLOW;

/** cubic-bezier(x1,y1,x2,y2) easing, solved for x like CSS. */
export function bez(x1: number, y1: number, x2: number, y2: number) {
	const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
	const X = (t: number) => ((ax * t + bx) * t + cx) * t, Y = (t: number) => ((ay * t + by) * t + cy) * t, D = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
	return (x: number) => {
		if (x <= 0) return 0; if (x >= 1) return 1;
		let t = x; for (let i = 0; i < 6; i++) { const d = D(t); if (Math.abs(d) < 1e-6) break; t -= (X(t) - x) / d; }
		return Y(Math.min(1, Math.max(0, t)));
	};
}
export const easeOutBack = bez(0.34, 1.56, 0.64, 1), easeOut = bez(0.22, 1, 0.36, 1), easeIn = bez(0.55, 0, 0.75, 0.2), easeInOut = bez(0.45, 0, 0.55, 1);
/** soft in-out with a small overshoot: starts at zero velocity, so a retarget never kinks */
export const easeInOutBack = bez(0.5, 0, 0.3, 1.3);
const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** keyframed curve: [[u, value], ...] with eased segments */
function kf(u: number, k: number[][], e = easeInOut) {
	for (let i = 1; i < k.length; i++) if (u <= k[i][0]) { const [u0, v0] = k[i - 1], [u1, v1] = k[i]; return v0 + (v1 - v0) * e((u - u0) / (u1 - u0)); }
	return k[k.length - 1][1];
}
const SQ = [[0, 1], [0.32, 1.04], [0.66, 0.98], [1, 1]];          // squash-and-stretch, 1.00 -> 1.04 -> 0.98 -> 1.00

class Elf {
	el: HTMLDivElement; cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D; m: Meta; img: CanvasImageSource;
	seq: { f: number; s: string }[] = []; target: { t: number; s: string }[] = []; ev: Ev[] = []; shown = '';
	blushCv?: HTMLCanvasElement; blushOp = 0; hearts: { cv: HTMLCanvasElement; on: number; t: number; ph: number }[] = []; heartWas = false;
	lastMs = 0; tilt0 = 0; tilt1 = 0; tiltT = -1e9; sign: number; enterAt = 1e9; nextBlink = 0; ph: number[]; lastTf = '';
	constructor(public c: ElfCfg, host: HTMLElement, i: number) {
		const sh = sheetOf(c.id)!; this.m = sh.atlas as unknown as Meta; this.img = sh.img;
		const [bx, by, bw, bh] = this.m.box, [GW, GH] = this.m.group;
		const el = (this.el = document.createElement('div')); el.className = 'elf';
		el.style.cssText = `left:${(bx / GW) * 100}%;top:${(by / GH) * 100}%;width:${(bw / GW) * 100}%;height:${(bh / GH) * 100}%;z-index:${this.m.z + 1};` +
			`transform-origin:${this.m.head[0] * 100}% 72%;opacity:0`;
		this.cv = this.canvas(bw, bh, 'elfCv'); this.ctx = this.cv.getContext('2d')!;
		const ov = (name: string) => {
			const a = this.m.anims[name]; if (!a) return undefined;
			const [x, y, w, h, ox, oy] = a.frames[0], cv = this.canvas(w, h, 'elfOv');
			cv.style.cssText = `left:${(ox / bw) * 100}%;top:${(oy / bh) * 100}%;width:${(w / bw) * 100}%;height:${(h / bh) * 100}%;opacity:0`;
			cv.getContext('2d')!.drawImage(this.img, x, y, w, h, 0, 0, w, h); return cv;
		};
		this.blushCv = ov('blush');
		for (const [j, n] of ['heart', 'heart2'].entries()) { const cv = ov(n); if (cv) this.hearts.push({ cv, on: 0, t: -1e9, ph: j * 1.7 }); }
		host.appendChild(el);
		this.sign = i % 2 ? -1 : 1;
		this.ph = [i * 1.37 + 0.4, i * 2.11 + 1.1, 2.3 + 0.21 * ((i * 7) % 5), 2.9 + 0.27 * ((i * 3) % 4)];   // bob phase, sway phase, bob period, sway period
		this.draw(c.base, true);
	}
	canvas(w: number, h: number, cls: string) {
		const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.className = cls; cv.setAttribute('aria-hidden', 'true'); this.el.appendChild(cv); return cv;
	}
	/** Expression frames are either a full frame [x,y,w,h] or (round 6) a face PATCH [x,y,w,h,ox,oy]: the base frame is
	 *  drawn, then the patch rect is cleared and the patch drawn 1:1 at (ox,oy) - only the changed face rect is in the sheet. */
	draw(s: string, force = false) {
		if (s === this.shown && !force) return; const b = this.m.anims[this.c.base], a = this.m.anims[s] || b;
		const [x, y, w, h] = b.frames[0]; this.ctx.clearRect(0, 0, this.cv.width, this.cv.height);
		const f = a.frames[0];
		if (f.length < 6) this.ctx.drawImage(this.img, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
		else { this.ctx.drawImage(this.img, x, y, w, h, 0, 0, w, h); const [px, py, pw, ph, ox, oy] = f; this.ctx.clearRect(ox, oy, pw, ph); this.ctx.drawImage(this.img, px, py, pw, ph, ox, oy, pw, ph); }
		this.shown = s; this.el.dataset.s = s;
	}
	/** target state at time t (ms): expands the in-between steps onto the 30 fps frame grid */
	set(s: string, t: number, fx?: Fx[]) {
		const prev = [...this.target].reverse().find((x) => x.t <= t)?.s ?? this.c.base;
		this.target.push({ t, s }); this.target.sort((a, b) => a.t - b.t);
		if (prev === s) return;
		let f = Math.round(t / FMS);
		for (const [st, n] of this.c.trans[`${prev}>${s}`] || []) { this.seq.push({ f, s: st }); f += Math.round(n * SLOW); }
		this.seq.push({ f, s }); this.seq.sort((a, b) => a.f - b.f);
		const arrive = f * FMS;
		for (const k of fx ?? this.c.fx[s] ?? []) this.ev.push({ k, t: arrive, a: 0 });
	}
	stateAt(f: number) { let s = this.c.base; for (const x of this.seq) { if (x.f > f) break; s = x.s; } return s; }
	update(ms: number, f: number) {
		// expression on the fixed 30 fps grid
		const s = this.stateAt(f); this.draw(s);
		// auto blink while idle in the base state (no change scheduled within 0.6 s)
		const bl = this.c.blink;
		if (bl && ms >= this.nextBlink && ms > this.enterAt + 700) {
			const busy = this.target.some((x) => x.t > ms - T_(300) && x.t < ms + T_(600));
			const tgt = [...this.target].reverse().find((x) => x.t <= ms)?.s ?? this.c.base;
			if (!busy && tgt === bl[1] && s === bl[1]) { const t = Math.ceil(ms / FMS + 1) * FMS; this.set(bl[0], t, []); this.set(bl[1], t + Math.round(3 * SLOW) * FMS, []); }
			this.nextBlink = ms + bl[2] + Math.random() * (bl[3] - bl[2]);
		}
		// transform-only motion
		const T = ms / 1000, [p0, p1, P0, P1] = this.ph;
		let y = 0.55 * AMP * Math.sin((2 * Math.PI * T) / (P0 * SLOW) + p0), r = 0.45 * AMP * Math.sin((2 * Math.PI * T) / (P1 * SLOW) + p1), sx = 1, sy = 1, op = 1;
		const ue = clamp((ms - this.enterAt) / T_(400)); y += ue < 0.6 ? 80 - 82.4 * easeOut(ue / 0.6) : -2.4 * (1 - easeInOut((ue - 0.6) / 0.4)); op = ms >= this.enterAt ? 1 : 0;   // rise from below the frame edge, no translucent overlap
		for (const e of this.ev) {
			const age = ms - e.t; if (age < 0) continue;
			if (e.k === 'squash' && age < T_(460)) { const v = kf(age / T_(460), SQ); sy *= v; sx *= 1 - (v - 1) * 0.55; }
			else if (e.k === 'hop' && age < T_(440)) {
				// little crouch, hop up, land (each segment eased in-out: no velocity kinks)
				y += kf(age / T_(440), [[0, 0], [0.16, 0.45], [0.5, -2.6], [0.84, 0], [1, 0]]);
				if (age > T_(360)) { const v = kf((age - T_(360)) / T_(80), [[0, 1], [0.4, 0.98], [1, 1]]); sy *= v; sx *= 1 - (v - 1) * 0.5; }
			} else if (e.k === 'giggle' && age < T_(900)) {
				// ~3.6 bounces/s (GIGGLE_MS; ~8 frames each at 30 fps, so the shake never aliases into jitter)
				const d = 1 - easeInOut(age / T_(900)), w = (Math.PI * age) / GIGGLE_MS; y -= 0.6 * Math.sin(w) ** 2 * d; r += 0.4 * Math.sin(w / 2) * d;
			} else if ((e.k === 'tilt' || e.k === 'tilt0') && !e.a) {
				e.a = 1; this.tilt0 = this.tiltNow(ms); this.sign = -this.sign;
				this.tilt1 = e.k === 'tilt0' ? 0 : this.sign * (1.2 + ((this.ph[0] * 10 + e.t / 97) % 1) * 0.6); this.tiltT = e.t;
			}
		}
		this.ev = this.ev.filter((e) => ms - e.t < T_(1000) || (e.k.startsWith('tilt') && !e.a));
		r += this.tiltNow(ms);
		// giggle keeps bubbling while she stays on a laugh
		if (this.c.fx[s]?.includes('giggle') && !this.ev.some((e) => e.k === 'giggle' && ms - e.t < T_(900))) this.ev.push({ k: 'giggle', t: ms + T_(260), a: 0 });
		const tf = `translate3d(0,${y.toFixed(3)}%,0) rotate(${r.toFixed(3)}deg) scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
		if (tf !== this.lastTf) { this.el.style.transform = tf; this.lastTf = tf; }
		const o = op.toFixed(3); if (this.el.style.opacity !== o) this.el.style.opacity = o;
		// blush overlay ramps (it is a separate layer, so it may fade)
		if (this.blushCv) {
			const want = this.c.blush?.[s] ?? 0; this.blushOp += (want - this.blushOp) * Math.min(1, Math.max(0, ms - this.lastMs) / T_(140));
			this.blushCv.style.opacity = this.blushOp.toFixed(3);
		}
		this.lastMs = ms;
		// hearts: only on the laugh frames; pop in with a soft overshoot, float, pop out in 3 frames
		const hon = this.c.heartOn === s;
		if (hon !== this.heartWas) { this.heartWas = hon; for (const h of this.hearts) h.t = ms; }
		for (const [j, h] of this.hearts.entries()) {
			const age = ms - h.t - (hon ? j * T_(70) : 0); let sc: number, ho: number;
			if (hon) { const u = clamp(age / T_(320)); sc = easeOutBack(u); ho = clamp(age / T_(90)); }
			else { const u = clamp(age / T_(100)); sc = 1 - 0.6 * u; ho = 1 - u; if (h.t < 0) ho = 0; }
			const fl = -6 * Math.sin((T * 3.1) / SLOW + h.ph);
			h.cv.style.transform = `translate3d(0,${fl.toFixed(2)}%,0) scale(${sc.toFixed(3)})`; h.cv.style.opacity = ho.toFixed(3);
		}
	}
	tiltNow(ms: number) { return this.tilt0 + (this.tilt1 - this.tilt0) * easeInOutBack(clamp((ms - this.tiltT) / T_(520))); }
}

export class ElfRig {
	elves: Elf[]; t0 = 0; raf = 0; calls: { t: number; f: () => void }[] = []; dead = false;
	constructor(host: HTMLElement, cfgs: ElfCfg[]) { this.elves = cfgs.map((c, i) => new Elf(c, host, i)); }
	get ms() { return performance.now() - this.t0; }
	/** start the shared clock; schedule calls with at(ms) relative to it */
	start() { this.t0 = performance.now(); const tick = (now: number) => { if (this.dead) return; this.tick(now - this.t0); this.raf = requestAnimationFrame(tick); }; this.tick(0); this.raf = requestAnimationFrame(tick); return this; }
	tick(ms: number) {
		const f = Math.floor(ms / FMS);
		for (const c of this.calls.filter((c) => c.t <= ms)) { this.calls.splice(this.calls.indexOf(c), 1); c.f(); }
		for (const e of this.elves) e.update(ms, f);
	}
	at(t: number, f: () => void) { this.calls.push({ t, f }); this.calls.sort((a, b) => a.t - b.t); }
	enter(t: number, order: number[], step = 70) { order.forEach((i, k) => { const e = this.elves[i]; e.enterAt = t + k * step * SLOW; e.nextBlink = e.enterAt + 1200 + i * 530; }); }
	set(i: number, s: string, t: number, fx?: Fx[]) { this.elves[i].set(s, t, fx); }
	destroy() { this.dead = true; cancelAnimationFrame(this.raf); for (const e of this.elves) e.el.remove(); this.calls = []; }
}
