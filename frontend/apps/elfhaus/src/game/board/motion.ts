// Board motion: the CSS keyframes that used to run on cells / rigs / overlays / glows,
// re-implemented as pose channels composed onto the Pixi mirror. GSAP is the clock.
// Timings and cubic-beziers match the last-wins typography / typography / typography-fix rules
// on the 150 BPM grid (tempo() / gtempo(), the old --at / --gt).
import { gsap } from 'gsap';
import { tempo, gtempo } from '../tempo';
import { kick } from './stage';
import { KEYS, type KFrame } from './motionkeys';

export type Pose = { sx: number; sy: number; tx: number; ty: number; px: number; py: number; rot: number; op: number; skew: number; lift: number; br: number; ox: number; oy: number };

// ox / oy NaN = the host's own transform-origin (the renderer resolves it)
const ident = (): Pose => ({ sx: 1, sy: 1, tx: 0, ty: 0, px: 0, py: 0, rot: 0, op: 1, skew: 0, lift: 0, br: 1, ox: NaN, oy: NaN });

type Job = {
	name: string;
	dur: number;
	delay: number;
	loop: 'none' | 'loop' | 'alt';
	reverse: boolean;
	fill: 'none' | 'both' | 'forwards';
	ease: string;
	origin: [number, number] | null;
	t0: number;
	sig: string;
};

const jobs = new WeakMap<Element, Job[]>();
const poseCache = new WeakMap<Element, Pose>();
const lifts = new WeakMap<Element, number>(); // inherited --lift on a rig / cell
let live = 0;
let clockOn = false;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function bezier(x1: number, y1: number, x2: number, y2: number) {
	const B = (t: number, a: number, b: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
	return (x: number) => { let lo = 0, hi = 1, t = x; for (let i = 0; i < 18; i++) { t = (lo + hi) / 2; if (B(t, x1, x2) < x) lo = t; else hi = t; } return B(t, y1, y2); };
}
const EASE: Record<string, (t: number) => number> = {
	linear: (t) => t,
	ease: bezier(0.25, 0.1, 0.25, 1),
	'ease-in': bezier(0.42, 0, 1, 1),
	'ease-out': bezier(0, 0, 0.58, 1),
	'ease-in-out': bezier(0.42, 0, 0.58, 1),
};
function easeFn(e?: string | null) {
	if (!e) return EASE.ease;
	if (EASE[e]) return EASE[e];
	const m = /cubic-bezier\(\s*([^)]+)\)/.exec(e);
	if (m) {
		const [a, b, c, d] = m[1].split(',').map((x) => parseFloat(x.trim()));
		return (EASE[e] = bezier(a, b, c, d));
	}
	return EASE.ease;
}

type Chan = { sx: number; sy: number; tx: number; ty: number; px: number; py: number; rot: number; op: number; skew: number; lift: number; br: number };
const REST: Chan = { sx: 1, sy: 1, tx: 0, ty: 0, px: 0, py: 0, rot: 0, op: 1, skew: 0, lift: 0, br: 1 };

function num(s: string) { return parseFloat(s) || 0; }

function trOf(s: string): [number, number] { const v = s.trim(); if (v.endsWith('%')) return [num(v) / 100, 0]; return [0, num(v)]; }
function parseChan(props: Record<string, string>, into: Chan) {
	const out = { ...into };
	if (props.opacity != null) out.op = num(props.opacity);
	if (props['--lift'] != null) out.lift = num(props['--lift']);
	if (props.filter != null) { const m = /brightness\(([\d.]+)(%?)\)/.exec(props.filter); out.br = m ? (m[2] ? num(m[1]) / 100 : num(m[1])) : 1; }
	if (props.scale != null && props.scale !== 'none') {
		const p = props.scale.trim().split(/\s+/);
		out.sx = num(p[0]); out.sy = p[1] != null ? num(p[1]) : out.sx;
	}
	if (props.translate != null && props.translate !== 'none') {
		const p = props.translate.trim().split(/\s+/);
		[out.tx, out.px] = trOf(p[0] || '0'); [out.ty, out.py] = trOf(p[1] || '0');
	}
	if (props.rotate != null && props.rotate !== 'none') out.rot = num(props.rotate);
	const tf = props.transform;
	if (tf && tf !== 'none') {
		const sc = /scale\(\s*([^)]+)\)/.exec(tf);
		if (sc) { const p = sc[1].split(',').map((x) => num(x.trim())); out.sx = p[0]; out.sy = p[1] ?? p[0]; }
		const sy = /scaleY\(\s*([^)]+)\)/.exec(tf); if (sy) out.sy = num(sy[1]);
		const sxm = /scaleX\(\s*([^)]+)\)/.exec(tf); if (sxm) out.sx = num(sxm[1]);
		const ty = /translateY\(\s*([^)]+)\)/.exec(tf), tx = /translateX\(\s*([^)]+)\)/.exec(tf), tr = /translate(?:3d)?\(\s*([^)]+)\)/.exec(tf);
		if (tr) { const raw = tr[1].split(',').map((x) => x.trim()); [out.tx, out.px] = trOf(raw[0] || '0'); [out.ty, out.py] = trOf(raw[1] || '0'); }
		if (tx) [out.tx, out.px] = trOf(tx[1]);
		if (ty) [out.ty, out.py] = trOf(ty[1]);
		const ro = /rotate(?:Z)?\(\s*([^)]+)\)/.exec(tf);
		if (ro) out.rot = ro[1].includes('turn') ? num(ro[1]) * 360 : num(ro[1]);
		const sk = /skewX\(\s*([^)]+)\)/.exec(tf);
		if (sk) out.skew = num(sk[1]);
	}
	return out;
}

const has = (p: Record<string, string>, re: RegExp, k: string) => p[k] != null || (!!p.transform && p.transform !== 'none' && re.test(p.transform));
/** Channels at progress u: each channel interpolates between the keyframes that set it (CSS fills the rest from rest). */
function chanAt(frames: KFrame[], u: number, fallbackEase: string): Chan {
	if (!frames.length) return { ...REST };
	const filled: Chan[] = [];
	let prev = { ...REST };
	for (const f of frames) {
		const p = f.props, got = parseChan(p, { ...REST });
		const tfNone = p.transform === 'none';
		if (p.opacity == null) got.op = prev.op;
		if (p.filter == null) got.br = prev.br;
		if (p['--lift'] == null) got.lift = prev.lift;
		if (!tfNone && !has(p, /scale/, 'scale')) { got.sx = prev.sx; got.sy = prev.sy; }
		if (!tfNone && !has(p, /translate/, 'translate')) { got.tx = prev.tx; got.ty = prev.ty; got.px = prev.px; got.py = prev.py; }
		if (!tfNone && !has(p, /rotate/, 'rotate')) got.rot = prev.rot;
		if (!tfNone && !(p.transform && /skew/.test(p.transform))) got.skew = prev.skew;
		filled.push(got); prev = got;
	}
	if (u <= frames[0].t) return filled[0];
	const L = frames.length - 1;
	if (u >= frames[L].t) return filled[L];
	let i = 0;
	while (i < L - 1 && u > frames[i + 1].t) i++;
	const A = frames[i], B = frames[i + 1], a = filled[i], b = filled[i + 1];
	const span = B.t - A.t;
	const e = easeFn(A.ease || fallbackEase);
	const k = span > 0 ? e(Math.max(0, Math.min(1, (u - A.t) / span))) : 1;
	const l = (x: number, y: number) => x + (y - x) * k;
	return { sx: l(a.sx, b.sx), sy: l(a.sy, b.sy), tx: l(a.tx, b.tx), ty: l(a.ty, b.ty), px: l(a.px, b.px), py: l(a.py, b.py), rot: l(a.rot, b.rot), op: l(a.op, b.op), skew: l(a.skew, b.skew), lift: l(a.lift, b.lift), br: l(a.br, b.br) };
}

function clock(job: Job, now: number): { u: number; active: boolean } | null {
	const t = (now - job.t0) / 1000 - job.delay;
	if (t < 0) {
		if (job.fill === 'both' || job.fill === 'forwards') return { u: 0, active: true };
		return null;
	}
	if (job.loop === 'none') {
		if (t >= job.dur) {
			if (job.fill === 'both' || job.fill === 'forwards') return { u: 1, active: false };
			return null;
		}
		return { u: Math.min(1, t / Math.max(1e-6, job.dur)), active: true };
	}
	const cycle = Math.max(1e-6, job.dur);
	let u = (t % cycle) / cycle;
	if (job.loop === 'alt') {
		const n = Math.floor(t / cycle);
		if (n % 2) u = 1 - u;
	}
	if (job.reverse) u = 1 - u;
	return { u, active: true };
}

function composeChan(a: Pose, c: Chan, origin: [number, number] | null) {
	a.sx *= c.sx; a.sy *= c.sy;
	a.tx += c.tx; a.ty += c.ty; a.px += c.px; a.py += c.py;
	a.rot += c.rot; a.op *= c.op; a.skew += c.skew; a.br *= c.br;
	a.lift = Math.max(a.lift, c.lift);
	if (origin) { a.ox = origin[0]; a.oy = origin[1]; }
}

export function poseOf(el: Element, now = performance.now()): Pose | null {
	const list = jobs.get(el);
	if (!list || !list.length) {
		// inherited lift for depth sprites
		const lift = inheritLift(el);
		if (el.classList.contains('sdD') && lift) {
			// .sd.sdD: translate (cell * .02 * lift, cell * .03 * lift), scale 1 + .03 * lift; the depth sprite is ~1.19 cells wide
			const p = ident();
			p.tx = (0.02 * lift) / 1.187; p.ty = (0.03 * lift) / 1.187;
			p.sx = p.sy = 1 + 0.03 * lift;
			return p;
		}
		if (el.classList.contains('rig')) lifts.delete(el);
		return null;
	}
	const p = ident();
	let any = false, running = false;
	for (const job of list) {
		const cyc = clock(job, now);
		if (!cyc) continue;
		any = true; if (cyc.active) running = true;
		const frames = KEYS[job.name]; if (!frames) continue;
		composeChan(p, chanAt(frames, cyc.u, job.ease), job.origin);
	}
	if (!any) { poseCache.delete(el); lifts.delete(el); return null; }
	poseCache.set(el, p);
	if (el.classList.contains('rig') || el.classList.contains('rgBody')) { if (p.lift) lifts.set(el, p.lift); else lifts.delete(el); }
	void running;
	return p;
}

function inheritLift(el: Element): number {
	let n: Element | null = el;
	while (n) {
		const v = lifts.get(n);
		if (v) return v;
		n = n.parentElement;
	}
	return 0;
}

export function motionLive() { return live > 0 && !reduced(); }

function ensureClock() {
	if (clockOn) return;
	clockOn = true;
	gsap.ticker.add(() => { if (live > 0) kick(); });
}

// elements whose motion is still changing (a loop, a delay or a one-shot not yet ended); held end poses do not count
const active = new Set<Element>();
const settleT = new WeakMap<Element, number>();
function jobEnd(j: Job) { return j.loop !== 'none' ? Infinity : j.t0 + (j.delay + j.dur) * 1000; }
function setJobs(el: Element, next: Job[]) {
	const old = settleT.get(el); if (old) clearTimeout(old);
	poseCache.delete(el);
	if (!next.length) { jobs.delete(el); active.delete(el); live = active.size; kick(); return; }
	jobs.set(el, next);
	active.add(el); live = active.size;
	ensureClock();
	const end = Math.max(...next.map(jobEnd));
	if (end !== Infinity) {
		settleT.set(el, setTimeout(() => {
			// drop ended one-shots without a held end pose; keep 'forwards' / 'both' end poses for poseOf
			const keep = (jobs.get(el) || []).filter((j) => j.fill !== 'none' || jobEnd(j) > performance.now());
			if (keep.length) jobs.set(el, keep); else jobs.delete(el);
			poseCache.delete(el);
			active.delete(el); live = active.size; kick();
		}, Math.max(0, end - performance.now()) + 34) as unknown as number);
	}
}
const restart = new Set<Element>();
/** A class was (re-)added on el this frame: its one-shot recipes start over (a CSS animation restarts the same way). */
export function markRestart(el: Element) { restart.add(el); }
export function clearRestart() { restart.clear(); }
function restarting(el: Element) { for (let n: Element | null = el; n; n = n.parentElement) if (restart.has(n)) return true; return false; }

type Spec = { name: string; dur: number; delay?: number; loop?: Job['loop']; reverse?: boolean; fill?: Job['fill']; ease?: string; origin?: [number, number] };

function mk(sig: string, specs: Spec[], now: number, prev?: Job[]): Job[] {
	const out: Job[] = [];
	for (const s of specs) {
		const old = prev?.find((j) => j.name === s.name && j.loop !== 'none');
		out.push({
			name: s.name,
			dur: s.dur,
			delay: s.delay ?? 0,
			loop: s.loop ?? 'none',
			reverse: !!s.reverse,
			fill: s.fill ?? 'both',
			ease: s.ease ?? 'ease',
			origin: s.origin ?? null,
			t0: old ? old.t0 : now,
			sig,
		});
	}
	return out;
}

const idleDelay = (cell: HTMLElement | null) => {
	if (!cell || !cell.parentElement) return 0;
	const i = [...cell.parentElement.children].indexOf(cell) + 1;
	if (i % 5 === 2) return -0.7;
	if (i % 5 === 3) return -1.4;
	if (i % 5 === 4) return -2.1;
	if (i % 5 === 0) return -2.8;
	return 0;
};

/** Pick the last-wins typography recipes that apply to this host element. */
export function pick(el: HTMLElement): Spec[] {
	if (reduced()) return [];
	if (el.classList.contains('still') || el.closest('.still')) return [];
	const body = document.body.classList;
	const cell = el.closest('.cell') as HTMLElement | null;
	const ov = el.closest('.ov') as HTMLElement | null;
	const sym = el.closest('.sym') as HTMLElement | null;
	const rig = el.closest('.rig') as HTMLElement | null;
	const cl = el.classList;
	const at = tempo();
	const gt = gtempo();
	const out: Spec[] = [];

	const isWin = !!cell?.classList.contains('win');
	const isDim = !!cell?.classList.contains('dim');
	const isSpin = !!cell?.classList.contains('spinning');
	const isLand = !!cell?.classList.contains('rgLand');
	const isWLand = !!cell?.classList.contains('wLand');
	const isWild = !!cell?.classList.contains('wild');
	const isPulse = !!cell?.classList.contains('pulse');
	const busyB = body.contains('busyB');
	const ant = body.contains('rgAnt');
	const isWildRig = !!rig && /k_W_R/.test(rig.className);
	const isFr = !!sym?.classList.contains('fr');

	// --- .sym win scale / pulse ---
	if (cl.contains('sym') && isWin) {
		if (isPulse) out.push({ name: 'chaletWinPulse', dur: 0.34 * gt, ease: 'cubic-bezier(.3,1.55,.45,1)', fill: 'forwards' });
		else out.push({ name: 'winHoldScale', dur: 0.18, ease: 'cubic-bezier(.3,1.5,.5,1)', fill: 'forwards' });
	}

	// --- rig idle / punch / lift ---
	if (cl.contains('rig') && !cl.contains('still')) {
		const hiOrS = !!sym && (sym.classList.contains('H') || sym.classList.contains('S')) && sym.classList.contains('art') && sym.classList.contains('rigd');
		if (!isWin && !isDim && !isSpin && !busyB && hiOrS && sym === el.parentElement) {
			out.push({ name: 'idBreathe', dur: 3.6, loop: 'loop', delay: idleDelay(cell), ease: 'ease-in-out', origin: [0.5, 0.85] });
		}
		if (isWin && sym?.classList.contains('art') && sym.classList.contains('rigd') && sym.contains(el) && sym.querySelector(':scope > .rig') === el) {
			if (!isWildRig) out.push({ name: 'v4WinPunch', dur: 0.32 * gt, ease: 'cubic-bezier(.3,1.5,.5,1)', origin: [0.5, 0.8], fill: 'both' });
			if (isFr) out.push({ name: 'tLiftWin', dur: 0.6 * gt, ease: 'cubic-bezier(.2,.8,.3,1)', origin: [0.5, 0.8], fill: 'both' });
		}
		if (isLand && sym?.classList.contains('fr') && sym.classList.contains('rigd') && sym.querySelector(':scope > .rig') === el) {
			out.push({ name: 'tLiftLand', dur: 0.34, ease: 'cubic-bezier(.2,.9,.3,1)', fill: 'both' });
		}
	}

	// --- rgBody land / win / ant / kind ---
	if (cl.contains('rgBody') && rig) {
		if (isLand) {
			if (isWildRig) out.push({ name: 'rgWLand', dur: 0.3, fill: 'both' });
			else out.push({ name: 'rgLandB', dur: 0.34, ease: 'cubic-bezier(.2,.9,.3,1)', fill: 'both' });
		}
		if (isWin) {
			if (isWildRig) out.push({ name: 'rgWWin', dur: 0.56, fill: 'both' });
			else {
				const kind = [...rig.classList].find((c) => c.startsWith('k_')) || '';
				const map: Record<string, [string, number, string]> = {
					k_H1: ['rgStar', 0.7, 'cubic-bezier(.3,1.5,.5,1)'],
					k_H2: ['rgSled', 0.7, 'cubic-bezier(.3,1.4,.5,1)'],
					k_H3: ['rgSkis', 0.7, 'cubic-bezier(.3,1.4,.5,1)'],
					k_H4: ['rgMug', 0.7, 'cubic-bezier(.3,1.4,.5,1)'],
					k_L5: ['rgMug', 0.7, 'cubic-bezier(.3,1.4,.5,1)'],
					k_L1: ['rgBell', 0.8, 'ease-out'],
					k_L2: ['rgBauble', 0.9, 'ease-out'],
					k_L3: ['rgGift', 0.7, 'cubic-bezier(.3,1.5,.5,1)'],
					k_L4: ['rgCane', 0.7, 'cubic-bezier(.3,1.4,.5,1)'],
					k_S: ['rgPass', 0.8, 'ease-out'],
				};
				const hit = map[kind];
				if (hit) out.push({ name: hit[0], dur: hit[1], ease: hit[2], fill: 'both' });
			}
		}
		if (ant && !isSpin && sym && (sym.classList.contains('S') || sym.classList.contains('W') || sym.classList.contains('symTop'))) {
			out.push({ name: 'rgAnt', dur: 0.5, loop: 'alt', ease: 'ease-in-out' });
		}
		if (isLand && sym?.classList.contains('symTop')) out.push({ name: 'rgWLand', dur: 0.3, fill: 'both' });
		if (isWin && sym?.classList.contains('symTop')) out.push({ name: 'rgWWin', dur: 0.56, fill: 'both' });
	}

	// --- land follow-through on parts ---
	if (isLand && rig && cl.contains('rp')) {
		if (cl.contains('m_bounce') || cl.contains('m_ribbon') || cl.contains('m_bow') || cl.contains('m_sprig'))
			out.push({ name: 'rgFollow', dur: 0.42, ease: 'cubic-bezier(.2,.9,.3,1)', fill: 'both' });
		if (cl.contains('m_swingL') || cl.contains('m_clip') || cl.contains('m_cap'))
			out.push({ name: 'rgSwingSmall', dur: 0.42, ease: 'ease-out', fill: 'both' });
		if (cl.contains('m_swingR'))
			out.push({ name: 'rgSwingSmall', dur: 0.42, ease: 'ease-out', reverse: true, fill: 'both' });
		if (cl.contains('m_lets')) {
			if (isWildRig) out.push({ name: 'rgWLets', dur: 0.34, delay: 0.03, fill: 'both' });
			else out.push({ name: 'rgLetsLand', dur: 0.36, ease: 'cubic-bezier(.3,1.6,.5,1)', fill: 'both' });
		}
	}
	if (isLand && cl.contains('rgSh')) out.push({ name: 'rgShLand', dur: 0.34, ease: 'ease-out', fill: 'both' });

	// --- win parts ---
	if (isWin && rig && cl.contains('rp')) {
		const part: [string, string, number, number, string?][] = [
			['m_twinkle', 'rgTwinkle', 0.7, 0.06, 'cubic-bezier(.3,1.6,.5,1)'],
			['m_bounce', 'rgHop', 0.7, 0.1, 'cubic-bezier(.3,1.5,.5,1)'],
			['m_swingL', 'rgPole', 0.8, 0.05, 'ease-out'],
			['m_steam', 'rgSteam', 1.1, 0, 'ease-in-out'],
			['m_straw', 'rgStraw', 0.8, 0.08, 'ease-out'],
			['m_bow', 'rgBow', 0.8, 0.08, 'ease-out'],
			['m_ribbon', 'rgBow', 0.8, 0.08, 'ease-out'],
			['m_sprig', 'rgSprig', 0.8, 0.12, 'ease-out'],
			['m_clapper', 'rgClap', 0.8, 0, 'ease-out'],
			['m_cap', 'rgCap', 0.9, 0, 'ease-out'],
			['m_orange', 'rgOrange', 0.8, 0.06, 'ease-out'],
			['m_clip', 'rgClip', 0.8, 0, 'ease-out'],
		];
		for (const [cls, name, dur, delay, ease] of part) if (cl.contains(cls)) out.push({ name, dur, delay, ease: ease || 'ease', fill: 'both' });
		if (cl.contains('m_swingR')) out.push({ name: 'rgPole', dur: 0.8, delay: 0.05, ease: 'ease-out', reverse: true, fill: 'both' });
		if (cl.contains('m_lets')) out.push({ name: isWildRig ? 'rgWLets' : 'rgLets', dur: isWildRig ? 0.42 : 0.6, delay: 0.1, ease: isWildRig ? 'ease' : 'cubic-bezier(.3,1.6,.5,1)', fill: 'both' });
		if (cl.contains('m_lid')) out.push({ name: isWildRig ? 'rgWBlink' : 'rgLid', dur: isWildRig ? 0.2 : 0.24, delay: isWildRig ? 0.5 : 0.42, ease: 'ease-in-out', fill: 'both' });
		if (cl.contains('m_hair') && !isWildRig) out.push({ name: 'rgHairWin', dur: 0.9, delay: 0.04, ease: 'cubic-bezier(.3,1.3,.5,1)', fill: 'both' });
		if (cl.contains('m_smile')) out.push({ name: isWildRig ? 'rgWSmile' : 'rgSmileWin', dur: isWildRig ? 0.5 : 0.8, delay: isWildRig ? 0.06 : 0.1, ease: isWildRig ? 'ease' : 'cubic-bezier(.3,1.5,.5,1)', fill: 'both' });
	}
	if (isWin && cl.contains('rgSh')) out.push({ name: 'rgShWin', dur: 0.9, ease: 'ease-in-out', fill: 'both' });
	if (isWin && cl.contains('rgSp')) {
		const d = num((el as HTMLElement).style.getPropertyValue('--d') || '0');
		out.push({ name: 'rgSpark', dur: 0.62, delay: 0.12 + d, ease: 'ease-out', fill: 'both' });
	}

	// --- idle wild face ---
	if (isWild && !isWin && rig) {
		if (cl.contains('m_lid')) out.push({ name: isWildRig ? 'rgWBlinkIdle' : 'rgLidIdle', dur: 4.4, delay: 1.3, loop: 'loop', ease: 'linear' });
		if (cl.contains('m_hair') && !isWildRig) out.push({ name: 'rgHairIdle', dur: 3.4, loop: 'alt', ease: 'ease-in-out' });
		if (cl.contains('m_smile')) out.push({ name: isWildRig ? 'rgWSmileIdle' : 'rgSmileIdle', dur: 6.2, delay: 2.2, loop: 'loop', ease: 'ease-in-out' });
	}

	// --- glow ---
	if (el.closest('.symGlow') && cl.contains('rp')) {
		if (isWin) out.push({ name: 'aiGlowPulse', dur: 0.45 * gt, delay: 0.16 * gt, loop: 'alt', ease: 'ease-in-out', origin: [0.5, 0.55] });
		else if (isWild && sym?.classList.contains('W')) {
			if (isWLand) out.push({ name: 'wGlowLand', dur: 0.2 * at, ease: 'ease-out', fill: 'both' });
			out.push({ name: 'wGlowBreathe', dur: 0.7 * at, delay: isWLand ? 0.2 * at : 0, loop: 'alt', ease: 'ease-in-out' });
		}
	}
	if (cl.contains('symGlow') && isWin) {
		out.push({ name: 'chaletGlowPulse', dur: 0.7 * gt, loop: 'alt', ease: 'ease-in-out' });
	}

	// --- anticipation clip ---
	if (ant && !isSpin && sym?.classList.contains('S') && cl.contains('m_clip')) {
		out.push({ name: 'rgClip', dur: 0.5, loop: 'loop', ease: 'ease-in-out' });
	}

	// --- scatter land pop ---
	if (cell?.classList.contains('sLand') && cl.contains('sym') && cl.contains('S')) {
		out.push({ name: 'sPop', dur: 0.34, ease: 'cubic-bezier(.3,.9,.4,1)', fill: 'both' });
	}
	if (cell?.classList.contains('drop') && cl.contains('sym')) {
		out.push({ name: 'drop', dur: 0.32, ease: 'cubic-bezier(.3,1.3,.5,1)', fill: 'both' });
	}

	// --- anticipation reel glow (.strip.ant .antGlow): one flare per 150 BPM beat ---
	if (cl.contains('antGlow') && el.parentElement?.classList.contains('ant')) {
		out.push({ name: 'antPulse', dur: 0.4, loop: 'loop', ease: 'ease-out' });
	}

	// --- overlay stacks ---
	if (ov) {
		if (cl.contains('stkElf')) {
			const ph = num((el as HTMLElement).style.getPropertyValue('--ph') || '0');
			out.push({ name: 'stkBreath', dur: 3.4, delay: -1 * ph, loop: 'loop', ease: 'cubic-bezier(.45,0,.55,1)', origin: [0.5, 0.96] });
			out.push({ name: 'stkShift', dur: 6.2, delay: -1.7 * ph, loop: 'loop', ease: 'cubic-bezier(.45,0,.55,1)', origin: [0.5, 0.96] });
			out.push({ name: 'stkFollow', dur: 6.2, delay: -1.7 * ph + 0.55, loop: 'loop', ease: 'cubic-bezier(.45,0,.55,1)', origin: [0.5, 0.96] });
		}
		if (cl.contains('stkGrp') || el.classList.contains('stkGrp')) {
			out.push({ name: 'stkEnter', dur: 0.46, ease: 'cubic-bezier(.22,1,.36,1)', fill: 'both', origin: [0.5, 1] });
			if (ov.classList.contains('win')) out.push({ name: 'stkWin', dur: 1.1, delay: 0.1, loop: 'loop', ease: 'cubic-bezier(.45,0,.55,1)', origin: [0.5, 1] });
			if (ov.classList.contains('stkReact')) out.push({ name: 'stkCheer', dur: 0.62, ease: 'cubic-bezier(.45,0,.55,1)', fill: 'both', origin: [0.5, 1] });
		}
		if (cl.contains('stk_glow') || (el.tagName === 'IMG' && cl.contains('stk_glow'))) {
			if (cl.contains('land')) out.push({ name: 'wGlowLand', dur: 0.2 * at, ease: 'ease-out', fill: 'both' });
			out.push({ name: 'wGlowBreathe', dur: 0.7 * at, loop: 'alt', ease: 'ease-in-out' });
		}
	}

	return out;
}

const recipeSig = new WeakMap<Element, string>();
export function syncMotion(el: HTMLElement) {
	const specs = pick(el);
	const sig = specs.map((s) => s.name + (s.loop || '')).join('|');
	const prevSig = recipeSig.get(el) ?? '';
	const re = restarting(el) && specs.some((s) => (s.loop ?? 'none') === 'none');
	if (prevSig === sig && !re) return;
	recipeSig.set(el, sig);
	const prev = (jobs.get(el) || []).filter((j) => !j.name.startsWith('__m'));
	const custom = (jobs.get(el) || []).filter((j) => j.name.startsWith('__m'));
	const now = performance.now();
	const next = specs.length ? mk(sig, specs, now, prev) : [];
	if (!next.length && !custom.length && !jobs.has(el)) return;
	setJobs(el, [...next, ...custom]);
}

export function syncMotionTree(root: HTMLElement | null) {
	if (!root) return;
	syncMotion(root);
	for (const n of root.querySelectorAll<HTMLElement>('.rig,.rgBody,.rp,.rgSh,.rgSp,.symGlow,.sym,.sd,.stkElf,.stkGrp,img.stk_glow,.wart,.antGlow')) {
		syncMotion(n);
	}
}

export const poseAlpha = (p: Pose | null, base: number) => base * (p ? p.op : 1);
export const poseBright = (p: Pose | null, base: number) => base * (p ? p.br : 1);


const customFrames = new WeakMap<Job, KFrame[]>();
function framesOf(job: Job): KFrame[] | undefined { return customFrames.get(job) ?? KEYS[job.name]; }

// Re-bind chan lookup used by poseOf: patch poseOf to use framesOf. (poseOf already uses KEYS[job.name];
// playMotion intern's a unique name into KEYS at runtime.)
let customSeq = 0;

function kfToFrames(kf: Keyframe[]): KFrame[] {
	const n = Math.max(1, kf.length);
	return kf.map((f, i) => {
		const props: Record<string, string> = {};
		for (const k of ['transform', 'translate', 'rotate', 'scale', 'opacity', 'filter'] as const) {
			const v = (f as Record<string, unknown>)[k];
			if (v != null && v !== '') props[k] = String(v);
		}
		const off = f.offset != null ? Number(f.offset) : (n === 1 ? 0 : i / (n - 1));
		return { t: off, props, ease: (f.easing as string) || null };
	});
}

export type Motion = { finished: Promise<void>; cancel(): void; finish(): void; readonly playState: string };
/** Drive a one-shot (or looping) pose animation from WAAPI-style keyframes, without element.animate(). */
export function playMotion(el: HTMLElement, kf: Keyframe[], o: KeyframeAnimationOptions = {}): Motion {
	const name = `__m${++customSeq}`;
	KEYS[name] = kfToFrames(kf);
	const dur = Math.max(0, Number(o.duration) || 0) / 1000;
	const delay = (Number(o.delay) || 0) / 1000;
	const fill: Job['fill'] = o.fill === 'both' ? 'both' : o.fill === 'forwards' ? 'forwards' : o.fill === 'backwards' ? 'both' : 'none';
	const ease = (o.easing as string) || 'ease';
	const iters = o.iterations;
	const loop: Job['loop'] = iters === Infinity ? 'loop' : 'none';
	const now = performance.now();
	const job: Job = { name, dur: dur || 0.001, delay, loop, reverse: o.direction === 'reverse', fill, ease, origin: null, t0: now, sig: name };
	const prev = jobs.get(el) || [];
	setJobs(el, [...prev.filter((j) => !j.name.startsWith('__m') || jobEnd(j) > now), job]);
	kick();
	let done!: () => void;
	const finished = new Promise<void>((res) => { done = res; });
	const wait = (dur + delay) * 1000 + 16;
	const tid = setTimeout(() => { done(); }, wait);
	return {
		finished,
		cancel() { clearTimeout(tid); const cur = jobs.get(el) || []; setJobs(el, cur.filter((j) => j !== job)); delete KEYS[name]; done(); },
		finish() { clearTimeout(tid); job.t0 = performance.now() - (job.dur + job.delay) * 1000; setJobs(el, [...(jobs.get(el) || [])]); done(); },
		get playState() { return jobEnd(job) > performance.now() ? 'running' : 'finished'; },
	};
}

export function applyPoseMatrix(m: DOMMatrix, p: Pose, w: number, h: number, fx = 0.5, fy = 0.5): DOMMatrix {
	const ox = (Number.isNaN(p.ox) ? fx : p.ox) * w, oy = (Number.isNaN(p.oy) ? fy : p.oy) * h;
	const rad = (p.rot * Math.PI) / 180;
	const cos = Math.cos(rad), sin = Math.sin(rad);
	const sk = Math.tan((p.skew * Math.PI) / 180);
	const a = p.sx * cos, b = p.sx * sin, c = -p.sy * sin + a * sk, d = p.sy * cos + b * sk;
	const e = p.tx * w + p.px + ox - a * ox - c * oy;
	const f = p.ty * h + p.py + oy - b * ox - d * oy;
	return m.multiply(new DOMMatrix([a, b, c, d, e, f]));
}

export function dimBright(el: HTMLElement): number {
	const cell = el.closest('.cell');
	if (cell?.classList.contains('dim')) return 0.48;
	return 1;
}

/** Cancel the scripted (playMotion) poses on el (and its subtree); class recipes stay. */
export function cancelMotion(el: Element | null | undefined, subtree = false) {
	if (!el) return;
	const one = (n: Element) => { const cur = jobs.get(n); if (cur?.some((j) => j.name.startsWith('__m'))) setJobs(n, cur.filter((j) => !j.name.startsWith('__m'))); };
	one(el);
	if (subtree) el.querySelectorAll('*').forEach(one);
}
/** True while el has a scripted pose that has not ended. */
export function hasMotion(el: Element | null | undefined) {
	if (!el) return false;
	const now = performance.now();
	return !!jobs.get(el)?.some((j) => j.name.startsWith('__m') && jobEnd(j) > now);
}

/** A CSS easing string as a GSAP ease function (cubic-bezier exact). */
export const cssEase = (e: string) => easeFn(e);

/** QA: poses of the elements whose motion is live right now (class recipes and scripted). */
export function motionSamples(max = 24) {
	const now = performance.now(), out: { cls: string; jobs: string[]; p: Pose }[] = [];
	for (const el of active) {
		const p = poseOf(el, now); if (!p) continue;
		out.push({ cls: (el.getAttribute('class') || '').slice(0, 60), jobs: (jobs.get(el) || []).map((j) => j.name), p });
		if (out.length >= max) break;
	}
	return { total: active.size, out };
}
