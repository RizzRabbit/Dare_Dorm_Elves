// Respin tracker: 3 small circles shown while a sticky-wild respin sequence runs (base game and feature spins).
// Book semantics: each sequence allows at most 3 respins; respinStart carries `step` (1-based) and `remaining`.
// Circles: empty ring = respin still available, filled = used. A new sequence (step 1 after a used one) empties
// the circles with a quick visible reset before the first fill.
// Placement: centred on the board's bottom bezel when it is deep enough, otherwise just below the frame.
import { FX, rcFill, rcCSS } from './fx';
import { hasSheet } from './sprite';
const MAX = 3;
let hideT = 0, fillT = 0;
const el = () => document.getElementById('respinCtr') as HTMLElement | null;

export function placeRespin() {
	const C = el(); if (!C || C.classList.contains('hidden')) return;
	const fr = document.getElementById('frame')!.getBoundingClientRect();
	const bd = document.getElementById('board')!.getBoundingClientRect();
	const h = C.offsetHeight, w = C.offsetWidth;
	const bezel = fr.bottom - bd.bottom;
	const top = bezel >= h + 2 ? bd.bottom + (bezel - h) / 2 : fr.bottom + 4;
	C.classList.toggle('below', bezel < h + 2);
	document.body.classList.toggle('rcBelow', bezel < h + 2);
	C.style.left = `${Math.round(bd.left + bd.width / 2 - w / 2)}px`;
	C.style.top = `${Math.round(top)}px`;
}

// Each circle shows a static frame of the rcfill sheet (empty / filled); a new fill plays the sheet forward,
// a reset plays it backwards. Without the sheet the CSS fallback ring/fill (class .on) is used.
function paint(C: HTMLElement, step: number, popIdx: number) {
	const sp = hasSheet(FX); C.classList.toggle('sp', sp);
	C.querySelectorAll<HTMLElement>('i').forEach((p, i) => {
		p.classList.toggle('on', i < step);
		if (!sp) return;
		if (i === popIdx) rcFill(p); else { p.querySelectorAll('canvas').forEach((c) => c.remove()); p.style.cssText = rcCSS(i < step); }
	});
	C.dataset.step = String(step);
	C.setAttribute('aria-label', `Respin ${step} of ${MAX}`);
}

/** Show/update for respin `step` of 3 (`remaining` left after it). */
export function showRespin(step: number, _remaining?: number) {
	const C = el(); if (!C) return;
	clearTimeout(hideT); clearTimeout(fillT);
	const wasHidden = C.classList.contains('hidden');
	const prev = wasHidden ? 0 : Number(C.dataset.step || 0);
	C.classList.remove('hidden', 'fade', 'reset');
	if (wasHidden) { paint(C, 0, -1); C.classList.add('fade'); }
	placeRespin();
	if (wasHidden) { void C.offsetWidth; C.classList.remove('fade'); }
	if (!wasHidden && step <= prev) {
		// a new sequence: visibly empty the circles, then fill the first
		C.querySelectorAll<HTMLElement>('i.on').forEach((p) => { p.classList.remove('on'); if (hasSheet(FX)) rcFill(p, true); });
		C.classList.add('reset');
		fillT = window.setTimeout(() => { C.classList.remove('reset'); paint(C, step, step - 1); }, 300);
	} else paint(C, step, step - 1);
}

/** Sequence over: hold the final state briefly, then fade out. */
export function endRespin(delay = 900) {
	const C = el(); if (!C || C.classList.contains('hidden')) return;
	clearTimeout(hideT);
	hideT = window.setTimeout(() => { C.classList.add('fade'); hideT = window.setTimeout(() => hideRespin(), 300); }, delay);
}
export function hideRespin() {
	const C = el(); if (!C) return;
	clearTimeout(hideT); clearTimeout(fillT);
	C.classList.add('hidden'); C.classList.remove('fade', 'reset');
	C.dataset.step = '0';
	document.body.classList.remove('rcOn', 'rcBelow');
}
export const RESPIN_MAX = MAX;
