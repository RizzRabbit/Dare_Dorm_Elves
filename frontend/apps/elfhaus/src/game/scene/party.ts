// @ts-nocheck -- same style as foyer.ts (room design space, Pixi Graphics)
// FREE SPINS background = the SAME foyer in the same flat cel-shaded vector style, re-lit as a night party (audit M11: the old
// painted party room clashed with the foyer). Everything is code-drawn, nothing new to download:
//   statP (baked ONCE per layout into foyer.ts rtP, on top of the room's own static layers):
//     night grade (one flat multiply over the room) + magenta / purple side washes + a darker calm pool behind the board,
//     the arch opening re-lit pink, warm string lights swagged along the balcony rail (ink wire + flat bulbs),
//   partyLive (the only per-frame work): the bulbs' soft twinkle (one batched add-blend sprite set), the two sconce halos,
//     one pink arch pool breathing, and a handful of slow flat confetti specks at the edges (faded out near the board).
// Ambient motion is calm (multi-second periods); nothing here touches game logic. Cosmetic randomness is fixed per index.
import * as P from 'pixi.js';
const INK = 0x1a0b24;
export const statP = new P.Container();
export const partyLive = new P.Container();
type R = { x0: number; y0: number; x1: number; y1: number };
type Lay = { CX: number; FL: number; archW: number; archTop: number; yR: number; s: number; step: number };
let bulbs: { sp: P.Sprite; ph: number; a: number }[] = [], halos: { sp: P.Sprite; ph: number; s: number }[] = [], archPool: P.Sprite | null = null;
let conf: { sp: P.Sprite; x: number; y: number; vy: number; vx: number; ph: number; w: number; r: number }[] = [];
let VIS: R = { x0: 0, y0: 0, x1: 1, y1: 1 }, BRD: R = { x0: 0, y0: 0, x1: 0, y1: 0 }, U = 1;
const BULB = [0xffd27a, 0xffe7b0, 0xffb455, 0xffc0d8];
/** Build the party layer for this layout. lay = foyer LAY, sc = sconce flame points, vis / brd = the screen and the board
 *  frame in room design px, u = screen px per design px, port = phone portrait. */
export function buildParty(lay: Lay, sc: { x: number; y: number; s: number }[], archShape, vis: R, brd: R, u: number, port: boolean, blob: P.Texture, dot: P.Texture) {
	for (const c of [statP, partyLive]) c.removeChildren().forEach((o) => o.destroy());
	bulbs = []; halos = []; conf = []; archPool = null; VIS = vis; BRD = brd; U = u;
	const { CX, FL, archW, archTop, yR, s, step } = lay, X0 = vis.x0 - 400, X1 = vis.x1 + 400, Y0 = vis.y0 - 400, Y1 = vis.y1 + 400;
	const add = (o) => { statP.addChild(o); return o; };
	const pool = (L, c, x, y, sx, sy, a, mode = 'add') => { const sp = new P.Sprite(blob); sp.anchor.set(0.5); sp.tint = c; sp.blendMode = mode; sp.position.set(x, y); sp.scale.set(sx, sy); sp.alpha = a; L.addChild(sp); return sp; };
	// 1) night grade: one flat multiply over the whole room (stone -> dusky lilac, plum wall -> deep night plum)
	const night = add(new P.Graphics()); night.rect(X0, Y0, X1 - X0, Y1 - Y0).fill(0x6c4f98); night.blendMode = 'multiply';
	// 2) arch opening re-lit pink (flat 2-band gradient, the opening's own shape)
	const aw = archW, ah = FL - archTop;
	const ag = add(new P.Graphics()); archShape(ag, CX, aw, archTop, FL); ag.fill({ color: 0x6a2a6e, alpha: 0.9 });
	const ag2 = add(new P.Graphics()); archShape(ag2, CX, aw * 0.8, archTop + ah * 0.28, FL); ag2.fill({ color: 0xb8407f, alpha: 0.75 });
	const ag3 = add(new P.Graphics()); archShape(ag3, CX, aw * 0.56, archTop + ah * 0.52, FL); ag3.fill({ color: 0xf07ab0, alpha: 0.6 });
	// 3) magenta / purple side washes (edges only) + a calmer, darker pool behind the board
	const wv = vis.x1 - vis.x0, hv = vis.y1 - vis.y0, bw = brd.x1 - brd.x0, bh = brd.y1 - brd.y0, bcx = (brd.x0 + brd.x1) / 2, bcy = (brd.y0 + brd.y1) / 2;
	if (!port) {
		pool(statP, 0xc0308f, vis.x0 + wv * 0.02, vis.y0 + hv * 0.45, wv / 380, hv / 230, 0.8);
		pool(statP, 0xc0308f, vis.x1 - wv * 0.02, vis.y0 + hv * 0.45, wv / 380, hv / 230, 0.8);
		pool(statP, 0x5b2fa0, vis.x0 + wv * 0.1, vis.y1, wv / 300, hv / 500, 0.5);
		pool(statP, 0x5b2fa0, vis.x1 - wv * 0.1, vis.y1, wv / 300, hv / 500, 0.5);
	} else {
		pool(statP, 0xc0308f, vis.x0, brd.y0 - hv * 0.1, wv / 180, hv / 420, 0.5);
		pool(statP, 0xc0308f, vis.x1, brd.y0 - hv * 0.1, wv / 180, hv / 420, 0.5);
		pool(statP, 0x5b2fa0, bcx, vis.y1, wv / 150, hv / 600, 0.45);
	}
	pool(statP, 0x07020c, bcx, bcy, bw / 120, bh / 125, 0.7, 'normal');
	// 4) string lights: ink wire swagged between the balcony's stone posts (every 8 balusters), flat bulbs on short drops
	const g = add(new P.Graphics()), span = 8 * step, sag = 34 * s, br = 5.2 * s, BPS = 7;
	const k0 = Math.floor((vis.x0 - CX) / span) - 1, k1 = Math.ceil((vis.x1 - CX) / span) + 1, wy = yR + 6 * s, bulbPts = [];
	for (let k = k0; k < k1; k++) { const xa = CX + k * span + 4 * step, xb = xa + span;
		const yAt = (t) => wy + sag * 4 * t * (1 - t);
		g.moveTo(xa, wy); for (let i = 1; i <= 16; i++) { const t = i / 16; g.lineTo(xa + span * t, yAt(t)); }
		for (let i = 0; i < BPS; i++) { const t = (i + 0.5) / BPS; bulbPts.push([xa + span * t, yAt(t), (k * BPS + i) & 3]); } }
	g.stroke({ width: 2 * s, color: INK, alpha: 0.95 });
	for (const [x, y, c] of bulbPts) {
		g.moveTo(x, y).lineTo(x, y + 4 * s).stroke({ width: 1.4 * s, color: INK });
		g.rect(x - 2.6 * s, y + 3 * s, 5.2 * s, 4 * s).fill(0x9c6a1c).stroke({ width: 1.2 * s, color: INK });
		g.ellipse(x, y + 7 * s + br * 1.15, br, br * 1.3).fill(BULB[c]).stroke({ width: 1.4 * s, color: INK });
		g.ellipse(x - br * 0.35, y + 7 * s + br * 0.8, br * 0.25, br * 0.4).fill({ color: 0xffffff, alpha: 0.8 }); }
	// live: bulb glows (twinkle in 4 phase groups, slow), sconce halos, arch pool, confetti
	for (const [x, y, c] of bulbPts) { if (x < vis.x0 - 20 || x > vis.x1 + 20) continue;
		const sp = new P.Sprite(dot); sp.anchor.set(0.5); sp.blendMode = 'add'; sp.tint = BULB[c]; sp.position.set(x, y + 7 * s + br * 1.15); sp.scale.set(0.85 * s); partyLive.addChild(sp);
		const near = Math.abs(x - bcx) < bw * 0.5 ? 0.6 : 1; bulbs.push({ sp, ph: c * 1.7 + x * 0.003, a: near }); }
	for (const p of sc) { const h = pool(partyLive, 0xffb455, p.x, p.y, 2.0 * p.s, 2.0 * p.s, 0.3); halos.push({ sp: h, ph: halos.length * 1.7, s: p.s });
		const co = new P.Sprite(dot); co.anchor.set(0.5); co.blendMode = 'add'; co.tint = 0xffe2a0; co.position.set(p.x, p.y); co.scale.set(1.5 * p.s); co.alpha = 0.8; partyLive.addChild(co); }
	archPool = pool(partyLive, 0xff4fa8, CX, port ? archTop + ah * 0.4 : FL - ah * 0.45, aw / 95, ah / 110, 0.2);
	const n = port ? 12 : 20, CC = [0xff4fc3, 0xffc83d, 0xb9a6e0, 0xff9ad0, 0x8f5fe0];
	for (let i = 0; i < n; i++) { const sp = new P.Sprite(P.Texture.WHITE); sp.anchor.set(0.5); sp.tint = CC[i % CC.length]; partyLive.addChild(sp);
		const f = (i * 0.618) % 1, x = f < 0.5 ? vis.x0 + (brd.x0 - vis.x0) * (f * 2) : brd.x1 + (vis.x1 - brd.x1) * ((f - 0.5) * 2);
		conf.push({ sp, x: port ? vis.x0 + wv * f : x, y: vis.y0 + hv * ((i * 0.377) % 1), vy: (14 + 10 * ((i * 0.29) % 1)) / Math.max(0.5, u), vx: 6 * (((i * 0.53) % 1) - 0.5),
			ph: i * 1.3, w: (port ? 7 : 6) / Math.max(0.6, u), r: (i * 0.71) % 6.28 }); }
}
const sm = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
/** per frame while the party layer is visible: calm twinkle / breathe / slow fall */
export function updParty(now: number, dt: number) {
	for (const b of bulbs) { const t = 0.5 + 0.5 * Math.sin((now * Math.PI * 2) / 3.2 + b.ph); b.sp.alpha = b.a * (0.45 + 0.4 * t); }
	for (const h of halos) { const t = (now * Math.PI * 2) / 3.6 + h.ph, f = 0.5 + 0.5 * Math.sin(t) * 0.7 + 0.15 * Math.sin(t * 2.7 + 1); h.sp.alpha = 0.24 + 0.1 * f; }
	if (archPool) archPool.alpha = 0.16 + 0.07 * (0.5 + 0.5 * Math.sin((now * Math.PI * 2) / 6.5));
	const pad = 40 / Math.max(0.5, U);
	for (const c of conf) { c.y += c.vy * dt; c.x += (c.vx + Math.sin(now * 0.7 + c.ph) * 5) * dt;
		if (c.y > VIS.y1 + 20) { c.y = VIS.y0 - 20; }
		const flip = Math.cos(now * 1.6 + c.ph);
		c.sp.position.set(c.x, c.y); c.sp.rotation = c.r + now * 0.5; c.sp.width = c.w; c.sp.height = c.w * 1.5 * Math.max(0.15, Math.abs(flip));
		// calm centre: fade out as a speck nears the board
		const dx = Math.max(BRD.x0 - c.x, c.x - BRD.x1, 0), dy = Math.max(BRD.y0 - c.y, c.y - BRD.y1, 0), d = Math.max(dx, dy);
		c.sp.alpha = 0.85 * sm(0, pad * 2, d); }
}
