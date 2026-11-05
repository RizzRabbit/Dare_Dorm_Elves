// Board animation (chalet-boardfx, James 2026-11-05): swell / punch / shake / pulse / breathe on the ONE board Pixi
// stage's fx root (board/stage.ts setBoardFx). Every effect writes its own channel (sw swell, pk punch + pulse,
// br breathe, x / y shake); the root's transform is base * channels, so finishing tweens always land on the exact base
// (scale 1, offset 0): no layout drift, and nothing here touches the reel / cell tweens. Timings on the 150 BPM grid
// (beat 0.4 s, bar 1.6 s). Turbo: shakes at 40% (under 2 px skipped), no pulse / breathe. prefers-reduced-motion: none.
import { gsap } from 'gsap';
import { setBoardFx } from './board/stage';
import { S } from './ui';

const BEAT = 0.4, BAR = 1.6;
const c = { sw: 1, pk: 1, bp: 1, br: 1, x: 0, y: 0 };
const push = () => setBoardFx(c.x, c.y, c.sw * c.pk * c.bp * c.br);
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
// v27 (James on Stake iOS: "no board animations"): reduced motion no longer switches gameplay fx off (iOS Reduce Motion
// killed all of it); it softens them to half and drops only the idle breathing. Turbo = 60%, still visible.
const amp = () => (reduced() ? 0.5 : 1) * (S.turbo ? 0.6 : 1);
let swT: gsap.core.Tween | null = null, pkT: gsap.core.Animation | null = null, shT: gsap.core.Tween | null = null, brT: gsap.core.Tween | null = null, pulseT: gsap.core.Timeline | null = null;
const safe = (f: () => void) => { try { f(); } catch (e) { console.error('[elfhaus] boardfx', e); } };

/** Scatter tease: swell 5% from centre while the remaining reels hold (2 beats in); back on the stop (1 beat). */
export function boardTease(on: boolean) { safe(() => {
	swT?.kill(); idle(false);
	swT = gsap.to(c, { sw: on ? 1 + 0.05 * amp() : 1, duration: on ? 2 * BEAT : BEAT, ease: on ? 'power2.out' : 'power2.inOut', onUpdate: push, onComplete: () => { if (!on) { c.sw = 1; push(); } } });
}); }
/** Decaying shake: `px` peak (before amp), `s` seconds; a 22 / 17 Hz wobble with a linear decay, so the peak always lands. */
export function boardShake(px: number, s = 0.3) { safe(() => {
	px *= amp(); if (px < 1) return;
	shT?.kill(); const p = { k: 1 }, t0 = performance.now(), ph = Math.random() * 6.28;
	shT = gsap.to(p, { k: 0, duration: s, ease: 'none', onUpdate: () => { const t = (performance.now() - t0) / 1000; c.x = Math.sin(ph + t * 2 * Math.PI * 22) * px * p.k; c.y = Math.cos(ph + t * 2 * Math.PI * 17) * px * 0.7 * p.k; push(); }, onComplete: () => { c.x = c.y = 0; push(); } });
}); }
/** Quick scale bump (punch channel): up in `up` s, back in `down` s. */
function bump(to: number, up: number, down: number) {
	pkT?.kill();
	pkT = gsap.timeline({ onComplete: () => { c.bp = 1; push(); } })
		.to(c, { bp: 1 + (to - 1) * amp(), duration: up, ease: 'power3.out', onUpdate: push })
		.to(c, { bp: 1, duration: down, ease: 'power2.out', onUpdate: push });
}
/** Bonus trigger: 8% punch-in over 120 ms (back over 1 beat) + 8 px / 1 beat shake, landing `delayMs` later (the stinger's bar). */
export function boardPunch(delayMs = 0) { safe(() => {
	idle(false);
	gsap.delayedCall(delayMs / 1000, () => safe(() => { bump(1.08, 0.12, BEAT); boardShake(8, BEAT); }));
}); }
/** Line wins: small 1.5% bump, medium 2.5% + 3 px, big 3.5% + 5 px (all on a 60 ms attack, 1/2 beat release). */
export function boardWin(kind: 'small' | 'medium' | 'big') { safe(() => {
	if (kind === 'small') bump(1.015, 0.06, BEAT / 2);
	else if (kind === 'medium') { bump(1.025, 0.06, BEAT / 2); boardShake(3, 0.25); }
	else { bump(1.035, 0.06, BEAT * 0.75); boardShake(5, 0.3); }
}); }
/** Big-win banner tier i (0 = BIG, 1 = MEGA, ...): 8 px + 3 px per tier (max 18), 1 beat, with a 5% punch. */
export function boardBigTier(i: number) { safe(() => { bump(1.05, 0.08, BEAT); boardShake(Math.min(18, 8 + 3 * i), BEAT); }); }
/** Count-up: +2% pulse on every beat (60 ms up, 340 ms down) until stopped. */
export function boardPulse(on: boolean) { safe(() => {
	pulseT?.kill(); pulseT = null;
	if (!on) { gsap.to(c, { pk: 1, duration: 0.15, onUpdate: push, onComplete: () => { c.pk = 1; push(); } }); return; }
	idle(false);
	pulseT = gsap.timeline({ repeat: -1 }).to(c, { pk: 1 + 0.02 * amp(), duration: 0.06, ease: 'power2.out', onUpdate: push }).to(c, { pk: 1, duration: BEAT - 0.06, ease: 'power2.in', onUpdate: push });
}); }
/** Idle breathing: 0.7% over 2 bars each way (6.4 s cycle), only while nothing plays; off in turbo / reduced motion (stays calm). */
export function idle(on: boolean) { safe(() => {
	brT?.kill(); brT = null;
	if (on && !reduced() && !S.turbo) { c.br = 1; brT = gsap.to(c, { br: 1.007, duration: 2 * BAR, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: BAR, onUpdate: push }); }
	else if (c.br !== 1) gsap.to(c, { br: 1, duration: 0.2, onUpdate: push, onComplete: () => { c.br = 1; push(); } });
}); }
/** Wild land: that reel's cells bump 9 px up and back in 1/2 beat (CSS `translate`, additive: never fights the cells' transform tweens),
 * plus a small 2 px board knock. The mirror draws the DOM cells, so the nudge shows in the board stage. */
export function reelBump(r: number) { safe(() => {
	const d = Math.max(3, 9 * amp());
	for (let row = 0; row < 8; row++) {
		const e = document.getElementById(`c${r}${row}`); if (!e) break;
		e.animate([{ translate: '0 0' }, { translate: `0 -${d}px`, offset: 0.3 }, { translate: '0 0' }], { duration: BEAT * 500, easing: 'ease-out', composite: 'add' });
	}
	boardShake(2, 0.15);
}); }
(globalThis as any).__boardFx = () => ({ ...c });
