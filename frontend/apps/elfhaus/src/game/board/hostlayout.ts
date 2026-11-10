// Plain TypeScript layout and paint state for the off-document board host tree.
// Board, cells, symbols, rigs, overlays and multiplier badges no longer need
// the CSS resolver in hostcss.ts. Other UI hosts still fall back to hostcss.
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
};

const HIDDEN = new Set(['tile', 'tRec', 'tBd', 'tFr', 'tGl', 'tGw', 'slT', 'symSh', 'wFrame']);
const FILL_IDS = new Set(['frame', 'board', 'strips', 'cells', 'overlays', 'flyLayer']);

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
};

/** Paint flags for a board-tree node. null = not a board/symbol rule. */
export function layoutStyle(el: HTMLElement): HostStyle | null {
	const cl = el.classList;
	const id = el.id;
	if (id === 'reelLines' || [...cl].some((c) => HIDDEN.has(c))) {
		return { ...BASE_STYLE, display: 'none' };
	}
	const boardish = FILL_IDS.has(id) || cl.contains('cell') || cl.contains('sym') || cl.contains('rig') || cl.contains('rgBody')
		|| cl.contains('rp') || cl.contains('sd') || cl.contains('ov') || cl.contains('wart') || cl.contains('mx')
		|| cl.contains('symGlow') || cl.contains('stkElf') || cl.contains('stkGrp') || el.tagName === 'IMG' && cl.contains('stk_glow')
		|| cl.contains('antGlow') || cl.contains('cspin') || cl.contains('rgSh') || cl.contains('rgSp') || cl.contains('rgShine');
	if (!boardish) return null;

	const s: HostStyle = { ...BASE_STYLE };
	if (cl.contains('rgShine') || cl.contains('wFrame')) s.display = 'none';

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
