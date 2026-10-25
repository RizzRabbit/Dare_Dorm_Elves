// UI effects played through SpriteAnim (sheet "fx", scripts/sprites/gen_fx_ui.py -> assets/final/fx/fx_ui.*).
import { loadSheet, play, stop, frameCSS, type Atlas } from './sprite';
import atlas from './fx/fx_ui.atlas.json';
import ART_JSON from './art.generated.json';
const ART = ART_JSON as Record<string, string | null>;

export const FX = 'fx';
export function loadFx() { return ART.fx_ui ? loadSheet(FX, ART.fx_ui as string, atlas as unknown as Atlas) : Promise.resolve(); }

/** Multiplier increase: burst sheet behind the lettering, centred on the text. */
export function mxBurst(mx: HTMLElement) {
	const c = Number(mx.dataset.cx || 70);
	play(FX, 'mxburst', mx, { cls: 'fxBurst', style: `left:${c}%`, prepend: true });
	mxGlint(mx, 0);
}
// Glint anchors (percent of the .mx box) relative to the text span: [fraction along text, y%].
const GL = [[0.82, 22], [0.3, 48], [0.58, 80]];
export function mxGlint(mx: HTMLElement, k = Math.floor(Math.random() * GL.length)) {
	const l = Number(mx.dataset.tl || 50), r = Number(mx.dataset.tr || 97);
	const [f, y] = GL[k];
	play(FX, 'glint', mx, { cls: 'fxGlint', style: `left:${(l + (r - l) * f).toFixed(1)}%;top:${y}%` });
}
// Occasional, staggered twinkles: every ~0.9-1.8s one random visible multiplier gets one glint.
let glT = 0;
export function startGlints() {
	clearTimeout(glT);
	const next = () => {
		const all = [...document.querySelectorAll<HTMLElement>('.mx')].filter((m) => m.offsetParent);
		if (all.length) mxGlint(all[Math.floor(Math.random() * all.length)]);
		glT = window.setTimeout(next, 900 + Math.random() * 900);
	};
	glT = window.setTimeout(next, 800);
}

/** LOCKED: padlock clamps in the tag icon slot and a sparkle burst runs round the cell border. */
export function lockFx(cell: HTMLElement) {
	const slot = cell.querySelector<HTMLElement>('.lock .lkI');
	if (slot) {
		slot.querySelectorAll('canvas').forEach((c) => c.remove());
		if (play(FX, 'lock', slot, { cls: 'fxFill', onEnd: () => setLockIcon(slot) })) slot.style.cssText = '';
	}
	play(FX, 'lockrim', cell, { cls: 'fxRim' });
}
export function setLockIcon(slot: HTMLElement) {
	slot.style.cssText = frameCSS(FX, 'lock', -1);
}
void stop;
export const lockIconCSS = () => frameCSS(FX, 'lock', -1);

/** Respin circles: static frames for empty / filled, the sheet for fill (forward) and reset (reverse). */
export const rcCSS = (filled: boolean) => frameCSS(FX, 'rcfill', filled ? -1 : 0);
export function rcFill(dot: HTMLElement, reverse = false) {
	dot.querySelectorAll('canvas').forEach((c) => c.remove());
	const a = play(FX, 'rcfill', dot, { cls: 'fxFill', reverse, fps: reverse ? 48 : undefined, onEnd: () => (dot.style.cssText = rcCSS(!reverse)) });
	dot.style.cssText = a ? '' : rcCSS(!reverse); // the canvas covers the dot while it plays
}
