// Façade over the single layout pass in layout.ts. ST stays the published
// stage object for existing callers; values come from layoutPass() only.
// See docs/layout-architecture.md.
import { layoutPass, layoutKind, isPortraitKind, capResolution, DPR_CAP, DESIGNS, getLayout, type LayoutKind, type Layout } from './layout';
export { layoutPass, layoutKind, isPortraitKind, capResolution, DPR_CAP, DESIGNS, getLayout };

export type { LayoutKind, Layout };

export const ST = { w: 1280, h: 800, s: 1, ox: 0, oy: 0, vw: 1280, vh: 800, kind: 'land' as LayoutKind, portrait: false, tablet: false, tb: 1, phl: false, railL: 0, railR: 0, compact: false, tap: 48 };

// Compact: small desktop popouts and every replay. Kept as a flag for typography / copy;
// it no longer drives a second scale or a 48-screen-px control floor in the layout pass.
const COMPACT_MAX_H = 600, TAP = 48, TAP_COMPACT = 28;
export const isReplayUrl = () => { try { return new URLSearchParams(location.search).get('replay') === 'true'; } catch { return false; } };
const finePointer = () => { try { return matchMedia('(pointer: fine)').matches; } catch { return false; } };

export function viewSize() {
	// The visible box, not the layout viewport: in an iOS Safari / Stake iframe innerHeight can include area under the
	// browser bars, which pushed the top of the stage (logo, Roxy's head) off screen. Take the smallest non-zero size.
	const de = document.documentElement, vv = window.visualViewport;
	const pick = (...a: (number | null | undefined)[]) => Math.min(...a.filter((x): x is number => !!x && x > 0)) || 1;
	const vw = pick(innerWidth, de.clientWidth, vv && vv.width * vv.scale);
	const vh = pick(innerHeight, de.clientHeight, vv && vv.height * vv.scale);
	return { vw, vh };
}

export function fitStage() {
	const { vw, vh } = viewSize();
	// Stake (and other hosts) can boot the iframe at 0x0 or visibility:hidden; a 1x1 first
	// layout would pick the wrong design and, if no later resize is delivered, stick. Keep
	// the last good stage until the viewport is a real size.
	if (vw < 32 || vh < 32) return ST;
	const portraitGuess = isPortraitKind(layoutKind(vw, vh));
	const compact = isReplayUrl() || (!portraitGuess && vh <= COMPACT_MAX_H && finePointer());
	const dpr = window.devicePixelRatio || 1;
	const L = layoutPass(vw, vh, dpr, { compact, dpr });
	const { kind, W: w, H: h, scale: s, ox, oy, portrait, tablet } = L;
	const tap = compact ? TAP_COMPACT : TAP;
	Object.assign(ST, { w, h, s, ox, oy, vw, vh, kind, portrait, tablet, tb: 1, phl: false, railL: 0, railR: 0, compact, tap });
	document.body.classList.toggle('phl', false);
	document.body.classList.toggle('compact', compact);
	document.body.classList.toggle('tb', false);
	document.body.classList.toggle('portrait', portrait);
	document.body.classList.toggle('tablet', tablet);
	document.body.classList.toggle('wide', kind === 'wide');
	document.body.classList.toggle('phone', kind === 'phonePort' || (!tablet && Math.min(vw, vh) <= 500));
	const r = document.documentElement.style;
	r.setProperty('--dw', w + 'px'); r.setProperty('--dh', h + 'px'); r.setProperty('--s', String(s));
	r.setProperty('--tb', '1'); r.setProperty('--tbs', '1'); r.setProperty('--tbm', '1');
	// leftover CSS (skip row, until the DOM splash is removed) may still read --t48; the layout pass does not.
	r.setProperty('--t48', Math.ceil(tap / s) + 'px'); r.setProperty('--tap', tap + 'px'); r.setProperty('--t12', (12 / s).toFixed(2) + 'px'); r.setProperty('--t14', (14 / s).toFixed(2) + 'px');
	r.setProperty('--mz', '1');
	r.setProperty('--railL', '0px'); r.setProperty('--railR', '0px');
	r.setProperty('--ox', ox + 'px'); r.setProperty('--oy', oy + 'px');
	r.setProperty('--vw', w / 100 + 'px'); r.setProperty('--vh', h / 100 + 'px'); r.setProperty('--vmin', Math.min(w, h) / 100 + 'px');
	return ST;
}

/** Hook a layout pass to resize, orientation, visualViewport, and devicePixelRatio changes. */
export function onStageChange(fn: () => void) {
	addEventListener('resize', fn);
	visualViewport?.addEventListener('resize', fn);
	addEventListener('orientationchange', () => { setTimeout(fn, 120); setTimeout(fn, 500); });
	addEventListener('visibilitychange', fn);
	addEventListener('pageshow', fn);
	try {
		const ro = new ResizeObserver(() => fn());
		ro.observe(document.documentElement);
		if (document.body) ro.observe(document.body);
	} catch { /* older webviews */ }
	const hookDpr = () => {
		try {
			const mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
			mq.addEventListener?.('change', () => { hookDpr(); fn(); }, { once: true });
		} catch { /* older webviews */ }
	};
	hookDpr();
}

/** A screen-space DOMRect (getBoundingClientRect) in stage design px. Retired once nothing places from DOM rects. */
export function toStage(r: DOMRect) {
	const x = (r.left - ST.ox) / ST.s, y = (r.top - ST.oy) / ST.s, w = r.width / ST.s, h = r.height / ST.s;
	return { left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, x, y } as DOMRect;
}

if (typeof globalThis !== 'undefined') {
	(globalThis as any).__ST = ST;
	(globalThis as any).__layout = getLayout;
}
