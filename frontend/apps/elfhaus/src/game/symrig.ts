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
const pc = (v: number, d: number) => ((v / d) * 100).toFixed(2) + '%';

/** The symbol's win glow (1/4-scale sheet frame, scaled to its source box); n layers (wilds draw it twice). */
export function rigGlowHTML(key: string, n = 1) {
	return RIG[key]?.glow ? `<i class="symGlow">${`<i class="rp f_${key}_glow"></i>`.repeat(n)}</i>` : '';
}
/** The layered symbol. `still` = no motion hooks (paytable / cards): just the layers, which equal the art. */
export function rigHTML(key: string, still = false) {
	const r = RIG[key]; if (!r) return '';
	const [W, H] = r.src, org = `transform-origin:${pc(r.pivot[0], W)} ${pc(r.pivot[1], H)}`;
	const parts = r.parts.map((p) => `<i class="rp f_${p.f} m_${p.cls}"></i>`).join('');
	if (still) return `<i class="rig still k_${key}"><i class="rgBody"><i class="rp f_${key}"></i>${parts}</i></i>`;
	const sparks = r.spark.map(([x, y, s], i) => `<i class="rp f__spark rgSp" style="left:${pc(x - 48 * s, W)};top:${pc(y - 48 * s, H)};width:${pc(96 * s, W)};height:${pc(96 * s, H)};--d:${i * 0.09}s"></i>`).join('');
	const sh = `<i class="rp f__shadow rgSh" style="left:${pc(r.pivot[0] - 150, W)};top:${pc(Math.min(H - 40, r.pivot[1] < H * 0.6 ? H * 0.86 : r.pivot[1]) - 22, H)};width:${pc(300, W)};height:${pc(66, H)}"></i>`;
	return `<i class="rig k_${key}">${sh}<i class="rgBody" style="${org}"><i class="rp f_${key}"></i>${parts}<i class="rgShine s_${key}"></i></i>${sparks}</i>`;
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
function bake(page: HTMLImageElement, key: string): Promise<string | null> {
	const r = RIG[key], b = FRAMES[key]; if (!r || !b) return Promise.resolve(null);
	const cv = document.createElement('canvas'); cv.width = b.sourceSize.w; cv.height = b.sourceSize.h;
	const g = cv.getContext('2d'); if (!g) return Promise.resolve(null);
	for (const n of [key, ...r.parts.filter((p) => !p.hide).map((p) => p.f)]) {
		const f = FRAMES[n]; if (!f) continue;
		g.drawImage(page, f.frame.x, f.frame.y, f.frame.w, f.frame.h, f.spriteSourceSize.x, f.spriteSourceSize.y, f.spriteSourceSize.w, f.spriteSourceSize.h);
	}
	return new Promise((res) => cv.toBlob((bl) => res(bl ? URL.createObjectURL(bl) : null), 'image/png'));
}
async function bakeAll() {
	const ART = ART_JSON as Record<string, string | null>;
	try {
		const page = new Image(); page.src = SHEET_URL; await page.decode();
		await Promise.all(Object.keys(RIG).map(async (k) => {
			const u = await bake(page, k); if (!u) return;
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
	const r = RIG[key], b = FRAMES[key]; if (!r || !b) return;
	const k = size / Math.max(b.sourceSize.w, b.sourceSize.h), ox = x + (size - b.sourceSize.w * k) / 2, oy = y + (size - b.sourceSize.h * k) / 2;
	for (const n of [key, ...r.parts.filter((p) => !p.hide).map((p) => p.f)]) {
		const f = FRAMES[n]; if (!f) continue;
		g.drawImage(page, f.frame.x, f.frame.y, f.frame.w, f.frame.h, ox + f.spriteSourceSize.x * k, oy + f.spriteSourceSize.y * k, f.spriteSourceSize.w * k, f.spriteSourceSize.h * k);
	}
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
