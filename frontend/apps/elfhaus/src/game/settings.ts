// v3.15 (James): the HUD menu button opens a compact pop-out menu anchored above it (ref: Odin's Vault on Stake):
// Info (opens the rules / info screen), Music and Sound. Tapping Music or Sound slides one volume slider out to the
// right of that row (one at a time; the row icon becomes a small X while open; tap the row again to close it).
// Sliders drive audio.ts setAudioVol (elfhaus.musv / .sfxv; 0 = mute; Sound covers effects + voice).
// Closes on the menu button again, a tap outside, or Esc. Replaces the old settings block at the top of the info
// screen (Sound / Music / Sound effects / Voice switches). Turbo stays on the HUD lightning button + bonus menu.
// The OS prefers-reduced-motion setting is still honoured in elfhaus.css.
import { $ } from './ui';
import { audioVol, setAudioVol, audioPrefs, setAudioPref } from './audio';
import { toStage, ST } from './stage';
import { openPanel, registerPanel } from './panels';

type K = 'mus' | 'sfx';
const pop = () => $('#popMenu'), btn = () => $('#menuBtn');
export const popOpen = () => pop().classList.contains('open');
const items = () => Array.from(pop().querySelectorAll<HTMLElement>('.pmItem'));
const range = (k: K) => pop().querySelector<HTMLInputElement>(`.pmItem[data-k="${k}"] input`)!;
const paint = (k: K) => { const r = range(k), v = Math.round(audioVol(k) * 100); r.value = String(v); r.style.setProperty('--v', v + '%'); r.parentElement?.style.setProperty('--v', v + '%'); r.setAttribute('aria-valuetext', v ? v + '%' : 'off'); dispatchEvent(new Event('elfhaus:audio')); };
// uifix: the painted row icons (skin.ts) read the live volume / mute state from here
(window as any).__elfAudio = () => ({ muted: muted(), mus: audioVol('mus'), sfx: audioVol('sfx') });

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
	P.style.left = Math.max(8, r.left) / z + 'px';
	// the menu button sits at the top of the stage (approved board: top-left corner; phone landscape rail): open downward
	if (ST.phl || r.top + r.height / 2 < ST.h / 2) { P.style.bottom = ''; P.style.top = (r.bottom + 10) / z + 'px'; P.style.transformOrigin = '0 0'; }
	else { P.style.top = ''; P.style.bottom = Math.max(8, ST.h - r.top + 10) / z + 'px'; P.style.transformOrigin = ''; }
}
// re-audit L6: one-tap mute (master Sound switch; the volumes are kept for un-mute)
const muted = () => { const p = audioPrefs(); return !p.snd || p.muted; };
function paintMute() { const m = muted(), b = $('#pmMute'); b.setAttribute('aria-checked', String(m)); b.classList.toggle('on', m); b.querySelector(':scope > span')!.textContent = m ? 'Unmute' : 'Mute all'; dispatchEvent(new Event('elfhaus:audio')); }
export function openPop() {
	place(); slide(null); paint('mus'); paint('sfx'); paintMute();
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
	$('#pmMute').onclick = () => { setAudioPref('snd', muted()); slide(null); paint('mus'); paint('sfx'); paintMute(); };
	for (const it of items()) {
		const k = it.dataset.k as K, r = range(k);
		it.querySelector<HTMLElement>('.pmRow')!.onclick = () => slide(it.classList.contains('open') ? null : k);
		r.oninput = () => { setAudioVol(k, Number(r.value) / 100); paint(k); };
	}
	// a tap outside closes it (the menu button toggles it itself)
	document.addEventListener('pointerdown', (e) => { const t = e.target as Element; if (popOpen() && !t.closest?.('#popMenu,#menuBtn,#uiStage')) closePop(); }, true);
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

// ---- fix2 Settings panel (#settings): Sound on/off, Music / Effects volume (painted sliders), Turbo ----
function paintSettings(turbo: () => boolean) {
	const snd = !muted(), sw = $('#stSnd'); sw.classList.toggle('on', snd); sw.setAttribute('aria-checked', String(snd));
	const t = turbo(), ts = $('#stTurbo'); ts.classList.toggle('on', t); ts.setAttribute('aria-checked', String(t));
	document.querySelectorAll<HTMLElement>('#settings .stSl').forEach((el) => {
		const v = Math.round(audioVol(el.dataset.k as K) * 100); el.style.setProperty('--v', String(v / 100));
		el.setAttribute('aria-valuenow', String(v)); el.setAttribute('aria-valuetext', v ? v + '%' : 'off');
	});
}
/** turbo: read / toggle hooks from game.ts (the HUD lightning + bonus-menu switch stay in sync through them) */
export function initSettingsPanel(turbo: () => boolean, toggleTurbo: () => void) {
	registerPanel('#settings');
	const P = () => paintSettings(turbo);
	$('#pmSettings').onclick = () => { closePop(); P(); openPanel('#settings'); };
	$('#stSnd').onclick = () => { setAudioPref('snd', muted()); P(); };
	$('#stTurbo').onclick = () => { toggleTurbo(); P(); };
	document.querySelectorAll<HTMLElement>('#settings .stSl').forEach((el) => {
		const k = el.dataset.k as K;
		const set = (v: number) => { setAudioVol(k, Math.round(Math.min(1, Math.max(0, v)) * 20) / 20); P(); };
		const at = (e: PointerEvent) => { const r = el.getBoundingClientRect(); set((e.clientX - r.left) / r.width); };
		el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); at(e); });
		el.addEventListener('pointermove', (e) => { if (el.hasPointerCapture(e.pointerId)) at(e); });
		el.addEventListener('keydown', (e) => { const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 0.05 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -0.05 : 0; if (d) { e.preventDefault(); set(audioVol(k) + d); } });
	});
	P();
}
