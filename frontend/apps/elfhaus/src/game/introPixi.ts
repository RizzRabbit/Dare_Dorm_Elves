// @ts-nocheck  (door / camera geometry kept from the approved intro mockup; the look is the Winter Chalet set)
// Elfhaus intro: the guest arrives at the chalet's front door on a snowy night. Timber log wall, cranberry double doors
// with wreaths, lanterns either side, a snowy porch, snow falling, the hand-lettered ELFHAUS logo, cream info cards
// (Bonus Modes, Sticky Wilds, Wild Winter Spins), a flat gold loading bar, then TAP TO START.
// Tap: cards slide away -> doors open (~0.9 s, Roxy in the doorway with a wink) -> camera push through the doorway ->
// board + Roxy drop in together -> logo + HUD follow -> idle. ~3.25 s; a second tap (or Enter / Space) skips.
// Own transparent canvas (#introCv) inside #root just under #loader (which stays as the transparent tap / keyboard /
// "Don't show this again" layer). The game is driven with CSS individual transforms (scale / translate / opacity) and Roxy
// through the rig adapter. No WebGL -> initIntro() resolves false and the DOM splash shows instead.
import { Application, Container, Graphics, PerspectiveMesh, Sprite, Text, Texture } from 'pixi.js';
import { ST, fitStage } from './stage';
import { ctex, ease, clamp, seg, lerp, softBlob, glowDot } from './scene/util';
import { loadTex } from './scene/load';
import { rig, roxyAt, sceneHold } from './scene/scene';
import ARTG from './art.generated.json';
import { symArtReady } from './symrig';
const TITLE = ARTG.logo || 'art/logo.webp';
import { EGW_STACK_X } from './config';

const FONT = "'Lilita One', Nunito, 'Segoe UI', Roboto, Arial, sans-serif";
// Winter Chalet palette: timber, cranberry, cream, gold, pine, ink (flat fills, thick ink lines)
const PAL = { wall: 0x5a3220, wallHi: 0x6e3d26, wallLo: 0x43241a, stone: 0x8a5530, stoneHi: 0xa86a3c, stoneSh: 0x4f2c18, gold: 0xf2b935,
  marble: 0xf4eee2, marbleBack: 0xc9d6e2, inlay: 0x7a4526, sconce: 0xffc46a, ink: 0x26140f };
const GOLD = 0xf2b935, CREAM = 0xfbf3e4, CRAN = 0xa61c34, PINE = 0x1f4b38;
// timeline (seconds after the tap), pass 2 (James: "I think it's great")
export const T = { cards: [0.0, 0.42], doorL: [0.40, 1.30], doorR: [0.50, 1.40], wink: [0.75, 1.45], push: [1.55, 2.13], roxyOut: [1.55, 1.73], over: [1.95, 2.13],
  cam: [1.55, 2.17], drop: [1.99, 2.37], logo: [2.15, 2.45], hud: [2.17, 2.47], btn: [2.23, 2.55], face: [3.01, 3.13], end: 3.25 };
// the build's own feature cards (same titles + lines as the old splash), restyled black / gold
const CARDS = [
  { key: 'modes', art: 'S', title: '4 Bonus Modes',
    line: '3, 4 or 5 Ski Passes start Bunny Slope, Black Diamond or Double Black free spins. A Secret Santa spin always lands 2 Ski Passes and the other reels reveal the result.' },
  { key: 'sticky', art: 'W_R2', title: 'Sticky Wilds',
    line: 'In Black Diamond and Double Black the wilds lock in place and keep growing every free spin. Double Black guarantees at least one full-reel wild.' },
  { key: 'egw', art: 'assets/stacks/still/WM2_R1-2.webp', title: 'Wild Winter Spins',
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

// door leaf (outside face): flat cranberry paint, two inset panels (ink line + gold inner line), a wreath, gold lever
function leafTex(w, h, hingeLeft) { return ctex(w, h, (g) => {
  g.fillStyle = '#a61c34'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#c7344c'; g.fillRect(hingeLeft ? 0 : w - 10, 0, 10, h);           // one flat highlight on the hinge edge
  const m = w * 0.14, panel = (y0, y1) => { const x = m, pw = w - 2 * m;
    g.fillStyle = '#7d1226'; g.fillRect(x, y0, pw, y1 - y0);
    g.lineWidth = 5; g.strokeStyle = hex(PAL.ink); g.strokeRect(x, y0, pw, y1 - y0);
    g.lineWidth = 3; g.strokeStyle = hex(GOLD); g.strokeRect(x + 10, y0 + 10, pw - 20, y1 - y0 - 20); };
  panel(h * 0.07, h * (HANDLE_Y - 0.04)); panel(h * (HANDLE_Y + 0.035), h * 0.93);
  // wreath on the upper panel: pine ring, ink outline, red berries, cranberry bow
  const cx = w / 2, cy = h * 0.24, R = w * 0.24;
  g.lineWidth = R * 0.42 + 8; g.strokeStyle = hex(PAL.ink); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
  g.lineWidth = R * 0.42; g.strokeStyle = '#2c6a4f'; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
  g.lineWidth = R * 0.12; g.strokeStyle = '#3f8a66'; g.beginPath(); g.arc(cx, cy, R + R * 0.06, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.3; g.fillStyle = '#e8384f'; g.strokeStyle = hex(PAL.ink); g.lineWidth = 2;
    g.beginPath(); g.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, R * 0.09, 0, Math.PI * 2); g.fill(); g.stroke(); }
  g.fillStyle = '#d42a44'; g.strokeStyle = hex(PAL.ink); g.lineWidth = 3;
  for (const d of [-1, 1]) { g.beginPath(); g.moveTo(cx, cy + R); g.lineTo(cx + d * R * 0.55, cy + R - R * 0.3); g.lineTo(cx + d * R * 0.55, cy + R + R * 0.3); g.closePath(); g.fill(); g.stroke(); }
  g.beginPath(); g.arc(cx, cy + R, R * 0.13, 0, Math.PI * 2); g.fill(); g.stroke();
  g.lineWidth = 4; g.strokeStyle = hex(PAL.ink); g.strokeRect(2, 2, w - 4, h - 4);
  // flat gold lever handle + rose near the free (meeting) edge, ink outlined
  const hx = hingeLeft ? w - w * 0.075 : w * 0.075, hy = h * HANDLE_Y, dir = hingeLeft ? -1 : 1;
  g.fillStyle = hex(GOLD); g.strokeStyle = hex(PAL.ink); g.lineWidth = 3;
  rr(g, Math.min(hx, hx + dir * 34), hy - 5, 34, 10, 5); g.fill(); g.stroke();
  g.beginPath(); g.arc(hx, hy, 9, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#ffe08a'; g.beginPath(); g.arc(hx - 3, hy - 3, 3, 0, Math.PI * 2); g.fill();
}); }
// lantern (either side of the door): ink-outlined gold frame, warm glass
const lanternTex = () => ctex(90, 150, (g) => {
  g.lineWidth = 5; g.strokeStyle = '#26140f'; g.lineJoin = 'round';
  g.fillStyle = '#26140f'; g.fillRect(41, 0, 8, 22);
  g.fillStyle = '#f2b935'; g.beginPath(); g.moveTo(20, 40); g.lineTo(45, 18); g.lineTo(70, 40); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#ffd47a'; g.fillRect(22, 40, 46, 70); g.strokeRect(22, 40, 46, 70);
  g.fillStyle = '#fff3c4'; g.beginPath(); g.ellipse(45, 80, 9, 15, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(45, 40); g.lineTo(45, 110); g.stroke();
  g.fillStyle = '#f2b935'; g.fillRect(16, 110, 58, 12); g.strokeRect(16, 110, 58, 12);
  g.fillStyle = '#fbf5ea'; g.beginPath(); g.ellipse(45, 22, 30, 8, 0, Math.PI, 0); g.fill(); g.stroke();
});
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
    // TAP TO START keeps a >= 46 screen-px plate on small landscape phones; v21 compact popouts: scales with the screen, no px floor
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
let snowC, flakes = [], cardsC, cardEls = [], wallC, leafL, leafR, glowL, spill, holeG, sconces = [], logoS, logoBack, barC, barFill, barGlow, btnC, btnGlow, doorLight;
function drawFloor(g, CX, HZ, FL, x0, x1, y1) {   // snowy porch: timber deck boards under a soft snow drift, ink lines
  g.rect(x0, FL, x1 - x0, y1 - FL).fill(0x7a4526);
  for (let y = FL + 26, i = 0; y < y1; y += 26 + i * 6, i++) g.moveTo(x0, y).lineTo(x1, y);
  g.stroke({ width: 3, color: PAL.ink, alpha: 0.55 });
  // drift: cream snow piled along the wall and both sides of the path, the path to the door swept clear
  const drift = (xa, xb) => { g.moveTo(xa, FL); for (let x = xa; x <= xb; x += 40) g.lineTo(x, FL + 30 + 12 * Math.sin(x * 0.02)); g.lineTo(xb, FL); g.closePath(); };
  drift(x0, CX - 330); g.fill(PAL.marble).stroke({ width: 3, color: PAL.ink }); drift(CX + 330, x1); g.fill(PAL.marble).stroke({ width: 3, color: PAL.ink });
  g.moveTo(x0, FL).lineTo(x1, FL).stroke({ width: 4, color: PAL.ink });
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
  // timber log wall with the doorway cut out (inverse mask), timber base rail
  wallC = new Container(); ov.addChild(wallC);
  const g = new Graphics(); wallC.addChild(g);
  const X0 = -DW, X1 = DW * 2, Y0 = -DH;
  g.rect(X0, Y0, X1 - X0, FL - Y0).fill(PAL.wall); const dado = FL - 150;
  const pw = G.port ? 200 : 230, gap = 44, pTop = Math.min(top - lint - 40, FL - 560);
  // log wall: stacked timber logs, each with an ink seam and one flat highlight band
  for (let y = FL - 52; y > Y0; y -= 52) { g.rect(X0, y - 52, X1 - X0, 52).fill(((FL - y) / 52) % 2 ? PAL.wall : PAL.wallHi);
    g.rect(X0, y - 46, X1 - X0, 8).fill({ color: PAL.stoneHi, alpha: 0.35 }); g.moveTo(X0, y).lineTo(X1, y).stroke({ width: 4, color: PAL.ink }); }
  void pw; void gap; void pTop; const frame = () => {};
  const clear = 150 + (G.port ? 60 : 110);  // keep panels clear of the door surround + sconces
  for (let side of [-1, 1]) for (let i = 0; i < 8; i++) { const x = side < 0 ? XL - clear - pw - i * (pw + gap) : XR + clear + i * (pw + gap);
    frame(x, pTop, dado - 46); frame(x, dado + 30, FL - 52); }
  const band = (y, h, c, hi) => { g.rect(X0, y, X1 - X0, h).fill(c); g.moveTo(X0, y + 2).lineTo(X1, y + 2).stroke({ width: 2, color: hi, alpha: 0.8 });
    g.moveTo(X0, y).lineTo(X1, y).stroke({ width: 3, color: PAL.ink }); g.moveTo(X0, y + h).lineTo(X1, y + h).stroke({ width: 3, color: PAL.ink }); };
  band(FL - 34, 34, PAL.stoneSh, PAL.stone); void dado;
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
  g.rect(XL - S - 10, FL - 2, dw + 2 * S + 20, 16).fill(PAL.stoneHi).stroke({ width: 3, color: PAL.ink });
  // snow cap on the cornice (cream, scalloped drips, ink outline)
  { const x0 = XL - S - 40, x1 = XR + S + 40, y = top - lint - 16; g.moveTo(x0, y + 4); for (let x = x0; x <= x1; x += 28) g.quadraticCurveTo(x + 14, y - 22, x + 28, y + 2);
    for (let x = x1; x >= x0; x -= 34) g.lineTo(x, y + 6 + (((x / 34) | 0) % 3 === 0 ? 14 : 4)); g.closePath(); g.fill(PAL.marble).stroke({ width: 3, color: PAL.ink }); }
  holeG = new Graphics().rect(XL, top, dw, dh).fill(0xffffff); ov.addChild(holeG); wallC.setMask({ mask: holeG, inverse: true });
  // lanterns either side of the door + candle breathe
  for (const s of [-1, 1]) { const sp = new Sprite(tex.sconce); sp.anchor.set(0.5); sp.scale.set(G.sc.s * 1.3, G.sc.s * 1.3);
    const x = cx + s * G.sc.dx, y = G.sc.y; sp.position.set(x, y); wallC.addChild(sp);
    const gx = x, gy = y + 4 * G.sc.s;
    const halo = new Sprite(tex.blob); halo.anchor.set(0.5); halo.tint = PAL.sconce; halo.blendMode = 'add'; halo.scale.set(2.4 * G.sc.s); halo.position.set(gx, gy);
    const core = new Sprite(tex.dot); core.anchor.set(0.5); core.tint = 0xffe2a0; core.blendMode = 'add'; core.position.set(gx, gy);
    const wash = new Sprite(tex.blob); wash.anchor.set(0.5); wash.tint = PAL.sconce; wash.blendMode = 'add'; wash.scale.set(3.2 * G.sc.s, 4.2 * G.sc.s); wash.position.set(gx, gy + 120 * G.sc.s); wash.alpha = 0.09;
    wallC.addChild(wash, halo, core); sconces.push({ halo, core, ph: s }); }
  // snowfall in front of the wall (calm, real time), pushed past the lens with the vestibule
  snowC = new Container(); ov.addChild(snowC); flakes = [];
  for (let i = 0; i < (G.port ? 70 : 110); i++) { const f = new Sprite(tex.dot); f.anchor.set(0.5); f.tint = 0xffffff;
    const z = 0.5 + Math.random(); f.scale.set(0.35 * z); f.alpha = 0.5 + 0.4 * (z - 0.5);
    f.position.set(Math.random() * DW, Math.random() * DH); snowC.addChild(f); flakes.push({ f, z, ph: Math.random() * 6.28 }); }
  // warm spill on the floor when the doors open (in front of everything but the UI)
  spill = new Sprite(tex.spill); spill.blendMode = 'add'; spill.anchor.set(0.5, 0); spill.position.set(cx, FL); spill.width = dw * 2.6; spill.height = (DH - FL) * 1.1; spill.alpha = 0; ov.addChild(spill);
  glowL = new Sprite(tex.blob); glowL.blendMode = 'add'; glowL.anchor.set(0.5); glowL.tint = 0xffc46a; glowL.position.set(cx, top + dh * 0.62); glowL.scale.set(dw / 160, dh / 200); glowL.alpha = 0; ov.addChild(glowL);
  // title: approved stone ELFHAUS logo with the five silhouettes, unchanged; a soft dark pool behind it keeps it reading
  logoBack = new Sprite(tex.blob); logoBack.anchor.set(0.5); logoBack.tint = 0x1a0d08; logoBack.alpha = 0.5; logoBack.position.set(cx, G.logo.y); logoBack.scale.set(G.logo.w / 150, G.logo.w / 260);
  logoS = new Sprite(tex.title); logoS.anchor.set(0.5); logoS.width = G.logo.w; logoS.scale.y = logoS.scale.x; logoS.position.set(cx, G.logo.y);
  root.addChild(logoBack, logoS);
  // loading bar: semi-transparent black plate, gold border + glow (the new HUD plate)
  barC = new Container(); barC.position.set(cx, G.bar.y); root.addChild(barC);
  const { w: bw, h: bh } = G.bar; barGlow = new Graphics();
  barGlow.roundRect(-bw / 2, -bh / 2 + 6, bw, bh, bh / 2).fill({ color: PAL.ink, alpha: 0.6 });   // flat offset shadow
  const plate = new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2).fill(CREAM).stroke({ width: 5, color: PAL.ink });
  barFill = new Graphics(); barC.addChild(barGlow, plate, barFill);
  // TAP TO START: cranberry plate, ink + gold rings, cream lettering
  btnC = new Container(); btnC.position.set(cx, G.btn.y); btnC.alpha = 0; root.addChild(btnC);
  const { w: tw, h: th } = G.btn; btnGlow = new Graphics();
  btnGlow.roundRect(-tw / 2, -th / 2 + 8, tw, th, th / 2).fill({ color: PAL.ink, alpha: 0.7 });   // flat offset shadow
  const bp = new Graphics().roundRect(-tw / 2, -th / 2, tw, th, th / 2).fill(CRAN)
    .roundRect(-tw / 2 + 10, -th / 2 + 7, tw - 20, th * 0.2, th * 0.1).fill(0xc7344c)
    .roundRect(-tw / 2, -th / 2, tw, th, th / 2).stroke({ width: 6, color: PAL.ink }).roundRect(-tw / 2 + 8, -th / 2 + 8, tw - 16, th - 16, th / 2 - 8).stroke({ width: 3, color: GOLD });
  const lab = new Text({ text: 'TAP TO START', style: { fontFamily: FONT, fontWeight: '400', fontSize: th * 0.44, fill: CREAM, letterSpacing: th * 0.04,
    stroke: { color: PAL.ink, width: th * 0.08, join: 'round' }, dropShadow: { color: PAL.ink, alpha: 1, blur: 0, distance: th * 0.05, angle: Math.PI / 2 } } }); lab.anchor.set(0.5); lab.y = 1;
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
  const ti = new Text({ text: c.title.toUpperCase(), style: { fontFamily: FONT, fontWeight: '400', fontSize: size.t, fill: CRAN, letterSpacing: 0.5, align: size.al } });
  let fl = size.l, ln;
  for (;;) { ln?.destroy(); ln = new Text({ text: c.line, style: { fontFamily: "Nunito, 'Segoe UI', sans-serif", fontWeight: '800', fontSize: fl, fill: PAL.ink, align: size.al, wordWrap: true, wordWrapWidth: wrapW, lineHeight: Math.round(fl * 1.3) } });
    if (ti.height + 6 + ln.height <= maxH || fl <= (ST.compact ? 7 : 11)) break; fl -= 0.5; }
  if (ti.width > wrapW) ti.scale.set(wrapW / ti.width);
  return { ti, ln };
}
function buildCards() {
  cardsC = new Container(); cardsC.sortableChildren = true; root.addChild(cardsC); cardEls = [];
  const { cw: w, ch: h, row } = G.pc;
  CARDS.forEach((c, i) => { const C = new Container(); C.scale.set(1 / G.ks); cardsC.addChild(C);
    const R = 16, g = new Graphics();
    g.roundRect(-w / 2, -h / 2 + 7, w, h, R).fill({ color: PAL.ink, alpha: 0.7 });   // flat offset shadow
    g.roundRect(-w / 2, -h / 2, w, h, R).fill(CREAM).roundRect(-w / 2, -h / 2, w, h, R).stroke({ width: 4, color: PAL.ink })
      .roundRect(-w / 2 + 7, -h / 2 + 7, w - 14, h - 14, R - 5).stroke({ width: 2.5, color: GOLD });
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
    const shade = new Graphics().roundRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, R + 2).fill(0x1a0d08); shade.alpha = 0; C.addChild(shade);   // darkens the neighbours
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
  dotsG.clear(); dotsG.roundRect(G.cx - 34 / ks, y - 8 / ks, 68 / ks, 16 / ks, 8 / ks).fill(CREAM).stroke({ width: 2.5 / ks, color: PAL.ink });
  CARDS.forEach((_, i) => { const on = i === idx, x = G.cx + (i - 1) * gap, rw = (on ? 14 : 7) / ks, rh = 7 / ks;
    dotsG.roundRect(x - rw / 2, y - rh / 2, rw, rh, rh / 2).fill({ color: on ? CRAN : 0x8a6a58, alpha: 1 }); });
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
function setDoors(aL, aR) {   // 0 = closed, 1 = ~80 deg open, swinging INTO the chalet (away from the guest)
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
  const fw = Math.max(bh - 14, (bw - 14) * prog); barFill.roundRect(-bw / 2 + 7, -bh / 2 + 7, fw, bh - 14, (bh - 14) / 2).fill(GOLD)
    .roundRect(-bw / 2 + 12, -bh / 2 + 9, Math.max(0, fw - 10), (bh - 14) * 0.3, (bh - 14) / 6).fill(0xffe08a);
  for (const q of flakes) { const f = q.f; f.y += dt * 60 * q.z; f.x += dt * (14 * Math.sin(t * 0.7 + q.ph) + 6) * q.z;
    if (f.y > G.DH + 10) { f.y = -10; f.x = Math.random() * G.DW; } if (f.x > G.DW + 10) f.x = -10; }
  carStep(); if (state !== 'trans') placeCards(t, 0);
  if (state === 'tap') { tt += dt; barC.alpha = 1 - seg(tt, 0, 0.18); const k = seg(tt, 0.08, 0.4);
    btnC.alpha = seg(tt, 0.08, 0.2); const pulse = 0.5 + 0.5 * Math.sin((tt - 0.4) * Math.PI * 2 / 1.6);
    btnC.scale.set(k < 1 ? lerp(0.85, 1, ease.outBack(k, 2.2)) : 1 + 0.025 * pulse); btnGlow.alpha = 1;
    if (tt > 0.4) tapRes(); }
  doorLight.alpha = state === 'trans' ? 0 : 0.75 + 0.25 * br;
  if (state === 'trans') {
    tt += dt;
    placeCards(t, tt); barC.alpha = 0;
    btnC.scale.set(lerp(1, 0.92, seg(tt, 0, 0.08))); btnC.alpha = 1 - seg(tt, 0.02, 0.16);
    logoS.alpha = logoBack.alpha = 1 - seg(tt, T.push[0], T.push[0] + 0.2); logoS.y = G.logo.y - 30 * seg(tt, T.push[0], T.push[0] + 0.2, ease.inCubic); logoBack.alpha *= 0.5;
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
    await symArtReady;   // S / W_R2 are rebuilt from the symbols sheet (symrig.ts)
    const [title, ...cardT] = await Promise.all([loadTex(TITLE), ...CARDS.map((c) => loadTex(c.art.includes('/') ? c.art : (ARTG as Record<string, string | null>)[c.art] || ''))]);
    tex.title = title; tex.sconce = lanternTex();
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
/** Loading finished: fill the bar, prime the game behind the doors, show TAP TO START (resolves once it is up). */
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
