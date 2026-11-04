import { drawFrame, atlasFrame } from './skin';
// Re-audit M1: big-win particles in code (no sheets needed): one canvas over the big-win banner. A soft gold spark
// fountain runs while the banner counts; each tier crossing fires a radial burst of coins / sparks (bigger per tier).
// rAF, time-based, capped particle count, nothing when prefers-reduced-motion is set. Stops and clears on end().
type P = { x: number; y: number; vx: number; vy: number; life: number; age: number; r: number; spin: number; a: number; coin: boolean };
let cv: HTMLCanvasElement | null = null, g: CanvasRenderingContext2D | null = null, raf = 0, last = 0, ps: P[] = [], fountain = 0, dpr = 1;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function size() {
	if (!cv) return; dpr = Math.min(2, devicePixelRatio || 1);
	const w = innerWidth, h = innerHeight; if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
}
function spawn(x: number, y: number, n: number, sp: number, up = 0) {
	for (let i = 0; i < n && ps.length < 420; i++) {
		const a = Math.random() * Math.PI * 2, v = sp * (0.35 + Math.random() * 0.75);
		ps.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, life: 1.1 + Math.random() * 0.9, age: 0, r: 2 + Math.random() * 4.5, spin: Math.random() * 6, a: Math.random() * 6, coin: Math.random() < 0.45 });
	}
}
function frame(now: number) {
	if (!g || !cv) return;
	const dt = Math.min(0.05, (now - last) / 1000); last = now; size();
	const W = innerWidth, H = innerHeight;
	if (fountain > 0) { const n = Math.round(fountain * dt * 60); for (let i = 0; i < n; i++) spawn(W * (0.3 + Math.random() * 0.4), H * 0.62, 1, 160, 420); }
	g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
	{ let w = 0; for (let i = 0; i < ps.length; i++) { const p = ps[i]; if ((p.age += dt) < p.life) ps[w++] = p; } ps.length = w; } // v3.17: in place (no new array per frame)
	for (const p of ps) {
		p.vy += 520 * dt; p.vx *= 1 - 0.9 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.spin * dt;
		const k = 1 - p.age / p.life;
		g.globalAlpha = Math.min(1, k * 1.6);
		// painted fx atlas parts: an 8-frame spinning coin, and a streak stretched along the velocity
		if (p.coin) { const s = p.r * 3.2; drawFrame(g, 'fx', 'coin_' + (((p.a / (Math.PI * 2)) * 8) & 7), p.x, p.y, s, s); }
		else { const L = Math.max(4, Math.hypot(p.vx, p.vy) * 0.03); drawFrame(g, 'fx', 'streak', p.x - p.vx * 0.015, p.y - p.vy * 0.015, L, 4, Math.atan2(p.vy, p.vx)); }
	}
	g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
	if (fountain > 0 || ps.length) raf = requestAnimationFrame(frame); else raf = 0;
}
function run() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
export function bwpStart(host: HTMLElement, x: number) {
	if (reduced()) return;
	if (!cv) { cv = document.createElement('canvas'); cv.className = 'bwP'; g = cv.getContext('2d'); }
	atlasFrame('fx', 'coin_0');
	host.appendChild(cv); size(); ps = []; fountain = Math.min(5, 1.5 + Math.log10(1 + x));
	spawn(innerWidth / 2, innerHeight * 0.45, 60, 520); run();
}
export function bwpTier(i: number) {
	if (!cv || reduced()) return;
	spawn(innerWidth / 2, innerHeight * 0.42, 70 + i * 30, 560 + i * 90); fountain = Math.min(7, fountain + 0.8); run();
}
export function bwpEnd() { fountain = 0; ps = []; if (raf) cancelAnimationFrame(raf); raf = 0; if (g && cv) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); } cv?.remove(); }
