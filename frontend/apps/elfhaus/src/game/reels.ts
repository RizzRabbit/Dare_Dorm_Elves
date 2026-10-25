// Reel spin pacing (Stake-style): the free cells show a looping motion-blur strip (sprite sheet reel_blur,
// scripts/sprites/gen_reelblur.py) from the spin press, then reels stop left to right with a fixed stagger.
// Normal: first reel stops ~1.1 s after the press, then one every 180 ms (whole spin ~1.8 s); a reel the book
// flags for anticipation holds a little longer. Turbo keeps the old quick pace. Locked cells never spin.
import { play } from './sprite';
import { S } from './ui';

export const timing = () => (S.turbo
	? { first: 260, gap: 55, ant: 250, resp: 220, land: 160 }
	: { first: 1100, gap: 180, ant: 750, resp: 700, land: 330 });
let t0 = 0, spinning = false;
export const isSpinning = () => spinning;
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.max(0, ms)));

/** Start the blur on one cell (reel parity picks the strip so neighbouring reels differ). */
export function spinCell(cell: HTMLElement, reel: number) {
	cell.classList.remove('win', 'dim', 'sprWin', 'replace', 'out', 'locked');
	cell.querySelectorAll('canvas.fxSpin').forEach((c) => c.remove());
	cell.classList.add('spinning');
	if (!play('reel_blur', reel % 2 ? 'spinB' : 'spinA', cell, { cls: 'fxSpin', loop: true, delay: -Math.random() * 400 })) cell.classList.add('noBlur');
}
export function stopCell(cell: HTMLElement) {
	cell.classList.remove('spinning', 'noBlur');
	cell.querySelectorAll('canvas.fxSpin').forEach((c) => c.remove());
}
/** Spin every free cell; `keep(reel,row)` true = stays still (locked wilds, full-reel columns). */
export function startSpin(keep: (reel: number, row: number) => boolean = () => false) {
	t0 = performance.now(); spinning = true;
	document.querySelectorAll<HTMLElement>('.cell').forEach((c) => {
		const r = Number(c.id[1]), row = Number(c.id[2]);
		if (keep(r, row) || c.style.visibility === 'hidden') return;
		spinCell(c, r);
	});
}
export const sinceStart = () => performance.now() - t0;
export const markStopped = () => { spinning = false; };
export function markStart() { t0 = performance.now(); }
