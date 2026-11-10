// Board, HUD and chrome placement. Positions come from the single layout pass (layout.ts)
// in design units with k = 1 (no inner mockup fit, no snapGeo, no 48-screen-px floors).
// Frame paint (drawFrame) still lives here: timber band, gold trim, pine panel, snow caps, garland.
import { syncHostLayout } from './uihosts';
import { ST } from './stage';
import { getLayout, layoutPass, CELL, FT, FB, BW, BH, FW, FH, M, type Btn, type Field } from './layout';
import { setLip, setFrameBack, relayoutBoard } from './board/stage';
import ART_G from './art.generated.json';
export { CELL, FT, FB, BW, BH, FW, FH, M };
// Chrome floors border widths to whole device px, so a 2.9px stroke would draw at 2; round in screen space instead.
const BUY_K = 0.78;
const bwPx = (w: number) => { const d = ST.s * (window.devicePixelRatio || 1); return (Math.max(1, Math.round(w * d)) + 0.01) / d + 'px'; };

export type MkGeo = {
	mode: 'land' | 'port' | 'cmp'; k: number; ox: number; oy: number; D: { w: number; h: number }; loose: boolean;
	bx: number; by: number; bs: number; bs0?: number; T: number; T0?: number; logo: { x: number; y: number; s: number };
	hud: { x: number; y: number; w: number; h: number; r: number }; fBal: Field; fBet: Field; fWin: Field;
	minus: Btn; plus: Btn; spin: Btn; auto: Btn; turbo: Btn; bonus: { v: 'v' | 'p'; x: number; y: number; s: number };
	cmp: { x: number; y: number; s: number };
};
export let G: MkGeo | null = null;
export function resetGeo() { G = null; }

/** Chrome in stage design units from the single layout pass (k = 1, no second fit, no snapGeo). */
export function mkGeo(): MkGeo {
	let L = getLayout();
	if (!L) L = layoutPass(ST.vw || ST.w, ST.vh || ST.h, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, { compact: ST.compact });
	return {
		mode: L.portrait ? 'port' : 'land',
		k: 1, ox: 0, oy: 0,
		D: { w: L.W, h: L.H },
		loose: L.kind === 'phonePort',
		bx: L.board.x, by: L.board.y, bs: L.board.bs, T: L.board.T,
		logo: { x: L.logo.x, y: L.logo.y, s: L.logo.s },
		hud: { ...L.hud },
		fBal: { ...L.fBal }, fBet: { ...L.fBet }, fWin: { ...L.fWin },
		minus: { ...L.minus }, plus: { ...L.plus },
		spin: { ...L.spin }, auto: { ...L.auto }, turbo: { ...L.turbo },
		bonus: { ...L.buy },
		cmp: { x: 0, y: 0, s: 1 },
	};
}

/** Board cell (stage px, whole px for the strip engine) for this layout. */
export function mkCell() { G = mkGeo(); return Math.max(1, Math.floor(CELL * G.bs * G.k)); }

// ---------------------------------------------------------------- DOM placement
const $ = (s: string) => document.querySelector(s) as HTMLElement;
function css(el: HTMLElement | null, o: Record<string, string | number>) {
	if (!el) return;
	for (const [k, v] of Object.entries(o)) el.style.setProperty(k, typeof v === 'number' ? v.toFixed(2) + 'px' : v, 'important');
}
/** Size the armed-mode pill to its full title (9-slice sprite follows the box). Abbreviates only when the
 *  full name would still collide with SPIN after the pill has used all of the available gap. */
export function fitArmTag() {
	const tag = document.getElementById('armTag'), t = tag?.querySelector('.t') as HTMLElement | null;
	if (!tag || !t || tag.classList.contains('hidden')) return;
	const full = tag.dataset.full || t.textContent || '', short = tag.dataset.short || full;
	const max = parseFloat(tag.style.maxWidth || '') || tag.clientWidth || 0;
	tag.style.width = 'auto';
	t.textContent = full;
	const need = Math.ceil(tag.scrollWidth);
	if (max && need > max + 1) {
		t.textContent = short;
		const shortNeed = Math.ceil(tag.scrollWidth);
		if (max && shortNeed > max + 1) tag.style.width = max + 'px';
		else tag.style.width = shortNeed + 'px';
		return;
	}
	tag.style.width = need + 'px';
}

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
	for (const id of ['strips', 'cells', 'overlays', 'reelLines']) css($('#' + id), { position: 'absolute', left: 0, top: 0, width: cell * 5, height: cell * 4, margin: '0', padding: '0' });
	drawFrame(u);
	// logo (anchor 0.5 / 0.62 of the 1200 x 412 stone logo)
	const lw = L(1200 * g.logo.s), lh = L(412 * g.logo.s);
	css($('#top'), { position: 'absolute', left: X(g.logo.x) - lw / 2, top: Y(g.logo.y) - lh * 0.62, width: lw, height: lh, padding: '0', margin: '0', display: 'block' });
	// HUD bar: #hud is the bar; everything in it is placed relative to the bar
	const h = g.hud, hx = X(h.x), hy = Y(h.y);
	css($('#hud'), { position: 'absolute', left: hx, top: hy, width: L(h.w), height: L(h.h), 'max-width': 'none', margin: '0', padding: '0', 'border-radius': L(h.r) + 'px' });
	const rel = (x: number, y: number) => ({ x: X(x) - hx, y: Y(y) - hy });
	// vk / ik: visual size and glyph scale inside the layout slot (v3.17, James 03:08: the bet -/+ draw at 0.82 of their slot,
	// about 38 px on phones, glyph smaller still; the tap area is padded invisibly back to >= 44 screen px via ::after --hitPad)
	const btn = (sel: string, b: Btn, vk = 1, ik = 1) => {
		const s = L(b.s) * vk, p = rel(b.x, b.y), e = $(sel);
		css(e, { position: 'absolute', left: p.x - s / 2, top: p.y - s / 2, width: s, height: s, margin: '0', padding: '0', 'border-radius': (s * 0.28) + 'px',
			'border-width': bwPx(Math.max(2, b.s * vk / 40) * g.k), '--icS': String(L(b.ic) * vk * ik), '--bh': s + 'px',
			'--hitPad': Math.max(0, (Math.ceil(Math.min(44, ST.tap) / ST.s) - s) / 2) + 'px' });
		return { x: hx + p.x - s / 2, y: hy + p.y - s / 2, s };
	};
	// field positions in the HUD (absolute world coords in the geo -> bar-relative)
	const fld = (sel: string, f: Field) => { const p = rel(f.x, f.y); css($(sel), { position: 'absolute', left: p.x, top: p.y, width: L(f.w), margin: '0', padding: '0',
		'--ls': Math.max(L(f.ls), (ST.compact ? 9 : 12) / ST.s) + 'px', '--vs': Math.max(L(f.vs), (ST.compact ? 11 : 14) / ST.s) + 'px' }); };   // audit text floor: >= 12 screen px (v21 compact: 9 / 11)
	fld('#strip .m:nth-child(1)', g.fBal); fld('#strip .m:nth-child(2)', g.fBet); fld('#strip .m:nth-child(3)', g.fWin);
	btn('#betDown', g.minus, BET_VK, 0.88); btn('#betUp', g.plus, BET_VK, 0.88);
	const sp = btn('#spinBtn', g.spin);
	btn('#autoBtn', g.auto); btn('#turboBtn', g.turbo);
	// BUY plate (mockup paintBonus 'v' = tall, 'p' = wide portrait row)
	const bv = g.bonus.v, bw0 = bv === 'p' ? 580 : 216, bh0 = bv === 'p' ? 176 : 240, ps = L(g.bonus.s) * (bv === 'p' ? BUY_K : 0.92);   // fix2: portrait plate shrunk about its centre (landscape lightly) to sit in proportion with turbo / auto
	const bp = rel(g.bonus.x, g.bonus.y), b = $('#buyBtn');
	b.classList.remove('side'); b.classList.toggle('mkP', bv === 'p'); b.classList.toggle('mkV', bv !== 'p');
	const pr = { position: 'absolute', left: bp.x - bw0 * ps / 2, top: bp.y - bh0 * ps / 2, width: bw0 * ps, height: bh0 * ps, margin: '0', 'border-radius': (bv === 'p' ? 48 : 44) * ps + 'px' };
	const pf = Math.max((bv === 'p' ? 50 : 25) * ps, (ST.compact ? 7 : 12) / ST.s);   // v21: compact popouts let the label shrink so it fits the plate
	css(b, { ...pr, padding: '0', '--ps': ps + '', '--pf': pf + 'px', '--pl': (bv === 'p' ? 4 : 3) * ps * Math.min(1, (bv === 'p' ? 50 : 25) * ps / pf) + 'px', '--pw': bw0 * ps + 'px', '--ph': bh0 * ps + 'px', '--pS': Math.max(bw0, bh0) * 1.3 * ps + 'px' });
	// the neon halo breathes on its own layer (opacity only), under the plate
	// Pixi HUD paints the buy plate; do not insert a DOM glow into the layout shell.
	void pr;
	// menu (game-only): the same square button, top-left corner of the stage
	const lay = getLayout();
	const ms = lay ? lay.menu.s : L(g.mode === 'port' ? 144 : 88);
	const m0x = lay ? lay.menu.x - ms / 2 : (g.mode === 'port' ? 12 : 16);
	const m0y = lay ? lay.menu.y - ms / 2 : m0x;
	css($('#menuBtn'), { position: 'absolute', left: m0x - hx, top: m0y - hy, width: ms, height: ms, margin: '0', padding: '0', 'border-radius': (ms * 0.28) + 'px', 'border-width': bwPx(Math.max(2, ms / 40)), '--icS': String(ms * 0.0155) });
	r.setProperty('--mkMenuR', (m0x + ms) + 'px'); r.setProperty('--mkMenuY', (m0y + ms / 2) + 'px');
	// armed-mode tag (v3.17, James 02:32): the ONLY armed indicator. A slim single-line pill (about 22 screen px tall on phones,
	// 36 design px on desktop) with the mode name and a small x, right next to SPIN: inside the HUD bar, right-aligned to
	// SPIN's left edge, on the WIN label's row (landscape/desktop) or on the bet row right of [+] (portrait). Its tap target is padded invisibly to 44 px
	// (::after, board.css). fitArmTag() abbreviates the name (e.g. EGW) when the full one doesn't fit.
	const tag = $('#armTag'), wl = rel(g.fWin.x, g.fWin.y), lsz = Math.max(L(g.fWin.ls), 12 / ST.s);
	const hP = Math.max(L(36), 22 / ST.s), tf = Math.max(L(16), 10.5 / ST.s), right = sp.x - hx - Math.max(L(14), 6 / ST.s);
	// portrait: the WIN label row is too thin for the pill, so it sits on the bet row instead, in the empty gap between [+]
	// and SPIN (vertically centred on [+]); it can never touch the WIN value however long that gets
	const pl = g.mode === 'port' ? rel(g.plus.x + g.plus.s / 2, g.plus.y) : null;
	const left0 = pl ? pl.x : wl.x + lsz * 1.6;
	const maxW = Math.max(hP * 2.4, right - (left0 + Math.max(L(8), 4 / ST.s)));
	const cy = pl ? pl.y : Math.max(hP / 2 + Math.max(L(6), 3 / ST.s), wl.y + lsz * 0.6);
	// Use as much of the gap toward SPIN as we can so the full title ("WILD WINTER SPINS") fits the 9-sliced pill.
	const padX = Math.max(tf * 0.7, 8 / ST.s);
	css(tag, { position: 'absolute', left: 'auto', right: (L(h.w) - right) + 'px', top: cy + 'px', bottom: 'auto',
		translate: '0 -50%', width: 'auto', 'min-width': hP + 'px', 'max-width': maxW + 'px', 'min-height': '0', height: hP + 'px', margin: '0',
		padding: '0 ' + padX + 'px', 'font-size': tf + 'px', 'line-height': '1', 'letter-spacing': '0.04em', 'white-space': 'nowrap', overflow: 'visible',
		'display': 'flex', gap: tf * 0.4 + 'px', 'border-radius': hP / 2 + 'px', 'border-width': bwPx(Math.max(1, 1.2 / ST.s)), 'grid-area': 'auto', 'align-items': 'center', 'justify-content': 'center',
		'--tagPad': Math.max(0, (Math.ceil(Math.min(44, ST.tap) / ST.s) - hP) / 2) + 'px', '--tagMax': maxW + 'px' });
	fitArmTag();
	syncHostLayout();
	relayoutBoard();
	// free-spins bar on the frame's sill, banner over the top row, step toast at the board's foot
	css($('#fsBar'), { position: 'absolute', left: '50%', top: (fh - FB * u / 2) + 'px', translate: '-50% -50%', margin: '0', 'z-index': '6' });
	css($('#banner'), { position: 'absolute', left: '50%', top: (FT * u + cell * 0.12) + 'px', translate: '-50% 0', transform: 'none', margin: '0' });
	css($('#stepToast'), { position: 'absolute', left: '50%', top: (FT * u + cell * 4 - 8) + 'px', translate: '-50% -100%', margin: '0', 'z-index': '7' });
	return { fx, fy, fw, fh };
}

// ---------------------------------------------------------------- chalet frame
// The board's layers are sprite parts baked once into assets/board/boardfx.webp (scripts/gen-board-sprites.mjs); no
// shape, gradient or shadow is drawn by code here, the parts are only placed. Back to front, each casting depth on the
// one behind it (one warm key light, the fire, upper left):
//   0 frame_shadow9  the frame's drop shadow onto the room
//   1 board9  the pine board (see-through, PANEL_A)        2 shade9  the frame + trim's soft shadow cast inward on it
//   3 slot x20  each raised tile's drop shadow + contact AO  4 frame  timber band, chamfered lip (lit right / bottom),
//   sill, rivets, snow caps                                5 trim9  the raised gold rail with its contact shadow
// then the DOM tiles (their lit rim is the `rim` part, chalet.css) and the symbols in front. All parts are drawn into ONE
// canvas (#mkFrame) inside #frame, so board, frame and trim stay locked together; none of them needs to move on its own.
type Fr = { x: number; y: number; w: number; h: number };
type BoardFx = { frames: Record<string, { frame: Fr }>; meta: { scale: string; board: { nb: number; slotPad: number; frameTop: number; frameBot: number; slice9: Record<string, number> } } };
let fxImg: HTMLImageElement | null = null, fxJson: BoardFx | null = null, fxLoading = false;
// ART-3 / ART-7: the approved no-tile board, deep burgundy with subtle snowflakes (art_v3 board_base + board_snow, cropped 5:4)
let bgImg: HTMLImageElement | null = null, snowImg: HTMLImageElement | null = null;
function loadBoardFx(redraw: () => void) {
	if (fxLoading) return; fxLoading = true;
	const im = new Image(); im.decoding = 'async'; im.src = 'assets/board/boardfx.webp';
	const bi = new Image(), si = new Image(); bi.src = 'assets/board/board_burgundy.webp'; si.src = 'assets/board/board_snow.webp';
	Promise.all([im.decode(), fetch('assets/board/boardfx.json').then((r) => r.json() as Promise<BoardFx>), bi.decode(), si.decode()])
		.then(([, j]) => { fxImg = im; fxJson = j; bgImg = bi; snowImg = si; redraw(); }).catch(() => { fxLoading = false; });
}
function canvasIn(id: string, before: boolean) {
	let c = document.getElementById(id) as HTMLCanvasElement | null;
	if (!c) { c = document.createElement('canvas'); c.id = id; c.setAttribute('aria-hidden', 'true'); const f = $('#frame'); if (before) f.insertBefore(c, f.firstChild); else f.appendChild(c); }
	return c;
}
const BET_VK = 0.92;
let drawn = '';
function drawFrame(u: number) {
	// The board is see-through (PANEL_A) so the room / Roxy read faintly behind the reels; frame and sill are solid.
	const PANEL_A = document.body.classList.contains('phone') ? 0.78 : 0.77;   // 75-80%: Roxy / the room read faintly through
	const dpr = Math.min(2, (window.devicePixelRatio || 1) * ST.s), key = `${u.toFixed(4)}|${dpr.toFixed(3)}|${PANEL_A}`;
	const fc = canvasIn('mkFrame', true);
	document.getElementById('mkNeon')?.remove();
	const cw = (FW + 2 * M) * u, ch = (FH + 2 * M) * u;
	css(fc, { position: 'absolute', left: -M * u, top: -M * u, width: cw, height: ch });
	garland(u);
	if (!fxImg || !fxJson) { loadBoardFx(() => { drawn = ''; drawFrame(u); }); return; }
	if (drawn === key) return; drawn = key;
	const sc = u * dpr;
	fc.width = Math.ceil(cw * dpr); fc.height = Math.ceil(ch * dpr);
	let g = fc.getContext('2d')!; g.setTransform(sc, 0, 0, sc, M * sc, M * sc); g.imageSmoothingQuality = 'high';
	const F = fxJson.frames, B = fxJson.meta.board, S = +fxJson.meta.scale || 2, im = fxImg;
	const part = (k: string, x: number, y: number, w?: number, h?: number) => { const f = F[k].frame; g.drawImage(im, f.x, f.y, f.w, f.h, x, y, w ?? f.w / S, h ?? f.h / S); };
	// 9-slice: corners at 1:1 (design px), edges stretched along their length, centre stretched
	const nine = (k: string, x: number, y: number, w: number, h: number) => {
		// pieces meet on whole device px (no hairline seams between them)
		const f = F[k].frame, d = B.slice9[k], s = d * S, mw = f.w - 2 * s, mh = f.h - 2 * s, D = (v: number) => Math.round((v + M) * sc);
		const xs = [[0, s, x, x + d], [s, mw, x + d, x + w - d], [s + mw, s, x + w - d, x + w]], ys = [[0, s, y, y + d], [s, mh, y + d, y + h - d], [s + mh, s, y + h - d, y + h]];
		g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
		for (const [sx, sw, a0, a1] of xs) for (const [sy, sh, b0, b1] of ys) g.drawImage(im, f.x + sx, f.y + sy, sw, sh, D(a0), D(b0), D(a1) - D(a0), D(b1) - D(b0));
		g.restore();
	};
	// 0 the frame's drop shadow onto the room (its own part, under everything)
	nine('frame_shadow9', 0, 10, FW, FH);
	// 1 the board, under the window (a 9-slice of the window-sized source: same corners, the window is BW x BH at FT)
	g.save(); g.globalAlpha = PANEL_A;
	if (!bgImg) nine('board9', 0, 0, FW, BH + 2 * FT);
	if (bgImg) g.drawImage(bgImg, FT - 6, FT - 6, BW + 12, BH + 12);
	if (snowImg) g.drawImage(snowImg, FT - 6, FT - 6, BW + 12, BH + 12);
	g.restore();
	// 2 the frame + trim's shadow on the board   3 the tile slots' drop shadows + AO
	nine('shade9', 0, 0, FW, BH + 2 * FT);
	// ART-7: no tiles, so no tile-slot shadows; symbols carry their own contact shadows (symdepth sprites)
	// 4 the timber frame (its window is punched in the sprite)   5 the gold trim over the seam
	part('frame', 0, -B.frameTop);
	nine('trim9', 0, 0, FW, BH + 2 * FT);
	// fix7 frame-front lip (board/stage.ts layer `lip`): the timber frame + gold trim drawn again, above the symbols and
	// their FX in the board stage, so oversize art (a wild's bust, a swell, a flake) tucks behind the frame
	const lc = document.createElement('canvas'); lc.width = fc.width; lc.height = fc.height;
	const lg = lc.getContext('2d')!; lg.setTransform(sc, 0, 0, sc, M * sc, M * sc); lg.imageSmoothingQuality = 'high';
	// FSD LOW: only the front (bottom) rail is redrawn as the lip, from just above the window's bottom edge down: the full
	// frame drawn again over #mkFrame doubled its edges' shading (darker sides / top)
	lg.beginPath(); lg.rect(-M, FT + BH - 6, FW + 2 * M, FH + M - (FT + BH - 6)); lg.clip();
	const g0 = g; g = lg; part('frame', 0, -B.frameTop); nine('trim9', 0, 0, FW, BH + 2 * FT); g = g0;
	setLip(lc, -M * u, -M * u, cw, ch);
	// fix8: the frame back is drawn by the board stage too (a copy: the DOM #mkFrame is hidden under body.pixiBoard)
	const bc = document.createElement('canvas'); bc.width = fc.width; bc.height = fc.height; bc.getContext('2d')!.drawImage(fc, 0, 0);
	setFrameBack(bc, -M * u, -M * u, cw, ch);
}
/** Painted garland across the frame top (behind the logo), sized to the frame; never reaches the reels (FT band only). */
function garland(u: number) {
	const src = (ART_G as Record<string, string | null>).garland; if (!src) return;
	let im = document.getElementById('mkGarland') as HTMLImageElement | null;
	if (!im) { im = document.createElement('img'); im.id = 'mkGarland'; im.alt = ''; im.draggable = false; im.setAttribute('aria-hidden', 'true'); im.src = src; $('#frame').appendChild(im); }
	const w = FW * 1.05 * u, h = w * 177 / 1235;
	css(im, { position: 'absolute', left: (FW * u - w) / 2, top: Math.min(-h * 0.7, (FT - 6) * u - h), width: w, height: h, 'z-index': '4', 'pointer-events': 'none', margin: '0' });
}
