// Elves Gone Wild: split a stack's value over its 4 landing wilds so the badges add up EXACTLY to the value (the
// stack sums its 4 cells). Even split, remainder to the top rows; under 4 the extra rows get 0 and symHTML draws no
// badge for a 0 (e.g. 2 -> [1, 1, 0, 0]). No imports so scripts/test-egw.mjs can load it on its own.
export const egwParts = (v: number, rows = 4): number[] => {
	const n = Math.max(0, Math.floor(v));
	return Array.from({ length: rows }, (_, i) => Math.floor(n / rows) + (i < n % rows ? 1 : 0));
};
