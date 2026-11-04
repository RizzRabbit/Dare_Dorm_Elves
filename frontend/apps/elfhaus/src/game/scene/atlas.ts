// Pixi side of the painted sprite packages (static/assets/sprites/<pkg>/<pkg>.json + WebP pages, import-art.mjs sprites):
// named frames as Textures (trim kept as orig/trim, so a frame keeps its painted size), the frame's normalized anchor
// (pivot) and its slice9 insets [l, t, r, b] for NineSliceSprite.
import { Assets, groupD8, NineSliceSprite, Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js';
export type AFrame = { tex: Texture; ax: number; ay: number; s9?: [number, number, number, number] };
const cache = new Map<string, Promise<Record<string, AFrame>>>(), done = new Map<string, Record<string, AFrame>>();
export function loadAtlas(pkg: string) {
	let p = cache.get(pkg);
	if (!p) cache.set(pkg, (p = (async () => {
		const J = await fetch(`assets/sprites/${pkg}/${pkg}.json`).then((r) => r.json());
		const pages: Texture[] = await Promise.all(J.meta.pages.map((pg: { image: string }) => Assets.load(`assets/sprites/${pkg}/${pg.image}`)));
		const out: Record<string, AFrame> = {};
		for (const [k, f] of Object.entries<any>(J.frames)) {
			const src = pages[f.page || 0].source, fr = new Rectangle(f.frame.x, f.frame.y, f.frame.w, f.frame.h);
			const orig = new Rectangle(0, 0, f.sourceSize.w, f.sourceSize.h), ss = f.spriteSourceSize;
			const trim = f.trimmed ? new Rectangle(ss.x, ss.y, ss.w, ss.h) : undefined;
			out[k] = { tex: new Texture({ source: src, frame: fr, orig, trim }), ax: f.anchor?.x ?? 0.5, ay: f.anchor?.y ?? 0.5, s9: f.slice9 };
		}
		done.set(pkg, out); return out;
	})()));
	return p;
}
const fr = (pkg: string, name: string) => { const a = done.get(pkg)?.[name]; if (!a) throw new Error(`sprite ${pkg}:${name} not loaded`); return a; };
/** a sprite of a named frame, anchored at its painted pivot */
export function spr(pkg: string, name: string) { const a = fr(pkg, name), s = new Sprite(a.tex); s.anchor.set(a.ax, a.ay); return s; }
/** a 9-slice sprite of a frame with slice9 (k = sprite px per scene px of the corners) */
export function nine(pkg: string, name: string, w: number, h: number, k = 1) {
	const a = fr(pkg, name), [l, t, r, b] = a.s9 || [0, 0, 0, 0];
	const s = new NineSliceSprite({ texture: a.tex, leftWidth: l, topHeight: t, rightWidth: r, bottomHeight: b });
	s.scale.set(1 / k); s.width = w * k; s.height = h * k; return s;
}
/** a tiling sprite of a frame (repeats both ways) */
export function tile(pkg: string, name: string, w: number, h: number, scale = 1) {
	const s = new TilingSprite({ texture: fr(pkg, name).tex, width: w, height: h }); s.tileScale.set(scale); return s;
}
/** the frame mirrored left-right (hinge-left leaf -> hinge-right leaf) */
export function mirrored(pkg: string, name: string) {
	const t = fr(pkg, name).tex; return new Texture({ source: t.source, frame: t.frame.clone(), orig: t.orig.clone(), trim: t.trim?.clone(), rotate: groupD8.MIRROR_HORIZONTAL });
}
export const atlasTex = (pkg: string, name: string) => fr(pkg, name).tex;
