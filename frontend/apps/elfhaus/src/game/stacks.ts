// Stacked / merged wild sheets (MERGE_ANIM.md): drop-in, optional. `node scripts/import-art.mjs stacks <dir>` copies
// <anim>_<variant>.{webp,json} into static/assets/stacks/ and lists them in index.json; this module loads whatever
// is listed. Anything missing keeps today's placeholder (static WF / WM2-WM5 image + CSS letters), per sheet, so
// the art can land one sheet at a time. Variants: WF (single full reel), WM2..WM5 (merged widths).
//   stack_form      once, when a reel completes (stackIn)            -> then merge_idle
//   merge_join      once, at the merge hit (mergeIn)                 -> then merge_idle
//   letters_ignite  once at the letters beat, holds its last frame   (replaces the CSS .mLets letters)
//   merge_idle      loop while the overlay is on the board
//   merge_win       loop while a winning line runs through it (ovWin / clearOvWins)
// Sheets use the sym_<K> atlas schema {image?, anims:{name:{fps,loop,frames:[[x,y,w,h]...]}}, size:[W,H]}; the
// anim played is the one named like the file's anim (or the first one). Each frame is drawn over the whole
// overlay (frames are made at the overlay's aspect: 256 x 1024 per reel). Transform / opacity only.
import { loadSheet, play, hasSheet, stop, type Atlas, type Anim } from './sprite';

export type StackAnim = 'stack_form' | 'merge_join' | 'letters_ignite' | 'merge_idle' | 'merge_win';
const DIR = 'assets/stacks/';
const listed = new Set<string>(), names = new Map<string, string>();
let ready: Promise<void> | null = null;

/** Load every listed stack sheet (in the background; a missing index.json just means "placeholders"). */
export function initStacks() {
	return (ready ||= fetch(DIR + 'index.json').then((r) => (r.ok ? r.json() : { sheets: [] })).catch(() => ({ sheets: [] }))
		.then(async (ix: { sheets?: string[] }) => {
			await Promise.all((ix.sheets || []).map(async (id) => {
				try {
					const atlas = (await (await fetch(`${DIR}${id}.json`)).json()) as Atlas & { image?: string };
					const anim = id.replace(/_(WF|WM[2-5])$/, '');
					names.set(id, atlas.anims[anim] ? anim : Object.keys(atlas.anims)[0]);
					await loadSheet(id, DIR + (atlas.image || id + '.webp'), atlas); listed.add(id);
				} catch (e) { console.warn('stack sheet', id, e); }
			}));
			if (listed.size) document.body.classList.add('hasStacks');
		}));
}
const variant = (ov: HTMLElement) => (ov.classList.contains('merge') ? `WM${(ov.dataset.reels || '').split(',').filter(Boolean).length}` : 'WF');
/** Is the sheet for this overlay's width there? */
export const hasStack = (a: StackAnim, ov: HTMLElement) => listed.has(`${a}_${variant(ov)}`) && hasSheet(`${a}_${variant(ov)}`);
const live = new WeakMap<HTMLElement, Partial<Record<'body' | 'letters' | 'win', Anim>>>();
function run(a: StackAnim, ov: HTMLElement, layer: 'body' | 'letters' | 'win', o: { loop?: boolean; hold?: boolean; onEnd?: () => void } = {}) {
	if (!hasStack(a, ov)) return null;
	const id = `${a}_${variant(ov)}`, slots = live.get(ov) || {};
	const old = slots[layer]; if (old && !old.done) stop(old);
	const an = play(id, names.get(id)!, ov, { cls: `stk stk_${layer}`, loop: o.loop, hold: o.hold, onEnd: o.onEnd });
	if (an) { slots[layer] = an; live.set(ov, slots); } // CSS (:has canvas.stk_<layer>) hides the placeholder it replaces
	return an;
}
/** Idle loop on an overlay (called for every overlay after each render). */
export function stackIdle(ov: HTMLElement) { if (!live.get(ov)?.body || live.get(ov)!.body!.done) run('merge_idle', ov, 'body', { loop: true }); stackLetters(ov, true); }
/** A one-shot (stack_form / merge_join) and then the idle loop. Resolves when the one-shot ends (or at once if absent). */
export function stackOnce(a: 'stack_form' | 'merge_join', ov: HTMLElement) {
	return new Promise<void>((res) => { if (!run(a, ov, 'body', { onEnd: () => { run('merge_idle', ov, 'body', { loop: true }); res(); } })) res(); });
}
/** Letters overlay: ignite (or, after a re-render, show the held last frame at once). */
export function stackLetters(ov: HTMLElement, settled = false) {
	const an = run('letters_ignite', ov, 'letters', { hold: true });
	if (an && settled) an.t0 -= 1e5; // jump to the held last frame
	return !!an;
}
export function stackWin(ov: HTMLElement) { run('merge_win', ov, 'win', { loop: true }); }
export function stackWinOff(ov: HTMLElement) { const w = live.get(ov)?.win; if (w && !w.done) stop(w); }
