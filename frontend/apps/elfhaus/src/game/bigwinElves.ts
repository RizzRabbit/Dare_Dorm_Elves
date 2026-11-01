// Big-win character layers, one per top stage, the chalet elves standing shoulder to shoulder behind the amount
// (full-body cartoon cast cropped at the thigh, build_crowd.py), transform/opacity-only motion on one rAF clock (elfrig.ts):
// idle bob + sway, squash / tilt on every beat, a hop on the peak, a staggered ease-out-back rise-in.
//  - EPIC WIN (math level 9): Vi | Roxy | Coco.
//  - LEGENDARY WIN (math level 10, up to the cap): Coco | Jade | Roxy | Vi on the max-win cast sheets (Delilah stays for MAX WIN).
//  - MAX WIN keeps all five (maxwin.ts).
// On a LEGENDARY win the EPIC group rises at EPIC WIN, then hands over to the four at LEGENDARY WIN (short fade).
// Lazy: each level's sheets decode only when the round's book has a win at that level and are released when the banner closes.
import { loadSheet, hasSheet, unloadSheet } from './sprite';
import { ElfRig, TEMPO, type ElfCfg } from './elfrig';
import { STAGE_OF_LEVEL } from './countup';
import { TRANS as MW_TRANS, TRANS_RX as MW_TRANS_RX, FX as MW_FX, BLUSH as MW_BLUSH } from './maxwinCast';

const levelNamed = (name: string) => Number(Object.entries(STAGE_OF_LEVEL).find(([, n]) => n === name)?.[0]);
/** v3.19: the layers follow the math win level (no x threshold): EPIC WIN = 3 elves, LEGENDARY WIN = 4. */
export const EPIC_ELVES_LEVEL = levelNamed('EPIC WIN'), LEGEND_ELVES_LEVEL = levelNamed('LEGENDARY WIN');
export type ElvesGroup = 'epic' | 'legendary';
/** Which layer a stage level shows (null = none). */
export function elvesFor(level: number): ElvesGroup | null { return level > LEGEND_ELVES_LEVEL ? null : level === LEGEND_ELVES_LEVEL ? 'legendary' : level >= EPIC_ELVES_LEVEL ? 'epic' : null; } // above LEGENDARY = the max-win screen (its own five)
export const elvesLevel = (level: number) => elvesFor(level) !== null;
/** The layers a win at `level` passes through on its way up (what to preload). */
export function elvesGroupsUpTo(level: number): ElvesGroup[] { return elvesFor(level) ? (['epic', 'legendary'] as const).filter((g) => level >= (g === 'epic' ? EPIC_ELVES_LEVEL : LEGEND_ELVES_LEVEL)) : []; }

const bwAtl = import.meta.glob('./bigwin/*.json', { eager: true, import: 'default' }) as Record<string, any>;
const bwImg = import.meta.glob('../assets/bigwin/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const mwAtl = import.meta.glob('./maxwin/maxwin_elf_*.json', { eager: true, import: 'default' }) as Record<string, any>;
const mwImg = import.meta.glob('../assets/maxwin/maxwin_elf_*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const find = (m: Record<string, any>, id: string, ext: string) => Object.entries(m).find(([k]) => k.endsWith(`/${id}.${ext}`))?.[1];
const url = (id: string): string | undefined => find(bwImg, id, 'webp') ?? find(mwImg, id, 'webp');
const atlas = (id: string) => find(bwAtl, id, 'json') ?? find(mwAtl, id, 'json');

// EPIC: Vi | Roxy | Coco (unchanged from the approved 1000x layer)
const E_NAMES = ['vi', 'roxy', 'coco'];
const VI = 0, RX = 1, CO = 2;
const E_TRANS: ElfCfg['trans'] = { 'base>kiss': [['mid', 3]], 'kiss>base': [['mid', 2]], 'base>wink': [['mid', 2]], 'wink>base': [['mid', 2]] };
const E_FX: ElfCfg['fx'] = { kiss: ['squash', 'tilt'], wink: ['squash', 'tilt', 'hop'], base: ['tilt0'] };
// one kiss/wink beat per elf, NOT on a grid: ms offsets inside a 3.4 s cycle
const E_CYCLE: [number, string, number, number][] = [[CO, 'kiss', 350, 620], [RX, 'kiss', 1350, 560], [VI, 'kiss', 1900, 640], [RX, 'wink', 2700, 470]];
// LEGENDARY: Coco | Jade | Roxy | Vi on the max-win sheets, re-spaced without Delilah (build_crowd.py prints L_GROUP / L_AT).
const L_NAMES = ['coco', 'jade', 'roxy', 'vi'];
const LC = 0, LJ = 1, LR = 2, LV = 3;
export const L_GROUP: [number, number] = [1321, 694];
export const L_AT: Record<string, [number, number]> = { coco: [0, 45], jade: [305, 73], roxy: [609, 30], vi: [922, 72] };
const L_CYCLE: [number, string, number, number][] = [[LC, 'peak', 350, 620], [LR, 'peak', 1150, 560], [LJ, 'peak', 1750, 600], [LV, 'peak', 2450, 640]];
const CYCLE_MS = 3400;   // all beats are stretched by elfrig TEMPO (the elves are up ~2.7 s: one calm beat each)

type Def = { ids: string[]; cls: string; cfg: () => ElfCfg[]; order: number[]; cycle: typeof E_CYCLE; base: string };
const DEFS: Record<ElvesGroup, Def> = {
	epic: { ids: E_NAMES.map((n) => 'bigwin_elf_' + n), cls: 'bwGroup in', order: [RX, VI, CO], cycle: E_CYCLE, base: 'base',
		cfg: () => E_NAMES.map((n) => ({ id: 'bigwin_elf_' + n, base: 'base', trans: E_TRANS, fx: E_FX, blush: { mid: 0.35, kiss: 0.75, wink: 0.5 } })) },
	legendary: { ids: L_NAMES.map((n) => 'maxwin_elf_' + n), cls: 'bwGroup bwLegend in', order: [LR, LJ, LV, LC], cycle: L_CYCLE, base: 'gawk',
		cfg: () => L_NAMES.map((n, i) => ({ id: 'maxwin_elf_' + n, base: 'gawk', trans: i === LR ? MW_TRANS_RX : MW_TRANS,
			fx: i === LR ? { ...MW_FX, peak: ['squash', 'tilt', 'hop'] } : MW_FX, blush: i === LR ? { ...MW_BLUSH, peak: 1 } : MW_BLUSH,
			blink: ['blink', 'gawk', 2300, 4200], at: L_AT[n], group: L_GROUP })) },
};
/** Sheet ids a layer needs (for tests / preload). */
export const elvesSheets = (g: ElvesGroup) => DEFS[g].ids.slice();

const loading = new Map<ElvesGroup, Promise<unknown>>(), mine = new Set<string>();
/** Start decoding the sheets for every layer a win at `level` shows (idempotent). */
export function preloadBigWinElves(level: number = LEGEND_ELVES_LEVEL): Promise<unknown> {
	return Promise.all(elvesGroupsUpTo(level).map((g) => {
		let p = loading.get(g);
		if (!p) {
			p = Promise.all(DEFS[g].ids.map((id) => (hasSheet(id) || !url(id) || !atlas(id) ? 0
				: (mine.add(id), loadSheet(id, url(id)!, atlas(id)).catch((e) => console.warn('bigwin sheet', id, e))))));
			loading.set(g, p);
		}
		return p;
	}));
}
/** Drop the textures this layer decoded (ImageBitmap.close); they decode again on the next win at that level. Sheets the
 *  max-win screen loaded itself are left alone. */
export function releaseBigWinElves() { mine.forEach((id) => unloadSheet(id)); mine.clear(); loading.clear(); }

let rig: ElfRig | null = null, root: HTMLElement | null = null, cur: ElvesGroup | null = null, show = 0;
/** The layer currently up (tests / QA). */
export const elvesShowing = () => cur;

/** Call from the setBigWinFx chars hook at each stage: bigWinElvesStart(B, stageLevel). Shows that stage's layer
 *  (EPIC 3, LEGENDARY 4); a layer already up hands over with a short fade. If the sheets are still decoding, the entrance
 *  waits for them (and is dropped if the banner closed or moved on meanwhile), so nothing pops in half-loaded. */
export function bigWinElvesStart(B: HTMLElement, level: number) {
	const g = elvesFor(level);
	if (!g || g === cur) return;
	const d = DEFS[g];
	if (!d.ids.every(hasSheet)) {
		const my = ++show;
		void preloadBigWinElves(level).then(() => { if (my === show && !B.classList.contains('hidden') && d.ids.every(hasSheet)) bigWinElvesStart(B, level); });
		return;
	}
	if (root) { const old = root, oldRig = rig; old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {}).finally(() => { oldRig?.destroy(); old.remove(); }); }
	show++; cur = g;
	root = document.createElement('div'); root.className = 'bwElves'; root.dataset.group = g;
	const host = document.createElement('div'); host.className = d.cls; root.appendChild(host);
	B.insertBefore(root, B.firstChild);                       // behind .bw (title + amount)
	rig = new ElfRig(host, d.cfg());
	rig.enter(0, d.order, 80);
	for (let c = 0; c < 20; c++) for (const [i, s, t, hold] of d.cycle) {
		const t0 = 600 + Math.round((c * CYCLE_MS + t) * TEMPO) + ((c * 37 + i * 53) % 90);   // a little drift per cycle
		rig.set(i, s, t0); rig.set(i, d.base, t0 + Math.round(hold * TEMPO));
	}
	rig.start();
}

/** Call from the setBigWinFx end hook. Stops the rig, removes the layer and (by default) releases the sheets. */
export function bigWinElvesEnd(release = true) {
	show++; cur = null; rig?.destroy(); rig = null;
	clearLayers();
	if (release) releaseBigWinElves();
}
function clearLayers() { document.querySelectorAll('#bigwin .bwElves').forEach((e) => e.remove()); root = null; }
