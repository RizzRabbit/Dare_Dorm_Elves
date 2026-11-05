// Win → WIN-meter particle trail (motion pass, ARCH-1 / FX-5). Painted fx-atlas snowflakes fly from each winning
// cell toward the HUD WIN field on the unified board Pixi stage (board/stage.ts layer symFx — same home as puff.ts).
// GSAP tweens on real elapsed time. Meter punch stays a transform on the HUD element (allowed). No DOM host.
// Reduced motion: half amp. Turbo: 60%.
import { Container, Sprite, Texture } from 'pixi.js';
import { gsap } from 'gsap';
import { S } from './ui';
import { loadAtlas, atlasTex } from './scene/atlas';
import { boardStage, layer, centreOf, kick } from './board/stage';
import type { Pos } from './typesBookEvent';

const NAMES = ['puff_flake', 'flake_a', 'spark', 'snow_clump', 'flake_far'] as const;
const SIZE = { puff_flake: 0.42, flake_a: 0.38, spark: 0.32, snow_clump: 0.36, flake_far: 0.28 } as const;

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

let root: Container | null = null;
let ready: Promise<Container | null> | null = null;
const live = new Set<{ s: Sprite; tw: gsap.core.Tween }>();

function ensure(): Promise<Container | null> {
	return (ready ??= boardStage().then(async (a) => {
		if (!a) return null;
		await loadAtlas('fx').catch(() => null);
		root = new Container(); root.label = 'wintrail'; root.sortableChildren = true;
		layer.symFx.addChild(root);
		return root;
	}));
}

function meterEl(): HTMLElement | null {
	return (document.getElementById('win') as HTMLElement | null)
		|| document.querySelector('#strip .m:nth-child(3)') as HTMLElement | null;
}

/** Scale punch on the WIN meter (HUD transform only; sprite text stays). */
export function meterPunch() {
	const el = meterEl(); if (!el) return;
	el.classList.remove('meterPunch'); void el.offsetWidth; el.classList.add('meterPunch');
	setTimeout(() => el.classList.remove('meterPunch'), 320);
}

/** Frame-local layout px of an element's centre (works for HUD nodes outside #frame too). */
function frameXY(el: HTMLElement) {
	const fr = document.getElementById('frame');
	if (!fr) return centreOf(el);
	// descendants of #frame: exact offset walk (same as centreOf)
	if (fr.contains(el)) return centreOf(el);
	const frR = fr.getBoundingClientRect(), r = el.getBoundingClientRect();
	const sx = fr.offsetWidth / Math.max(1, frR.width), sy = fr.offsetHeight / Math.max(1, frR.height);
	return {
		x: (r.left + r.width / 2 - frR.left) * sx,
		y: (r.top + r.height / 2 - frR.top) * sy,
		w: r.width * sx,
		h: r.height * sy,
	};
}

function texOf(name: (typeof NAMES)[number]): Texture | null {
	try { return atlasTex('fx', name); } catch { return null; }
}

function spawn(R: Container, x0: number, y0: number, x1: number, y1: number, delayMs: number, amp: number) {
	const name = NAMES[(Math.random() * NAMES.length) | 0];
	const tex = texOf(name); if (!tex) return 0;
	const s = new Sprite(tex); s.anchor.set(0.5); s.alpha = 0; s.visible = true;
	const px = Math.max(14, Math.min(36, (S.cell || 100) * SIZE[name] * amp));
	const b = px / Math.max(tex.orig.width, tex.orig.height);
	s.scale.set(b * 0.2); s.position.set(x0, y0); s.rotation = Math.random() * Math.PI * 2;
	R.addChild(s);

	const dx = x1 - x0, dy = y1 - y0;
	const midX = x0 + dx * 0.45 + (Math.random() - 0.5) * Math.min(120, Math.abs(dx) * 0.35 + 40);
	const midY = y0 + dy * 0.35 - 40 - Math.random() * 80;
	const dur = (S.turbo ? 0.28 : 0.42) * (0.85 + Math.random() * 0.3); // seconds
	const delay = delayMs / 1000;
	const rot0 = s.rotation, size0 = 0.7 + Math.random() * 0.55;
	const proxy = { u: 0 };
	const easeIO = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);

	const tw = gsap.to(proxy, {
		u: 1,
		duration: dur,
		delay,
		ease: 'none', // bezier progress eased below on real elapsed u
		onUpdate: () => {
			const u = proxy.u, e = easeIO(u);
			s.x = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * midX + e * e * x1;
			s.y = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * midY + e * e * y1;
			const sc = size0 * (u < 0.15 ? u / 0.15 : u > 0.75 ? Math.max(0, (1 - u) / 0.25) : 1);
			s.scale.set(b * sc);
			s.alpha = u < 0.1 ? u / 0.1 : u > 0.85 ? Math.max(0, (1 - u) / 0.15) : 1;
			s.rotation = rot0 + e * 2.4;
			kick();
		},
		onComplete: () => {
			live.delete(entry);
			if (!s.destroyed) s.destroy();
			kick();
		},
	});
	const entry = { s, tw };
	live.add(entry);
	(window as any).__winTrailN = live.size;
	// ms from now until ~72% of flight (meter punch target)
	return delayMs + dur * 1000 * 0.72;
}

/** Fire a trail from every unique winning cell toward the WIN meter; punches the meter when the first wave arrives. */
export function trailToMeter(wins: { positions: Pos[] }[]) {
	const dest = meterEl(); if (!dest || !wins.length) return;
	const amp = (reduced() ? 0.5 : 1) * (S.turbo ? 0.6 : 1);
	if (amp < 0.15) { meterPunch(); return; }

	const seen = new Set<string>();
	const cells: HTMLElement[] = [];
	for (const w of wins) for (const p of w.positions) {
		const id = `${p.reel}:${p.row}`; if (seen.has(id)) continue; seen.add(id);
		const c = document.getElementById(`c${p.reel}${p.row}`); if (c) cells.push(c);
	}
	if (!cells.length) { meterPunch(); return; }

	void ensure().then((R) => {
		if (!R) { meterPunch(); return; }
		const M = frameXY(dest);
		const nPer = Math.max(2, Math.round((reduced() ? 3 : 6) * amp));
		let firstArrive = Infinity;
		cells.forEach((c, ci) => {
			const C = centreOf(c);
			for (let i = 0; i < nPer; i++) {
				const delay = ci * 18 + i * 28 + Math.random() * 40;
				const arrive = spawn(R, C.x, C.y, M.x + (Math.random() - 0.5) * 16, M.y + (Math.random() - 0.5) * 10, delay, amp);
				if (arrive > 0) firstArrive = Math.min(firstArrive, arrive);
			}
		});
		if (Number.isFinite(firstArrive)) setTimeout(meterPunch, Math.max(0, firstArrive));
		else meterPunch();
		kick();
	});
}

export function clearTrail() {
	for (const f of [...live]) { f.tw.kill(); if (!f.s.destroyed) f.s.destroy(); live.delete(f); }
	(window as any).__winTrailN = 0;
	kick();
}
