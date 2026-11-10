// Merge timing on the 150 BPM grid (beat = 400 ms, bar = 1.6 s). Durations are real milliseconds,
// so a 50 ms hit pause is the same wall time at 60 Hz and at 120 Hz. Turbo shortens the merge.
// Reduced motion is an amplitude, applied by the caller, not a shorter clock.
export const MERGE_BEAT = 400;
export const MERGE_HIT = 50;

export function mergeMs(ms: number, turbo: boolean): number {
	const n = Math.round(ms * (turbo ? 0.6 : 1));
	return ms > 0 ? Math.max(16, n) : 0;
}

export function mergeAmp(reduced: boolean): number {
	return reduced ? 0.5 : 1;
}
