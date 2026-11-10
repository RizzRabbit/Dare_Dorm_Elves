// Symbol cut-out rigs (Winter Chalet). Every board symbol is a few layers cut from its approved art and packed in ONE
// trimmed sheet (static/art/sheets/symbols.webp + .json, frame tables in board/symframes.ts, built by
// build_symrig.py): base + 1-3 moving details (+ a 1/4-scale win glow, a shared contact shadow and sparkle).
// At rest the layers rebuild the art exactly; the motion is CSS on real time (symrig rules in chalet.css):
//   land  (.cell.rgLand)  snappy squash-and-settle, details follow through
//   win   (.cell.win)     character-led pop per symbol, shine sweep, detail wiggle (under the existing pop + puff)
//   ant   (body.rgAnt)    scatters / wilds already on the board lean in while a reel teases
import RIG_JSON from './chalet/symrig.json';
import SHEET_JSON from './chalet/symbols.sheet.json';
import ART_JSON from './art.generated.json';
import DEPTH_JSON from './chalet/symdepth.json';

type Part = { f: string; cls: string; pivot: number[]; hide?: boolean }; // hide: off at rest (the wild lids)
type Rig = { src: number[]; pivot: number[]; parts: Part[]; spark: number[][]; glow: boolean };
const RIG = RIG_JSON as unknown as Record<string, Rig>;
export const hasRig = (key: string) => !!RIG[key];
/** Every cell is assembled from shared sheet parts (build_symrig.py + tileparts.py), never from baked per-symbol tiles:
 *  tile colour (_tile_hi / _tile_lo / _tile_sp) -> recess (_recess, 9-slice) -> bevelled gold border (_border / _border_sp,
 *  9-slice) -> symbol (its own layers) over its baked depth sprites (drop shadow, raised edge, top rim light) -> glow / FX.
 *  Bust wilds: their card -> recess -> border -> the bust (fig, its own pixels lifted) -> the shared raised WILD (_wild). */
export const frameTier = (key: string) => (key[0] === 'H' ? 'hi' : key[0] === 'L' ? 'lo' : key === 'S' ? 'sp' : '');
/** The symbol inside its tile: the rig box is inset by FR_IN on each side (it comes forward over the inner border, chalet.css .cell>.sym.fr). */
export const FR_IN = 0.06;
/** The Ski Pass scatter fills a little more of its tile (chalet.css .cell>.sym.S.fr: 3.5% of the cell instead of 6%). */
const FR_IN_S = 0.033;
const frIn = (key: string) => (key === 'S' ? FR_IN_S : FR_IN);
/** 9-slice geometry of _border / _recess: 256 px pieces, 52 px corners (= 0.203 of a cell). */
export const NINE = { size: 256, slice: 52 };
const edgeHTML = (sp = false) => `<i class="tRec"></i><i class="tBd${sp ? ' sp' : ''}"></i>`;
/** The tile's own light layers (chalet.css .tGl / .tGw): a glint copy of the border (land sweep, win shimmer,
 *  anticipation shimmer) and a soft glow copy of it (win pulse). Only opacity / mask position animate. */
const lightHTML = (sp = false) => `<i class="tGl${sp ? ' sp' : ''}"></i><i class="tGw${sp ? ' sp' : ''}"></i>`;
/** Bare tile pieces (no container): colour + recess + border. The cell spinner (reels.ts) reuses them. */
export function tileParts(key: string) {
	const t = frameTier(key);
	if (t) return { under: `<i class="rp f__tile_${t} tTile"></i><i class="tRec"></i>${t === 'sp' ? '<i class="tFr"></i>' : ''}`, over: `<i class="tBd${t === 'sp' ? ' sp' : ''}"></i>`, sp: t === 'sp' };
	if (key.startsWith('W_') && RIG[key]) return { under: `<i class="rp f_${key}"></i><i class="tRec"></i>`, over: `<i class="tBd"></i>`, sp: false };
	return null;
}
/** The tile as its own piece, a sibling of the symbol (.cell > .tile + .sym): the symbol's land / win / anticipation
 *  motion never moves, scales or turns it; the tile has its own subtler motion (thud, border glint / flash / glow).
 *  Tier tiles: colour + recess + border + light, under the symbol. Bust wilds: card + recess under the bust (tileHTML),
 *  then the border + light over it (tileTopHTML), then the raised WILD lettering as its own piece (wildLetsHTML). */
export function tileHTML(key: string) {
	const p = tileParts(key); if (!p) return '';
	if (key.startsWith('W_')) return `<div class="tile tW">${p.under}</div>`;
	return `<div class="tile${p.sp ? ' tS' : ''}">${p.under}${p.over}${lightHTML(p.sp)}</div>`;
}
export const tileTopHTML = (key: string) => (key.startsWith('W_') && RIG[key] ? `<div class="tile tTop"><i class="tBd"></i>${lightHTML()}</div>` : '');
/** Recess + border (+ the tile light) for a stacked / merged wild overlay (any size; 9-slice). */
export const ovEdgeHTML = () => edgeHTML() + lightHTML();
const pc = (v: number, d: number) => ((v / d) * 100).toFixed(2) + '%';
/** The symbol's baked depth (scripts/gen-symdepth-sprites.mjs, board/symframes.ts): its soft drop shadow (`d_`, follows
 *  --lift by translate / scale only) and its raised edge + rim light (`e_`), sprite siblings under the body. */
const depthHTML = (k: string) => `<i class="sd sdD d_${k}"></i><i class="sd e_${k}"></i>`;

/** The symbol's win glow (1/4-scale sheet frame, scaled to its source box); n layers (wilds draw it twice). */
export function rigGlowHTML(key: string, n = 1) {
	return RIG[key]?.glow ? `<i class="symGlow">${`<i class="rp f_${key}_glow"></i>`.repeat(n)}</i>` : '';
}
/** The layered symbol. `still` = no motion hooks (paytable / cards): just the layers, which equal the art. */
export function rigHTML(key: string, still = false) {
	const r = RIG[key]; if (!r) return '';
	const [W, H] = r.src, org = `transform-origin:${pc(r.pivot[0], W)} ${pc(r.pivot[1], H)}`;
	const pt = (p: Part) => `<i class="rp f_${p.f} m_${p.cls}"${p.hide ? ' style="scale:1 0"' : ''}></i>`, parts = r.parts.map(pt).join('');
	if (still) return key.startsWith('W_') ? `<i class="rig still k_${key}"><i class="rgBody"><i class="rp f_${key}"></i>${depthHTML(key)}${parts}</i></i>`
		: `<i class="rig still k_${key}"><i class="rgBody">${depthHTML(key)}<i class="rp f_${key}"></i>${parts}</i></i>`;
	const sparks = r.spark.map(([x, y, s], i) => `<i class="rp f__spark rgSp" style="left:${pc(x - 48 * s, W)};top:${pc(y - 48 * s, H)};width:${pc(96 * s, W)};height:${pc(96 * s, H)};--d:${i * 0.09}s"></i>`).join('');
	const sh = `<i class="rp f__shadow rgSh" style="left:${pc(r.pivot[0] - 150, W)};top:${pc(Math.min(H - 40, r.pivot[1] < H * 0.6 ? H * 0.86 : r.pivot[1]) - 22, H)};width:${pc(300, W)};height:${pc(66, H)}"></i>`;
	// bust wild: the bust and details only; the card + recess under it and the SAME gold border as the tiles over it are
	// the tile (so nothing - the bust's shadow, the sheen - dims or narrows it), the raised WILD is wildLetsHTML.
	if (key.startsWith('W_')) {
		const body = r.parts.filter((p) => p.cls !== 'lets').map(pt).join('');
		// the card, recess and border are the tile (tileHTML / tileTopHTML); here only the bust and its details
		return `<i class="rig k_${key}">${sh}<i class="rgBody" style="${org}">${depthHTML(key)}${body}<i class="rgShine s_${key}"></i></i>${sparks}</i>`;
	}
	return `<i class="rig k_${key}">${sh}<i class="rgBody" style="${org}">${depthHTML(key)}<i class="rp f_${key}"></i>${parts}<i class="rgShine s_${key}"></i></i>${sparks}</i>`;
}
/** The raised WILD lettering of a bust wild, over the tile border: its own piece with the bust's pivot, so the same
 *  rgBody land / win / anticipation keyframes move bust and lettering in step, never the tile. */
export function wildLetsHTML(key: string) {
	const r = RIG[key]; if (!r || !key.startsWith('W_')) return '';
	const [W, H] = r.src, lets = r.parts.filter((p) => p.cls === 'lets').map((p) => `<i class="rp f_${p.f} m_${p.cls}"></i>`).join('');
	return lets ? `<div class="sym W art symTop rigd"><i class="rig k_${key}"><i class="rgBody" style="transform-origin:${pc(r.pivot[0], W)} ${pc(r.pivot[1], H)}">${depthHTML('lets')}${lets}</i></i></div>` : '';
}
/** Land hook (reels.ts landMini): one snappy squash-and-settle with follow-through on the details. */
export function rigLand(cell: HTMLElement | null) {
	if (!cell || !cell.querySelector('.rig')) return;
	cell.classList.remove('rgLand'); void cell.offsetWidth; cell.classList.add('rgLand');
	window.setTimeout(() => cell.classList.remove('rgLand'), 520);
}
/** Anticipation: while a reel teases, the scatters / wilds already on the board lean in. */
export function rigAnt(on: boolean) { document.body.classList.toggle('rgAnt', on); }

// ---------- flat art from the sheet ----------
// The loose symbol files are gone from the build: the few places that still want one flat image of a symbol (paytable
// rows, buy-menu / feature cards, the ski-pass flip, the intro cards) get it rebuilt from the sheet (base + its parts at
// their rest pose == the approved art) as an in-memory PNG, filled into ART[key] before the game uses it.
type Fr = { frame: { x: number; y: number; w: number; h: number }; spriteSourceSize: { x: number; y: number; w: number; h: number }; sourceSize: { w: number; h: number } };
const FRAMES = (SHEET_JSON as unknown as { frames: Record<string, Fr> }).frames;
export const SHEET_URL = 'sheets/symbols.webp';
const CARD_ALIASES: Record<string, string[]> = { W_R1: ['W_R1_card'], W_R2: ['W_R2_card'] };
const cv = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
const blobURL = (c: HTMLCanvasElement) => new Promise<string | null>((res) => c.toBlob((bl) => res(bl ? URL.createObjectURL(bl) : null), 'image/png'));
function drawFr(g: CanvasRenderingContext2D, page: HTMLImageElement, n: string, x: number, y: number, k: number) {
	const f = FRAMES[n]; if (!f) return;
	g.drawImage(page, f.frame.x, f.frame.y, f.frame.w, f.frame.h, x + f.spriteSourceSize.x * k, y + f.spriteSourceSize.y * k, f.spriteSourceSize.w * k, f.spriteSourceSize.h * k);
}
/** One 9-slice piece from the sheet into a w x h box (corner size bw). */
function drawNine(g: CanvasRenderingContext2D, page: HTMLImageElement, n: string, x: number, y: number, w: number, h: number, bw: number) {
	const f = FRAMES[n]; if (!f) return; const { x: fx, y: fy, w: fw, h: fh } = f.frame, s = NINE.slice;
	const sx = [0, s, fw - s, fw], sy = [0, s, fh - s, fh], dx = [0, bw, w - bw, w], dy = [0, bw, h - bw, h];
	for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
		const sw = sx[i + 1] - sx[i], sh = sy[j + 1] - sy[j], dw = dx[i + 1] - dx[i], dh = dy[j + 1] - dy[j];
		if (sw > 0 && sh > 0 && dw > 0 && dh > 0) g.drawImage(page, fx + sx[i], fy + sy[j], sw, sh, x + dx[i], y + dy[j], dw, dh);
	}
}
/** A layer lifted off the tile: its baked depth frames (drop shadow, then raised edge + rim light; the same sprites the
 *  live cell places, sheets/symdepth.webp) under it, then the layer. (x, y, w, h) = the symbol's source box. */
const DEPTH = DEPTH_JSON as unknown as { frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>; meta: { pad: number; box: Record<string, number> } };
let depthPage: HTMLImageElement | null = null;
function drawLifted(g: CanvasRenderingContext2D, src: CanvasImageSource, x: number, y: number, w: number, h: number, dk: string) {
	const W = DEPTH.meta.box[dk], P = DEPTH.meta.pad;
	if (depthPage && W) for (const n of [dk + '_d', dk + '_e']) {
		const f = DEPTH.frames[n]?.frame; if (!f) continue;
		const kx = w / W, ky = h / W; g.drawImage(depthPage, f.x, f.y, f.w, f.h, x - P * kx, y - P * ky, (W + 2 * P) * kx, (W + 2 * P) * ky);
	}
	g.drawImage(src, x, y, w, h);
}
/** The symbol alone (its layers at rest == the approved art), source-box sized. */
function flat(page: HTMLImageElement, key: string, only?: (p: Part) => boolean) {
	const r = RIG[key], b = FRAMES[key]; if (!r || !b) return null;
	const c = cv(b.sourceSize.w, b.sourceSize.h), g = c.getContext('2d'); if (!g) return null;
	if (!only) drawFr(g, page, key, 0, 0, 1);
	for (const p of r.parts) if (!p.hide && (!only || only(p))) drawFr(g, page, p.f, 0, 0, 1);
	return c;
}
/** fix2: visible-content centre of each bust wild (bust + WILD union) in its 384 src box, from the art's alpha (notile.css uses the same). */
export const WILD_CEN: Record<string, [number, number]> = { W_R1: [-9.3, 8.7], W_R2: [2.7, 8.7], W_R3: [0, 8.7], W_R4: [-3.3, 8.7], W_R5: [-2.7, 8.7] };
/** A whole cell at `size` px, from the shared parts (strips, paytable, intro and flip cards). */
function composeCell(page: HTMLImageElement, key: string, size: number, bare = false) {
	const r = RIG[key], b = FRAMES[key]; if (!r || !b) return null;
	const c = cv(size, size), g = c.getContext('2d'); if (!g) return null;
	const t = frameTier(key), bw = size * (NINE.slice / NINE.size);
	if (t && bare) {   // the lifted symbol alone, as the live cell draws it over its tile (the cell spinner's slots)
		const sym = flat(page, key); if (!sym) return c;
		const fi = frIn(key), box = size * (1 - 2 * fi), k = box / Math.max(sym.width, sym.height);
		g.filter = 'contrast(1.06) saturate(1.1)';
		drawLifted(g, sym, size * fi + (box - sym.width * k) / 2, size * fi + (box - sym.height * k) / 2, sym.width * k, sym.height * k, key);
		return c;
	}
	if (t) {
		const tf = FRAMES['_tile_' + t]; if (tf) g.drawImage(page, tf.frame.x, tf.frame.y, tf.frame.w, tf.frame.h, 0, 0, size, size);
		drawNine(g, page, '_recess', 0, 0, size, size, bw); if (t === 'sp') drawNine(g, page, '_frost', 0, 0, size, size, bw); drawNine(g, page, t === 'sp' ? '_border_sp' : '_border', 0, 0, size, size, bw);
		const sym = flat(page, key); if (!sym) return c;
		const fi = frIn(key), box = size * (1 - 2 * fi), k = box / Math.max(sym.width, sym.height);
		drawLifted(g, sym, size * fi + (box - sym.width * k) / 2, size * fi + (box - sym.height * k) / 2, sym.width * k, sym.height * k, key);
		return c;
	}
	// bust wild: card, recess, border, the lifted bust, the other details, the raised WILD
	const k = size / Math.max(b.sourceSize.w, b.sourceSize.h);
	if (bare) {   // fix2 spinner slot: no card / recess / border (no tile shapes), centred by visible content like the live cell
		const fig = flat(page, key, (p) => p.cls === 'fig'), det = flat(page, key, (p) => p.cls !== 'fig' && p.cls !== 'lets'), lets = flat(page, key, (p) => p.cls === 'lets');
		const o = WILD_CEN[key] || [0, 0]; g.translate(-o[0] * k, -o[1] * k);
		if (fig) drawLifted(g, fig, 0, 0, size, size, key);
		if (det) g.drawImage(det, 0, 0, size, size);
		if (lets) drawLifted(g, lets, 0, 0, size, size, 'lets');
		return c;
	}
	drawFr(g, page, key, 0, 0, k);
	drawNine(g, page, '_recess', 0, 0, size, size, bw);
	const fig = flat(page, key, (p) => p.cls === 'fig'), det = flat(page, key, (p) => p.cls !== 'fig' && p.cls !== 'lets'), lets = flat(page, key, (p) => p.cls === 'lets');
	if (fig) drawLifted(g, fig, 0, 0, size, size, key);
	if (det) g.drawImage(det, 0, 0, size, size);
	drawNine(g, page, '_border', 0, 0, size, size, bw);   // the tiles' border, over the bust (as in the live cell)
	if (lets) drawLifted(g, lets, 0, 0, size, size, 'lets');
	return c;
}
/** The tile alone (colour + recess + border, or a bust wild's card + recess + border) at `size` px: the tile half of a
 *  cell spinner unit (reels.ts), always paired with its own symbol, never recoloured. */
function composeTile(page: HTMLImageElement, key: string, size: number) {
	const c = cv(size, size), g = c.getContext('2d'); if (!g) return null;
	const t = frameTier(key), bw = size * (NINE.slice / NINE.size);
	if (t) { const tf = FRAMES['_tile_' + t]; if (tf) g.drawImage(page, tf.frame.x, tf.frame.y, tf.frame.w, tf.frame.h, 0, 0, size, size); }
	else { const b = FRAMES[key]; if (!b) return null; drawFr(g, page, key, 0, 0, size / Math.max(b.sourceSize.w, b.sourceSize.h)); }
	drawNine(g, page, '_recess', 0, 0, size, size, bw); if (t === 'sp') drawNine(g, page, '_frost', 0, 0, size, size, bw); drawNine(g, page, t === 'sp' ? '_border_sp' : '_border', 0, 0, size, size, bw);
	return c;
}
/** ART key of a symbol's spinner tile (one per tier, one per bust wild card). */
export const unitTileKey = (key: string) => '_utile_' + (frameTier(key) || key);
/** The 9-slice pieces as their own images for CSS border-image (any cell, stack or merged size). */
async function bakeEdges(page: HTMLImageElement) {
	const root = document.documentElement.style;
	for (const [n, v] of [['_recess', '--tRec'], ['_frost', '--tFrost'], ['_border', '--tBd'], ['_border_sp', '--tBdSp']] as const) {
		const f = FRAMES[n]; if (!f) continue;
		const c = cv(f.frame.w, f.frame.h), g = c.getContext('2d'); if (!g) continue;
		g.drawImage(page, f.frame.x, f.frame.y, f.frame.w, f.frame.h, 0, 0, f.frame.w, f.frame.h);
		const u = await blobURL(c); if (u) root.setProperty(v, `url(${u})`);
	}
}
async function bakeAll() {
	const ART = ART_JSON as Record<string, string | null>;
	try {
		const page = new Image(); page.src = SHEET_URL; await page.decode();
		const dp = new Image(); dp.src = 'sheets/symdepth.webp'; try { await dp.decode(); depthPage = dp; } catch { /* bakes fall back to the bare layers */ }
		await bakeEdges(page);
		await Promise.all(Object.keys(RIG).map(async (k) => {
			const b = FRAMES[k]; if (!b) return;
			const cell = composeCell(page, k, Math.max(b.sourceSize.w, b.sourceSize.h, 256)), u = cell && (await blobURL(cell));
			const f = flat(page, k), uf = f && (await blobURL(f));
			if (uf) ART[k + '_flat'] = uf;   // the bare symbol (Secret Santa card gift)
			// uifix: a bust wild as the board shows it (its layers only, no base card behind her): the Sticky Wilds intro card
			if (k.startsWith('W_R')) { const fc = flat(page, k, () => true), uc = fc && (await blobURL(fc)); if (uc) ART[k + '_cut'] = uc; }
			if (!u) return;
			ART[k] = u; for (const c of CARD_ALIASES[k] || []) ART[c] = u;
			// cell spinner slot (reels.ts): the lifted symbol alone (tiers) / the whole card (bust wilds), tile-box sized
			const sc = composeCell(page, k, SPIN_PX, true), us = sc && (await blobURL(sc));
			if (us) ART[k + '_spin'] = us;
			const tk = unitTileKey(k);
			if (!ART[tk]) { ART[tk] = ''; const tc = composeTile(page, k, SPIN_PX), ut = tc && (await blobURL(tc)); if (ut) ART[tk] = ut; }
		}));
	} catch (e) { console.warn('symbol sheet', e); }
}
const SPIN_PX = 320;
/** Resolves once ART[H1..W_R5] (+ the wild cards) point at baked images; started at import so it overlaps the loader. */
export const symArtReady: Promise<void> = typeof document === 'undefined' ? Promise.resolve() : bakeAll();
