/*
 * ARCHIVED snapshot.
 * Source commit: 311ef87 (tag pre-layout-rebuild is 311ef87).
 * Original path: frontend/apps/elfhaus/src/game/board/hostlayout.ts
 * See archive/legacy-dom-ui/README.md. Not imported by the game.
 * Replaced by: TS board-cell state (rect, dim, glow, filter) applied on Pixi sprites.
 */
// Plain TypeScript layout and paint state for the off-document board host tree.
// Board, cells, symbols, rigs, overlays and multiplier badges no longer need
// a CSS resolver; other UI hosts read uilayout.ts (inline style + stand-in boxes).
import { artInset, frameOf, frameLen } from './symframes';

export type HostBox = { x: number; y: number; w: number; h: number };
export type HostStyle = {
	display: string;
	visibility: string;
	opacity: string;
	overflow: string;
	zIndex: string;
	filter: string;
	translate: string;
	transform: string;
	transformOrigin: string;
	backgroundImage: string;
	backgroundSize: string;
	backgroundPosition: string;
	paddingTop: string;
};

const HIDDEN = new Set(['tile', 'tRec', 'tBd', 'tFr', 'tGl', 'tGw', 'slT', 'symSh', 'wFrame']);
const FILL_IDS = new Set(['frame', 'board', 'strips', 'cells', 'overlays', 'flyLayer', 'frameLit', 'frameGlint']);

// Frame fire light and flare glint: painted parts of the board atlas (assets/board/boardfx, 'lit' / 'glint').
const BOARDFX = 'url(assets/board/boardfx.webp)';
const FRAME_FX: Record<'lit' | 'glint', { bs: string; bp: string }> = {
	lit: { bs: '678.1250% 896.8750%', bp: '64.1892% 93.3333%' },
	glint: { bs: '1356.2500% 3587.5000%', bp: '75.1244% 85.3047%' },
};
const isGlintBand = (el: HTMLElement) => el.tagName === 'I' && el.parentElement?.id === 'frameGlint';

const WILD_SYM: Record<string, [number, number]> = {
	k_W_R1: [0.0242, -0.0227],
	k_W_R2: [-0.007, -0.0227],
	k_W_R3: [0, -0.0227],
	k_W_R4: [0.0086, -0.0227],
	k_W_R5: [0.007, -0.0227],
};

function cellPx(el: HTMLElement, fallback: number): number {
	let n: HTMLElement | null = el;
	while (n) {
		const v = parseFloat(n.style.getPropertyValue('--cell') || '');
		if (v) return v;
		n = n.parentElement;
	}
	if (typeof document !== 'undefined') {
		const v = parseFloat(document.documentElement.style.getPropertyValue('--cell') || '');
		if (v) return v;
	}
	return fallback || 100;
}

function mxdy(el: HTMLElement): number {
	const v = el.style.getPropertyValue('--mxdy');
	if (v) return parseFloat(v) || 0;
	return 0;
}

const hiddenBox = (): HostBox => ({ x: 0, y: 0, w: 0, h: 0 });
const fillBox = (pw: number, ph: number): HostBox => ({ x: 0, y: 0, w: pw, h: ph });

/** Geometry for a board-tree node. null = not a board/symbol rule (caller may fall back). */
export function layoutBox(el: HTMLElement, parentW: number, parentH: number): HostBox | null {
	const cl = el.classList;
	const id = el.id;

	if (id === 'reelLines' || [...cl].some((c) => HIDDEN.has(c))) return hiddenBox();
	if (el.tagName === 'IMG' && cl.contains('stk_glow')) return fillBox(parentW, parentH);

	if (FILL_IDS.has(id)) return fillBox(parentW, parentH);
	// the glint band: a 14%-wide strip, 12% taller than the frame each way (it sweeps by transform)
	if (isGlintBand(el)) return { x: 0, y: -0.12 * parentH, w: 0.14 * parentW, h: 1.24 * parentH };

	const art = artInset(el, 'w', parentW, parentH);
	if (art != null) return { x: artInset(el, 'x', parentW, parentH) ?? 0, y: artInset(el, 'y', parentW, parentH) ?? 0, w: art, h: artInset(el, 'h', parentW, parentH) ?? art };

	const fr = frameOf(el);
	if (fr) return { x: frameLen(fr.l, parentW), y: frameLen(fr.t, parentH), w: frameLen(fr.w, parentW), h: frameLen(fr.h, parentH) };

	if (cl.contains('sym') || cl.contains('rig') || cl.contains('rgBody') || cl.contains('wart') || cl.contains('symGlow')) {
		return fillBox(parentW, parentH);
	}

	if (cl.contains('ov')) {
		// left / width are inline on the overlay; height fills the board.
		return { x: 0, y: 0, w: parentW, h: parentH };
	}

	if (cl.contains('mx')) {
		const cell = cellPx(el, parentW);
		const inCell = !!el.parentElement?.classList.contains('cell') && !cl.contains('stack');
		const inOv = !!el.closest('.ov');
		let h: number;
		if (inOv && cl.contains('stack')) h = Math.max(24, cell * 0.4);
		else if (inOv && cl.contains('total')) h = Math.max(17, cell * 0.22);
		else if (inCell) h = Math.max(18, cell * 0.29);
		else h = Math.max(19.5, cell * 0.318);
		const w = h * (150 / 60);
		if (inOv && cl.contains('total')) return { x: (parentW - w) / 2, y: parentH - 5 - h, w, h };
		const top = inCell ? 1 + mxdy(el) * cell : inOv ? 3 : 2;
		return { x: parentW - 2 - w, y: top, w, h };
	}

	if (cl.contains('cell') || cl.contains('antGlow') || cl.contains('cspin')) return null;
	// Board-adjacent leftovers we know are unpainted or full-bleed.
	if (cl.contains('stkElf') || cl.contains('stkGrp') || cl.contains('mLets') || cl.contains('stk_db')) return null;
	return null;
}

function wildTranslate(el: HTMLElement): string {
	if (!(el.classList.contains('sym'))) return 'none';
	const cell = el.closest('.cell');
	if (!cell) return 'none';
	const rig = cell.querySelector('.rig');
	if (!rig) return 'none';
	for (const c of rig.classList) {
		const off = WILD_SYM[c];
		if (off) return `${(off[0] * 100).toFixed(2)}% ${(off[1] * 100).toFixed(2)}%`;
	}
	return 'none';
}

const BASE_STYLE: HostStyle = {
	display: 'block',
	visibility: 'visible',
	opacity: '1',
	overflow: 'visible',
	zIndex: 'auto',
	filter: 'none',
	translate: 'none',
	transform: 'none',
	transformOrigin: '50% 50%',
	backgroundImage: 'none',
	backgroundSize: 'auto',
	backgroundPosition: '0% 0%',
	paddingTop: '0px',
};

/** Paint flags for a board-tree node. null = not a board/symbol rule. */
export function layoutStyle(el: HTMLElement): HostStyle | null {
	const cl = el.classList;
	const id = el.id;
	if (id === 'reelLines' || [...cl].some((c) => HIDDEN.has(c))) {
		return { ...BASE_STYLE, display: 'none' };
	}
	const boardish = FILL_IDS.has(id) || isGlintBand(el) || cl.contains('cell') || cl.contains('sym') || cl.contains('rig') || cl.contains('rgBody')
		|| cl.contains('rp') || cl.contains('sd') || cl.contains('ov') || cl.contains('wart') || cl.contains('mx')
		|| cl.contains('symGlow') || cl.contains('stkElf') || cl.contains('stkGrp') || el.tagName === 'IMG' && cl.contains('stk_glow')
		|| cl.contains('antGlow') || cl.contains('cspin') || cl.contains('rgSh') || cl.contains('rgSp') || cl.contains('rgShine');
	if (!boardish) return null;

	const s: HostStyle = { ...BASE_STYLE };
	if (cl.contains('rgShine') || cl.contains('wFrame')) s.display = 'none';

	// Fire spill and flare glint: same atlas frames the old chalet.css painted, plus the inline opacity / padding JS writes.
	if (id === 'frameLit') {
		s.backgroundImage = BOARDFX;
		s.backgroundSize = FRAME_FX.lit.bs;
		s.backgroundPosition = FRAME_FX.lit.bp;
		s.opacity = el.style.opacity || '0.7';
	}
	if (id === 'frameGlint') {
		s.overflow = 'hidden';
		s.paddingTop = el.style.paddingTop || el.style.padding || '0px';
	}
	if (isGlintBand(el)) {
		s.backgroundImage = BOARDFX;
		s.backgroundSize = FRAME_FX.glint.bs;
		s.backgroundPosition = FRAME_FX.glint.bp;
		s.opacity = el.style.opacity || '0';
		if (el.style.transform) s.transform = el.style.transform;
	}

	if (cl.contains('sym')) { s.overflow = 'hidden'; s.zIndex = '1'; s.translate = wildTranslate(el); }
	if (cl.contains('ov')) { s.overflow = 'hidden'; s.zIndex = '2'; }
	if (cl.contains('mx')) {
		s.zIndex = '3';
		s.transformOrigin = el.classList.contains('total') ? '50% 60%' : (el.parentElement?.classList.contains('cell') ? '14% 45%' : '85% 45%');
		if (cl.contains('total')) s.translate = '-50% 0';
	}

	const cell = el.closest('.cell');
	if (cell?.classList.contains('spinning')) s.visibility = 'hidden';
	if (cell?.classList.contains('out')) s.opacity = '0';
	if (cell?.classList.contains('dim')) s.filter = 'brightness(0.48) saturate(0.7)';
	if (cell?.classList.contains('puffed') && (cl.contains('sym') || cl.contains('symGlow') || cl.contains('symSh'))) s.opacity = '0';

	const ov = el.closest('.ov') as HTMLElement | null;
	if (ov && (ov.classList.contains('merge') || (ov.getAttribute('data-reels') || '').includes(',')) && ov.querySelector(':scope > canvas.stk_db')) {
		if (cl.contains('mLets') || (el.tagName === 'CANVAS' && cl.contains('stk_letters'))) s.display = 'none';
	}

	const fr = frameOf(el);
	if (fr) {
		s.backgroundImage = fr.bg;
		s.backgroundSize = fr.bs;
		s.backgroundPosition = fr.bp;
		s.display = 'block';
	}
	return s;
}

/** True when this node is covered by the TypeScript board/symbol layout tables. */
export const isBoardHost = (el: HTMLElement) => layoutStyle(el) != null || layoutBox(el, 0, 0) != null;

/**
 * The declarations the old board stylesheet gave a node itself (before its inline style), as
 * getComputedStyle-style props. Same values the CSS resolver produced; no selector engine.
 */
export function boardRuleProps(el: HTMLElement): Record<string, string> {
	const p: Record<string, string> = {};
	const cl = el.classList, id = el.id, par = el.parentElement;
	const abs = () => { p.position = 'absolute'; };
	const inset0 = () => { p.top = '0'; p.right = '0'; p.bottom = '0'; p.left = '0'; };
	if (id === 'strips' || id === 'cells' || id === 'overlays') { abs(); inset0(); }
	if (id === 'strips') { p['z-index'] = '0'; p['pointer-events'] = 'none'; }
	if (id === 'cells') p['z-index'] = '1';
	if (id === 'overlays') p['z-index'] = '2';
	if (id === 'reelLines') p.display = 'none';
	if (cl.contains('cell')) abs();
	if (cl.contains('sym')) { abs(); inset0(); p['z-index'] = '1'; p.overflow = 'hidden'; }
	if (cl.contains('sym') && cl.contains('art')) { p.top = p.right = p.bottom = p.left = '3.75%'; }
	const rigdKid = cl.contains('rig') && !!par?.classList.contains('sym') && par.classList.contains('rigd');
	const rigdBody = cl.contains('rgBody') && !!el.closest('.sym.rigd');
	const still = cl.contains('rig') && cl.contains('still');
	const stillBody = cl.contains('rgBody') && !!el.closest('.rig.still');
	if (rigdKid || rigdBody || still || stillBody) { abs(); inset0(); p.display = 'block'; p['pointer-events'] = 'none'; }
	if (rigdKid) p['z-index'] = '1';
	if (cl.contains('ov')) { abs(); p.top = '0'; p.height = '100%'; p['z-index'] = '2'; p.overflow = 'hidden'; }
	if (cl.contains('ov') && cl.contains('art')) { p['background-image'] = 'none'; p['clip-path'] = 'inset(-25% 0 -25% 0)'; }
	if (cl.contains('wart')) { abs(); inset0(); }
	if (el.tagName === 'IMG' && par?.classList.contains('wart') && el.closest('.ov')) {
		p.display = 'block'; p.width = '100%'; p.height = '100%'; p['object-fit'] = 'cover'; p['pointer-events'] = 'none';
	}
	// tiles, slot shadows and frames the art replaced (display:none)
	const pc = par?.classList;
	if ((cl.contains('tile') && !!pc && (pc.contains('cell') || pc.contains('cspin') || pc.contains('ov')))
		|| ((cl.contains('tRec') || cl.contains('tBd') || cl.contains('tFr') || cl.contains('wFrame')) && !!pc?.contains('ov'))
		|| cl.contains('tGl') || cl.contains('tGw')
		|| (cl.contains('slT') && !!el.closest('.cspin'))
		|| (cl.contains('symSh') && !!pc?.contains('cell'))) p.display = 'none';
	if (cl.contains('mx')) {
		abs(); p.top = '2px'; p.right = '2px'; p['z-index'] = '3'; p.height = 'max(19.5px,calc(var(--cell)*0.318))';
		p['aspect-ratio'] = '150/60'; p['pointer-events'] = 'none'; p['transform-origin'] = '85% 45%';
		const inOv = !!el.closest('.ov');
		if (pc?.contains('cell') && !cl.contains('stack')) { p.top = 'calc(1px + var(--mxdy,0)*var(--cell))'; p.bottom = 'auto'; p['transform-origin'] = '14% 45%'; p.height = 'max(18px,calc(var(--cell)*0.29))'; }
		if (inOv) p.top = '3px';
		if (inOv && cl.contains('total')) { p.top = 'auto'; p.right = 'auto'; p.left = '50%'; p.bottom = '5px'; p.translate = '-50% 0'; p.height = 'max(17px,calc(var(--cell)*0.22))'; p['transform-origin'] = '50% 60%'; }
		if (inOv && cl.contains('stack')) p.height = 'max(24px,calc(var(--cell)*0.4))';
	}
	if (cl.contains('cell') && cl.contains('spinning')) p.visibility = 'hidden';
	if (cl.contains('cell') && cl.contains('out')) p.opacity = '0';
	if (cl.contains('cell') && cl.contains('dim')) { p.opacity = '1'; p.filter = 'brightness(0.48) saturate(0.7)'; }
	if ((cl.contains('sym') || cl.contains('symGlow') || cl.contains('symSh')) && el.closest('.cell.puffed')) p.opacity = '0';
	if (cl.contains('sym') && pc?.contains('cell')) { const t = wildTranslate(el); if (t !== 'none') p.translate = t; }
	const ov = el.closest('.ov') as HTMLElement | null;
	if (ov && (cl.contains('mLets') || (el.tagName === 'CANVAS' && cl.contains('stk_letters')))
		&& (ov.classList.contains('merge') || (ov.getAttribute('data-reels') || '').includes(','))
		&& [...ov.children].some((k) => k.tagName === 'CANVAS' && k.classList.contains('stk_db'))) p.display = 'none';
	if (el.tagName === 'IMG' && cl.contains('stk_glow') && !!pc?.contains('ov')) {
		abs(); inset0(); p.width = '100%'; p.height = '100%'; p['object-fit'] = 'cover'; p['pointer-events'] = 'none'; p['z-index'] = '0';
	}
	if (cl.contains('sd')) { abs(); p.display = 'block'; p['pointer-events'] = 'none'; }
	return p;
}
