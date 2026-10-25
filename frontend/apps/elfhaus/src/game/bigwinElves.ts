// Big-win (>= 1000x) character layer: Vi | Roxy | Coco packed shoulder to shoulder, leaning over the player
// (first-person POV) behind the amount. Round 4: one sheet PER ELF (bigwin_elf_{vi,roxy,coco}: base / mid / kiss
// (+ Roxy's wink) frames + a blush overlay) driven by elfrig.ts: staggered ease-out-back rise-in, idle bob/sway,
// squash + head tilt on each kiss/wink, a little hop on Roxy's wink. Expressions step on a 30 fps grid through the drawn
// half-lidded / half-pucker 'mid' frame; transform/opacity-only motion on one rAF clock. ~3.9 MB decoded for the three.
// Lazy: decoded only when a >= 1000x win is detected (playBookEvents scans the book, the banner's start hook as a backup),
// released (ImageBitmap.close) when the banner closes. If the decode isn't done when the count reaches 1000x, the entrance
// waits for it instead of popping in.
// Drop-in: sheets -> src/assets/bigwin/bigwin_elf_*.webp, atlases -> src/game/bigwin/bigwin_elf_*.json.
import { loadSheet, hasSheet, unloadSheet } from './sprite';
import { ElfRig, TEMPO, type ElfCfg } from './elfrig';

export const BIGWIN_ELVES_MIN_X = 1000;
const NAMES = ['vi', 'roxy', 'coco'], IDS = NAMES.map((n) => 'bigwin_elf_' + n);
const VI = 0, RX = 1, CO = 2;
const atlases = import.meta.glob('./bigwin/*.json', { eager: true, import: 'default' }) as Record<string, any>;
const urls = import.meta.glob('../assets/bigwin/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const url = (id: string) => Object.entries(urls).find(([k]) => k.endsWith(`/${id}.webp`))?.[1];
const atlas = (id: string) => Object.entries(atlases).find(([k]) => k.endsWith(`/${id}.json`))?.[1];

let loading: Promise<unknown> | null = null;
/** Start decoding the three sheets (idempotent; returns the pending decode). Call when a win >= BIGWIN_ELVES_MIN_X is detected. */
export function preloadBigWinElves(): Promise<unknown> {
	return (loading ??= Promise.all(IDS.map((id) => (hasSheet(id) || !url(id) || !atlas(id) ? 0 : loadSheet(id, url(id)!, atlas(id)).catch((e) => console.warn('bigwin sheet', id, e))))));
}
/** Drop the decoded textures (ImageBitmap.close); they decode again on the next >= 1000x win. */
export function releaseBigWinElves() { IDS.forEach((id) => unloadSheet(id)); loading = null; }

const TRANS: ElfCfg['trans'] = { 'base>kiss': [['mid', 3]], 'kiss>base': [['mid', 2]], 'base>wink': [['mid', 2]], 'wink>base': [['mid', 2]] };
const FX: ElfCfg['fx'] = { kiss: ['squash', 'tilt'], wink: ['squash', 'tilt', 'hop'], base: ['tilt0'] };
// one kiss/wink beat per elf, NOT on a grid: ms offsets inside a 3.1 s cycle
// (Roxy's kiss now lands after the ~2.7 s a 1000x+ win is up, so that window shows ONE calm kiss instead of a cut-off second one)
const CYCLE: [number, string, number, number][] = [[CO, 'kiss', 350, 620], [RX, 'kiss', 1350, 560], [VI, 'kiss', 1900, 640], [RX, 'wink', 2700, 470]];
const CYCLE_MS = 3400;   // all beats below are stretched by elfrig TEMPO (the elves are up ~2.7 s: one calm kiss)

let rig: ElfRig | null = null, root: HTMLElement | null = null, show = 0;

/** Call from the setBigWinFx chars hook: bigWinElvesStart(B, x). No-op below 1000x. If the sheets are still decoding,
 *  the entrance waits for them (and is dropped if the banner closed meanwhile), so nothing pops in half-loaded. */
export function bigWinElvesStart(B: HTMLElement, x: number) {
	bigWinElvesEnd(false);
	if (x < BIGWIN_ELVES_MIN_X) return;
	if (!IDS.every(hasSheet)) {
		const my = show;
		void preloadBigWinElves().then(() => { if (my === show && !B.classList.contains('hidden') && IDS.every(hasSheet)) bigWinElvesStart(B, x); });
		return;
	}
	root = document.createElement('div'); root.className = 'bwElves';
	const host = document.createElement('div'); host.className = 'bwGroup in'; root.appendChild(host);
	B.insertBefore(root, B.firstChild);                       // behind .bw (title + amount)
	rig = new ElfRig(host, NAMES.map((n) => ({ id: 'bigwin_elf_' + n, base: 'base', trans: TRANS, fx: FX, blush: { mid: 0.35, kiss: 0.75, wink: 0.5 } })));
	rig.enter(0, [RX, VI, CO], 80);
	for (let c = 0; c < 20; c++) for (const [i, s, t, hold] of CYCLE) {
		const t0 = 600 + Math.round((c * CYCLE_MS + t) * TEMPO) + ((c * 37 + i * 53) % 90);   // a little drift per cycle
		rig.set(i, s, t0); rig.set(i, 'base', t0 + Math.round(hold * TEMPO));
	}
	rig.start();
}

/** Call from the setBigWinFx end hook. Stops the rig, removes the layer and (by default) releases the sheets. */
export function bigWinElvesEnd(release = true) {
	show++; rig?.destroy(); rig = null; root?.remove(); root = null;
	if (release) releaseBigWinElves();
}
