// Board tempo: ONE knob for every board animation (merge / stacks / gems / win lines / counts / feature FX).
// The win screens' motion patch uses SLOW = 2 for the same feel, so ANIM_TEMPO = 2 = half the old speed.
//   T(ms)        a board duration / delay in ms, stretched (WAAPI, timers, count-ups)
//   spriteRate   sprite.ts divides sheet fps by it for anything played inside #board (stacks sheets, symbol wins,
//                bursts, wild FX, respin dots), and stretches the play delay to match: no re-exported sheets
//   --at         the same factor for the board's CSS animations / transitions (elfhaus.css "board tempo" block)
//   hold(ms)     a board pause, stretched AND skippable (tap / Space resolve every pending hold at once)
// The reels have their own, milder knob (SPIN_TEMPO, reels.ts) so a stop still feels like a normal Stake slot.
// Turbo / quick spin = tempo 1: the old fast timings everywhere (turbo paths in each module stay as they were).
import { S } from './ui';

export const ANIM_TEMPO = 2;
export const SPIN_TEMPO = 1.25; // reel spin + stop pacing (spec: at most 1.3x calmer)
export const STOP_TEMPO = 1.1; // the brake / settle itself stays snappy
export const tempo = () => (S.turbo ? 1 : ANIM_TEMPO);
export const T = (ms: number) => Math.round(ms * tempo());
/** Sprite playback-rate divisor for a host (board hosts only; HUD, banners and win screens keep their own pace). */
export const spriteRate = (host: Element) => (host.closest('#board') ? tempo() : 1);

const holds = new Set<() => void>();
/** A stretched, skippable board pause. */
export function hold(ms: number) {
	return new Promise<void>((res) => {
		const done = () => { clearTimeout(t); holds.delete(done); res(); };
		const t = setTimeout(done, Math.max(0, T(ms))); holds.add(done);
	});
}
/** Tap / Space: end every pending board pause now. */
export function skipHolds() { [...holds].forEach((f) => f()); }
/** Keep the CSS factor (--at on <body>) in step with turbo. */
export function syncTempo() { document.body.classList.toggle('turbo', S.turbo); document.body.style.setProperty('--at', String(tempo())); }
