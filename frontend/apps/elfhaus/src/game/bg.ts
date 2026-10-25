// Room background: base painting, or the dedicated free-spins painting while S.inBonus.
//   landscape bonus: ART.background_fs; portrait bonus: ART.background_fs_portrait. #bg gets class `fs` with a dedicated
//   image, so the `body.inBonus #bg:not(.fs)` tint drops off. No dedicated image for the orientation (e.g. the portrait
//   bonus file not imported yet) -> the base painting stays and keeps the tint.
// No flash: the target image is preloaded + decoded before the swap, and the old picture (with the filter it had) is held
// on #bgFade above #bg and faded out on opacity only. Call setBg(next) BEFORE toggling body.inBonus.
import { ART } from './ui';
import { ST } from './stage';
import { setAlcoveFs, warmAlcove } from './alcove';

const FADE_MS = 450;
const ready = new Map<string, Promise<void>>();
/** Fetch + decode an image once (resolves even on error so the swap never hangs). */
export const preload = (url: string) => {
	let p = ready.get(url);
	if (!p) { const im = new Image(); im.src = url; p = im.decode().catch(() => {}); ready.set(url, p); }
	return p;
};
const pick = (bonus: boolean, portrait: boolean) => {
	const fs = bonus ? (portrait ? ART.background_fs_portrait : ART.background_fs) : null;
	return fs ? { url: fs, fs: true } : { url: (portrait && ART.background_portrait) || ART.background || null, fs: false };
};
let cur = '', seq = 0; // cur = `${url}|${tinted}` currently shown
/** Show the base or bonus background for the current orientation. Idempotent; fades only when the picture or tint changes. */
export function setBg(bonus: boolean, fade = true) {
	setAlcoveFs(bonus); // board frame: _fs crown / recess fade in on opacity (alcove.ts), same timing as the plate
	const bg = document.getElementById('bg'); if (!bg) return;
	const { url, fs } = pick(bonus, ST.portrait);
	if (!url) { bg.classList.toggle('fs', false); return; }
	// key includes the tint state: portrait without its own bonus file keeps the base picture, but the tint still eases in
	const key = `${url}|${bonus && !fs}`;
	if (key === cur) { bg.classList.toggle('fs', fs); return; }
	const first = !cur; cur = key;
	const my = ++seq;
	// hold the old picture as it looks right now (its filter included) so the body.inBonus toggle can't show through
	let hold: HTMLElement | null = null;
	if (!first && fade) {
		hold = document.getElementById('bgFade');
		if (!hold) { hold = document.createElement('div'); hold.id = 'bgFade'; bg.after(hold); }
		const cs = getComputedStyle(bg);
		hold.getAnimations().forEach((a) => a.cancel());
		Object.assign(hold.style, { backgroundImage: cs.backgroundImage, backgroundSize: cs.backgroundSize, backgroundPosition: cs.backgroundPosition, filter: cs.filter, opacity: '1' });
	}
	const apply = () => {
		if (my !== seq) return; // a newer swap won
		bg.classList.add('art'); bg.style.backgroundImage = `url(${url})`; bg.classList.toggle('fs', fs);
		if (hold) {
			const h = hold;
			requestAnimationFrame(() => h.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'ease-out', fill: 'forwards' })
				.finished.then(() => { if (my === seq) { h.style.backgroundImage = 'none'; h.style.opacity = '0'; } }).catch(() => {}));
		}
	};
	if (first) apply(); else void preload(url).then(apply);
}
/** Warm the other state's picture (idle) so the first bonus swap is instant. */
export function warmBg() {
	const go = () => { for (const b of [true, false]) { const u = pick(b, ST.portrait).url; if (u) void preload(u); } warmAlcove(preload); };
	'requestIdleCallback' in window ? (window as any).requestIdleCallback(go, { timeout: 3000 }) : setTimeout(go, 1500);
}
