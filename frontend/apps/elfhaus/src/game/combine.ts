// Multiplier combine: when wilds become a stack (stackComplete: the four values ADD) or adjacent stacks merge
// (mergeGroups: the stack values MULTIPLY), copies of the source multipliers lift off, fly into the stack's
// multiplier spot and shrink into it; the single combined number then pops in with the mxBurst sprite.
// ~0.9-1.1 s normal, ~0.5 s turbo. The flight is a transform on the real lettering (the numbers are dynamic);
// the arrival burst is the sprite sheet.
import { S } from './ui';
import { mxBurst } from './fx';
import { toStage } from './stage';
import { T } from './tempo';
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
function layer() {
	let l = document.getElementById('flyLayer');
	if (!l) { l = document.createElement('div'); l.id = 'flyLayer'; (document.getElementById('root') || document.body).appendChild(l); }
	return l;
}
/** Hide a multiplier so the board mirror drops its glyph on the next tick (visibility, not only opacity). */
export function hideGem(m: HTMLElement | null) {
	if (!m) return;
	m.style.visibility = 'hidden';
	m.style.opacity = '0';
}
/** Cell multipliers sitting under a full-reel or merged overlay: hide them so they cannot float over the new art. */
export function clearCoveredGems() {
	document.querySelectorAll<HTMLElement>('.cell').forEach((el) => {
		const hid = el.style.visibility === 'hidden' || (el as HTMLElement).hidden;
		if (!hid) return;
		el.querySelectorAll<HTMLElement>('.mx').forEach(hideGem);
	});
}
/** Snapshot multipliers where they are now (call before the DOM under them is replaced).
 *  The originals are hidden in the same turn so the Pixi badge glyphs leave with them. */
export function grab(mxs: (HTMLElement | null)[]) {
	const src = [...new Set(mxs)].filter((m): m is HTMLElement => !!m && !!m.offsetParent);
	const clones = src.map((m) => {
		const r = toStage(m.getBoundingClientRect()), c = m.cloneNode(true) as HTMLElement;
		c.querySelectorAll('canvas').forEach((x) => x.remove());
		c.classList.add('fly');
		c.style.cssText = `position:absolute;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;right:auto;bottom:auto;margin:0;translate:none;visibility:visible`;
		layer().appendChild(c);
		return c;
	});
	src.forEach(hideGem);
	return clones;
}
export async function combineInto(clones: HTMLElement[], target: HTMLElement | null) {
	if (!target || !clones.length) { clones.forEach((c) => c.remove()); return; }
	const fast = S.turbo, dur = fast ? 300 : T(600), stag = fast ? 25 : T(70); // T: tempo.ts (turbo keeps the old fast values)
	target.style.visibility = 'hidden';
	const t = toStage(target.getBoundingClientRect()), tx = t.left + t.width * 0.62, ty = t.top + t.height / 2;
	await Promise.all(clones.map((c, i) => {
		const r = toStage(c.getBoundingClientRect()), dx = tx - (r.left + r.width * 0.62), dy = ty - (r.top + r.height / 2);
		return c.animate([
			{ transform: 'translate(0,0) scale(1)', opacity: 1 },
			{ transform: `translate(${dx * 0.35}px,${dy * 0.35 - 10}px) scale(1.12)`, opacity: 1, offset: 0.35 },
			{ transform: `translate(${dx}px,${dy}px) scale(.5)`, opacity: 0.15 },
		], { duration: dur, delay: i * stag, easing: 'cubic-bezier(.45,0,.35,1)', fill: 'forwards' }).finished;
	}));
	clones.forEach((c) => c.remove());
	target.style.visibility = '';
	mxBurst(target);
	target.animate([{ transform: 'scale(.55)' }, { transform: 'scale(1.16)', offset: 0.6 }, { transform: 'scale(1)' }], { duration: fast ? 160 : T(320), easing: 'ease-out' });
	await sleep(fast ? 140 : T(300));
}
