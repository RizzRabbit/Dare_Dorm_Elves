// Stack + merge choreography (display only; the math is already decided by the book).
//   stackIn(reel)        : the 4 wild cells squash toward the reel centre, flash, and the full-height elf pops in
//                          with an elastic overshoot.
//   mergeIn(reels, vals) : anticipation (board dims, the adjacent stacks glow) → the stacks lean together →
//                          hit (magenta shockwave + lock burst per seam, 2-4 px micro shake) → WILD letters
//                          ignite left to right (80 ms apart) → each reel's corner gem flies into the merged wild's
//                          one corner gem, which shows the running product as they land (x7, then x42) and pops.
//                          4-5 wide: bigger burst, stronger shake, longer hold. ~1.3-1.8 s.
//   growIn(ov, ...)      : a merged group grows (connecting respin): the total splits back into one gem per reel corner,
//                          each changed reel ticks +1 with a pop, then they fly back and recombine into the new total,
//                          which counts up (x5, x30). ~1.3 s.
//   ovWin(reel)          : a merged / full-reel wild that is part of a winning line bounces and shows its win outline.
// Tap or turbo snaps to the end state (skipMerge finishes every running animation). Transform/opacity only.
// Art swap (stacks.ts): when the stacks_v1 sheets (MERGE_ANIM.md) are imported, stack_form / merge_join /
// letters_ignite / merge_win play at these same beats and merge_idle loops; any sheet not there keeps its placeholder.
import { S, $, setGem, gemHTML, ovMx, cellEl, pos } from './ui';
import { burst } from './fx';
import { mergeFx, stackForm, wfExpand, warmExpand } from './wildfx';
import { grab } from './combine';
import { toStage } from './stage';
import { hasStack, stackOnce, stackLetters, stackWin, stackWinOff } from './stacks';

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
		const probe = document.createElement('div'); probe.className = 'ov full'; probe.dataset.reel = String(reel);
		void warmExpand(reel); // per-reel expand sheet decodes during the squash
		if (hasStack('stack_form', probe)) { // the sheet does the flash + build-up itself
			render(); const ov = ovOf(reel); if (ov) { ov.style.animation = 'none'; await Promise.race([stackOnce('stack_form', ov), sw(700)]); }
			return;
		}
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
		const olds = [...new Set(reels.map(ovOf))].filter((o): o is HTMLElement => !!o);
		olds.forEach((o) => { const g = document.createElement('i'); g.className = 'ovGlow'; o.appendChild(g); A(g, [{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: 'forwards' }); });
		const badges = grab(reels.map((r) => ovMx(r)));
		await sw(260);
		// 2) lean together
		const mid = lo + (n - 1) / 2;
		const leans = olds.map((o) => { const r = Number(o.dataset.reel ?? o.dataset.reels?.split(',')[0] ?? lo) + (o.offsetWidth / step - 1) / 2; return `translateX(${(mid - r) * step * 0.07}px) scale(.97,1)`; });
		olds.forEach((o, i) => A(o, [{ transform: 'none' }, { transform: leans[i] }], { duration: 200, easing: 'cubic-bezier(.6,0,.9,.5)', fill: 'forwards' }));
		const ghosts = olds.map((o, i) => ghostOf(o, leans[i])); // the singles' current poses, to scale up into the group pose
		await sw(200);
		// 3) hit: merged overlay in, shockwave + burst per seam, micro shake
		apply();
		const ov = ovOf(lo);
		if (ov) {
			ov.style.animation = 'none';
			{ const m = ov.querySelector<HTMLElement>('.mx'); if (m) m.style.opacity = '0'; }
			// the join sheet starts from the singles' poses: only a fresh merge of single full reels uses it
			if (olds.every((o) => o.classList.contains('full')) && hasStack('merge_join', ov)) { ghosts.forEach((g) => g.el.remove()); void stackOnce('merge_join', ov); }
			else scaleUpInto(ov, ghosts);
		} else ghosts.forEach((g) => g.el.remove());
		mergeFx(reels);
		for (let i = 1; i < n; i++) ring(x0 + i * step - (step - S.cell) / 2, big);
		if (big) { const h = col(x0, n * step); burst(h, 'big', 60); made.push(h); }
		shake(big ? 4 : 2.5, big ? 170 : 120);
		// 4) letters ignite left to right
		const lets = ov && !stackLetters(ov) ? [...ov.querySelectorAll<HTMLElement>('.mLets b')] : [];
		lets.forEach((l, i) => A(l, [{ opacity: 0, transform: 'translate(-50%,0) scale(1.7)' }, { opacity: 1, transform: 'translate(-50%,0) scale(.92)', offset: .6 }, { opacity: 1, transform: 'translate(-50%,0) scale(1)' }], { duration: 280, delay: 120 + i * 80, easing: 'ease-out', fill: 'backwards' }));
		await sw(140);
		// 5) each reel's corner gem flies into the merged wild's one corner gem; it shows the running product as they land
		const mx = ov?.querySelector<HTMLElement>('.mx') || null;
		await recombine(badges, mx, values, product, big);
		await sw(big ? 420 : 240);
	} finally {
		made.forEach((m) => m.remove()); B.classList.remove('mAnt');
		const ov = ovOf(lo), mx = ov?.querySelector<HTMLElement>('.mx'); if (mx) { mx.style.opacity = ''; setGem(mx, product, false); }
		document.querySelectorAll('#flyLayer .fly').forEach((f) => f.remove());
		end();
	}
}

/** Snapshot of a single (or smaller merged) wild's art at its board position: its stack canvases drawn into one canvas,
 *  or a copy of its placeholder image. Taken before the overlays re-render. */
function ghostOf(o: HTMLElement, lean: string) {
	const el = document.createElement('div'); el.className = 'mGhost';
	const cvs = [...o.querySelectorAll<HTMLCanvasElement>(':scope>canvas.stk_body,:scope>canvas.stk_letters')];
	if (cvs.length) {
		const c = document.createElement('canvas'); c.width = cvs[0].width; c.height = cvs[0].height; const g = c.getContext('2d')!;
		cvs.forEach((x) => { try { g.drawImage(x, 0, 0, c.width, c.height); } catch { /* empty canvas */ } });
		el.appendChild(c);
	} else { const w = o.querySelector(':scope>.wart'); if (w) el.appendChild(w.cloneNode(true)); }
	return { el, x: o.offsetLeft, w: o.offsetWidth, lean };
}
/** The merge hit without a merge_join sheet: each single's pose scales UP (and fades) into the merged group pose, which
 *  grows in from slightly smaller. The group art is drawn larger than the singles, so heads / legs may be cropped:
 *  everything stays inside the merged overlay (overflow hidden = exactly the merged reels' area). */
function scaleUpInto(ov: HTMLElement, ghosts: ReturnType<typeof ghostOf>[]) {
	const x0 = ov.offsetLeft, body = ov.querySelector<HTMLElement>(':scope>canvas.stk_body') || ov.querySelector<HTMLElement>(':scope>.wart');
	ghosts.forEach((g) => {
		g.el.style.left = g.x - x0 + 'px'; g.el.style.width = g.w + 'px'; ov.appendChild(g.el);
		A(g.el, [{ transform: g.lean, opacity: 1 }, { transform: `${g.lean} scale(1.1)`, opacity: 1, offset: .35 }, { transform: 'scale(1.24)', opacity: 0 }], { duration: 340, easing: 'cubic-bezier(.3,0,.4,1)', fill: 'forwards' })
			.finished.catch(() => {}).finally(() => g.el.remove());
	});
	if (body) A(body, [{ transform: 'scale(.84)', opacity: 0 }, { transform: 'scale(1.035)', opacity: 1, offset: .55 }, { transform: 'scale(.995)', offset: .8 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'ease-out' });
}

const prodTo = (v: number[], i: number) => v.slice(0, i + 1).reduce((a, b) => a * b, 1);
/** Fly gems (fixed-position clones, or gems inside the overlay) into `target`, one after another; as each lands the
 *  target shows the running product of `values` (honest math: adjacent reels multiply), the last one counting up. */
async function recombine(gems: HTMLElement[], target: HTMLElement | null, values: number[], product: number, big = false) {
	if (!target) { gems.forEach((g) => g.remove()); return; }
	target.style.opacity = '0';
	const tr = target.getBoundingClientRect();
	await Promise.all(gems.map((g, i) => {
		const r = g.getBoundingClientRect(), k = r.width ? tr.width / r.width : 1; // getBoundingClientRect: same (screen) space for both
		const sc = toStage(r).width / (r.width || 1), dx = (tr.left - r.left) * sc, dy = (tr.top - r.top) * sc, lift = g.closest('.ov') ? S.cell * 0.14 : -S.cell * 0.3; // inside an overlay (overflow hidden) it dips instead
		return A(g, [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${dx * 0.5}px,${dy * 0.5 + lift}px) scale(1.12)`, offset: .5 }, { transform: `translate(${dx}px,${dy}px) scale(${k})`, opacity: 1 }],
			{ duration: 280, delay: i * 80, easing: 'cubic-bezier(.45,0,.35,1)', fill: 'forwards' }).finished.catch(() => {}).then(async () => {
			g.style.opacity = '0';
			const last = i === gems.length - 1, v = last ? product : prodTo(values, i);
			if (!last) { target.style.opacity = ''; setGem(target, v, false); A(target, [{ transform: 'scale(1)' }, { transform: 'scale(1.18)', offset: .4 }, { transform: 'scale(1)' }], { duration: 200 }); return; }
			// the last one lands: count up from the running product to the total, then pop
			const from = gems.length > 1 ? prodTo(values, i - 1) : values[0], dur = 260, t0 = performance.now();
			target.style.opacity = '';
			await new Promise<void>((res) => {
				const tick = (t: number) => {
					const u = skipping ? 1 : Math.min(1, (t - t0) / dur);
					setGem(target, Math.round(from + (v - from) * (1 - (1 - u) ** 3)), false);
					u < 1 ? requestAnimationFrame(tick) : res();
				};
				requestAnimationFrame(tick);
			});
			setGem(target, v);
			A(target, [{ transform: 'scale(1)' }, { transform: `scale(${big ? 1.4 : 1.3})`, offset: .4 }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' });
		});
	}));
	gems.forEach((g) => g.remove()); target.style.opacity = '';
}

/** A merged group grows: split the total into per-reel corner gems, tick the changed reels +1, recombine. */
export async function growIn(ov: HTMLElement, from: number[], to: number[], fromProd: number, toProd: number) {
	begin();
	const mx = ov.querySelector<HTMLElement>('.mx'), n = to.length, gems: HTMLElement[] = [];
	try {
		if (mx) setGem(mx, fromProd, false);
		// 1) split: one gem per reel slides out of the total to its own reel's corner
		for (let i = 0; i < n; i++) {
			const h = document.createElement('div'); h.innerHTML = gemHTML(from[i], 'stack rGem', `left:calc(${i * S.cell}px + 2px)`);
			const g = h.firstElementChild as HTMLElement; ov.appendChild(g); gems.push(g);
			A(g, [{ transform: `translateX(${-i * S.cell}px) scale(.8)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 200, delay: i * 30, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' });
		}
		if (mx) A(mx, [{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' });
		await sw(200 + n * 30);
		// 2) each changed reel ticks +1 with a pop (burst sprite + scale)
		let k = 0;
		for (let i = 0; i < n; i++) if (to[i] !== from[i]) { const g = gems[i], v = to[i]; setTimeout(() => setGem(g, v), skipping ? 0 : k++ * 90); }
		if (skipping) gems.forEach((g, i) => setGem(g, to[i], false));
		await sw(k * 90 + 260);
		gems.forEach((g, i) => setGem(g, to[i], false));
		// 3) fly back and recombine into the new total (counts up)
		if (mx) { mx.getAnimations().forEach((a) => a.cancel()); }
		await recombine(gems, mx, to, toProd);
		await sw(60);
	} finally {
		gems.forEach((g) => g.remove());
		if (mx) { mx.getAnimations().forEach((a) => a.cancel()); mx.style.opacity = ''; setGem(mx, toProd, false); }
		end();
	}
}

/** A winning line runs through a full-reel / merged wild: bounce once and show its win outline. */
export function ovWin(reel: number) {
	const ov = ovOf(reel); if (!ov || ov.classList.contains('win')) return;
	ov.classList.add('win'); stackWin(ov);
	ov.animate([{ transform: 'none' }, { transform: 'translateY(-3%) scale(1.03)', offset: .4 }, { transform: 'translateY(.6%) scale(.995)', offset: .75 }, { transform: 'none' }], { duration: 460, easing: 'ease-out' });
}
export const clearOvWins = () => document.querySelectorAll<HTMLElement>('.ov.win').forEach((o) => { o.classList.remove('win'); stackWinOff(o); });
