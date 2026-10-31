// Ski Pass flip (cardFlip event: 5 scatters on a base / ante / Secret Santa board). The pass lifts with a squash,
// turns over in 3D (CSS transforms on two faces, real-time WAAPI) and shows the outcome: the hand-lettered bonus title
// over the elves that run it (Double Black = the 3-elf group, Powder Day = all five). Tap skips the hold.
import { $, S, ART, wait, titleHTML } from './ui';
import { TIER_LABEL } from './config';

const BACK: Record<'triple_dare' | 'hidden', string> = { triple_dare: 'assets/stacks/still/WM3_R2-4.webp', hidden: 'assets/stacks/still/WM5_R1-5.webp' };

export async function cardFlip(result: 'triple_dare' | 'hidden') {
	const O = $('#cardFlip'), host = O.querySelector<HTMLElement>('.cfCard')!, name = O.querySelector<HTMLElement>('.cfName')!;
	const label = TIER_LABEL[result].toUpperCase() + '!';
	name.innerHTML = ''; name.classList.remove('pop'); O.dataset.tier = result;
	host.innerHTML = `<div class="cpPass"><div class="cpFace cpFront">${ART.S ? `<img src="${ART.S}" alt="" draggable="false">` : ''}</div>` +
		`<div class="cpFace cpBack"><img src="${BACK[result]}" alt="" draggable="false"></div></div>`;
	const pass = host.querySelector<HTMLElement>('.cpPass')!;
	O.classList.remove('hidden');
	let skip = () => {}; const tapped = new Promise<void>((r) => (skip = r)); O.onclick = () => skip();
	const k = S.turbo ? 0.45 : 1;
	await pass.animate([{ transform: 'translateY(30%) scale(.6)', opacity: 0 }, { transform: 'translateY(-4%) scale(1.06,.94)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }],
		{ duration: 360 * k, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'forwards' }).finished;
	await wait(S.turbo ? 80 : 260);
	// anticipation: a little crouch and wobble, then the turn
	await pass.animate([{ transform: 'none' }, { transform: 'scale(1.04,.95) rotate(-3deg)', offset: 0.4 }, { transform: 'scale(.97,1.04) rotate(3deg)', offset: 0.75 }, { transform: 'none' }],
		{ duration: 320 * k, easing: 'ease-in-out' }).finished;
	await pass.animate([{ transform: 'perspective(1400px) rotateY(0deg) scale(1)' }, { transform: 'perspective(1400px) rotateY(90deg) scale(1.12)', offset: 0.5 }, { transform: 'perspective(1400px) rotateY(180deg) scale(1)' }],
		{ duration: 560 * k, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'forwards' }).finished;
	name.innerHTML = titleHTML(result, label); void name.offsetWidth; name.classList.add('pop');
	await Promise.race([wait(S.turbo ? 900 : 1700), tapped]);
	O.onclick = null; O.classList.add('out'); await wait(250);
	pass.getAnimations().forEach((a) => a.cancel()); host.innerHTML = '';
	O.classList.add('hidden'); O.classList.remove('out');
}
