// Loading screen: full ELFHAUS logo, feature-card carousel, progress bar, then CLICK/TAP TO CONTINUE (the press is
// the user gesture later sound needs). Progress counts every tracked promise: art images, Roxy sheets, RGS/mock auth.
import { $, ART } from './ui';

// Card titles (checked by the social-mode word scan in scripts/test-books.mjs).
export const LOADER_CARDS = [
	'Sticky Wilds, Respins and Growing Multipliers',
	'Dare, Double Dare, Triple Dare and Elves Gone Wild Feature Spins',
	'50,000x Max Win',
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
const loadImg = (src: string) => new Promise<void>((res, rej) => { const i = new Image(); i.onload = () => res(); i.onerror = rej; i.src = src; });
/** Preload every art file from the manifest. */
export function preloadArt() {
	for (const src of new Set((Object.values(ART).filter(Boolean) as string[]).filter((u) => !/\.(webm|mp4)$/i.test(u)))) track(loadImg(src)).catch(() => console.warn('art missing', src));
}

// ---------- carousel ----------
let idx = 0, timer = 0;
function go(i: number) {
	const n = LOADER_CARDS.length; idx = ((i % n) + n) % n;
	($('#lTrack')).style.transform = `translateX(${-idx * 100}%)`;
	document.querySelectorAll('#lDots button').forEach((d, j) => d.classList.toggle('on', j === idx));
	clearInterval(timer); timer = window.setInterval(() => go(idx + 1), 4000);
}
function wireCarousel() {
	const view = $('#lCards'), track_ = $('#lTrack');
	document.querySelectorAll('#lDots button').forEach((d, j) => ((d as HTMLElement).onclick = () => go(j)));
	let x0 = 0, dx = 0, drag = false;
	view.addEventListener('pointerdown', (e) => {
		drag = true; x0 = e.clientX; dx = 0; view.setPointerCapture(e.pointerId);
		track_.style.transition = 'none'; clearInterval(timer);
	});
	view.addEventListener('pointermove', (e) => {
		if (!drag) return;
		dx = e.clientX - x0;
		track_.style.transform = `translateX(calc(${-idx * 100}% + ${dx}px))`;
	});
	const end = () => {
		if (!drag) return;
		drag = false; track_.style.transition = '';
		const th = Math.min(60, view.clientWidth * 0.15);
		go(dx < -th ? idx + 1 : dx > th ? idx - 1 : idx);
	};
	view.addEventListener('pointerup', end); view.addEventListener('pointercancel', end);
	go(0);
}

export function initLoader() {
	if (!document.getElementById('loader')) return;
	wireCarousel(); progress();
}
/** Waits for everything tracked, then shows the continue button and resolves on the player's press. */
export async function loaderReady() {
	const L = document.getElementById('loader');
	if (!L) return;
	// Wait for promises tracked so far, including any added while waiting.
	for (let n = -1; n !== pending.length; ) { n = pending.length; await Promise.all(pending); }
	done = total; progress();
	const touch = matchMedia('(pointer: coarse)').matches;
	const btn = $('#lGo');
	btn.textContent = touch ? 'TAP TO CONTINUE' : 'CLICK TO CONTINUE';
	L.classList.add('ready');
	btn.focus({ preventScroll: true });
	await new Promise<void>((res) => {
		const go_ = () => { removeEventListener('keydown', key); res(); };
		const key = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); go_(); } };
		btn.onclick = go_;
		addEventListener('keydown', key, { capture: true });
	});
	hideLoader();
}
/** Fade the loader out into the game (also used to get it out of the way of an error message). */
export function hideLoader() {
	const L = document.getElementById('loader');
	if (!L || L.classList.contains('out')) return;
	clearInterval(timer);
	L.classList.add('out');
	setTimeout(() => L.remove(), 700);
}
