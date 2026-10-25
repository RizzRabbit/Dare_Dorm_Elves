// Respins remaining: 3 small dots on every locked wild (inside its LOCKED strip) and on each full-reel / merged
// wild, shown only while a respin sequence runs. The count is per spin in the math (not per wild), so every wild
// shows the same dots. Driven by respinStart.remaining from the book:
//   sequence start -> all available dots lit (remaining + 1), then one dims for the respin starting now;
//   each further respin dims one more; if the book ever reports more left than shown, they relight with a flash.
// The current math caps each spin at 3 respins and never resets the count (respinStart.step + remaining = 3 in
// every book), so the relight path does not fire with today's math.
// State lives on <body> (class .respinning, data-rl = lit count) so freshly rendered cells/overlays pick it up.
import { FX, rcFill, rcFlash } from './fx';
import { hasSheet } from './sprite';
const MAX = 3;
let dimT = 0, hideT = 0;
const B = () => document.body;
const lit = () => Number(B().dataset.rl ?? -1);
const dotsAt = (i: number) => document.querySelectorAll<HTMLElement>(`.rd i:nth-child(${i + 1})`);

function setLit(n: number, anim: 'dim' | 'refill' | null) {
	const prev = lit();
	B().dataset.rl = String(n);
	B().classList.add('respinning');
	if (!anim || !hasSheet(FX)) return;
	for (let i = 0; i < MAX; i++) {
		const was = i < prev, on = i < n;
		if (anim === 'dim' && was && !on) dotsAt(i).forEach((d) => rcFill(d, true));
		if (anim === 'refill' && on && !was) dotsAt(i).forEach((d) => { rcFill(d); rcFlash(d); });
	}
}

/** respinStart: `remaining` = respins left after the one starting now. */
export function showRespin(_step: number, remaining: number) {
	clearTimeout(dimT); clearTimeout(hideT);
	const avail = Math.min(MAX, remaining + 1);
	if (!B().classList.contains('respinning')) {
		setLit(avail, null);
		dimT = window.setTimeout(() => setLit(remaining, 'dim'), 380);
	} else if (avail > lit()) {
		setLit(avail, 'refill');
		dimT = window.setTimeout(() => setLit(remaining, 'dim'), 520);
	} else setLit(remaining, 'dim');
}
/** Sequence over: hold the final state briefly, then hide. */
export function endRespin(delay = 700) {
	clearTimeout(hideT);
	hideT = window.setTimeout(hideRespin, delay);
}
export function hideRespin() {
	clearTimeout(dimT); clearTimeout(hideT);
	B().classList.remove('respinning'); delete B().dataset.rl;
	document.querySelectorAll('.rd canvas').forEach((c) => c.remove());
}
/** Kept for layout(); the dots live on the wilds now, nothing to place. */
export function placeRespin() {}
export const RESPIN_MAX = MAX;
export const DOTS = '<span class="rd" aria-hidden="true"><i></i><i></i><i></i></span>';
