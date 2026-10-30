// Approved board + HUD (James 2026-10-28: "the new board and symbols", the PixiJS mockup /workspace/elfhaus-mockup).
// Ported to the DOM: every rect comes from the mockup's own layout() (main.js), in its design units, mapped onto the stage
// with the mockup's world fit (k = min(W / D.w, H / D.h), centred). Three layouts, chosen like the game's stage:
//   land  (desktop / tablet landscape, D 1920 x 1080): board at (430,170) s1, BUY plate + autoplay / turbo left of it,
//         full-width HUD bar at the bottom (BALANCE | - BET + | WIN | SPIN), logo over the frame top, Roxy right.
//   port  (phones, D 1080 x DH): full-width board, [autoplay][turbo] .... [BUY BONUS] row, 2-row HUD bar + big SPIN.
//   cmp   (old phone landscape, D 1000 x 562; unused since v3.17: phones in landscape get 'land', stage.ts PHL_MAX_H).
// The frame (slim plum frame, recessed well, one rounded tile per cell, gold studs) and its pink neon edge are the
// mockup's frameTex / neonTex canvas code, drawn at device resolution on two canvases inside #frame.
// Game-only pieces the mockup never had: the menu button (top-left corner, same square style), the armed-mode tag
// (over SPIN), the free-spins bar (on the sill), and 48 px tap floors (controls grow when the mockup size is smaller).
import { ST } from './stage';
// Chrome floors border widths to whole device px, so a 2.9px stroke would draw at 2; round in screen space instead.
const bwPx = (w: number) => { const d = ST.s * (window.devicePixelRatio || 1); return (Math.max(1, Math.round(w * d)) + 0.01) / d + 'px'; };

export const CELL = 160, FT = 34, FB = 52, BW = 800, BH = 640, FW = BW + 2 * FT, FH = BH + FT + FB, M = 40;
/** portrait board scale for a frame ~95% of the 1080 design width */
const BS_W = 1026 / FW;
const NEON = '#ff4fc3';
type Btn = { x: number; y: number; s: number; ic: number };          // centre, size, icon scale (mockup design units)
type Field = { x: number; y: number; ls: number; vs: number; w: number };
export type MkGeo = {
	mode: 'land' | 'port' | 'cmp'; k: number; ox: number; oy: number; D: { w: number; h: number }; loose: boolean;
	bx: number; by: number; bs: number; bs0?: number; T: number; T0?: number; logo: { x: number; y: number; s: number };
	hud: { x: number; y: number; w: number; h: number; r: number }; fBal: Field; fBet: Field; fWin: Field;
	minus: Btn; plus: Btn; spin: Btn; auto: Btn; turbo: Btn; bonus: { v: 'v' | 'p'; x: number; y: number; s: number };
	cmp: { x: number; y: number; s: number };
};
export let G: MkGeo | null = null;

/** The mockup's layout() for the current stage (design units). */
export function mkGeo(): MkGeo {
	const W = ST.w, H = ST.h;
	// 48 screen px in design units for this layout's k (H2: tap targets never under 48 px)
	const t48 = (k: number) => (Math.ceil(48 / ST.s) + 2) / k;
	const fit = (D: { w: number; h: number }) => { const k = Math.min(W / D.w, H / D.h); return { k, ox: (W - D.w * k) / 2, oy: (H - D.h * k) / 2 }; };
	const cmp = { x: 800, y: 452, s: 0.64 };
	if (ST.portrait) {
		const DH = Math.max(1720, 1080 * H / W), D = { w: 1080, h: DH }, f = fit(D), tt = t48(f.k);
		const HB = 344, hudY = DH - HB - 18;
		const loose = DH >= 2100, kk = loose ? 1 : 0.86, GAPB = loose ? 44 : 22, RH = 176 * kk, ab = Math.max(160 * kk, tt);
		const rowY = hudY - GAPB - RH / 2, below = 2 * GAPB + RH;
		// bs0: the pre-v3.17 scale (top 690 reserved for the logo + Roxy; 0.92..1.28, so short phones got a ~74%-wide board).
		// v3.17 (James, iPhone on studio.engine.io): the board scales UNIFORMLY (same shape, square cells) to ~95% of the
		// width (frame 868 * BS_W = 1026 of 1080), its foot stays where it was (BUY row + HUD untouched), so it grows upward;
		// capped only so the logo on the frame top still clears the menu button (TOP_MIN).
		const bs0 = Math.max(0.92, Math.min(1.28, (hudY - below - 690) / (BH + FB)));
		const menuB = (12 + Math.max(144 * f.k, Math.ceil(48 / ST.s) + 2)) / f.k - f.oy / f.k;   // menu button bottom (design units)
		const TOP_MIN = menuB + 12 + 64 + 412 * 0.4 * 0.62;   // logo top under the menu; v3.17: logo always clear of the frame top (y = T - 64)
		const bs = Math.max(Math.min(bs0, BS_W), Math.min(BS_W, (hudY - below - TOP_MIN) / (BH + FB + FT)));
		const by = hudY - below - (BH + FB) * bs, bx = 540 - BW * bs / 2, T = by - FT * bs;
		const sb = (s: number) => Math.max(s, tt), t44 = (Math.ceil(44 / ST.s) + 2) / f.k;
		return { mode: 'port', ...f, D, loose, bx, by, bs, bs0, T, T0: hudY - below - (BH + FB + FT) * bs0,
			logo: { x: Math.max(272, 540 - BW * bs / 2 + 220), y: T - 64, s: 0.4 },
			hud: { x: 14, y: hudY, w: 1052, h: HB, r: 22 },
			fBal: { x: 14 + 40, y: hudY + 28, ls: 30, vs: 56, w: 400 }, fWin: { x: 14 + 470, y: hudY + 28, ls: 30, vs: 56, w: 300 },
			// v3.17 (James: the +/- were ~70 px squares): 126 design (~46 px on a 390-wide phone), floor 44 screen px for
			// touch; the bet row tightens around them: [-] left-aligned with BALANCE, BET between, [+] under WIN
			fBet: { x: 14 + 190, y: hudY + 204, ls: 30, vs: 56, w: 200 },
			minus: { x: 14 + 103, y: hudY + 250, s: Math.max(126, t44), ic: 2.3 }, plus: { x: 14 + 456 + Math.max(126, t44) / 2, y: hudY + 250, s: Math.max(126, t44), ic: 2.3 },
			spin: { x: 14 + 904, y: hudY + 172, s: sb(236), ic: 2.55 },
			auto: { x: 30 + ab / 2, y: rowY, s: ab, ic: 2.5 * kk }, turbo: { x: 30 + ab * 1.5 + 18 * kk, y: rowY, s: ab, ic: 2.5 * kk },
			bonus: { v: 'p', x: 1066 - 290 * kk, y: rowY, s: kk }, cmp };
	}
	if (ST.phl) {
		const D = { w: 1000, h: 562 }, f = fit(D), tt = t48(f.k), sb = (s: number) => Math.max(s, tt);
		const bs = 0.56, bx = 52, by = 58;
		const s0 = 0.64, bw = 216 * s0, bh = 240 * s0, ab = sb(64), gp = 12, top = 251 - (bh + gp + ab) / 2, pair = Math.max(bw, 2 * ab + 8);
		return { mode: 'cmp', ...f, D, loose: false, bx, by, bs, T: by - FT * bs,
			logo: { x: 52 + BW * bs / 2, y: 54, s: 0.17 }, hud: { x: 12, y: 458, w: 976, h: 96, r: 22 },
			fBal: { x: 12 + 30, y: 458 + 24, ls: 14, vs: 26, w: 300 }, fBet: { x: 12 + 420, y: 458 + 24, ls: 14, vs: 26, w: 70 },
			fWin: { x: 12 + 650, y: 458 + 24, ls: 14, vs: 26, w: 190 },
			minus: { x: 12 + 370, y: 458 + 48, s: sb(76), ic: 1.37 }, plus: { x: 12 + 536, y: 458 + 48, s: sb(76), ic: 1.37 },
			spin: { x: 12 + 912, y: 458 + 48, s: sb(90), ic: 0.98 },
			auto: { x: 606 - pair / 2 + ab / 2, y: top + bh + gp + ab / 2, s: ab, ic: 0.98 * ab / 64 },
			turbo: { x: 606 + pair / 2 - ab / 2, y: top + bh + gp + ab / 2, s: ab, ic: 0.98 * ab / 64 },
			bonus: { v: 'v', x: 606, y: top + bh / 2, s: s0 }, cmp };
	}
	const D = { w: 1920, h: 1080 }, f = fit(D), tt = t48(f.k), sb = (s: number) => Math.max(s, tt);
	// v3.17 phones in landscape (text boost / 48 px floor): the BUY plate grows a little so the boosted label fits it,
	// autoplay / turbo keep a gap between them, -/+ step out around the boosted BET value. Desktop (ph false) unchanged.
	const mb = sb(116), ph = ST.tb > 1.001 || mb > 116;
	const s0 = ph ? 1.2 : 1.05, bw = 216 * s0, bh = 240 * s0, ab = sb(106), gp = 18, top = 500 - (bh + gp + ab) / 2;
	const ax = Math.max(bw / 2 - ab / 2, (ab + gp) / 2);
	return { mode: 'land', ...f, D, loose: false, bx: 430, by: 170, bs: 1, T: 136,
		logo: { x: 430 + BW / 2, y: 150, s: 0.36 }, hud: { x: 40, y: 900, w: 1840, h: 168, r: 22 },
		fBal: { x: 40 + 60, y: 900 + 44, ls: 22, vs: 42, w: 520 }, fBet: { x: 40 + 780, y: 900 + 44, ls: 22, vs: 42, w: 120 * (ph ? ST.tb : 1) },
		fWin: { x: 40 + 1240, y: 900 + 44, ls: 22, vs: 42, w: 380 },
		minus: { x: 40 + (ph ? 780 - 14 - mb / 2 : 700), y: 900 + 84, s: mb, ic: 2.1 }, plus: { x: 40 + (ph ? 780 + 120 * ST.tb + 14 + mb / 2 : 964), y: 900 + 84, s: mb, ic: 2.1 },
		spin: { x: 40 + 1736, y: 900 + 84, s: sb(152), ic: 1.65 },
		auto: { x: 236 - ax, y: top + bh + gp + ab / 2, s: ab, ic: 1.62 }, turbo: { x: 236 + ax, y: top + bh + gp + ab / 2, s: ab, ic: 1.62 },
		bonus: { v: 'v', x: 236, y: top + bh / 2, s: s0 }, cmp };
}

// ---------------------------------------------------------------- DOM placement
const $ = (s: string) => document.querySelector(s) as HTMLElement;
function css(el: HTMLElement | null, o: Record<string, string | number>) {
	if (!el) return;
	for (const [k, v] of Object.entries(o)) el.style.setProperty(k, typeof v === 'number' ? v.toFixed(2) + 'px' : v, 'important');
}
/** Board cell (stage px, whole px for the strip engine) for this layout. */
export function mkCell() { G = mkGeo(); return Math.max(1, Math.floor(CELL * G.bs * G.k)); }

/** Lay the board, logo, HUD bar, controls and BUY plate out (stage px). cell = the integer cell layoutRaw applied. */
export function mkPlace(cell: number) {
	const g = G || mkGeo(); G = g;
	const X = (x: number) => g.ox + x * g.k, Y = (y: number) => g.oy + y * g.k, L = (v: number) => v * g.k;
	const r = document.documentElement.style;
	// board: whole-px cells; the frame keeps the mockup proportions around them, centred where the mockup puts it
	const u = cell / CELL, fw = FW * u, fh = FH * u;
	const cx = X(g.bx + BW * g.bs / 2), fy = Y(g.by - FT * g.bs) + (L((FH) * g.bs) - fh) / 2;
	const fx = cx - fw / 2;
	r.setProperty('--mku', u.toFixed(4)); r.setProperty('--mkk', g.k.toFixed(4));
	css($('#stage'), { position: 'absolute', left: fx, top: fy, width: fw, height: fh, display: 'block', padding: '0', margin: '0', 'min-height': '0' });
	css($('#frame'), { position: 'absolute', left: 0, top: 0, width: fw, height: fh, padding: '0', margin: '0', border: '0', 'border-radius': (30 * u) + 'px' });
	css($('#board'), { position: 'absolute', left: FT * u, top: FT * u, width: cell * 5, height: cell * 4, margin: '0' });
	drawFrame(u);
	// logo (anchor 0.5 / 0.62 of the 1200 x 412 stone logo)
	const lw = L(1200 * g.logo.s), lh = L(412 * g.logo.s);
	css($('#top'), { position: 'absolute', left: X(g.logo.x) - lw / 2, top: Y(g.logo.y) - lh * 0.62, width: lw, height: lh, padding: '0', margin: '0', display: 'block' });
	// HUD bar: #hud is the bar; everything in it is placed relative to the bar
	const h = g.hud, hx = X(h.x), hy = Y(h.y);
	css($('#hud'), { position: 'absolute', left: hx, top: hy, width: L(h.w), height: L(h.h), 'max-width': 'none', margin: '0', padding: '0', 'border-radius': L(h.r) + 'px' });
	const rel = (x: number, y: number) => ({ x: X(x) - hx, y: Y(y) - hy });
	const btn = (sel: string, b: Btn) => {
		const s = L(b.s), p = rel(b.x, b.y), e = $(sel);
		css(e, { position: 'absolute', left: p.x - s / 2, top: p.y - s / 2, width: s, height: s, margin: '0', padding: '0', 'border-radius': (s * 0.28) + 'px',
			'border-width': bwPx(Math.max(2, b.s / 40) * g.k), '--icS': String(L(b.ic)), '--bh': s + 'px' });
		return { x: hx + p.x - s / 2, y: hy + p.y - s / 2, s };
	};
	// field positions in the HUD (absolute world coords in the geo -> bar-relative)
	const fld = (sel: string, f: Field) => { const p = rel(f.x, f.y); css($(sel), { position: 'absolute', left: p.x, top: p.y, width: L(f.w), margin: '0', padding: '0',
		'--ls': Math.max(L(f.ls), 12 / ST.s) + 'px', '--vs': Math.max(L(f.vs), 14 / ST.s) + 'px' }); };   // audit text floor: >= 12 screen px
	fld('#strip .m:nth-child(1)', g.fBal); fld('#strip .m:nth-child(2)', g.fBet); fld('#strip .m:nth-child(3)', g.fWin);
	btn('#betDown', g.minus); btn('#betUp', g.plus);
	const sp = btn('#spinBtn', g.spin);
	btn('#autoBtn', g.auto); btn('#turboBtn', g.turbo);
	// BUY plate (mockup paintBonus 'v' = tall, 'p' = wide portrait row)
	const bv = g.bonus.v, bw0 = bv === 'p' ? 580 : 216, bh0 = bv === 'p' ? 176 : 240, ps = L(g.bonus.s);
	const bp = rel(g.bonus.x, g.bonus.y), b = $('#buyBtn');
	b.classList.remove('side'); b.classList.toggle('mkP', bv === 'p'); b.classList.toggle('mkV', bv !== 'p');
	const pr = { position: 'absolute', left: bp.x - bw0 * ps / 2, top: bp.y - bh0 * ps / 2, width: bw0 * ps, height: bh0 * ps, margin: '0', 'border-radius': (bv === 'p' ? 48 : 44) * ps + 'px' };
	const pf = Math.max((bv === 'p' ? 50 : 25) * ps, 12 / ST.s);
	css(b, { ...pr, padding: '0', '--ps': ps + '', '--pf': pf + 'px', '--pl': (bv === 'p' ? 4 : 3) * ps * Math.min(1, (bv === 'p' ? 50 : 25) * ps / pf) + 'px', '--pw': bw0 * ps + 'px', '--ph': bh0 * ps + 'px', '--pS': Math.max(bw0, bh0) * 1.3 * ps + 'px' });
	// the neon halo breathes on its own layer (opacity only), under the plate
	let gl = document.getElementById('mkBuyGlow');
	if (!gl) { gl = document.createElement('div'); gl.id = 'mkBuyGlow'; gl.setAttribute('aria-hidden', 'true'); $('#hud').insertBefore(gl, $('#hud').firstChild); }
	css(gl, { ...pr, '--ps': ps + '' });
	// menu (game-only): the same square button, top-left corner of the stage
	const ms = Math.max(L(g.mode === 'port' ? 144 : g.mode === 'cmp' ? 64 : 88), Math.ceil(48 / ST.s) + 2), m0 = g.mode === 'port' ? 12 : 16;
	css($('#menuBtn'), { position: 'absolute', left: m0 - hx, top: m0 - hy, width: ms, height: ms, margin: '0', padding: '0', 'border-radius': (ms * 0.28) + 'px', 'border-width': bwPx(Math.max(2, ms / g.k / 40) * g.k), '--icS': String(ms * 0.0155) });
	r.setProperty('--mkMenuR', (m0 + ms) + 'px'); r.setProperty('--mkMenuY', (m0 + ms / 2) + 'px');
	// armed-mode tag: a compact gold chip (>= 48 screen px tall to tap off). Landscape: just over SPIN; portrait: straddling the
	// frame's sill above the BUY plate (the gap under the BUY row is too thin for it without covering SPIN)
	const tag = $('#armTag'), tf = Math.max(L(g.mode === 'cmp' ? 16 : 24), 12 / ST.s);
	const tagBase = { position: 'absolute', bottom: 'auto', right: 'auto', width: 'auto', 'min-width': '0', 'max-width': 'none', margin: '0', 'font-size': tf + 'px',
		'min-height': (Math.ceil(48 / ST.s) + 1) + 'px', height: 'auto', padding: '0 ' + tf * 0.8 + 'px', 'grid-area': 'auto' };
	if (g.mode === 'port') css(tag, { ...tagBase, left: bp.x, top: fy + fh - hy, translate: '-50% -50%' });
	else if (g.mode === 'land' && ST.tb > 1.001) {
		// v3.17 phones in landscape: over SPIN the boosted chip covered Roxy's feet; it sits in the free space under the
		// autoplay / turbo pair instead (left column, clear of the board and Roxy)
		const ab = Math.max(L(g.auto.s), 1), colB = Y(g.auto.y) + ab / 2, hudT = Y(g.hud.y);
		const cw = L(2 * (Math.abs(g.turbo.x - g.auto.x) / 2 + g.auto.s / 2));   // autoplay..turbo width: two lines if needed
		css(tag, { ...tagBase, left: X(g.bonus.x) - hx, top: (colB + hudT) / 2 - hy, translate: '-50% -50%', 'max-width': cw + 'px', 'white-space': 'normal', 'text-align': 'center', 'line-height': '1.1' });
	}
	else css(tag, { ...tagBase, left: sp.x + sp.s / 2 - hx, top: sp.y - 8 - hy, translate: '-50% -100%' });
	// free-spins bar on the frame's sill, banner over the top row, step toast at the board's foot
	css($('#fsBar'), { position: 'absolute', left: '50%', top: (fh - FB * u / 2) + 'px', translate: '-50% -50%', margin: '0', 'z-index': '6' });
	css($('#banner'), { position: 'absolute', left: '50%', top: (FT * u + cell * 0.12) + 'px', translate: '-50% 0', transform: 'none', margin: '0' });
	css($('#stepToast'), { position: 'absolute', left: '50%', top: (FT * u + cell * 4 - 8) + 'px', translate: '-50% -100%', margin: '0', 'z-index': '7' });
	return { fx, fy, fw, fh };
}

// ---------------------------------------------------------------- frame + neon (mockup frameTex / neonTex)
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function canvasIn(id: string, before: boolean) {
	let c = document.getElementById(id) as HTMLCanvasElement | null;
	if (!c) { c = document.createElement('canvas'); c.id = id; c.setAttribute('aria-hidden', 'true'); const f = $('#frame'); if (before) f.insertBefore(c, f.firstChild); else f.appendChild(c); }
	return c;
}
let drawn = '';
function drawFrame(u: number) {
	const dpr = Math.min(2, (window.devicePixelRatio || 1) * ST.s), key = `${u.toFixed(4)}|${dpr.toFixed(3)}`;
	const fc = canvasIn('mkFrame', true), nc = canvasIn('mkNeon', false);
	const cw = (FW + 2 * M) * u, ch = (FH + 2 * M) * u;
	for (const c of [fc, nc]) css(c, { position: 'absolute', left: -M * u, top: -M * u, width: cw, height: ch });
	if (drawn === key) return; drawn = key;
	const sc = u * dpr;
	for (const c of [fc, nc]) { c.width = Math.ceil(cw * dpr); c.height = Math.ceil(ch * dpr); }
	let g = fc.getContext('2d')!; g.setTransform(sc, 0, 0, sc, M * sc, M * sc);
	g.save(); g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowBlur = 40 * sc; g.shadowOffsetY = 14 * sc; rr(g, 0, 0, FW, FH, 30); g.fillStyle = '#140c1d'; g.fill(); g.restore();
	let gr = g.createLinearGradient(0, 0, 0, FH); gr.addColorStop(0, '#3b2c4c'); gr.addColorStop(0.18, '#251a33'); gr.addColorStop(0.8, '#1a1124'); gr.addColorStop(1, '#0e0914');
	rr(g, 0, 0, FW, FH, 30); g.fillStyle = gr; g.fill();
	gr = g.createLinearGradient(0, 0, FW, FH); gr.addColorStop(0, 'rgba(255,240,255,0.10)'); gr.addColorStop(0.5, 'rgba(255,240,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)');
	rr(g, 0, 0, FW, FH, 30); g.fillStyle = gr; g.fill();
	gr = g.createLinearGradient(0, 0, 0, FH); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.06)'); gr.addColorStop(1, 'rgba(0,0,0,0.6)');
	rr(g, 1.5, 1.5, FW - 3, FH - 3, 29); g.lineWidth = 3; g.strokeStyle = gr; g.stroke();
	gr = g.createLinearGradient(0, FT + BH + 6, 0, FH); gr.addColorStop(0, '#4a3860'); gr.addColorStop(0.12, '#2a1d38'); gr.addColorStop(1, '#120b19');
	g.fillStyle = gr; g.fillRect(14, FT + BH + 6, FW - 28, FB - 18);
	g.save(); rr(g, FT - 6, FT - 6, BW + 12, BH + 12, 18); g.fillStyle = '#05030a'; g.fill();
	g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 16 * sc; rr(g, FT - 6, FT - 6, BW + 12, BH + 12, 18); g.lineWidth = 5; g.strokeStyle = '#020104'; g.stroke(); g.restore();
	for (let i = 0; i < 5; i++) for (let r = 0; r < 4; r++) {
		const x = FT + i * CELL + 4, y = FT + r * CELL + 4;
		gr = g.createLinearGradient(0, y, 0, y + CELL - 8); gr.addColorStop(0, '#1e1430'); gr.addColorStop(1, '#120b1d');
		rr(g, x, y, CELL - 8, CELL - 8, 14); g.fillStyle = gr; g.fill();
		rr(g, x + 0.5, y + 0.5, CELL - 9, CELL - 9, 14); g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,0.05)'; g.stroke();
	}
	const stud = (x: number, y: number) => { g.save(); g.translate(x, y); g.rotate(Math.PI / 4); const s = 5, sg = g.createLinearGradient(-s, -s, s, s);
		sg.addColorStop(0, '#d9cfe6'); sg.addColorStop(1, '#4a3d58'); g.fillStyle = sg; g.fillRect(-s, -s, 2 * s, 2 * s); g.restore(); };
	[[17, 17], [FW - 17, 17], [17, FH - 22], [FW - 17, FH - 22], [FW / 2 - 140, FH - 22], [FW / 2 + 140, FH - 22]].forEach(([x, y]) => stud(x, y));
	g = nc.getContext('2d')!; g.setTransform(sc, 0, 0, sc, M * sc, M * sc); const t = 17;
	for (const [w, a, b] of [[10, 0.35, 26], [5, 0.7, 12]]) { g.save(); g.shadowColor = NEON; g.shadowBlur = b * sc; rr(g, t, t, FW - 2 * t, FH - 2 * t - 6, 22);
		g.lineWidth = w; g.strokeStyle = `rgba(255,79,195,${a})`; g.stroke(); g.restore(); }
	rr(g, t, t, FW - 2 * t, FH - 2 * t - 6, 22); g.lineWidth = 1.6; g.strokeStyle = 'rgba(255,235,250,0.95)'; g.stroke();
}
