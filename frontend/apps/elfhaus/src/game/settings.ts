// aifix 13 (audit 24): minimal settings panel at the top of the menu. The game ships no audio (no Audio/WebAudio,
// no sound files), so there is deliberately no sound toggle. Turbo mirrors the HUD turbo button; Calm motion
// switches off the idle loops (win bob/pulse, splash pulse, alcove twinkle) like prefers-reduced-motion.
import { $, S } from './ui';

const KEY = 'elfhaus.calm';
const sw = (el: HTMLElement, on: boolean) => { el.classList.toggle('on', on); el.setAttribute('aria-checked', String(on)); };

export function syncSettings() {
	sw($('#setTurbo'), !!S.turbo);
	sw($('#setCalm'), document.body.classList.contains('calm'));
	$('#setTurboRow').style.display = $('#turboBtn').style.visibility === 'hidden' ? 'none' : '';
}

export function initSettings() {
	let calm = false;
	try { calm = localStorage.getItem(KEY) === '1'; } catch { /* storage blocked */ }
	document.body.classList.toggle('calm', calm);
	$('#setTurbo').onclick = () => { $('#turboBtn').click(); syncSettings(); };
	$('#setCalm').onclick = () => {
		const on = !document.body.classList.contains('calm');
		document.body.classList.toggle('calm', on);
		try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* storage blocked */ }
		syncSettings();
	};
}
