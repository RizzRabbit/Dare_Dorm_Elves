// aifix 13 (audit 24): minimal settings panel at the top of the menu. v3.8: Sound (master), Music and Sound effects
// switches (audio.ts, persisted as elfhaus.snd / .mus / .sfx). v3.9: Voice (elfhaus.vox, greyed while Sound is off);
// a tap anywhere on a row toggles its switch (bigger touch target, same layout).
// v3.13 (James): Turbo moved to the bonus menu (game.ts setTurbo; the HUD lightning button stays) and the Calm motion
// switch is gone. The OS prefers-reduced-motion setting is still honoured in elfhaus.css.
import { $ } from './ui';
import { audioPrefs, setAudioPref } from './audio';

const sw = (el: HTMLElement, on: boolean) => { el.classList.toggle('on', on); el.setAttribute('aria-checked', String(on)); };

export function syncSettings() {
	const a = audioPrefs();
	sw($('#setSnd'), a.snd && !a.muted); sw($('#setMus'), a.mus); sw($('#setSfx'), a.sfx); sw($('#setVox'), a.vox);
	for (const r of ['#setMusRow', '#setSfxRow', '#setVoxRow']) $(r).classList.toggle('dim', !(a.snd && !a.muted));
}

export function initSettings() {
	$('#setSnd').onclick = () => { const a = audioPrefs(); setAudioPref('snd', !(a.snd && !a.muted)); syncSettings(); };
	$('#setMus').onclick = () => { setAudioPref('mus', !audioPrefs().mus); syncSettings(); };
	$('#setSfx').onclick = () => { setAudioPref('sfx', !audioPrefs().sfx); syncSettings(); };
	$('#setVox').onclick = () => { setAudioPref('vox', !audioPrefs().vox); syncSettings(); };
	document.querySelectorAll<HTMLElement>('#settings .setRow').forEach((row) => {
		const b = row.querySelector<HTMLElement>('.sw');
		if (b) row.onclick = (e) => { if (!(e.target as Element).closest('.sw')) b.click(); };
	});
}
