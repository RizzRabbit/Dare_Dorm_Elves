// Respin counter: a compact plaque shown while a sticky-wild respin sequence runs (base game and feature spins).
// Book semantics: each sequence allows at most 3 respins; respinStart carries `step` (1-based) and `remaining`
// (respins still available after this one). A new sequence starts again at 1 / 3 (shown as a fresh reset).
// Placement: beside the board (right side) when there is room, otherwise above the board / free-spin bar.
const MAX = 3;
let hideT = 0;
const el = () => document.getElementById('respinCtr') as HTMLElement | null;

export function placeRespin() {
	const C = el(); if (!C || C.classList.contains('hidden')) return;
	const fr = document.getElementById('frame')!.getBoundingClientRect();
	const portrait = document.body.classList.contains('portrait');
	// decide the mode with the side (vertical) plaque size, then measure in the chosen mode
	document.body.classList.remove('rcTop');
	const side = !portrait && innerWidth - fr.right >= C.offsetWidth + 56;
	document.body.classList.toggle('rcTop', !side);
	const w = C.offsetWidth, h = C.offsetHeight;
	if (side) {
		C.style.left = `${Math.round(fr.right + 28)}px`;
		C.style.top = `${Math.round(fr.top + fr.height / 2 - h / 2)}px`;
	} else {
		const fs = document.getElementById('fsBar')!;
		const anchor = fs.classList.contains('hidden') ? fr.top : fs.getBoundingClientRect().top;
		const logo = document.getElementById('logo')?.getBoundingClientRect();
		const minTop = logo && logo.height ? logo.bottom + 4 : 4;
		C.style.left = `${Math.round(innerWidth / 2 - w / 2)}px`;
		C.style.top = `${Math.round(Math.max(minTop, anchor - h - 8))}px`;
	}
}

/** Show/update for respin `step` of 3 with `remaining` left after it. */
export function showRespin(step: number, remaining: number) {
	const C = el(); if (!C) return;
	clearTimeout(hideT);
	const fresh = C.classList.contains('hidden') || step === 1;
	(C.querySelector('.rcNum') as HTMLElement).textContent = `${step}`;
	(C.querySelector('.rcLeft') as HTMLElement).textContent = remaining > 0 ? `${remaining} LEFT` : 'LAST RESPIN';
	C.querySelectorAll('.rcPips i').forEach((p, i) => { p.classList.toggle('used', i < step); p.classList.toggle('now', i === step - 1); });
	C.classList.remove('hidden', 'fade'); C.dataset.step = String(step);
	document.body.classList.add('rcOn');
	placeRespin();
	C.classList.remove('bump', 'reset'); void C.offsetWidth; C.classList.add(fresh ? 'reset' : 'bump');
}

/** Sequence over: hold the final count briefly, then fade out. */
export function endRespin(delay = 900) {
	const C = el(); if (!C || C.classList.contains('hidden')) return;
	clearTimeout(hideT);
	hideT = window.setTimeout(() => { C.classList.add('fade'); hideT = window.setTimeout(() => hideRespin(), 300); }, delay);
}
export function hideRespin() {
	const C = el(); if (!C) return;
	clearTimeout(hideT); C.classList.add('hidden'); C.classList.remove('fade', 'bump', 'reset');
	document.body.classList.remove('rcOn', 'rcTop');
}
export const RESPIN_MAX = MAX;
