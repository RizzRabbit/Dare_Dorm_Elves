// The wild elves on the board as DragonBones rigs (art_v3 group rigs WM2..WM5 per reel span, run-2 singles WF_R1..R5):
// merge_idle / merge_win play the rig's 'idle' / 'win' (+ the painted face frames blink_<elf> / laugh_<elf>) instead of
// the baked loop sheets. Each shown overlay gets one canvas (class stk stk_body, so the CSS placeholder hides as for a
// sheet) with its own small Pixi renderer, made on demand and destroyed with the overlay. Split rigs (_A/_B, per
// <name>_parts.json) are built and played together. Rigs: static/assets/rig/db/ (scripts/import-art.mjs rigs).
import { Application, Container } from 'pixi.js';
import { PixiFactory, type PixiArmatureDisplay } from 'pixi-dragonbones-runtime';
const DIR = 'assets/rig/db/';
let index: Promise<Set<string>> | null = null;
const known = new Set<string>();
/** sync: is there a rig for this overlay (after initDbStacks resolved)? */
export const dbKnown = (ov: HTMLElement) => known.has(rigName(ov));
const parsed = new Map<string, Promise<string[] | null>>();
type Live = { app: Application; arms: PixiArmatureDisplay[]; anim: string; raf: number; t: number; blinkAt: number; ro: ResizeObserver };
const lives = new Map<HTMLElement, Live>();
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initDbStacks() {
	return (index ||= fetch(DIR + 'index.json').then((r) => (r.ok ? r.json() : { rigs: [] })).catch(() => ({ rigs: [] }))
		.then((j: { rigs?: string[] }) => { (j.rigs || []).forEach((n) => known.add(n.replace(/_[AB]$/, ''))); return known; }));
}
/** rig name for an overlay: WF_R<n> for a single reel, WM<k>_R<a>-<b> for a merge. */
export function rigName(ov: HTMLElement) {
	const r = (ov.dataset.reels ?? ov.dataset.reel ?? '').split(',').filter(Boolean).map((x) => +x + 1);
	if (!r.length) return '';
	return r.length === 1 ? `WF_R${r[0]}` : `WM${r.length}_R${r[0]}-${r[r.length - 1]}`;
}
function load(name: string) {
	let p = parsed.get(name);
	if (!p) parsed.set(name, (p = (async () => {
		const pj = await fetch(DIR + name + '_parts.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
		const parts: string[] = pj?.parts || [name];
		PixiFactory.useSharedTicker = false;
		const { Assets } = await import('pixi.js');
		for (const p of parts) {
			const [ske, atl] = await Promise.all([fetch(DIR + p + '_ske.json').then((r) => r.json()), fetch(DIR + p + '_tex.json').then((r) => r.json())]);
			const tex = await Assets.load(DIR + p + '_tex.webp');
			PixiFactory.factory.parseDragonBonesData(ske, p); PixiFactory.factory.parseTextureAtlasData(atl, tex, p);
		}
		return parts;
	})().catch(() => null)));
	return p;
}
/** Play the rig's body anim on this overlay. Resolves false when there is no rig (the sheet path then runs). */
export async function dbPlay(ov: HTMLElement, anim: 'idle' | 'win'): Promise<boolean> {
	const name = rigName(ov); if (!name || !(await initDbStacks()).has(name)) return false;
	const cur = lives.get(ov);
	if (cur) { if (cur.anim !== anim) { cur.anim = anim; fade(cur, anim); } return true; }
	const parts = await load(name); if (!parts || !ov.isConnected) return !!parts;
	if (lives.has(ov)) return dbPlay(ov, anim);
	const app = new Application();
	await app.init({ backgroundAlpha: 0, antialias: true, autoStart: false, resolution: Math.min(2, window.devicePixelRatio || 1), width: 8, height: 8 });
	const cv = app.canvas as HTMLCanvasElement; cv.className = 'stk stk_body stk_db'; cv.setAttribute('aria-hidden', 'true');
	cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
	const root = new Container(); app.stage.addChild(root);
	const arms = parts.map((p) => { const d = PixiFactory.factory.buildArmatureDisplay(p, p, '', p) as PixiArmatureDisplay; root.addChild(d); return d; });
	const W = arms[0].armature.armatureData.aabb.width, H = arms[0].armature.armatureData.aabb.height;
	const fit = () => { const w = ov.clientWidth || 1, h = ov.clientHeight || 1; app.renderer.resize(w, h); const k = h / H; root.scale.set(k); root.position.set((w - W * k) / 2, 0); };
	ov.prepend(cv);
	const L: Live = { app, arms, anim, raf: 0, t: 0, blinkAt: 1 + Math.random() * 3, ro: new ResizeObserver(fit) };
	L.ro.observe(ov); fit(); lives.set(ov, L); fade(L, anim, 0);
	let last = performance.now();
	const tick = (now: number) => {
		if (!ov.isConnected) { dbStop(ov); return; }
		const dt = Math.min(0.1, (now - last) / 1000); last = now; L.t += dt;
		if (L.t > L.blinkAt) { L.blinkAt = L.t + 2.4 + Math.random() * 2.6; face(L, 'blink'); }
		for (const d of L.arms) d.armature.advanceTime(reduced() ? 0 : dt);
		app.render(); L.raf = requestAnimationFrame(tick);
	};
	L.raf = requestAnimationFrame(tick);
	return true;
}
function fade(L: Live, anim: string, t = 0.25) {
	for (const d of L.arms) if (d.animation.hasAnimation(anim)) d.animation.fadeIn(anim, t, anim === 'win' ? 0 : 0, 0, 'body');
	if (anim === 'win') face(L, 'laugh');
}
/** a painted face one-shot on every elf of the rig (blink_<elf> / laugh_<elf>); faces never reset the body pose */
function face(L: Live, kind: 'blink' | 'laugh') {
	for (const d of L.arms) for (const n of d.animation.animationNames) if (n.startsWith(kind + '_')) {
		const s = d.animation.fadeIn(n, 0, 1, 1, n); if (s) s.resetToPose = false;
	}
}
export function dbHas(ov: HTMLElement) { return lives.has(ov); }
export function dbStop(ov: HTMLElement) {
	const L = lives.get(ov); if (!L) return; lives.delete(ov);
	cancelAnimationFrame(L.raf); L.ro.disconnect(); L.app.canvas.remove(); L.app.destroy(true, { children: true });
}
