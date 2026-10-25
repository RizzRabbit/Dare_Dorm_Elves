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
	// aifix: the flat paper-rectangle confetti loop read as placeholder; banners open on the soft burst only
	void portrait; void keep;
	featBurst(fx);
}
export function featBurst(fx: HTMLElement | null) {
	if (!fx || !hasSheet(ID)) return;
	// aifix (audit 18, circle leftovers): the spoked ring burst behind banner titles is off; the title's own neon stays
	void play;
}
/** Star glints over a title that just swapped in. */
export function featPop(title: HTMLElement | null) {
	void title; // aifix: the pop sheet is four-point stars; the tier title keeps its own CSS pop (transform only)
}
export function featClose(fx: HTMLElement | null) {
	if (!fx) return;
	(live.get(fx) || []).forEach((a) => stop(a)); live.delete(fx);
	fx.querySelectorAll('.ffConf,.ffBurst').forEach((e) => e.remove());
}
