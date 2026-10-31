// Reel spin engine. One rAF loop drives every reel with closed-form, time-based motion (frame-rate independent):
//   wind-up  : a small upward nudge (sine ease, velocity 0 at both ends)
//   accel    : velocity ramp to full speed (normal: smoothstep, so the start is soft too; turbo: linear)
//   run      : constant speed; the motion-blur strip (reel_stripA/B, gen_reelblur.py) crossfades in near full speed
//   decel    : power ease-out (normal: (1-u)^2.5, turbo: quadratic) that starts at the running speed and runs PAST the
//              final row by `ov` cells
//   settle   : normal: ONE soft cosine ease back onto the final row (no rebound); turbo: the old damped spring
// Each reel is a column of 6 recycled slots moved only with translate3d (no layout per frame); slot content is the
// same symHTML() the cells use. The four final symbols are written into slots that are still above the window when
// the decel starts, so they scroll in for real; at the end the cells are rendered with identical content and the
// strip is hidden in the same frame, so no swap is visible. Locked cells sit above the strip and never move.
import { rigAnt, rigLand } from './symrig';
import { S, ART, symHTML, k } from './ui';
import { ROWS, REELS } from './config';
import { SPIN_TEMPO, STOP_TEMPO } from './tempo';
import { sfx, loop, type Handle } from './audio';
// sound (v3.8): spin start + spin bed on every spin / respin (no bed in turbo), one stop per reel (turbo: last reel only, quieter)
let bed: Handle | null = null;
const spinSound = () => { sfx('reel_spin_start'); bed?.stop(); bed = S.turbo ? null : loop('reel_spin_loop'); };
const bedOff = () => { bed?.stop(150); bed = null; };

// Normal pace (anim-v4, James after the Stake review "Poor animations x3"): studio-style spin. A short wind-up nudge
// (90 ms, 12% of a cell up), a quick 140 ms spin-up to 26 cells/s, reels land left to right 130 ms apart, each brakes
// over ~0.36 s, overshoots the row by 14% of a cell and bounces back with ONE small damped rebound (0.24 s). The brake
// is still planned when the stop is issued (exact settle time, continuous speed, see stopReel). Last reel settles
// ~1.3 s after the press (was 2.72 s in spinfix). Anticipation reels keep a long glow hold and a slow brake, so the
// tease reads against the snappy normal stops. Turbo / quick spin keeps the old fast values exactly.
const sp = (ms: number) => Math.round(ms * SPIN_TEMPO);
// v20 (James 19:2x CDT, regular video: 1.63 s press-to-last-stop, stop gaps 0.20-0.23 s, "slow it down a beat"): normal
// first 800 -> 860 ms, stop gap 130 -> 195 ms (x1.5: on-screen gaps ~0.30-0.35 s, ~2.0-2.1 s total). Turbo unchanged.
// v20b (James 19:41 CDT, Stake 'poor animation' risk: the first spin scrolled whole strips, respins spun single cells):
// EVERY spin is now the per-cell spin the respins use (CELL_SPIN). A cell stop has no brake / settle tail, so normal pace
// is set on the stop times themselves: first reel ~0.80 s after the press, reels 0.32 s apart, last reel lands ~2.08 s
// after the press (+ its 0.24 s drop-in bounce). Cells in a reel cascade top to bottom `casc` ms. Turbo unchanged.
export const CELL_SPIN = true;
export const timing = () => (S.turbo
	? { first: 420, gap: 70, ant: 450, antD: 420, resp: 380, land: 60, cell: 35, casc: 12 }
	: CELL_SPIN ? { first: 800, gap: 320, ant: sp(720), antD: sp(760), resp: sp(420), land: 90, cell: sp(70), casc: 28 }
		: { first: 860, gap: 195, ant: sp(720), antD: sp(760), resp: sp(420), land: 90, cell: sp(70), casc: 0 });
// acc: spin-up ms; v: cells/s; D: nominal brake ms; ov: overshoot (cells); set: settle ms; pw: brake ease-out power;
// soft: one-way cosine settle (else the old damped spring); dMin/dMax: brake clamp; bl / td: blur strip max / tape dim
const P = () => (S.turbo
	? { wu: 0, amp: 0, acc: 70, v: 44, D: 220, ov: 0.14, set: 150, pw: 2, soft: false, smooth: false, dMin: 220, dMax: 900, bl: 1, td: 1 }
	: { wu: 90, amp: 0.12, acc: 140, v: 26, D: 360, ov: 0.14, set: 240, pw: 2.2, soft: true, smooth: true, dMin: 260, dMax: 700, bl: 1, td: 1 }); // re-audit M4: at speed the blur strip REPLACES the tape (was a 70/70 blend = double exposure)
/** v3.17 (James 2026-10-30, "the reels all stop at about the same time"): the shortest lead (ms from now) the first
 *  reel's land time needs so its brake (D) + settle (set) can still start in the future. When the RGS answer arrives
 *  late (real latency 300-800 ms on phones; the mock has none) the old `at = max(first, now + 120)` put every reel's
 *  brake start in the past, all five got clamped to "now" and landed together. bookEventHandlerMap schedules the
 *  first stop at least this far out, so every reel keeps its own brake and the T.gap stagger survives. */
export const stopLead = () => { if (CELL_SPIN) return 3 * timing().casc + 90; const p = P(); return p.D + p.set + 40; };
void STOP_TEMPO; // normal stops no longer derive from STOP_TEMPO (kept exported in tempo.ts for the respin mini cells)

type Slot = HTMLElement & { n?: number };
type Reel = {
	r: number; el: HTMLElement; tape: HTMLElement; blur: HTMLElement; slots: Slot[]; on: boolean;
	t0: number; p: ReturnType<typeof P>; init: string[];
	stop?: { tD: number; at: number; finals: string[]; onLand: () => void; res: () => void; slow?: number; s0?: number; v0?: number; dist?: number; D?: number; sEnd?: number; plan?: { sEnd: number; D: number } };
	blurA: number; tapeA: number;
};
const reels: Reel[] = [];
let raf = 0, t0 = 0, spinning = false;
export const isSpinning = () => spinning;
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.max(0, ms)));
export const sinceStart = () => performance.now() - t0;
export const markStopped = () => { spinning = false; bedOff(); };
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
	else html = symHTML(filler(R.r, n), undefined, R.r);
	if (s.dataset.h !== html) { s.dataset.h = html; s.replaceChildren(frag(html)); }
	s.classList.toggle('wild', wild);
}
// closed-form run motion: position (cells) and velocity (cells/s) at t ms after the reel started
function run(R: Reel, t: number) {
	const { wu, amp, acc, v } = R.p;
	if (wu && t < wu) { const a = (Math.PI / 2) * (t / wu); return { s: 3 - amp * Math.sin(a), v: -amp * Math.cos(a) * (Math.PI / 2) * (1000 / wu) }; }
	if (t < wu + acc) {
		const u = (t - wu) / acc;
		if (R.p.smooth) return { s: 3 - amp + (v * acc / 1000) * (u * u * u - (u * u * u * u) / 2), v: v * u * u * (3 - 2 * u) }; // smoothstep velocity, same distance as linear
		return { s: 3 - amp + (v * acc / 1000) * u * u / 2, v: v * u };
	}
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
				if (st.plan) { // pre-planned in stopReel: lands exactly at `at`, starts at the running speed
					st.sEnd = st.plan.sEnd; st.dist = st.sEnd + p.ov - m.s; st.D = st.plan.D;
				} else {
				// ease-out s = dist*(1-(1-u)^pw) starts at velocity pw*dist/D, so D = pw*dist/v0 keeps the speed continuous
				st.sEnd = Math.max(Math.round(m.s + (st.v0 * D0) / (p.pw * 1000) - p.ov), Math.floor(m.s) + 5);
				st.dist = st.sEnd + p.ov - m.s; st.D = Math.min(st.slow ? D0 + 400 : p.dMax, Math.max(st.slow ? D0 : p.dMin, (p.pw * 1000 * st.dist) / Math.max(st.v0, p.v * 0.5)));
				}
				R.slots.forEach((x) => { if (x.n !== undefined && st.sEnd! - x.n >= 0 && st.sEnd! - x.n < ROWS) x.n = undefined; });
			}
			const td = now - st.tD;
			if (td < st.D!) { const u = td / st.D!; s = st.s0 + st.dist! * (1 - Math.pow(1 - u, p.pw)); v = (p.pw * st.dist! * Math.pow(1 - u, p.pw - 1)) / (st.D! / 1000); }
			else if (td < st.D! + p.set) {
				const u = (td - st.D!) / p.set; v = 0;
				s = p.soft ? st.sEnd! + p.ov * Math.exp(-2.4 * u) * Math.cos(2 * Math.PI * u) * (1 - u) // anim-v4: back past the row, one small rebound, rest
					: st.sEnd! + p.ov * Math.exp(-3.2 * u) * Math.cos(2.6 * Math.PI * u) * (1 - u); // turbo: damped spring
			}
			else { land(R); continue; }
		} else ({ s, v } = run(R, now - R.t0));
		const c = S.cell, base = Math.floor(s), used = new Set<number>();
		for (let n = base - 3; n <= base + 1; n++) {
			const i = ((n % 6) + 6) % 6, sl = R.slots[i]; used.add(i);
			if (sl.n !== n) setSlot(R, sl, n);
			sl.style.transform = `translate3d(0,${((s - n) * c).toFixed(2)}px,0)`;
		}
		R.slots.forEach((sl, i) => { if (!used.has(i) && sl.n !== -999) { sl.n = -999; sl.style.transform = `translate3d(0,${-2 * c}px,0)`; } });
		const a = Math.max(0, Math.min(1, (v / p.v - 0.88) / 0.1)), per = 6 * c; // short crossfade window, so the two layers barely overlap
		const bA = Math.round(a * 50) / 50;
		if (bA !== R.blurA) { R.blurA = bA; R.blur.style.opacity = String(p.bl * bA); R.tape.style.opacity = String(1 - p.td * bA); }
		if (bA > 0) R.blur.style.transform = `translate3d(0,${(((s * c) % per) - per).toFixed(2)}px,0)`;
	}
	if (live) raf = requestAnimationFrame(frame);
}
function land(R: Reel) {
	const st = R.stop!; R.on = false; R.stop = undefined;
	st.onLand(); // cells now show the same symbols in the same place
	const lastReel = !reels.some((x) => x.on);
	if (!S.turbo) sfx(`reel_stop_${R.r + 1}` as 'reel_stop_1'); else if (lastReel) sfx(`reel_stop_${R.r + 1}` as 'reel_stop_1', { gain: 0.7 });
	if (lastReel) bedOff();
	R.el.style.visibility = 'hidden'; R.el.classList.remove('ant');
	st.res();
}
function startReel(R: Reel, rows: number[], now: number) {
	R.p = P(); R.t0 = now; R.on = true; R.stop = undefined; R.blurA = -1;
	R.init = Array.from({ length: ROWS }, (_, row) => symHTML(S.sym[R.r]?.[row] ?? 'L5', S.vals.get(k(R.r, row)), R.r));
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
	if (CELL_SPIN) { cellStops.forEach((c) => clearTimeout(c.timer)); cellStops.clear(); spinMini(cells); return; }
	if (!ensure()) return;
	const now = performance.now(); t0 = now; spinning = true;
	const by = new Map<number, number[]>(); cells.forEach((c) => by.set(c.reel, [...(by.get(c.reel) || []), c.row]));
	by.forEach((rows, r) => startReel(reels[r], rows, now));
	if (by.size) spinSound();
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
export const reelSpinning = (r: number) => !!reels[r]?.on || [...minis.keys()].some((id) => id[0] === String(r));
/** Land reels: `at` = ms after the spin start when the reel must be settled; `finals` = 4 row HTML strings. */
/** `slow` (ms) = anticipation: the reel glows from `glowAt` (ms after spin start) and brakes over `slow` ms. */
export function stopReel(r: number, at: number, finals: string[], onLand: () => void, slow = 0, glowAt = 0) {
	if (CELL_SPIN) return stopCells(r, at, onLand, slow, glowAt);
	const R = reels[r];
	if (!R?.on) { onLand(); return Promise.resolve(); }
	return new Promise<void>((res) => {
		const D0 = slow || R.p.D, tEnd = R.t0 + at, tD = Math.max(performance.now(), tEnd - R.p.set - D0);
		R.stop = { tD, at, finals, onLand, res, slow: slow || undefined };
		// normal pace: solve the brake start so the reel settles exactly at `at` AND enters the brake at its running speed
		// (s(tD) + v*D/pw = sEnd + ov, D = at - set - tD, sEnd an integer >= the first row not yet visible). Else the generic plan.
		const p = R.p;
		if (p.soft && !slow) {
			const E = at - p.set, lin = (t: number) => 3 - p.amp - (p.v * p.acc) / 2000 - (p.v * p.wu) / 1000 + (p.v * t) / 1000, t0 = E - p.D; // run() after the wind-up + spin-up
			const sEnd = Math.max(Math.round(lin(t0) + (p.v * p.D) / (p.pw * 1000) - p.ov), Math.floor(lin(t0)) + 5);
			const tq = (sEnd + p.ov - lin(0) - (p.v * E) / (p.pw * 1000)) / ((p.v / 1000) * (1 - 1 / p.pw)), D = E - tq;
			if (tq >= p.wu + p.acc && R.t0 + tq >= performance.now() + 4 && D >= p.dMin && D <= p.dMax && sEnd >= Math.floor(lin(tq)) + 5) { R.stop.tD = R.t0 + tq; R.stop.plan = { sEnd, D }; }
		}
		if (slow) { const g = () => R.on && R.stop?.res === res && R.el.classList.add('ant'); const dt = R.t0 + glowAt - performance.now(); dt > 0 ? setTimeout(g, dt) : g(); }
	});
}
/** Tap to skip: every reel that hasn't started braking lands now, left to right, with the normal (fast) brake. */
export function hurry() {
	if (CELL_SPIN) { hurryCells(); return; }
	const now = performance.now(); let i = 0;
	reels.forEach((R) => {
		const st = R.stop; if (!R.on || !st || st.s0 !== undefined) return;
		if (!S.turbo) R.p = { ...R.p, dMax: Math.min(R.p.dMax, 420), set: Math.min(R.p.set, 200) }; // a skip lands briskly (still bounces)
		st.slow = undefined; st.plan = undefined; st.tD = Math.min(st.tD, now + 60 * i++); R.el.classList.remove('ant');
	});
}
/** Hard stop (errors / resume): hide strips, unhide cells. */
export function abortSpin() {
	cellStops.forEach((c) => { clearTimeout(c.timer); c.res(); }); cellStops.clear();
	minis.forEach((m) => m.remove()); minis.clear(); antOff();
	reels.forEach((R) => { R.on = false; R.stop?.res(); R.stop = undefined; R.el.style.visibility = 'hidden'; });
	document.querySelectorAll('#cells .cell.spinning').forEach((c) => c.classList.remove('spinning'));
	spinning = false; bedOff();
}

// ---------- respins: every replaced cell spins on its own (reels stay still) ----------
// A masked mini-strip per cell (shape from CSS --cellMask, so a round porthole or a frameless cutout both work),
// scrolled by one CSS transform animation (compositor only, no rAF). Stops are staggered left to right, top to
// bottom; each cell lands with the squash-and-bounce (.cell.mLand).
const minis = new Map<string, HTMLElement>();
export function spinMini(cells: { reel: number; row: number }[]) {
	const host = document.getElementById('strips'); if (!host) return;
	t0 = performance.now(); spinning = true;
	if (cells.length) spinSound();
	cells.forEach(({ reel, row }, i) => {
		const c = document.getElementById(`c${reel}${row}`); if (!c) return;
		c.classList.remove('win', 'dim', 'sprWin', 'replace', 'out', 'locked', 'mLand', 'puffed'); c.querySelectorAll('.puffFx').forEach((x) => x.remove()); c.querySelectorAll('canvas').forEach((x) => x.remove());
		c.classList.add('spinning');
		const m = document.createElement('div'); m.className = 'mini';
		m.style.cssText = `left:${reel * S.cell}px;top:${row * S.cell}px`;
		const src = ART[(reel + row) % 2 ? 'reel_stripB' : 'reel_stripA'];
		m.innerHTML = `<i style="${src ? `background-image:url(${src});` : ''}animation-delay:${-(i * 97) % 600}ms"></i>`;
		host.appendChild(m); minis.set(`${reel}${row}`, m);
	});
}
// ---------- v20b: every spin is a per-cell spin (CELL_SPIN) ----------
// stopReel() lands a reel's spinning cells at `at` (ms after the spin start), top to bottom `casc` ms apart, each with the
// respin drop-in. onLand (the reveal's: renders the reel's four cells from the book's board) runs at the reel's first
// cell stop; the reel's cells still spinning are kept hidden under their minis until their own stop. Anticipation: the
// reel's cells spin at half speed from `glowAt` and the reel's edge glow (.strip.ant antGlow) shows until it lands.
type CellStop = { r: number; at: number; onLand: () => void; res: () => void; timer: number; done: boolean };
const cellStops = new Map<number, CellStop>();
const antEls = new Map<number, HTMLElement>();
function antOn(r: number) {
	if (!ensure()) return; const R = reels[r];
	R.el.style.cssText = `left:${r * S.cell}px;visibility:visible`; R.tape.style.opacity = '0'; R.blur.style.opacity = '0';
	R.el.classList.add('ant'); antEls.set(r, R.el); rigAnt(true);
	minis.forEach((m, id) => { if (id[0] === String(r)) m.classList.add('slow'); });
}
function antOff(r?: number) {
	antEls.forEach((el, rr) => { if (r !== undefined && rr !== r) return; el.classList.remove('ant'); el.style.visibility = 'hidden'; el.querySelector<HTMLElement>('.tape')!.style.opacity = ''; antEls.delete(rr); });
	if (!antEls.size) rigAnt(false);
}
function stopCells(r: number, at: number, onLand: () => void, slow = 0, glowAt = 0) {
	const mine = [...minis.keys()].filter((id) => id[0] === String(r)).map((id) => +id[1]).sort((a, b) => a - b);
	if (!mine.length) { onLand(); return Promise.resolve(); }
	return new Promise<void>((res) => {
		const st: CellStop = { r, at, onLand, res, timer: 0, done: false };
		cellStops.get(r)?.res(); cellStops.set(r, st);
		if (slow) { const dt = t0 + glowAt - performance.now(); if (dt > 0) setTimeout(() => { if (cellStops.get(r) === st && !st.done) antOn(r); }, dt); else antOn(r); }
		st.timer = window.setTimeout(() => landCells(st, mine), Math.max(0, t0 + at - (mine.length - 1) * timing().casc - performance.now()));
	});
}
async function landCells(st: CellStop, rows: number[]) {
	if (st.done) return; st.done = true;
	const r = st.r, casc = timing().casc;
	const still = (row: number) => minis.has(`${r}${row}`);
	st.onLand(); // the reel's cells now hold the book's symbols; the ones still under a mini stay hidden
	rows.forEach((row) => { if (still(row)) document.getElementById(`c${r}${row}`)?.classList.add('spinning'); });
	for (let i = 0; i < rows.length; i++) {
		if (i && casc) await sleep(casc);
		landMini(r, rows[i]);
	}
	antOff(r);
	if (cellStops.get(r) === st) cellStops.delete(r);
	st.res();
}
function hurryCells() {
	const now = performance.now(); let i = 0;
	[...cellStops.values()].sort((a, b) => a.r - b.r).forEach((st) => {
		if (st.done) return;
		const rows = [...minis.keys()].filter((id) => id[0] === String(st.r)).map((id) => +id[1]).sort((a, b) => a - b);
		const due = t0 + st.at - (rows.length - 1) * timing().casc;
		if (due <= now + 60 * i) { i++; return; }
		clearTimeout(st.timer); st.timer = window.setTimeout(() => landCells(st, rows), 60 * i++);
	});
	antOff();
}
/** One cell's stop: the mini goes, the cell shows its symbol with the respin drop-in (squash and bounce). */
function landMini(reel: number, row: number) {
	const m = minis.get(`${reel}${row}`);
	m?.remove(); minis.delete(`${reel}${row}`);
	const c = document.getElementById(`c${reel}${row}`);
	c?.classList.remove('spinning');
	if (!S.turbo) sfx('reel_stop_3', { throttle: 60 }); else if (!minis.size) sfx('reel_stop_3', { gain: 0.7 });
	if (!minis.size) bedOff();
	const sym = c?.querySelector<HTMLElement>('.sym');
	rigLand(c);
	if (S.turbo) sym?.animate([{ transform: 'translateY(-28%) scale(.94,1.06)' }, { transform: 'translateY(4%) scale(1.07,.92)', offset: .45 }, { transform: 'translateY(-2%) scale(.98,1.02)', offset: .75 }, { transform: 'none' }], { duration: 160, easing: 'ease-out' });
	else sym?.animate([{ transform: 'translateY(-22%) scale(.96,1.04)', opacity: 0.5 }, { transform: 'translateY(3%) scale(1.05,.94)', opacity: 1, offset: .5 }, { transform: 'translateY(-1%) scale(.99,1.01)', offset: .78 }, { transform: 'none' }], { duration: 240, easing: 'ease-out' });
}
/** Land one mini-spinning cell at `at` ms after the respin started; onLand renders the final symbol. */
export function stopMini(reel: number, row: number, at: number, onLand: () => void) {
	const m = minis.get(`${reel}${row}`);
	return new Promise<void>((res) => setTimeout(() => {
		void m; onLand(); landMini(reel, row); // same drop-in as every spin (v20b landMini)
		res();
	}, Math.max(0, t0 + at - performance.now())));
}
