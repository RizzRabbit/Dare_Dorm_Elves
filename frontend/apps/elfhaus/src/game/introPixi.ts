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
import { EGW_STACK_X } from './config';

const FONT = "Montserrat, Nunito, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const PAL = { wall: 0x2e1a40, wallHi: 0x3a2350, wallLo: 0x24132f, stone: 0xa597b8, stoneHi: 0xd2c6dd, stoneSh: 0x6f6286, gold: 0xe0ac3a,
  marble: 0xb7adc6, marbleBack: 0x7b6f92, inlay: 0x4a2768, sconce: 0xffc46a, ink: 0x1a0b24 };
const GOLD = 0xffc83d;
// timeline (seconds after the tap), pass 2 (James: "I think it's great")
export const T = { cards: [0.0, 0.42], doorL: [0.40, 1.30], doorR: [0.50, 1.40], wink: [0.75, 1.45], push: [1.55, 2.13], roxyOut: [1.55, 1.73], over: [1.95, 2.13],
  cam: [1.55, 2.17], drop: [1.99, 2.37], logo: [2.15, 2.45], hud: [2.17, 2.47], btn: [2.23, 2.55], face: [3.01, 3.13], end: 3.25 };
// the build's own feature cards (same titles + lines as the old splash), restyled black / gold
const CARDS = [
// v3.18 carousel (James 2026-10-30): each card swipes in with a little more detail (facts as in the rules; no amounts)
  { key: 'modes', art: 'assets/intro/card_modes_S.webp', title: '4 Bonus Modes',
    line: '3, 4 or 5 Dare Cards start Dare, Double Dare or Triple Dare free spins. A Mystery Spin always lands 2 Dare Cards and the other reels reveal the result.' },
  { key: 'sticky', art: 'assets/intro/card_sticky_W_R2_card.webp', title: 'Sticky Wilds',
    line: 'In Double Dare and Triple Dare the wilds lock in place and keep growing every free spin. Triple Dare guarantees at least one full-reel wild.' },
  { key: 'egw', art: 'assets/intro/card_egw_WM2_R1-2.webp', title: 'Elves Gone Wild',
    line: `One supercharged spin: 2 to 5 reels land wilds that grow into full-reel wilds (x${EGW_STACK_X} each), then respins. Full wild reels side by side multiply.` },
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
function geo(W, H) {   // W, H: stage px (ST.w / ST.h); the card + skip-strip budgets below are SCREEN px (stage px * ST.s)
  const port = W / H < 0.9, S = ST.s || 1;
  W *= S; H *= S;   // work in screen px; ks = design -> screen, k = design -> stage
  // intro cards (v3.17): sized in SCREEN px so they stay readable on phones (the old design-px cards shrank to ~80 px wide
  // under the doors at portrait); the door scene gives up the room they need instead
  // v3.18: the feature cards are a swipe carousel centred on screen over the doorway (active card centred, the two
  // neighbours peeking in at the edges); the scene no longer gives up room for them. Card sizes are SCREEN px.
  const DOTS = 22, m = 10;
  if (!port) {
    const ks = Math.min(W / 1920, H / 1080), k = ks / S, DW = W / ks, DH = H / ks, cx = DW / 2;
    const FL = DH / 2 + 400, dw = 520, dh = 580, top = FL - dh;
    // TAP TO PARTY keeps a >= 46 screen-px plate on small landscape phones; v21 compact popouts: scales with the screen, no px floor
    const lbh = ST.compact ? 100 : Math.max(100, 46 / ks);
    const logo = { y: top - 64 - 122, w: 560 }, btn = { y: FL + 64, w: 470 * lbh / 100, h: lbh };
    const ar = tex.title ? tex.title.height / tex.title.width : 0.56;
    const yA = (logo.y + logo.w * ar * 0.42) * ks + m, yB = (btn.y - btn.h / 2) * ks - m - DOTS;   // between logo and button (screen px)
    const ch = ST.compact ? Math.max(0, Math.min(340, yB - yA)) : Math.max(150, Math.min(340, yB - yA)), cw = Math.min(W * 0.52, 560, ch * 2.1);
    return { port, k, ks, Ws: W, Hs: H, DW, DH, cx, FL, dw, dh, top, lint: 64, logo, bar: { y: FL + 64, w: 560, h: 40 }, btn, sc: { dx: 400, y: top + 150, s: 0.6 }, F: 1500,
      pc: { cw, ch, cy: (yA + yB) / 2, row: true, off: ST.compact && (H < 260 || ch < 60) } }; }   // v21: no carousel in a window under 260 px tall
  // portrait: the scene keeps its full width scale and sits centred above the skip strip; the carousel overlays the doors
  const dw = 540, dh = 780, lint = 64, ar = tex.title ? tex.title.height / tex.title.width : 0.56, logoW = 800;
  const above = dh + lint + 210 + logoW * ar / 2 + 14, btnY = 130, skip = 62, budget = H - skip - 10;
  let bh = 132, ks = Math.min(W / 1080, budget / (above + btnY + bh / 2 + 14));
  for (let i = 0; i < 3; i++) { bh = Math.max(132, 46 / ks); ks = Math.min(W / 1080, budget / (above + btnY + bh / 2 + 14)); }
  const below = btnY + bh / 2 + 14, k = ks / S, DW = W / ks, DH = H / ks, cx = DW / 2;
  const sceneH = ks * (above + below), sy = Math.max(4, (budget - sceneH) / 2);
  const FL = sy / ks + above, top = FL - dh;
  const logo = { y: top - 64 - 210, w: logoW }, btn = { y: FL + btnY, w: 620 * bh / 132, h: bh };
  const yA = (logo.y + logo.w * ar * 0.42) * ks + m, yB = (btn.y - btn.h / 2) * ks - m - DOTS;
  const cw = Math.min(W * 0.74, 360), ch = Math.max(200, Math.min(cw * 1.3, yB - yA));
  return { port, k, ks, Ws: W, Hs: H, DW, DH, cx, FL, dw, dh, top, lint, logo, bar: { y: FL + btnY, w: 640, h: 46 }, btn, sc: { dx: 400, y: top + 210, s: 0.72 }, F: 1700,
    pc: { cw, ch, cy: (yA + yB) / 2, row: false } };
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
// ---------------- feature card carousel (v3.18) ----------------
// One card centred, its two neighbours peeking in at the screen edges (smaller, darkened, never faded). Swipe / drag
// (touch + mouse), tap a side card, or Left / Right keys; wraps around. `pos` is the continuous index at the centre.
const CAR = { pos: 0, from: 0, to: 0, t0: -1, dur: 0.24, drag: null as any, eatUntil: 0 };
let dotsG = null;
function cardSpacing() { const { cw } = G.pc; return Math.max(G.Ws / 2 + 0.235 * cw, 0.925 * cw + 14); }   // screen px between card centres
function cardText(c, size, wrapW, maxH) {   // title + detail, shrinking the detail until it fits maxH (screen px)
  const ti = new Text({ text: c.title.toUpperCase(), style: { fontFamily: FONT, fontWeight: '900', fontSize: size.t, fill: GOLD, letterSpacing: 0.5, align: size.al,
    dropShadow: { color: 0x000000, alpha: 0.6, blur: 2, distance: 1.5, angle: Math.PI / 2 } } });
  let fl = size.l, ln;
  for (;;) { ln?.destroy(); ln = new Text({ text: c.line, style: { fontFamily: FONT, fontWeight: '700', fontSize: fl, fill: 0xeee3f2, align: size.al, wordWrap: true, wordWrapWidth: wrapW, lineHeight: Math.round(fl * 1.3) } });
    if (ti.height + 6 + ln.height <= maxH || fl <= (ST.compact ? 7 : 11)) break; fl -= 0.5; }
  if (ti.width > wrapW) ti.scale.set(wrapW / ti.width);
  return { ti, ln };
}
function buildCards() {
  cardsC = new Container(); cardsC.sortableChildren = true; root.addChild(cardsC); cardEls = [];
  const { cw: w, ch: h, row } = G.pc;
  CARDS.forEach((c, i) => { const C = new Container(); C.scale.set(1 / G.ks); cardsC.addChild(C);
    const R = 16, g = new Graphics();
    for (const [sw, a] of [[16, 0.04], [10, 0.08], [6, 0.14], [3, 0.26]]) g.roundRect(-w / 2 - 1.5, -h / 2 - 1.5, w + 3, h + 3, R + 1.5).stroke({ width: sw, color: GOLD, alpha: a });
    g.roundRect(-w / 2, -h / 2, w, h, R).fill({ color: 0x000000, alpha: 0.82 }).roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, Math.min(56, h * 0.2), R - 3).fill({ color: 0xffffff, alpha: 0.04 })
      .roundRect(-w / 2, -h / 2, w, h, R).stroke({ width: 2, color: GOLD }).roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, R - 4).stroke({ width: 1, color: 0xffeab0, alpha: 0.45 });
    C.addChild(g);
    const art = new Sprite(tex['card_' + c.key]); art.anchor.set(0.5); const tw = art.texture.width, th = art.texture.height;
    if (row) {   // landscape: art left, title + detail right
      const ah = h - 24, aw = w * 0.36, fit = Math.min(aw / tw, ah / th);
      art.scale.set(fit); const artW = tw * fit; art.position.set(-w / 2 + 14 + aw / 2, 0); C.addChild(art);
      const tx = -w / 2 + 14 + aw + 14, wrapW = w / 2 - 16 - tx;
      const { ti, ln } = cardText(c, { t: ST.compact ? Math.min(26, h * 0.1) : Math.max(16, Math.min(26, h * 0.1)), l: ST.compact ? Math.min(18, h * 0.065) : Math.max(12.5, Math.min(18, h * 0.065)), al: 'left' }, wrapW, h - 28);
      const bh = ti.height + 6 + ln.height, y = -bh / 2;
      ti.position.set(tx, y); ln.position.set(tx, y + ti.height + 6); C.addChild(ti, ln);
    } else {     // portrait: art on top, title + detail under it
      const { ti, ln } = cardText(c, { t: Math.max(17, Math.min(24, w * 0.072)), l: Math.max(12.5, Math.min(15.5, w * 0.047)), al: 'center' }, w - 30, h * 0.56);
      const textH = ti.height + 6 + ln.height, ab = Math.max(50, h - 14 - textH - 14 - 10), fit = Math.min((w - 30) / tw, ab / th);
      art.scale.set(fit); art.position.set(0, -h / 2 + 14 + ab / 2); C.addChild(art);
      ti.anchor.set(0.5, 0); ti.position.set(0, -h / 2 + 14 + ab + 8); ln.anchor.set(0.5, 0); ln.position.set(0, ti.y + ti.height + 6); C.addChild(ti, ln);
    }
    const shade = new Graphics().roundRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, R + 2).fill(0x000000); shade.alpha = 0; C.addChild(shade);   // darkens the neighbours
    cardEls.push({ C, i, shade }); });
  dotsG = new Graphics(); root.addChild(dotsG);
  placeCards(0, 0);
}
const wrapRel = (r) => { const n = CARDS.length; return ((((r + n / 2) % n) + n) % n) - n / 2; };
export const carIndex = () => ((Math.round(CAR.pos) % CARDS.length) + CARDS.length) % CARDS.length;
function carGo(to) { CAR.from = CAR.pos; CAR.to = to; CAR.t0 = t; }
function carStep() { if (CAR.t0 < 0 || CAR.drag?.on) return; const k = Math.min(1, (t - CAR.t0) / CAR.dur);
  CAR.pos = lerp(CAR.from, CAR.to, ease.outCubic(k)); if (k >= 1) { CAR.pos = CAR.to; CAR.t0 = -1; } }
function placeCards(inK, outT) {   // inK: global clock for the calm fade-in; outT: seconds since tap (snappy exit)
  if (!cardEls.length) return;
  if (G.pc.off) { cardsC.visible = false; if (dotsG) dotsG.visible = false; return; }   // v21: too short for the carousel
  cardsC.visible = true; if (dotsG) dotsG.visible = true;
  const { ch: h, cy } = G.pc, ks = G.ks, d = cardSpacing(), cxS = G.Ws / 2;
  const a = seg(inK, 0.15, 0.5), rise = (1 - ease.outCubic(a)) * 24, ko = seg(outT, T.cards[0], T.cards[0] + 0.3, ease.inCubic);
  cardsC.alpha = dotsG.alpha = a * (1 - ko);
  for (const e of cardEls) { const r = wrapRel(e.i - CAR.pos), ar = Math.min(1, Math.abs(r));
    e.C.position.set((cxS + r * d) / ks, (cy + rise + 40 * ko) / ks); e.C.scale.set(lerp(1, 0.86, ar) * (1 - 0.06 * ko) / ks);
    e.shade.alpha = 0.55 * ar; e.C.zIndex = 10 - Math.round(Math.abs(r) * 4); e.C.visible = Math.abs(r) < 1.6; }
  // page dots: small gold pills under the card (no pink circles)
  const idx = carIndex(), y = (cy + h / 2 + 13 + rise) / ks, gap = 16 / ks;
  dotsG.clear(); dotsG.roundRect(G.cx - 34 / ks, y - 8 / ks, 68 / ks, 16 / ks, 8 / ks).fill({ color: 0x000000, alpha: 0.55 });
  CARDS.forEach((_, i) => { const on = i === idx, x = G.cx + (i - 1) * gap, rw = (on ? 14 : 7) / ks, rh = 7 / ks;
    dotsG.roundRect(x - rw / 2, y - rh / 2, rw, rh, rh / 2).fill({ color: on ? GOLD : 0xffeab0, alpha: on ? 1 : 0.35 }); });
}
// pointer: the transparent #loader sits over the canvas, so listen on the document and map client -> screen px
function toScreen(e) { const r = app?.canvas?.getBoundingClientRect?.(); if (!r || !r.width) return null; return { x: (e.clientX - r.left) / r.width * G.Ws, y: (e.clientY - r.top) / r.height * G.Hs }; }
const carLive = () => !!app && !G?.pc?.off && (state === 'loading' || state === 'tap') && !fading;
function inBand(q) { const { ch: h, cy } = G.pc; return q && Math.abs(q.y - cy) <= h / 2 + 8; }
function carDown(e) { if (!carLive() || (e.button ?? 0) !== 0 || e.target?.closest?.('.spSkip')) return; const q = toScreen(e); if (!inBand(q)) return;
  CAR.t0 = -1; CAR.drag = { on: true, id: e.pointerId, x0: q.x, x: q.x, p0: CAR.pos, moved: false, hist: [[performance.now(), q.x]] }; }
function carMove(e) { const D = CAR.drag; if (!D?.on || e.pointerId !== D.id) return; const q = toScreen(e); if (!q) return;
  D.x = q.x; if (Math.abs(q.x - D.x0) > 8) D.moved = true;
  if (D.moved) { CAR.pos = D.p0 - (q.x - D.x0) / cardSpacing(); e.preventDefault?.(); }
  D.hist.push([performance.now(), q.x]); if (D.hist.length > 6) D.hist.shift(); }
function carUp(e) { const D = CAR.drag; if (!D?.on || e.pointerId !== D.id) return; D.on = false; CAR.eatUntil = performance.now() + 400;
  if (D.moved) { const h = D.hist, [t0, x0] = h[0], [t1, x1] = h[h.length - 1], v = t1 > t0 ? (x1 - x0) / (t1 - t0) * 1000 : 0;   // screen px / s
    const dp = CAR.pos - D.p0, fl = -v / Math.max(1, G.Ws);   // a 15% drag or a flick (> ~0.35 screen widths / s) commits one card
    const dir = Math.abs(fl) > 0.35 ? Math.sign(fl) : Math.abs(dp) > 0.15 ? Math.sign(dp) : 0; carGo(Math.round(D.p0) + dir); return; }
  // a tap (no drag): a side card comes to the centre; the centre card stays
  const q = toScreen(e); if (!q) return; const r = (q.x - G.Ws / 2) / cardSpacing(), { cw } = G.pc;
  if (Math.abs(q.x - G.Ws / 2) > cw / 2) carGo(Math.round(CAR.pos) + Math.sign(r)); }
function carCancel() { if (CAR.drag?.on) { CAR.drag.on = false; carGo(Math.round(CAR.pos)); } }
/** loader.ts: true when this click belonged to the carousel (a drag, or a tap on the cards); it must not enter the game. */
export function introEatClick(e?: Event) { if (!app || state === 'done' || state === 'off') return false;
  if (performance.now() < CAR.eatUntil) { CAR.eatUntil = 0; return true; }
  const q = e && 'clientX' in e ? toScreen(e) : null; return !!(q && (e as any).detail !== 0 && inBand(q)); }
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
// L2: a user skip is no longer a hard cut: the game snaps to its end state underneath and the frozen vestibule frame
// fades off it over 250 ms (instant under reduced motion, and for resize / programmatic skips)
let fading = false;
const skip = (soft = false) => { if (state !== 'trans' || fading) return; setGame(T.end);
  const c = app?.canvas as HTMLCanvasElement | undefined;
  if (!soft || !c || matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
  fading = true; app.ticker.stop(); c.style.pointerEvents = 'none';
  c.style.transition = 'opacity .25s ease-out'; void c.offsetWidth; c.style.opacity = '0';
  setTimeout(() => { fading = false; finish(); }, 260); };   // timer, not transitionend: the end state must always land
function onKey(e) { if (carLive() && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) { e.preventDefault(); carGo(Math.round(CAR.t0 >= 0 ? CAR.to : CAR.pos) + (e.code === 'ArrowRight' ? 1 : -1)); return; }
  if (state === 'trans' && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); e.stopPropagation(); skip(true); } }
function onDown() { if (state === 'trans' && tt > 0.12) skip(true); }

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
  carStep(); if (state !== 'trans') placeCards(t, 0);
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
    document.addEventListener('pointerdown', carDown, { capture: true }); addEventListener('pointermove', carMove, { capture: true, passive: false });
    addEventListener('pointerup', carUp, { capture: true }); addEventListener('pointercancel', carCancel, { capture: true });
    document.body.classList.add('introOn'); L.classList.add('pxOn');
    (window as any).__intro = { get state() { return state; }, get t() { return tt; }, T, skip, get card() { return carIndex(); }, get carPos() { return CAR.pos; },
      get btnY() { const r = app?.canvas?.getBoundingClientRect?.(); return r ? r.top + G.btn.y * G.ks / G.Hs * r.height : 0; }, get cardY() { const r = app?.canvas?.getBoundingClientRect?.(); return r ? r.top + G.pc.cy / G.Hs * r.height : 0; },
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
