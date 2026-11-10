// Apply symbol-frame and board-model CSS to the detached UI host tree.
// Stylesheets do not match off-document nodes, so the board mirror's
// getComputedStyle / offset* reads would otherwise see empty boxes and
// no background-image (blank reels). This resolver keeps the motion
// model off-document and still supplies the same geometry the CSS had.
import symrigCss from '../../static/symrig.css?raw';
import symdepthCss from '../../static/symdepth.css?raw';

const LAYOUT_CSS = `
#strips,#cells,#overlays{position:absolute;inset:0}
#strips{z-index:0;pointer-events:none}
#cells{z-index:1}
#overlays{z-index:2}
#reelLines{display:none}
.cell{position:absolute}
.sym{position:absolute;inset:0;z-index:1;overflow:hidden}
.sym.art{inset:3.75%}
.sym.rigd>.rig,.sym.rigd .rgBody,.rig.still,.rig.still .rgBody{position:absolute;inset:0;display:block;pointer-events:none}
.sym.rigd>.rig{z-index:1}
.ov{position:absolute;top:0;height:100%;z-index:2;overflow:hidden}
.ov.art{background:none;clip-path:inset(-25% 0 -25% 0)}
.wart{position:absolute;inset:0}
.ov .wart img{display:block;width:100%;height:100%;object-fit:cover;pointer-events:none}
html body :is(.cell,.cspin,.ov)>.tile,
html body .ov>.tRec,html body .ov>.tBd,html body .ov>.tFr,
html body .tGl,html body .tGw,
html body .cspin .slT,
html body .cell>.symSh,
html body .ov>.wFrame{display:none}
.mx{position:absolute;top:2px;right:2px;z-index:3;height:max(19.5px,calc(var(--cell)*0.318));aspect-ratio:150/60;pointer-events:none;transform-origin:85% 45%}
html body .cell > .mx:not(.stack){top:calc(1px + var(--mxdy,0)*var(--cell));bottom:auto;transform-origin:14% 45%;height:max(18px,calc(var(--cell)*0.29))}
.ov .mx{top:3px}
.ov .mx.total{top:auto;right:auto;left:50%;bottom:5px;translate:-50% 0;height:max(17px,calc(var(--cell)*0.22));transform-origin:50% 60%}
.ov .mx.stack{height:max(24px,calc(var(--cell)*0.4))}
.cell.spinning{visibility:hidden}
.cell.out{opacity:0}
.cell.dim{opacity:1;filter:brightness(0.62) saturate(0.85)}
html body .cell.dim{opacity:1;filter:brightness(0.48) saturate(0.7)}
.cell.puffed .sym,.cell.puffed .symGlow,.cell.puffed .symSh{opacity:0}
html body .cell:has(.rig.k_W_R1)>.sym{translate:2.42% -2.27%}
html body .cell:has(.rig.k_W_R2)>.sym{translate:-0.70% -2.27%}
html body .cell:has(.rig.k_W_R3)>.sym{translate:0.00% -2.27%}
html body .cell:has(.rig.k_W_R4)>.sym{translate:0.86% -2.27%}
html body .cell:has(.rig.k_W_R5)>.sym{translate:0.70% -2.27%}
html body .ov:is(.merge,[data-reels*=","]):has(>canvas.stk_db) :is(.mLets,canvas.stk_letters){display:none}
html body .ov>img.stk_glow{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;z-index:0}
.sd{position:absolute;display:block;pointer-events:none}
`;

type Decl = { props: Record<string, string>; important: Set<string> };
type Compound = {
	tag: string | null;
	id: string | null;
	classes: string[];
	not: Compound[];
	has: { rel: ' ' | '>' | null; c: Compound }[];
	attrs: { name: string; op: string; val: string }[];
	is: Compound[][];
	pseudo: string[];
};
type Part = { combinator: ' ' | '>' | ''; c: Compound };
type Rule = { parts: Part[]; decl: Decl; spec: number; ord: number };

const VIRTUAL = new Set(['html', 'body', 'app', 'root', 'stage']);

let rules: Rule[] = [];
let parsed = false;
let ord = 0;
const cache = new WeakMap<Element, { key: string; props: Record<string, string> }>();

function compileCompound(s: string): Compound {
	const c: Compound = { tag: null, id: null, classes: [], not: [], has: [], attrs: [], is: [], pseudo: [] };
	const re = /([.#:]?[\w-]+(?:\([^)]*\))?|\[[^\]]+\])/g;
	let m: RegExpExecArray | null;
	const bits: string[] = [];
	while ((m = re.exec(s))) bits.push(m[1]);
	if (!bits.length && s) bits.push(s);
	for (const b of bits) {
		if (b.startsWith('.')) c.classes.push(b.slice(1));
		else if (b.startsWith('#')) c.id = b.slice(1);
		else if (b.startsWith('[')) {
			const am = /^\[([^\s=~|^$*\]]+)([~|^$*]?=)?"?([^"\]]*)"?\]$/.exec(b);
			if (am) c.attrs.push({ name: am[1], op: am[2] || '', val: am[3] || '' });
		} else if (b.startsWith(':not(')) c.not.push(compileCompound(b.slice(5, -1)));
		else if (b.startsWith(':has(')) {
			const inner = b.slice(5, -1).trim();
			const rel: ' ' | '>' | null = inner.startsWith('>') ? '>' : null;
			const rest = rel ? inner.slice(1).trim() : inner;
			c.has.push({ rel, c: compileCompound(rest) });
		} else if (b.startsWith(':is(')) {
			c.is.push(b.slice(4, -1).split(',').map((x) => compileCompound(x.trim())));
		} else if (b.startsWith(':')) c.pseudo.push(b);
		else c.tag = b.toLowerCase();
	}
	return c;
}

function compileSelector(sel: string): Part[] | null {
	const parts: Part[] = [];
	const tok = sel.trim().replace(/\s*>\s*/g, ' > ').replace(/\s+/g, ' ').split(' ');
	let comb: ' ' | '>' | '' = '';
	for (const t of tok) {
		if (t === '>') { comb = '>'; continue; }
		if (!t) continue;
		if (t.includes('::')) return null; // skip pseudo-elements
		parts.push({ combinator: comb, c: compileCompound(t) });
		comb = ' ';
	}
	return parts.length ? parts : null;
}

function specOf(parts: Part[]): number {
	let a = 0, b = 0, c = 0;
	const add = (x: Compound) => {
		if (x.id) a++;
		b += x.classes.length + x.attrs.length + x.not.length + x.has.length + x.is.length + x.pseudo.length;
		if (x.tag && x.tag !== '*') c++;
		x.not.forEach(add);
		x.has.forEach((h) => add(h.c));
		x.is.forEach((g) => g.forEach(add));
	};
	parts.forEach((p) => add(p.c));
	return a * 10000 + b * 100 + c;
}


function splitSelectors(sel: string): string[] {
	const out: string[] = [];
	let d = 0, sq = 0, cur = '';
	for (const ch of sel) {
		if (ch === '(') d++;
		else if (ch === ')') d = Math.max(0, d - 1);
		else if (ch === '[') sq++;
		else if (ch === ']') sq = Math.max(0, sq - 1);
		if (ch === ',' && d === 0 && sq === 0) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
		cur += ch;
	}
	if (cur.trim()) out.push(cur.trim());
	return out;
}
function parseSheet(text: string) {
	// drop comments, @font-face, @keyframes, @media blocks (none of the
	// symbol-frame rules are wrapped; reduced-motion is a no-op here)
	text = text.replace(/\/\*[\s\S]*?\*\//g, '');
	text = text.replace(/@(?:media|keyframes|font-face|supports)[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/gi, '');
	const re = /([^{}]+)\{([^{}]+)\}/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(text))) {
		const sel = m[1].trim();
		if (!sel || sel.startsWith('@')) continue;
		const decl: Decl = { props: {}, important: new Set() };
		for (const raw of m[2].split(';')) {
			const i = raw.indexOf(':');
			if (i < 0) continue;
			let k = raw.slice(0, i).trim();
			let v = raw.slice(i + 1).trim();
			if (!k) continue;
			const imp = /\s*!important\s*$/i.test(v);
			if (imp) { v = v.replace(/\s*!important\s*$/i, '').trim(); decl.important.add(k); }
			if (k === 'background' && v.includes('url(')) {
				const u = /url\(([^)]+)\)/.exec(v);
				if (u) decl.props['background-image'] = `url(${u[1].trim()})`;
				if (/\bno-repeat\b/.test(v)) decl.props['background-repeat'] = 'no-repeat';
				continue;
			}
			if (k === 'inset') {
				const p = v.trim().split(/\s+/);
				const t = p[0], r = p[1] ?? t, b = p[2] ?? t, l = p[3] ?? r;
				decl.props.top = t; decl.props.right = r; decl.props.bottom = b; decl.props.left = l;
				if (imp) { for (const x of ['top', 'right', 'bottom', 'left']) decl.important.add(x); }
				continue;
			}
			decl.props[k] = v;
		}
		for (const s of splitSelectors(sel)) {
			const parts = compileSelector(s.trim());
			if (!parts) continue;
			rules.push({ parts, decl, spec: specOf(parts), ord: ord++ });
		}
	}
}

function virt(idOrTag: string): Element | null {
	if (idOrTag === 'html') return document.documentElement;
	if (idOrTag === 'body') return document.body;
	if (idOrTag === 'app' || idOrTag === 'root' || idOrTag === 'stage')
		return Document.prototype.getElementById.call(document, idOrTag);
	return null;
}

function matchCompound(el: Element, c: Compound): boolean {
	if (c.tag && c.tag !== '*') {
		const tag = el.tagName.toLowerCase();
		if (tag !== c.tag) {
			// virtual document shells may stand in for html/body
			if (!(c.tag === 'html' && tag === 'html') && !(c.tag === 'body' && tag === 'body')) return false;
		}
	}
	if (c.id && el.id !== c.id) return false;
	if (c.classes.length) {
		const cl = (el as HTMLElement).classList;
		for (const x of c.classes) if (!cl.contains(x)) return false;
	}
	for (const n of c.not) if (matchCompound(el, n)) return false;
	for (const a of c.attrs) {
		const got = el.getAttribute(a.name);
		if (a.op === '') { if (got == null) return false; }
		else if (a.op === '=') { if (got !== a.val) return false; }
		else if (a.op === '*=') { if (!got || !got.includes(a.val)) return false; }
		else if (got == null) return false;
	}
	for (const group of c.is) if (!group.some((g) => matchCompound(el, g))) return false;
	for (const h of c.has) {
		let ok = false;
		if (h.rel === '>') {
			for (const k of el.children) if (matchCompound(k, h.c)) { ok = true; break; }
		} else {
			for (const k of el.querySelectorAll('*')) if (matchCompound(k, h.c)) { ok = true; break; }
		}
		if (!ok) return false;
	}
	// :nth-child and similar are not required for symbol frames
	for (const p of c.pseudo) {
		if (p.startsWith(':nth-') || p === ':hover' || p === ':active' || p === ':focus') return false;
	}
	return true;
}

function climb(start: Element | null): Element[] {
	const out: Element[] = [];
	let n: Element | null = start;
	while (n) { out.push(n); n = n.parentElement; }
	// virtual ancestors so `body.mk #app #frame` still matches the host tree
	for (const id of ['stage', 'app', 'root']) {
		const v = virt(id);
		if (v) out.push(v);
	}
	out.push(document.body, document.documentElement);
	return out;
}

function matchParts(el: Element, parts: Part[]): boolean {
	const last = parts[parts.length - 1];
	if (!matchCompound(el, last.c)) return false;
	let cur: Element | null = el;
	for (let i = parts.length - 2; i >= 0; i--) {
		const p = parts[i];
		const chain = climb(cur);
		// skip cur itself
		let found: Element | null = null;
		const start = 1;
		if (p.combinator === '>') {
			const parent = cur.parentElement || virtParent(cur);
			if (parent && matchCompound(parent, p.c)) found = parent;
		} else {
			for (let j = start; j < chain.length; j++) {
				if (matchCompound(chain[j], p.c)) { found = chain[j]; break; }
			}
		}
		if (!found) return false;
		cur = found;
	}
	return true;
}

function virtParent(el: Element): Element | null {
	if (el.parentElement) return el.parentElement;
	return virt('stage');
}

function ensure() {
	if (parsed) return;
	parsed = true;
	parseSheet(LAYOUT_CSS);
	parseSheet(symrigCss);
	parseSheet(symdepthCss);
	rules.sort((a, b) => a.spec - b.spec || a.ord - b.ord);
}

function cacheKey(el: Element): string {
	const b = document.body.className;
	let k = b + '|' + el.tagName + '#' + el.id + '.' + (el as HTMLElement).className;
	let n: Element | null = el;
	while (n) { k += '>' + n.id + '.' + (n as HTMLElement).className + (n.getAttribute?.('data-reels') || ''); n = n.parentElement; }
	return k;
}

function resolveProps(el: HTMLElement): Record<string, string> {
	ensure();
	const key = cacheKey(el);
	const hit = cache.get(el);
	if (hit && hit.key === key) return hit.props;
	const acc: Record<string, string> = {};
	const imp = new Set<string>();
	for (const r of rules) {
		if (!matchParts(el, r.parts)) continue;
		for (const [k, v] of Object.entries(r.decl.props)) {
			if (imp.has(k) && !r.decl.important.has(k)) continue;
			acc[k] = v;
			if (r.decl.important.has(k)) imp.add(k);
		}
	}
	// inline styles win over non-important rules
	const st = el.style;
	if (st) {
		for (let i = 0; i < st.length; i++) {
			const k = st.item(i);
			if (imp.has(k)) continue;
			const v = st.getPropertyValue(k);
			if (v) acc[k] = v;
		}
	}
	cache.set(el, { key, props: acc });
	return acc;
}

function varOf(el: HTMLElement, name: string): string {
	let n: HTMLElement | null = el;
	while (n) {
		const v = n.style.getPropertyValue(name) || n.style.getPropertyValue(name.startsWith('--') ? name : '--' + name);
		if (v) return v.trim();
		n = n.parentElement;
	}
	try {
		const v = document.documentElement.style.getPropertyValue(name);
		if (v) return v.trim();
	} catch { /* */ }
	return '';
}

function len(raw: string, base: number, el?: HTMLElement): number {
	if (!raw) return 0;
	let s = raw.trim();
	if (s === 'auto' || s === 'none') return 0;
	if (s.includes('var(')) {
		s = s.replace(/var\((--[\w-]+)(?:\s*,\s*([^)]+))?\)/g, (_, n, fb) => {
			const v = (el && varOf(el, n)) || fb || '0';
			return v;
		});
	}
	const evalCalc = (expr: string): number => {
		expr = expr.replace(/max\(([^)]+)\)/g, (_m, inner: string) => {
			const parts = splitComma(inner).map((p) => evalCalc(p));
			return String(Math.max(...parts));
		});
		expr = expr.replace(/min\(([^)]+)\)/g, (_m, inner: string) => {
			const parts = splitComma(inner).map((p) => evalCalc(p));
			return String(Math.min(...parts));
		});
		expr = expr.replace(/([\d.]+)%/g, (_m, n) => String((parseFloat(n) / 100) * base));
		expr = expr.replace(/([\d.]+)px/g, (_m, n) => n);
		expr = expr.replace(/([\d.]+)em/g, (_m, n) => n);
		// leftover identifiers
		if (/[a-zA-Z]/.test(expr)) return 0;
		try {
			const v = Function(`"use strict";return (${expr})`)();
			return Number.isFinite(v) ? Number(v) : 0;
		} catch { return 0; }
	};
	if (s.startsWith('calc(') || s.startsWith('max(') || s.startsWith('min(')) return evalCalc(s);
	if (s.endsWith('%')) return (parseFloat(s) / 100) * base;
	return parseFloat(s) || 0;
}

function splitComma(s: string): string[] {
	const out: string[] = [];
	let d = 0, cur = '';
	for (const ch of s) {
		if (ch === '(') d++;
		if (ch === ')') d--;
		if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; continue; }
		cur += ch;
	}
	if (cur.trim()) out.push(cur.trim());
	return out;
}

function absUrl(v: string): string {
	return v.replace(/url\((['"]?)([^'")]+)\1\)/g, (_m, _q, u: string) => {
		if (/^(data:|https?:|blob:|\/)/.test(u)) return `url("${u}")`;
		try { return `url("${new URL(u, location.href).href}")`; } catch { return `url("${u}")`; }
	});
}

export function hostProps(el: HTMLElement): Record<string, string> {
	return resolveProps(el);
}

export function hostLen(el: HTMLElement, prop: string, base: number): number {
	const v = resolveProps(el)[prop];
	return v ? len(v, base, el) : 0;
}

/** CSS box size for a host node (inline width/height already handled by the caller). */
export function hostCssSize(el: HTMLElement, dim: 'w' | 'h', parentW: number, parentH: number): number {
	const p = resolveProps(el);
	if ((p.display || '') === 'none') return 0;
	if (dim === 'w') {
		if (p.width && p.width !== 'auto') return len(p.width, parentW, el);
		const L = p.left ? len(p.left, parentW, el) : 0;
		const R = p.right ? len(p.right, parentW, el) : 0;
		if (p.left != null && p.right != null && !p.width) return Math.max(0, parentW - L - R);
		if (p.left || p.right || p.top || p.bottom) return Math.max(0, parentW - L - R);
		return 0;
	}
	if (p.height && p.height !== 'auto') return len(p.height, parentH, el);
	const T = p.top ? len(p.top, parentH, el) : 0;
	const B = p.bottom ? len(p.bottom, parentH, el) : 0;
	if ((p.top != null && p.bottom != null && !p.height) || p.left || p.right || p.top || p.bottom)
		return Math.max(0, parentH - T - B);
	return 0;
}

export function hostCssOffset(el: HTMLElement, dim: 'x' | 'y', parentW: number, parentH: number): number {
	const p = resolveProps(el);
	if (dim === 'x') return p.left ? len(p.left, parentW, el) : 0;
	return p.top ? len(p.top, parentH, el) : 0;
}

const CS_MAP: Record<string, string> = {
	backgroundImage: 'background-image',
	backgroundSize: 'background-size',
	backgroundPosition: 'background-position',
	backgroundRepeat: 'background-repeat',
	borderImageWidth: 'border-image-width',
	borderTopWidth: 'border-top-width',
	transformOrigin: 'transform-origin',
	mixBlendMode: 'mix-blend-mode',
	objectFit: 'object-fit',
	clipPath: 'clip-path',
	zIndex: 'z-index',
	paddingTop: 'padding-top',
};

export function hostComputedStyle(el: HTMLElement, fallback: CSSStyleDeclaration): CSSStyleDeclaration {
	const p = resolveProps(el);
	const get = (k: string) => {
		const css = CS_MAP[k] || k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
		let v = p[css] ?? p[k];
		if (v == null || v === '') return null;
		if (css === 'background-image') v = absUrl(v);
		return v;
	};
	return new Proxy(fallback, {
		get(t, prop) {
			if (prop === 'getPropertyValue') {
				return (name: string) => {
					const v = get(String(name)) ?? get(String(name).replace(/-([a-z])/g, (_m, c) => c.toUpperCase()));
					return v ?? t.getPropertyValue(name);
				};
			}
			if (typeof prop !== 'string') return (t as any)[prop];
			const v = get(prop);
			if (v != null && v !== '') return v;
			if (prop === 'opacity') return '1';
			if (prop === 'visibility') return 'visible';
			if (prop === 'display') return 'block';
			if (prop === 'transform' || prop === 'translate' || prop === 'rotate' || prop === 'scale' || prop === 'filter') return 'none';
			if (prop === 'transformOrigin') return '50% 50%';
			if (prop === 'overflow') return 'visible';
			if (prop === 'mixBlendMode') return 'normal';
			return (t as any)[prop];
		},
	}) as CSSStyleDeclaration;
}

