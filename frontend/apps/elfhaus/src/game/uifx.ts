// UI sprites (fx_btn sheet, gen_fx_feat.py): spin-button press ring, the armed halo loop (a bonus / Ante is armed),
// a small tap ring on the other HUD buttons, and the loading-screen "continue" pulse. Glow is baked into the sheet;
// CSS animates only transform (the press squash). Loops run only while their state is on.
import { play, stop, hasSheet, type Anim } from './sprite';
const ID = 'fx_btn';
let armedAnim: Anim | null = null;

function host(btn: HTMLElement, cls: string) {
	let h = btn.querySelector<HTMLElement>(':scope > .' + cls);
	if (!h) { h = document.createElement('span'); h.className = 'uiFx ' + cls; h.setAttribute('aria-hidden', 'true'); btn.appendChild(h); }
	return h;
}
export function spinPress(btn: HTMLElement) {
	btn.classList.remove('pressed'); void btn.offsetWidth; btn.classList.add('pressed');
	if (hasSheet(ID)) play(ID, 'press', host(btn, 'uiRing'), { cls: 'uiFill' });
}
export function tapRing(btn: HTMLElement) { if (hasSheet(ID)) play(ID, 'tap', host(btn, 'uiTap'), { cls: 'uiFill' }); }
export function setArmedGlow(btn: HTMLElement, on: boolean) {
	if (on && !armedAnim && hasSheet(ID)) armedAnim = play(ID, 'armed', host(btn, 'uiHalo'), { loop: true, cls: 'uiFill' });
	else if (!on && armedAnim) { stop(armedAnim); armedAnim = null; }
}
/** Press feedback on the HUD buttons (one delegated listener). */
export function wireTapFx() {
	document.addEventListener('pointerdown', (e) => {
		const b = (e.target as Element)?.closest?.<HTMLElement>('#hud button');
		if (!b || (b as HTMLButtonElement).disabled) return;
		if (b.id === 'spinBtn') spinPress(b); else tapRing(b);
	}, { passive: true });
}
