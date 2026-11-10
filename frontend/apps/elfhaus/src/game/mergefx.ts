// Stack + merge choreography (display only; the math is already decided by the book).
//   stackIn(reel)        : normal: the 4 single wilds ease together and crossfade into the full-reel elf (calm, no flash);
//                          turbo: the 4 wild cells squash toward the reel centre, flash, and the elf pops in elastically.
//   mergeIn(reels, vals) : on the 150 BPM grid (mergeclock.ts). Live rigs keep playing their win clips; whole
//                          overlay containers crouch and lean toward each other (translateY capped at MERGE_MAX_DROP,
//                          no bone posing). Outline glows come off so they cannot ghost. At the hit a large sprite
//                          flash / burst and a screen punch cover the cut, the group rig bursts in with its win clip,
//                          and the gems arc into one total. Turbo shortens (~60%). A tap advances one stage.
//                          ~1.6-2.2 s plus the gem flights.
//   growIn(ov, ...)      : a merged group grows (connecting respin): the total splits back into one gem per reel corner,
//                          each changed reel ticks +1 with a pop, then they fly back and recombine into the new total,
//                          which counts up (x5, x30). ~1.3 s.
//   ovWin(reel)          : a merged / full-reel wild that is part of a winning line bounces and shows its win outline.
// Tap during stackIn snaps that stack. Tap during mergeIn advances exactly one merge stage (the merge does not snap
// just because turbo is on). Transform/opacity only, plus the existing board camera.
// Tempo (tempo.ts): stackIn durations below are written at the old pace and stretched by ANIM_TEMPO in A() and
// sw() (turbo = 1). mergeIn uses mergeclock.ts (real milliseconds, turbo × 0.6) and does not go through T().
// Art swap (stacks.ts): when the stacks_v1 sheets (MERGE_ANIM.md) are imported, stack_form / merge_join /
// letters_ignite / merge_win play at these same beats and merge_idle loops; any sheet not there keeps its placeholder.
import { preloadStacks } from './ui';
import { S, $, setGem, gemHTML, ovMx, cellEl, pos, ovArt } from './ui';
import { wfExpand } from './wildfx';
import { grab, hideGem, clearCoveredGems } from './combine';
import { toStage } from './stage';
import { hasStack, stackOnce, stackLetters, stackWin, stackWinOff, stackPrepare, stackRelease, stackWarm, stackReact, stackReactSkip } from './stacks';
import { dbKnown, dbNudge, dbPlay, dbStats } from './dbstacks';
import { canvasRev, hasSheet, play } from './sprite';
import { boardShake, boardWin } from './boardfx';
import { trailBetween } from './wintrail';
import { MERGE_BEAT, MERGE_HIT, mergeAmp, mergeLean, mergeMs } from './mergeclock';
import { crumb, scrub, setPhase } from './diag';
import { T } from './tempo';
import { type Motion, playMotion, cancelMotion } from './board/motion';

let skipping = false, running = 0;
const anims = new Set<Motion>();
const stageAnims = new Set<Motion>();
let beatRes: (() => void) | null = null;
let pendingSkip = false;
let mergeHold: { skip: () => void } | null = null;
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
function A(el: Element, kf: Keyframe[], o: KeyframeAnimationOptions) {
	const a = playMotion(el as HTMLElement, kf, { ...o, duration: T(Number(o.duration) || 0), delay: T(o.delay || 0) }); anims.add(a); a.finished.catch(() => {}).finally(() => anims.delete(a));
	if (skipping) a.finish();
	return a;
}
/** A merge-stage animation. Real milliseconds, not the stack tempo. A tap finishes these and only these. */
function M(el: Element, kf: Keyframe[], o: KeyframeAnimationOptions) {
	const a = playMotion(el as HTMLElement, kf, o); stageAnims.add(a); a.finished.catch(() => {}).finally(() => stageAnims.delete(a));
	return a;
}
function finishStage() {
	for (const a of stageAnims) { try { a.finish(); } catch { a.cancel(); } }
	stageAnims.clear();
}
function armSkip() {
	mergeHold = { skip() { if (beatRes) { const r = beatRes; beatRes = null; r(); } else pendingSkip = true; } };
}
/** Wait real milliseconds. Resolves true when a tap ended this stage early. */
function beat(ms: number): Promise<boolean> {
	if (pendingSkip) { pendingSkip = false; finishStage(); return Promise.resolve(true); }
	const wait = mergeMs(ms, !!S.turbo);
	return new Promise<boolean>((res) => {
		const t = setTimeout(() => { beatRes = null; res(false); }, wait);
		beatRes = () => { clearTimeout(t); beatRes = null; finishStage(); res(true); };
	});
}
/** A pause at the old pace, stretched by the tempo (`raw`: a plain cap, e.g. a decode wait, not stretched). */
const sw = (ms: number, raw = false) => (skipping ? Promise.resolve() : new Promise<void>((r) => { const t = setTimeout(r, raw ? ms : T(ms)); waiters.add(() => { clearTimeout(t); r(); }); }));
const waiters = new Set<() => void>();
/** Tap: during a merge, advance one stage. Otherwise snap the stack that's playing. */
export function skipMerge() {
	stackReactSkip(); // a face reaction snaps to the idle loop
	if (mergeHold) { mergeHold.skip(); return; }
	if (!running) return;
	skipping = true; anims.forEach((a) => { try { a.finish(); } catch { a.cancel(); } }); waiters.forEach((w) => w()); waiters.clear();
}
const begin = () => { running++; if (S.turbo) skipping = true; };
const end = () => { if (--running <= 0) { running = 0; skipping = false; } };

const ovOf = (r: number) => document.querySelector<HTMLElement>(`.ov.full[data-reel="${r}"]`) ||
	[...document.querySelectorAll<HTMLElement>('.ov.merge')].find((o) => o.dataset.reels?.split(',').includes(String(r))) || null;
const cellsOf = (r: number) => [0, 1, 2, 3].map((row) => cellEl(r, row));

/** stackComplete. Normal pace (spinfix, user: "the single stacked Wild reel should appear from the merging of the individually
 * stacked wilds"): a vertical version of the reel merge, calm: short hold on the full reel → the 4 singles ease together
 * toward the reel centre (gentle slide + a hair of vertical squeeze, ease-in-out, no hard squash) → at contact they
 * crossfade into the full-reel elf (merge_idle art, scale 1.03 → 1, no elastic overshoot, no flash; stack_form is not
 * used here because its first frames are a light-column flash) → the WILD letters fade up → the glowing frame draws in.
 * Beats are written at the old pace and stretched x ANIM_TEMPO (A / sw): hold 0.3 s, lean 0.56 s, crossfade 0.6 s,
 * letters 0.5 s, frame 0.6 s at normal speed. Turbo keeps the old flash-and-pop (below); tap snaps to the end state.
 * `render(frameDelay)` swaps the cells for the overlay (and schedules its frame draw-in). */
/** `react` false: no face reaction after the calm form (v3.11 EGW forms several reels in one pass with ONE reaction). */
export async function stackIn(reel: number, render: (frameDelay?: number) => void, react = true) {
	if (!S.turbo) return stackFromSingles(reel, render, react);
	begin();
	try {
		const cells = cellsOf(reel), c = S.cell;
		const probe = document.createElement('div'); probe.className = 'ov full'; probe.dataset.reel = String(reel);
		if (hasStack('stack_form', probe)) { // the sheet does the flash + build-up itself
			// v20: the sheet starts past its baked light-column / white wipe (stacks.ts CLEAN_FROM); a short fade + settle is the entrance
			render(); const ov = ovOf(reel); if (ov) { A(ov, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'cubic-bezier(.3,.1,.3,1)' }); ovArt(ov).forEach((e) => A(e, [{ transform: 'scale(1.03)' }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.3,.1,.3,1)' })); await Promise.race([stackOnce('stack_form', ov), sw(700)]); }
			return;
		}
		// v20: no light-column flash and no white 'lock' burst column here any more (James: the white streak on every expand)
		cells.forEach((el, row) => el.querySelectorAll<HTMLElement>('.sym').forEach((s) => A(s, [{ transform: 'none', opacity: 1 }, { transform: `translateY(${(1.5 - row) * c * 0.42}px) scale(.72,.6)`, opacity: 0.35 }], { duration: 230, easing: 'cubic-bezier(.5,0,.9,.4)', fill: 'forwards' })));
		await sw(230);
		render();
		cells.forEach((el) => el.querySelectorAll('.sym').forEach((s) => cancelMotion(s)));
		const ov = ovOf(reel);
		if (ov) { A(ov, [{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 1 }], { duration: 480, easing: 'ease-out' }); ovArt(ov).forEach((e) => A(e, [{ transform: 'scale(.9,.25)' }, { transform: 'scale(1.06,1.08)', offset: .45 }, { transform: 'scale(.98,.97)', offset: .72 }, { transform: 'none' }], { duration: 480, easing: 'ease-out' })); wfExpand(ov); }
		await sw(260);
	} finally { end(); }
}

async function stackFromSingles(reel: number, render: (frameDelay?: number) => void, react = true) {
	begin();
	const cells = cellsOf(reel), c = S.cell; let tapped = false;
	try {
		const probe = document.createElement('div'); probe.className = 'ov full'; probe.dataset.reel = String(reel);
		const warm = stackWarm(probe); // idle + letters decode during the hold / lean (usually prefetched already)
		// the singles' multiplier badges already have their fly clones (stackComplete grab): hide the originals so they
		// don't double up while the cells move
		cells.forEach((el) => el.querySelectorAll<HTMLElement>('.mx').forEach(hideGem));
		await sw(150); // 1) the full reel reads as 4 landed wilds for a beat
		// 2) the singles ease together toward the reel centre (rows 0/3 travel most), a little vertical squeeze at the end
		cells.forEach((el, row) => {
			const dy = (1.5 - row) * c * 0.38;
			A(el, [{ transform: 'none' }, { transform: `translateY(${dy.toFixed(1)}px) scale(.985,.96)` }], { duration: 280, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' });
		});
		await sw(280);
		await Promise.race([warm, sw(300, true)]); // (rarely waits: they just rest together a moment longer)
		// 3) contact: the overlay (merge_idle) fades up over the singles, which fade out under it
		// fix4 B (proof): render() swaps the cells' content, so fading the cells faded nothing (2 blank frames). Snapshot the
		// singles as ghosts in place first and crossfade those out under the rising stack.
		const ghosts = cells.map((el) => { const g = el.cloneNode(true) as HTMLElement; g.removeAttribute('id'); g.querySelectorAll('.mx,.lock').forEach((x) => x.remove());
			g.classList.add('mGhost'); g.style.cssText += `;position:absolute;left:${el.offsetLeft}px;top:${el.offsetTop}px;width:${el.offsetWidth}px;height:${el.offsetHeight}px;margin:0;pointer-events:none;visibility:visible;transform:${getComputedStyle(el).transform}`;
			el.parentElement?.insertBefore(g, el.nextSibling); return g; });
		render(300); // frame draws in after the crossfade
		const ov = ovOf(reel);
		ghosts.forEach((g) => A(g, [{ opacity: 1 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], { duration: 330, easing: 'cubic-bezier(.37,0,.63,1)', fill: 'forwards' }).finished.catch(() => {}).finally(() => g.remove()));
		const lets = ov ? [...ov.querySelectorAll<HTMLElement>('canvas.stk_letters, .mLets')] : [];
		cells.forEach((el, row) => {
			el.style.visibility = ''; // render() hid them: keep them for the crossfade, hidden again in finally
			const dy = (1.5 - row) * c * 0.38;
			A(el, [{ transform: `translateY(${dy.toFixed(1)}px) scale(.985,.96)`, opacity: 1 }, { opacity: 1, offset: 0.45 }, { transform: `translateY(${(dy * 1.15).toFixed(1)}px) scale(.98,.95)`, opacity: 0 }], { duration: 300, easing: 'ease-in-out', fill: 'forwards' }); // stay under the rising elf, then go
		});
		if (ov) {
			ov.style.animation = 'none';
			ov.style.transformOrigin = '50% 100%';
			if (hasSheet('fx_wild')) play('fx_wild', 'wflash', ov, { cls: 'wfx', loop: false, style: `position:absolute;left:50%;top:50%;width:${Math.round(S.cell * 2.2)}px;height:${Math.round(S.cell * 3.6)}px;translate:-50% -50%;z-index:6` });
			if (hasSheet('fx_feat')) play('fx_feat', 'burst', ov, { cls: 'wfx', loop: false, style: `position:absolute;left:50%;top:50%;width:${Math.round(S.cell * 2)}px;height:${Math.round(S.cell * 2)}px;translate:-50% -50%;z-index:6` });
			A(ov, [{ transform: 'scale(.82,.78)', opacity: 0 }, { transform: 'scale(1.16,1.08)', opacity: 1, offset: 0.5 }, { transform: 'none', opacity: 1 }], { duration: 360, easing: 'cubic-bezier(.15,1.35,.4,1)' });
			// 4) letters fade up softly after the body (the held last frame of letters_ignite, or the CSS letters)
			lets.forEach((l) => A(l, [{ opacity: 0 }, { opacity: 1 }], { duration: 250, delay: 240, easing: 'ease-out', fill: 'backwards' }));
		}
		await sw(300);
	} finally {
		cells.forEach((el) => {
			cancelMotion(el, true);
			el.querySelectorAll<HTMLElement>('.mx').forEach(hideGem);
			if (S.full.has(reel)) el.style.visibility = 'hidden';
		});
		document.querySelectorAll('.mGhost').forEach((g) => g.remove());
		clearCoveredGems();
		tapped = skipping; end();
	}
	// 5) the settled elf reacts (per-elf face, ~2.6-2.75 s at 12 fps, real speed); letters + frame keep drawing in alongside.
	// Not awaited: it doesn't block the win flow. Skipped (straight to idle) when the stack was tapped through / turbo.
	const ov = ovOf(reel);
	if (react && ov && !tapped && !S.turbo && ov.classList.contains('full')) void stackReact(ov, reel);
}

/** mergeGroups (a fresh group). `apply` swaps the overlays to the merged one at the hit. */
export async function mergeIn(reels: number[], values: number[], product: number, apply: () => void) {
	stackReactSkip();
	begin();
	skipping = false; // turbo shortens this merge; it does not snap it. stackIn still snaps.
	armSkip();
	setPhase('merge', dbStats());
	const B = $('#board'), n = reels.length, big = n >= 4, lo = reels[0], step = n > 1 ? pos(lo + 1, 0).x - pos(lo, 0).x : S.cell, x0 = pos(lo, 0).x;
	const amp = mergeAmp(reducedMotion());
	const made: HTMLElement[] = [];
	const dimmed: HTMLElement[] = [];
	let applied = false;
	const cut = () => {
		if (applied) return; applied = true;
		try { apply(); } catch (e) { crumb('merge-apply', { msg: scrub((e as Error)?.message || String(e)) }); }
	};
	try {
		const olds = [...new Set(reels.map(ovOf))].filter((o): o is HTMLElement => !!o);
		const mid = lo + (n - 1) / 2;
		// 1) wind-up. The board dims. Outline glows come off (they are static silhouettes and
		//    would otherwise ghost). Live rigs stay up, play their win clips, and the whole
		//    overlay container leans in — not a frozen snapshot, and not a bone pose.
		B.classList.add('mAnt');
		const cells = document.getElementById('cells');
		const dim = (1 - 0.4 * amp).toFixed(3);
		if (cells) { cells.style.filter = `brightness(${dim})`; dimmed.push(cells); }
		document.querySelectorAll<HTMLElement>('#overlays .ov').forEach((o) => {
			if (!olds.includes(o)) { o.style.filter = `brightness(${dim})`; dimmed.push(o); }
		});
		hideMergeGlows(olds);
		olds.forEach((o) => {
			if (hasSheet('fx_wild')) play('fx_wild', 'wshineT', o, { cls: 'wfx wfxIn wfxTop', loop: false });
			try { if (dbKnown(o) || o.querySelector(':scope > canvas.stk_db')) void dbPlay(o, 'win').catch(() => {}); } catch { /* stills still lean */ }
		});
		const warm = Promise.all([stackPrepare(reels), preloadStacks()]);
		const movers = olds.map((o) => {
			const rs = (o.dataset.reels ?? o.dataset.reel ?? '0').split(',').map(Number);
			const rc = (rs[0] + rs[rs.length - 1]) / 2;
			const d = (mid - rc) * step;
			const pose = mergeLean(d, n, amp);
			o.style.transformOrigin = '50% 100%';
			o.style.overflow = 'visible';
			o.style.zIndex = String(4 + Math.round(2 - Math.abs(mid - rc)));
			o.querySelectorAll<HTMLElement>('.mLets, canvas.stk_letters').forEach((l) =>
				M(l, [{ opacity: 1 }, { opacity: 0 }], { duration: mergeMs(200, !!S.turbo), fill: 'forwards' }));
			M(o, [{ transform: 'none' }, { transform: pose.crouch }], { duration: mergeMs(MERGE_BEAT, !!S.turbo), easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' });
			return { el: o, pose };
		});
		await beat(MERGE_BEAT);
		// 2) a big, readable pull-in on the live containers.
		movers.forEach((pt) => {
			M(pt.el, [
				{ transform: pt.pose.crouch },
				{ transform: pt.pose.over, offset: 0.72 },
				{ transform: pt.pose.pull },
			], { duration: mergeMs(MERGE_BEAT, !!S.turbo), easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' });
		});
		await beat(MERGE_BEAT);
		// 3) impact. A large sprite flash, seam sparks, a screen punch, and a brief white-out
		//    frame (existing wflash sprite, scaled over the whole group). Then the singles
		//    are released and the group rig bursts in.
		const seams: number[] = [];
		for (let i = 1; i < n; i++) seams.push(x0 + i * step - (step - S.cell) / 2);
		const flash = document.createElement('div');
		const midX = x0 + ((n - 1) * step) / 2 + S.cell / 2;
		flash.style.cssText = `position:absolute;left:${midX}px;top:50%;width:1px;height:1px;pointer-events:none;z-index:8`;
		B.appendChild(flash); made.push(flash);
		const flashW = Math.round(Math.max(n * S.cell * 1.35, S.cell * 3.2));
		const flashH = Math.round(S.cell * 4.2);
		if (hasSheet('fx_wild')) play('fx_wild', 'wflash', flash, { cls: 'wfx', loop: false, style: `position:absolute;width:${flashW}px;height:${flashH}px;translate:-50% -50%` });
		if (hasSheet('fx_feat')) play('fx_feat', 'burst', flash, { cls: 'wfx', loop: false, style: `position:absolute;width:${Math.round(S.cell * 3.2 * (0.85 + 0.15 * amp))}px;height:${Math.round(S.cell * 3.2 * (0.85 + 0.15 * amp))}px;translate:-50% -50%` });
		seams.forEach((x) => {
			const h = document.createElement('div');
			h.style.cssText = `position:absolute;left:${x}px;top:46%;width:1px;height:1px;pointer-events:none;z-index:8`;
			B.appendChild(h); made.push(h);
			const tall = Math.round((olds[0]?.offsetHeight || S.cell * 4) * 0.95);
			if (hasSheet('fx_wild')) play('fx_wild', 'seam', h, { cls: 'wfx', loop: false, style: `position:absolute;width:${Math.round(S.cell * 0.95)}px;height:${tall}px;translate:-50% -50%` });
			if (hasSheet('fx_feat')) play('fx_feat', 'burst', h, { cls: 'wfx', loop: false, style: `position:absolute;width:${Math.round(160 * (0.85 + 0.15 * amp))}px;height:${Math.round(160 * (0.85 + 0.15 * amp))}px;translate:-50% -50%` });
		});
		try {
			boardWin(n >= 4 ? 'big' : n >= 3 ? 'medium' : 'small');
			boardShake(3 + n, 0.2);
		} catch { /* the camera is optional; the cut still happens */ }
		await new Promise<void>((res) => {
			const hit = mergeMs(MERGE_HIT, !!S.turbo), cap = mergeMs(MERGE_BEAT, !!S.turbo);
			let t = setTimeout(afterHit, hit);
			const finish = () => { clearTimeout(t); beatRes = null; finishStage(); res(); };
			beatRes = finish;
			function afterHit() {
				let open = true;
				beatRes = finish;
				t = setTimeout(() => { open = false; beatRes = null; res(); }, cap);
				warm.then(() => { if (!open) return; open = false; clearTimeout(t); if (beatRes === finish) beatRes = null; res(); });
			}
		});
		// 4) reveal. Stop the joining rigs only now, at the hit, and burst the group in over the flash.
		const badges = grab(reels.map((r) => ovMx(r)));
		if (olds.length) stackRelease(olds);
		cut();
		const ov = ovOf(lo);
		if (ov) {
			ov.style.animation = 'none'; ov.style.transformOrigin = '50% 100%';
			{ const m = ov.querySelector<HTMLElement>('.mx'); if (m) m.style.opacity = '0'; }
			const pop = 1 + 0.22 * amp * (big ? 1.25 : 1);
			M(ov, [
				{ transform: `scale(${(0.72 - 0.04 * Math.min(n, 5)).toFixed(3)},0.68)` },
				{ transform: `scale(${pop.toFixed(3)},${(pop * 0.96).toFixed(3)})`, offset: 0.48 },
				{ transform: 'scale(0.97,1.03)', offset: 0.78 },
				{ transform: 'none' },
			], { duration: mergeMs(MERGE_BEAT, !!S.turbo), easing: 'cubic-bezier(.15,1.4,.35,1)', fill: 'forwards' });
			try {
				if (dbKnown(ov)) void dbPlay(ov, 'win').catch(() => {});
				else if (hasStack('merge_join', ov)) void stackOnce('merge_join', ov);
				else if (!ov.querySelector('canvas.stk_db')) growFromSingles(ov, n);
			} catch { /* the scale above is the reveal either way */ }
		}
		const lets = ov && !stackLetters(ov) ? [...ov.querySelectorAll<HTMLElement>('.mLets')] : [];
		lets.forEach((l, i) => M(l, [{ opacity: 0 }, { opacity: 1 }], { duration: mergeMs(220, !!S.turbo), delay: mergeMs(40 * i, !!S.turbo), easing: 'ease-out', fill: 'backwards' }));
		await beat(MERGE_BEAT);
		// 5) gems arc into the merged total; the product punches on each landing.
		const mx = ov?.querySelector<HTMLElement>('.mx') || null;
		await new Promise<void>((res) => {
			const run = recombine(badges, mx, values, product, big, true);
			const finish = () => { skipping = true; beatRes = null; finishStage(); anims.forEach((a) => { try { a.finish(); } catch { a.cancel(); } }); waiters.forEach((w) => w()); waiters.clear(); res(); };
			beatRes = finish;
			run.then(() => { if (beatRes === finish) beatRes = null; res(); }, () => { if (beatRes === finish) beatRes = null; res(); });
		});
		// 6) one secondary bounce, then idle.
		if (ov) {
			try { dbNudge(ov, 0.28 * amp, 0.36); } catch { /* overlay scale below still settles */ }
			M(ov, [{ transform: 'none' }, { transform: `scale(${(1 + 0.04 * amp).toFixed(3)},${(1 - 0.03 * amp).toFixed(3)})`, offset: 0.4 }, { transform: 'none' }], { duration: mergeMs(200, !!S.turbo), easing: 'ease-out' });
			if (dbKnown(ov)) void dbPlay(ov, 'idle').catch(() => {});
		}
		await beat(200);
	} catch (e) {
		crumb('merge', { msg: scrub((e as Error)?.message || String(e)) });
		cut();
	} finally {
		mergeHold = null; beatRes = null; pendingSkip = false;
		dimmed.forEach((e) => { e.style.filter = ''; });
		document.querySelectorAll<HTMLElement>('#overlays .ov').forEach((o) => { if (o.style.overflow === 'visible') o.style.overflow = ''; });
		made.forEach((m) => m.remove()); B.classList.remove('mAnt');
		const ov = ovOf(lo), mx = ov?.querySelector<HTMLElement>('.mx'); if (mx) { mx.style.opacity = ''; setGem(mx, product, false); }
		document.querySelectorAll('#flyLayer .fly').forEach((f) => f.remove());
		clearCoveredGems();
		end();
		setPhase(S.inBonus ? 'bonus' : 'board', dbStats());
	}
}

function hideMergeGlows(olds: HTMLElement[]) {
	olds.forEach((o) => {
		o.querySelectorAll<HTMLElement>(':scope > img.stk_glow, :scope .symGlow, :scope .ovGlow').forEach((g) => {
			g.style.visibility = 'hidden';
			g.remove();
		});
	});
}
/** One stage over the merging overlays (same look as an overlay, but one piece: no inner borders / gaps), holding a
 *  snapshot of each overlay's body (its stack canvas, or a copy of its placeholder image) and, separately, its letters.
 *  The overlays themselves are hidden under it; mergeIn's apply() re-renders them at the cut. */
function growFromSingles(ov: HTMLElement, n: number) {
	const body = ov.querySelector<HTMLElement>(':scope>canvas.stk_body') || ov.querySelector<HTMLElement>(':scope>.wart'); if (!body) return;
	const s0 = n >= 5 ? 0.62 : n >= 3 ? 0.72 : 0.8;
	body.style.transformOrigin = '50% 100%';
	A(body, [{ transform: `scale(${s0})` }, { transform: `scale(${s0 + (1 - s0) * 0.62},${(s0 + (1 - s0) * 0.62) * 1.04})`, offset: 0.2 }, { transform: 'scale(1.06,1.02)', offset: 0.42 },
		{ transform: 'scale(1.04,.96)', offset: 0.55 }, { transform: 'scale(.99,1.012)', offset: 0.72 }, { transform: 'scale(1.004,.997)', offset: 0.86 }, { transform: 'none' }],
	{ duration: 560, easing: 'ease-out' }).finished.catch(() => {}).finally(() => { body.style.transformOrigin = ''; });
}

const runTo = (v: number[], i: number, how: 'mul' | 'add') =>
	how === 'add' ? v.slice(0, i + 1).reduce((a, b) => a + b, 0) : v.slice(0, i + 1).reduce((a, b) => a * b, 1);
/** Fly gems into `target`. `how` is 'mul' for a cross-reel merge (the running product) and 'add' for a single-reel stack (the running sum). */
export async function flyGems(gems: HTMLElement[], target: HTMLElement | null, values: number[], total: number, big = false, paced = false, how: 'mul' | 'add' = 'mul') {
	return recombine(gems, target, values, total, big, paced, how);
}
async function recombine(gems: HTMLElement[], target: HTMLElement | null, values: number[], product: number, big = false, paced = false, how: 'mul' | 'add' = 'mul') {
	const go = (el: Element, kf: Keyframe[], o: KeyframeAnimationOptions) => {
		if (!paced) return A(el, kf, o);
		const dur = Number(o.duration) || 0, delay = Number(o.delay) || 0;
		return M(el, kf, { ...o, duration: dur ? mergeMs(dur, !!S.turbo) : 0, delay: delay ? mergeMs(delay, !!S.turbo) : 0 });
	};
	if (!target) { gems.forEach((g) => g.remove()); return; }
	target.style.opacity = '0';
	const tr = target.getBoundingClientRect();
	await Promise.all(gems.map((g, i) => {
		const r = g.getBoundingClientRect(), k = r.width ? tr.width / r.width : 1; // getBoundingClientRect: same (screen) space for both
		const sc = toStage(r).width / (r.width || 1), dx = (tr.left - r.left) * sc, dy = (tr.top - r.top) * sc, lift = g.closest('.ov') ? S.cell * 0.14 : -S.cell * 0.62; // a high, readable arc (inside an overlay it dips — overflow hidden)
		const hid = g.style.opacity === '0'; g.style.opacity = ''; // mergeIn's clones were hidden through the lean: they fade in at their corner, then fly
		const here = Math.hypot(dx, dy) < 6; // the clone already sits on the group's gem (first reel): it simply becomes the gem
		if (paced && !here) trailBetween(g, target, Math.min(1.5, 0.75 + Math.log2(Math.max(2, values[i] || 2)) * 0.12));
		return go(g, here ? [{ opacity: 0 }, { opacity: 0 }] : [{ transform: `translate(0,0) scale(${hid ? 0.8 : 1})`, opacity: hid ? 0 : 1 }, { transform: 'translate(0,0) scale(1)', opacity: 1, offset: .18 }, { opacity: 1, offset: .5 }, { transform: `translate(${dx * 0.5}px,${dy * 0.5 + lift}px) scale(1.28)`, offset: .58 }, { opacity: 0, offset: .78 }, { transform: `translate(${dx}px,${dy}px) scale(${k})`, opacity: 0 }], // fades into the gem: never two badges on one corner
			{ duration: here ? 1 : 420, delay: i * 90, easing: 'cubic-bezier(.45,0,.35,1)', fill: 'both' }).finished.catch(() => {}).then(async () => {
			g.style.opacity = '0';
			const last = i === gems.length - 1, v = last ? product : runTo(values, i, how);
			const pop = paced
				? 1 + Math.min(0.42, Math.log2(Math.max(2, v)) * 0.07) * (big ? 1.2 : 1) * mergeAmp(reducedMotion())
				: (last ? (big ? 1.4 : 1.3) : 1.18);
			if (!last) { target.style.opacity = ''; setGem(target, v, false); go(target, [{ transform: 'scale(1)' }, { transform: `scale(${pop.toFixed(3)})`, offset: .4 }, { transform: 'scale(1)' }], { duration: 200 }); return; }
			// the last one lands: count up from the running product to the total, then pop. Elapsed time, not a frame count.
			const from = gems.length > 1 ? runTo(values, i - 1, how) : values[0], dur = paced ? mergeMs(220, !!S.turbo) : T(260), t0 = performance.now();
			target.style.opacity = '';
			await new Promise<void>((res) => {
				// Sample on a short timer. The shown value follows elapsed time, so 60 Hz and 120 Hz land on the same number.
				const tick = () => {
					const u = skipping || dur <= 0 ? 1 : Math.min(1, (performance.now() - t0) / dur);
					setGem(target, Math.round(from + (v - from) * (1 - (1 - u) ** 3)), false);
					u < 1 ? setTimeout(tick, 16) : res();
				};
				tick();
			});
			setGem(target, v);
			go(target, [{ transform: 'scale(1)' }, { transform: `scale(${pop.toFixed(3)})`, offset: .4 }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' });
		});
	}));
	gems.forEach((g) => g.remove()); target.style.opacity = '';
}

/** A merged group grows: split the total into per-reel corner gems, tick the changed reels by their grow step (+1, +2 in Powder Day), recombine. */
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
		// 2) each changed reel ticks up by its grow step with a pop (burst sprite + scale)
		let k = 0;
		for (let i = 0; i < n; i++) if (to[i] !== from[i]) { const g = gems[i], v = to[i]; setTimeout(() => setGem(g, v), skipping ? 0 : T(k++ * 90)); }
		if (skipping) gems.forEach((g, i) => setGem(g, to[i], false));
		await sw(k * 90 + 260);
		gems.forEach((g, i) => setGem(g, to[i], false));
		// 3) fly back and recombine into the new total (counts up)
		if (mx) { cancelMotion(mx); }
		await recombine(gems, mx, to, toProd);
		await sw(60);
	} finally {
		gems.forEach((g) => g.remove());
		if (mx) { cancelMotion(mx); mx.style.opacity = ''; setGem(mx, toProd, false); }
		end();
	}
}

/** A winning line runs through a full-reel / merged wild: bounce once and show its win outline. */
export function ovWin(reel: number) {
	const ov = ovOf(reel); if (!ov || ov.classList.contains('win')) return;
	ov.classList.add('win'); stackWin(ov);
	// the art bumps (a beat after the tile's border flash, CSS .ov.win>.tGl); the overlay's tile edge holds still
	ovArt(ov).forEach((e) => playMotion(e as HTMLElement, [{ transform: 'none' }, { transform: 'translateY(-3%) scale(1.03)', offset: .4 }, { transform: 'translateY(.6%) scale(.995)', offset: .75 }, { transform: 'none' }], { duration: T(460), delay: 40, easing: 'ease-out' }));
}
export const clearOvWins = () => document.querySelectorAll<HTMLElement>('.ov.win').forEach((o) => { o.classList.remove('win'); stackWinOff(o); });
