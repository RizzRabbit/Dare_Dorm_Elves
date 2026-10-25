// Big-win character layer (Roxy, Vi and Coco), shown from 1000x: behind the amount, below the tier title.
// The sprite sheets are being made separately (/workspace/elfhaus-maxwin/bigwin/: sheets + JSON + INTEGRATION note).
// PLUG-IN: drop the atlas as src/game/fx/bw_chars.atlas.json and add "bw_chars": ["assets/final/fx/bw_chars.webp"] to
// art-manifest.json; loadAllFx() preloads it during loading and this layer plays its CHARS_ANIM loop. Until then a
// dashed placeholder box marks the slot. Timing: ui.ts bigWin() adds #bigwin.chars when the count crosses 1000x
// (CSS fades the layer in over .45 s); the loop runs until the banner closes, then stops (canvas back to the pool).
import { play, stop, hasSheet } from './sprite';
export const CHARS_SHEET = 'bw_chars', CHARS_ANIM = 'loop';
let anim: ReturnType<typeof play> | null = null;
export function showChars(B: HTMLElement) {
	const host = B.querySelector<HTMLElement>('.bwChars'); if (!host || anim || !hasSheet(CHARS_SHEET)) return;
	anim = play(CHARS_SHEET, CHARS_ANIM, host, { loop: true, cls: 'bwcSpr' });
}
export function hideChars() { if (anim) { stop(anim); anim = null; } }
