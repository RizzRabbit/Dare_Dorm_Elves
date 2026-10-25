// Big-win (>= 1000x) character layer: Vi | Roxy | Coco packed shoulder to shoulder, leaning over the player
// (first-person POV) behind the amount. One group sprite sheet; plays inside #bigwin under the .bw text block.
// Drop-in: sheet -> src/assets/bigwin/bigwin_group.webp, atlas -> src/game/bigwin/bigwin_group.json,
// this file -> src/game/bigwinElves.ts. Uses src/game/sprite.ts.
import { loadSheet, hasSheet, play, stop } from './sprite';

export const BIGWIN_ELVES_MIN_X = 1000;
const ID = 'bigwin_group';
const atlases = import.meta.glob('./bigwin/*.json', { eager: true, import: 'default' }) as Record<string, any>;
const urls = import.meta.glob('../assets/bigwin/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const url = Object.entries(urls).find(([k]) => k.endsWith(`/${ID}.webp`))?.[1];
const atlas = Object.entries(atlases).find(([k]) => k.endsWith(`/${ID}.json`))?.[1];

let loading: Promise<unknown> | null = null;
/** Lazy: call once at idle after boot (or when a win >= 100x starts counting). ~1.4 MB. */
export function preloadBigWinElves() {
	if (!loading) loading = hasSheet(ID) || !url || !atlas ? Promise.resolve() : loadSheet(ID, url, atlas);
	return loading;
}

type Live = { root: HTMLElement; anims: any[]; timers: number[] };
let live: Live | null = null;

/** Call from the setBigWinFx start hook: bigWinElvesStart(B, x). No-op below 1000x or if the sheet isn't ready. */
export function bigWinElvesStart(B: HTMLElement, x: number) {
	bigWinElvesEnd();
	if (x < BIGWIN_ELVES_MIN_X || !hasSheet(ID)) { void preloadBigWinElves(); return; }
	const root = document.createElement('div'); root.className = 'bwElves';
	const host = document.createElement('div'); host.className = 'bwGroup'; root.appendChild(host);
	B.insertBefore(root, B.firstChild);                       // behind .bw (title + amount)
	const L: Live = (live = { root, anims: [], timers: [] });
	requestAnimationFrame(() => host.classList.add('in'));
	const a = play(ID, 'intro', host, { cls: 'bwSpr', hold: true, onEnd: () => {
		if (live !== L) return;
		const b = play(ID, 'loop', host, { cls: 'bwSpr', loop: true });
		if (b) L.anims.push(b);
		requestAnimationFrame(() => requestAnimationFrame(() => a && stop(a)));   // swap without a blank frame
	} });
	if (a) L.anims.push(a);
}

/** Call from the setBigWinFx end hook. Stops the anims and removes the layer (sheet stays cached). */
export function bigWinElvesEnd() {
	if (!live) return;
	live.timers.forEach(clearTimeout); live.anims.forEach((a) => stop(a)); live.root.remove(); live = null;
}
