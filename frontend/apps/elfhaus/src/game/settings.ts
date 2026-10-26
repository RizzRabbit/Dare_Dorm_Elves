// aifix 13 (audit 24): minimal settings panel at the top of the menu. v3.8: Sound (master), Music and Sound effects
// switches (audio.ts, persisted as elfhaus.snd / .mus / .sfx). Turbo mirrors the HUD turbo button; Calm motion
// switches off the idle loops (win bob/pulse, splash pulse, alcove twinkle) like prefers-reduced-motion. Calm motion
// leaves sound alone (independent).
import { $, S } from './ui';
import { audioPrefs, setAudioPref } from './audio';

const KEY = 'elfhaus.calm';
const sw = (el: HTMLElement, on: boolean) => { el.classList.toggle('on', on); el.setAttribute('aria-checked', String(on)); };

export function syncSettings() {
	sw($('#setTurbo'), !!S.turbo);
	sw($('#setCalm'), document.body.classList.contains('calm'));
	const a = audioPrefs();
	sw($('#setSnd'), a.snd && !a.muted); sw($('#setMus'), a.mus); sw($('#setSfx'), a.sfx);
	$('#setMusRow').classList.toggle('dim', !(a.snd && !a.muted)); $('#setSfxRow').classList.toggle('dim', !(a.snd && !a.muted));
	$('#setTurboRow').style.display = $('#turboBtn').style.visibility === 'hidden' ? 'none' : '';
}

export function initSettings() {
	let calm = false;
	try { calm = localStorage.getItem(KEY) === '1'; } catch { /* storage blocked */ }
	document.body.classList.toggle('calm', calm);
	$('#setTurbo').onclick = () => { $('#turboBtn').click(); syncSettings(); };
	$('#setSnd').onclick = () => { const a = audioPrefs(); setAudioPref('snd', !(a.snd && !a.muted)); syncSettings(); };
	$('#setMus').onclick = () => { setAudioPref('mus', !audioPrefs().mus); syncSettings(); };
	$('#setSfx').onclick = () => { setAudioPref('sfx', !audioPrefs().sfx); syncSettings(); };
	$('#setCalm').onclick = () => {
		const on = !document.body.classList.contains('calm');
		document.body.classList.toggle('calm', on);
		try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* storage blocked */ }
		syncSettings();
	};
}
