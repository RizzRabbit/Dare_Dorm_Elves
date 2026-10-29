// @ts-nocheck  (geometry below is the approved mockup verbatim: /workspace/elfhaus-intro/intro.js, pass 2)
// Elfhaus intro (approved PixiJS mockup, ported): replaces the old DOM splash / loader art.
// Guest POV in the grand-foyer vestibule (plum wall, stone mouldings, thin gold trim, marble + inlays), closed double doors,
// the approved stone ELFHAUS title (splash_title.webp, unchanged), black/gold info cards (4 Bonus Modes, Sticky Wilds,
// Elves Gone Wild), a dark-gold loading bar, then TAP TO PARTY.
// Tap: cards slide away -> doors open (~0.9 s, Roxy holding the left leaf, wink) -> camera push through the doorway ->
// board + Roxy drop in together (Roxy surprised) -> logo + HUD follow -> idle. ~3.25 s; a second tap (or Enter / Space) skips.
// Own transparent canvas (#introCv) inside #root just under #loader (which stays as the transparent tap / keyboard /
// "Don't show this again" layer, so the loader hooks are unchanged). The game is driven with CSS individual transforms
// (scale / translate / opacity, never the stage `transform`) and Roxy through the rig adapter. No WebGL -> initIntro()
// resolves false and the old DOM splash shows instead.
import { Application, Container, Graphics, PerspectiveMesh, Sprite, Text, Texture } from 'pixi.js';
import { ST, fitStage } from './stage';
import { ctex, ease, clamp, seg, lerp, softBlob, glowDot } from './scene/util';
import { loadSheet, loadTex } from './scene/load';
import { rig, roxyAt, sceneHold } from './scene/scene';
import TITLE from '../assets/intro/splash_title.webp?url';

const FONT = "Montserrat, Nunito, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const PAL = { wall: 0x2e1a40, wallHi: 0x3a2350, wallLo: 0x24132f, stone: 0xa597b8, stoneHi: 0xd2c6dd, stoneSh: 0x6f6286, gold: 0xe0ac3a,
  marble: 0xb7adc6, marbleBack: 0x7b6f92, inlay: 0x4a2768, sconce: 0xffc46a, ink: 0x1a0b24 };
const GOLD = 0xffc83d;
// timeline (seconds after the tap), pass 2 (James: "I think it's great")
export const T = { cards: [0.0, 0.42], doorL: [0.40, 1.30], doorR: [0.50, 1.40], wink: [0.75, 1.45], push: [1.55, 2.13], roxyOut: [1.55, 1.73], over: [1.95, 2.13],
  cam: [1.55, 2.17], drop: [1.99, 2.37], logo: [2.15, 2.45], hud: [2.17, 2.47], btn: [2.23, 2.55], face: [3.01, 3.13], end: 3.25 };
// the build's own feature cards (same titles + lines as the old splash), restyled black / gold
const CARDS = [
  { key: 'modes', art: 'assets/intro/card_modes_S.webp', title: '4 Bonus Modes', line: 'Dare, Double, Triple or a Mystery Spin.' },
  { key: 'sticky', art: 'assets/intro/card_sticky_W_R2_card.webp', title: 'Sticky Wilds', line: 'Wilds lock in place and grow every respin.' },
  { key: 'egw', art: 'assets/intro/card_egw_WM2_R1-2.webp', title: 'Elves Gone Wild', line: 'Full wild reels side by side multiply.' },
];
let app = null, state = 'off', t = 0, tt = 0, prog = 0, G = null, primed = false, roxyFree = false, faceOff = false, progFn = () => 0;
let doneRes = () => {}, tapRes = () => {}, killed = false;
const root = new Container(), ov = new Container();
const tex = {};
// Roxy through the adapter; her door points come back in the scene canvas, mapped through the camera into intro space
const RXA = {
  get ok() { return !!rig; },
  doorPts() { if (!rig) return null; const q = rig.doorPts(); if (!q) return null; return { sh: camPt(q.sh), hand: camPt(q.hand), r: q.r }; },
};

function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function holdL() {   // the left leaf stops where Roxy's door hand holds it: the lever never swings past her arm's reach
  const q0 = state === 'trans' && tt < T.roxyOut[0] ? RXA.doorPts() : null; if (!q0) return 1;
  const q = q0, reach = Math.hypot(q.hand.x - q.sh.x, q.hand.y - q.sh.y) + 1.5;
  const dist = (a) => { const h = handleL(a); return Math.hypot(h.x - q.sh.x, h.y - q.sh.y); };
  if (dist(1) <= reach) return 1;
  let am = 0, dm = 1e9; for (let i = 0; i <= 40; i++) { const d = dist(i / 40); if (d < dm) { dm = d; am = i / 40; } }   // closest swing to her shoulder
  if (dm > reach) return am;
  let lo = am, hi = 1; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (dist(m) > reach) hi = m; else lo = m; }
  return lo;
}
const HANDLE_Y = 0.455;   // lever height (fraction of the leaf): Roxy's door hand meets it with the leaf open
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

// door leaf (outside face): deep plum paint, stone moulded panels with a thin gold line, gold lever at the free edge
function leafTex(w, h, hingeLeft) { return ctex(w, h, (g) => {
  let gr = g.createLinearGradient(0, 0, w, 0); const a = hingeLeft ? 0 : 1;
  gr.addColorStop(a, '#2b1638'); gr.addColorStop(0.5, '#3a2150'); gr.addColorStop(1 - a, '#331b46');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,240,255,0.06)'); gr.addColorStop(0.6, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.28)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const m = w * 0.14, panel = (y0, y1) => { const x = m, pw = w - 2 * m;
    g.fillStyle = '#2a1537'; g.fillRect(x, y0, pw, y1 - y0);
    g.lineWidth = 7; g.strokeStyle = hex(PAL.stone); g.strokeRect(x, y0, pw, y1 - y0);
    g.lineWidth = 2; g.strokeStyle = hex(PAL.ink); g.strokeRect(x - 4, y0 - 4, pw + 8, y1 - y0 + 8); g.strokeRect(x + 4, y0 + 4, pw - 8, y1 - y0 - 8);
    g.lineWidth = 1.4; g.strokeStyle = 'rgba(224,172,58,0.9)'; g.strokeRect(x + 12, y0 + 12, pw - 24, y1 - y0 - 24);
    g.beginPath(); g.moveTo(x - 3, y0 - 2); g.lineTo(x + pw + 3, y0 - 2); g.lineWidth = 1.6; g.strokeStyle = 'rgba(210,198,221,0.8)'; g.stroke(); };
  panel(h * 0.07, h * (HANDLE_Y - 0.04)); panel(h * (HANDLE_Y + 0.035), h * 0.93);   // lever on the rail between the panels, at her hand height
  g.lineWidth = 3; g.strokeStyle = hex(PAL.ink); g.strokeRect(1.5, 1.5, w - 3, h - 3);
  // gold lever handle + rose near the free (meeting) edge
  const hx = hingeLeft ? w - w * 0.075 : w * 0.075, hy = h * HANDLE_Y, dir = hingeLeft ? -1 : 1;
  g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 6; g.shadowOffsetY = 3;
  gr = g.createLinearGradient(0, hy - 8, 0, hy + 8); gr.addColorStop(0, '#ffe08a'); gr.addColorStop(0.5, '#e0ac3a'); gr.addColorStop(1, '#7a5418');
  g.fillStyle = gr; g.beginPath(); g.arc(hx, hy, 8, 0, Math.PI * 2); g.fill();
  rr(g, Math.min(hx, hx + dir * 34), hy - 4, 34, 8, 4); g.fill(); g.restore();
  g.lineWidth = 1.5; g.strokeStyle = hex(PAL.ink); g.beginPath(); g.arc(hx, hy, 8, 0, Math.PI * 2); g.stroke();
}); }
// warm floor spill through the opened doors (trapezoid fading toward the viewer)
const spillTex = () => ctex(256, 256, (g) => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,214,140,0.9)'); gr.addColorStop(1, 'rgba(255,190,110,0)');
  g.filter = 'blur(16px)'; g.fillStyle = gr; g.beginPath(); g.moveTo(84, -20); g.lineTo(172, -20); g.lineTo(226, 236); g.lineTo(30, 236); g.closePath(); g.fill(); });   // soft-edged light pool

// ---------------- geometry ----------------
function geo(W, H) {
  const port = W / H < 0.9;
  const k = port ? Math.min(W / 1080, H / 1720) : Math.min(W / 1920, H / 1080), DW = W / k, DH = H / k, cx = DW / 2;
  if (!port) { const FL = DH / 2 + 400, dw = 520, dh = 580, top = FL - dh;
    return { port, k, DW, DH, cx, FL, dw, dh, top, lint: 64, logo: { y: top - 64 - 122, w: 560 }, bar: { y: FL + 64, w: 560, h: 40 }, btn: { y: FL + 64, w: 470, h: 100 }, sc: { dx: 400, y: top + 150, s: 0.6 }, F: 1500 }; }
  const FL = DH * 0.69, dw = 540, dh = 780, top = FL - dh;
  return { port, k, DW, DH, cx, FL, dw, dh, top, lint: 64, logo: { y: top - 64 - 210, w: 800 }, bar: { y: FL + 170, w: 640, h: 46 }, btn: { y: FL + 170, w: 620, h: 132 }, sc: { dx: 400, y: top + 210, s: 0.72 }, F: 1700 };
}

// ---------------- build ----------------
let cardsC, cardEls = [], wallC, leafL, leafR, glowL, spill, holeG, sconces = [], logoS, logoBack, barC, barFill, barGlow, btnC, btnGlow, doorLight;
function drawFloor(g, CX, HZ, FL, x0, x1, y1) {   // same one-point marble as the foyer (tile seams + purple/gold diamond inlays)
  const K = (FL - HZ) * 10, F = K / 1.6, Tt = 1.25, D = 0.2, P2 = (X, z) => [CX + F * X / z, HZ + K / z];
  g.rect(x0, FL, x1 - x0, y1 - FL).fill(PAL.marble);
  const bands = 14; for (let i = 0; i < bands; i++) { const ya = FL + (y1 - FL) * Math.pow(i / bands, 1.6), yb = FL + (y1 - FL) * Math.pow((i + 1) / bands, 1.6);
    g.rect(x0, ya, x1 - x0, yb - ya + 1).fill({ color: PAL.marbleBack, alpha: 0.75 * Math.pow(1 - i / bands, 2.2) }); }
  const zMin = K / (y1 - HZ);
  for (let z = 10; z >= zMin - Tt; z -= Tt) for (let X = -12 * Tt; X <= 12 * Tt; X += Tt) {
    const [ax, ay] = P2(X, z), [bx, by] = P2(X + Tt, z), [c2, d2] = P2(X, z - Tt); if (z - Tt > 0) { g.moveTo(ax, ay).lineTo(bx, by); g.moveTo(ax, ay).lineTo(c2, d2); } }
  g.stroke({ width: 1.5, color: 0xffffff, alpha: 0.22 });
  for (let z = 10; z > zMin - Tt && z - D > 0.3; z -= Tt) for (let X = -12 * Tt; X <= 12 * Tt; X += Tt) {
    const p = [P2(X, z + D), P2(X + D, z), P2(X, z - D), P2(X - D, z)].map(([x, y]) => [x, Math.max(FL, y)]).flat(); if (p[1] > y1 + 40) continue;
    const gold = Math.abs(X) < 0.1 && ((Math.round(z / Tt)) & 1) === 0;
    g.poly(p).fill(gold ? PAL.gold : PAL.inlay).stroke({ width: 1.6, color: gold ? PAL.ink : PAL.gold, alpha: 0.9 }); }
  g.moveTo(x0, FL).lineTo(x1, FL).stroke({ width: 3, color: PAL.ink }); g.rect(x0, FL, x1 - x0, 26).fill({ color: 0x140820, alpha: 0.35 });
}
function build() {
  root.removeChildren().forEach(o => o.destroy({ children: true })); sconces = [];
  const W = ST.w, H = ST.h; G = geo(W, H); const { cx, FL, dw, dh, top, lint, DW, DH } = G;
  root.scale.set(G.k); root.addChild(ov); ov.removeChildren(); ov.visible = true;
  { // push scale at which the doorway hole covers the whole view (any aspect), and the push end a bit past it
    const px = cx, py = top + dh / 2, sx = Math.max(px / (dw / 2), (DW - px) / (dw / 2)), sy = Math.max(py / (dh / 2), (DH - py) / (dh / 2));
    G.sCover = Math.max(sx, sy) * 1.02;
    // the push (inCubic) reaches sCover at 70% of T.push (~1.96 s), i.e. before the board drop starts at T.drop[0]
    G.sMax = Math.max(4.8, 1 + (G.sCover - 1) / Math.pow(0.7, 3)); }
  const XL = cx - dw / 2, XR = cx + dw / 2;
  // doorway interior when the game is not attached yet: warm dark (never seen while closed)
  // leaves (behind the wall)
  tex.leafL = leafTex(dw / 2, dh, true); tex.leafR = leafTex(dw / 2, dh, false);
  leafL = new PerspectiveMesh({ texture: tex.leafL, verticesX: 8, verticesY: 8 }); leafR = new PerspectiveMesh({ texture: tex.leafR, verticesX: 8, verticesY: 8 });
  ov.addChild(leafL, leafR);
  // seam + under-door light (the party is inside): warm, additive, breathes slowly while closed
  doorLight = new Graphics(); doorLight.blendMode = 'add';
  doorLight.rect(cx - 1.5, top + 6, 3, dh - 8).fill({ color: 0xffc46a, alpha: 0.9 }); doorLight.rect(cx - 5, top + 6, 10, dh - 8).fill({ color: 0xffb455, alpha: 0.25 });
  doorLight.rect(XL + 6, FL - 4, dw - 12, 4).fill({ color: 0xffd27a, alpha: 0.9 });
  ov.addChild(doorLight);
  // wall with the doorway cut out (inverse mask), drawn like the foyer: plum wall, stone panels + gold inner line, stone dado + base
  wallC = new Container(); ov.addChild(wallC);
  const g = new Graphics(); wallC.addChild(g);
  const X0 = -DW, X1 = DW * 2, Y0 = -DH;
  g.rect(X0, Y0, X1 - X0, FL - Y0).fill(PAL.wall); const dado = FL - 150;
  const pw = G.port ? 200 : 230, gap = 44, pTop = Math.min(top - lint - 40, FL - 560);
  const frame = (x, y0, y1) => { g.rect(x, y0, pw, y1 - y0).fill(PAL.wallHi).stroke({ width: 12, color: PAL.stone, alignment: 0.5 });
    g.rect(x - 6, y0 - 6, pw + 12, y1 - y0 + 12).stroke({ width: 2.5, color: PAL.ink }); g.rect(x + 6, y0 + 6, pw - 12, y1 - y0 - 12).stroke({ width: 2, color: PAL.ink, alpha: 0.8 });
    g.rect(x + 16, y0 + 16, pw - 32, y1 - y0 - 32).stroke({ width: 1.6, color: PAL.gold, alpha: 0.85 }); };
  const clear = 150 + (G.port ? 60 : 110);  // keep panels clear of the door surround + sconces
  for (let side of [-1, 1]) for (let i = 0; i < 8; i++) { const x = side < 0 ? XL - clear - pw - i * (pw + gap) : XR + clear + i * (pw + gap);
    frame(x, pTop, dado - 46); frame(x, dado + 30, FL - 52); }
  const band = (y, h, c, hi) => { g.rect(X0, y, X1 - X0, h).fill(c); g.moveTo(X0, y + 2).lineTo(X1, y + 2).stroke({ width: 2, color: hi, alpha: 0.8 });
    g.moveTo(X0, y).lineTo(X1, y).stroke({ width: 3, color: PAL.ink }); g.moveTo(X0, y + h).lineTo(X1, y + h).stroke({ width: 3, color: PAL.ink }); };
  band(dado - 10, 22, PAL.stone, PAL.stoneHi); g.moveTo(X0, dado + 6).lineTo(X1, dado + 6).stroke({ width: 2, color: PAL.gold }); band(FL - 34, 34, PAL.stoneSh, PAL.stone);
  // stone door surround: two pilasters + a lintel with a cornice and one thin gold line
  const S = 54;
  g.rect(XL - S, top - 6, S, dh + 6).fill(PAL.stone).stroke({ width: 3, color: PAL.ink }); g.rect(XR, top - 6, S, dh + 6).fill(PAL.stone).stroke({ width: 3, color: PAL.ink });
  g.rect(XL - S + 10, top + 4, 8, dh - 10).fill({ color: PAL.stoneHi, alpha: 0.55 }); g.rect(XR + 10, top + 4, 8, dh - 10).fill({ color: PAL.stoneHi, alpha: 0.55 });
  g.rect(XL - 10, top, 10, dh).fill({ color: PAL.stoneSh }); g.rect(XR, top, 10, dh).fill({ color: PAL.stoneSh });   // reveal (jamb depth)
  g.rect(XL - S - 22, top - lint, dw + 2 * S + 44, lint).fill(PAL.stone).stroke({ width: 3, color: PAL.ink });
  g.rect(XL - S - 34, top - lint - 16, dw + 2 * S + 68, 18).fill(PAL.stoneHi).stroke({ width: 3, color: PAL.ink });
  g.moveTo(XL - S - 10, top - lint / 2).lineTo(XR + S + 10, top - lint / 2).stroke({ width: 2, color: PAL.gold });
  g.rect(XL, top - 8, dw, 8).fill(PAL.stoneSh);   // head jamb
  // floor + stone threshold
  drawFloor(g, cx, top + dh * 0.33, FL, X0, X1, DH * 2);
  g.rect(XL - S - 10, FL - 2, dw + 2 * S + 20, 16).fill(PAL.stoneHi).stroke({ width: 2.5, color: PAL.ink });
  holeG = new Graphics().rect(XL, top, dw, dh).fill(0xffffff); ov.addChild(holeG); wallC.setMask({ mask: holeG, inverse: true });
  // sconces (the foyer's own sconce part) + candle breathe
  for (const s of [-1, 1]) { const sp = new Sprite(tex.sconce); sp.anchor.set(0.5); sp.scale.set(G.sc.s * (s > 0 ? -1 : 1), G.sc.s);
    const x = cx + s * G.sc.dx, y = G.sc.y; sp.position.set(x, y); wallC.addChild(sp);
    const gx = x + (s > 0 ? 1 : -1) * 22 * G.sc.s, gy = y - 46 * G.sc.s;
    const halo = new Sprite(tex.blob); halo.anchor.set(0.5); halo.tint = PAL.sconce; halo.blendMode = 'add'; halo.scale.set(2.4 * G.sc.s); halo.position.set(gx, gy);
    const core = new Sprite(tex.dot); core.anchor.set(0.5); core.tint = 0xffe2a0; core.blendMode = 'add'; core.position.set(gx, gy);
    const wash = new Sprite(tex.blob); wash.anchor.set(0.5); wash.tint = PAL.sconce; wash.blendMode = 'add'; wash.scale.set(3.2 * G.sc.s, 4.2 * G.sc.s); wash.position.set(gx, gy + 120 * G.sc.s); wash.alpha = 0.09;
    wallC.addChild(wash, halo, core); sconces.push({ halo, core, ph: s }); }
  // warm spill on the floor when the doors open (in front of everything but the UI)
  spill = new Sprite(tex.spill); spill.blendMode = 'add'; spill.anchor.set(0.5, 0); spill.position.set(cx, FL); spill.width = dw * 2.6; spill.height = (DH - FL) * 1.1; spill.alpha = 0; ov.addChild(spill);
  glowL = new Sprite(tex.blob); glowL.blendMode = 'add'; glowL.anchor.set(0.5); glowL.tint = 0xffc46a; glowL.position.set(cx, top + dh * 0.62); glowL.scale.set(dw / 160, dh / 200); glowL.alpha = 0; ov.addChild(glowL);
  // title: approved stone ELFHAUS logo with the five silhouettes, unchanged; a soft dark pool behind it keeps it reading
  logoBack = new Sprite(tex.blob); logoBack.anchor.set(0.5); logoBack.tint = 0x0a0410; logoBack.alpha = 0.85; logoBack.position.set(cx, G.logo.y); logoBack.scale.set(G.logo.w / 150, G.logo.w / 260);
  logoS = new Sprite(tex.title); logoS.anchor.set(0.5); logoS.width = G.logo.w; logoS.scale.y = logoS.scale.x; logoS.position.set(cx, G.logo.y);
  root.addChild(logoBack, logoS);
  // loading bar: semi-transparent black plate, gold border + glow (the new HUD plate)
  barC = new Container(); barC.position.set(cx, G.bar.y); root.addChild(barC);
  const { w: bw, h: bh } = G.bar; barGlow = new Graphics();
  for (const [sw, a] of [[30, 0.05], [18, 0.09], [10, 0.16], [5, 0.3]]) barGlow.roundRect(-bw / 2 - 2, -bh / 2 - 2, bw + 4, bh + 4, bh / 2 + 2).stroke({ width: sw, color: GOLD, alpha: a });
  const plate = new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2).fill({ color: 0x000000, alpha: 0.55 })
    .roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2).stroke({ width: 3, color: GOLD }).roundRect(-bw / 2 + 5, -bh / 2 + 5, bw - 10, bh - 10, bh / 2 - 5).stroke({ width: 1.2, color: 0xffeab0, alpha: 0.45 });
  barFill = new Graphics(); barC.addChild(barGlow, plate, barFill);
  // TAP TO PARTY: same plate, gold type (replaces the old pink glow art with its four-point sparkles)
  btnC = new Container(); btnC.position.set(cx, G.btn.y); btnC.alpha = 0; root.addChild(btnC);
  const { w: tw, h: th } = G.btn; btnGlow = new Graphics();
  for (const [sw, a] of [[44, 0.05], [28, 0.09], [16, 0.16], [8, 0.3]]) btnGlow.roundRect(-tw / 2 - 3, -th / 2 - 3, tw + 6, th + 6, th / 2 + 3).stroke({ width: sw, color: GOLD, alpha: a });
  const bp = new Graphics().roundRect(-tw / 2, -th / 2, tw, th, th / 2).fill({ color: 0x000000, alpha: 0.58 })
    .roundRect(-tw / 2 + 4, -th / 2 + 4, tw - 8, th * 0.45, th / 2 - 4).fill({ color: 0xffffff, alpha: 0.05 })
    .roundRect(-tw / 2, -th / 2, tw, th, th / 2).stroke({ width: 4, color: GOLD }).roundRect(-tw / 2 + 7, -th / 2 + 7, tw - 14, th - 14, th / 2 - 7).stroke({ width: 1.5, color: 0xffeab0, alpha: 0.5 });
  const lab = new Text({ text: 'TAP TO PARTY', style: { fontFamily: FONT, fontWeight: '900', fontSize: th * 0.42, fill: GOLD, letterSpacing: th * 0.05,
    dropShadow: { color: 0x000000, alpha: 0.6, blur: 3, distance: 2, angle: Math.PI / 2 } } }); lab.anchor.set(0.5); lab.y = 2;
  btnC.addChild(btnGlow, bp, lab);
  buildCards();
  setDoors(0, 0);
}
// card slots (design px). Landscape: two square-art cards stacked left of the left sconce, the tall merged-pair card on the right.
// Portrait: a row of three under TAP TO PARTY (scaled down to fit short screens).
function cardSlots() {
  const { cx, top, DH } = G;
  if (!G.port) { const y0 = top - 110, h = 610, w = 400, gx = 710;
    return { s: 1, dir: 'x', slots: [{ x: cx - gx, y: y0, w, h: (h - 20) / 2, art: 150, side: -1 }, { x: cx - gx, y: y0 + (h - 20) / 2 + 20, w, h: (h - 20) / 2, art: 150, side: -1 },
      { x: cx + gx, y: y0, w, h, art: 420, side: 1 }] }; }
  // L3: keep a free strip under the cards for the 48 px "Don't show this again" row (.spSkip, 48 screen px + 10 px inset)
  const skipRow = (48 + 14) / G.k;
  const w = 330, gap = 18, h = 400, yTop = G.btn.y + G.btn.h / 2 + 28, avail = DH - 12 - skipRow - yTop, sc = Math.min(1, avail / h);
  return { s: sc, dir: 'y', slots: [-1, 0, 1].map((i) => ({ x: cx + i * (w + gap) * sc, y: yTop + (avail - h * sc) / 2, w, h, art: 190, side: 0 })) };
}
function buildCards() {
  cardsC = new Container(); root.addChild(cardsC); cardEls = [];
  const L = cardSlots();
  CARDS.forEach((c, i) => { const q = L.slots[i], C = new Container(); C.scale.set(L.s); cardsC.addChild(C);
    const { w, h } = q, R = 22, g = new Graphics();
    for (const [sw, a] of [[26, 0.04], [16, 0.08], [9, 0.14], [4, 0.26]]) g.roundRect(-w / 2 - 2, -2, w + 4, h + 4, R + 2).stroke({ width: sw, color: GOLD, alpha: a });
    g.roundRect(-w / 2, 0, w, h, R).fill({ color: 0x000000, alpha: 0.62 }).roundRect(-w / 2 + 4, 4, w - 8, Math.min(90, h * 0.2), R - 4).fill({ color: 0xffffff, alpha: 0.04 })
      .roundRect(-w / 2, 0, w, h, R).stroke({ width: 3, color: GOLD }).roundRect(-w / 2 + 7, 7, w - 14, h - 14, R - 6).stroke({ width: 1.2, color: 0xffeab0, alpha: 0.45 });
    C.addChild(g);
    const art = new Sprite(tex['card_' + c.key]); art.anchor.set(0.5); const ab = q.art, fit = Math.min((w - 40) / art.texture.width, ab / art.texture.height);
    art.scale.set(fit); art.position.set(0, 20 + ab / 2); C.addChild(art);
    const ti = new Text({ text: c.title.toUpperCase(), style: { fontFamily: FONT, fontWeight: '900', fontSize: G.port ? 25 : 30, fill: GOLD, letterSpacing: G.port ? 0.5 : 1.5, align: 'center',
      dropShadow: { color: 0x000000, alpha: 0.6, blur: 3, distance: 2, angle: Math.PI / 2 } } });
    ti.anchor.set(0.5, 0); ti.position.set(0, 20 + ab + 14); C.addChild(ti);
    const ln = new Text({ text: c.line, style: { fontFamily: FONT, fontWeight: '700', fontSize: G.port ? 23 : 21, fill: 0xeee3f2, align: 'center', wordWrap: true, wordWrapWidth: w - 48, lineHeight: G.port ? 30 : 27 } });
    ln.anchor.set(0.5, 0); ln.position.set(0, ti.y + ti.height + 8); C.addChild(ln);
    cardEls.push({ C, q, L, i }); });
  placeCards(0, 0);
}
function placeCards(inK, outT) {   // inK: global clock for the calm staggered fade-in; outT: seconds since tap (snappy staggered exit)
  for (const e of cardEls) { const { C, q, L, i } = e;
    const a = seg(inK, 0.15 + i * 0.12, 0.5 + i * 0.12), rise = (1 - ease.outCubic(a)) * 24;
    const ko = seg(outT, T.cards[0] + i * 0.07, T.cards[0] + i * 0.07 + 0.28, ease.inBack), far = 900;
    let x = q.x, y = q.y + rise;
    if (L.dir === 'x') x += q.side * far * ko; else y += (far + 200 * i) * ko;
    C.position.set(x, y); C.alpha = a * (1 - seg(outT, T.cards[0] + i * 0.07 + 0.18, T.cards[0] + i * 0.07 + 0.3)); }
}
function setDoors(aL, aR) {   // 0 = closed, 1 = ~80 deg open, swinging INTO the foyer (away from the guest)
  G.aL = aL;
  const { cx, dw, dh, top, FL, F } = G, w = dw / 2, XL = cx - dw / 2, XR = cx + dw / 2, HZ = top + dh * 0.33, VX = cx;
  const pr = (X, Y, z) => { const p = F / (F + z); return [VX + (X - VX) * p, HZ + (Y - HZ) * p]; };
  const th = (a) => a * 1.4;   // ~80 deg
  { const t_ = th(aL), X = XL + w * Math.cos(t_), z = w * Math.sin(t_); const [x1, y1] = pr(X, top, z), [x2, y2] = pr(X, FL, z);
    leafL.setCorners(XL, top, x1, y1, x2, y2, XL, FL); leafL.tint = shade(aL); }
  { const t_ = th(aR), X = XR - w * Math.cos(t_), z = w * Math.sin(t_); const [x1, y1] = pr(X, top, z), [x2, y2] = pr(X, FL, z);
    leafR.setCorners(x1, y1, XR, top, XR, FL, x2, y2); leafR.tint = shade(aR); }
}
function handleL(aL = G.aL || 0) {   // the left leaf's lever (rose) in screen space, for a swing aL (same projection as setDoors)
  const { cx, dw, dh, top, F } = G, w = dw / 2, XL = cx - dw / 2, HZ = top + dh * 0.33, VX = cx, t_ = aL * 1.4, u = 0.925;
  const X = XL + u * w * Math.cos(t_), z = u * w * Math.sin(t_), p = F / (F + z), Y = top + dh * HANDLE_Y;
  return leafL.parent.toGlobal({ x: VX + (X - VX) * p, y: HZ + (Y - HZ) * p });
}
const shade = (a) => { const v = Math.round(255 * (1 - 0.35 * a)); return (v << 16) | (v << 8) | v; };   // leaf turns away from the vestibule light

// ---------------- game hand-off (DOM board / HUD + Pixi room layer) ----------------
const CAM0 = 0.72;
let cam = 1, PV = { x: 0, y: 0 };
const $id = (id) => document.getElementById(id);
// #alcove is display:contents, so its pieces move one by one
const BOARD = ['stage', 'alcoveAmbient', 'alcoveGlow', 'alcoveRecess', 'alcoveLedge', 'alcoveRail', 'alcoveCrown'];
const camEls = () => ['bg', 'scene', 'app'].map($id).filter(Boolean);
function camPt(q) { return { x: PV.x + cam * (q.x - PV.x), y: PV.y + cam * (q.y - PV.y) }; }    // scene px -> intro px
const unCam = (x, y, c) => ({ x: PV.x + (x - PV.x) / c, y: PV.y + (y - PV.y) / c });         // intro px -> scene px
function applyCam(c) { cam = c; for (const e of camEls()) { e.style.transformOrigin = `${PV.x}px ${PV.y}px`; e.style.scale = c === 1 ? '' : String(c); } }
function setEl(id, dy, a) { const e = $id(id); if (!e) return; e.style.translate = dy ? `0 ${dy.toFixed(1)}px` : ''; e.style.opacity = a >= 1 ? '' : a.toFixed(3); }
// re-audit H3: the alcove / board art are CSS backgrounds that sit at opacity 0 until the drop, so the browser only
// decoded them on their first visible frame (the board showed bare, then "popped" its frame mid-drop). Decode them up front.
const keep = [];
function predecode() {
  const urls = new Set();
  for (const id of [...BOARD, 'top', 'hud', 'board']) { const e = $id(id); if (!e) continue;
    for (const n of [e, ...e.querySelectorAll('*')]) { const cs = getComputedStyle(n);
      for (const v of [cs.backgroundImage, cs.borderImageSource]) for (const m of (v || '').matchAll(/url\("?([^")]+)"?\)/g)) urls.add(m[1]);
      if (n.tagName === 'IMG' && n.src) urls.add(n.src); } }
  for (const u of urls) { const im = new Image(); im.src = u; keep.push(im); im.decode?.().catch(() => {}); }
}
function prime() {   // the game in its "behind the doors" state
  predecode();
  PV = { x: G.cx * G.k, y: (G.top + G.dh * 0.5) * G.k };
  sceneHold(true); if (rig) { rig.doorReach(true, 0); rig.face('surprised', 0); }
  primed = true; setGame(0);
}
function setGame(tt) {   // all game objects driven from the intro clock (transform + opacity only)
  applyCam(lerp(CAM0, 1, seg(tt, ...T.cam, ease.inOutCubic)));
  const H = ST.h, dropH = H * 0.62;
  // board + Roxy drop in together: fall from above, land past the mark and spring back (outBack)
  const kd = seg(tt, ...T.drop), dropY = (1 - ease.outBack(kd, 1.9)) * -dropH, dA = tt >= T.drop[0] ? 1 : 0;   // H3: solid from the first frame (it enters from above the view), no half-alpha ghost
  for (const id of BOARD) setEl(id, dropY, dA);
  const kl = seg(tt, ...T.logo); setEl('top', -40 * (1 - ease.outBack(kl, 2)), seg(tt, T.logo[0], T.logo[0] + 0.1));
  const kh = seg(tt, ...T.hud, ease.outCubic); setEl('hud', 80 * (1 - kh), kh);
  if (!rig) return;
  const v = rig.view;
  if (tt < T.drop[0]) {   // Roxy in the doorway holding the left leaf (wink held in the gap), steps out as the camera pushes
    if (faceOff) { faceOff = false; sceneHold(true, true); rig.doorReach(true, 0); }
    rig.face('wink', tt > T.wink[0] + 0.12 && tt < T.wink[1] - 0.1 ? 1 : 0);
    const hScreen = G.dh * 0.8 * G.k, s = hScreen / (rig.height * cam);
    const fx = (G.cx - G.dw * 0.12) * G.k, fy = (G.FL - 8) * G.k, p = unCam(fx, fy, cam);
    v.position.set(p.x - rig.offsetX * s + 60 * s * seg(tt, ...T.roxyOut, ease.inCubic), p.y); v.scale.set(s); v.alpha = 1 - seg(tt, ...T.roxyOut);
    if (tt < T.roxyOut[0] && state === 'trans') { const q = RXA.doorPts(), hg = handleL();   // her door hand follows the lever as the leaf swings
      if (q) { const d = Math.atan2(hg.y - q.sh.y, hg.x - q.sh.x) - Math.atan2(q.hand.y - q.sh.y, q.hand.x - q.sh.x);
        rig.doorReach(true, Math.max(-28, Math.min(28, q.r + Math.atan2(Math.sin(d), Math.cos(d)) * 180 / Math.PI))); } }
  } else if (tt < T.face[1]) {   // dropped in with the board on her rest pose, wide-eyed; the face eases back at T.face
    if (!faceOff) { faceOff = true; rig.doorReach(false); rig.face('wink', 0); sceneHold(true, false); }
    rig.face('surprised', tt < T.face[0] ? 1 : 0);
    const m = lerp(0.94, 1, ease.outCubic(kd));
    v.scale.set(roxyAt.s * m); v.position.set(roxyAt.x, roxyAt.y + dropY); v.alpha = dA;
  } else release();
}
function release() { if (roxyFree || !rig) return; roxyFree = true; rig.face('surprised', 0); rig.release(); rig.idle(); rig.view.alpha = 1; sceneHold(false); }
function finish() {   // end state (also the skip)
  if (state === 'done') return; state = 'done';
  applyCam(1); for (const id of [...BOARD, 'top', 'hud']) setEl(id, 0, 1);
  release(); for (const e of camEls()) e.style.transformOrigin = '';
  if (app) { app.ticker.stop(); const c = app.canvas; app.destroy({ removeView: true }, { children: true }); c?.remove?.(); app = null; }
  document.body.classList.remove('introOn'); (window as any).ELFHAUS_INTRO_DONE = true; doneRes();
}
const skip = () => { if (state === 'trans') { setGame(T.end); finish(); } };
function onKey(e) { if (state === 'trans' && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); e.stopPropagation(); skip(); } }
function onDown() { if (state === 'trans' && tt > 0.12) skip(); }

// ---------------- update ----------------
function update(dt) {
  t += dt;
  const br = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 / 3.6);   // calm idle breathe
  for (const s of sconces) { const f = 0.5 + 0.35 * Math.sin(t * Math.PI * 2 / 3.6 + s.ph) + 0.08 * Math.sin(t * 4.3 + s.ph);
    s.halo.alpha = 0.26 + 0.1 * f; s.core.alpha = 0.7 + 0.25 * f; s.core.scale.set((1.5 + 0.12 * f) * G.sc.s); }
  if (state === 'loading') { const target = Math.min(0.97, progFn()); prog += (target - prog) * Math.min(1, dt * 4); }
  else if (state !== 'trans') prog += (1 - prog) * Math.min(1, dt * 8);
  const { w: bw, h: bh } = G.bar; barFill.clear();
  const fw = Math.max(bh - 12, (bw - 12) * prog); barFill.roundRect(-bw / 2 + 6, -bh / 2 + 6, fw, bh - 12, (bh - 12) / 2).fill({ color: GOLD, alpha: 0.95 })
    .roundRect(-bw / 2 + 8, -bh / 2 + 7, fw - 4, (bh - 12) * 0.4, (bh - 12) / 4).fill({ color: 0xfff1c4, alpha: 0.5 });
  barGlow.alpha = 0.6 + 0.4 * br;
  if (state !== 'trans') placeCards(t, 0);
  if (state === 'tap') { tt += dt; barC.alpha = 1 - seg(tt, 0, 0.18); const k = seg(tt, 0.08, 0.4);
    btnC.alpha = seg(tt, 0.08, 0.2); const pulse = 0.5 + 0.5 * Math.sin((tt - 0.4) * Math.PI * 2 / 1.6);
    btnC.scale.set(k < 1 ? lerp(0.85, 1, ease.outBack(k, 2.2)) : 1 + 0.015 * pulse); btnGlow.alpha = k < 1 ? 1 : 0.55 + 0.45 * pulse;
    if (tt > 0.4) tapRes(); }
  doorLight.alpha = state === 'trans' ? 0 : 0.75 + 0.25 * br;
  if (state === 'trans') {
    tt += dt;
    placeCards(t, tt); barC.alpha = 0;
    btnC.scale.set(lerp(1, 0.92, seg(tt, 0, 0.08))); btnC.alpha = 1 - seg(tt, 0.02, 0.16);
    logoS.alpha = logoBack.alpha = 1 - seg(tt, T.push[0], T.push[0] + 0.2); logoS.y = G.logo.y - 30 * seg(tt, T.push[0], T.push[0] + 0.2, ease.inCubic); logoBack.alpha *= 0.85;
    const aL = seg(tt, ...T.doorL, ease.inOutSine), aR = seg(tt, ...T.doorR, ease.inOutSine); setDoors(Math.min(aL, holdL()), aR);
    const open = Math.max(aL, aR); spill.alpha = 0.32 * open; glowL.alpha = 0.18 * open * (1 - seg(tt, ...T.push));
    const kp = seg(tt, ...T.push, ease.inCubic), s = lerp(1, G.sMax, kp);   // camera push: the vestibule flies past the lens
    const px = G.cx, py = G.top + G.dh * 0.5; ov.pivot.set(px, py); ov.position.set(px, py); ov.scale.set(s);
    // re-audit H3: no translucent crossfade of the vestibule over the game (that was the doubled staircase, the ghost
    // Roxy and the panel edges). The walls stay opaque until the doorway fills the whole view, then they are simply gone;
    // the open leaves (inside the doorway) fade early in the push so they never show as panels at the frame edges.
    const lf = 1 - seg(tt, T.push[0], T.push[0] + 0.28); leafL.alpha = leafR.alpha = lf; spill.alpha *= lf;
    ov.alpha = 1; ov.visible = s < G.sCover;
    setGame(tt);
    if (tt >= T.end) finish();
  }
}

// ---------------- public API (loader.ts) ----------------
function size() { if (!app) return; const r = Math.min(2, Math.max(0.5, ST.s * (window.devicePixelRatio || 1)));
  app.renderer.resize(ST.w, ST.h, r); const c = app.canvas; c.style.width = ST.w + 'px'; c.style.height = ST.h + 'px'; }
function onResize() { if (!app || state === 'done') return; fitStage(); size(); build();
  if (state === 'trans') { skip(); return; } if (primed) prime(); update(0); }
/** Start the vestibule (loading state). Resolves false when WebGL / assets are unavailable (old DOM splash stays). */
export async function initIntro(progress: () => number): Promise<boolean> {
  progFn = progress;
  const L = $id('loader'); if (!L) return false;
  try {
    fitStage();
    const cv = document.createElement('canvas'); cv.id = 'introCv'; cv.setAttribute('aria-hidden', 'true'); L.before(cv);
    const a = new Application();
    await a.init({ canvas: cv, width: ST.w, height: ST.h, resolution: Math.min(2, Math.max(0.5, ST.s * (window.devicePixelRatio || 1))), autoDensity: false,
      backgroundAlpha: 0, antialias: true, preference: 'webgl', sharedTicker: false, hello: false, autoStart: false });
    app = a; size();
    const [title, { sheet }, ...cardT] = await Promise.all([loadTex(TITLE), loadSheet('assets/foyer/', 'foyer'), ...CARDS.map((c) => loadTex(c.art))]);
    tex.title = title; tex.sconce = sheet.textures.sconce;
    CARDS.forEach((c, i) => { tex['card_' + c.key] = cardT[i]; try { cardT[i].source.autoGenerateMipmaps = true; cardT[i].source.updateMipmaps(); } catch {} });
    try { title.source.autoGenerateMipmaps = true; title.source.updateMipmaps(); } catch {}
    tex.blob = softBlob(); tex.dot = glowDot(); tex.spill = spillTex();
    if (killed || !$id('loader')) throw new Error('loader gone (error / skip) before the intro was up');
    a.stage.addChild(root); state = 'loading'; build(); update(0); a.render();
    a.ticker.add((tk) => { if (state !== 'done') update(Math.min(0.05, tk.deltaMS / 1000)); }); a.ticker.start();
    addEventListener('resize', onResize); visualViewport?.addEventListener('resize', onResize);
    addEventListener('keydown', onKey, { capture: true }); document.addEventListener('pointerdown', onDown, { capture: true });
    document.body.classList.add('introOn'); L.classList.add('pxOn');
    (window as any).__intro = { get state() { return state; }, get t() { return tt; }, T, skip,
      // test hook: freeze the transition at intro time x (seconds after the tap) for frame-exact shots
      seek(x) { if (!app || state !== 'trans') return; app.ticker.stop(); tt = x; update(0); app.render(); } };
    return true;
  } catch (e) {
    if (!killed) console.warn('intro off (no WebGL?)', e); state = 'off';
    try { app?.destroy({ removeView: true }); } catch {} app = null; $id('introCv')?.remove(); return false;
  }
}
export const introOn = () => !!app && state !== 'done' && state !== 'off';
/** Loading finished: fill the bar, prime the game behind the doors, show TAP TO PARTY (resolves once it is up). */
export function introLoaded(): Promise<void> {
  if (!introOn()) return Promise.resolve();
  prime(); state = 'tap'; tt = 0;
  return new Promise((r) => (tapRes = r));
}
/** The player tapped: play the door transition (resolves when the game is fully handed over). */
export function introEnter(): Promise<void> {
  if (!introOn()) return Promise.resolve();
  if (!primed) prime();
  const p = new Promise<void>((r) => (doneRes = r));
  state = 'trans'; tt = 0; roxyFree = false; faceOff = false; return p;
}
/** Returning players ("Don't show this again") and errors: straight to the end state. */
export function introSkip() { if (!app || state === 'off') { killed = true; return; } if (state === 'done') return; if (!primed) prime(); state = 'trans'; setGame(T.end); finish(); }
/** Run a layout pass with the intro's camera / drop styles lifted (DOM rects stay true), then re-apply the current pose. */
export function introLayout(fn: () => void) {
  if (!primed || state === 'done' || state === 'off') { fn(); return; }
  const c = cam; for (const e of camEls()) e.style.scale = ''; for (const id of [...BOARD, 'top', 'hud']) setEl(id, 0, 1);
  try { fn(); } finally { cam = c; setGame(state === 'trans' ? tt : 0); }
}
