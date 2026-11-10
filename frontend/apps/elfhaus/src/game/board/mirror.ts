// fix8 (James 2026-11-04 "do it the right way"): every board symbol is drawn by the ONE board Pixi stage. The DOM under
// #board (#strips spinners, #cells, #overlays) stays only as an invisible state + motion model: the classes other files
// read (win / dim / spinning / puffed / wild ...), the layout, and the pose-store motion (board/motion.ts). Its paint
// is off (opacity 0); this module walks it in paint order every frame something moves and draws each visual leaf as a
// Pixi sprite with the element's full composed transform (offset, transform-origin, transform / translate / rotate /
// scale, 3D projected), its composed opacity, brightness (dim) and blend mode:
//   sheet frames (.rp f_*, .sd depth, letters: any background-image region)  -> Sprite on the shared texture
//   tile recess / border / frost (.tRec / .tBd / .tFr, CSS border-image)       -> NineSliceSprite (52 px corners)
//   <img> (stack panels, elf cut-outs, stills)                                   -> Sprite
//   <canvas> snapshots (merge lean stage)                                        -> Sprite (reuploaded when its pixels change)
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
import { boardStage, layer, kick, animate, onLayout } from './stage';
import { dbDisplay } from '../dbstacks';
import { canvasRev } from '../sprite';
import { isUiHost } from '../uihosts';
import { hostProps } from '../uilayout';
import { frameOf, SYM_INSET } from './symframes';
import { layoutStyle } from './hostlayout';
import { poseOf, motionLive, syncMotion, applyPoseMatrix, markRestart, clearRestart } from './motion';
import { slotPose, reelMoving } from '../reelpose';
const hostLive = (el: Element | null | undefined) => !!el && (el.isConnected || isUiHost(el));
import { mxFont } from '../ui';

type Fr = { frame: { x: number; y: number; w: number; h: number } };
const FRAMES = (SHEET_JSON as unknown as { frames: Record<string, Fr> }).frames;
const DFR = (DEPTH_JSON as unknown as { frames: Record<string, Fr> }).frames;
void DFR;

// ---------- textures ----------
type Src = { tex: Texture | null; img?: HTMLImageElement; p?: Promise<void> };
const srcs = new Map<string, Src>();
function normUrl(url: string): string {
	if (!url) return url;
	try {
		const u = new URL(url, typeof location !== 'undefined' ? location.href : 'http://localhost/');
		const path = u.pathname.replace(/^\//, '');
		if (path.endsWith('sheets/symbols.webp') || path.endsWith('sheets/symdepth.webp')) return path.includes('symdepth') ? 'sheets/symdepth.webp' : 'sheets/symbols.webp';
		return u.pathname.startsWith('/') ? path : url;
	} catch { return url; }
}
function source(url: string): Texture | null {
	url = normUrl(url);
	let s = srcs.get(url);
	if (!s) {
		s = { tex: null }; srcs.set(url, s);
		const im = new Image(); im.decoding = 'async'; im.src = url; s.img = im;
		const S = s;
		s.p = im.decode().then(() => { S.tex = Texture.from(im); changed = true; kick(); }).catch(() => {});
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
	// baked at most 160 px on its long side (a soft halo needs no detail): a stack's big glow image costs ~1 ms, not 150
	const f = tex.frame, ks = Math.min(1, 160 / Math.max(f.width, f.height)), fw = Math.ceil(f.width * ks), fh = Math.ceil(f.height * ks);
	const P = Math.ceil(Math.max(fw, fh) * 0.08);
	const c = document.createElement('canvas'); c.width = fw + 2 * P; c.height = fh + 2 * P;
	const x = c.getContext('2d', { willReadFrequently: true }); if (!x) return null;
	x.filter = `blur(${Math.max(1, P * 0.35).toFixed(1)}px)`;
	x.drawImage(res, f.x, f.y, f.width, f.height, P, P, fw, fh);
	x.filter = 'none';
	const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
	for (let i = 0; i < a.length; i += 4) {
		const al = a[i + 3] / 255, core = Math.max(0, Math.min(1, (al - 0.55) / 0.4)), k = core * core;
		a[i] = Math.round(25 + (255 - 25) * k); a[i + 1] = Math.round(225 + 30 * k); a[i + 2] = 255;
		a[i + 3] = Math.round(255 * Math.min(1, al * 1.25));
	}
	x.putImageData(d, 0, 0);
	g = Texture.from(c); (g as any)._pad = P / ks; (g as any)._ks = ks; glows.set(key, g);
	return g;
}

// ---------- computed style cache ----------
type St = { f: number; pd: number; o: string; tr: string; ro: string; sc: string; tf: string; w: number; h: number; m: DOMMatrix; op: number; vis: boolean; z: number; br: number; blend: string; clip: null | { inset: number[]; r: number[] }; ov: boolean; bg: string; bs: string; bp: string; bw: number; fit: string; disp: boolean };
const cache = new WeakMap<Element, St>();
const num = (s: string) => parseFloat(s) || 0;
function lenOf(v: string, ref: number) { return v.endsWith('%') ? (num(v) / 100) * ref : num(v); }
type TP = { transformOrigin: string; translate: string; rotate: string; scale: string; transform: string };
function localMatrix(cs: TP, w: number, h: number) {
	const o = cs.transformOrigin.split(' '), ox = lenOf(o[0] || '50%', w), oy = lenOf(o[1] || '50%', h);
	let m = new DOMMatrix();
	const tr = cs.translate, ro = cs.rotate, sc = cs.scale, tf = cs.transform;
	if (tr && tr !== 'none') { const p = tr.split(' '); m = m.translate(lenOf(p[0], w), lenOf(p[1] || '0', h)); }
	if (ro && ro !== 'none') { const deg = ro.endsWith('rad') ? (num(ro) * 180) / Math.PI : ro.endsWith('turn') ? num(ro) * 360 : num(ro); m = m.rotate(0, 0, ro.includes(' ') ? num(ro.split(' ').pop()!) : deg); }
	if (sc && sc !== 'none') { const p = sc.split(' ').map(num); m = m.scale(p[0], p[1] ?? p[0]); }
	if (tf && tf !== 'none') { try { m = m.multiply(new DOMMatrix(tf)); } catch { m = m.multiply(pctMatrix(tf, w, h)); } }
	if (m.isIdentity) return m;
	m = new DOMMatrix().translate(ox, oy).multiply(m).translate(-ox, -oy);
	if (!m.is2D) {   // project (perspective / translateZ): affine fit through three points
		const P = (x: number, y: number) => { const q = m.transformPoint(new DOMPoint(x, y, 0, 1)); return [q.x / q.w, q.y / q.w]; };
		const [x0, y0] = P(0, 0), [x1, y1] = P(100, 0), [x2, y2] = P(0, 100);
		m = new DOMMatrix([(x1 - x0) / 100, (y1 - y0) / 100, (x2 - x0) / 100, (y2 - y0) / 100, x0, y0]);
	}
	return m;
}
/** a transform list with % lengths (DOMMatrix() rejects them): resolve translate %s against the box */
function pctMatrix(tf: string, w: number, h: number) {
	const r = tf.replace(/translate(X|Y|3d)?\(([^)]*)\)/g, (_a, ax: string | undefined, args: string) => {
		const p = args.split(',').map((v) => v.trim());
		if (ax === 'X') return `translateX(${lenOf(p[0], w)}px)`; if (ax === 'Y') return `translateY(${lenOf(p[0], h)}px)`;
		return `translate${ax === '3d' ? '3d' : ''}(${lenOf(p[0], w)}px,${lenOf(p[1] || '0', h)}px${ax === '3d' ? ',' + (p[2] || '0') : ''})`;
	});
	try { return new DOMMatrix(r); } catch { return new DOMMatrix(); }
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
const F_SKIP = 1, F_GLOW = 2, F_MX = 4, F_NINE = 8, F_DB = 16;
function flags(el: HTMLElement) {
	const cl = typeof el.className === 'string' ? el.className : '';
	return (cl && SKIP.test(cl) ? F_SKIP : 0) | (/\bsymGlow\b/.test(cl) || (el.tagName === 'IMG' && /\bstk_glow\b/.test(cl)) ? F_GLOW : 0)
		| (/\bmx\b/.test(cl) ? F_MX : 0) | (/\bt(Rec|Bd|Fr)\b/.test(cl) ? F_NINE : 0) | (/\bstk_db\b/.test(cl) ? F_DB : 0);
}
function hostCs(el: HTMLElement): CSSStyleDeclaration {
	// Detached hosts report display:none from the browser's getComputedStyle;
	// board/symbol nodes use the TypeScript layout tables; other hosts use their
	// uilayout props (inline style) and safe defaults.
	if (!isUiHost(el)) return getComputedStyle(el);
	const lay = layoutStyle(el);
	const p: Record<string, string> = lay ? {
		display: lay.display,
		visibility: lay.visibility,
		opacity: lay.opacity,
		overflow: lay.overflow,
		'z-index': lay.zIndex,
		filter: lay.filter,
		translate: lay.translate,
		scale: lay.scale,
		rotate: lay.rotate,
		transform: lay.transform,
		'transform-origin': lay.transformOrigin,
		'background-image': lay.backgroundImage,
		'background-size': lay.backgroundSize,
		'background-position': lay.backgroundPosition,
		'padding-top': lay.paddingTop,
	} : hostProps(el);
	const get = (k: string, d = '') => p[k] || d;
	const bag = {
		paddingTop: get('padding-top', '0px'),
		transformOrigin: get('transform-origin', '50% 50%'),
		translate: get('translate', 'none'),
		rotate: get('rotate', 'none'),
		scale: get('scale', 'none'),
		transform: get('transform', 'none'),
		opacity: get('opacity', '1'),
		visibility: get('visibility', 'visible'),
		display: get('display', 'block'),
		zIndex: get('z-index', 'auto'),
		filter: get('filter', 'none'),
		mixBlendMode: get('mix-blend-mode', 'normal'),
		clipPath: get('clip-path', 'none'),
		overflow: get('overflow', 'visible'),
		backgroundImage: (get('background-image', 'none').includes('url(') ? get('background-image') : get('background-image', 'none')),
		backgroundSize: get('background-size', 'auto'),
		backgroundPosition: get('background-position', '0% 0%'),
		borderImageWidth: get('border-image-width', '0'),
		borderTopWidth: get('border-top-width', '0'),
		objectFit: get('object-fit', 'fill'),
		getPropertyValue(name: string) { return p[name] || ''; },
	};
	if (bag.backgroundImage.includes('url(') && !bag.backgroundImage.includes('http') && !bag.backgroundImage.includes('data:')) {
		bag.backgroundImage = bag.backgroundImage.replace(/url\((['"]?)([^'")]+)\1\)/, (_m, q, u) => {
			try { return `url("${new URL(u, location.href).href}")`; } catch { return _m; }
		});
	}
	return bag as unknown as CSSStyleDeclaration;
}
function style(el: HTMLElement, force: boolean): St {
	let s = cache.get(el);
	if (s && !force) return s;
	const cs = hostCs(el), g = geo.get(el), w = g ? g.w : el.offsetWidth, h = g ? g.h : el.offsetHeight;
	s = {
		f: flags(el), pd: num(cs.paddingTop), o: cs.transformOrigin, tr: cs.translate, ro: cs.rotate, sc: cs.scale, tf: cs.transform, w, h,
		m: localMatrix(cs, w, h), op: (cs.opacity === '' || cs.opacity == null ? 1 : num(cs.opacity)), vis: cs.visibility !== 'hidden', disp: cs.display !== 'none', z: cs.zIndex === 'auto' ? 0 : parseInt(cs.zIndex) || 0,
		br: brightness(cs.filter), blend: cs.mixBlendMode, clip: clipOf(cs, w, h), ov: cs.overflow === 'hidden' || cs.overflow === 'clip',
		bg: cs.backgroundImage, bs: cs.backgroundSize, bp: cs.backgroundPosition, bw: num(cs.borderImageWidth) > 4 ? num(cs.borderImageWidth) : num(cs.borderTopWidth), fit: cs.objectFit,
	};
	const fr = frameOf(el);
	if (fr) { s.bg = fr.bg; s.bs = fr.bs; s.bp = fr.bp; s.disp = true; }
	// Dim once, on the .cell that has .dim. Descendants inherit through ctx.br.
	// Applying 0.48 on every node in a deep rig, then multiplying down the walk, tinted the
	// colour sprite black and left a silhouette (sometimes with the win glow still standing).
	const selfDim = el.classList.contains('cell') && el.classList.contains('dim');
	s.br = selfDim ? 0.48 : (Number.isFinite(s.br) && s.br > 0 ? s.br : 1);
	cache.set(el, s); return s;
}

// ---------- display pool (one per DOM leaf, reused across frames) ----------
type Out = { d: Container; used: number; kind: string; cv?: HTMLCanvasElement };
const outs = new WeakMap<Element, Out>();
const live = new Set<Out>();
let frameNo = 0;
function releaseOut(o: Out) {
	o.d.removeFromParent();
	if (o.kind !== 'db' && !o.d.destroyed) o.d.destroy({ children: true });
	// merge lean snapshots are uploaded once; dropping the sprite must free the GPU copy too
	if (o.cv) { const t = cvTex.get(o.cv); if (t) { cvTex.delete(o.cv); try { t.destroy(true); } catch { /* already destroyed */ } } o.cv = undefined; }
	live.delete(o);
}
function out(el: Element, kind: string, make: () => Container): Out {
	let o = outs.get(el);
	if (!o || o.kind !== kind || (o.d.destroyed && kind !== 'db') || !live.has(o)) { if (o) releaseOut(o); o = { d: make(), used: 0, kind }; outs.set(el, o); live.add(o); }
	o.used = frameNo; return o;
}
const SKIP = /\b(tGl|tGw|rgShine|wFrame|ovWinO|ovGlow|lock|nm|plate|mfRays|mfCore)\b/;
const BLEND: Record<string, BLEND_MODES> = { screen: 'screen', 'plus-lighter': 'add', multiply: 'multiply', normal: 'normal' };
// 2D affine [a, b, c, d, e, f] (no DOMMatrix allocations in the per-frame walk)
type Af = [number, number, number, number, number, number];
const pm = new Matrix();
function place(d: Container, M: Af, x: number, y: number, sx: number, sy: number) {
	pm.set(M[0] * sx, M[1] * sx, M[2] * sy, M[3] * sy, M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]); d.setFromMatrix(pm);
}
/** P * translate(tx, ty) * m */
function compose(P: Af, tx: number, ty: number, m: DOMMatrix): Af {
	const e = P[0] * tx + P[2] * ty + P[4], f = P[1] * tx + P[3] * ty + P[5];
	return [P[0] * m.a + P[2] * m.b, P[1] * m.a + P[3] * m.b, P[0] * m.c + P[2] * m.d, P[1] * m.c + P[3] * m.d, P[0] * m.e + P[2] * m.f + e, P[1] * m.e + P[3] * m.f + f];
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
let order = 0;
type Ctx = { M: Af; op: number; br: number; host: Container; glow: boolean };
type BgHit = { t: Texture; x: number; y: number; w: number; h: number; bw: number; bh: number };
const bgHit = new WeakMap<St, BgHit>();
function bgLeaf(el: HTMLElement, s: St, w: number, h: number, c: Ctx) {
	// the region only changes with the style (restyle makes a new St) or the box
	const hit = bgHit.get(s);
	if (hit && hit.bw === w && hit.bh === h) { sprite(el, hit.t, c, hit.x, hit.y, hit.w, hit.h, s); return; }
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
	bgHit.set(s, { t, x: x0, y: y0, w: x1 - x0, h: y1 - y0, bw: w, bh: h });
	sprite(el, t, c, x0, y0, x1 - x0, y1 - y0, s);
}
function sprite(el: Element, t: Texture, c: Ctx, x: number, y: number, w: number, h: number, s: St, kind = 'spr') {
	let tex = t, host = c.host, pad = 0;
	if (c.glow) { const g = (t as any)._teal ?? ((t as any)._teal = tealGlow(texKey(t), t)); if (!g) return; tex = g; pad = (g as any)._pad || 0; host = layer.winGlow; }
	const o = out(el, kind + (c.glow ? 'G' : ''), () => new Sprite());
	const sp = o.d as Sprite; if (sp.texture !== tex) sp.texture = tex;
	if (sp.parent !== host) host.addChild(sp);
	const fw = t.frame.width, fh = t.frame.height, kx = w / fw, ky = h / fh, gk = c.glow ? (tex as any)._ks || 1 : 1;
	place(sp, c.M, x - pad * kx, y - pad * ky, kx / gk, ky / gk);
	sp.alpha = c.op; sp.tint = c.glow ? 0xffffff : tint(Number.isFinite(c.br) && c.br > 0 ? c.br : 1); sp.blendMode = c.glow ? 'add' : BLEND[s.blend] ?? 'normal';
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
	place(ns, c.M, 0, 0, k, k); ns.alpha = c.op; ns.tint = tint(Number.isFinite(c.br) && c.br > 0 ? c.br : 1); ns.zIndex = order++; ns.visible = true;
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
// ---------- geometry cache (layout is read only in rebuild(): on a resize, a class / child / layout-style change) ----------
type Geo = { x: number; y: number; w: number; h: number; kids: HTMLElement[] };
const geo = new WeakMap<Element, Geo>();
let geoDirty = true, origin = { x: 0, y: 0 };
function measure(el: HTMLElement, x: number, y: number) {
	const kids = [...el.children] as HTMLElement[];
	const g: Geo = { x, y, w: el.offsetWidth, h: el.offsetHeight, kids: [] };
	geo.set(el, g);
	for (const k of kids) {
		const op = k.offsetParent as HTMLElement | null;
		const kx = op === el ? k.offsetLeft + el.clientLeft : k.offsetLeft - (el.offsetParent === op ? el.offsetLeft : 0);
		const ky = op === el ? k.offsetTop + el.clientTop : k.offsetTop - (el.offsetParent === op ? el.offsetTop : 0);
		measure(k, kx, ky);
	}
	return g;
}
function restyle(el: HTMLElement) {
	const g = geo.get(el); if (!g) return;
	style(el, true);
	syncMotion(el);
	for (const k of el.children) restyle(k as HTMLElement);
	// children in paint order: z-index, then DOM order (negative z under the element's own art)
	g.kids = ([...el.children] as HTMLElement[]).map((k, i) => [cache.get(k)?.z ?? 0, i, k] as const).sort((p, q) => p[0] - q[0] || p[1] - q[1]).map((v) => v[2]);
}
/** Re-measure one subtree in place (its own offset from its parent, then every descendant) and restyle it. */
function remeasure(el: HTMLElement) {
	const p = el.parentElement, pg = p && geo.get(p);
	if (!p || !pg || !hostLive(el)) { geoDirty = true; return; }
	const op = el.offsetParent as HTMLElement | null;
	const x = op === p ? el.offsetLeft + p.clientLeft : el.offsetLeft - (p.offsetParent === op ? p.offsetLeft : 0);
	const y = op === p ? el.offsetTop + p.clientTop : el.offsetTop - (p.offsetParent === op ? p.offsetTop : 0);
	measure(el, roots.includes(el) || extras.includes(el) ? el.offsetLeft : x, roots.includes(el) || extras.includes(el) ? el.offsetTop : y);
	restyle(el);
	pg.kids = ([...p.children] as HTMLElement[]).map((k, i) => [cache.get(k)?.z ?? 0, i, k] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((v) => v[2]);
}
function rebuild() {
	geoDirty = false;
	let x = 0, y = 0; for (let e: HTMLElement | null = board; e && e !== frame; e = e.offsetParent as HTMLElement | null) { x += e.offsetLeft; y += e.offsetTop; }
	origin = { x, y };
	for (const r of roots) measure(r, r.offsetLeft, r.offsetTop);
	extras = ['frameLit', 'frameGlint'].map((id) => document.getElementById(id)).filter((x): x is HTMLElement => !!x && x.parentElement === frame);
	for (const e of extras) { measure(e, e.offsetLeft, e.offsetTop); restyle(e); if (!watched.has(e)) { watched.add(e); mo?.observe(e, { subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ['class', 'style'] }); } }
	geo.set(board!, { x: 0, y: 0, w: board!.offsetWidth, h: board!.offsetHeight, kids: [] });
	style(board!, true);
	for (const r of roots) restyle(r);
	inlineQ.clear(); styleQ.clear(); geoQ.clear();
}

// ---------- motion without layout reads: inline transforms parsed from el.style; poses from board/motion.ts ----------
const inlineQ = new Set<HTMLElement>(), styleQ = new Set<HTMLElement>(), geoQ = new Set<HTMLElement>();
// ghostfix: an inline visibility change (a cell hidden under a full-reel / merged wild, bookEventHandlerMap) inherits to
// the whole subtree in CSS, but the cache held each descendant's old 'visible': the hidden cell's bust, WILD letters,
// badge and their teal win-glow copies kept drawing under the stack and showed through the gaps (between the legs) as
// faint mini silhouettes. A visibility change now restyles the subtree.
const visQ = new Set<HTMLElement>(), lastVis = new WeakMap<HTMLElement, string>();
function inlineUpdate(el: HTMLElement) {
	const s = cache.get(el); if (!s) { styleQ.add(el); return; }
	const st = el.style;
	if ((lastVis.get(el) ?? '') !== st.visibility) { lastVis.set(el, st.visibility); visQ.add(el); }
	if (st.transform || st.translate || st.scale || st.rotate) {
		const tp: TP = { transformOrigin: st.transformOrigin || s.o, translate: st.translate || s.tr, rotate: st.rotate || s.ro, scale: st.scale || s.sc, transform: st.transform || s.tf };
		s.tr = tp.translate; s.ro = tp.rotate; s.sc = tp.scale; s.tf = tp.transform; s.o = tp.transformOrigin;
		s.m = localMatrix(tp, s.w, s.h);
	} else styleQ.add(el);
	if (st.opacity) s.op = num(st.opacity);
	if (st.visibility) s.vis = st.visibility !== 'hidden';
	if (st.display) s.disp = st.display !== 'none';
}
// ---------- the walk (cached geometry + styles only: no layout or computed-style reads) ----------
function walk(el: HTMLElement, parent: Af, pc: Ctx, isRoot: boolean) {
	const g = geo.get(el); if (!g) { geoDirty = true; return; }
	const base = cache.get(el); if (!base) { geoDirty = true; return; }
	if (base.f & F_SKIP) return;
	let s = base;
	const pose = poseOf(el);
	if (pose) {
		s = s === base ? { ...base } : s;
		const o = base.o.split(' '), fx = g.w ? lenOf(o[0] || '50%', g.w) / g.w : 0.5, fy = g.h ? lenOf(o[1] || '50%', g.h) / g.h : 0.5;
		s.m = applyPoseMatrix(s.m, pose, g.w, g.h, fx, fy);
		s.op *= pose.op;
		s.br *= Number.isFinite(pose.br) ? pose.br : 1;
	}
	const slot = slotPose(el);
	if (slot) {
		s = s === base ? { ...base } : s;
		s.m = s.m.translate(0, slot.y);
		if (slot.sy != null && slot.sy !== 1) s.m = s.m.translate(0, g.h / 2).scale(1, slot.sy).translate(0, -g.h / 2);
	}
	if (!s.disp) return;
	const w = g.w, h = g.h;
	const M = compose(parent, g.x, g.y, s.m);
	const winning = !!(el.closest && el.closest('.win'));
	const c: Ctx = { M, op: pc.op * (isRoot ? 1 : s.op), br: pc.br * s.br, host: pc.host, glow: winning && (pc.glow || !!(base.f & F_GLOW)) };
	if (c.op <= 0.003) return;
	if (s.ov || s.clip) {
		const k = clipFor(el); if (k.c.parent !== pc.host) pc.host.addChild(k.c);
		k.c.zIndex = order++; k.g.clear();
		const [t, r, b, l] = s.clip?.inset ?? [0, 0, 0, 0], rad = s.clip?.r[0] ?? 0;
		pm.set(M[0], M[1], M[2], M[3], M[4], M[5]); k.g.setFromMatrix(pm);
		if (rad) k.g.roundRect(l, t, w - l - r, h - t - b, rad); else k.g.rect(l, t, w - l - r, h - t - b);
		k.g.fill(0xffffff);
		// #frameGlint: its CSS mask keeps only the padding ring (the timber band + trim), never the window
		if (el.id === 'frameGlint' && s.pd > 0) k.g.rect(s.pd, s.pd, w - 2 * s.pd, h - 2 * s.pd).cut();
		c.host = k.c;
	}
	const tag = el.tagName;
	if (s.vis) {
		if (base.f & F_MX) { badge(el, c, w, h); return; }
		if (tag === 'CANVAS') {
			const cv = el as unknown as HTMLCanvasElement;
			if (base.f & F_DB) { const d = dbDisplay(cv); if (d) { const o = out(el, 'db', () => d.root); if (o.d !== d.root) o.d = d.root; if (d.root.destroyed) return; if (d.root.parent !== c.host) c.host.addChild(d.root); { const k = h / d.H; place(d.root, M, (w - d.W * k) / 2, 0, k, k); } d.root.alpha = c.op; d.root.zIndex = order++; d.root.visible = true; } return; }
			if (!cv.width) return;
			// Texture.from reads the canvas once. A pooled sheet canvas is redrawn in place (and a merge snapshot can
			// be the same element as an earlier upload). Without source.update the board keeps the previous frame.
			let t = cvTex.get(cv); const dead = !t || (t as Texture & { destroyed?: boolean }).destroyed;
			const revNow = canvasRev(cv);
			if (dead) { t = Texture.from(cv); cvTex.set(cv, t); (t as Texture & { _rev?: number })._rev = revNow; }
			else if ((t as Texture & { _rev?: number })._rev !== revNow) { t!.source.update(); (t as Texture & { _rev?: number })._rev = revNow; }
			sprite(el, t!, c, 0, 0, w, h, s);
			const held = outs.get(el); if (held) held.cv = cv;
			return;
		}
		if (tag === 'IMG') {
			const im = el as HTMLImageElement, t = im.currentSrc || im.src ? source(im.currentSrc || im.src) : null; if (!t) return;
			let x = 0, y = 0, dw = w, dh = h;
			if (s.fit === 'contain' || s.fit === 'cover') { const k = (s.fit === 'cover' ? Math.max : Math.min)(w / t.width, h / t.height); // cover: no crop (the stk_glow outline overflows like its rig)
				 dw = t.width * k; dh = t.height * k; x = (w - dw) / 2; y = (h - dh) / 2; }
			sprite(el, t, c, x, y, dw, dh, s); return;
		}
		if (base.f & F_NINE) { nine(el, s, w, h, c); }
		else if (s.bg && s.bg !== 'none' && !s.bg.includes('gradient')) bgLeaf(el, s, w, h, c);
	}
	for (const k of g.kids) walk(k, M, c, false);
}

let changed = true;
export const mirrorChanged = () => { changed = true; };
let extras: HTMLElement[] = [], mo: MutationObserver | null = null;
const watched = new WeakSet<Element>();
let roots: HTMLElement[] = [], board: HTMLElement | null = null, frame: HTMLElement | null = null, started = false;
// frame timing probe (window.__mirrorMs: the mirror's own cost per frame, last 600 frames)
const msLog: number[] = []; if (import.meta.env.DEV) (globalThis as any).__mirrorMs = msLog;
function tick() {
	if (!board || !hostLive(board)) return true;
	const t0 = performance.now();
	frameNo++; order = 0;
	if (geoDirty) { rebuild(); changed = true; }
	else if (geoQ.size) {
		// outermost changed subtrees only (a parent's re-measure covers its children)
		const list = [...geoQ].filter((e) => { for (let a = e.parentElement; a; a = a.parentElement) if (geoQ.has(a)) return false; return true; });
		geoQ.clear(); changed = true;
		for (const e of list) if (geo.has(e) || (e.parentElement && geo.has(e.parentElement))) remeasure(e); else geoDirty = true;
		if (geoDirty) rebuild();
	}
	if (styleQ.size || inlineQ.size) changed = true;
	// a class change restyles the element's subtree (descendant selectors) and re-sorts its siblings (z-index)
	for (const el of styleQ) { if (!hostLive(el)) continue; restyle(el); const p = el.parentElement, pg = p && geo.get(p);
		if (p && pg) pg.kids = ([...p.children] as HTMLElement[]).map((k, i) => [cache.get(k)?.z ?? 0, i, k] as const).sort((x, y) => x[0] - y[0] || x[1] - y[1]).map((v) => v[2]); }
	styleQ.clear();
	for (const el of inlineQ) inlineUpdate(el);
	inlineQ.clear();
	for (const el of visQ) if (hostLive(el)) restyle(el);
	visQ.clear();
	for (const el of styleQ) style(el, true);
	styleQ.clear();
	clearRestart();
	// nothing moved, nothing changed: the stage keeps last frame's displays. All motion is the pose
	// store (motionLive) or the reels; detached hosts never run page (CSS / WAAPI) animations.
	if (!changed && !motionLive() && !reelMoving()) { if (import.meta.env.DEV) { msLog.push(performance.now() - t0); if (msLog.length > 600) msLog.shift(); } return true; }
	changed = false;
	const b = cache.get(board)!;
	const M = compose([1, 0, 0, 1, 0, 0], origin.x, origin.y, b.m);
	const base: Ctx = { M, op: 1, br: 1, host: layer.reels, glow: false };
	for (const r of roots) walk(r, M, base, true);
	// the frame's fire light and glint, over the frame back (they were DOM over #mkFrame)
	const fb: Ctx = { M: [1, 0, 0, 1, 0, 0], op: 1, br: 1, host: layer.frameBack, glow: false };
	for (const e of extras) { if (!hostLive(e)) { geoDirty = true; continue; } walk(e, fb.M, fb, false); }
	for (const x of live) if (x.d.destroyed) live.delete(x); else if (x.used !== frameNo) { if (x.d.visible) x.d.visible = false; if (!x.d.parent || x.used < frameNo - 120) releaseOut(x); }
	for (const k of liveClips) if (k.used !== frameNo) { k.c.visible = false; if (k.used < frameNo - 120) { k.c.removeFromParent(); liveClips.delete(k); } } else k.c.visible = true;
	if (import.meta.env.DEV) { msLog.push(performance.now() - t0); if (msLog.length > 600) msLog.shift(); }
	return true;
}
const GEO_PROPS = /(^|;)\s*(left|top|right|bottom|width|height|inset|margin[a-z-]*|padding[a-z-]*|display|position)\s*:/;
const geoPart = (css: string | null) => (css || '').split(';').filter((d) => GEO_PROPS.test(';' + d)).map((d) => d.trim()).sort().join(';');
/** nearest measured element at or above t (a node added in the same batch is measured with its parent) */
const known = (t: HTMLElement | null) => { for (let a = t; a; a = a.parentElement) if (geo.has(a)) return a; return null; };
function onMutations(recs: MutationRecord[]) {
	for (const r of recs) {
		const t = r.target as HTMLElement;
		if (r.type === 'childList') { const a = known(t); if (a) geoQ.add(a); else { geoDirty = true; } continue; }
		if (r.attributeName === 'style') {
			// a layout property changed (the merge stage's left / width, a hidden cell): re-measure; else transforms / opacity only
			if (geoPart(r.oldValue) !== geoPart(t.getAttribute('style'))) { const a = known(t); if (a) geoQ.add(a); else geoDirty = true; }
			else inlineQ.add(t);
		} else if (r.attributeName === 'class' && t === document.body) {
			const a = new Set((r.oldValue || '').split(/\s+/)), b = new Set(t.className.split(/\s+/)), diff = [...a, ...b].filter((x) => x && a.has(x) !== b.has(x));
			if (diff.some((x) => BODY_GEO.test(x))) { geoDirty = true; } else if (diff.length) for (const rt of roots) styleQ.add(rt);
		}
		else if (r.attributeName === 'class') { { const was = new Set((r.oldValue || '').split(/\s+/)); if (t.className && typeof t.className === 'string' && t.className.split(/\s+/).some((c) => c && !was.has(c))) markRestart(t); }
			if (CLASS_GEO.test((r.oldValue || '') + ' ' + t.className)) { const a = known(t); if (a) geoQ.add(a); else geoDirty = true; } else if (geo.has(t)) styleQ.add(t); else { const a = known(t); if (a) geoQ.add(a); } }
		else { const a = known(t); if (a) geoQ.add(a); else geoDirty = true; }   // src / data-v
	}
	kick();
}
// classes that change a box's size or presence (spinner in / out, merge, hidden): re-measure on those
const BODY_GEO = /^(portrait|landscape|phone|tablet|desktop|mk|skin|phl|pixiBoard|replay)$/;
const CLASS_GEO = /\b(spinning|merge|full|hidden|gone|cspin|mStage|big|landed|dim|win)\b/;
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
	mo = new MutationObserver(onMutations);
	for (const r of roots) mo!.observe(r, { subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ['class', 'style', 'src', 'data-v'] });
	mo!.observe(board!, { attributes: true, attributeOldValue: true, attributeFilter: ['class', 'style'] });
	mo!.observe(document.body, { attributes: true, attributeOldValue: true, attributeFilter: ['class'] });
	addEventListener('resize', () => { geoDirty = true; kick(); });
	onLayout(() => { geoDirty = true; });
	animate(tick);
}
export const mirrorDirty = () => { geoDirty = true; changed = true; kick(); };
