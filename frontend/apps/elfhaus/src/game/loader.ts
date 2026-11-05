// Loading screen: full ELFHAUS logo, feature-card carousel, progress bar, then CLICK/TAP TO CONTINUE (the press is
// the user gesture later sound needs). Progress counts every tracked promise: art images, Roxy sheets, RGS auth.
import { $, ART } from './ui';
import { initSplash, stingDone, noIntro, preOut } from './intro';
import { FX_SHEET_COUNT } from './fx';
import { musicEnterGame } from './audio';
import { initIntro, introLoaded, introEnter, introSkip, introEatClick } from './introPixi';

// Card titles (checked by the social-mode word scan in scripts/test-books.mjs).
// Feature-panel alt text, keyed by the panel art (splash_layout.json decides which panels show and where).
export const LOADER_CARDS = [
	'4 Bonus Modes: Bunny Slope, Black Diamond, Double Black and a hidden Powder Day.',
	'Sticky Wilds: x1, x2, x3. Once she lands she stays, and her multiplier grows +1 each time she connects again (+2 in Powder Day).',
	'Wild Winter Spins: whole reels go wild. Side by side, their multipliers multiply.',
] as const;

let total = 0, done = 0, floor = 0, shown = 0;
const pending: Promise<unknown>[] = [];
// Loading-bar fix: the fraction is done / max(total, floor). `floor` reserves the work initGame tracks later (Roxy, fx
// sheets, fonts, auth start only after the symbol art is ready), so the bar no longer leaps to ~95% on the first cached
// images and then slides back as new work is tracked. It never moves backwards and only reads 1 once everything is done.
export function frac() {
	const f = total ? done / Math.max(total, floor) : 0;
	shown = Math.max(shown, Math.min(f, done >= total && total >= floor ? 1 : 0.99));
	return shown;
}
function progress() {
	const p = frac();
	const bar = document.querySelector('#lBar i') as HTMLElement | null;
	if (bar) bar.style.transform = `scaleX(${p.toFixed(3)})`;
	document.getElementById('preL')?.style.setProperty('--p', p.toFixed(3));   // the inline first-paint bar (app.html)
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
	const srcs = new Set((Object.entries(ART).filter(([k, u]) => u && !/^(sym_|fx_)/.test(k)).map(([, u]) => u) as string[]).filter((u) => !/\.(webm|mp4)$/i.test(u)));
	// art + fx sheets + the 4 later singles in initGame (symbol art, Roxy, fonts, RGS auth / replay)
	floor = srcs.size + FX_SHEET_COUNT + 5;   // +1: puff textures (puff.ts preloadPuff)
	for (const src of srcs) track(loadImg(src)).catch(() => console.warn('art missing', src));
}

let px: Promise<boolean> = Promise.resolve(false);
export function initLoader() {
	const L = document.getElementById('loader'); if (!L) return;
	initSplash(); progress();
	// resub: the approved Pixi vestibule intro replaces the DOM splash art (the loader stays as the tap / key / checkbox
	// layer, dark until the studio sting is done, then see-through). No WebGL -> the DOM splash shows as before.
	L.classList.add('px');
	px = initIntro(frac).then((ok) => { if (!ok) L.classList.remove('px', 'pxOn'); return ok; });
}
/** Waits for everything tracked, then shows the continue button and resolves on the player's press. */
export async function loaderReady() {
	const L = document.getElementById('loader');
	if (!L) { musicEnterGame(); return; }
	// Wait for promises tracked so far, including any added while waiting.
	for (let n = -1; n !== pending.length; ) { n = pending.length; await Promise.all(pending); }
	done = total; floor = 0; progress();
	await stingDone();
	const pix = await px; if (!pix) preOut();   // DOM splash (no WebGL): the inline loader steps aside
	if (pix && !noIntro()) await introLoaded();   // bar full, game primed behind the doors, TAP TO START up
	L.classList.add('ready');
	// returning players who ticked "Don't show this again" go straight in once loading is done
	if (!noIntro()) await new Promise<void>((res) => {
		const btn = $('#lGo'); btn.focus({ preventScroll: true });
		const go_ = (e?: Event) => { if ((e?.target as Element)?.closest?.('.spSkip')) return; if (e && introEatClick(e)) return; /* v3.18: swipes / taps on the card carousel never enter */ removeEventListener('keydown', key, true); L.removeEventListener('click', go_); res(); };
		const key = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); go_(); } };
		L.addEventListener('click', go_); // tap anywhere on the splash
		addEventListener('keydown', key, { capture: true });
	});
	hideLoader();
	if (pix) await (noIntro() ? (introSkip(), Promise.resolve()) : introEnter());   // doors -> push -> board + Roxy drop (tap skips)
	musicEnterGame();   // music only once the board is revealed
}
/** Fade the loader out into the game (also used to get it out of the way of an error message). */
export function hideLoader() {
	const L = document.getElementById('loader');
	preOut(); if (!L || L.classList.contains('out')) return;
	if (!L.classList.contains('ready')) introSkip();   // error before the tap: no half-open doors over the message
	L.classList.add('out');
	setTimeout(() => L.remove(), 700);
}
