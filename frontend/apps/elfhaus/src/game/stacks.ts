// Stacked / merged wild sheets (MERGE_ANIM.md): drop-in, optional. `node scripts/import-art.mjs stacks <dir>` copies
// <anim>_<variant>.{webp,json} into static/assets/stacks/ and lists them in index.json; this module decodes listed
// sheets ON DEMAND (see Memory below). Anything missing keeps today's placeholder (static WF / WM2-WM5 image + CSS letters), per sheet, so
// the art can land one sheet at a time. Variants: WF (single full reel), WM2..WM5 (merged widths).
//   stack_form      once, when a reel completes (stackIn)            -> then merge_idle
//   merge_join      once, at the merge hit (mergeIn)                 -> then merge_idle
//   letters_ignite  once at the letters beat, holds its last frame   (replaces the CSS .mLets letters)
//   merge_idle      loop while the overlay is on the board
//   merge_win       loop while a winning line runs through it (ovWin / clearOvWins)
// Sheets use the sym_<K> atlas schema {image?, anims:{name:{fps,loop,frames:[[x,y,w,h]...]}}, size:[W,H]}; the
// anim played is the one named like the file's anim (or the first one). Each frame is drawn over the whole
// overlay (frames are made at the overlay's aspect: 256 x 1024 per reel). Transform / opacity only.
// Per-position art (stacks_v2): the elf is fixed per reel (1 Roxy, 2 Jade, 3 Vi, 4 Coco, 5 Delilah), so a sheet may carry
// the overlay's reels as a suffix, _R<first>-<last> (1-based; _R<n> for a single full reel), e.g. merge_idle_WM3_R2-4,
// letters_ignite_WF_R5. The suffixed sheet wins; the plain <anim>_<variant> is the fallback, so both kinds can coexist.
// Memory (stacks_anim: 60 per-reel sheets, ~680 MB decoded if all were resident): only index.json is read at start.
//   merge_idle + letters_ignite decode when an overlay needs them (it keeps its placeholder until then, a few frames);
//   merge_join decodes as soon as two or more adjacent single full reels are on the board (during the 2nd stack_form);
//   stack_form decodes when stackPrefetch() reports wilds on that reel (reveal / respin reveal); merge_win when the
//   win starts (the CSS win outline covers the decode). A sheet no overlay / prefetch needs for FREE_MS is closed.
// Letters are a separate layer above the body: idle / join keep the hips rigid after the letters light up; merge_win
// bakes the letters into its frames, so the letters layer is hidden while it plays. letters_ignite restarts with
// stack_form (its leading blank frames wait for the build-up to finish).
import { loadSheet, unloadSheet, play, hasSheet, stop, type Atlas, type Anim } from './sprite';

export type StackAnim = 'stack_form' | 'merge_join' | 'letters_ignite' | 'merge_idle' | 'merge_win';
const DIR = 'assets/stacks/', FREE_MS = 4000, PIN_MS = 20000;
const listed = new Set<string>(), names = new Map<string, string>(), loading = new Map<string, Promise<boolean>>();
const pins = new Map<string, number>(), used = new Map<string, number>(), playing = new Set<string>();
let ready: Promise<void> | null = null;

/** Read index.json (nothing is decoded yet; a missing index just means "placeholders"). */
export function initStacks() {
	return (ready ||= fetch(DIR + 'index.json').then((r) => (r.ok ? r.json() : { sheets: [] })).catch(() => ({ sheets: [] }))
		.then((ix: { sheets?: string[] }) => {
			(ix.sheets || []).forEach((id) => listed.add(id));
			if (listed.size) document.body.classList.add('hasStacks');
		}));
}
/** Decode one listed sheet (once; concurrent callers share the promise). Resolves false when it is not there. */
function ensure(id: string): Promise<boolean> {
	used.set(id, performance.now());
	if (hasSheet(id)) return Promise.resolve(true);
	if (!listed.has(id)) return Promise.resolve(false);
	let p = loading.get(id);
	if (!p) {
		p = fetch(`${DIR}${id}.json`).then((r) => r.json() as Promise<Atlas & { image?: string }>).then(async (atlas) => {
			const anim = id.replace(/_(WF|WM[2-5])(_R[1-5](-[1-5])?)?$/, '');
			names.set(id, atlas.anims[anim] ? anim : Object.keys(atlas.anims)[0]);
			await loadSheet(id, DIR + (atlas.image || id + '.webp'), atlas); used.set(id, performance.now()); sweepSoon(); return true;
		}).catch((e) => { console.warn('stack sheet', id, e); return false; }).finally(() => loading.delete(id));
		loading.set(id, p);
	}
	return p;
}
const variant = (ov: HTMLElement) => (ov.classList.contains('merge') ? `WM${(ov.dataset.reels || '').split(',').filter(Boolean).length}` : 'WF');
const reelsOf = (ov: HTMLElement) => (ov.dataset.reels ?? ov.dataset.reel ?? '').split(',').filter(Boolean).map((x) => +x);
const suffix = (r: number[]) => (r.length ? (r.length === 1 ? `_R${r[0] + 1}` : `_R${r[0] + 1}-${r[r.length - 1] + 1}`) : ''); // 0-based in, 1-based out
const ok = (id: string) => listed.has(id) && hasSheet(id);
/** The sheet id for this anim on this overlay: the reel-specific one if listed, else the plain width one. */
export const sheetId = (a: StackAnim, ov: HTMLElement) => { const pos = `${a}_${variant(ov)}${suffix(reelsOf(ov))}`; return listed.has(pos) ? pos : `${a}_${variant(ov)}`; };
/** Is that sheet decoded and ready to play right now? */
export const hasStack = (a: StackAnim, ov: HTMLElement) => ok(sheetId(a, ov));
/** Is there art for it at all (decoded or not)? Use this to decide between the art and an old placeholder effect. */
export const stackListed = (a: StackAnim, ov: HTMLElement) => listed.has(sheetId(a, ov));
const live = new WeakMap<HTMLElement, Partial<Record<'body' | 'letters' | 'win', Anim>>>();
function run(a: StackAnim, ov: HTMLElement, layer: 'body' | 'letters' | 'win', o: { loop?: boolean; hold?: boolean; onEnd?: () => void } = {}) {
	if (!hasStack(a, ov)) return null;
	const id = sheetId(a, ov), slots = live.get(ov) || {};
	const old = slots[layer]; if (old && !old.done) stop(old);
	used.set(id, performance.now());
	const once = !o.loop && !o.hold; if (once) playing.add(id);
	const an = play(id, names.get(id)!, ov, { cls: `stk stk_${layer}`, loop: o.loop, hold: o.hold, onEnd: () => { if (once) { playing.delete(id); used.set(id, performance.now()); sweepSoon(); } o.onEnd?.(); } });
	if (an) { slots[layer] = an; live.set(ov, slots); } else if (once) playing.delete(id); // CSS (:has canvas.stk_<layer>) hides the placeholder it replaces
	return an;
}
const pin = (id: string) => { if (listed.has(id)) { pins.set(id, performance.now() + PIN_MS); void ensure(id); } };
/** Wilds are on these reels (0-based) and they are not full yet: decode their stack_form sheets ahead of stackComplete. */
export function stackPrefetch(reels: number[]) {
	reels.forEach((r) => { const id = `stack_form_WF${suffix([r])}`; pin(listed.has(id) ? id : 'stack_form_WF'); });
}
/** merge_join ahead of the merge: every run of 2+ adjacent single full reels on the board (only fresh merges of singles use it). */
function prefetchJoins() {
	const full = [...document.querySelectorAll<HTMLElement>('#overlays .ov.full')].map((o) => +o.dataset.reel!).sort((a, b) => a - b);
	for (let i = 0; i < full.length;) {
		let j = i; while (j + 1 < full.length && full[j + 1] === full[j] + 1) j++;
		if (j > i) { const run = full.slice(i, j + 1), id = `merge_join_WM${run.length}${suffix(run)}`; pin(listed.has(id) ? id : `merge_join_WM${run.length}`); }
		i = j + 1;
	}
}
let sweepT = 0;
function sweepSoon() { if (!sweepT) sweepT = window.setTimeout(sweep, FREE_MS); }
/** Close decoded sheets that nothing on the board needs and that were not used for FREE_MS. */
function sweep() {
	sweepT = 0;
	const now = performance.now(), need = new Set<string>(playing);
	document.querySelectorAll<HTMLElement>('#overlays .ov').forEach((ov) => {
		need.add(sheetId('merge_idle', ov)); need.add(sheetId('letters_ignite', ov)); if (ov.classList.contains('win')) need.add(sheetId('merge_win', ov));
	});
	pins.forEach((t, id) => { if (t > now) need.add(id); else pins.delete(id); });
	let left = false;
	listed.forEach((id) => {
		if (!hasSheet(id) || need.has(id)) { if (hasSheet(id)) left = true; return; }
		if (now - (used.get(id) || 0) >= FREE_MS) unloadSheet(id); else left = true;
	});
	if (left) sweepSoon();
}
/** Idle loop on an overlay (called for every overlay after each render). Decodes its sheets first if needed. */
export function stackIdle(ov: HTMLElement) {
	if (!listed.size) return;
	const idle = sheetId('merge_idle', ov), lets = sheetId('letters_ignite', ov);
	if (ov.classList.contains('full')) prefetchJoins();
	if ((listed.has(idle) && !hasSheet(idle)) || (listed.has(lets) && !hasSheet(lets))) {
		void Promise.all([ensure(idle), ensure(lets)]).then(() => { if (ov.isConnected) stackIdle(ov); });
		return;
	}
	if (!live.get(ov)?.body || live.get(ov)!.body!.done) run('merge_idle', ov, 'body', { loop: true });
	if (!live.get(ov)?.letters) stackLetters(ov, true);
	sweepSoon();
}
/** A one-shot (stack_form / merge_join) and then the idle loop. Resolves when the one-shot ends (or at once if absent). */
export function stackOnce(a: 'stack_form' | 'merge_join', ov: HTMLElement) {
	return new Promise<void>((res) => {
		if (!run(a, ov, 'body', { onEnd: () => { run('merge_idle', ov, 'body', { loop: true }); res(); } })) return res();
		if (a === 'stack_form') stackLetters(ov); // re-ignite: its blank lead-in waits for the build-up
	});
}
/** Letters overlay: ignite (or, after a re-render, show the held last frame at once). */
export function stackLetters(ov: HTMLElement, settled = false) {
	const an = run('letters_ignite', ov, 'letters', { hold: true });
	if (an && settled) an.t0 -= 1e5; // jump to the held last frame
	return !!an;
}
/** Win bounce (its frames carry the letters, so the letters layer hides meanwhile). Decodes on first use. */
export function stackWin(ov: HTMLElement) {
	const go = () => {
		if (!ov.isConnected || !ov.classList.contains('win')) return;
		if (run('merge_win', ov, 'win', { loop: true })) { const l = live.get(ov)?.letters; if (l) l.cv.style.opacity = '0'; }
	};
	const id = sheetId('merge_win', ov);
	if (hasSheet(id)) go(); else if (listed.has(id)) void ensure(id).then(go);
}
export function stackWinOff(ov: HTMLElement) {
	const s = live.get(ov), w = s?.win; if (w && !w.done) stop(w);
	if (s?.letters) s.letters.cv.style.opacity = '';
	sweepSoon();
}
