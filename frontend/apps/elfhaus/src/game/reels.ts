// Cell spin engine (chalet B, James: "each cell is its own mini-spinner"). Every spinning cell is an independent spinner:
// a fixed window (the tile box) through which whole units scroll vertically: each unit is a symbol together with its
// own tile (red highs, green lows, the scatter and wild tiles), so no tile is ever neutral or recoloured. Nothing scrolls across cells or as a column. One rAF loop drives every spinner with closed-form motion on
// real elapsed time (performance.now), so it is the same at 60, 120 or 144 Hz:
//   wind-up  : a small upward tug (cosine ease, velocity 0 at both ends)
//   accel    : smoothstep velocity ramp to full speed
//   run      : constant speed; only near full speed a light vertical stretch of the units
//   slow     : anticipation cells ease down to a tease speed (smoothstep velocity)
//   brake    : power ease-out planned when the stop is issued: it starts at the running speed (continuous velocity),
//              ends exactly on time and runs PAST the final symbol by `ov` of a pitch
//   settle   : back onto the final symbol with one small rebound, (1-u)^3(1+3u)cos(1.5 pi u): no velocity jump
// The final unit is chosen while it is still out of view, so it scrolls in for real and lands exactly. At the end of
// the settle the cell is rendered with the same tile + symbol in the same place, the spinner goes in the same frame and
// the cell's tile plays its border glint.
// Starts and stops are staggered left to right, top to bottom within each reel (the cell order). Turbo = the same
// motion, faster. Respins spin only the popped cells. Each spinner = a fixed clipped window with three
// recycled units moved by translate3d only (unit = ART[unitTileKey(key)] tile + ART[key + '_spin'] symbol, symrig.ts).
import { rigAnt, rigLand, hasRig, frameTier, unitTileKey } from './symrig';
import { S, ART } from './ui';
import { ROWS, REELS } from './config';
import { SPIN_TEMPO, STOP_TEMPO } from './tempo';
import { sfx, loop, type Handle } from './audio';
// sound (v3.8): spin start + spin bed on every spin / respin (no bed in turbo); a stop per cell (turbo: the last one, quieter)
let bed: Handle | null = null;
const spinSound = () => { sfx('reel_spin_start'); bed?.stop(); bed = S.turbo ? null : loop('reel_spin_loop'); };
const bedOff = () => { bed?.stop(150); bed = null; };

const sp = (ms: number) => Math.round(ms * SPIN_TEMPO);
void STOP_TEMPO;
// Stop schedule (bookEventHandlerMap): first reel ~0.80 s after the press, reels 0.32 s apart; within a reel the cells
// stop top to bottom `casc` ms apart; a reel's last cell impacts ~`at` (+ pad - set) and has settled at at + pad.
// Normal: last reel's impact ~2.04 s after the press (was 2.08 s + a 0.24 s drop-in). Turbo: the same motion, faster.
export const timing = () => (S.turbo
	? { first: 300, gap: 100, ant: 220, antD: 240, resp: 240, land: 0, cell: 35, casc: 8 }
	: { first: 600, gap: 200, ant: sp(420), antD: sp(440), resp: sp(360), land: 0, cell: sp(60), casc: 15 });
// wu/amp: wind-up ms / pitches; acc: spin-up ms; v: pitches/s; D: nominal brake ms (Ds: anticipation); ov: overshoot
// (pitches); set: settle ms; pw: brake power; pad: settle end after the scheduled stop; vS/dS: tease speed / ease ms;
// st: start stagger per reel / per row ms; thd: tile thud ms
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
// reduced motion: no wind-up tug, no overshoot / rebound (the trail, thud and glint are off in CSS)
const P = () => { const p = P0(); return reduced() ? { ...p, amp: 0, ov: 0, wu: 0 } : p; };
const P0 = () => (S.turbo
	? { wu: 0, amp: 0, acc: 50, v: 26, D: 70, Ds: 240, ov: 0.12, set: 75, pw: 2, pad: 75, vS: 0.45, dS: 120, stR: 6, stW: 2, dMin: 50, dMax: 140, thd: 120 }
	: { wu: 0, amp: 0, acc: 100, v: 18, D: 110, Ds: 420, ov: 0.12, set: 140, pw: 2, pad: 140, vS: 0.4, dS: 200, stR: 12, stW: 4, dMin: 80, dMax: 200, thd: 200 });
type Prm = ReturnType<typeof P0>;
// anticipation-cell motion (overrides P0 on teasing reels only; base reels unchanged)
const TEASE = () => (S.turbo
	? { vS: 0.3, dS: 320, Ds: 600, pw: 3, ov: 0.26, set: 170, pad: 170 }
	: { vS: 0.2, dS: 650, Ds: 1150, pw: 3, ov: 0.34, set: 300, pad: 300 });
/** The shortest lead (ms from now) the first reel's stop needs so every cell of it can still brake from the future. */
export const stopLead = () => { const p = P(); return p.D + p.set + 3 * timing().casc + 40 - p.pad; };

type Slot = HTMLElement & { n?: number };
type Plan = { tq: number; sq: number; dist: number; D: number; E: number; sEnd: number; end: number };
type Cell = {
	r: number; row: number; el: HTMLElement; win: HTMLElement; slots: Slot[];
	t0: number; p: Prm; init: string; empty?: boolean; fin?: string; slowAt?: number; plan?: Plan; impacted?: boolean;
	end?: number; onLand?: () => void; res?: () => void; tr?: number;
};
const cells = new Map<string, Cell>();
let raf = 0, t0 = 0, spinning = false;
export const isSpinning = () => spinning;
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.max(0, ms)));
export const sinceStart = () => performance.now() - t0;
export const markStopped = () => { spinning = false; bedOff(); };

const FILL = ['H1', 'L1', 'H2', 'L2', 'L3', 'H3', 'L4', 'L5', 'H4', 'L2', 'L5', 'L1', 'L4', 'L3'];
const keyOf = (name: string, r: number) => (name === 'W' ? (hasRig('W_R' + (r + 1)) ? 'W_R' + (r + 1) : 'W') : name);
// per-cell, per-spin random stream (no two cells / spins run the same sequence, no visible loop), never the same
// symbol twice in a row, a wild now and then
const hash = (a: number) => { a = Math.imul(a ^ (a >>> 16), 0x45d9f3b); a = Math.imul(a ^ (a >>> 16), 0x45d9f3b); return (a ^ (a >>> 16)) >>> 0; };
const seeds = new Map<string, number>();
function filler(C: Cell, n: number): string {
	const key = C.r + ':' + C.row;
	let sd = seeds.get(key); if (sd === undefined) seeds.set(key, (sd = (Math.random() * 2 ** 31) | 0));
	const h = hash(sd + n * 7919);
	if (h % 19 === 7 && n > 2) return keyOf('W', C.r);
	const a = FILL[h % FILL.length], prev = n > 1 ? FILL[hash(sd + (n - 1) * 7919) % FILL.length] : '';
	return a === prev ? FILL[(h + 3) % FILL.length] : a;
}
const spinImg = (key: string) => ART[key + '_spin'] || null;
function slotKey(C: Cell, n: number) {
	if (n === 0) return C.init;
	if (C.plan && n === C.plan.sEnd && C.fin) return C.fin;
	return filler(C, n);
}
// A slot is a whole unit: the symbol's own tile (.slT) + the symbol (.slS) in one container, so every passing symbol
// carries its correct tile and the landed one is simply the final unit. Nothing is ever recoloured; the cell's window
// (.cwin) stays fixed and only the units move.
function setSlot(C: Cell, s: Slot, n: number) {
	s.n = n; const k = slotKey(C, n);
	const empty = n === 0 && !!C.empty, id = empty ? k + ':empty' : k;
	if (s.dataset.id === id) return;
	s.dataset.id = id; s.dataset.k = k; s.dataset.tier = frameTier(k) || 'wild'; s.dataset.empty = empty ? '1' : '';
	const t = ART[unitTileKey(k)], u = empty ? null : spinImg(k);
	(s.firstElementChild as HTMLElement).style.backgroundImage = t ? `url(${t})` : 'none';
	(s.lastElementChild as HTMLElement).style.backgroundImage = u ? `url(${u})` : 'none';
}
function makeCell(r: number, row: number, now: number, host: HTMLElement) {
	const key = keyOf(S.sym[r]?.[row] ?? 'L5', r), p = P();
	const el = document.createElement('div'); el.className = 'cspin';
	el.style.cssText = `left:${r * S.cell}px;top:${row * S.cell}px`;
	el.innerHTML = `<div class="cwin">${'<i class="sl"><i class="slT"></i><i class="slS"></i></i>'.repeat(3)}</div>`;
	host.appendChild(el);
	const C: Cell = { r, row, el, win: el.querySelector('.cwin')!, slots: [...el.querySelectorAll<Slot>('.sl')], t0: now + r * p.stR + row * p.stW, p, init: key };
	return C;
}
// ---- closed-form motion (s in pitches, v in pitches/s, t in ms since the cell's own start) ----
function free(C: Cell, t: number) {
	const { wu, amp, acc, v } = C.p;
	if (t <= 0) return { s: 0, v: 0 };
	if (t < wu) { const u = t / wu; return { s: (-amp * (1 - Math.cos(Math.PI * u))) / 2, v: ((-amp * Math.PI) / 2) * Math.sin(Math.PI * u) * (1000 / wu) }; }
	if (t < wu + acc) { const u = (t - wu) / acc; return { s: -amp + ((v * acc) / 1000) * (u * u * u - (u * u * u * u) / 2), v: v * u * u * (3 - 2 * u) }; }
	const s0 = -amp + (v * acc) / 2000, tr = t - wu - acc;
	if (C.slowAt === undefined) return { s: s0 + (v * tr) / 1000, v };
	const ts = Math.max(0, C.slowAt - C.t0 - wu - acc), v2 = v * C.p.vS, dS = C.p.dS;
	if (tr <= ts) return { s: s0 + (v * tr) / 1000, v };
	const du = Math.min(tr - ts, dS), u = du / dS;
	let s = s0 + (v * ts) / 1000 + (v * du + (v2 - v) * dS * (u * u * u - (u * u * u * u) / 2)) / 1000, vel = v + (v2 - v) * u * u * (3 - 2 * u);
	if (tr - ts > dS) { s += (v2 * (tr - ts - dS)) / 1000; vel = v2; }
	return { s, v: vel };
}
/** Plan the landing: settle ends at absolute time `end`; solve the brake start so the speed stays continuous. */
function plan(C: Cell, end: number, now: number) {
	const p = C.p, E = end - p.set - C.t0, nowR = now - C.t0 + 6;   // ms relative to the cell's start
	const Dn = C.slowAt !== undefined ? p.Ds : p.D, dMax = C.slowAt !== undefined ? p.Ds + 500 : p.dMax;
	const minEnd = Math.floor(free(C, Math.max(nowR, 0)).s) + 2;   // first index not yet on a slot
	const f = (tq: number) => { const m = free(C, tq); return m.s + (m.v * (E - tq)) / (p.pw * 1000); };
	const lo = Math.max(nowR, E - dMax), hi = E - p.dMin;
	if (hi > lo) {
		const base = Math.round(f(Math.max(lo, Math.min(hi, E - Dn))) - p.ov);
		for (const d of [0, 1, -1, 2, -2, 3]) {
			const sEnd = base + d; if (sEnd < minEnd) continue;
			const goal = sEnd + p.ov; let a = lo, b = hi;
			if ((f(a) - goal) * (f(b) - goal) > 0) continue;
			for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if ((f(m) - goal) * (f(a) - goal) <= 0) b = m; else a = m; }
			const tq = (a + b) / 2, m = free(C, tq);
			if (m.v <= 0.5) continue;
			C.plan = { tq, sq: m.s, dist: goal - m.s, D: E - tq, E, sEnd, end: C.t0 + E + p.set };
			return;
		}
	}
	// no exact fit (a very late stop): brake from now at the running speed, landing a little later
	const tq = Math.max(nowR, 0), m = free(C, tq), v = Math.max(m.v, p.v * 0.3);
	const sEnd = Math.max(minEnd, Math.ceil(m.s + (v * Dn) / (p.pw * 1000) - p.ov)), dist = sEnd + p.ov - m.s;
	const D = Math.min(1500, (p.pw * 1000 * dist) / v);
	C.plan = { tq, sq: m.s, dist, D, E: tq + D, sEnd, end: C.t0 + tq + D + p.set };
}
function pos(C: Cell, now: number) {
	const t = now - C.t0, P0 = C.plan;
	if (!P0 || t < P0.tq) return { ...free(C, t), ph: 0 };
	const td = t - P0.tq, p = C.p;
	if (td < P0.D) { const u = td / P0.D; return { s: P0.sq + P0.dist * (1 - Math.pow(1 - u, p.pw)), v: (p.pw * P0.dist * Math.pow(1 - u, p.pw - 1)) / (P0.D / 1000), ph: 1 }; }
	const u = Math.min(1, (td - P0.D) / p.set);
	return { s: P0.sEnd + p.ov * (1 - u) * (1 - u) * (1 + 2 * u), v: 0, ph: u >= 1 ? 3 : 2, u }; // one spring back, no wobble
}
function paint(C: Cell, at: number, pitch: number) {
	const base = Math.floor(at);
	for (let n = base - 1; n <= base + 1; n++) {
		const sl = C.slots[((n % 3) + 3) % 3];
		if (sl.n !== n) setSlot(C, sl, n);
		sl.style.transform = `translate3d(0,${((at - n) * pitch).toFixed(2)}px,0)`;
	}
}
function frame(now: number) {
	raf = 0;
	const pitch = S.cell * 0.925 * 1.08;
	for (const C of [...cells.values()]) {
		const m = pos(C, now);
		if (m.ph >= 1 && !C.impacted && C.plan && now >= C.t0 + C.plan.E - 8) impact(C); // stop sound at the overshoot's bottom
		if (m.ph === 3) { finish(C); continue; }
		paint(C, m.s, pitch);
		// light trail + stretch only at full speed
		const k = Math.round(Math.max(0, Math.min(1, (Math.abs(m.v) / C.p.v - 0.8) / 0.2)) * 20) / 20;
		if (k !== C.tr) { C.tr = k; C.win.style.setProperty('--tr', String(k)); }
	}
	if (cells.size) raf = requestAnimationFrame(frame);
}
let scSpin = -1, scN = 0;   // scatters landed this spin (scatter_land pitch steps)
function impact(C: Cell) {
	C.impacted = true;
	C.el.classList.add('tLand');
	const stop = `reel_stop_${Math.min(5, Math.max(1, C.r + 1))}` as 'reel_stop_1';   // v9: one tuned stop per reel (C# set)
	if (!S.turbo) sfx(stop, { throttle: 60 }); else if ([...cells.values()].every((x) => x === C || x.impacted)) sfx('reel_stop_3', { gain: 0.7 });
	// v9: one scatter land sound, stepped up the C# major triad per scatter (root, major third, fifth)
	if (C.fin === 'S') { if (scSpin !== t0) { scSpin = t0; scN = 0; } scN = Math.min(3, scN + 1); sfx('scatter_land', { throttle: 60, rate: [1, 1.2599, 1.4983][scN - 1] }); }
}
function finish(C: Cell) {
	cells.delete(`${C.r}${C.row}`);
	const onLand = C.onLand, res = C.res;
	C.onLand = C.res = undefined;
	onLand?.();   // the cell now shows the same symbol in the same place
	const c = document.getElementById(`c${C.r}${C.row}`);
	c?.classList.remove('spinning');
	if (c) { c.style.setProperty('--gd', `-${C.p.set}ms`); c.classList.remove('tGlint'); void c.offsetWidth; c.classList.add('tGlint'); setTimeout(() => c.classList.remove('tGlint'), 500); rigLand(c); }
	C.el.remove();
	if (!cells.size) bedOff();
	antCheck(C.r);
	res?.();
}
function ensureLoop() { if (!raf) raf = requestAnimationFrame(frame); }

/** Spin the given free cells: each its own spinner. */
export function spinCells(list: { reel: number; row: number }[]) {
	const host = document.getElementById('strips'); if (!host) return;
	const now = performance.now(); t0 = now; spinning = true;
	list.forEach(({ reel, row }) => {
		const id = `${reel}${row}`; const old = cells.get(id); if (old) { old.el.remove(); old.res?.(); cells.delete(id); }
		const c = document.getElementById(`c${reel}${row}`); if (!c) return;
		seeds.delete(reel + ':' + row);
		// a popped cell (its symbol burst into snow) starts from its own tile alone: that empty unit scrolls away as the
		// new units drop in (the popped symbol never reappears, the tile never changes colour)
		const symEl = c.querySelector(':scope>.sym'), wasPuffed = c.classList.contains('puffed') || !!symEl?.getAnimations().length && getComputedStyle(symEl!).opacity === '0';
		const prev = symEl && (symEl.classList.contains('W') ? keyOf('W', reel) : [...symEl.classList].find((x) => /^(H\d|L\d|S)$/.test(x)));
		const C = makeCell(reel, row, now, host);
		if (wasPuffed && prev) { C.init = prev; C.empty = true; }
		c.classList.remove('win', 'dim', 'sprWin', 'replace', 'out', 'locked', 'mLand', 'puffed', 'tLand', 'tGlint', 'rgLand');
		c.querySelectorAll('canvas').forEach((x) => x.remove());
		// fix7: the spinner's units are painted NOW (the resting symbol in place), before the cell hides under it: spin start
		// goes straight from the resting symbols into motion, never a frame with every symbol gone
		paint(C, 0, S.cell * 0.925 * 1.08);
		// the resting cell stays shown under the spinner for two frames, while the spinner's fresh background images decode
		// (hiding it at once left one frame with the whole board empty); the wind-up keeps them aligned meanwhile
		cells.set(id, C);
		requestAnimationFrame(() => requestAnimationFrame(() => { if (cells.get(id) === C) c.classList.add('spinning'); }));
	});
	if (list.length) spinSound();
	ensureLoop();
}
/** Spin every free cell; `keep(reel,row)` true = stays still (locked wilds, full-reel columns). */
export function startSpin(keep: (reel: number, row: number) => boolean = () => false) {
	const list: { reel: number; row: number }[] = [];
	for (let r = 0; r < REELS; r++) for (let row = 0; row < ROWS; row++) {
		const c = document.getElementById(`c${r}${row}`);
		if (!c || keep(r, row) || c.style.visibility === 'hidden') continue;
		list.push({ reel: r, row });
	}
	spinCells(list);
}
function stopCell(C: Cell, end: number, onLand: () => void) {
	return new Promise<void>((res) => {
		C.res?.(); C.onLand = onLand; C.res = res; C.end = end;
		C.fin = keyOf(S.sym[C.r]?.[C.row] ?? 'L5', C.r);
		plan(C, end, performance.now());
		ensureLoop();
	});
}
/** Land reel r's spinning cells: the last at `at` ms after the spin start, the others top to bottom `casc` ms before.
 *  onCell(row) renders that row (from the book's board); rows not spinning are rendered with the reel's first stop.
 *  `slow` = anticipation: the reel's cells ease to a tease speed from `glowAt`, the reel glows and they brake long. */
export function stopReel(r: number, at: number, onCell: (row: number) => void, slow = 0, glowAt = 0) {
	const tz = TEASE();
	const mine = [...cells.values()].filter((C) => C.r === r).sort((a, b) => a.row - b.row);
	const others = Array.from({ length: ROWS }, (_, row) => row).filter((row) => !mine.some((C) => C.row === row));
	if (!mine.length) { others.forEach(onCell); return Promise.resolve(); }
	const T = timing();
	if (slow) {
		// tease motion: blur -> readable crawl (vS) -> long power-3 creep over the last ~1.5 symbols -> snap with a big overshoot
		mine.forEach((C) => { C.slowAt = t0 + glowAt; if (!reduced()) C.p = { ...C.p, ...tz }; });
		const dt = t0 + glowAt - performance.now();
		const go = () => { if (mine.some((C) => cells.get(`${C.r}${C.row}`) === C)) antOn(r); };
		dt > 0 ? setTimeout(go, dt) : go();
	}
	let first = true;
	return Promise.all(mine.map((C, i) => {
		const end = t0 + at - (mine.length - 1 - i) * T.casc + C.p.pad;
		return stopCell(C, end, () => { if (first) { first = false; others.forEach(onCell); } onCell(C.row); });
	})).then(() => {});
}
/** Tap to skip: every cell that hasn't started braking lands soon, left to right, top to bottom. */
export function hurry() {
	const now = performance.now(); let i = 0;
	[...cells.values()].sort((a, b) => a.r - b.r || a.row - b.row).forEach((C) => {
		if (!C.plan || now >= C.t0 + C.plan.tq - 10) return;
		C.p = { ...C.p, D: Math.min(C.p.D, 260), dMin: Math.min(C.p.dMin, 160), set: Math.min(C.p.set, 200) };
		const end = Math.min(C.plan.end, now + C.p.D + C.p.set + 30 + 25 * i++);
		C.plan = undefined; plan(C, end, now);
	});
	antOff();
}
/** Hard stop (errors / resume): remove the spinners, unhide the cells. */
export function abortSpin() {
	cells.forEach((C) => { C.el.remove(); C.res?.(); }); cells.clear(); antOff();
	document.querySelectorAll('#cells .cell.spinning').forEach((c) => c.classList.remove('spinning'));
	spinning = false; bedOff();
}

// ---------- respins: only the replaced cells spin (same spinner) ----------
export function spinMini(list: { reel: number; row: number }[]) { spinCells(list); }
/** Land one spinning cell at `at` ms after the respin started; onLand renders the final symbol. */
export function stopMini(reel: number, row: number, at: number, onLand: () => void) {
	const C = cells.get(`${reel}${row}`);
	if (!C) { onLand(); return Promise.resolve(); }
	return stopCell(C, t0 + at + C.p.pad, onLand);
}

// ---------- anticipation: the reel's edge glow (.strip.ant antGlow) while its cells tease ----------
const strips: HTMLElement[] = [];
function strip(r: number) {
	const host = document.getElementById('strips'); if (!host) return null;
	if (!strips[r]) { const el = document.createElement('div'); el.className = 'strip'; el.innerHTML = '<div class="antGlow"></div>'; host.appendChild(el); strips[r] = el; }
	return strips[r];
}
const antReels = new Set<number>();
function antOn(r: number) {
	const el = strip(r); if (!el) return;
	el.style.cssText = `left:${r * S.cell}px;visibility:visible`; el.classList.add('ant'); antReels.add(r); rigAnt(true); document.body.classList.add('teasing');
	cells.forEach((C) => { if (C.r === r) C.el.classList.add('ant'); });
}
function antOff(r?: number) {
	antReels.forEach((rr) => { if (r !== undefined && rr !== r) return; const el = strips[rr]; if (el) { el.classList.remove('ant'); el.style.visibility = 'hidden'; } antReels.delete(rr); });
	if (!antReels.size) { rigAnt(false); document.body.classList.remove('teasing'); }
}
function antCheck(r: number) { if (antReels.has(r) && ![...cells.values()].some((C) => C.r === r)) antOff(r); }
