// Reel spin engine. One rAF loop drives every reel with closed-form, time-based motion (frame-rate independent):
//   wind-up  : a small upward nudge (sine ease, velocity 0 at both ends)
//   accel    : linear velocity ramp to full speed
//   run      : constant speed; the motion-blur strip (reel_stripA/B, gen_reelblur.py) crossfades in near full speed
//   decel    : quadratic ease-out that starts at the running speed and runs PAST the final row by `ov` cells
//   settle   : cosine ease back onto the final row (~100 ms), so a stop never snaps
// Each reel is a column of 6 recycled slots moved only with translate3d (no layout per frame); slot content is the
// same symHTML() the cells use. The four final symbols are written into slots that are still above the window when
// the decel starts, so they scroll in for real; at the end the cells are rendered with identical content and the
// strip is hidden in the same frame, so no swap is visible. Locked cells sit above the strip and never move.
import { S, ART, symHTML, k } from './ui';
import { ROWS, REELS } from './config';
import { SPIN_TEMPO, STOP_TEMPO } from './tempo';

// Normal pace (tempo.ts): the spin schedule (first stop, gaps, anticipation, respin cells) x SPIN_TEMPO 1.25, the
// brake / settle only x STOP_TEMPO 1.1 and the run speed / STOP_TEMPO, so it is calmer but a stop still snaps.
// Turbo / quick spin keeps the old fast values.
const sp = (ms: number) => Math.round(ms * SPIN_TEMPO), st = (ms: number) => Math.round(ms * STOP_TEMPO);
export const timing = () => (S.turbo
	? { first: 420, gap: 70, ant: 450, antD: 420, resp: 380, land: 60, cell: 35 }
	: { first: sp(950), gap: sp(150), ant: sp(1150), antD: sp(1000), resp: sp(640), land: sp(140), cell: sp(70) });
const P = () => (S.turbo
	? { wu: 0, amp: 0, acc: 70, v: 44, D: 220, ov: 0.14, set: 150 }
	: { wu: 0, amp: 0, acc: sp(120), v: 26 / STOP_TEMPO, D: st(380), ov: 0.2, set: st(260) }); // instant start; elastic overshoot + settle

type Slot = HTMLElement & { n?: number };
type Reel = {
	r: number; el: HTMLElement; tape: HTMLElement; blur: HTMLElement; slots: Slot[]; on: boolean;
	t0: number; p: ReturnType<typeof P>; init: string[];
	stop?: { tD: number; at: number; finals: string[]; onLand: () => void; res: () => void; slow?: number; s0?: number; v0?: number; dist?: number; D?: number; sEnd?: number };
	blurA: number; tapeA: number;
};
const reels: Reel[] = [];
let raf = 0, t0 = 0, spinning = false;
export const isSpinning = () => spinning;
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.max(0, ms)));
export const sinceStart = () => performance.now() - t0;
export const markStopped = () => { spinning = false; };
export function markStart() { t0 = performance.now(); }

const FILL = ['H1', 'L1', 'H2', 'L2', 'L3', 'H3', 'L4', 'L5', 'H4', 'L2', 'L5', 'L1', 'L4', 'L3'];
const filler = (r: number, n: number) => FILL[(((n * 7 + r * 5 + (n >> 2)) % FILL.length) + FILL.length) % FILL.length];

function ensure() {
	const host = document.getElementById('strips'); if (!host) return false;
	if (!reels.length) for (let r = 0; r < REELS; r++) {
		const el = document.createElement('div'); el.className = 'strip';
		const tape = document.createElement('div'); tape.className = 'tape';
		const slots: Slot[] = []; for (let i = 0; i < 6; i++) { const s = document.createElement('div') as Slot; s.className = 'slot'; tape.appendChild(s); slots.push(s); }
		const blur = document.createElement('div'); blur.className = 'sblur';
		const glow = document.createElement('div'); glow.className = 'antGlow';
		const src = ART[r % 2 ? 'reel_stripB' : 'reel_stripA']; if (src) blur.style.backgroundImage = `url(${src})`;
		el.append(tape, blur, glow); host.appendChild(el);
		reels.push({ r, el, tape, blur, slots, on: false, t0: 0, p: P(), init: [], blurA: -1, tapeA: -1 });
	}
	return true;
}
// parsed once per distinct symbol markup, then cloned (much cheaper than innerHTML parsing every slot change)
const tpls = new Map<string, HTMLTemplateElement>();
function frag(html: string) {
	let t = tpls.get(html); if (!t) { t = document.createElement('template'); t.innerHTML = html; if (tpls.size < 200) tpls.set(html, t); }
	return t.content.cloneNode(true);
}
function setSlot(R: Reel, s: Slot, n: number) {
	s.n = n;
	const fin = R.stop?.sEnd !== undefined ? R.stop.sEnd - n : -1; // final row index for this item, if any
	let html: string, wild = false;
	if (R.stop?.sEnd !== undefined && fin >= 0 && fin < ROWS) { html = R.stop.finals[fin]; wild = html.includes('sym W'); }
	else if (n >= 0 && n <= 3) { html = R.init[3 - n]; wild = html.includes('sym W'); }
	else html = symHTML(filler(R.r, n));
	if (s.dataset.h !== html) { s.dataset.h = html; s.replaceChildren(frag(html)); }
	s.classList.toggle('wild', wild);
}
// closed-form run motion: position (cells) and velocity (cells/s) at t ms after the reel started
function run(R: Reel, t: number) {
	const { wu, amp, acc, v } = R.p;
	if (wu && t < wu) { const a = (Math.PI / 2) * (t / wu); return { s: 3 - amp * Math.sin(a), v: -amp * Math.cos(a) * (Math.PI / 2) * (1000 / wu) }; }
	if (t < wu + acc) { const u = (t - wu) / acc; return { s: 3 - amp + (v * acc / 1000) * u * u / 2, v: v * u }; }
	return { s: 3 - amp + (v * acc) / 2000 + (v * (t - wu - acc)) / 1000, v };
}
function frame(now: number) {
	raf = 0; let live = false;
	for (const R of reels) {
		if (!R.on) continue; live = true;
		const p = R.p, st = R.stop; let s: number, v: number;
		if (st && now >= st.tD) {
			if (st.s0 === undefined) { // plan the landing once, at the decel start
				const m = run(R, st.tD - R.t0); st.s0 = m.s; st.v0 = Math.max(m.v, 1);
				const D0 = st.slow || p.D; // anticipation reels brake over a much longer, slower ease-out
				st.sEnd = Math.max(Math.round(m.s + (st.v0 * D0) / 2000 - p.ov), Math.floor(m.s) + 5);
				st.dist = st.sEnd + p.ov - m.s; st.D = Math.min(st.slow ? D0 + 400 : 900, Math.max(D0, (2000 * st.dist) / Math.max(st.v0, p.v * 0.5)));
				R.slots.forEach((x) => { if (x.n !== undefined && st.sEnd! - x.n >= 0 && st.sEnd! - x.n < ROWS) x.n = undefined; });
			}
			const td = now - st.tD;
			if (td < st.D!) { const u = td / st.D!; s = st.s0 + st.dist! * (1 - (1 - u) * (1 - u)); v = (2 * st.dist! * (1 - u)) / (st.D! / 1000); }
			else if (td < st.D! + p.set) { const u = (td - st.D!) / p.set; s = st.sEnd! + p.ov * Math.exp(-3.2 * u) * Math.cos(2.6 * Math.PI * u) * (1 - u); v = 0; } // damped spring: overshoot, small rebound, settle
			else { land(R); continue; }
		} else ({ s, v } = run(R, now - R.t0));
		const c = S.cell, base = Math.floor(s), used = new Set<number>();
		for (let n = base - 3; n <= base + 1; n++) {
			const i = ((n % 6) + 6) % 6, sl = R.slots[i]; used.add(i);
			if (sl.n !== n) setSlot(R, sl, n);
			sl.style.transform = `translate3d(0,${((s - n) * c).toFixed(2)}px,0)`;
		}
		R.slots.forEach((sl, i) => { if (!used.has(i) && sl.n !== -999) { sl.n = -999; sl.style.transform = `translate3d(0,${-2 * c}px,0)`; } });
		const a = Math.max(0, Math.min(1, (v / p.v - 0.8) / 0.2)), per = 6 * c;
		const bA = Math.round(a * 50) / 50;
		if (bA !== R.blurA) { R.blurA = bA; R.blur.style.opacity = String(0.95 * bA); R.tape.style.opacity = String(1 - 0.45 * bA); }
		if (bA > 0) R.blur.style.transform = `translate3d(0,${(((s * c) % per) - per).toFixed(2)}px,0)`;
	}
	if (live) raf = requestAnimationFrame(frame);
}
function land(R: Reel) {
	const st = R.stop!; R.on = false; R.stop = undefined;
	st.onLand(); // cells now show the same symbols in the same place
	R.el.style.visibility = 'hidden'; R.el.classList.remove('ant');
	st.res();
}
function startReel(R: Reel, rows: number[], now: number) {
	R.p = P(); R.t0 = now; R.on = true; R.stop = undefined; R.blurA = -1;
	R.init = Array.from({ length: ROWS }, (_, row) => symHTML(S.sym[R.r]?.[row] ?? 'L5', S.vals.get(k(R.r, row))));
	R.slots.forEach((s) => (s.n = undefined));
	R.el.style.cssText = `left:${R.r * S.cell}px;visibility:visible`;
	R.blur.style.height = `${4 * S.cell + 6 * S.cell}px`;
	rows.forEach((row) => {
		const c = document.getElementById(`c${R.r}${row}`); if (!c) return;
		c.classList.remove('win', 'dim', 'sprWin', 'replace', 'out', 'locked');
		c.querySelectorAll('canvas').forEach((x) => x.remove());
		c.classList.add('spinning');
	});
	if (!raf) raf = requestAnimationFrame(frame);
}
/** Spin the given free cells (grouped by reel). */
export function spinCells(cells: { reel: number; row: number }[]) {
	if (!ensure()) return;
	const now = performance.now(); t0 = now; spinning = true;
	const by = new Map<number, number[]>(); cells.forEach((c) => by.set(c.reel, [...(by.get(c.reel) || []), c.row]));
	by.forEach((rows, r) => startReel(reels[r], rows, now));
}
/** Spin every free cell; `keep(reel,row)` true = stays still (locked wilds, full-reel columns). */
export function startSpin(keep: (reel: number, row: number) => boolean = () => false) {
	const cells: { reel: number; row: number }[] = [];
	for (let r = 0; r < REELS; r++) for (let row = 0; row < ROWS; row++) {
		const c = document.getElementById(`c${r}${row}`);
		if (!c || keep(r, row) || c.style.visibility === 'hidden') continue;
		cells.push({ reel: r, row });
	}
	spinCells(cells);
}
export const reelSpinning = (r: number) => !!reels[r]?.on;
/** Land reels: `at` = ms after the spin start when the reel must be settled; `finals` = 4 row HTML strings. */
/** `slow` (ms) = anticipation: the reel glows from `glowAt` (ms after spin start) and brakes over `slow` ms. */
export function stopReel(r: number, at: number, finals: string[], onLand: () => void, slow = 0, glowAt = 0) {
	const R = reels[r];
	if (!R?.on) { onLand(); return Promise.resolve(); }
	return new Promise<void>((res) => {
		const D0 = slow || R.p.D, tEnd = R.t0 + at, tD = Math.max(performance.now(), tEnd - R.p.set - D0);
		R.stop = { tD, at, finals, onLand, res, slow: slow || undefined };
		if (slow) { const g = () => R.on && R.stop?.res === res && R.el.classList.add('ant'); const dt = R.t0 + glowAt - performance.now(); dt > 0 ? setTimeout(g, dt) : g(); }
	});
}
/** Tap to skip: every reel that hasn't started braking lands now, left to right, with the normal (fast) brake. */
export function hurry() {
	const now = performance.now(); let i = 0;
	reels.forEach((R) => { const st = R.stop; if (!R.on || !st || st.s0 !== undefined) return; st.slow = undefined; st.tD = Math.min(st.tD, now + 60 * i++); R.el.classList.remove('ant'); });
}
/** Hard stop (errors / resume): hide strips, unhide cells. */
export function abortSpin() {
	reels.forEach((R) => { R.on = false; R.stop?.res(); R.stop = undefined; R.el.style.visibility = 'hidden'; });
	document.querySelectorAll('#cells .cell.spinning').forEach((c) => c.classList.remove('spinning'));
	spinning = false;
}

// ---------- respins: every replaced cell spins on its own (reels stay still) ----------
// A masked mini-strip per cell (shape from CSS --cellMask, so a round porthole or a frameless cutout both work),
// scrolled by one CSS transform animation (compositor only, no rAF). Stops are staggered left to right, top to
// bottom; each cell lands with the squash-and-bounce (.cell.mLand).
const minis = new Map<string, HTMLElement>();
export function spinMini(cells: { reel: number; row: number }[]) {
	const host = document.getElementById('strips'); if (!host) return;
	t0 = performance.now(); spinning = true;
	cells.forEach(({ reel, row }, i) => {
		const c = document.getElementById(`c${reel}${row}`); if (!c) return;
		c.classList.remove('win', 'dim', 'sprWin', 'replace', 'out', 'locked', 'mLand'); c.querySelectorAll('canvas').forEach((x) => x.remove());
		c.classList.add('spinning');
		const m = document.createElement('div'); m.className = 'mini';
		m.style.cssText = `left:${reel * S.cell}px;top:${row * S.cell}px`;
		const src = ART[(reel + row) % 2 ? 'reel_stripB' : 'reel_stripA'];
		m.innerHTML = `<i style="${src ? `background-image:url(${src});` : ''}animation-delay:${-(i * 97) % 600}ms"></i>`;
		host.appendChild(m); minis.set(`${reel}${row}`, m);
	});
}
/** Land one mini-spinning cell at `at` ms after the respin started; onLand renders the final symbol. */
export function stopMini(reel: number, row: number, at: number, onLand: () => void) {
	const m = minis.get(`${reel}${row}`);
	return new Promise<void>((res) => setTimeout(() => {
		m?.remove(); minis.delete(`${reel}${row}`);
		const c = document.getElementById(`c${reel}${row}`);
		c?.classList.remove('spinning'); onLand();
		const sym = c?.querySelector<HTMLElement>('.sym'); // drop-in + squash and bounce (WAAPI, transform only, no reflow)
		sym?.animate([{ transform: 'translateY(-28%) scale(.94,1.06)' }, { transform: 'translateY(4%) scale(1.07,.92)', offset: .45 }, { transform: 'translateY(-2%) scale(.98,1.02)', offset: .75 }, { transform: 'none' }], { duration: S.turbo ? 160 : Math.round(260 * STOP_TEMPO), easing: 'ease-out' });
		res();
	}, Math.max(0, t0 + at - performance.now())));
}
