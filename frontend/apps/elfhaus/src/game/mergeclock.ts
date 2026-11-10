// Merge timing on the 150 BPM grid (beat = 400 ms, bar = 1.6 s). Durations are real milliseconds,
// so a 50 ms hit pause is the same wall time at 60 Hz and at 120 Hz. Turbo shortens the merge.
// Reduced motion is an amplitude, applied by the caller, not a shorter clock.
export const MERGE_BEAT = 400;
export const MERGE_HIT = 50;
/** Largest downward shift, in CSS pixels, any merge lean pose may use. Elves stay inside their cell. */
export const MERGE_MAX_DROP = 8;

export function mergeMs(ms: number, turbo: boolean): number {
	const n = Math.round(ms * (turbo ? 0.6 : 1));
	return ms > 0 ? Math.max(16, n) : 0;
}

export function mergeAmp(reduced: boolean): number {
	return reduced ? 0.5 : 1;
}

function drop(px: number, amp: number): number {
	const y = Math.max(0, px) * amp;
	return Math.min(MERGE_MAX_DROP, y);
}

/** Crouch and pull-in transforms for one joining stack. `d` is the signed gap to the group centre
 *  (positive = the stack sits left of centre and should travel right). Origin is the feet (50% 100%).
 *  Horizontal lean and a scale-Y crouch do the work; translateY never exceeds MERGE_MAX_DROP. */
export function mergeLean(d: number, n: number, amp: number): { crouch: string; over: string; pull: string } {
	const a = amp;
	// Travel most of the way to the meeting point so the lean reads on a phone. translateY stays capped.
	const L = d * (n >= 4 ? 0.72 : 0.84) * (0.7 + 0.3 * a);
	const dir = Math.sign(d) || 1;
	const yC = drop(6, a);
	const yO = drop(3, a);
	const crouch = `translateY(${yC.toFixed(1)}px) rotate(${(dir * 6 * a).toFixed(2)}deg) scale(${(1 + 0.04 * a).toFixed(3)},${(1 - 0.16 * a).toFixed(3)})`;
	const over = `translateX(${(L * 1.08).toFixed(1)}px) translateY(${yO.toFixed(1)}px) rotate(${(dir * 9 * a).toFixed(2)}deg) scale(${(1 + 0.06 * a).toFixed(3)},${(1 - 0.10 * a).toFixed(3)})`;
	const pull = `translateX(${L.toFixed(1)}px) rotate(${(dir * 5 * a).toFixed(2)}deg) scale(${(1 + 0.03 * a).toFixed(3)},${(1 - 0.06 * a).toFixed(3)})`;
	return { crouch, over, pull };
}

/** Every translateY() in a transform list, in CSS pixels (down is positive). */
export function translateYs(transform: string): number[] {
	const out: number[] = [];
	const re = /translateY\(([+-]?(?:\d+\.?\d*|\.\d+))(?:px)?\)/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(transform))) out.push(Number(m[1]));
	return out;
}

export function leanWithinCell(transform: string, max = MERGE_MAX_DROP): boolean {
	return translateYs(transform).every((y) => y <= max + 1e-6 && y >= -max);
}
