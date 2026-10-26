// v3.15 (James): the HUD menu button opens a compact pop-out menu anchored above it (ref: Odin's Vault on Stake):
// Info (opens the rules / info screen), Music and Sound. Tapping Music or Sound slides one volume slider out to the
// right of that row (one at a time; the row icon becomes a small X while open; tap the row again to close it).
// Sliders drive audio.ts setAudioVol (elfhaus.musv / .sfxv; 0 = mute; Sound covers effects + voice).
// Closes on the menu button again, a tap outside, or Esc. Replaces the old settings block at the top of the info
// screen (Sound / Music / Sound effects / Voice switches). Turbo stays on the HUD lightning button + bonus menu.
// The OS prefers-reduced-motion setting is still honoured in elfhaus.css.
import { $ } from './ui';
import { audioVol, setAudioVol } from './audio';
import { toStage, ST } from './stage';

type K = 'mus' | 'sfx';
const pop = () => $('#popMenu'), btn = () => $('#menuBtn');
export const popOpen = () => pop().classList.contains('open');
const items = () => Array.from(pop().querySelectorAll<HTMLElement>('.pmItem'));
const range = (k: K) => pop().querySelector<HTMLInputElement>(`.pmItem[data-k="${k}"] input`)!;
const paint = (k: K) => { const r = range(k), v = Math.round(audioVol(k) * 100); r.value = String(v); r.style.setProperty('--v', v + '%'); r.setAttribute('aria-valuetext', v ? v + '%' : 'off'); };

function slide(k: K | null) {
	for (const it of items()) {
		const on = it.dataset.k === k; it.classList.toggle('open', on);
		it.querySelector('.pmRow')!.setAttribute('aria-expanded', String(on));
		range(it.dataset.k as K).tabIndex = on ? 0 : -1;
	}
	if (k) { paint(k); range(k).focus({ preventScroll: true }); }
}
function place() {
	const r = toStage(btn().getBoundingClientRect()), P = pop(), z = parseFloat(getComputedStyle(P).zoom) || 1; // CSS zoom scales left/bottom too
	P.style.left = Math.max(8, r.left) / z + 'px'; P.style.bottom = Math.max(8, ST.h - r.top + 10) / z + 'px';
}
export function openPop() {
	place(); slide(null); paint('mus'); paint('sfx');
	pop().classList.add('open'); pop().setAttribute('aria-hidden', 'false'); btn().setAttribute('aria-expanded', 'true');
	$('#pmInfo').focus({ preventScroll: true });
}
export function closePop(refocus = false) {
	if (!popOpen()) return;
	slide(null); pop().classList.remove('open'); pop().setAttribute('aria-hidden', 'true'); btn().setAttribute('aria-expanded', 'false');
	if (refocus) btn().focus({ preventScroll: true });
}

export function initSettings(openInfo: () => void) {
	btn().onclick = () => (popOpen() ? closePop() : openPop());
	$('#pmInfo').onclick = () => { closePop(); openInfo(); };
	for (const it of items()) {
		const k = it.dataset.k as K, r = range(k);
		it.querySelector<HTMLElement>('.pmRow')!.onclick = () => slide(it.classList.contains('open') ? null : k);
		r.oninput = () => { setAudioVol(k, Number(r.value) / 100); paint(k); };
	}
	// a tap outside closes it (the menu button toggles it itself)
	document.addEventListener('pointerdown', (e) => { const t = e.target as Element; if (popOpen() && !t.closest?.('#popMenu,#menuBtn')) closePop(); }, true);
	addEventListener('keydown', (e) => {
		if (!popOpen()) return;
		if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePop(true); }
		else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			if ((e.target as Element)?.closest?.('input')) return; // the slider keeps its own arrow keys
			const rows = Array.from(pop().querySelectorAll<HTMLElement>('.pmRow')), i = rows.indexOf(document.activeElement as HTMLElement);
			e.preventDefault(); rows[(i + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length].focus();
		}
	}, true);
}
