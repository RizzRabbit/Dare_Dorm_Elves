// Symbol cut-out rigs (Winter Chalet). Every board symbol is a few layers cut from its approved art and packed in ONE
// trimmed sheet (static/art/sheets/symbols.webp + .json, frame classes in static/symrig.css, built by
// build_symrig.py): base + 1-3 moving details (+ a 1/4-scale win glow, a shared contact shadow and sparkle).
// At rest the layers rebuild the art exactly; the motion is CSS on real time (symrig rules in chalet.css):
//   land  (.cell.rgLand)  snappy squash-and-settle, details follow through
//   win   (.cell.win)     character-led pop per symbol, shine sweep, detail wiggle (under the existing pop + puff)
//   ant   (body.rgAnt)    scatters / wilds already on the board lean in while a reel teases
import RIG_JSON from './chalet/symrig.json';
import SHEET_JSON from './chalet/symbols.sheet.json';
import ART_JSON from './art.generated.json';

type Part = { f: string; cls: string; pivot: number[]; hide?: boolean }; // hide: off at rest (the wild lids)
type Rig = { src: number[]; pivot: number[]; parts: Part[]; spark: number[][]; glow: boolean };
const RIG = RIG_JSON as unknown as Record<string, Rig>;
export const hasRig = (key: string) => !!RIG[key];
/** Every cell is assembled from shared sheet parts (build_symrig.py + tileparts.py), never from baked per-symbol tiles:
 *  tile colour (_tile_hi / _tile_lo / _tile_sp) -> recess (_recess, 9-slice) -> bevelled gold border (_border / _border_sp,
 *  9-slice) -> symbol (its own layers) with a drop shadow + top rim light from its own alpha (CSS / canvas) -> glow / FX.
 *  Bust wilds: their card -> recess -> border -> the bust (fig, its own pixels lifted) -> the shared raised WILD (_wild). */
export const frameTier = (key: string) => (key[0] === 'H' ? 'hi' : key[0] === 'L' ? 'lo' : key === 'S' ? 'sp' : '');
/** The symbol inside its tile: the rig box is inset by FR_IN on each side (it comes forward over the inner border, chalet.css .cell>.sym.fr). */
export const FR_IN = 0.06;
/** 9-slice geometry of _border / _recess: 256 px pieces, 52 px corners (= 0.203 of a cell). */
export const NINE = { size: 256, slice: 52 };
/** Dark separation halo behind each bust (chalet.css .m_fig); Roxy's red jacket on her red card needs the most. */
const FIG_HALO: Record<string, number> = { W_R1: 0.85 };
const edgeHTML = (sp = false) => `<i class="tRec"></i><i class="tBd${sp ? ' sp' : ''}"></i>`;
/** The tile's own light layers (chalet.css .tGl / .tGw): a glint copy of the border (land sweep, win shimmer,
 *  anticipation shimmer) and a soft glow copy of it (win pulse). Only opacity / mask position animate. */
const lightHTML = (sp = false) => `<i class="tGl${sp ? ' sp' : ''}"></i><i class="tGw${sp ? ' sp' : ''}"></i>`;
/** Bare tile pieces (no container): colour + recess + border. The cell spinner (reels.ts) reuses them. */
export function tileParts(key: string) {
	const t = frameTier(key);
	if (t) return { under: `<i class="rp f__tile_${t} tTile"></i><i class="tRec"></i>`, over: `<i class="tBd${t === 'sp' ? ' sp' : ''}"></i>`, sp: t === 'sp' };
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
	return `<div class="tile">${p.under}${p.over}${lightHTML(p.sp)}</div>`;
}
export const tileTopHTML = (key: string) => (key.startsWith('W_') && RIG[key] ? `<div class="tile tTop"><i class="tBd"></i>${lightHTML()}</div>` : '');
/** Recess + border (+ the tile light) for a stacked / merged wild overlay (any size; 9-slice). */
export const ovEdgeHTML = () => edgeHTML() + lightHTML();
const pc = (v: number, d: number) => ((v / d) * 100).toFixed(2) + '%';

/** The symbol's win glow (1/4-scale sheet frame, scaled to its source box); n layers (wilds draw it twice). */
export function rigGlowHTML(key: string, n = 1) {
	return RIG[key]?.glow ? `<i class="symGlow">${`<i class="rp f_${key}_glow"></i>`.repeat(n)}</i>` : '';
}
/** The layered symbol. `still` = no motion hooks (paytable / cards): just the layers, which equal the art. */
export function rigHTML(key: string, still = false) {
	const r = RIG[key]; if (!r) return '';
	const [W, H] = r.src, org = `transform-origin:${pc(r.pivot[0], W)} ${pc(r.pivot[1], H)}`;
	const pt = (p: Part) => `<i class="rp f_${p.f} m_${p.cls}"></i>`, parts = r.parts.map(pt).join('');
	if (still) return `<i class="rig still k_${key}"><i class="rgBody"><i class="rp f_${key}"></i>${parts}</i></i>`;
	const sparks = r.spark.map(([x, y, s], i) => `<i class="rp f__spark rgSp" style="left:${pc(x - 48 * s, W)};top:${pc(y - 48 * s, H)};width:${pc(96 * s, W)};height:${pc(96 * s, H)};--d:${i * 0.09}s"></i>`).join('');
	const sh = `<i class="rp f__shadow rgSh" style="left:${pc(r.pivot[0] - 150, W)};top:${pc(Math.min(H - 40, r.pivot[1] < H * 0.6 ? H * 0.86 : r.pivot[1]) - 22, H)};width:${pc(300, W)};height:${pc(66, H)}"></i>`;
	// bust wild: the bust and details only; the card + recess under it and the SAME gold border as the tiles over it are
	// the tile (so nothing - the bust's shadow, the sheen - dims or narrows it), the raised WILD is wildLetsHTML.
	if (key.startsWith('W_')) {
		const body = r.parts.filter((p) => p.cls !== 'lets').map(pt).join(''), lets = r.parts.filter((p) => p.cls === 'lets').map(pt).join('');
		// the card, recess and border are the tile (tileHTML / tileTopHTML); here only the bust and its details
		return `<i class="rig k_${key}">${sh}<i class="rgBody" style="${org}">${body}<i class="rgShine s_${key}"></i></i>${sparks}</i>`;
	}
	return `<i class="rig k_${key}">${sh}<i class="rgBody" style="${org}"><i class="rp f_${key}"></i>${parts}<i class="rgShine s_${key}"></i></i>${sparks}</i>`;
}
/** The raised WILD lettering of a bust wild, over the tile border: its own piece with the bust's pivot, so the same
 *  rgBody land / win / anticipation keyframes move bust and lettering in step, never the tile. */
export function wildLetsHTML(key: string) {
	const r = RIG[key]; if (!r || !key.startsWith('W_')) return '';
	const [W, H] = r.src, lets = r.parts.filter((p) => p.cls === 'lets').map((p) => `<i class="rp f_${p.f} m_${p.cls}"></i>`).join('');
	return lets ? `<div class="sym W art symTop rigd"><i class="rig k_${key}"><i class="rgBody" style="transform-origin:${pc(r.pivot[0], W)} ${pc(r.pivot[1], H)}">${lets}</i></i></div>` : '';
}
/** Tile land: the tile's own small thud + one border glint (chalet.css .cell.tLand), leading the symbol's settle. */
export function tileLand(el: HTMLElement | null) {
	if (!el) return;
	el.classList.remove('tLand'); void el.offsetWidth; el.classList.add('tLand');
	window.setTimeout(() => el.classList.remove('tLand'), 620);
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
/** A layer lifted off the tile: drop shadow down-right, then a thin top rim light (both from its own alpha). */
function drawLifted(g: CanvasRenderingContext2D, src: CanvasImageSource, x: number, y: number, w: number, h: number, cell: number, lets = false, halo = 0) {
	// = chalet.css (.cell>.sym.fr .rgBody / .m_fig / .m_lets): raised edge, top-left rim light, soft drop shadow down-right
	const pass = (col: string, dx: number, dy: number, b: number) => { g.shadowColor = col; g.shadowOffsetX = dx; g.shadowOffsetY = dy; g.shadowBlur = b; g.drawImage(src, x, y, w, h); };
	g.save();
	if (lets) { pass('rgba(20,4,8,.6)', cell * 0.02, cell * 0.03, cell * 0.016); pass('rgba(58,22,10,.9)', cell * 0.004, cell * 0.007, 0); g.restore(); return; }
	pass('rgba(18,2,8,.56)', cell * 0.038, cell * 0.052, cell * 0.032);
	if (halo) pass(`rgba(16,2,8,${halo})`, 0, 0, cell * 0.014);
	pass('rgba(255,242,210,.78)', -cell * 0.006, -cell * 0.008, 0);
	pass('rgba(58,22,10,.92)', cell * 0.005, cell * 0.008, 0);
	g.restore();
}
/** The symbol alone (its layers at rest == the approved art), source-box sized. */
function flat(page: HTMLImageElement, key: string, only?: (p: Part) => boolean) {
	const r = RIG[key], b = FRAMES[key]; if (!r || !b) return null;
	const c = cv(b.sourceSize.w, b.sourceSize.h), g = c.getContext('2d'); if (!g) return null;
	if (!only) drawFr(g, page, key, 0, 0, 1);
	for (const p of r.parts) if (!p.hide && (!only || only(p))) drawFr(g, page, p.f, 0, 0, 1);
	return c;
}
/** A whole cell at `size` px, from the shared parts (strips, paytable, intro and flip cards). */
function composeCell(page: HTMLImageElement, key: string, size: number) {
	const r = RIG[key], b = FRAMES[key]; if (!r || !b) return null;
	const c = cv(size, size), g = c.getContext('2d'); if (!g) return null;
	const t = frameTier(key), bw = size * (NINE.slice / NINE.size);
	if (t) {
		const tf = FRAMES['_tile_' + t]; if (tf) g.drawImage(page, tf.frame.x, tf.frame.y, tf.frame.w, tf.frame.h, 0, 0, size, size);
		drawNine(g, page, '_recess', 0, 0, size, size, bw); drawNine(g, page, t === 'sp' ? '_border_sp' : '_border', 0, 0, size, size, bw);
		const sym = flat(page, key); if (!sym) return c;
		const box = size * (1 - 2 * FR_IN), k = box / Math.max(sym.width, sym.height);
		drawLifted(g, sym, size * FR_IN + (box - sym.width * k) / 2, size * FR_IN + (box - sym.height * k) / 2, sym.width * k, sym.height * k, size);
		return c;
	}
	// bust wild: card, recess, border, the lifted bust, the other details, the raised WILD
	const k = size / Math.max(b.sourceSize.w, b.sourceSize.h);
	drawFr(g, page, key, 0, 0, k);
	drawNine(g, page, '_recess', 0, 0, size, size, bw);
	const fig = flat(page, key, (p) => p.cls === 'fig'), det = flat(page, key, (p) => p.cls !== 'fig' && p.cls !== 'lets'), lets = flat(page, key, (p) => p.cls === 'lets');
	if (fig) drawLifted(g, fig, 0, 0, size, size, size, false, FIG_HALO[key] ?? 0.55);
	if (det) g.drawImage(det, 0, 0, size, size);
	drawNine(g, page, '_border', 0, 0, size, size, bw);   // the tiles' border, over the bust (as in the live cell)
	if (lets) drawLifted(g, lets, 0, 0, size, size, size, true);
	return c;
}
/** The 9-slice pieces as their own images for CSS border-image (any cell, stack or merged size). */
async function bakeEdges(page: HTMLImageElement) {
	const root = document.documentElement.style;
	for (const [n, v] of [['_recess', '--tRec'], ['_border', '--tBd'], ['_border_sp', '--tBdSp']] as const) {
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
		await bakeEdges(page);
		await Promise.all(Object.keys(RIG).map(async (k) => {
			const b = FRAMES[k]; if (!b) return;
			const cell = composeCell(page, k, Math.max(b.sourceSize.w, b.sourceSize.h, 256)), u = cell && (await blobURL(cell));
			const f = flat(page, k), uf = f && (await blobURL(f));
			if (uf) ART[k + '_flat'] = uf;   // the bare symbol (Secret Santa card gift)
			if (!u) return;
			ART[k] = u; for (const c of CARD_ALIASES[k] || []) ART[c] = u;
		}));
		await bakeStrips(page, ART);
	} catch (e) { console.warn('symbol sheet', e); }
}
// ---------- per-cell spin strips (reels.ts spinMini .mini i) ----------
// One 6-symbol cycle per strip, drawn from the same sheet layers as the cells and motion-blurred along the spin
// direction, so every spinning cell shows its own blurred symbols running (the chalet art set has no strip files).
const STRIP_T = 144;
const STRIPS: Record<string, string[]> = { reel_stripA: ['H1', 'L3', 'H4', 'L1', 'W_R1', 'L5'], reel_stripB: ['L2', 'H3', 'L4', 'H2', 'S', 'H1'] };
function drawKey(g: CanvasRenderingContext2D, page: HTMLImageElement, key: string, x: number, y: number, size: number) {
	const c = composeCell(page, key, size * 2); if (c) g.drawImage(c, x, y, size, size);
}
async function bakeStrips(page: HTMLImageElement, ART: Record<string, string | null>) {
	const T = STRIP_T, pad = Math.round(T * 0.04);
	for (const [name, order] of Object.entries(STRIPS)) {
		const n = order.length, sharp = document.createElement('canvas'); sharp.width = T; sharp.height = T * n;
		const g = sharp.getContext('2d'); if (!g) return;
		order.forEach((key, i) => drawKey(g, page, key, pad, i * T + pad, T - pad * 2));
		const out = document.createElement('canvas'); out.width = T; out.height = T * n;
		const o = out.getContext('2d'); if (!o) return;
		// vertical motion blur: wrapped offset copies (the strip repeats, so the seam stays continuous)
		const R = Math.round(T * 0.18), steps = 17;
		for (let s = 0; s < steps; s++) {
			const dy = Math.round(-R + (2 * R * s) / (steps - 1));
			o.globalAlpha = 1 / (s + 1) * 1.0; // running average
			o.globalCompositeOperation = 'source-over';
			for (const w of [-T * n, 0, T * n]) o.drawImage(sharp, 0, dy + w);
		}
		o.globalAlpha = 1;
		const u = await new Promise<string | null>((res) => out.toBlob((bl) => res(bl ? URL.createObjectURL(bl) : null), 'image/png'));
		if (u) ART[name] = u;
	}
}
/** Resolves once ART[H1..W_R5] (+ the wild cards) point at baked images; started at import so it overlaps the loader. */
export const symArtReady: Promise<void> = typeof document === 'undefined' ? Promise.resolve() : bakeAll();
