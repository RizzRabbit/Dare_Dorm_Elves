// The wild elves on the board as DragonBones rigs (art_v3 group rigs WM2..WM5 per reel span, run-2 singles WF_R1..R5):
// merge_idle / merge_win play the rig's 'idle' / 'win' (+ the painted face frames blink_<elf> / laugh_<elf>) instead of
// the baked loop sheets. Each shown overlay gets one canvas (class stk stk_body, so the CSS placeholder hides as for a
// sheet) with its own small Pixi renderer, made on demand and destroyed with the overlay. Split rigs (_A/_B, per
// <name>_parts.json) are built and played together. Rigs: static/assets/rig/db/ (scripts/import-art.mjs rigs).
import { Container, Rectangle, type Filter } from 'pixi.js';
import { animate, kick, stageApp } from './board/stage';
import { glowFilter, setGlow } from './board/glowFilter';
import { PixiFactory, type PixiArmatureDisplay } from 'pixi-dragonbones-runtime';
const DIR = 'assets/rig/db/';
let index: Promise<Set<string>> | null = null;
const known = new Set<string>();
const split = new Set<string>();   // rigs exported as _A/_B armatures (only these have a <name>_parts.json)
/** sync: is there a rig for this overlay (after initDbStacks resolved)? */
export const dbKnown = (ov: HTMLElement) => known.has(rigName(ov));
const parsed = new Map<string, Promise<string[] | null>>();
type Live = { arms: PixiArmatureDisplay[]; root: Container; anim: string; t: number; blinkAt: number; cv: HTMLCanvasElement; W: number; H: number; gf: Filter | null; ga: number };
const lives = new Map<HTMLElement, Live>();
const byCv = new WeakMap<HTMLCanvasElement, Live>();
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
// fix8: the rigs live IN the board stage (board/mirror.ts places each rig's root on its overlay's placeholder canvas,
// canvas.stk_db, a 1x1 state element kept so the CSS :has(canvas.stk_body) rules and the merge choreography still
// see it). No per-overlay renderer / canvas any more; one shared ticker advances every rig.
let last = 0, ticking = false;
function step() {
	const now = performance.now(), dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
	for (const [ov, L] of lives) {
		if (!ov.isConnected) { dbStop(ov); continue; }
		L.t += dt;
		if (L.t > L.blinkAt) { L.blinkAt = L.t + 2.4 + Math.random() * 2.6; face(L, 'blink'); }
		for (const d of L.arms) d.armature.advanceTime(reduced() ? 0 : dt);
		// win glow (silhouette filter) eases in / out with the overlay's .win
		const want = ov.classList.contains('win') ? 1 : 0;
		L.ga += (want - L.ga) * Math.min(1, dt * 10);
		if (L.ga > 0.01) { if (!L.gf) { L.gf = glowFilter(); L.root.filters = [L.gf]; } setGlow(L.gf, L.ga * (0.85 + 0.15 * Math.sin(L.t * 7))); }
		else if (L.gf) { L.root.filters = []; L.gf.destroy(); L.gf = null; }
	}
	if (!lives.size) { ticking = false; last = 0; }
	return lives.size > 0;
}
/** board/mirror.ts: the stage display for a rig placeholder canvas. */
export function dbDisplay(cv: HTMLCanvasElement) {
	const L = byCv.get(cv); if (!L || L.root.destroyed) return null;
	return { root: L.root, W: L.W, H: L.H, glow: () => {} };
}
export function initDbStacks() {
	return (index ||= fetch(DIR + 'index.json').then((r) => (r.ok ? r.json() : { rigs: [] })).catch(() => ({ rigs: [] }))
		.then((j: { rigs?: string[] }) => { (j.rigs || []).forEach((n) => { const b = n.replace(/_[AB]$/, ''); known.add(b); if (b !== n) split.add(b); }); return known; }));
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
		const pj = !split.has(name) ? null : await fetch(DIR + name + '_parts.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
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
	const cv = document.createElement('canvas'); cv.width = 1; cv.height = 1; cv.className = 'stk stk_body stk_db'; cv.setAttribute('aria-hidden', 'true');
	cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
	const root = new Container(); root.label = 'db:' + name;
	const arms = parts.map((p) => { const d = PixiFactory.factory.buildArmatureDisplay(p, p, '', p) as PixiArmatureDisplay; root.addChild(d); return d; });
	const ab = arms[0].armature.armatureData.aabb;
	// placed by the mirror exactly as the old per-overlay canvas fit it: scale = overlay height / aabb height, centred in x
	ov.prepend(cv);
	if (name.startsWith('WF_') && !ov.querySelector(':scope > img.stk_glow')) {
		const gl = document.createElement('img'); gl.className = 'stk stk_glow land'; gl.alt = ''; gl.setAttribute('aria-hidden', 'true');
		gl.src = DIR + name + '_glow.webp'; ov.prepend(gl); setTimeout(() => gl.classList.remove('land'), 260);
	}
	const L: Live = { arms, root, anim, t: 0, blinkAt: 1 + Math.random() * 3, cv, W: ab.width, H: ab.height, gf: null, ga: 0 };
	lives.set(ov, L); byCv.set(cv, L); fade(L, anim, 0);
	for (const d of L.arms) d.armature.advanceTime(0);
	if (!ticking) { ticking = true; animate(step); }
	return true;
}
/** A still of the rig as it shows now (the merge lean's snapshot), or null. */
export function dbSnapshot(ov: HTMLElement): HTMLCanvasElement | null {
	const L = lives.get(ov); const a = stageApp(); if (!L || !a) return null;
	const keep = { p: L.root.parent, f: L.root.filters, x: L.root.x, y: L.root.y, sx: L.root.scale.x, sy: L.root.scale.y, r: L.root.rotation, v: L.root.visible };
	L.root.filters = []; L.root.position.set(0, 0); L.root.scale.set(1); L.root.rotation = 0; L.root.visible = true;
	const k = Math.min(1, 512 / Math.max(1, L.H));
	let c: HTMLCanvasElement | null = null;
	try { c = a.renderer.extract.canvas({ target: L.root, frame: new Rectangle(0, 0, L.W, L.H), resolution: k * 2 }) as HTMLCanvasElement; } catch { c = null; }
	L.root.filters = keep.f; L.root.position.set(keep.x, keep.y); L.root.scale.set(keep.sx, keep.sy); L.root.rotation = keep.r; L.root.visible = keep.v;
	if (keep.p && L.root.parent !== keep.p) keep.p.addChild(L.root);
	return c;
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
	byCv.delete(L.cv); L.cv.remove(); ov.querySelector(':scope > img.stk_glow')?.remove();
	L.root.removeFromParent(); L.gf?.destroy(); L.root.destroy({ children: true }); kick();
}

