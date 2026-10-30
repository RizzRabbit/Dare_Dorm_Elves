// @ts-nocheck -- verbatim port of the approved mockup foyer (/workspace/elfhaus-mockup/main.js, "scene: symmetrical grand foyer
// (pass 4)"): plum wall + stone panel mouldings, glowing centre arch, painted split stair (ONE atlas sprite, mirrored), gallery,
// two gold sconces, lavender-grey marble floor in one-point perspective. Coordinates are the mockup's design space
// (landscape world 1920x1080, portrait width 1080); scene.ts maps that onto the game's DOM board rect.
import * as P from 'pixi.js';
import { ctex, softBlob as _sb, glowDot as _gd } from './util';
let ST: Record<string, P.Texture> = {};
let softBlob, glowDot, archTex;
const INK = 0x1a0b24;
const roomG = new P.Graphics(), wallL = new P.Container(), shadG = new P.Graphics(), backL = new P.Container(), floorL = new P.Container();
const amb = new P.Container();
const poolL = new P.Container();
// PERF: everything here is static except the sconce halo/core breathe and the two arch glow pools (updFoyer). Redrawing the
// big anti-aliased Graphics (wall panels, floor perspective, gallery), the arch's stencil mask and the large add-blend blobs
// every frame was the scene's dominant GPU cost. The static layers live OFF stage (statA / statC) and are rendered once per
// layout into two screen-sized render textures (bakeFoyer); the stage draws those two quads plus the few live glow sprites,
// in the same order as before (wall+arch+sconces | halos/cores + floor pool | stair shadow + gallery/stairs | arch glow).
const wallLive = new P.Container();
const statA = new P.Container(), statC = new P.Container();
statA.addChild(roomG, wallL); statC.addChild(shadG, backL);
const bakeA = new P.Sprite(P.Texture.EMPTY), bakeC = new P.Sprite(P.Texture.EMPTY);
let rtA: P.RenderTexture | null = null, rtC: P.RenderTexture | null = null;
const PAL = { wall: 0x2e1a40, wallHi: 0x3a2350, wallLo: 0x24132f, stone: 0xa597b8, stoneHi: 0xd2c6dd, stoneSh: 0x6f6286, gold: 0xe0ac3a, goldHi: 0xffe08a,
  marble: 0xb7adc6, marbleBack: 0x7b6f92, inlay: 0x4a2768, amber: 0xffb455, sconce: 0xffc46a };
const FOY = { land: { CX: 830, HZ: 160, FL: 720, stair: { y: 800, s: 0.96 }, sconce: [{ x: 66, y: 400 }, { x: 1854, y: 400 }], arch: { w: 470, top: 300 } } };
let anim = [], washes = [], sconces = [], archGlow = null;
function wallPanels(g, x0, x1, top, FL, CX, pw = 230, gap = 46, pTop = top + 130) {
  // straight-on back wall: stone dado + baseboard, tall upper panels and short lower panels in stone mouldings with a thin gold inner line
  const dado = FL - 150;
  g.rect(x0, top, x1 - x0, FL - top).fill(PAL.wall);
  g.rect(x0, top, x1 - x0, 90).fill({ color: PAL.wallLo, alpha: 0.6 });
  const n = Math.ceil((x1 - x0) / (pw + gap)) + 2, start = CX - (pw + gap) * Math.ceil(n / 2) + gap / 2;
  for (let i = 0; i < n + 1; i++) { const x = start + i * (pw + gap);
    const frame = (y0, y1) => { g.rect(x, y0, pw, y1 - y0).fill(PAL.wallHi).stroke({ width: 12, color: PAL.stone, alignment: 0.5 });
      g.rect(x - 6, y0 - 6, pw + 12, y1 - y0 + 12).stroke({ width: 2.5, color: INK }); g.rect(x + 6, y0 + 6, pw - 12, y1 - y0 - 12).stroke({ width: 2, color: INK, alpha: 0.8 });
      g.rect(x + 16, y0 + 16, pw - 32, y1 - y0 - 32).stroke({ width: 1.6, color: PAL.gold, alpha: 0.85 });
      g.moveTo(x - 4, y0 - 3).lineTo(x + pw + 4, y0 - 3).stroke({ width: 2, color: PAL.stoneHi, alpha: 0.8 }); };
    frame(pTop, dado - 46); frame(dado + 30, FL - 52); }
  const band = (y, h, c, hi) => { g.rect(x0, y, x1 - x0, h).fill(c); g.moveTo(x0, y + 2).lineTo(x1, y + 2).stroke({ width: 2, color: hi, alpha: 0.8 });
    g.moveTo(x0, y).lineTo(x1, y).stroke({ width: 3, color: INK }); g.moveTo(x0, y + h).lineTo(x1, y + h).stroke({ width: 3, color: INK }); };
  band(dado - 10, 22, PAL.stone, PAL.stoneHi); g.moveTo(x0, dado + 6).lineTo(x1, dado + 6).stroke({ width: 2, color: PAL.gold });   // dado rail + gold line
  band(FL - 34, 34, PAL.stoneSh, PAL.stone);                                                                                        // baseboard
}
function drawArch(g, CX, w, top, FL) {   // stone surround + warm opening (the board covers most of it; its light spills around the frame)
  const r = w / 2, s = 30;
  const shape = (gg, x0, x1, y0, y1, rr) => { gg.moveTo(x0, y1).lineTo(x0, y0 + rr).arc((x0 + x1) / 2, y0 + rr, rr, Math.PI, 0).lineTo(x1, y1).closePath(); };
  shape(g, CX - r - s, CX + r + s, top - s, FL, r + s); g.fill(PAL.stone).stroke({ width: 3, color: INK });
  shape(g, CX - r - s + 8, CX + r + s - 8, top - s + 8, FL, r + s - 8); g.stroke({ width: 2, color: PAL.stoneHi, alpha: 0.7 });
  const op = new P.Sprite(archTex); op.width = w; op.height = FL - top; op.position.set(CX - r, top);
  const m = new P.Graphics(); shape(m, CX - r, CX + r, top, FL, r); m.fill(0xffffff); op.mask = m; wallL.addChild(op, m);
  const ol = new P.Graphics(); shape(ol, CX - r, CX + r, top, FL, r); ol.stroke({ width: 3, color: INK }); wallL.addChild(ol);
}
function drawFloor(g, CX, HZ, FL, x0, x1, y1, goldLine = true) {
  // one-point perspective: y = HZ + K/z, x = CX + F*X/z. Back-wall base at z0 = 10 (y = FL); camera height 1.6 -> F = K/1.6.
  const K = (FL - HZ) * 10, F = K / 1.6, T = 1.25, D = 0.2;
  const P2 = (X, z) => [CX + F * X / z, HZ + K / z];
  g.rect(x0, FL, x1 - x0, y1 - FL).fill(PAL.marble);
  const bands = 14; for (let i = 0; i < bands; i++) { const ya = FL + (y1 - FL) * Math.pow(i / bands, 1.6), yb = FL + (y1 - FL) * Math.pow((i + 1) / bands, 1.6);
    g.rect(x0, ya, x1 - x0, yb - ya + 1).fill({ color: PAL.marbleBack, alpha: 0.75 * Math.pow(1 - i / bands, 2.2) }); }   // darker toward the wall
  const zMin = K / (y1 - HZ);
  for (let z = 10; z >= zMin - T; z -= T) for (let X = -12 * T; X <= 12 * T; X += T) {      // tile seams
    const [ax, ay] = P2(X, z), [bx, by] = P2(X + T, z), [cx2, cy2] = P2(X, z - T);
    if (z - T > 0) { g.moveTo(ax, ay).lineTo(bx, by); g.moveTo(ax, ay).lineTo(cx2, cy2); } }
  g.stroke({ width: 1.5, color: 0xffffff, alpha: 0.22 });
  for (let z = 10; z > zMin - T && z - D > 0.3; z -= T) for (let X = -12 * T; X <= 12 * T; X += T) {   // diamond inlays at the tile corners
    const p = [P2(X, z + D), P2(X + D, z), P2(X, z - D), P2(X - D, z)].map(([x, y]) => [x, Math.max(FL, y)]).flat();
    if (p[1] > y1 + 40 || !goldLine) continue; const gold = ((Math.round(X / T) + Math.round(z / T)) & 1) === 0 && Math.abs(X) < 0.1 && goldLine;
    g.poly(p).fill(gold ? PAL.gold : PAL.inlay).stroke({ width: 1.6, color: gold ? INK : PAL.gold, alpha: 0.9 }); }
  g.moveTo(x0, FL).lineTo(x1, FL).stroke({ width: 3, color: INK });
  g.rect(x0, FL, x1 - x0, 26).fill({ color: 0x140820, alpha: 0.35 });          // contact shade along the wall
}
function mark(x, y) { const m = new P.Container(); m.position.set(x, y); amb.addChild(m); return m; }
function addPool(c, x, y, r, a, sy = 1, L = poolL) { const sp = new P.Sprite(softBlob); sp.anchor.set(0.5); sp.tint = c; sp.blendMode = 'add'; sp.position.set(x, y); sp.scale.set(r, r * sy); sp.alpha = a; L.addChild(sp); return sp; }
function addSconce(x, y, s, flip) {
  const sp = new P.Sprite(ST.sconce); sp.anchor.set(0.5, 0.5); sp.position.set(x, y); sp.scale.set(s * (flip ? -1 : 1), s); wallL.addChild(sp);
  const gx = x + (flip ? 1 : -1) * 22 * s, gy = y - 46 * s;     // flame position in the sprite
  const halo = addPool(PAL.sconce, gx, gy, 2.2 * s, 0.32, 1, wallLive), core = new P.Sprite(glowDot); core.anchor.set(0.5); core.blendMode = 'add'; core.tint = 0xffe2a0;
  core.position.set(gx, gy); core.scale.set(1.6 * s); wallLive.addChild(core);
  sconces.push({ halo, core, ph: sconces.length * 1.7, s });
}
function addStairs(CX, st, L) {   // left half from the atlas (its right edge = the centre line); right half = the same texture mirrored
  const l = new P.Sprite(ST.stair_split); l.anchor.set(1, 1); l.position.set(CX, st.y); l.scale.set(st.s);
  const r = new P.Sprite(ST.stair_split); r.anchor.set(1, 1); r.position.set(CX, st.y); r.scale.set(-st.s, st.s);
  for (const s of [l, r]) L.addChild(s);   // drawn in the gallery's own stone colours (no tint), so flight and walkway match
  return [l, r];
}
// upper gallery: the walkway the two flights arrive at, running across the back wall and on along both sides (behind the flights).
// Its rows are taken from the stair sprite (landing top row 118, landing face rows 142-190, newel cap row ~12) and its stone is
// sampled from the sprite, so where a landing meets the walkway there is no seam: the landing simply becomes the gallery floor.
const GAL = { top: 0xc6aab8, topHi: 0xd9c6d3, face: 0x9f8395, faceHi: 0xb59cad, shade: 0x6d5566, soffit: 0x3f2b48, bal: 0xd4c0cd, balHi: 0xefe3ec, balSh: 0x8d7690 };
const GINK = 0x26102f;   // painted pass: plum ink (matches the painted stair sprite)
function drawGallery(g, x0, x1, st, CX) {
  const s = st.s, Y = (r) => st.y - (768 - r) * s;
  const yT = Y(118), yF = Y(142), yB = Y(190), yS = yB + 34 * s, yR = Y(34);
  gallerySlab(g, x0, x1, st);
  g.rect(x0, yS, x1 - x0, 34 * s).fill({ color: 0x08030c, alpha: 0.22 });
  // balustrade on the walkway's FRONT edge (like the stair's): plain balusters every 44 px (same rhythm as the flights),
  // square stone posts with gold caps, one gold handrail
  const step = 44 * s, n = Math.ceil((x1 - x0) / step);
  for (let i = 0; i <= n; i++) { const x = CX + Math.round((x0 - CX) / step + i) * step; if (x < x0 || x > x1) continue;
    const ad = Math.abs(x - CX) / s; if (ad > 745 && ad < 900) continue;   // behind a flight's own balustrade: leave it out (no double railing)
    g.rect(x - 4.2 * s, yR + 4 * s, 8.4 * s, yF - 7 * s - yR - 4 * s).fill(GAL.bal);
    g.rect(x + 1 * s, yR + 4 * s, 3.2 * s, yF - 7 * s - yR - 4 * s).fill({ color: GAL.balHi, alpha: 0.7 });
    g.rect(x - 4.2 * s, yR + 4 * s, 2.6 * s, yF - 7 * s - yR - 4 * s).fill({ color: GAL.balSh, alpha: 0.7 });
    g.rect(x - 4.2 * s, yR + 4 * s, 8.4 * s, yF - 7 * s - yR - 4 * s).stroke({ width: 1.1, color: GINK, alpha: 0.75 });
    g.rect(x - 6.2 * s, yF - 7 * s, 12.4 * s, 7 * s).fill(GAL.bal).stroke({ width: 1.1, color: GINK, alpha: 0.75 }); }
  for (let k = -12; k <= 12; k++) { const x = CX + k * 8 * step + 4 * step; if (x < x0 || x > x1 || Math.abs(x - CX) < 6 * step) continue;
    { const ad = Math.abs(x - CX) / s; if (ad > 725 && ad < 920) continue; }
    g.rect(x - 16 * s, yR + 8 * s, 32 * s, yF - yR - 8 * s).fill(GAL.faceHi).stroke({ width: 1.8, color: GINK, alpha: 0.9 });
    g.rect(x + 6 * s, yR + 8 * s, 10 * s, yF - yR - 8 * s).fill({ color: GAL.face, alpha: 0.8 });
    g.rect(x - 21 * s, yR - 3 * s, 42 * s, 13 * s).fill(PAL.gold).stroke({ width: 1.8, color: GINK, alpha: 0.9 }); }
  g.roundRect(x0, yR - 5.5 * s, x1 - x0, 11 * s, 5 * s).fill(PAL.gold).stroke({ width: 2, color: GINK });
  g.moveTo(x0, yR - 2.5 * s).lineTo(x1, yR - 2.5 * s).stroke({ width: 2, color: PAL.goldHi, alpha: 0.9 });
  g.moveTo(x0, yR + 2.5 * s).lineTo(x1, yR + 2.5 * s).stroke({ width: 2, color: 0x9c6a1c, alpha: 0.6 });
  return { yT, yB, yS, yR };
}
// walkway: floor (soft gradient: darker at the wall), front face, then the underside (soffit) seen from below; the stair sprite's
// side landing ends in exactly these rows/colours, so where a landing meets the walkway there is no seam.
function gallerySlab(g, x0, x1, st) {
  const s = st.s, Y = (r) => st.y - (768 - r) * s, yT = Y(118), yF = Y(142), yB = Y(190), yS = yB + 34 * s;
  g.rect(x0, yT, x1 - x0, yF - yT).fill(GAL.top);
  g.rect(x0, yF - (yF - yT) * 0.45, x1 - x0, (yF - yT) * 0.45).fill({ color: GAL.topHi, alpha: 0.6 });
  g.rect(x0, yT, x1 - x0, 4 * s).fill({ color: 0x140818, alpha: 0.18 });
  g.rect(x0, yF, x1 - x0, yB - yF).fill(GAL.face);
  g.rect(x0, yF, x1 - x0, (yB - yF) * 0.4).fill({ color: GAL.faceHi, alpha: 0.6 });
  g.moveTo(x0, yB - 9 * s).lineTo(x1, yB - 9 * s).stroke({ width: 1.5, color: PAL.gold, alpha: 0.9 });       // thin gold trim on the face
  g.rect(x0, yB, x1 - x0, yS - yB).fill(GAL.soffit);
  g.rect(x0, yB, x1 - x0, 6 * s).fill({ color: 0x000000, alpha: 0.25 });
  g.moveTo(x0, yT).lineTo(x1, yT).stroke({ width: 1.4, color: GINK, alpha: 0.6 });
  for (const y of [yF, yB, yS]) g.moveTo(x0, y).lineTo(x1, y).stroke({ width: y === yS ? 2.4 : 1.8, color: GINK, alpha: 0.9 });
}
export const foyerRoot = new P.Container();
foyerRoot.addChild(bakeA, wallLive, floorL, poolL, bakeC, amb);
export function initFoyer(tex: Record<string, P.Texture>) {
	ST = tex; softBlob = _sb(); glowDot = _gd();
	archTex = ctex(128, 256, (g) => { let gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#5a2f52'); gr.addColorStop(0.45, '#c9813f'); gr.addColorStop(0.8, '#ffd27a'); gr.addColorStop(1, '#ffe7b0');
		g.fillStyle = gr; g.fillRect(0, 0, 128, 256); gr = g.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, 'rgba(40,14,40,0.55)'); gr.addColorStop(0.3, 'rgba(40,14,40,0)');
		gr.addColorStop(0.7, 'rgba(40,14,40,0)'); gr.addColorStop(1, 'rgba(40,14,40,0.55)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 256); });
}
function clearFoyer() {
	for (const c of [wallL, wallLive, backL, floorL, amb, poolL]) c.removeChildren().forEach((o) => o.destroy());
	shadG.clear(); roomG.clear(); anim = []; washes = []; sconces = []; archGlow = null;
}
/** landscape room (mockup buildLand, desktop mode). Returns the sconce + arch points (mockup space) for Roxy's light rig. */
export function buildFoyerLand(scShift = 0) {   // scShift: phone landscape slides the left sconce off-screen (mockup compact: -200)
	clearFoyer();
	const D = FOY.land, { CX, HZ, FL } = D, X0 = -1600, X1 = 3600;
	const gy = D.stair.y - (768 - 190) * D.stair.s + 34 * D.stair.s;
	wallPanels(roomG, X0, X1, -1400, FL, CX, 230, 46, gy + 46);
	drawArch(roomG, CX, D.arch.w, D.arch.top, FL);
	drawFloor(roomG, CX, HZ, FL, X0, X1, 2600);
	archGlow = [addPool(PAL.amber, CX, FL - 260, 4.4, 0.20, 1.1, amb), addPool(0xffd27a, CX, FL + 70, 3.6, 0.30, 0.22)];
	addStairs(CX, D.stair, backL);
	const gal = new P.Graphics(); drawGallery(gal, X0, X1, D.stair, CX); backL.addChildAt(gal, 0);
	const lb = new P.Sprite(softBlob); lb.anchor.set(0.5); lb.tint = 0x0a0410; lb.position.set(CX, 150); lb.scale.set(3.4, 1.25); lb.alpha = 0.75; backL.addChild(lb);
	const scL = D.sconce[0].x + scShift;
	addSconce(scL, D.sconce[0].y, 0.54, false); addSconce(D.sconce[1].x, D.sconce[1].y, 0.54, true);
	shadG.ellipse(CX, D.stair.y - 6, 400 * D.stair.s, 24).fill({ color: INK, alpha: 0.32 });
	return { keys: [mark(scL, D.sconce[0].y), mark(D.sconce[1].x, D.sconce[1].y)], cool: mark(CX, FL - 300) };
}
/** portrait room (mockup buildPort): T = board frame top in the 1080-wide design space */
export function buildFoyerPort(T: number, DH: number) {
	clearFoyer();
	const CX = 540, FL = T + 60, s = 0.7, st = { y: T + 30, s };
	const gS = st.y - (768 - 190) * s + 34 * s;
	wallPanels(roomG, -1400, 2500, -1600, FL, CX, 210, 40, gS + 40);
	drawFloor(roomG, CX, FL - 320, FL, -1400, 2500, DH + 1600, false);
	drawArch(roomG, CX, 420, gS + 60, FL);
	archGlow = [addPool(PAL.amber, CX, T - 260, 4.0, 0.22, 1.2, amb)];
	addStairs(CX, st, backL);
	const gal = new P.Graphics(), G = drawGallery(gal, -1400, 2500, st, CX); backL.addChildAt(gal, 0);
	const pb = G.yR - 40, pt = Math.max(-200, pb - 520);
	for (let i = -3; i <= 3; i++) { const pw = 210, x = CX - pw / 2 + i * (pw + 40);
		roomG.rect(x, pt, pw, pb - pt).fill(PAL.wallHi).stroke({ width: 12, color: PAL.stone, alignment: 0.5 });
		roomG.rect(x - 6, pt - 6, pw + 12, pb - pt + 12).stroke({ width: 2.5, color: INK }); roomG.rect(x + 6, pt + 6, pw - 12, pb - pt - 12).stroke({ width: 2, color: INK, alpha: 0.8 });
		roomG.rect(x + 16, pt + 16, pw - 32, pb - pt - 32).stroke({ width: 1.6, color: PAL.gold, alpha: 0.85 }); }
	const sy = G.yR - 170; addSconce(170, sy, 0.66, false); addSconce(910, sy, 0.66, true);
	return { keys: [mark(170, sy), mark(910, sy)], cool: mark(CX, T - 300) };
}
/** Render the static room layers once into screen-sized textures. `room` = foyerRoot's parent (scale + position only, on
 *  the stage root); W x H = renderer size in stage px, res = renderer resolution. Call after every buildFoyer*. */
export function bakeFoyer(renderer: P.Renderer, room: P.Container, W: number, H: number, res: number) {
	const rt = (t: P.RenderTexture | null) => {
		if (t && t.width === W && t.height === H && t.source.resolution === res) return t;
		t?.destroy(true); return P.RenderTexture.create({ width: W, height: H, resolution: res, antialias: true });
	};
	rtA = rt(rtA); rtC = rt(rtC);
	const sx = room.scale.x, sy = room.scale.y, m = new P.Matrix(sx, 0, 0, sy, room.position.x, room.position.y);
	renderer.render({ container: statA, target: rtA, clear: true, clearColor: [0, 0, 0, 0], transform: m });
	renderer.render({ container: statC, target: rtC, clear: true, clearColor: [0, 0, 0, 0], transform: m });
	for (const [b, t] of [[bakeA, rtA], [bakeC, rtC]] as const) {   // screen-space quads inside the room's transform
		b.texture = t; b.position.set(-room.position.x / sx, -room.position.y / sy); b.scale.set(1 / sx, 1 / sy); }
}
/** ambient: candle breathe + arch glow breathe (mockup updScene minus motes; motes live in scene.ts) */
export function updFoyer(now: number) {
	for (const s of sconces) { const t = (now * Math.PI * 2) / 3.6 + s.ph, f = 0.5 + 0.5 * Math.sin(t) * 0.7 + 0.15 * Math.sin(t * 2.7 + 1);
		s.halo.alpha = 0.26 + 0.1 * f; s.core.alpha = 0.7 + 0.25 * f; s.core.scale.set((1.5 + 0.12 * f) * s.s); }
	if (archGlow) { const k = 0.5 + 0.5 * Math.sin((now * Math.PI * 2) / 6.5); archGlow[0].alpha = 0.17 + 0.06 * k; if (archGlow[1]) archGlow[1].alpha = 0.26 + 0.06 * k; }
}
