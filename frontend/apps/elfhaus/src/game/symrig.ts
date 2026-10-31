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

type Part = { f: string; cls: string; pivot: number[] };
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
	for (const n of [key, ...r.parts.map((p) => p.f)]) {
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
	} catch (e) { console.warn('symbol sheet', e); }
}
/** Resolves once ART[H1..W_R5] (+ the wild cards) point at baked images; started at import so it overlaps the loader. */
export const symArtReady: Promise<void> = typeof document === 'undefined' ? Promise.resolve() : bakeAll();
