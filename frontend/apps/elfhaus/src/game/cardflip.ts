// Dare Card flip (cardFlip event: 5 scatters on a base / ante / Mystery board). The card lifts and turns edge-on
// (card_flip, loaded with the fx sheets), then the outcome face turns up (card_triple | card_epic .reveal) and holds
// on its loop. The two outcome sheets are lazy: fetched when the flip starts, released after it.
import { $, S, wait } from './ui';
import { TIER_LABEL } from './config';
import { loadSheet, hasSheet, play, stop, unloadSheet, type Anim, type Atlas } from './sprite';

const ATL = import.meta.glob('./card/*.json', { eager: true, import: 'default' }) as Record<string, Atlas>;
const IMG = import.meta.glob('../assets/card/*.webp', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;
const sheetOf = (r: 'triple_dare' | 'hidden') => (r === 'hidden' ? 'card_epic' : 'card_triple');
function load(id: string) {
	if (hasSheet(id)) return Promise.resolve();
	const src = Object.entries(IMG).find(([p]) => p.endsWith('/' + id + '.webp'))?.[1], atlas = ATL['./card/' + id + '.json'];
	return src && atlas ? loadSheet(id, src, atlas).catch((e) => console.warn('card sheet', id, e)) : Promise.resolve();
}

export async function cardFlip(result: 'triple_dare' | 'hidden') {
	const id = sheetOf(result), ready = load(id);
	const O = $('#cardFlip'), host = O.querySelector<HTMLElement>('.cfCard')!, name = O.querySelector<HTMLElement>('.cfName')!;
	name.textContent = ''; name.classList.remove('pop'); O.dataset.tier = result;
	O.classList.remove('hidden');
	const anims: Anim[] = [];
	const run = (sheet: string, anim: string, o: Parameters<typeof play>[3] = {}) => { const a = play(sheet, anim, host, { cls: 'fxFill', ...o }); if (a) anims.push(a); return a; };
	let skip = () => {}; const tapped = new Promise<void>((r) => (skip = r)); O.onclick = () => skip();
	await wait(S.turbo ? 150 : 350);
	await new Promise<void>((res) => { if (!run('card_flip', 'flip', { hold: true, onEnd: () => res() })) res(); });
	await ready;
	const prev = anims.slice();
	await new Promise<void>((res) => { if (!run(id, 'reveal', { hold: true, onEnd: () => res() })) res(); requestAnimationFrame(() => requestAnimationFrame(() => prev.forEach(stop))); });
	const rv = anims[anims.length - 1]; run(id, 'loop'); requestAnimationFrame(() => requestAnimationFrame(() => rv && stop(rv)));
	name.textContent = TIER_LABEL[result].toUpperCase() + '!'; void name.offsetWidth; name.classList.add('pop');
	await Promise.race([wait(S.turbo ? 900 : 1700), tapped]);
	O.onclick = null; O.classList.add('out'); await wait(250);
	anims.forEach(stop); host.querySelectorAll('canvas').forEach((c) => c.remove());
	O.classList.add('hidden'); O.classList.remove('out');
	unloadSheet(id);
}
