// DOM side of the room depth (room.ts): the board frame is DOM, so its share of the one warm key light lives here.
//   #boardAO    the frame's lip shading the board's inner edges (heavier on the fire side it is lit from: left / top)
//   #frameLit   the fire's flicker spilling onto the frame's left side (opacity only, driven from the scene ticker)
//   #frameGlint now and then, when the fire flares, a highlight runs across the timber band and gold trim (ring masked)
// All pointer-events:none, aria-hidden, above #board and under the garland. prefers-reduced-motion: no glint, steady light.
import { FT, FW, BW, BH } from '../mkboard';
import { reduced } from './room';

let ao: HTMLElement | null = null, lit: HTMLElement | null = null, gl: HTMLElement | null = null, band: HTMLElement | null = null, u = 1;
const mk = (id: string, parent: HTMLElement) => {
	let e = document.getElementById(id);
	if (!e) { e = document.createElement('div'); e.id = id; e.setAttribute('aria-hidden', 'true'); parent.appendChild(e); }
	return e;
};
/** Size the overlays to the frame (fr = #frame rect in stage px). */
export function placeDepth(fr: DOMRect) {
	const f = document.getElementById('frame'); if (!f || !document.body.classList.contains('mk')) return;
	u = fr.width / FW;
	ao = mk('boardAO', f); lit = mk('frameLit', f); gl = mk('frameGlint', f);
	band ||= gl.appendChild(document.createElement('i'));
	Object.assign(ao.style, { left: FT * u + 'px', top: FT * u + 'px', width: BW * u + 'px', height: BH * u + 'px', borderRadius: 14 * u + 'px',
		boxShadow: `inset ${11 * u}px ${9 * u}px ${18 * u}px ${-4 * u}px rgba(14,5,2,.5), inset ${-3 * u}px ${-4 * u}px ${10 * u}px ${-5 * u}px rgba(14,5,2,.28)` });
	lit.style.borderRadius = gl.style.borderRadius = 30 * u + 'px';
	gl.style.padding = (FT - 2) * u + 'px';
}
let lastO = -1;
/** Fire light on the frame: v 0..1 (flicker). Only writes when it changes visibly. */
export function frameFire(v: number) {
	if (!lit) return; const o = Math.round((reduced() ? 0.75 : 0.45 + 0.55 * v) * 50) / 50;
	if (o !== lastO) { lastO = o; lit.style.opacity = String(o); }
}
let glintAnim: Animation | null = null;
/** The frame catches a flare: one highlight sweep across the band, away from the fire (left to right). */
export function frameGlint() {
	if (!gl || !band || reduced() || document.hidden) return;
	if (glintAnim && glintAnim.playState === 'running') return;
	const w = gl.clientWidth || FW * u;
	glintAnim = band.animate([{ transform: `translateX(${-0.3 * w}px) skewX(-20deg)`, opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.75 },
		{ transform: `translateX(${1.15 * w}px) skewX(-20deg)`, opacity: 0 }], { duration: 1100, easing: 'cubic-bezier(.45,.05,.4,1)' });
}
