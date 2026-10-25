// Feature moments (fx_feat sheet, gen_fx_feat.py): burst behind a banner title, small star pop when a tier title
// swaps in, matte confetti loop while a banner is up. Calm: these play only when a big-win / free-spin banner opens.
// Sprites only (glow baked in); CSS animates transform/opacity; every anim stops when its banner closes.
import { play, stop, hasSheet, type Anim } from './sprite';
const ID = 'fx_feat';
const live = new Map<HTMLElement, Anim[]>();
const keep = (host: HTMLElement, a: Anim | null) => { if (a) (live.get(host) || live.set(host, []).get(host)!).push(a); };

/** Burst + confetti for an overlay; `fx` is its .bwFx layer (behind the text). */
export function featOpen(fx: HTMLElement | null) {
	if (!fx || !hasSheet(ID)) return;
	featClose(fx);
	const portrait = document.body.classList.contains('portrait');
	for (let i = 0; i < (portrait ? 3 : 1); i++) {
		const t = document.createElement('div'); t.className = 'ffConf'; if (portrait) { t.style.top = i * 33.4 + '%'; t.style.height = '33.4%'; }
		fx.appendChild(t); keep(fx, play(ID, 'confetti', t, { loop: true, delay: 150 + i * 270, cls: 'ffFill' }));
	}
	featBurst(fx);
}
export function featBurst(fx: HTMLElement | null) {
	if (!fx || !hasSheet(ID)) return;
	let b = fx.querySelector<HTMLElement>('.ffBurst'); if (!b) { b = document.createElement('div'); b.className = 'ffBurst'; fx.appendChild(b); }
	play(ID, 'burst', b, { cls: 'ffFill' });
}
/** Star glints over a title that just swapped in. */
export function featPop(title: HTMLElement | null) {
	if (!title || !hasSheet(ID)) return;
	play(ID, 'pop', title, { cls: 'ffPop' });
}
export function featClose(fx: HTMLElement | null) {
	if (!fx) return;
	(live.get(fx) || []).forEach((a) => stop(a)); live.delete(fx);
	fx.querySelectorAll('.ffConf,.ffBurst').forEach((e) => e.remove());
}
