// fix8 (James 2026-11-04 "do it the right way"): every board symbol is drawn by the ONE board Pixi stage. The DOM under
// #board (#strips spinners, #cells, #overlays) stays only as an invisible state + motion model: the classes other files
// read (win / dim / spinning / puffed / wild ...), the layout, and the CSS / WAAPI motion they already author. Its paint
// is off (opacity 0); this module walks it in paint order every frame something moves and draws each visual leaf as a
// Pixi sprite with the element's full composed transform (offset, transform-origin, transform / translate / rotate /
// scale, 3D projected), its composed opacity, brightness (dim) and blend mode:
//   sheet frames (.rp f_*, .sd depth, letters: any background-image region)  -> Sprite on the shared texture
//   tile recess / border / frost (.tRec / .tBd / .tFr, CSS border-image)       -> NineSliceSprite (52 px corners)
//   <img> (stack panels, elf cut-outs, stills)                                   -> Sprite
//   <canvas> snapshots (merge lean stage)                                        -> Sprite (uploaded once)
//   canvas.stk_db (DragonBones placeholder)                                      -> the rig's own container (dbstacks.ts)
//   .symGlow / img.stk_glow                                                      -> layer.winGlow, recoloured teal glow
//   .mx multiplier                                                               -> layer.symFx, gold bitmap font glyphs
// Clips: an element with overflow hidden / clip-path inset (the spinner window .cwin, the stack elves) masks its subtree
// with a Graphics mask; nothing at rest clips (the spinner windows only exist while a cell spins).
// Not drawn (never were symbols, or square tile lights James rejected): .tGl / .tGw tile lights, .rgShine, .wFrame,
// .ovWinO, .ovGlow, .lock, text fallbacks, pseudo-elements.
import { Container, Graphics, Matrix, NineSliceSprite, Rectangle, Sprite, Texture, type BLEND_MODES } from 'pixi.js';
import SHEET_JSON from '../chalet/symbols.sheet.json';
import DEPTH_JSON from '../chalet/symdepth.json';
import { boardStage, layer, kick, animate } from './stage';
import { dbDisplay } from '../dbstacks';
import { mxFont } from '../ui';

type Fr = { frame: { x: number; y: number; w: number; h: number } };
const FRAMES = (SHEET_JSON as unknown as { frames: Record<string, Fr> }).frames;
const DFR = (DEPTH_JSON as unknown as { frames: Record<string, Fr> }).frames;
void DFR;

// ---------- textures ----------
type Src = { tex: Texture | null; img?: HTMLImageElement; p?: Promise<void> };
const srcs = new Map<string, Src>();
function source(url: string): Texture | null {
	let s = srcs.get(url);
	if (!s) {
		s = { tex: null }; srcs.set(url, s);
		const im = new Image(); im.decoding = 'async'; im.src = url; s.img = im;
		const S = s;
		s.p = im.decode().then(() => { S.tex = Texture.from(im); dirtyAll = true; kick(); }).catch(() => {});
	}
	return s.tex;
}
const subs = new Map<string, Texture>();
function sub(url: string, x: number, y: number, w: number, h: number): Texture | null {
	const base = source(url); if (!base) return null;
	const iw = base.width, ih = base.height;
	x = Math.max(0, Math.min(iw - 1, x)); y = Math.max(0, Math.min(ih - 1, y)); w = Math.max(1, Math.min(iw - x, w)); h = Math.max(1, Math.min(ih - y, h));
	const key = `${url}|${x.toFixed(1)}|${y.toFixed(1)}|${w.toFixed(1)}|${h.toFixed(1)}`;
	let t = subs.get(key);
	if (!t) { t = new Texture({ source: base.source, frame: new Rectangle(x, y, w, h) }); subs.set(key, t); }
	return t;
}
const SHEET = 'sheets/symbols.webp';
const sheetFrame = (n: string) => { const f = FRAMES[n]?.frame; return f ? sub(SHEET, f.x, f.y, f.w, f.h) : null; };

// win glow: the symbol's own silhouette glow frame recoloured fluorescent teal-blue with a white core (alpha-shaped,
// never a box). Cached per source texture.
const glows = new Map<string, Texture>();
function tealGlow(key: string, tex: Texture): Texture | null {
	let g = glows.get(key); if (g) return g;
	const res = tex.source.resource as CanvasImageSource | undefined; if (!res) return null;
	const f = tex.frame, P = Math.ceil(Math.max(f.width, f.height) * 0.08);
	const c = document.createElement('canvas'); c.width = Math.ceil(f.width) + 2 * P; c.height = Math.ceil(f.height) + 2 * P;
	const x = c.getContext('2d', { willReadFrequently: true }); if (!x) return null;
	x.filter = `blur(${Math.max(1, P * 0.35).toFixed(1)}px)`;
	x.drawImage(res, f.x, f.y, f.width, f.height, P, P, f.width, f.height);
	x.filter = 'none';
	const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
	for (let i = 0; i < a.length; i += 4) {
		const al = a[i + 3] / 255, core = Math.max(0, Math.min(1, (al - 0.55) / 0.4)), k = core * core;
		a[i] = Math.round(25 + (255 - 25) * k); a[i + 1] = Math.round(225 + 30 * k); a[i + 2] = 255;
		a[i + 3] = Math.round(255 * Math.min(1, al * 1.25));
	}
	x.putImageData(d, 0, 0);
	g = Texture.from(c); (g as any)._pad = P; glows.set(key, g);
	return g;
}

// ---------- computed style cache ----------
type St = { m: DOMMatrix; op: number; vis: boolean; z: number; br: number; blend: string; clip: null | { inset: number[]; r: number[] }; ov: boolean; bg: string; bs: string; bp: string; bw: number; fit: string; disp: boolean };
const cache = new WeakMap<Element, St>();
const num = (s: string) => parseFloat(s) || 0;
function lenOf(v: string, ref: number) { return v.endsWith('%') ? (num(v) / 100) * ref : num(v); }
function localMatrix(cs: CSSStyleDeclaration, w: number, h: number) {
	const o = cs.transformOrigin.split(' '), ox = lenOf(o[0] || '50%', w), oy = lenOf(o[1] || '50%', h);
	let m = new DOMMatrix();
	const tr = cs.translate, ro = cs.rotate, sc = cs.scale, tf = cs.transform;
	if (tr && tr !== 'none') { const p = tr.split(' '); m = m.translate(lenOf(p[0], w), lenOf(p[1] || '0', h)); }
	if (ro && ro !== 'none') { const deg = ro.endsWith('rad') ? (num(ro) * 180) / Math.PI : ro.endsWith('turn') ? num(ro) * 360 : num(ro); m = m.rotate(0, 0, ro.includes(' ') ? num(ro.split(' ').pop()!) : deg); }
	if (sc && sc !== 'none') { const p = sc.split(' ').map(num); m = m.scale(p[0], p[1] ?? p[0]); }
	if (tf && tf !== 'none') m = m.multiply(new DOMMatrix(tf));
	if (m.isIdentity) return m;
	m = new DOMMatrix().translate(ox, oy).multiply(m).translate(-ox, -oy);
	if (!m.is2D) {   // project (perspective / translateZ): affine fit through three points
		const P = (x: number, y: number) => { const q = m.transformPoint(new DOMPoint(x, y, 0, 1)); return [q.x / q.w, q.y / q.w]; };
		const [x0, y0] = P(0, 0), [x1, y1] = P(100, 0), [x2, y2] = P(0, 100);
		m = new DOMMatrix([(x1 - x0) / 100, (y1 - y0) / 100, (x2 - x0) / 100, (y2 - y0) / 100, x0, y0]);
	}
	return m;
}
function brightness(f: string) {
	if (!f || f === 'none') return 1;
	let b = 1; for (const mm of f.matchAll(/brightness\(([\d.]+)(%?)\)/g)) b *= mm[2] ? num(mm[1]) / 100 : num(mm[1]);
	return b;
}
function clipOf(cs: CSSStyleDeclaration, w: number, h: number) {
	const cp = cs.clipPath;
	if (cp && cp.startsWith('inset(')) {
		const body = cp.slice(6, -1), [ins, rr] = body.split(' round ');
		const p = ins.trim().split(/\s+/); const t = p[0], r = p[1] ?? t, b = p[2] ?? t, l = p[3] ?? r;
		const rad = rr ? rr.split('/').map((s) => lenOf(s.trim().split(/\s+/)[0], w)) : [0];
		return { inset: [lenOf(t, h), lenOf(r, w), lenOf(b, h), lenOf(l, w)], r: rad };
	}
	return null;
}
function style(el: HTMLElement, force: boolean): St {
	let s = cache.get(el);
	if (s && !force) return s;
	const cs = getComputedStyle(el), w = el.offsetWidth, h = el.offsetHeight;
	s = {
		m: localMatrix(cs, w, h), op: num(cs.opacity), vis: cs.visibility !== 'hidden', disp: cs.display !== 'none', z: cs.zIndex === 'auto' ? 0 : parseInt(cs.zIndex) || 0,
		br: brightness(cs.filter), blend: cs.mixBlendMode, clip: clipOf(cs, w, h), ov: cs.overflow === 'hidden' || cs.overflow === 'clip',
		bg: cs.backgroundImage, bs: cs.backgroundSize, bp: cs.backgroundPosition, bw: num(cs.borderImageWidth) > 4 ? num(cs.borderImageWidth) : num(cs.borderTopWidth), fit: cs.objectFit,
	};
	cache.set(el, s); return s;
}

// ---------- display pool (one per DOM leaf, reused across frames) ----------
type Out = { d: Container; used: number; kind: string };
const outs = new WeakMap<Element, Out>();
const live = new Set<Out>();
let frameNo = 0;
function out(el: Element, kind: string, make: () => Container): Out {
	let o = outs.get(el);
	if (!o || o.kind !== kind || (o.d.destroyed && kind !== 'db') || !live.has(o)) { if (o) { o.d.removeFromParent(); if (o.kind !== 'db' && !o.d.destroyed) o.d.destroy({ children: true }); live.delete(o); } o = { d: make(), used: 0, kind }; outs.set(el, o); live.add(o); }
	o.used = frameNo; return o;
}
const SKIP = /\b(tGl|tGw|rgShine|wFrame|ovWinO|ovGlow|lock|nm|plate|mfRays|mfCore)\b/;
const BLEND: Record<string, BLEND_MODES> = { screen: 'screen', 'plus-lighter': 'add', multiply: 'multiply', normal: 'normal' };
const pm = new Matrix();
function place(d: Container, M: DOMMatrix, x: number, y: number, sx: number, sy: number) {
	const m = M.translate(x, y).scale(sx, sy);
	pm.set(m.a, m.b, m.c, m.d, m.e, m.f); d.setFromMatrix(pm);
}
const tint = (br: number) => { const v = Math.round(Math.max(0, Math.min(1, br)) * 255); return (v << 16) | (v << 8) | v; };

// clip groups: one container per clipping element, masked by its box
type Clip = { c: Container; g: Graphics; used: number };
const clips = new WeakMap<Element, Clip>();
const liveClips = new Set<Clip>();
function clipFor(el: Element): Clip {
	let k = clips.get(el);
	if (!k) { const c = new Container(), g = new Graphics(); c.sortableChildren = true; c.addChild(g); c.mask = g; k = { c, g, used: 0 }; clips.set(el, k); liveClips.add(k); }
	k.used = frameNo; return k;
}

// ---------- the walk ----------
let order = 0, dirtyAll = true;
const animated = new Set<Element>();
type Ctx = { M: DOMMatrix; op: number; br: number; host: Container; glow: boolean };
function bgLeaf(el: HTMLElement, s: St, w: number, h: number, c: Ctx) {
	const mm = /url\("?([^")]+)"?\)/.exec(s.bg); if (!mm) return;
	const url = mm[1]; const base = source(url); if (!base) return;
	const iw = base.width, ih = base.height;
	const sz = s.bs.split(' ');
	let dw: number, dh: number;
	if (sz[0] === 'contain' || sz[0] === 'cover') { const k = (sz[0] === 'contain' ? Math.min : Math.max)(w / iw, h / ih); dw = iw * k; dh = ih * k; }
	else { dw = sz[0] === 'auto' ? NaN : lenOf(sz[0], w); dh = (sz[1] ?? 'auto') === 'auto' ? NaN : lenOf(sz[1], h);
		if (isNaN(dw) && isNaN(dh)) { dw = iw; dh = ih; } else if (isNaN(dw)) dw = (dh * iw) / ih; else if (isNaN(dh)) dh = (dw * ih) / iw; }
	const bp = s.bp.split(' '), pxp = (v: string, room: number) => (v.endsWith('%') ? (num(v) / 100) * room : num(v));
	const px = pxp(bp[0] || '0%', w - dw), py = pxp(bp[1] || '0%', h - dh);
	// visible part of the image inside the element box
	const x0 = Math.max(0, px), y0 = Math.max(0, py), x1 = Math.min(w, px + dw), y1 = Math.min(h, py + dh);
	if (x1 <= x0 || y1 <= y0) return;
	const kx = iw / dw, ky = ih / dh;
	const t = sub(url, (x0 - px) * kx, (y0 - py) * ky, (x1 - x0) * kx, (y1 - y0) * ky); if (!t) return;
	sprite(el, t, c, x0, y0, x1 - x0, y1 - y0, s);
}
function sprite(el: Element, t: Texture, c: Ctx, x: number, y: number, w: number, h: number, s: St, kind = 'spr') {
	let tex = t, host = c.host, pad = 0;
	if (c.glow) { const g = tealGlow(texKey(t), t); if (!g) return; tex = g; pad = (g as any)._pad || 0; host = layer.winGlow; }
	const o = out(el, kind + (c.glow ? 'G' : ''), () => new Sprite());
	const sp = o.d as Sprite; if (sp.texture !== tex) sp.texture = tex;
	if (sp.parent !== host) host.addChild(sp);
	const fw = t.frame.width, fh = t.frame.height, kx = w / fw, ky = h / fh;
	place(sp, c.M, x - pad * kx, y - pad * ky, kx, ky);
	sp.alpha = c.op; sp.tint = c.glow ? 0xffffff : tint(c.br); sp.blendMode = c.glow ? 'add' : BLEND[s.blend] ?? 'normal';
	sp.zIndex = order++; sp.visible = true;
}
const texKey = (t: Texture) => `${t.source.uid}|${t.frame.x}|${t.frame.y}|${t.frame.width}|${t.frame.height}`;
function nine(el: HTMLElement, s: St, w: number, h: number, c: Ctx) {
	const n = el.classList.contains('tRec') ? '_recess' : el.classList.contains('tFr') ? '_frost' : el.classList.contains('sp') ? '_border_sp' : '_border';
	const t = sheetFrame(n); if (!t || !s.bw) return;
	const o = out(el, 'nine', () => new NineSliceSprite({ texture: t, leftWidth: 52, topWidth: 52, rightWidth: 52, bottomHeight: 52 } as any));
	const ns = o.d as NineSliceSprite; if (ns.texture !== t) ns.texture = t;
	if (ns.parent !== c.host) c.host.addChild(ns);
	const k = s.bw / 52; ns.width = w / k; ns.height = h / k;
	place(ns, c.M, 0, 0, k, k); ns.alpha = c.op; ns.tint = tint(c.br); ns.zIndex = order++; ns.visible = true;
}
const cvTex = new WeakMap<HTMLCanvasElement, Texture>();
function badge(el: HTMLElement, c: Ctx, w: number, h: number) {
	const F = mxFont(); if (!F) return;
	const v = el.dataset.v || '1', key = 'x' + v;
	const o = out(el, 'mx', () => new Container());
	const g = o.d; if (g.parent !== layer.symFx) layer.symFx.addChild(g);
	if ((g as any)._k !== key) {
		g.removeChildren().forEach((x) => x.destroy());
		const k = (48 * 1.1) / F.px; let x = 5; const y = 50 - F.base * k;
		for (const ch of key) {
			const f = F.fr['u' + ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')];
			if (!f) { x += 18 * k; continue; }
			const t = sub(F.img, f.x, f.y, f.w, f.h); if (!t) { (g as any)._k = ''; return; }
			const sp = new Sprite(t); sp.position.set(x + f.ox * k, y + f.oy * k); sp.width = f.w * k; sp.height = f.h * k; g.addChild(sp);
			x += f.adv * k;
		}
		(g as any)._k = key;
	}
	// the badge svg is a 150 x 60 viewBox fitted (meet) into the .mx box
	const kk = Math.min(w / 150, h / 60);
	place(g, c.M, (w - 150 * kk) / 2, (h - 60 * kk) / 2, kk, kk);
	g.alpha = c.op; g.zIndex = order++; g.visible = true;
}
function walk(el: HTMLElement, parent: DOMMatrix, pc: Ctx, px: number, py: number, force: boolean) {
	if (el.nodeType !== 1) return;
	const cl = el.className && typeof el.className === 'string' ? el.className : '';
	if (cl && SKIP.test(cl)) return;
	const s = style(el, force || animated.has(el));
	if (!s.disp) return;
	const isRoot = roots.includes(el);
	const w = el.offsetWidth, h = el.offsetHeight;
	const M = parent.translate(px, py).multiply(s.m);
	const c: Ctx = { M, op: pc.op * (isRoot ? 1 : s.op), br: pc.br * s.br, host: pc.host, glow: pc.glow || /\bsymGlow\b/.test(cl) || (el.tagName === 'IMG' && /\bstk_glow\b/.test(cl)) };
	if (c.op <= 0.003) return;
	if ((s.ov || s.clip) && el.id !== 'board') {
		const k = clipFor(el); if (k.c.parent !== pc.host) pc.host.addChild(k.c);
		k.c.zIndex = order++; k.g.clear();
		const [t, r, b, l] = s.clip?.inset ?? [0, 0, 0, 0], rad = s.clip?.r[0] ?? 0;
		k.g.setFromMatrix(new Matrix(M.a, M.b, M.c, M.d, M.e, M.f));
		if (rad) k.g.roundRect(l, t, w - l - r, h - t - b, rad); else k.g.rect(l, t, w - l - r, h - t - b);
		k.g.fill(0xffffff);
		c.host = k.c;
	}
	const tag = el.tagName;
	if (s.vis) {
		if (/\bmx\b/.test(cl)) { badge(el, c, w, h); return; }
		if (tag === 'CANVAS') {
			const cv = el as unknown as HTMLCanvasElement;
			if (/\bstk_db\b/.test(cl)) { const d = dbDisplay(cv); if (d) { const o = out(el, 'db', () => d.root); if (o.d !== d.root) o.d = d.root; if (d.root.destroyed) return; if (d.root.parent !== c.host) c.host.addChild(d.root); { const k = h / d.H; place(d.root, M, (w - d.W * k) / 2, 0, k, k); } d.root.alpha = c.op; d.root.zIndex = order++; d.root.visible = true; } return; }
			if (!cv.width) return;
			let t = cvTex.get(cv); if (!t) { t = Texture.from(cv); cvTex.set(cv, t); }
			sprite(el, t, c, 0, 0, w, h, s); return;
		}
		if (tag === 'IMG') {
			const im = el as HTMLImageElement, t = im.currentSrc || im.src ? source(im.currentSrc || im.src) : null; if (!t) return;
			let x = 0, y = 0, dw = w, dh = h;
			if (s.fit === 'contain') { const k = Math.min(w / t.width, h / t.height); dw = t.width * k; dh = t.height * k; x = (w - dw) / 2; y = (h - dh) / 2; }
			sprite(el, t, c, x, y, dw, dh, s); return;
		}
		if (/\bt(Rec|Bd|Fr)\b/.test(cl)) { nine(el, s, w, h, c); }
		else if (s.bg && s.bg !== 'none' && !s.bg.includes('gradient')) bgLeaf(el, s, w, h, c);
	}
	// children in paint order: z-index, then DOM order (negative z under the element's own art)
	const kids = [...el.children] as HTMLElement[];
	if (kids.length) {
		const zs = kids.map((k, i) => [style(k, force || animated.has(k)).z, i, k] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
		for (const [, , k] of zs) {
			const op = k.offsetParent as HTMLElement | null;
			const kx = op === el ? k.offsetLeft + el.clientLeft : k.offsetLeft - (el.offsetParent === op ? el.offsetLeft : 0);
			const ky = op === el ? k.offsetTop + el.clientTop : k.offsetTop - (el.offsetParent === op ? el.offsetTop : 0);
			walk(k, M, c, kx, ky, force);
		}
	}
}

let roots: HTMLElement[] = [], board: HTMLElement | null = null, frame: HTMLElement | null = null, started = false;
function boardOrigin() {
	let x = 0, y = 0; for (let e: HTMLElement | null = board; e && e !== frame; e = e.offsetParent as HTMLElement | null) { x += e.offsetLeft; y += e.offsetTop; }
	return { x, y };
}
function tick() {
	if (!board || !board.isConnected) return true;
	frameNo++; order = 0;
	animated.clear();
	for (const a of board.getAnimations({ subtree: true })) { const t = (a.effect as KeyframeEffect | null)?.target; if (t) animated.add(t); }
	const force = dirtyAll; dirtyAll = false;
	const o = boardOrigin(), bs = style(board, force || animated.has(board));
	const M = new DOMMatrix().translate(o.x, o.y).multiply(bs.m);
	const base: Ctx = { M, op: 1, br: 1, host: layer.reels, glow: false };
	for (const r of roots) walk(r, M, base, r.offsetLeft, r.offsetTop, force);
	for (const x of live) if (x.d.destroyed) live.delete(x); else if (x.used !== frameNo) { if (x.d.visible) x.d.visible = false; if (!x.d.parent || x.used < frameNo - 120) { x.d.removeFromParent(); if (x.kind !== 'db') x.d.destroy({ children: true }); live.delete(x); } }
	for (const k of liveClips) if (k.used !== frameNo) { k.c.visible = false; if (k.used < frameNo - 120) { k.c.removeFromParent(); liveClips.delete(k); } } else k.c.visible = true;
	return true;
}
/** Start mirroring #board's state model into the board stage (idempotent). */
export async function startMirror() {
	if (started) return; started = true;
	const a = await boardStage(); if (!a) { started = false; return; }
	board = document.getElementById('board'); frame = document.getElementById('frame');
	roots = ['strips', 'cells', 'overlays'].map((id) => document.getElementById(id)).filter((x): x is HTMLElement => !!x);
	// the symbol sheet + depth sheet are decoded before the board shows (no blank first frame)
	source(SHEET); source('sheets/symdepth.webp');
	await Promise.all([srcs.get(SHEET)?.p, srcs.get('sheets/symdepth.webp')?.p]);
	document.body.classList.add('pixiBoard');
	const mo = new MutationObserver(() => { dirtyAll = true; });
	for (const r of roots) mo.observe(r, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'src', 'data-v'] });
	mo.observe(board!, { attributes: true, attributeFilter: ['class', 'style'] });
	mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
	addEventListener('resize', () => { dirtyAll = true; });
	animate(tick);
}
export const mirrorDirty = () => { dirtyAll = true; kick(); };
