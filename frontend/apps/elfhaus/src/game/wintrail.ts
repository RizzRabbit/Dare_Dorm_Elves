// Win → WIN-meter particle trail (motion pass, code-only). Painted fx atlas flakes/sparks fly from each winning
// cell to the HUD WIN field; on arrival the meter punches (scale). DOM host over #app so the trail can leave the
// board. Timings on real elapsed time (WAAPI + rAF). Reduced motion: fewer, shorter flakes, still a trail. Turbo: 60%.
import { S } from './ui';
import type { LineWin } from './typesBookEvent';

const FX1 = 'assets/sprites/fx/fx-1.webp';
// page-1 frames from static/assets/sprites/fx/fx.json (painted parts; never code-drawn)
const PARTS: { n: string; x: number; y: number; w: number; h: number; s: number }[] = [
	{ n: 'puff_flake', x: 1638, y: 10, w: 102, h: 116, s: 0.42 },
	{ n: 'flake_a', x: 160, y: 274, w: 58, h: 64, s: 0.38 },
	{ n: 'spark', x: 86, y: 274, w: 62, h: 64, s: 0.32 },
	{ n: 'snow_clump', x: 871, y: 274, w: 48, h: 46, s: 0.36 },
	{ n: 'flake_far', x: 672, y: 274, w: 48, h: 48, s: 0.28 },
];
const PAGE_W = 2048, PAGE_H = 512;

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let host: HTMLElement | null = null;
function ensure() {
	if (host?.isConnected) return host;
	host = document.getElementById('winTrail') as HTMLElement | null;
	if (!host) {
		host = document.createElement('div');
		host.id = 'winTrail';
		host.setAttribute('aria-hidden', 'true');
		host.style.cssText = 'position:fixed;inset:0;z-index:80;pointer-events:none;overflow:hidden';
		(document.getElementById('app') || document.body).appendChild(host);
	}
	return host;
}

function meterEl(): HTMLElement | null {
	return (document.getElementById('win') as HTMLElement | null)
		|| document.querySelector('#strip .m:nth-child(3)') as HTMLElement | null;
}

/** Scale punch on the WIN meter (sprite text stays; transform only). */
export function meterPunch() {
	const el = meterEl(); if (!el) return;
	el.classList.remove('meterPunch'); void el.offsetWidth; el.classList.add('meterPunch');
	setTimeout(() => el.classList.remove('meterPunch'), 320);
}

type Flight = { el: HTMLElement; t0: number; dur: number; x0: number; y0: number; x1: number; y1: number; midX: number; midY: number; rot: number; size: number };
const flights = new Set<Flight>();
let raf = 0;

function tick(now: number) {
	raf = 0;
	for (const f of [...flights]) {
		const u = Math.min(1, (now - f.t0) / f.dur);
		const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2; // ease in-out
		// quadratic bezier toward meter
		const x = (1 - e) * (1 - e) * f.x0 + 2 * (1 - e) * e * f.midX + e * e * f.x1;
		const y = (1 - e) * (1 - e) * f.y0 + 2 * (1 - e) * e * f.midY + e * e * f.y1;
		const sc = f.size * (u < 0.15 ? u / 0.15 : u > 0.75 ? (1 - u) / 0.25 : 1);
		const a = u < 0.1 ? u / 0.1 : u > 0.85 ? (1 - u) / 0.15 : 1;
		f.el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) rotate(${f.rot + e * 140}deg) scale(${sc})`;
		f.el.style.opacity = String(Math.max(0, a));
		if (u >= 1) { flights.delete(f); f.el.remove(); }
	}
	if (flights.size) raf = requestAnimationFrame(tick);
}

function spawn(x0: number, y0: number, x1: number, y1: number, delay: number, amp: number) {
	const H = ensure();
	const part = PARTS[(Math.random() * PARTS.length) | 0];
	const el = document.createElement('i');
	const px = Math.max(14, Math.min(36, (S.cell || 100) * part.s * amp));
	el.style.cssText = `position:absolute;left:0;top:0;width:${px}px;height:${px}px;opacity:0;will-change:transform,opacity;`
		+ `background:url(${FX1}) no-repeat;background-size:${(PAGE_W * px) / part.w}px ${(PAGE_H * px) / part.h}px;`
		+ `background-position:${(-part.x * px) / part.w}px ${(-part.y * px) / part.h}px`;
	H.appendChild(el);
	const dx = x1 - x0, dy = y1 - y0;
	const midX = x0 + dx * 0.45 + (Math.random() - 0.5) * Math.min(120, Math.abs(dx) * 0.35 + 40);
	const midY = y0 + dy * 0.35 - 40 - Math.random() * 80;
	const dur = (S.turbo ? 280 : 420) * (0.85 + Math.random() * 0.3) * (reduced() ? 0.75 : 1);
	const t0 = performance.now() + delay;
	const f: Flight = { el, t0, dur, x0, y0, x1, y1, midX, midY, rot: Math.random() * 360, size: 0.7 + Math.random() * 0.55 };
	flights.add(f);
	if (!raf) raf = requestAnimationFrame(tick);
	return dur + delay;
}

/** Fire a trail from every unique winning cell to the WIN meter; punches the meter when the first wave arrives. */
export function trailToMeter(wins: LineWin[]) {
	const dest = meterEl(); if (!dest || !wins.length) return;
	const amp = (reduced() ? 0.5 : 1) * (S.turbo ? 0.6 : 1);
	if (amp < 0.15) { meterPunch(); return; }
	const dr = dest.getBoundingClientRect();
	const x1 = dr.left + dr.width / 2, y1 = dr.top + dr.height / 2;
	const seen = new Set<string>();
	const cells: HTMLElement[] = [];
	for (const w of wins) for (const p of w.positions) {
		const id = `${p.reel}:${p.row}`; if (seen.has(id)) continue; seen.add(id);
		const c = document.getElementById(`c${p.reel}${p.row}`); if (c) cells.push(c);
	}
	if (!cells.length) { meterPunch(); return; }
	const nPer = Math.max(2, Math.round((reduced() ? 3 : 6) * amp));
	let firstArrive = Infinity;
	cells.forEach((c, ci) => {
		const r = c.getBoundingClientRect();
		const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
		for (let i = 0; i < nPer; i++) {
			const delay = ci * 18 + i * 28 + Math.random() * 40;
			const dur = spawn(x0, y0, x1 + (Math.random() - 0.5) * 16, y1 + (Math.random() - 0.5) * 10, delay, amp);
			firstArrive = Math.min(firstArrive, delay + dur * 0.72);
		}
	});
	setTimeout(meterPunch, Math.max(0, firstArrive));
}

export function clearTrail() {
	for (const f of [...flights]) { flights.delete(f); f.el.remove(); }
	if (raf) { cancelAnimationFrame(raf); raf = 0; }
}
