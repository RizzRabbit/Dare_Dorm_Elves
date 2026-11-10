// Pixi rules / paytable / paylines. Wording is taken verbatim from buildRules()
// HTML (including the social branches). Tables and the 20 line mini-grids are
// redrawn in Pixi. The body lives in a masked scroll window (wheel + touch-drag).
import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { LINES } from '../config';
import { paintTextCanvas } from '../skin';
import { kickUi } from './stage';
import { bmFit } from './text';

type Box = { x: number; y: number; w: number; h: number };

function blockText(el: HTMLElement) {
	let s = '';
	const walk = (n: Node) => {
		if (n.nodeType === 3) s += n.textContent || '';
		else if (n instanceof HTMLElement) {
			if (n.tagName === 'BR') s += '\n';
			else for (const c of n.childNodes) walk(c);
		}
	};
	walk(el);
	return s.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();
}

function textSpr(text: string, font: string, px: number, wrapW: number, align: 'left' | 'center' = 'left') {
	const painted = paintTextCanvas(text, font, px, wrapW, align, 1.28, 2);
	if (!painted) {
		const fallback = bmFit(text, font, px, wrapW, px * 2, align === 'center' ? 'center' : 'left');
		return fallback;
	}
	const tex = Texture.from(painted.cv);
	const s = new Sprite(tex);
	s.eventMode = 'none';
	s.width = painted.w;
	s.height = painted.h;
	return s;
}

function drop(s: Sprite | Container | null) {
	if (!s) return;
	if (s.parent) s.parent.removeChild(s);
	if (s instanceof Sprite && s.texture && s.texture !== Texture.EMPTY) {
		try { s.destroy({ texture: true, textureSource: true }); } catch { try { s.destroy(); } catch { /* */ } }
	} else {
		try { s.destroy({ children: true }); } catch { /* */ }
	}
}

function addText(parent: Container, text: string, font: string, px: number, x: number, y: number, wrapW: number, align: 'left' | 'center' = 'left') {
	if (!text) return 0;
	const s = textSpr(text, font, px, wrapW, align);
	if (!s) return 0;
	s.position.set(x, y);
	parent.addChild(s);
	return s.height;
}

function paintTable(parent: Container, table: HTMLTableElement, x: number, y: number, W: number) {
	const rows = Array.from(table.rows);
	if (!rows.length) return 0;
	const cols = Math.max(...rows.map((r) => r.cells.length), 1);
	const pad = 6;
	const rowH = 28;
	const widths: number[] = new Array(cols).fill(0);
	// first column a bit wider for symbol names
	widths[0] = Math.min(W * 0.42, 140);
	const rest = (W - widths[0]) / Math.max(1, cols - 1);
	for (let i = 1; i < cols; i++) widths[i] = rest;
	let yy = y;
	rows.forEach((row, ri) => {
		let xx = x;
		const isHead = ri === 0 || row.cells[0]?.tagName === 'TH' || !!row.querySelector('th');
		const bg = new Graphics();
		if (ri % 2 === 1) bg.rect(x, yy, W, rowH).fill({ color: 0x3a2a1a, alpha: 0.10 });
		else bg.rect(x, yy, W, rowH).fill({ color: 0x3a2a1a, alpha: 0.04 });
		bg.eventMode = 'none';
		parent.addChild(bg);
		for (let ci = 0; ci < cols; ci++) {
			const cell = row.cells[ci];
			const cw = widths[ci] ?? rest;
			if (cell) {
				const img = cell.querySelector('img') as HTMLImageElement | null;
				if (img?.src) {
					try {
						const sp = new Sprite(Texture.from(img.src));
						sp.eventMode = 'none';
						const k = Math.min((cw * 0.28) / Math.max(1, sp.texture.width), (rowH - 4) / Math.max(1, sp.texture.height));
						sp.scale.set(k);
						sp.position.set(xx + 2, yy + (rowH - sp.height) / 2);
						parent.addChild(sp);
					} catch { /* */ }
				}
				const label = (cell.textContent || '').trim();
				if (label) {
					const padL = img?.src ? cw * 0.32 : pad;
					const s = textSpr(label, isHead ? 'font_ink' : 'font_ink', isHead ? 12 : 13, Math.max(20, cw - padL - pad), ci === 0 ? 'left' : 'center');
					if (s) {
						s.position.set(xx + padL, yy + (rowH - s.height) / 2);
						parent.addChild(s);
					}
				}
			}
			xx += cw;
		}
		yy += rowH;
	});
	const rule = new Graphics();
	rule.rect(x, y, W, 1).fill({ color: 0x3a2a1a, alpha: 0.25 });
	rule.rect(x, yy, W, 1).fill({ color: 0x3a2a1a, alpha: 0.25 });
	rule.eventMode = 'none';
	parent.addChild(rule);
	return yy - y + 4;
}

function paintPaylines(parent: Container, x: number, y: number, W: number) {
	const C = 10, G = 2, W5 = 5 * C + 4 * G, H4 = 4 * C + 3 * G;
	const capH = 14, cellW = W5 + 16, cellH = H4 + capH + 10;
	const cols = Math.max(1, Math.floor((W + 8) / (cellW + 8)));
	LINES.forEach((ln, i) => {
		const col = i % cols, row = Math.floor(i / cols);
		const ox = x + col * (cellW + 8), oy = y + row * (cellH + 6);
		const cap = textSpr(String(i + 1), 'font_ink', 11, 24, 'center');
		if (cap) { cap.position.set(ox + (W5 - cap.width) / 2, oy); parent.addChild(cap); }
		const g = new Graphics();
		for (let j = 0; j < 20; j++) {
			const r = j % 5, rowI = Math.floor(j / 5), on = ln[r] === rowI;
			g.roundRect(ox + r * (C + G), oy + capH + rowI * (C + G), C, C, 2.5);
			g.fill(on ? 0xc45a2a : 0xd9cbb6);
			if (on) { g.roundRect(ox + r * (C + G), oy + capH + rowI * (C + G), C, C, 2.5); g.stroke({ color: 0x5a2410, width: 1 }); }
		}
		g.setStrokeStyle({ width: 2, color: 0x7a2e14, cap: 'round', join: 'round' });
		g.moveTo(ox + 0 * (C + G) + C / 2, oy + capH + ln[0] * (C + G) + C / 2);
		for (let r = 1; r < ln.length; r++) g.lineTo(ox + r * (C + G) + C / 2, oy + capH + ln[r] * (C + G) + C / 2);
		g.stroke();
		g.eventMode = 'none';
		parent.addChild(g);
	});
	const rows = Math.ceil(LINES.length / cols);
	return rows * (cellH + 6);
}

export function fillRules(html: string, width: number) {
	const root = new Container();
	root.eventMode = 'none';
	const host = document.createElement('div');
	host.innerHTML = html;
	let y = 0;
	const inner = Math.max(80, width);
	for (const node of Array.from(host.children) as HTMLElement[]) {
		const tag = node.tagName;
		if (tag === 'H3') {
			y += 8;
			y += addText(root, blockText(node), 'font_gold', 18, 0, y, inner) + 8;
		} else if (tag === 'P') {
			const cls = node.className || '';
			const px = cls.includes('disc') ? 12 : 14;
			y += addText(root, blockText(node), 'font_ink', px, 0, y, inner) + 10;
		} else if (tag === 'TABLE') {
			y += paintTable(root, node as HTMLTableElement, 0, y, inner) + 10;
		} else if (tag === 'DIV' && node.classList.contains('plGrid')) {
			y += paintPaylines(root, 0, y, inner) + 10;
		} else {
			y += addText(root, blockText(node), 'font_ink', 14, 0, y, inner) + 10;
		}
	}
	(root as any)._h = y;
	return root;
}

export type RulesScroll = Container & {
	layout: (w: number, h: number) => void;
	setHtml: (html: string) => void;
};

export function makeRulesScroll(): RulesScroll {
	const root = new Container();
	root.eventMode = 'static';
	root.cursor = 'grab';
	const clip = new Container();
	const mask = new Graphics();
	const content = new Container();
	content.eventMode = 'none';
	clip.addChild(content);
	clip.mask = mask;
	root.addChild(mask, clip);
	let W = 200, H = 200, html = '', scroll = 0, drag = false, lastY = 0, lastHtml = '', lastW = 0;

	const maxScroll = () => Math.max(0, ((content as any)._h || content.height) - H);

	const apply = () => {
		scroll = Math.max(0, Math.min(maxScroll(), scroll));
		content.y = -scroll;
		kickUi();
	};

	const rebuild = () => {
		content.removeChildren().forEach((c) => drop(c as any));
		if (!html) { (content as any)._h = 0; return; }
		const built = fillRules(html, W);
		for (const ch of built.children.slice()) content.addChild(ch);
		(content as any)._h = (built as any)._h || 0;
	};

	const layout = (w: number, h: number) => {
		W = Math.max(40, w); H = Math.max(40, h);
		mask.clear();
		mask.rect(0, 0, W, H).fill(0xffffff);
		clip.position.set(0, 0);
		root.hitArea = new Rectangle(0, 0, W, H);
		if (html && (html !== lastHtml || Math.abs(W - lastW) > 2)) {
			rebuild();
			lastHtml = html; lastW = W;
		}
		apply();
	};

	const setHtml = (src: string) => {
		if (src === html) return;
		html = src;
		lastHtml = '';
		layout(W, H);
	};

	root.on('pointerdown', (e) => { drag = true; lastY = e.global.y; root.cursor = 'grabbing'; e.stopPropagation(); });
	root.on('pointermove', (e) => {
		if (!drag) return;
		scroll -= (e.global.y - lastY);
		lastY = e.global.y;
		apply();
		e.stopPropagation();
	});
	const end = (e: { stopPropagation: () => void }) => { if (drag) { drag = false; root.cursor = 'grab'; e.stopPropagation(); } };
	root.on('pointerup', end);
	root.on('pointerupoutside', end);
	root.on('pointercancel', end);
	root.on('wheel', (e: any) => {
		const dy = e.deltaY ?? e.nativeEvent?.deltaY ?? 0;
		scroll += dy;
		apply();
		e.stopPropagation?.();
	});

	return Object.assign(root, { layout, setHtml });
}
