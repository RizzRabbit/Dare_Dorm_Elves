// Plain TypeScript layout and style state for the off-document UI host tree (HUD, menus, toasts,
// banners, overlays). Replaces the old hostcss.ts CSS resolver: a host's style is the board rule
// table (board/hostlayout.ts) under its own inline style, and its box comes from mkPlace /
// syncHostLayout inline geometry or, for the few stand-ins nothing places, the STANDIN table.
import { boardRuleProps } from './board/hostlayout';

/** Design-px boxes for hosts that carry state but no placed geometry (toasts, banners, bars). */
export const STANDIN: Readonly<Record<string, readonly [number, number]>> = {
	fsBar: [240, 32],
	banner: [280, 48],
	stepToast: [260, 44],
	replayBar: [320, 36],
};

export function standIn(el: HTMLElement): readonly [number, number] | null {
	return (el.id && STANDIN[el.id]) || null;
}

const cache = new WeakMap<HTMLElement, { key: string; props: Record<string, string> }>();
function keyOf(el: HTMLElement): string {
	let k = el.tagName + '#' + el.id + '.' + el.className + '|' + (el.getAttribute('style') || '');
	for (let n = el.parentElement; n; n = n.parentElement) k += '>' + n.id + '.' + n.className + (n.getAttribute('data-reels') || '');
	return k;
}

/** Style props for a host: board rules, then inline declarations on top. */
export function hostProps(el: HTMLElement): Record<string, string> {
	const key = keyOf(el), hit = cache.get(el);
	if (hit && hit.key === key) return hit.props;
	const p = boardRuleProps(el);
	const st = el.style;
	for (let i = 0; i < st.length; i++) { const k = st.item(i), v = st.getPropertyValue(k); if (v) p[k] = v; }
	if (st.inset) { const q = st.inset.trim().split(/\s+/); const t = q[0], r = q[1] ?? t, b = q[2] ?? t, l = q[3] ?? r; p.top ??= t; p.right ??= r; p.bottom ??= b; p.left ??= l; }
	cache.set(el, { key, props: p });
	return p;
}

function varOf(el: HTMLElement, name: string): string {
	for (let n: HTMLElement | null = el; n; n = n.parentElement) { const v = n.style.getPropertyValue(name); if (v) return v.trim(); }
	return document.documentElement.style.getPropertyValue(name).trim();
}

function splitTop(s: string, sep: string): string[] {
	const out: string[] = []; let d = 0, cur = '';
	for (const ch of s) { if (ch === '(') d++; else if (ch === ')') d--; if (ch === sep && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch; }
	if (cur.trim()) out.push(cur.trim());
	return out;
}

/** Length in px: px / % / em numbers, var(), and calc/max/min with + - * / (no eval). */
export function lenPx(raw: string, base: number, el?: HTMLElement): number {
	if (!raw) return 0;
	let s = raw.trim();
	if (s === 'auto' || s === 'none') return 0;
	s = s.replace(/var\((--[\w-]+)(?:\s*,\s*([^)]+))?\)/g, (_m, n: string, fb?: string) => (el && varOf(el, n)) || fb || '0');
	const term = (t: string): number => {
		t = t.trim();
		const fn = /^(calc|max|min)?\((.*)\)$/.exec(t);
		if (fn) {
			if (fn[1] === 'max') return Math.max(...splitTop(fn[2], ',').map(term));
			if (fn[1] === 'min') return Math.min(...splitTop(fn[2], ',').map(term));
			return expr(fn[2]);
		}
		if (t.endsWith('%')) return (parseFloat(t) / 100) * base;
		const n = parseFloat(t);
		return Number.isFinite(n) ? n : 0;
	};
	// + and - at depth 0 (with spaces, as calc() requires), then * and /
	const expr = (e: string): number => {
		const parts: string[] = []; const ops: string[] = []; let d = 0, cur = '';
		for (let i = 0; i < e.length; i++) {
			const ch = e[i];
			if (ch === '(') d++; else if (ch === ')') d--;
			if (d === 0 && (ch === '+' || ch === '-') && e[i - 1] === ' ' && e[i + 1] === ' ') { parts.push(cur); ops.push(ch); cur = ''; continue; }
			cur += ch;
		}
		parts.push(cur);
		const prod = (p: string): number => {
			const fs: string[] = []; const os: string[] = []; let dd = 0, c = '';
			for (const ch of p) { if (ch === '(') dd++; else if (ch === ')') dd--; if (dd === 0 && (ch === '*' || ch === '/')) { fs.push(c); os.push(ch); c = ''; } else c += ch; }
			fs.push(c);
			let v = term(fs[0]);
			for (let i = 0; i < os.length; i++) { const x = term(fs[i + 1]); v = os[i] === '*' ? v * x : (x ? v / x : 0); }
			return v;
		};
		let v = prod(parts[0]);
		for (let i = 0; i < ops.length; i++) v = ops[i] === '+' ? v + prod(parts[i + 1]) : v - prod(parts[i + 1]);
		return Number.isFinite(v) ? v : 0;
	};
	return term(s);
}

/** Box size from a host's own declarations (inline width/height are read by the caller first). */
export function hostSize(el: HTMLElement, dim: 'w' | 'h', parentW: number, parentH: number): number {
	const p = hostProps(el);
	if ((p.display || '') === 'none') return 0;
	if (dim === 'w') {
		if (p.width && p.width !== 'auto') return lenPx(p.width, parentW, el);
		const L = p.left ? lenPx(p.left, parentW, el) : 0, R = p.right ? lenPx(p.right, parentW, el) : 0;
		if (p.left || p.right || p.top || p.bottom) return Math.max(0, parentW - L - R);
		return 0;
	}
	if (p.height && p.height !== 'auto') return lenPx(p.height, parentH, el);
	const T = p.top ? lenPx(p.top, parentH, el) : 0, B = p.bottom ? lenPx(p.bottom, parentH, el) : 0;
	if (p.left || p.right || p.top || p.bottom) return Math.max(0, parentH - T - B);
	return 0;
}

export function hostOffset(el: HTMLElement, dim: 'x' | 'y', parentW: number, parentH: number): number {
	const p = hostProps(el);
	if (dim === 'x') return p.left ? lenPx(p.left, parentW, el) : 0;
	return p.top ? lenPx(p.top, parentH, el) : 0;
}

function absUrl(v: string): string {
	return v.replace(/url\((['"]?)([^'")]+)\1\)/g, (_m, _q, u: string) => {
		if (/^(data:|https?:|blob:|\/)/.test(u)) return `url("${u}")`;
		try { return `url("${new URL(u, location.href).href}")`; } catch { return `url("${u}")`; }
	});
}

const DEFAULTS: Record<string, string> = {
	opacity: '1', visibility: 'visible', display: 'block', transform: 'none', translate: 'none', rotate: 'none', scale: 'none',
	filter: 'none', transformOrigin: '50% 50%', overflow: 'visible', mixBlendMode: 'normal',
};

/** getComputedStyle for a detached host: its props over the browser's (detached) answer, with sane defaults. */
export function hostStyle(el: HTMLElement, fallback: CSSStyleDeclaration): CSSStyleDeclaration {
	const p = hostProps(el);
	const get = (k: string) => {
		const css = k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
		let v = p[css] ?? p[k];
		if (v == null || v === '') return null;
		if (css === 'background-image') v = absUrl(v);
		return v;
	};
	return new Proxy(fallback, {
		get(t, prop) {
			if (prop === 'getPropertyValue') return (name: string) => get(String(name)) ?? get(String(name).replace(/-([a-z])/g, (_m, c) => c.toUpperCase())) ?? t.getPropertyValue(name);
			if (typeof prop !== 'string') return (t as any)[prop];
			const v = get(prop);
			if (v != null && v !== '') return v;
			if (prop in DEFAULTS) return DEFAULTS[prop];
			return (t as any)[prop];
		},
	}) as CSSStyleDeclaration;
}
