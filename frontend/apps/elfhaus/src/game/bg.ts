// Room background. Free spins no longer swap in a separate painting (audit M11): the Pixi foyer crossfades to its own
// night "party" version (scene/party.ts) via sceneBonus(). #bg only shows when WebGL is unavailable: then it is the base
// painting, and in the bonus the `body.inBonus #bg:not(.fs)` tint eases in on it.
// No flash: the target image is preloaded + decoded before the swap, and the old picture (with the filter it had) is held
// on #bgFade above #bg and faded out on opacity only. Call setBg(next) BEFORE toggling body.inBonus.
import { ART } from './ui';
import { ST } from './stage';
import { setAlcoveFs, warmAlcove } from './alcove';
import { sceneBonus } from './scene/scene';

const ready = new Map<string, Promise<void>>();
/** Fetch + decode an image once (resolves even on error so the swap never hangs). */
export const preload = (url: string) => {
	let p = ready.get(url);
	if (!p) { const im = new Image(); im.src = url; p = im.decode().catch(() => {}); ready.set(url, p); }
	return p;
};
const pick = (bonus: boolean, portrait: boolean) => {
	void bonus; return { url: (portrait && ART.background_portrait) || ART.background || null, fs: false };
};
let cur = '', seq = 0; // cur = `${url}|${tinted}` currently shown
/** Show the base or bonus background for the current orientation. Idempotent; fades only when the picture or tint changes. */
export function setBg(bonus: boolean, fade = true) {
	sceneBonus(bonus, !cur || !fade); // room layer (Pixi foyer) crossfades to its party version; instant on first paint
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
		Object.assign(hold.style, { backgroundImage: cs.backgroundImage, backgroundSize: cs.backgroundSize, backgroundPosition: cs.backgroundPosition, filter: cs.filter, opacity: '1' });
	}
	const apply = () => {
		if (my !== seq) return; // a newer swap won
		bg.classList.add('art'); bg.style.backgroundImage = `url(${url})`; bg.classList.toggle('fs', fs);
		// the room is the Pixi scene (scene/room.ts eases its own plate); this DOM plate only shows without WebGL, so it swaps
		if (hold) { hold.style.backgroundImage = 'none'; hold.style.opacity = '0'; }
	};
	if (first) apply(); else void preload(url).then(apply);
}
/** Warm the other state's picture (idle) so the first bonus swap is instant. */
export function warmBg() {
	const go = () => { for (const b of [true, false]) { const u = pick(b, ST.portrait).url; if (u) void preload(u); } if (!document.body.classList.contains('mk')) warmAlcove(preload); };
	'requestIdleCallback' in window ? (window as any).requestIdleCallback(go, { timeout: 3000 }) : setTimeout(go, 1500);
}
