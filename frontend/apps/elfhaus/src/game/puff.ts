// Win pop + snow puff, PixiJS (fix6 item 2, James 2026-11-04 "the puff MUST be rendered in PixiJS").
// On a win that leads into a respin, each cleared (non-wild, replaced) symbol swells, squashes and pops; a burst of cloud
// puffs, a flash and an ice ring fire as it collapses, then the snow (big + small flakes), the powder dust and the glitter
// hang about ~1.3 s, drifting down. puffLayer() is a self-contained container in the unified board stage
// (board/stage.ts, layer symFx), aligned to the cells' layout boxes. The DOM symbol is hidden the moment its Pixi copy
// takes over, so the pop never depends on DOM / WAAPI compositing. Non-blocking: the game flow waits only for the
// swell + burst (~0.55 s); the linger never gates anything, survives the respin and fades when the next puff starts.
// A skip (tap) releases the game flow at once but never cuts the pop or the snow (they keep playing on their own).
// Reduced motion: the same pop + snow, gentler (no squash overshoot, no jitter, fewer flakes, no flash), never a bare fade.
import { Application, Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { S, k, ART } from './ui';
import { loadAtlas, atlasTex } from './scene/atlas';
import { loadTex } from './scene/load';
import { symArtReady } from './symrig';
import { FZ } from './layers';
import { boardStage, layer, animate, centreOf } from './board/stage';
import type { BookEvent, Pos } from './typesBookEvent';

const PP = { url: 'assets/fx/puff_parts.webp', f: { flake: [0, 0, 72, 72], glint: [74, 0, 44, 44], flash: [120, 0, 128, 128], ring: [250, 0, 192, 192] } } as const;
type PartN = keyof typeof PP.f;
const TX: Partial<Record<PartN | 'cloud' | 'bigFlake', Texture>> = {};
const symTex = new Map<string, Texture>();
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let app: Application | null = null, appP: Promise<Application | null> | null = null, root: Container, L: Record<keyof typeof FZ, Container>;
type P = { s: Sprite; t0: number; dur: number; step: (u: number, s: Sprite) => void; linger: boolean; done?: () => void; out?: number; edge: boolean };
// the board window (frame-local px): FX stay inside it and fade out near its edge, so the front lip never visibly chops
// a flake mid-air (James 2026-11-04: FX below the lip, nothing spills past the frame)
let win = { x0: 0, y0: 0, x1: 1e6, y1: 1e6, f: 12 };
function measureWin() { const b = document.getElementById('board'); if (!b) return; const c = centreOf(b); win = { x0: c.x - c.w / 2, y0: c.y - c.h / 2, x1: c.x + c.w / 2, y1: c.y + c.h / 2, f: Math.max(8, c.w * 0.05) }; }
function edgeA(s: Sprite) {
	const hw = s.width / 2, hh = s.height / 2;
	const d = Math.min(s.x - hw - win.x0, win.x1 - s.x - hw, s.y - hh - win.y0, win.y1 - s.y - hh);
	return d >= win.f ? 1 : d <= 0 ? 0 : d / win.f;
}
const ps = new Set<P>();
const now = () => performance.now();
const W = window as unknown as { __puffN?: number; __puffLog?: unknown[] };

function ensureApp() {
	return (appP ??= boardStage().then((a) => {
		if (!a) return null;
		root = new Container(); root.label = 'puff'; root.sortableChildren = true; layer.symFx.addChild(root);
		L = { swell: new Container(), powder: new Container(), flakes: new Container(), glitter: new Container() };
		for (const n of Object.keys(L) as (keyof typeof FZ)[]) { L[n].zIndex = FZ[n]; root.addChild(L[n]); }
		app = a; return a;
	}));
}
function tick() {
	const t = now();
	for (const p of ps) {
		const u = (t - p.t0) / p.dur;
		if (u < 0) { p.s.visible = false; continue; }
		p.s.visible = true; p.step(Math.min(1, u), p.s);
		if (p.out != null) p.s.alpha *= Math.max(0, 1 - (t - p.out) / 200);
		if (p.edge) p.s.alpha *= edgeA(p.s);
		if (u >= 1 || (p.out != null && t - p.out >= 200)) { ps.delete(p); p.s.destroy(); p.done?.(); }
	}
	return ps.size > 0;
}
function add(layer: Container, tex: Texture | undefined, t0: number, dur: number, step: P['step'], linger: boolean) {
	return new Promise<void>((done) => {
		if (!tex) return done();
		const s = new Sprite(tex); s.anchor.set(0.5); s.visible = false; layer.addChild(s);
		ps.add({ s, t0, dur, step, linger, done, edge: linger && layer !== L.powder }); animate(tick);
	});
}
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const easeOut = (u: number) => 1 - (1 - u) ** 3, easeIn = (u: number) => u * u, easeIO = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
/** keyframes [offset, value] -> value at u (linear between keys, eased by `e` inside each segment) */
const kf = (K: [number, number][], u: number, e = (x: number) => x) => { for (let i = 1; i < K.length; i++) if (u <= K[i][0]) { const [a, va] = K[i - 1], [b, vb] = K[i]; return lerp(va, vb, e((u - a) / Math.max(1e-6, b - a))); } return K[K.length - 1][1]; };
const R = Math.random, sgn = () => (R() < 0.5 ? -1 : 1);
const fit = (s: Sprite, px: number) => { const t = s.texture; return px / Math.max(t.orig.width, t.orig.height); };

/** The self-contained puff container (layers swell / powder / flakes / glitter, FZ order). Positions are #frame-local
 *  layout px; it lives in the unified board stage (board/stage.ts layer symFx). */
export const puffLayer = () => root;
/** Load every puff texture (fx atlas, the parts sheet, the baked symbol art) and draw each once (GPU upload). */
export async function preloadPuff() {
	const a = await ensureApp(); if (!a) return;
	await Promise.all([loadAtlas('fx'), Assets.load(PP.url).catch(() => null), symArtReady]).then(([, sheet]) => {
		try { TX.cloud = atlasTex('fx', 'puff_cloud'); TX.bigFlake = atlasTex('fx', 'puff_flake'); } catch (e) { console.warn('puff atlas', e); }
		if (sheet) for (const [n, [x, y, w, h]] of Object.entries(PP.f)) TX[n as PartN] = new Texture({ source: (sheet as Texture).source, frame: new Rectangle(x, y, w, h) });
	});
	await Promise.all(symKeys().map(async (n) => { const u = artOf(n); if (u && !symTex.has(n)) { try { symTex.set(n, await loadTex(u)); } catch { /* falls back to no swell sprite */ } } }));
	// warm-up: one invisible frame with every texture so the first real puff never uploads mid-burst
	const tmp = [...Object.values(TX), ...symTex.values()].filter(Boolean).map((t) => { const s = new Sprite(t); s.alpha = 0.001; s.scale.set(0.05); root.addChild(s); return s; });
	a.render(); tmp.forEach((s) => s.destroy());
}
const symKeys = () => Object.keys(ART).filter((n) => /^(H\d|L\d|M\d|S|W(_R\d)?)$/.test(n));
const artOf = (n: string) => ART[n + '_spin'] || ART[n] || '';

/** One cell: Pixi swell -> pop -> burst -> snow linger. Resolves when the swell + burst are done (the game flow gate). */
function puffCell(cell: HTMLElement, name: string, delay: number, kT: number, rm: boolean) {
	if (!app) return Promise.resolve();
	const sym = cell.querySelector<HTMLElement>(':scope>.sym');
	// the cell's centre in frame-local layout px (the board stage's space)
	const C0 = centreOf(cell), cw = C0.w, ch = C0.h, cx = C0.x, cy = C0.y, c = Math.min(cw, ch), x = cx - cw / 2, y = cy - ch / 2;
	const t = now() + delay, at = t + 170 * kT, Lk = kT < 1 ? 1 : 2.7, gate: Promise<void>[] = [];
	// swell: the symbol's own art in Pixi, swelling, squashing, collapsing to nothing (the DOM symbol is hidden at t)
	const st = symTex.get(name) || (artOf(name) ? Texture.from(artOf(name)) : undefined);
	W.__puffN = (W.__puffN || 0) + 1; (W.__puffLog ??= []).push({ id: cell.id, name, t: Math.round(t), rm, swell: !!st, snow: !!TX.bigFlake && !!TX.flake });
	const sw = sym?.offsetWidth || cw, sh = sym?.offsetHeight || ch, sx0 = x + (sym?.offsetLeft ?? 0) + sw / 2, sy0 = y + (sym?.offsetTop ?? 0) + sh / 2;
	setTimeout(() => cell.classList.add('puffed'), Math.max(0, delay));
	gate.push(add(L.swell, st, t, 300 * kT, (u, s) => {
		const b = fit(s, Math.max(sw, sh));
		const X = rm ? kf([[0, 1], [0.4, 1.1], [1, 0]], u, easeIO) : kf([[0, 1], [0.35, 1.2], [0.6, 0.82], [1, 0]], u, easeIn);
		const Y = rm ? X : kf([[0, 1], [0.35, 1.12], [0.6, 0.9], [1, 0]], u, easeIn);
		const j = rm || u > 0.6 ? 0 : Math.sin(u * 60) * c * 0.012;   // a little shake on the swell (not with reduced motion)
		s.position.set(sx0 + j, sy0); s.scale.set(b * X, b * Y); s.alpha = u < 0.85 ? 1 : 1 - (u - 0.85) / 0.15;
	}, false));
	// cloud puffs: a ring of flat cream blobs that swell and fade
	const nCloud = rm ? 4 : 6;
	for (let i = 0; i < nCloud; i++) {
		const a = (i / nCloud) * Math.PI * 2 + 0.4, dx = Math.cos(a) * c * 0.075, dy = Math.sin(a) * c * 0.075;
		gate.push(add(L.powder, TX.cloud, at, 380 * kT, (u, s) => { const e = easeOut(u), b = fit(s, c * 0.34);
			s.position.set(cx + dx * kf([[0, 0], [0.45, 0.8], [1, 1]], e), cy + dy * kf([[0, 0], [0.45, 0.8], [1, 1]], e));
			s.scale.set(b * kf([[0, 0.2], [0.45, 1], [1, 0.6]], u)); s.alpha = kf([[0, 1], [0.45, 1], [1, 0]], u); }, false));
	}
	// flash + ice ring as the symbol bursts
	if (!rm) gate.push(add(L.glitter, TX.flash, at - 20 * kT, 200 * kT, (u, s) => { const b = fit(s, c * 1.2); s.position.set(cx, cy); s.scale.set(b * kf([[0, 0.35], [0.3, 0.95], [1, 1.15]], u)); s.alpha = kf([[0, 0], [0.3, 0.95], [1, 0]], u); }, false));
	gate.push(add(L.powder, TX.ring, at, 380 * kT, (u, s) => { const b = fit(s, c); s.position.set(cx, cy); s.scale.set(b * kf([[0, 0.3], [0.25, 0.85], [1, 1.45]], u, easeOut)); s.alpha = kf([[0, 0], [0.25, 1], [1, 0]], u); }, false));
	// snow: big flakes tumble out then drift down with a sway (12; reduced motion 5, no spin)
	const nBig = rm ? 5 : 12;
	for (let i = 0; i < nBig; i++) {
		const a = (i / nBig) * Math.PI * 2 + R() * 0.5, r = c * 0.26 * (0.85 + R() * 0.45), sc = 0.75 + R() * 0.5, rot = rm ? 0 : sgn() * (2.1 + R() * 2.1), swy = sgn() * c * 0.26 * (0.15 + R() * 0.2);
		const dx = Math.cos(a) * r, dy = Math.sin(a) * r, fall = c * 0.26 * 1.6;
		void add(L.flakes, TX.bigFlake, at + i * 5 * kT, 480 * kT * Lk, (u, s) => { const b = fit(s, c * 0.26), o = 0.6 / Lk;
			const k1 = u < o ? easeOut(u / o) : 1, k2 = u < o ? 0 : easeIO((u - o) / (1 - o));
			s.position.set(cx + dx * (0.75 * k1 + 0.25 * k2) + swy * Math.sin(k2 * Math.PI), cy + dy * (0.75 * k1 + 0.25 * k2) + fall * k2);
			s.rotation = rot * u; s.scale.set(b * sc * (u < o ? lerp(0.3, 1, k1) : lerp(1, 0.7, k2))); s.alpha = u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45; }, true);
	}
	// small flakes: thrown further, twinkling as they drift (14; reduced motion 6)
	const nSm = rm ? 6 : 14;
	for (let i = 0; i < nSm; i++) {
		const a = (i / nSm) * Math.PI * 2 + 0.25 + R() * 0.4, z = (13 + R() * 5) / 100, r = c * z * (2.6 + R() * 1.1), rot = rm ? 0 : sgn() * (2.8 + R() * 2.8), swy = sgn() * c * z * (0.3 + R() * 0.25);
		const dx = Math.cos(a) * r, dy = Math.sin(a) * r - c * z * 0.4, fall = c * z * 1.9;
		void add(L.flakes, TX.flake, at + (20 + i * 5) * kT, 480 * kT * Lk, (u, s) => { const b = fit(s, c * z), o = Lk > 1 ? 0.12 : 0.3;
			const k1 = u < o ? easeOut(u / o) : 1, k2 = u < o ? 0 : (u - o) / (1 - o);
			s.position.set(cx + dx * (0.7 * k1 + 0.3 * k2) + swy * Math.sin(k2 * Math.PI * 1.5), cy + dy * (0.7 * k1 + 0.3 * k2) + fall * k2);
			s.rotation = rot * u; s.scale.set(b * (u < o ? lerp(0.3, 1, k1) : lerp(1, 0.6, k2)));
			s.alpha = u < o ? k1 : kf([[0, 1], [0.4, 0.55], [0.7, 1], [1, 0]], k2); }, true);
	}
	// powder dust: a faint misty bloom behind the flakes
	for (let i = 0; i < 3; i++) {
		const a = (i / 3) * Math.PI * 2 + R() * 0.6, w = c * (0.7 + R() * 0.2), dx = Math.cos(a) * w * 0.12, dy = Math.sin(a) * w * 0.12;
		void add(L.powder, TX.cloud, at + (i * 20 - 10) * kT, 480 * kT * Lk, (u, s) => { const b = fit(s, w);
			s.position.set(cx + dx * kf([[0, 0], [0.13, 0.6], [0.45, 0.85], [1, 1]], u), cy + dy * u + w * 0.18 * u);
			s.scale.set(b * kf([[0, 0.4], [0.13, 1], [0.45, 1.25], [1, 1.45]], u)); s.alpha = kf([[0, 0], [0.13, 0.42], [0.45, 0.34], [1, 0]], u); }, true);
	}
	// glitter: tiny sparkles twinkle round the burst (9; reduced motion 4) + 4 bigger glints
	const nG = rm ? 4 : 9;
	for (let i = 0; i < nG; i++) {
		const a = R() * Math.PI * 2, z = (8 + R() * 4) / 100, r = c * z * (0.9 + R() * 1.6), dx = Math.cos(a) * r, dy = Math.sin(a) * r;
		void add(L.glitter, TX.glint, at + (60 + R() * (Lk > 1 ? 900 : 220)) * kT, 220 * kT * (Lk > 1 ? 1.6 : 1), (u, s) => { const b = fit(s, c * z);
			s.position.set(cx + dx, cy + dy + c * z * 0.08 * u); s.scale.set(b * kf([[0, 0], [0.4, 1], [1, 0]], u)); s.rotation = rm ? 0 : u * 1.05; s.alpha = kf([[0, 0], [0.4, 1], [1, 0]], u); }, true);
	}
	for (let i = 0; i < 4; i++) {
		const a = (i / 4) * Math.PI * 2 + 0.8 + R() * 0.5, z = (20 + R() * 6) / 100, r = c * z * (1.5 + R() * 0.8), dx = Math.cos(a) * r, dy = Math.sin(a) * r;
		void add(L.glitter, TX.glint, at + (60 + i * 45) * kT, 320 * kT * (Lk > 1 ? 1.8 : 1), (u, s) => { const b = fit(s, c * z);
			s.position.set(cx + dx, cy + dy - c * z * 0.12 * u); s.scale.set(b * kf([[0, 0], [0.4, 1.1], [1, 0]], u)); s.rotation = rm ? 0 : u * 1.57; s.alpha = 1; }, true);
	}
	// the tile plays its border glint as the symbol bursts
	setTimeout(() => { cell.style.setProperty('--gd', '0ms'); cell.classList.remove('tGlint'); void cell.offsetWidth; cell.classList.add('tGlint'); }, Math.max(0, delay + 230 * kT));
	return Promise.all(gate).then(() => {});
}
/** The next puff (or a new board) is here: the still-drifting snow from the last one fades out over 200 ms. */
export function fadeLinger() { const t = now(); for (const p of ps) if (p.linger && p.out == null) p.out = t; }

/** Which cells a win puffs: its winning positions that are ordinary symbols (wilds, locked cells and full-reel /
 *  merged wilds stay on the board), and only on a win that leads into a respin that replaces them. */
export function puffTargets(wins: { positions: Pos[] }[], next: BookEvent | undefined) {
	const seen = new Set<number>(), out: Pos[] = [];
	if (!next || next.type !== 'respinStart') return { cells: out, refill: false };
	const repl = new Set(((next as { replace?: Pos[] }).replace || []).map((p) => k(p.reel, p.row)));
	for (const w of wins) for (const p of w.positions) {
		const key = k(p.reel, p.row);
		if (seen.has(key)) continue; seen.add(key);
		if (S.full.has(p.reel) || S.sym[p.reel]?.[p.row] === 'W') continue;
		if (!repl.has(key)) continue;
		out.push(p);
	}
	return { cells: out, refill: true };
}
/** The pop + puff runs WITH the line hit (winlines.ts playWins starts it as the lines draw on). `start` resolves when
 *  the swell + burst are done (or at once after a skip); `finish` (a skip) only releases the game flow, the Pixi pop
 *  and snow keep playing; `holes` = a respin refills them. */
export function puffWith(wins: { positions: Pos[] }[], next: BookEvent | undefined) {
	const { cells, refill } = puffTargets(wins, next);
	if (!cells.length) return null;
	// capture only (dev): window.__fxSlow = n plays the puff n x slower so a frame grab sees the swell
	const slow = import.meta.env.DEV ? Number((window as any).__fxSlow) || 1 : 1;
	const kT = (S.turbo ? 0.7 : 1) * slow, rm = reduced();
	cells.sort((a, b) => a.reel - b.reel || a.row - b.row);
	let release: () => void = () => {};
	const skipped = new Promise<void>((r) => { release = r; });
	const finish = () => release();
	const start = async () => {
		await ensureApp(); fadeLinger(); measureWin();
		const run = Promise.all(cells.map((p, i) => { const el = document.getElementById(`c${p.reel}${p.row}`);
			return el ? puffCell(el, S.sym[p.reel]?.[p.row] || '', i * 35 * kT, kT, rm) : Promise.resolve(); }));
		await Promise.race([run, skipped]);
	};
	return { start, finish, holes: refill };
}
