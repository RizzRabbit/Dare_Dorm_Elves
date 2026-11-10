// @ts-nocheck  (door / camera geometry kept from the approved intro mockup; the look is the Winter Chalet set)
// Elfhaus intro: the guest arrives at the chalet's front door on a snowy night. Timber log wall, cranberry double doors
// with wreaths, lanterns either side, a snowy porch, snow falling, the hand-lettered ELFHAUS logo, cream info cards
// (Bonus Modes, Sticky Wilds, Wild Winter Spins), a flat gold loading bar, then TAP TO START.
// Tap: cards slide away -> doors open (~0.9 s, Roxy in the doorway with a wink) -> camera push through the doorway ->
// board + Roxy drop in together -> logo + HUD follow -> idle. ~3.25 s; a second tap (or Enter / Space) skips.
// Own transparent canvas (#introCv) inside #root just under #loader (which stays as the transparent tap / keyboard /
// "Don't show this again" layer). The game is driven with CSS individual transforms (scale / translate / opacity) and Roxy
// through the rig adapter. No WebGL -> initIntro() resolves false and the DOM splash shows instead.
import { Application, BlurFilter, Container, Graphics, PerspectiveMesh, Sprite, Text, Texture } from 'pixi.js';
import { ST, fitStage, capResolution } from './stage';
import { getLayout } from './layout';
import { skipSplash, setSkipSplash } from './intro';
import { ease, clamp, seg, lerp } from './scene/util';
import { loadTex } from './scene/load';
import { loadAtlas, spr, nine, tile, mirrored, atlasTex } from './scene/atlas';
import { rig, roxyAt, sceneHold } from './scene/scene';
import ARTG from './art.generated.json';
import { symArtReady } from './symrig';
import { dbStill } from './dbstacks';
import { releaseIntroGpu, watchCanvas } from './diag';
const TITLE = ARTG.logo || 'art/logo.webp';
import { EGW_STACK_X } from './config';
import { sfx } from './audio';
import { loadFont, paintTextCanvas } from './skin';

const FONT = "'Lilita One', Nunito, 'Segoe UI', Roboto, Arial, sans-serif";
// Winter Chalet palette: timber, cranberry, cream, gold, pine, ink (flat fills, thick ink lines)
const PAL = { wall: 0x5a3220, wallHi: 0x6e3d26, wallLo: 0x43241a, stone: 0x8a5530, stoneHi: 0xa86a3c, stoneSh: 0x4f2c18, gold: 0xf2b935,
  marble: 0xf4eee2, marbleBack: 0xc9d6e2, inlay: 0x7a4526, sconce: 0xffc46a, ink: 0x26140f };
const GOLD = 0xf2b935, CREAM = 0xfbf3e4, CRAN = 0xa61c34, PINE = 0x1f4b38;
// timeline (seconds after the tap), pass 2 (James: "I think it's great")
export const T = { cards: [0.0, 0.42], doorL: [0.40, 1.30], doorR: [0.50, 1.40], wink: [0.75, 1.45], push: [1.55, 2.13], roxyOut: [1.55, 1.73], over: [1.95, 2.13],
  cam: [1.55, 2.17], drop: [1.99, 2.37], logo: [2.15, 2.45], hud: [2.17, 2.47], btn: [2.23, 2.55], face: [3.01, 3.13], end: 3.25 };
// the build's own feature cards on the cream painted plates; art = the board's current symbols (uifix)
const CARDS = [
  { key: 'modes', art: 'S_flat',   // uifix: the bare board symbol (ART.S is the framed paytable cell)
    title: '4 Bonus Modes',
    line: '3, 4 or 5 Ski Passes start Bunny Slope, Black Diamond or Double Black free spins. A Secret Santa spin always lands 2 Ski Passes and the other reels reveal the result.' },
  { key: 'sticky', art: 'W_R2_cut',   // uifix: Jade exactly as the board's bust wild (no old card plate behind her)
    title: 'Sticky Wilds',
    line: 'In Black Diamond and Double Black the wilds lock in place and keep growing every free spin. Double Black guarantees at least one full-reel wild.' },
  { key: 'egw', art: 'rig:WM2_R1-2',   // uifix: the board's own merged-wild rig (DragonBones), not the older r8d still
    title: 'Wild Winter Spins',
    line: `One supercharged spin: 2 to 5 reels land wilds that grow into full-reel wilds (x${EGW_STACK_X} each), then respins. Full wild reels side by side multiply.` },
];
let app = null, state = 'off', t = 0, tt = 0, prog = 0, G = null, primed = false, roxyFree = false, faceOff = false, progFn = () => 0;
let doneRes = () => {}, tapRes = () => {}, killed = false;
const root = new Container(), ov = new Container();
const tex = {};
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

// door leaves, lanterns, wall, floor, light: painted frames of the intro / fx / ui atlases (scene/atlas.ts)
// ---------------- geometry ----------------
function geo(W, H) {   // W, H: design px from the one layout pass (canvas lives under #root's contain transform)
  const lay = getLayout();
  const port = lay ? lay.portrait : W / H < 0.9;
  const I = lay?.intro;
  const cx = W / 2;
  const doors = I?.doors ?? (port
    ? { x: cx - 270, y: H * 0.62 - 780, w: 540, h: 780 }
    : { x: cx - 260, y: H / 2 - 180, w: 520, h: 580 });
  const cards = I?.cards ?? { x: cx - (port ? 180 : 300), y: doors.y + doors.h * 0.22, w: port ? 360 : 600, h: port ? 400 : 300 };
  const tap = I?.tap ?? { x: cx - (port ? 310 : 235), y: doors.y + doors.h + (port ? 64 : 14), w: port ? 620 : 470, h: port ? 132 : 100 };
  const dw = doors.w, dh = doors.h, top = doors.y, FL = doors.y + doors.h;
  const unit = dw / (port ? 540 : 520);
  const logo = { y: top - (port ? 274 : 186) * unit, w: (port ? 800 : 560) * unit };
  const sc = { dx: 400 * unit, y: top + (port ? 210 : 150) * unit, s: port ? 0.72 : 0.6 };
  return {
    port, k: 1, ks: 1, Ws: W, Hs: H, DW: W, DH: H, cx, FL, dw, dh, top, lint: 64,
    logo, bar: { y: tap.y + tap.h / 2, w: tap.w * 1.15, h: Math.max(32, tap.h * 0.38) },
    btn: { y: tap.y + tap.h / 2, w: tap.w, h: tap.h }, sc, F: port ? 1700 : 1500,
    pc: { cw: cards.w, ch: cards.h, cy: cards.y + cards.h / 2, row: !port, off: !!(lay?.compact && (H < 260 || cards.h < 60)) },
  };
}

// ---------------- build ----------------
let snowC, flakes = [], cardsC, cardEls = [], wallC, leafL, leafR, glowL, spill, holeG, sconces = [], logoS, logoBack, barC, barFill, barGlow, btnC, btnGlow, doorLight, skipC, skipMark, skipOn = false;
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
  // painted door leaves (intro atlas leaf_land / leaf_port, hinge-left; the right leaf is the same frame mirrored)
  tex.leafL = atlasTex('intro', G.port ? 'leaf_port' : 'leaf_land'); tex.leafR = mirrored('intro', G.port ? 'leaf_port' : 'leaf_land');
  leafL = new PerspectiveMesh({ texture: tex.leafL, verticesX: 8, verticesY: 8 }); leafR = new PerspectiveMesh({ texture: tex.leafR, verticesX: 8, verticesY: 8 });
  ov.addChild(leafL, leafR);
  // seam + under-door light (the party is inside): warm, additive, breathes slowly while closed
  doorLight = new Container(); doorLight.blendMode = 'add';
  { const seam = spr('fx', 'seam_light'); seam.position.set(cx, top + dh / 2); seam.width = 14; seam.height = dh - 8;
    const sill = spr('fx', 'sill_light'); sill.position.set(cx, FL - 2); sill.width = dw - 12; sill.height = 10; doorLight.addChild(seam, sill); }
  ov.addChild(doorLight);
  // timber log wall with the doorway cut out (inverse mask), timber base rail
  wallC = new Container(); ov.addChild(wallC);
  // painted wall: log wall tile (4 logs per 208 px tile), base rail band, stone pilasters + reveal, lintel, cornice,
  // threshold, timber deck floor (floor_tile 512 x 1024, tiles vertically), snow drifts and the cornice snow cap
  const X0 = -DW, X1 = DW * 2, Y0 = -DH, S = 54;
  const wall = tile('intro', 'wall_tile', X1 - X0, FL - Y0); wall.position.set(X0, Y0); wall.tilePosition.y = (FL - Y0) % 208; wallC.addChild(wall);
  const band = tile('intro', 'band_tile', (X1 - X0) / (34 / 80), 80, 1); band.scale.set(34 / 80); band.position.set(X0, FL - 34); wallC.addChild(band);
  const floor = tile('intro', 'floor_tile', X1 - X0, DH * 2 - FL, 0.5); floor.position.set(X0, FL); wallC.addChild(floor);
  for (const [xa, xb] of [[X0, cx - 330], [cx + 330, X1]]) { const d = spr('intro', 'drift_tile'); d.anchor.set(0, 0.5); d.position.set(xa, FL + 18); d.width = xb - xa; d.height = 44; wallC.addChild(d); }
  for (const x of [XL - S / 2, XR + S / 2]) { const p = tile('intro', 'pilaster', 116, (dh + 6) * 116 / S); p.scale.set(S / 116); p.position.set(x - S / 2, top - 6); wallC.addChild(p); }
  for (const x of [XL - 5, XR + 5]) { const r = spr('intro', 'reveal'); r.position.set(x, top + dh / 2); r.width = 10; r.height = dh; wallC.addChild(r); }
  const lin = spr('intro', 'lintel'); lin.position.set(cx, top - lint / 2); lin.width = dw + 2 * S + 44; lin.height = lint; wallC.addChild(lin);
  const cor = spr('intro', 'cornice'); cor.position.set(cx, top - lint - 7); cor.width = dw + 2 * S + 68; cor.height = 18; wallC.addChild(cor);
  const thr = spr('intro', 'threshold'); thr.position.set(cx, FL + 6); thr.width = dw + 2 * S + 20; thr.height = 16; wallC.addChild(thr);
  const cap = spr('intro', 'snow_tile'); cap.position.set(cx, top - lint - 16); cap.width = dw + 2 * S + 80; cap.height = 30; wallC.addChild(cap);
  holeG = new Graphics().rect(XL, top, dw, dh).fill(0xffffff); ov.addChild(holeG); wallC.setMask({ mask: holeG, inverse: true });
  // lanterns either side of the door + candle breathe
  for (const s of [-1, 1]) { const sp = spr('intro', 'lantern'); sp.scale.set(G.sc.s * 1.3 * 0.6);
    const x = cx + s * G.sc.dx, y = G.sc.y; sp.position.set(x, y); wallC.addChild(sp);
    const gx = x, gy = y + 4 * G.sc.s;
    const halo = spr('fx', 'sconce_glow'); halo.scale.set(0.5); halo.blendMode = 'add'; halo.scale.set(1.2 * G.sc.s); halo.position.set(gx, gy);
    const core = spr('fx', 'dot'); core.blendMode = 'add'; core.position.set(gx, gy);
    const wash = spr('fx', 'blob'); wash.blendMode = 'add'; wash.scale.set(3.2 * G.sc.s, 4.2 * G.sc.s); wash.position.set(gx, gy + 120 * G.sc.s); wash.alpha = 0.09;
    wallC.addChild(wash, halo, core); sconces.push({ halo, core, ph: s }); }
  // snowfall in front of the wall (calm, real time), pushed past the lens with the vestibule
  snowC = new Container(); ov.addChild(snowC); flakes = [];
  for (let i = 0; i < (G.port ? 70 : 110); i++) { const f = spr('fx', 'flake_far');
    const z = 0.5 + Math.random(); f.scale.set(0.35 * z); f.alpha = 0.5 + 0.4 * (z - 0.5);
    f.position.set(Math.random() * DW, Math.random() * DH); snowC.addChild(f); flakes.push({ f, z, ph: Math.random() * 6.28 }); }
  // warm spill on the floor when the doors open (in front of everything but the UI)
  spill = spr('fx', 'spill_cone'); spill.blendMode = 'add'; spill.anchor.set(0.5, 0); spill.position.set(cx, FL); spill.width = dw * 2.6; spill.height = (DH - FL) * 1.1; spill.alpha = 0; ov.addChild(spill);
  glowL = spr('fx', 'door_light'); glowL.blendMode = 'add'; glowL.position.set(cx, top + dh * 0.62); glowL.scale.set(dw / 160, dh / 200); glowL.alpha = 0; ov.addChild(glowL);
  // title: approved stone ELFHAUS logo with the five silhouettes, unchanged; a soft dark pool behind it keeps it reading
  logoBack = spr('fx', 'logo_back'); logoBack.alpha = 0.5; logoBack.position.set(cx, G.logo.y); logoBack.scale.set(G.logo.w / 150, G.logo.w / 260);
  logoS = new Sprite(tex.title); logoS.anchor.set(0.5); logoS.width = G.logo.w; logoS.scale.y = logoS.scale.x; logoS.position.set(cx, G.logo.y);
  root.addChild(logoBack, logoS);
  // loading bar: semi-transparent black plate, gold border + glow (the new HUD plate)
  barC = new Container(); barC.position.set(cx, G.bar.y); root.addChild(barC);
  const { w: bw, h: bh } = G.bar; barGlow = new Container();   // painted track + fill (ui atlas bar_track / bar_fill, 9-slice)
  const plate = nine('ui', 'bar_track', bw, bh + 8, 2); plate.position.set(-bw / 2, -bh / 2 - 2);
  barFill = nine('ui', 'bar_fill', bh, bh - 14, 2); barFill.position.set(-bw / 2 + 7, -bh / 2 + 7); barC.addChild(barGlow, plate, barFill);
  // TAP TO START: painted go plate + the baked word (ui btn_go, titles w_tap_to_start)
  btnC = new Container(); btnC.position.set(cx, G.btn.y); btnC.alpha = 0; root.addChild(btnC);
  const { w: tw, h: th } = G.btn; btnGlow = spr('fx', 'btn_halo'); btnGlow.width = tw * 1.25; btnGlow.height = th * 1.6; btnGlow.blendMode = 'add';
  const bp = nine('ui', 'btn_go', tw, th, 2); bp.position.set(-tw / 2, -th / 2);
  const lab = spr('titles', 'w_tap_to_start'); const lk = Math.min((tw * 0.8) / lab.texture.width, (th * 0.56) / lab.texture.height); lab.scale.set(lk); lab.y = 1;
  btnC.addChild(btnGlow, bp, lab);
  buildCards();
  buildSkip();
  setDoors(0, 0);
}
// ---------------- feature card carousel (v3.18) ----------------
// One card centred, its two neighbours peeking in at the screen edges (smaller, darkened, never faded). Swipe / drag
// (touch + mouse), tap a side card, or Left / Right keys; wraps around. `pos` is the continuous index at the centre.
const CAR = { pos: 0, from: 0, to: 0, t0: -1, dur: 0.24, drag: null as any, eatUntil: 0 };
let dotsG = null;
function cardSpacing() { const { cw } = G.pc; return Math.max(G.Ws / 2 + 0.235 * cw, 0.925 * cw + 14); }   // screen px between card centres
function paintTx(txt, font, px, wrapW, al) {   // painted bitmap-font text as a Sprite (falls back to Pixi Text until decoded)
  const r = paintTextCanvas(txt, font, px, wrapW, al === 'center' ? 'center' : 'left');
  if (!r) return null;
  const sp = new Sprite(Texture.from(r.cv)); sp.scale.set(1 / r.res);
  if (al === 'center') { sp.anchor.set(0.5, 0); }
  return sp;
}
function cardText(c, size, wrapW, maxH) {   // title + detail in the painted fonts (cran title, ink detail), shrinking the detail until it fits maxH
  const ti = paintTx(c.title.toUpperCase(), 'font_cran', size.t * 0.8, 1e5, size.al)
    || new Text({ text: c.title.toUpperCase(), style: { fontFamily: FONT, fontWeight: '400', fontSize: size.t, fill: CRAN, letterSpacing: 0.5, align: size.al } });
  let fl = size.l, ln;
  for (;;) { ln?.destroy({ texture: true, textureSource: true }); ln = paintTx(c.line, 'font_ink', fl * 0.78, wrapW, size.al)
      || new Text({ text: c.line, style: { fontFamily: "Nunito, 'Segoe UI', sans-serif", fontWeight: '800', fontSize: fl, fill: PAL.ink, align: size.al, wordWrap: true, wordWrapWidth: wrapW, lineHeight: Math.round(fl * 1.3) } });
    if (ti.height + 6 + ln.height <= maxH || fl <= (ST.compact ? 7 : 11)) break; fl -= 0.5; }
  if (ti?.scale && ti.width > wrapW * 0.96) ti.scale.set(ti.scale.x * wrapW * 0.96 / ti.width);   // uifix: title always fits inside the card padding
  return { ti, ln };
}
function addDepth(C, n, kind) {   // carddepth: painted depth so title / detail / art sit ON the cream card, not pasted flat
  if (!(n instanceof Sprite) || n instanceof Text) { C.addChild(n); return; }
  const cp = (tint, dx, dy, a) => { const s = new Sprite(n.texture); s.anchor.copyFrom(n.anchor); s.scale.copyFrom(n.scale);
    s.position.set(n.x + dx, n.y + dy); s.tint = tint; s.alpha = a; C.addChild(s); return s; };
  if (kind === 'art') {   // soft contact shadow under the symbol + a faint warm rim
    const sh = cp(0x3a1d10, 3, 6, 0.42); sh.filters = [new BlurFilter({ strength: 6, quality: 3 })];
    for (const [dx, dy] of [[-1.5, 0], [1.5, 0], [0, -1.5], [0, 1.5]]) cp(0xfff6e0, dx, dy, 0.55);
  } else if (kind === 'title') {   // cream/white outline + bevel highlight + soft drop shadow
    const sh = cp(0x4a2414, 2, 3, 0.45); sh.filters = [new BlurFilter({ strength: 2, quality: 2 })];
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; cp(0xfffaee, Math.cos(a) * 2.2, Math.sin(a) * 2.2, 1); }
    cp(0x5a1010, 0, 1.4, 0.9);   // lower bevel edge
  } else {   // detail: letterpress (light below, faint dark above) so it reads as printed into the card
    cp(0xffffff, 0, 1.2, 0.75); cp(0x2a160c, 0, -0.6, 0.18);
  }
  C.addChild(n);
}
function buildCards() {
  cardsC = new Container(); cardsC.sortableChildren = true; root.addChild(cardsC); cardEls = [];
  const { cw: w, ch: h, row } = G.pc;
  CARDS.forEach((c, i) => { const C = new Container(); C.scale.set(1 / G.ks); cardsC.addChild(C);
    const g = nine('ui', 'plate_cream', w, h + 8, 2); g.position.set(-w / 2, -h / 2); C.addChild(g);   // painted cream plate (chalet reskin; rim + shadow baked)
    const art = new Sprite(tex['card_' + c.key]); art.anchor.set(0.5); const tw = art.texture.width, th = art.texture.height;
    if (row) {   // landscape: art left, title + detail right
      const ah = h - 24, aw = w * 0.36, fit = Math.min(aw / tw, ah / th);
      art.scale.set(fit); const artW = tw * fit; art.position.set(-w / 2 + 14 + aw / 2, 0); addDepth(C, art, 'art');
      const tx = -w / 2 + 14 + aw + 14, wrapW = w / 2 - 16 - tx;
      const { ti, ln } = cardText(c, { t: ST.compact ? Math.min(26, h * 0.1) : Math.max(16, Math.min(36, h * 0.11)), l: ST.compact ? Math.min(18, h * 0.065) : Math.max(12.5, Math.min(25, h * 0.075)), al: 'left' }, wrapW, h - 28);
      const bh = ti.height + 6 + ln.height, y = -bh / 2;
      ti.position.set(tx, y); ln.position.set(tx, y + ti.height + 6); addDepth(C, ti, 'title'); addDepth(C, ln, 'line');
    } else {     // portrait: art on top, title + detail under it
      const { ti, ln } = cardText(c, { t: Math.max(17, Math.min(24, w * 0.072)), l: Math.max(12.5, Math.min(15.5, w * 0.047)), al: 'center' }, w - 30, h * 0.56);
      const textH = ti.height + 6 + ln.height, ab = Math.max(50, h - 14 - textH - 14 - 10), fit = Math.min((w - 30) / tw, ab / th);
      art.scale.set(fit); art.position.set(0, -h / 2 + 14 + ab / 2); addDepth(C, art, 'art');
      ti.anchor.set(0.5, 0); ti.position.set(0, -h / 2 + 14 + ab + 8); ln.anchor.set(0.5, 0); ln.position.set(0, ti.y + ti.height + 6); addDepth(C, ti, 'title'); addDepth(C, ln, 'line');
    }
    const shade = nine('ui', 'plate_cream_flat', w + 4, h + 4, 2); shade.tint = 0x1a0d08; shade.position.set(-w / 2 - 2, -h / 2 - 2); shade.alpha = 0; C.addChild(shade);   // darkens the neighbours
    cardEls.push({ C, i, shade }); });
  dotsG = new Container(); root.addChild(dotsG);   // page dots: ui atlas dot_on / dot_off
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
  const a = state === 'loading' ? seg(inK, 0.15, 0.5) : 1, rise = (1 - ease.outCubic(a)) * 24, ko = seg(outT, T.cards[0], T.cards[0] + 0.3, ease.inCubic);
  cardsC.alpha = dotsG.alpha = a * (1 - ko);
  for (const e of cardEls) { const r = wrapRel(e.i - CAR.pos), ar = Math.min(1, Math.abs(r));
    e.C.position.set((cxS + r * d) / ks, (cy + rise + 40 * ko) / ks); e.C.scale.set(lerp(1, 0.86, ar) * (1 - 0.06 * ko) / ks);
    e.shade.alpha = 0.55 * ar; e.C.zIndex = 10 - Math.round(Math.abs(r) * 4); e.C.visible = Math.abs(r) < 1.6; }
  // page dots: small gold pills under the card (no pink circles)
  const idx = carIndex(), y = (cy + h / 2 + 13 + rise) / ks, gap = 16 / ks;
  if (dotsG.children.length !== CARDS.length) { dotsG.removeChildren().forEach((o) => o.destroy()); CARDS.forEach(() => dotsG.addChild(spr('ui', 'dot_off'))); }
  CARDS.forEach((_, i) => { const d = dotsG.children[i], on = i === idx; d.texture = atlasTex('ui', on ? 'dot_on' : 'dot_off');
    d.position.set(G.cx + (i - 1) * gap, y); d.scale.set(14 / ks / Math.max(1, d.texture.width)); });
}
// pointer: the transparent #loader sits over the canvas, so listen on the document and map client -> screen px
function toScreen(e) { const r = app?.canvas?.getBoundingClientRect?.(); if (!r || !r.width) return null; const W = G?.DW || ST.w, H = G?.DH || ST.h; return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
function skipRect() {
  const L = getLayout();
  if (L?.intro?.skip) return L.intro.skip;
  return G.port ? { x: (G.cx || ST.w / 2) - 200, y: (G.DH || ST.h) - 72, w: 400, h: 56 } : { x: (G.DW || ST.w) - 280, y: (G.DH || ST.h) - 64, w: 260, h: 48 };
}
function hitSkip(q) {
  if (!q || !skipC || skipC.alpha < 0.5) return false;
  const r = skipRect();
  return q.x >= r.x && q.x <= r.x + r.w && q.y >= r.y && q.y <= r.y + r.h;
}
function paintSkip() { skipOn = skipSplash(); if (skipMark) skipMark.visible = !!skipOn; }
function toggleSkip() { skipOn = !skipOn; setSkipSplash(skipOn); paintSkip(); }
function buildSkip() {
  const r = skipRect();
  skipC = new Container(); skipC.position.set(r.x, r.y); skipC.alpha = 0;
  const box = new Graphics();
  const by = Math.max(0, (r.h - 22) / 2);
  box.roundRect(0, by, 22, 22, 4).fill({ color: 0x26140f, alpha: 0.55 }).stroke({ width: 2, color: 0xfbf3e4 });
  skipMark = new Graphics();
  skipMark.moveTo(5, by + 11).lineTo(9, by + 16).lineTo(17, by + 5).stroke({ width: 3, color: 0xf2b935, cap: 'round', join: 'round' });
  const lab = paintTx("Don't show this again", 'font_ink', Math.max(13, r.h * 0.34), r.w - 36, 'left')
    || new Text({ text: "Don't show this again", style: { fontFamily: FONT, fontSize: Math.max(13, r.h * 0.34), fill: 0xfbf3e4 } });
  if (lab.anchor) lab.anchor.set(0, 0.5); lab.position.set(32, r.h / 2);
  skipC.addChild(box, skipMark, lab); root.addChild(skipC); paintSkip();
}
const carLive = () => !!app && !G?.pc?.off && (state === 'loading' || state === 'tap') && !fading;
function inBand(q) { const { ch: h, cy } = G.pc; return q && Math.abs(q.y - cy) <= h / 2 + 8; }
function carDown(e) { if (!carLive() || (e.button ?? 0) !== 0) return; const q = toScreen(e); if (hitSkip(q)) return; if (!inBand(q)) return;
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
  const q = e && 'clientX' in e ? toScreen(e) : null;
  if (hitSkip(q)) { toggleSkip(); return true; }
  if (performance.now() < CAR.eatUntil) { CAR.eatUntil = 0; return true; }
  return !!(q && (e as any).detail !== 0 && inBand(q)); }
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
const shade = (a) => { const v = Math.round(255 * (1 - 0.35 * a)); return (v << 16) | (v << 8) | v; };   // leaf turns away from the vestibule light

// ---------------- game hand-off (DOM board / HUD + Pixi room layer) ----------------
const $id = (id) => document.getElementById(id);
// #alcove is display:contents, so its pieces move one by one
const BOARD = ['stage', 'alcoveAmbient', 'alcoveGlow', 'alcoveRecess', 'alcoveLedge', 'alcoveRail', 'alcoveCrown'];
function setEl(id, dy, a) { const e = $id(id); if (!e) return; e.style.translate = dy ? `0 ${dy.toFixed(1)}px` : ''; e.style.opacity = a >= 1 ? '' : a.toFixed(3); }
// Pixi HUD / logo / spin / buy live on #uiStage (a body-level canvas, not under #app).
function setUiChrome(dy, a) {
  setEl('hud', dy, a);
  const cv = $id('uiStage'); if (!cv) return;
  cv.style.opacity = a >= 1 ? '' : a.toFixed(3);
  cv.style.translate = dy ? `0 ${dy.toFixed(1)}px` : '';
}
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
  sceneHold(true); if (rig) { rig.doorway(true); rig.face('surprised', 0); }
  primed = true; setGame(0);
}
let sndLever = false, sndDoors = false;   // intro one-shots (AUDIO_WIRING_RUN3), re-armed when the clock rewinds
function setGame(tt) {   // all game objects driven from the intro clock (transform + opacity only)
  if (tt < T.doorL[0]) sndLever = sndDoors = false;
  if (!sndLever && tt >= T.doorL[0]) { sndLever = true; sfx('intro_door_lever'); }
  if (!sndDoors && tt >= T.doorR[0]) { sndDoors = true; sfx('intro_doors_open'); }
  const H = ST.h, dropH = H * 0.62;
  // board + Roxy drop in together: fall from above, land past the mark and spring back (outBack)
  const kd = seg(tt, ...T.drop), dropY = (1 - ease.outBack(kd, 1.9)) * -dropH, dA = tt >= T.drop[0] ? 1 : 0;   // H3: solid from the first frame (it enters from above the view), no half-alpha ghost
  for (const id of BOARD) setEl(id, dropY, dA);
  const kl = seg(tt, ...T.logo); setEl('top', -40 * (1 - ease.outBack(kl, 2)), seg(tt, T.logo[0], T.logo[0] + 0.1));
  const kh = seg(tt, ...T.hud, ease.outCubic); setUiChrome(80 * (1 - kh), kh);
  if (!rig) return;
  const v = rig.view;
  if (tt < T.drop[0]) {   // Roxy standing in the doorway as the doors swing open on their own (wink held in the gap), steps out as the camera pushes
    if (faceOff) { faceOff = false; sceneHold(true, true); rig.doorway(true); }
    rig.face('wink', tt > T.wink[0] + 0.12 && tt < T.wink[1] - 0.1 ? 1 : 0);
    const hScreen = G.dh * 0.8 * G.k * ST.s, s = hScreen / (rig.height || 1);
    const fx = (G.cx - G.dw * 0.12) * G.k, fy = (G.FL - 8) * G.k;
    const sx = ST.ox + fx * ST.s, sy = ST.oy + fy * ST.s;
    v.position.set(sx - rig.offsetX * s + 60 * s * seg(tt, ...T.roxyOut, ease.inCubic), sy); v.scale.set(s); v.alpha = 1 - seg(tt, ...T.roxyOut);
  } else if (tt < T.face[1]) {   // dropped in with the board on her rest pose, wide-eyed; the face eases back at T.face
    if (!faceOff) { faceOff = true; rig.doorway(false); rig.face('wink', 0); sceneHold(true, false); }
    rig.face('surprised', tt < T.face[0] ? 1 : 0);
    const m = lerp(0.94, 1, ease.outCubic(kd));
    v.scale.set(roxyAt.s * m); v.position.set(roxyAt.x, roxyAt.y + dropY); v.alpha = dA;
  } else release();
}
function release() { if (roxyFree || !rig) return; roxyFree = true; rig.face('surprised', 0); rig.release(); rig.idle(); rig.view.alpha = 1; sceneHold(false); }
function finish() {   // end state (also the skip)
  if (state === 'done') return; state = 'done';
  for (const id of [...BOARD, 'top', 'hud']) setEl(id, 0, 1); setUiChrome(0, 1);
  release();
  if (app) { app.ticker.stop(); const c = app.canvas; app.stage.removeChildren().forEach((o) => o.destroy({ children: true })); releaseIntroGpu(app); c?.remove?.(); app = null; /* never destroy a Pixi 8 renderer while others live (shared batch pool): resize to 1x1 frees the framebuffer instead */ }
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
  const { w: bw, h: bh } = G.bar; barFill.width = Math.max(bh - 14, (bw - 14) * prog) * 2;
  for (const q of flakes) { const f = q.f; f.y += dt * 60 * q.z; f.x += dt * (14 * Math.sin(t * 0.7 + q.ph) + 6) * q.z;
    if (f.y > G.DH + 10) { f.y = -10; f.x = Math.random() * G.DW; } if (f.x > G.DW + 10) f.x = -10; }
  carStep(); if (state !== 'trans') placeCards(t, 0);
  if (skipC) skipC.alpha = (state === 'loading' || state === 'tap') ? 1 : 0;
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
    const aL = seg(tt, ...T.doorL, ease.inOutSine), aR = seg(tt, ...T.doorR, ease.inOutSine); setDoors(aL, aR);
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
function size() { if (!app) return; const r = capResolution();
  app.renderer.resize(ST.w, ST.h, r); const c = app.canvas; c.style.width = ST.w + 'px'; c.style.height = ST.h + 'px'; }
function onResize() { if (!app || state === 'done') return; fitStage(); size(); build();
  if (state === 'trans') { skip(); return; } if (primed) prime(); update(0); }
/** Start the vestibule (loading state). Resolves false when WebGL / assets are unavailable (old DOM splash stays). */
export async function initIntro(progress: () => number): Promise<boolean> {
  progFn = progress;
  const L = $id('loader'); if (!L) return false;
  try {
    fitStage();
    const cv = document.createElement('canvas'); cv.id = 'introCv'; cv.setAttribute('aria-hidden', 'true'); L.before(cv); watchCanvas(cv, 'intro');
    const a = new Application();
    await a.init({ canvas: cv, width: ST.w, height: ST.h, resolution: capResolution(), autoDensity: false,
      backgroundAlpha: 0, antialias: true, preference: 'webgl', sharedTicker: false, hello: false, autoStart: false });
    app = a; size();
    await symArtReady;   // S / W_R2 are rebuilt from the symbols sheet (symrig.ts)
    // uifix: card art = exactly what the board renders: S / W_R2 baked from the current symbols sheet (symrig), the egw card a
    // rest-pose still of the board's WM2 rig (dbstacks)
    const cardTex = (c) => c.art.startsWith('rig:')
      ? dbStill(c.art.slice(4), a.renderer).then((cv) => (cv ? Texture.from(cv) : Texture.EMPTY))
      : loadTex(c.art.includes('/') ? c.art : (ARTG as Record<string, string | null>)[c.art] || '');
    const [title, ...cardT] = await Promise.all([loadTex(TITLE), ...CARDS.map(cardTex)]);
    tex.title = title;
    await Promise.all([...['intro', 'fx', 'ui', 'titles'].map(loadAtlas), loadFont('font_cran'), loadFont('font_ink')]);
    CARDS.forEach((c, i) => { tex['card_' + c.key] = cardT[i]; try { cardT[i].source.autoGenerateMipmaps = true; cardT[i].source.updateMipmaps(); } catch {} });
    try { title.source.autoGenerateMipmaps = true; title.source.updateMipmaps(); } catch {}
    if (killed || !$id('loader')) throw new Error('loader gone (error / skip) before the intro was up');
    a.stage.addChild(root); state = 'loading'; build(); update(0); a.render();
    a.ticker.add((tk) => { if (state !== 'done') update(Math.min(0.05, tk.deltaMS / 1000)); }); a.ticker.start();
    addEventListener('resize', onResize); visualViewport?.addEventListener('resize', onResize);
    addEventListener('keydown', onKey, { capture: true }); document.addEventListener('pointerdown', onDown, { capture: true });
    document.addEventListener('pointerdown', carDown, { capture: true }); addEventListener('pointermove', carMove, { capture: true, passive: false });
    addEventListener('pointerup', carUp, { capture: true }); addEventListener('pointercancel', carCancel, { capture: true });
    document.body.classList.add('introOn'); L.classList.add('pxOn');
    L.style.background = 'transparent';
    (window as any).__intro = { get state() { return state; }, get t() { return tt; }, T, skip, get card() { return carIndex(); }, get carPos() { return CAR.pos; },
      get skipOn() { return skipSplash(); }, toggleSkip,
      get skipBox() { const r = skipRect(); const b = app?.canvas?.getBoundingClientRect?.(); if (!b || !G) return null; return { x: b.left + (r.x + r.w / 2) / G.Ws * b.width, y: b.top + (r.y + r.h / 2) / G.Hs * b.height }; },
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
  prime(); state = 'tap'; tt = 0; if (t < 0.55) t = 0.55;
  if (app) { update(0); app.render(); }
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
/** Run a layout pass with intro drop styles lifted, then re-apply the current pose. */
export function introLayout(fn: () => void) {
  if (!primed || state === 'done' || state === 'off') { fn(); return; }
  for (const id of [...BOARD, 'top', 'hud']) setEl(id, 0, 1); setUiChrome(0, 1);
  try { fn(); } finally { setGame(state === 'trans' ? tt : 0); }
}
