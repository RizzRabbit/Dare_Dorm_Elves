// The wild elves on the board as DragonBones rigs (art_v3 group rigs WM2..WM5 per reel span, run-2 singles WF_R1..R5):
// merge_idle / merge_win play the rig's 'idle' / 'win' (+ the painted face frames blink_<elf> / laugh_<elf>) instead of
// the baked loop sheets. Each shown overlay gets one canvas (class stk stk_body, so the CSS placeholder hides as for a
// sheet) with its own small Pixi renderer, made on demand and destroyed with the overlay. Split rigs (_A/_B, per
// <name>_parts.json) are built and played together. Rigs: static/assets/rig/db/ (scripts/import-art.mjs rigs).
// Memory: buildArmatureDisplay registers the armature on the DragonBones world clock, and dispose() only buffers it.
// This game never calls DragonBones.advanceTime (useSharedTicker is false). dbStop / dbStill therefore flush with
// advanceTime(0) — dt 0 does not tick Roxy, who shares the clock — or every merge and every bonus re-render keeps the
// previous rig forever. Atlas GPU textures follow the same refcount: released when the last overlay of that rig stops
// and nothing is loading it, so a merge can drop the singles before the group decodes (the sheet path already did this).
import { Container, Rectangle, type Filter } from 'pixi.js';
import { animate, kick, stageApp } from './board/stage';
import { glowFilter, setGlow } from './board/glowFilter';
import { PixiFactory, type PixiArmatureDisplay } from 'pixi-dragonbones-runtime';
import { crumb, scrub } from './diag';
import { createRigCache, releaseArmatures, snapshotPixels, stillResolution } from './riglife';
const DIR = 'assets/rig/db/';
let index: Promise<Set<string>> | null = null;
const known = new Set<string>();
const split = new Set<string>();   // rigs exported as _A/_B armatures (only these have a <name>_parts.json)
/** sync: is there a rig for this overlay (after initDbStacks resolved)? */
export const dbKnown = (ov: HTMLElement) => known.has(rigName(ov));
const parsed = new Map<string, Promise<string[] | null>>();
type Pack = { parts: string[]; urls: string[] };
const loaded = new Map<string, Pack>();
const rigs = createRigCache();
let AssetsRef: { unload: (u: string) => Promise<unknown> } | null = null;
let built = 0, disposed = 0;
type Live = { name: string; arms: PixiArmatureDisplay[]; root: Container; anim: string; t: number; blinkAt: number; cv: HTMLCanvasElement; W: number; H: number; gf: Filter | null; ga: number };
const lives = new Map<HTMLElement, Live>();
const byCv = new WeakMap<HTMLCanvasElement, Live>();
const starting = new Map<HTMLElement, Promise<boolean>>();
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const flushDb = (dt: number) => { try { PixiFactory.advanceTime(dt); } catch (e) { crumb('db-flush', { msg: scrub((e as Error)?.message || String(e)) }); } };
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
/** Live rigs, how many were built / released, and how many atlas packs are still resident. Page-hide breadcrumbs read this. */
export function dbStats(): Record<string, number> {
	return { live: lives.size, built, disposed, atlases: loaded.size };
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
function evictRig(name: string) {
	const info = loaded.get(name);
	loaded.delete(name); parsed.delete(name);
	// A failed load never parsed anything. Touching PixiFactory.factory here would create the shared factory
	// (and, if useSharedTicker were still at its default, start the clock) before the game has set that flag.
	if (!info) return;
	const urls = info.urls;
	try {
		const F = PixiFactory.factory;
		for (const part of info?.parts || []) {
			try { F.removeTextureAtlasData(part, true); } catch { /* atlas was not parsed */ }
			try { F.removeDragonBonesData(part, true); } catch { /* data was not parsed */ }
		}
		PixiFactory.advanceTime(0);
	} catch (e) { crumb('atlas-evict', { name, msg: scrub((e as Error)?.message || String(e)) }); }
	if (!urls.length) return;
	queueMicrotask(() => {
		// a re-render may have pinned and started a new load of the same rig before this ran
		if (rigs.busy(name) || parsed.has(name) || !AssetsRef) return;
		for (const u of urls) void AssetsRef.unload(u).catch(() => {});
	});
}
function dropPin(name: string) { if (name && rigs.unpin(name)) evictRig(name); }
function load(name: string) {
	let p = parsed.get(name);
	if (!p) {
		rigs.begin(name);
		parsed.set(name, (p = (async () => {
			try {
				const pj = !split.has(name) ? null : await fetch(DIR + name + '_parts.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
				const parts: string[] = pj?.parts || [name];
				PixiFactory.useSharedTicker = false;
				const { Assets } = await import('pixi.js');
				AssetsRef = Assets;
				const urls: string[] = [];
				for (const part of parts) {
					const url = DIR + part + '_tex.webp'; urls.push(url);
					const [ske, atl] = await Promise.all([fetch(DIR + part + '_ske.json').then((r) => r.json()), fetch(DIR + part + '_tex.json').then((r) => r.json())]);
					const tex = await Assets.load(url);
					PixiFactory.factory.parseDragonBonesData(ske, part); PixiFactory.factory.parseTextureAtlasData(atl, tex, part);
				}
				loaded.set(name, { parts, urls });
				return parts;
			} catch (e) { crumb('atlas-load', { name, msg: scrub((e as Error)?.message || String(e)) }); return null; }
			finally { if (rigs.end(name)) evictRig(name); }
		})()));
	}
	return p;
}
/** Play the rig's body anim on this overlay. Resolves false when there is no rig (the sheet path then runs). */
export async function dbPlay(ov: HTMLElement, anim: 'idle' | 'win'): Promise<boolean> {
	const name = rigName(ov); if (!name) return false;
	const cur = lives.get(ov);
	if (cur) { if (cur.anim !== anim) { cur.anim = anim; fade(cur, anim); } return true; }
	const inflight = starting.get(ov);
	if (inflight) { await inflight; return dbPlay(ov, anim); }
	const job = dbPlayNew(ov, name, anim);
	starting.set(ov, job);
	try { return await job; } finally { if (starting.get(ov) === job) starting.delete(ov); }
}
async function dbPlayNew(ov: HTMLElement, name: string, anim: 'idle' | 'win'): Promise<boolean> {
	// Pin before the first await. renderOverlays detaches the previous overlay synchronously and the
	// ticker dbStops it on a later frame; the pin has to land in the microtask gap or the atlas is evicted and reloaded.
	rigs.pin(name);
	let owned = true;
	const releasePin = () => { if (owned) { owned = false; dropPin(name); } };
	try {
		if (!(await initDbStacks()).has(name)) { releasePin(); return false; }
		const parts = await load(name); if (!parts || !ov.isConnected) { releasePin(); return !!parts && ov.isConnected; }
		if (lives.has(ov)) { releasePin(); return dbPlay(ov, anim); }
		const cv = document.createElement('canvas'); cv.width = 1; cv.height = 1; cv.className = 'stk stk_body stk_db'; cv.setAttribute('aria-hidden', 'true');
		cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
		const root = new Container(); root.label = 'db:' + name;
		const arms = parts.map((part) => { const d = PixiFactory.factory.buildArmatureDisplay(part, part, '', part) as PixiArmatureDisplay; root.addChild(d); return d; });
		const ab = arms[0].armature.armatureData.aabb;
		// placed by the mirror exactly as the old per-overlay canvas fit it: scale = overlay height / aabb height, centred in x
		ov.prepend(cv);
		if (name.startsWith('WF_') && !ov.querySelector(':scope > img.stk_glow')) {
			const gl = document.createElement('img'); gl.className = 'stk stk_glow land'; gl.alt = ''; gl.setAttribute('aria-hidden', 'true');
			gl.src = DIR + name + '_glow.webp'; ov.prepend(gl); setTimeout(() => gl.classList.remove('land'), 260);
		}
		const L: Live = { name, arms, root, anim, t: 0, blinkAt: 1 + Math.random() * 3, cv, W: ab.width, H: ab.height, gf: null, ga: 0 };
		lives.set(ov, L); byCv.set(cv, L); fade(L, anim, 0);
		for (const d of L.arms) d.armature.advanceTime(0);
		if (!ticking) { ticking = true; animate(step); }
		owned = false; built++;
		return true;
	} catch (e) { releasePin(); crumb('db-play', { name, msg: scrub((e as Error)?.message || String(e)) }); return false; }
}
/** A still of the rig as it shows now (the merge lean's snapshot), or null. */
export function dbSnapshot(ov: HTMLElement): HTMLCanvasElement | null {
	const L = lives.get(ov); const a = stageApp(); if (!L || !a) return null;
	const keep = { p: L.root.parent, f: L.root.filters, x: L.root.x, y: L.root.y, sx: L.root.scale.x, sy: L.root.scale.y, r: L.root.rotation, v: L.root.visible };
	L.root.filters = []; L.root.position.set(0, 0); L.root.scale.set(1); L.root.rotation = 0; L.root.visible = true;
	// height budget matches the old `min(2, 1024 / H)`; width is capped too (riglife.snapshotPixels)
	const { r } = snapshotPixels(L.W, L.H);
	let c: HTMLCanvasElement | null = null;
	try { c = a.renderer.extract.canvas({ target: L.root, frame: new Rectangle(0, 0, L.W, L.H), resolution: r }) as HTMLCanvasElement; }
	catch (e) { c = null; crumb('snapshot', { msg: scrub((e as Error)?.message || String(e)) }); }
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
	L.root.removeFromParent();
	if (L.gf) { try { L.root.filters = []; L.gf.destroy(); } catch { /* already destroyed */ } L.gf = null; }
	// clock release BEFORE the container destroy, and BEFORE the atlas drop: dispose() flushes slots first
	releaseArmatures(L.arms, flushDb);
	if (!L.root.destroyed) L.root.destroy({ children: true });
	disposed++;
	dropPin(L.name);
	kick();
}

/** uifix: a still of a board wild rig at its rest pose ('idle' frame 0), rendered with the caller's renderer, for the intro
 *  cards (so the Wild Winter Spins card shows exactly the elves the board shows). null when the rig is missing. */
export async function dbStill(name: string, renderer: { extract: { canvas: (o: object) => unknown } }): Promise<HTMLCanvasElement | null> {
	if (!name) return null;
	rigs.pin(name);
	const root = new Container();
	const arms: PixiArmatureDisplay[] = [];
	try {
		if (!(await initDbStacks()).has(name)) return null;
		const parts = await load(name); if (!parts) return null;
		for (const part of parts) {
			const d = PixiFactory.factory.buildArmatureDisplay(part, part, '', part) as PixiArmatureDisplay;
			if (!d) continue;
			root.addChild(d); arms.push(d); d.animation.gotoAndStopByFrame('idle', 0); d.armature.advanceTime(0);
		}
		if (!arms.length) return null;
		built++;
		const b = root.getLocalBounds();
		return renderer.extract.canvas({ target: root, frame: new Rectangle(b.x, b.y, b.width, b.height), resolution: stillResolution(b.width, b.height) }) as HTMLCanvasElement;
	} catch (e) { crumb('db-still', { name, msg: scrub((e as Error)?.message || String(e)) }); return null; }
	finally {
		releaseArmatures(arms, flushDb);
		if (!root.destroyed) root.destroy({ children: true });
		disposed++;
		dropPin(name);
	}
}
