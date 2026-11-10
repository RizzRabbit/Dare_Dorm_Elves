// Painted typography for the UI overlay: titles-atlas word sprites, bitmap fonts via paintTextCanvas,
// and the title-lettering glyph sheet (titletype.webp). No code-drawn lettering.
import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { Assets } from 'pixi.js';
import { loadAtlas, spr } from '../scene/atlas';
import { loadFont, paintTextCanvas } from '../skin';
import TT from '../chalet/titletype.json';

const J = TT as unknown as { size: [number, number]; h: number; frames: Record<string, [number, number, number, number]> };
const WORDS = Object.keys(J.frames).filter((k) => k.length > 1).sort((a, b) => b.length - a.length);

let typeTex: Texture | null = null;
const glyphTex = new Map<string, Texture>();

export async function loadUiText() {
	await Promise.all([loadAtlas('ui'), loadAtlas('titles'), loadFont('font_cream'), loadFont('font_gold'), loadFont('font_ink')]);
	typeTex = await Assets.load('assets/ui/titletype.webp') as Texture;
	glyphTex.clear();
	for (const [k, [x, y, w, h]] of Object.entries(J.frames)) {
		glyphTex.set(k, new Texture({ source: typeTex.source, frame: new Rectangle(x, y, w, h) }));
	}
}

export function wordSpr(name: string) {
	const s = spr('titles', name);
	s.anchor.set(0.5, 0.5);
	return s;
}

/** Scale a sprite to fit inside maxW x maxH, keeping aspect. */
export function fitSpr(s: Sprite, maxW: number, maxH: number) {
	const tw = Math.max(1, s.texture.width), th = Math.max(1, s.texture.height);
	const k = Math.min(maxW / tw, maxH / th);
	s.scale.set(k);
	return k;
}

/** Bitmap-font text as a Sprite (ink / cream / gold packages). Returns null until the font is decoded. */
export function bmSpr(txt: string, font: string, px: number, wrapW: number, align: 'left' | 'center' = 'center') {
	const r = paintTextCanvas(txt, font, px, wrapW, align);
	if (!r) return null;
	const t = Texture.from(r.cv);
	const s = new Sprite(t);
	s.anchor.set(align === 'center' ? 0.5 : 0, 0);
	s.scale.set(1 / r.res);
	s.label = 'bm:' + txt;
	return s;
}

/** Shrink bitmap text until it fits maxW (and optional maxH). */
export function bmFit(txt: string, font: string, px: number, maxW: number, maxH?: number, align: 'left' | 'center' = 'center') {
	let size = px;
	for (let i = 0; i < 8; i++) {
		const s = bmSpr(txt, font, size, maxW, align);
		if (!s) return null;
		const w = s.texture.width * s.scale.x, h = s.texture.height * s.scale.y;
		if (w <= maxW + 0.5 && (maxH == null || h <= maxH + 0.5)) return s;
		const k = Math.min(maxW / Math.max(1, w), maxH != null ? maxH / Math.max(1, h) : 1);
		size *= Math.max(0.55, k * 0.96);
		s.texture.destroy(true);
	}
	return bmSpr(txt, font, Math.max(8, size), maxW, align);
}

/** Replace a child's bitmap sprite, destroying the previous texture. */
export function setBm(parent: Container, prev: Sprite | null, next: Sprite | null) {
	if (prev) {
		parent.removeChild(prev);
		const t = prev.texture;
		prev.destroy();
		if (t && t !== Texture.EMPTY) try { t.destroy(true); } catch { /* already gone */ }
	}
	if (next) parent.addChild(next);
	return next;
}

/** Title-lettering row ("10 FREE SPINS", "START"), auto-fitted into maxW x maxH. */
export function typeRow(text: string, maxW: number, maxH: number) {
	const row = new Container();
	row.label = 'typeRow';
	let x = 0, i = 0;
	const H = J.h;
	while (i < text.length) {
		const w = WORDS.find((k) => text.startsWith(k, i));
		let key: string | null = null;
		if (w) { key = w; i += w.length; }
		else {
			let c = text[i++];
			if (c === '\u00a0' || c === '\u202f') c = ' ';
			if (c === ' ') { x += H * 0.32; continue; }
			if (!J.frames[c] && J.frames[c.toUpperCase()]) c = c.toUpperCase();
			key = J.frames[c] ? c : null;
		}
		if (!key) continue;
		const t = glyphTex.get(key); if (!t) continue;
		const s = new Sprite(t);
		s.anchor.set(0, 0);
		s.position.set(x, 0);
		row.addChild(s);
		x += t.width;
	}
	const w = Math.max(1, x), h = H;
	const k = Math.min(maxW / w, maxH / h);
	row.scale.set(k);
	row.pivot.set(w / 2, h / 2);
	return row;
}

/** Buy-menu title: painted BUY BONUS word, or GET BONUS in the cream font for social mode. */
export function buyTitleSpr(social: boolean, maxW: number, maxH: number) {
	if (!social) {
		try {
			const s = wordSpr('w_buy_bonus');
			fitSpr(s, maxW, maxH);
			s.label = 'uiTitle';
			return s as Container;
		} catch { /* atlas missing */ }
	}
	const s = bmFit(social ? 'GET BONUS' : 'BUY BONUS', 'font_cream', Math.min(36, maxH), maxW, maxH);
	if (s) s.label = 'uiTitle';
	return s as Container | null;
}

export function centerSpr(s: Sprite, x: number, y: number) {
	s.anchor.set(0.5, 0.5);
	s.position.set(x, y);
	return s;
}
