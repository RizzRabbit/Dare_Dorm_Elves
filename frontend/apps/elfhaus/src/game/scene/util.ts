// Small Pixi helpers shared by the foyer scene, the Roxy rig and the intro.
import { Texture } from 'pixi.js';
export const SS = 2; // canvas texture supersampling
/** Canvas-drawn texture at SS x (sprites using it scale by 1 / SS). */
export function ctex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
	const c = document.createElement('canvas'); c.width = Math.ceil(w * SS); c.height = Math.ceil(h * SS);
	const g = c.getContext('2d')!; g.scale(SS, SS); draw(g, w, h); return Texture.from(c);
}
export const ease = {
	lin: (t: number) => t,
	outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
	inCubic: (t: number) => t * t * t,
	inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
	inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
	outBack: (t: number, s = 2.2) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
	inBack: (t: number, s = 1.8) => (s + 1) * t * t * t - s * t * t,
};
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const seg = (t: number, a: number, b: number, e: (x: number) => number = ease.lin) => e(clamp((t - a) / (b - a)));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
let blobT: Texture | null = null, dotT: Texture | null = null;
/** soft white radial blob (tinted pools of light) */
export const softBlob = () => (blobT ||= ctex(256, 256, (g) => { const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
	gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }));
/** small bright glow dot (candle cores, motes) */
export const glowDot = () => (dotT ||= ctex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
	gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,240,225,0.7)'); gr.addColorStop(0.5, 'rgba(255,200,170,0.14)'); gr.addColorStop(1, 'rgba(255,200,170,0)');
	g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }));
