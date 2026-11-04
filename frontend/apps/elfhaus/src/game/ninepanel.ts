// A 9-slice sprite panel (bonus cards, the START button, the picture window's frame): the sprite part is cut into its 9
// pieces and placed on a canvas behind the element's content, every piece snapped to whole device pixels so no seam
// opens between pieces at any stage scale (CSS border-image leaves hairlines under the stage's scale transform). Nothing
// here draws a shape: it only places the parts of a baked sprite (scripts/gen-modal-sprites.mjs).
import { ST } from './stage';
type Four = [number, number, number, number];   // top, right, bottom, left
export type NineSpec = { src: string; scale: number; slice: Four; outset?: Four };   // slice in sprite px; scale = sprite px per design px
const imgs = new Map<string, HTMLImageElement>(), redraw = new Set<() => void>();
function sprite(src: string) {
	let im = imgs.get(src);
	if (!im) { im = new Image(); im.decoding = 'async'; im.onload = () => redraw.forEach((f) => f()); im.src = src; imgs.set(src, im); }
	return im;
}
export function ninePanel(el: HTMLElement | null, spec: NineSpec) {
	if (!el || el.querySelector(':scope > canvas.np')) return;
	const o = spec.outset || [0, 0, 0, 0], im = sprite(spec.src), cv = document.createElement('canvas');
	cv.className = 'np'; cv.setAttribute('aria-hidden', 'true');
	cv.style.cssText = `position:absolute;left:${-o[3]}px;top:${-o[0]}px;width:calc(100% + ${o[1] + o[3]}px);height:calc(100% + ${o[0] + o[2]}px);z-index:-1;pointer-events:none`;
	el.prepend(cv);
	let ro: ResizeObserver | null = null;
	const draw = () => {
		if (!el.isConnected && !cv.isConnected) { redraw.delete(draw); ro?.disconnect(); window.removeEventListener('resize', onResize); return; }   // card was replaced: let it go
		const w = el.offsetWidth + o[1] + o[3], h = el.offsetHeight + o[0] + o[2];
		if (!el.offsetWidth || !im.naturalWidth) return;
		const k = Math.max(0.25, ST.s * (window.devicePixelRatio || 1)), W = Math.round(w * k), H = Math.round(h * k);
		if (cv.width !== W) cv.width = W; if (cv.height !== H) cv.height = H;
		const g = cv.getContext('2d')!; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.imageSmoothingQuality = 'high';
		const [t, r, b, l] = spec.slice, IW = im.naturalWidth, IH = im.naturalHeight, d = k / spec.scale;
		const dt = Math.round(t * d), dr = Math.round(r * d), db = Math.round(b * d), dl = Math.round(l * d);
		const sx = [0, l, IW - r], sw = [l, IW - l - r, r], sy = [0, t, IH - b], sh = [t, IH - t - b, b];
		const dx = [0, dl, W - dr], dw = [dl, W - dl - dr, dr], dy = [0, dt, H - db], dh = [dt, H - dt - db, db];
		for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) if (dw[i] > 0 && dh[j] > 0) g.drawImage(im, sx[i], sy[j], sw[i], sh[j], dx[i], dy[j], dw[i], dh[j]);
	};
	const onResize = () => requestAnimationFrame(draw);
	redraw.add(draw); ro = new ResizeObserver(draw); ro.observe(el); window.addEventListener('resize', onResize); draw();
}
// the bonus cards' parts (sprites baked at 2x)
export const CARD: NineSpec = { src: 'assets/ui/modal_card9.webp', scale: 2, slice: [60, 60, 84, 60], outset: [0, 0, 12, 0] };
export const BTN: NineSpec = { src: 'assets/ui/modal_btn9.webp', scale: 2, slice: [60, 60, 60, 60] };
export const WINDOW: NineSpec = { src: 'assets/ui/modal_window9.webp', scale: 2, slice: [48, 48, 48, 48] };
