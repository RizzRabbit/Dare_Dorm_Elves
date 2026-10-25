// Glowing frame around every full-reel stacked wild (1 x 4) and every merged wild group (2-5 reels x 4): one frame per
// overlay, just inside the cell bounds (the overlay box), rounded like the symbols. Coloured by elf: each reel has a
// fixed elf (1 Roxy, 2 Jade, 3 Vi, 4 Coco, 5 Delilah); a merged group's frame is a horizontal gradient with each elf's
// colour centred over her reel. Accents are the stacks art's (stacks_anim/build_anim.py ACC / RIM): the crisp inner
// line uses the bright RIM tone, the soft glow the ACC tone.
// The frame is part of the overlay markup (ui.ts renderOverlays), so it re-places on every layout()/render, persists
// with sticky wilds and goes when the wild clears. frameIn() draws it in (opacity + scale only) at the merge's hard
// cut / when a stack lands; the glow layer breathes in CSS (opacity only).
export const ELF_ACC = ['#E2559D', '#24A89B', '#8550D6', '#CC6670', '#3B6FE0'] as const; // Roxy, Jade, Vi, Coco, Delilah
export const ELF_RIM = ['#FF7DBE', '#4FF0DC', '#B98BFF', '#FF9A9E', '#7FA4FF'] as const;

const paint = (reels: number[], pal: readonly string[]) => {
	const n = reels.length, c = (r: number) => pal[Math.max(0, Math.min(pal.length - 1, r))];
	if (n <= 1) return `linear-gradient(${c(reels[0] ?? 0)},${c(reels[0] ?? 0)})`;
	return `linear-gradient(90deg,${reels.map((r, i) => `${c(r)} ${(((i + 0.5) / n) * 100).toFixed(2)}%`).join(',')})`;
};
/** Frame markup for an overlay covering `reels` (0-based). */
export const frameHTML = (reels: number[]) =>
	`<i class="wFrame" style="--wfL:${paint(reels, ELF_RIM)};--wfG:${paint(reels, ELF_ACC)}"><b class="wfG"></b><b class="wfL"></b></i>`;
/** Draw-in: opacity 0 -> 1 plus scale 1.04 -> 1, ease-out, ~0.3 s. */
export function frameIn(ov: HTMLElement | null | undefined, delay = 0) {
	const f = ov?.querySelector<HTMLElement>(':scope>.wFrame'); if (!f) return;
	f.animate([{ opacity: 0, transform: 'scale(1.04)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' });
}
