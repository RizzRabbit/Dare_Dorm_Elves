// Stack + merge choreography (display only; the math is already decided by the book).
//   stackIn(reel)        : the 4 wild cells squash toward the reel centre, flash, and the full-height elf pops in
//                          with an elastic overshoot.
//   mergeIn(reels, vals) : anticipation (board dims, the adjacent stacks glow) → the stacks lean together →
//                          hit (magenta shockwave + lock burst per seam, 2-4 px micro shake) → WILD letters
//                          ignite left to right (80 ms apart) → each reel's badge arcs up into a combined badge
//                          that counts "x7 × x6 = x42" and pops → it settles into the group's gem.
//                          4-5 wide: bigger burst, stronger shake, longer hold. ~1.3-1.8 s.
//   ovWin(reel)          : a merged / full-reel wild that is part of a winning line bounces and shows its win outline.
// Tap or turbo snaps to the end state (skipMerge finishes every running animation). Transform/opacity only.
// Art swap: when stacks_v1 (MERGE_ANIM.md) lands, the letter spans and glow/outline boxes are replaced by the
// stack_form / merge_join / letters_ignite / merge_idle / merge_win sheets at the same beats.
import { S, $, setGem, ovMx, cellEl, pos } from './ui';
import { burst } from './fx';
import { mergeFx, stackForm, wfExpand } from './wildfx';
import { grab } from './combine';
import { toStage } from './stage';

let skipping = false, running = 0;
const anims = new Set<Animation>();
function A(el: Element, kf: Keyframe[], o: KeyframeAnimationOptions) {
	const a = el.animate(kf, o); anims.add(a); a.finished.catch(() => {}).finally(() => anims.delete(a));
	if (skipping) a.finish();
	return a;
}
const sw = (ms: number) => (skipping ? Promise.resolve() : new Promise<void>((r) => { const t = setTimeout(r, ms); waiters.add(() => { clearTimeout(t); r(); }); }));
const waiters = new Set<() => void>();
/** Tap: snap whatever merge/stack is playing to its end state. */
export function skipMerge() {
	if (!running) return;
	skipping = true; anims.forEach((a) => { try { a.finish(); } catch { a.cancel(); } }); waiters.forEach((w) => w()); waiters.clear();
}
const begin = () => { running++; if (S.turbo) skipping = true; };
const end = () => { if (--running <= 0) { running = 0; skipping = false; } };

const LETTERS: Record<number, string[]> = { 1: ['WILD'], 2: ['WI', 'LD'], 3: ['W', 'IL', 'D'], 4: ['W', 'I', 'L', 'D'], 5: ['W', 'I', 'L', 'D', '♥'] };
/** Placeholder letter row for a merged overlay (one span per reel); replaced by the letters art when it lands. */
export const lettersHTML = (n: number) => `<div class="mLets">${(LETTERS[n] || LETTERS[5]).map((l, i) => `<b style="left:${((i + 0.5) / n) * 100}%">${l}</b>`).join('')}</div>`;
const ovOf = (r: number) => document.querySelector<HTMLElement>(`.ov.full[data-reel="${r}"]`) ||
	[...document.querySelectorAll<HTMLElement>('.ov.merge')].find((o) => o.dataset.reels?.split(',').includes(String(r))) || null;
const cellsOf = (r: number) => [0, 1, 2, 3].map((row) => cellEl(r, row));

function shake(px: number, ms: number) {
	const b = $('#board');
	A(b, [{ transform: 'none' }, { transform: `translate(${px}px,${-px / 2}px)` }, { transform: `translate(${-px}px,${px / 2}px)` }, { transform: `translate(${px / 2}px,0)` }, { transform: 'none' }], { duration: ms });
}
function ring(x: number, big: boolean) {
	const r = document.createElement('div'); r.className = 'mRing' + (big ? ' big' : ''); r.style.left = x + 'px';
	$('#board').appendChild(r);
	A(r, [{ transform: 'translate(-50%,-50%) scale(.15)', opacity: 1 }, { transform: `translate(-50%,-50%) scale(${big ? 3 : 2.1})`, opacity: 0 }], { duration: 480, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).finished.finally(() => r.remove());
}
const col = (x: number, w: number) => { const d = document.createElement('div'); d.className = 'wfxCol burstCol'; d.style.left = x + 'px'; d.style.width = w + 'px'; $('#board').appendChild(d); return d; };

/** stackComplete: squash → flash → elastic pop of the full-reel elf. Call before the overlay is rendered. */
export async function stackIn(reel: number, render: () => void) {
	begin();
	try {
		const cells = cellsOf(reel), c = S.cell;
		stackForm(reel); // light column sprite (flash)
		cells.forEach((el, row) => { const s = el.querySelector('.sym') || el; A(s, [{ transform: 'none', opacity: 1 }, { transform: `translateY(${(1.5 - row) * c * 0.42}px) scale(.72,.6)`, opacity: 0.35 }], { duration: 230, easing: 'cubic-bezier(.5,0,.9,.4)', fill: 'forwards' }); });
		await sw(230);
		const h = col(pos(reel, 0).x, S.cell); burst(h, 'lock'); setTimeout(() => h.remove(), 900);
		render();
		cells.forEach((el) => (el.querySelector('.sym') || el).getAnimations().forEach((a) => a.cancel()));
		const ov = ovOf(reel);
		if (ov) { ov.style.animation = 'none'; A(ov, [{ transform: 'scale(.9,.25)', opacity: 0 }, { transform: 'scale(1.06,1.08)', opacity: 1, offset: .45 }, { transform: 'scale(.98,.97)', offset: .72 }, { transform: 'none', opacity: 1 }], { duration: 480, easing: 'ease-out' }); wfExpand(ov); }
		await sw(260);
	} finally { end(); }
}

/** mergeGroups (a fresh group): the full choreography. `apply` swaps the overlays to the merged one at the hit. */
export async function mergeIn(reels: number[], values: number[], product: number, apply: () => void) {
	begin();
	const B = $('#board'), n = reels.length, big = n >= 4, lo = reels[0], step = n > 1 ? pos(lo + 1, 0).x - pos(lo, 0).x : S.cell, x0 = pos(lo, 0).x;
	const made: HTMLElement[] = [];
	try {
		// 1) anticipation: board dims, the stacks about to join glow
		B.classList.add('mAnt');
		const olds = reels.map(ovOf).filter((o): o is HTMLElement => !!o);
		olds.forEach((o) => { const g = document.createElement('i'); g.className = 'ovGlow'; o.appendChild(g); A(g, [{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: 'forwards' }); });
		const badges = grab(reels.map((r) => ovMx(r)));
		await sw(260);
		// 2) lean together
		const mid = lo + (n - 1) / 2;
		olds.forEach((o) => { const r = Number(o.dataset.reel ?? lo); const dx = (mid - r) * step * 0.07; A(o, [{ transform: 'none' }, { transform: `translateX(${dx}px) scale(.97,1)` }], { duration: 200, easing: 'cubic-bezier(.6,0,.9,.5)', fill: 'forwards' }); });
		await sw(200);
		// 3) hit: merged overlay in, shockwave + burst per seam, micro shake
		apply();
		const ov = ovOf(lo);
		if (ov) {
			ov.style.animation = 'none';
			A(ov, [{ transform: 'scale(1.035,.97)' }, { transform: 'scale(.99,1.02)', offset: .5 }, { transform: 'none' }], { duration: 360, easing: 'ease-out' });
			ov.querySelector('.mx')?.setAttribute('style', 'opacity:0');
		}
		mergeFx(reels);
		for (let i = 1; i < n; i++) ring(x0 + i * step - (step - S.cell) / 2, big);
		if (big) { const h = col(x0, n * step); burst(h, 'big', 60); made.push(h); }
		shake(big ? 4 : 2.5, big ? 170 : 120);
		// 4) letters ignite left to right
		const lets = ov ? [...ov.querySelectorAll<HTMLElement>('.mLets b')] : [];
		lets.forEach((l, i) => A(l, [{ opacity: 0, transform: 'translate(-50%,0) scale(1.7)' }, { opacity: 1, transform: 'translate(-50%,0) scale(.92)', offset: .6 }, { opacity: 1, transform: 'translate(-50%,0) scale(1)' }], { duration: 280, delay: 120 + i * 80, easing: 'ease-out', fill: 'backwards' }));
		await sw(140);
		// 5) badges arc up into one combined badge above the group, which counts the product
		const plate = document.createElement('div'); plate.className = 'rGrowSum mSum';
		const head = values.map((v) => 'x' + v).join(' × ') + ' = x', len = (head + product).length + 1.5;
		plate.style.fontSize = `min(calc(var(--cell)*.3), calc(var(--cell)*${(n * 0.9 / (len * 0.62)).toFixed(3)}))`;
		plate.textContent = head + values[0];
		if (ov) ov.appendChild(plate); made.push(plate);
		const pr = toStage(plate.getBoundingClientRect()), tx = pr.left + pr.width / 2, ty = pr.top + pr.height / 2;
		await Promise.all(badges.map((c, i) => {
			const r = toStage(c.getBoundingClientRect()), dx = tx - (r.left + r.width * 0.62), dy = ty - (r.top + r.height / 2), lift = -S.cell * 0.55;
			return A(c, [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${dx * 0.5}px,${dy * 0.5 + lift}px) scale(1.15)`, offset: .5 }, { transform: `translate(${dx}px,${dy}px) scale(.45)`, opacity: 0.1 }],
				{ duration: 420, delay: i * 60, easing: 'cubic-bezier(.45,0,.35,1)', fill: 'forwards' }).finished.catch(() => {});
		}));
		badges.forEach((b) => b.remove());
		A(plate, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.7)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }], { duration: 160, fill: 'forwards' });
		const dur = 460, t0 = performance.now(), from = values[0];
		await new Promise<void>((res) => {
			const tick = (t: number) => {
				const u = skipping ? 1 : Math.min(1, (t - t0) / dur);
				plate.textContent = head + Math.round(from + (product - from) * (1 - (1 - u) ** 3));
				u < 1 ? requestAnimationFrame(tick) : res();
			};
			requestAnimationFrame(tick);
		});
		A(plate, [{ transform: 'translate(-50%,-50%) scale(1)' }, { transform: `translate(-50%,-50%) scale(${big ? 1.32 : 1.22})`, offset: .4 }, { transform: 'translate(-50%,-50%) scale(1)' }], { duration: 300, easing: 'ease-out' });
		if (ov) burst(plate, big ? 'big' : 'pop');
		await sw(big ? 650 : 380);
		// 6) settle into the group's gem
		const mx = ov?.querySelector<HTMLElement>('.mx');
		if (mx) { mx.style.opacity = ''; setGem(mx, product); A(mx, [{ transform: 'scale(.55)' }, { transform: 'scale(1.16)', offset: .6 }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' }); }
		A(plate, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
		await sw(220);
	} finally {
		made.forEach((m) => m.remove()); B.classList.remove('mAnt');
		const ov = ovOf(lo), mx = ov?.querySelector<HTMLElement>('.mx'); if (mx) mx.style.opacity = '';
		document.querySelectorAll('#flyLayer .fly').forEach((f) => f.remove());
		end();
	}
}

/** A winning line runs through a full-reel / merged wild: bounce once and show its win outline. */
export function ovWin(reel: number) {
	const ov = ovOf(reel); if (!ov || ov.classList.contains('win')) return;
	ov.classList.add('win');
	ov.animate([{ transform: 'none' }, { transform: 'translateY(-3%) scale(1.03)', offset: .4 }, { transform: 'translateY(.6%) scale(.995)', offset: .75 }, { transform: 'none' }], { duration: 460, easing: 'ease-out' });
}
export const clearOvWins = () => document.querySelectorAll('.ov.win').forEach((o) => o.classList.remove('win'));
