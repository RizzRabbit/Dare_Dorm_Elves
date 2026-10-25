// Loading screen: full ELFHAUS logo, feature-card carousel, progress bar, then CLICK/TAP TO CONTINUE (the press is
// the user gesture later sound needs). Progress counts every tracked promise: art images, Roxy sheets, RGS/mock auth.
import { $, ART } from './ui';
import { initSplash, stingDone, skipSplash } from './intro';

// Card titles (checked by the social-mode word scan in scripts/test-books.mjs).
// Feature-panel alt text, keyed by the panel art (splash_layout.json decides which panels show and where).
export const LOADER_CARDS = [
	'4 Bonus Modes: Dare, Double Dare, Triple Dare and ???. Three dares… and one dirty little secret.',
	'Sticky Wilds: x1, x2, x3. Once she’s in, she stays… and gets hotter every respin.',
	'Elves Gone Wild Feature Spins: x4 × x5 = x20. Whole reels go WILD. Side by side? They multiply.',
] as const;

let total = 0, done = 0;
const pending: Promise<unknown>[] = [];
function progress() {
	const bar = document.querySelector('#lBar i') as HTMLElement | null;
	if (bar) bar.style.width = `${total ? Math.round((done / total) * 100) : 0}%`;
}
/** Count a promise toward the progress bar (failures still count as done; callers handle their own errors). */
export function track<T>(p: Promise<T>): Promise<T> {
	total++; progress();
	const q = p.finally(() => { done++; progress(); });
	pending.push(q.catch(() => {}));
	return q;
}
// art is decoded up front (img.decode) and kept referenced so the first full-reel / merge overlay never decodes mid-round
const keep: HTMLImageElement[] = [];
const loadImg = (src: string) => new Promise<void>((res, rej) => { const i = new Image(); i.onload = () => { keep.push(i); i.decode().catch(() => {}).then(() => res()); }; i.onerror = rej; i.src = src; });
/** Preload every art file from the manifest. */
export function preloadArt() {
	for (const src of new Set((Object.entries(ART).filter(([k, u]) => u && !/^(sym_|fx_)/.test(k)).map(([, u]) => u) as string[]).filter((u) => !/\.(webm|mp4)$/i.test(u)))) track(loadImg(src)).catch(() => console.warn('art missing', src));
}

export function initLoader() {
	if (!document.getElementById('loader')) return;
	initSplash(); progress();
}
/** Waits for everything tracked, then shows the continue button and resolves on the player's press. */
export async function loaderReady() {
	const L = document.getElementById('loader');
	if (!L) return;
	// Wait for promises tracked so far, including any added while waiting.
	for (let n = -1; n !== pending.length; ) { n = pending.length; await Promise.all(pending); }
	done = total; progress();
	await stingDone();
	L.classList.add('ready');
	// returning players who ticked "Don't show this again" go straight in once loading is done
	if (!skipSplash()) await new Promise<void>((res) => {
		const btn = $('#lGo'); btn.focus({ preventScroll: true });
		const go_ = (e?: Event) => { if ((e?.target as Element)?.closest?.('.spSkip')) return; removeEventListener('keydown', key, true); L.removeEventListener('click', go_); res(); };
		const key = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); go_(); } };
		L.addEventListener('click', go_); // tap anywhere on the splash
		addEventListener('keydown', key, { capture: true });
	});
	hideLoader();
}
/** Fade the loader out into the game (also used to get it out of the way of an error message). */
export function hideLoader() {
	const L = document.getElementById('loader');
	if (!L || L.classList.contains('out')) return;
	L.classList.add('out');
	setTimeout(() => L.remove(), 700);
}
