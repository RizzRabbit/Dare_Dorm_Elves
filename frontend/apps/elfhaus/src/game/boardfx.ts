// Board animation (chalet-boardfx, James 2026-11-05): swell / punch / shake / pulse / breathe on the ONE board Pixi
// stage's fx root (board/stage.ts setBoardFx). Every effect writes its own channel (sw swell, pk punch + pulse,
// br breathe, x / y shake); the root's transform is base * channels, so finishing tweens always land on the exact base
// (scale 1, offset 0): no layout drift, and nothing here touches the reel / cell tweens. Timings on the 150 BPM grid
// (beat 0.4 s, bar 1.6 s). Turbo: shakes at 40% (under 2 px skipped), no pulse / breathe. prefers-reduced-motion: none.
import { gsap } from 'gsap';
import { setBoardFx } from './board/stage';
import { S } from './ui';

const BEAT = 0.4, BAR = 1.6;
const c = { sw: 1, pk: 1, br: 1, x: 0, y: 0 };
const push = () => setBoardFx(c.x, c.y, c.sw * c.pk * c.br);
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const off = () => reduced();
let swT: gsap.core.Tween | null = null, pkT: gsap.core.Animation | null = null, shT: gsap.core.Tween | null = null, brT: gsap.core.Tween | null = null, pulseT: gsap.core.Timeline | null = null;

/** Scatter tease: swell 3% from centre while the remaining reels hold (2 beats in); back on the stop (1 beat). */
export function boardTease(on: boolean) {
	if (off() && on) return; swT?.kill(); idle(false);
	swT = gsap.to(c, { sw: on ? 1.03 : 1, duration: on ? 2 * BEAT : BEAT, ease: on ? 'power2.out' : 'power2.inOut', onUpdate: push, onComplete: () => { if (!on) { c.sw = 1; push(); } } });
}
/** Decaying shake: `px` peak, `s` seconds (random walk at ~60 Hz, linear decay to 0). */
export function boardShake(px: number, s = 0.3) {
	if (off()) return; if (S.turbo) { px *= 0.4; if (px < 2) return; }
	shT?.kill(); const p = { k: 1 };
	shT = gsap.to(p, { k: 0, duration: s, ease: 'none', onUpdate: () => { c.x = (Math.random() * 2 - 1) * px * p.k; c.y = (Math.random() * 2 - 1) * px * p.k; push(); }, onComplete: () => { c.x = c.y = 0; push(); } });
}
/** Bonus trigger: 6% punch-in over 120 ms (back over 300 ms) + 4 px / 350 ms shake, landing `delayMs` later (the stinger's bar). */
export function boardPunch(delayMs = 0) {
	if (off()) return; idle(false);
	gsap.delayedCall(delayMs / 1000, () => {
		pkT?.kill();
		pkT = gsap.timeline({ onUpdate: push, onComplete: () => { c.pk = 1; push(); } })
			.to(c, { pk: S.turbo ? 1.03 : 1.06, duration: 0.12, ease: 'power3.out', onUpdate: push })
			.to(c, { pk: 1, duration: 0.3, ease: 'power2.out', onUpdate: push });
		boardShake(4, 0.35);
	});
}
/** Line wins: small none, medium 2 px / 250 ms, big 3 px / 300 ms. */
export function boardWin(kind: 'small' | 'medium' | 'big') { if (kind === 'medium') boardShake(2, 0.25); else if (kind === 'big') boardShake(3, 0.3); }
/** Big-win banner tier i (0 = BIG, 1 = MEGA, ...): 5 px + 2 px per tier (max 11), 400 ms. */
export function boardBigTier(i: number) { boardShake(Math.min(11, 5 + 2 * i), 0.4); }
/** Count-up: +1.2% pulse on every beat (60 ms up, 340 ms down) until stopped. */
export function boardPulse(on: boolean) {
	pulseT?.kill(); pulseT = null;
	if (!on || off() || S.turbo) { gsap.to(c, { pk: 1, duration: 0.15, onUpdate: push, onComplete: () => { c.pk = 1; push(); } }); return; }
	idle(false);
	pulseT = gsap.timeline({ repeat: -1 }).to(c, { pk: 1.012, duration: 0.06, ease: 'power2.out', onUpdate: push }).to(c, { pk: 1, duration: BEAT - 0.06, ease: 'power2.in', onUpdate: push });
}
/** Idle breathing: 0.7% over 2 bars each way (6.4 s cycle), only while nothing plays; off in turbo / reduced motion. */
export function idle(on: boolean) {
	brT?.kill(); brT = null;
	if (on && !off() && !S.turbo) { c.br = 1; brT = gsap.to(c, { br: 1.007, duration: 2 * BAR, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: BAR, onUpdate: push }); }
	else if (c.br !== 1) gsap.to(c, { br: 1, duration: 0.2, onUpdate: push, onComplete: () => { c.br = 1; push(); } });
}
/** Wild land: that reel's cells bump 4 px up and back in 240 ms (CSS `translate`, additive: never fights the cells' transform tweens). */
export function reelBump(r: number) {
	if (off() || S.turbo) return;
	for (let row = 0; row < 8; row++) {
		const e = document.getElementById(`c${r}${row}`); if (!e) break;
		e.animate([{ translate: '0 0' }, { translate: '0 -4px', offset: 0.35 }, { translate: '0 0' }], { duration: 240, easing: 'ease-out', composite: 'add' });
	}
}
(globalThis as any).__boardFx = () => ({ ...c });
