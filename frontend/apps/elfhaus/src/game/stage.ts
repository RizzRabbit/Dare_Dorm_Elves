// Façade over the single layout pass in layout.ts. ST stays the published
// stage object for existing callers; values come from layoutPass() only.
// See docs/layout-architecture.md.
import { layoutPass, layoutKind, isPortraitKind, capResolution, DPR_CAP, DESIGNS, getLayout, type LayoutKind, type Layout } from './layout';
export { layoutPass, layoutKind, isPortraitKind, capResolution, DPR_CAP, DESIGNS, getLayout };

export type { LayoutKind, Layout };

export const ST = { w: 1280, h: 800, s: 1, ox: 0, oy: 0, vw: 1280, vh: 800, kind: 'landscape' as LayoutKind, portrait: false, tablet: false, tb: 1, phl: false, railL: 0, railR: 0, compact: false, tap: 48 };

// Compact: small desktop popouts and every replay. Kept as a flag for typography / copy;
// it no longer drives a second scale or a 48-screen-px control floor in the layout pass.
const COMPACT_MAX_H = 600, TAP = 48, TAP_COMPACT = 28;
export const isReplayUrl = () => { try { return new URLSearchParams(location.search).get('replay') === 'true'; } catch { return false; } };
const finePointer = () => { try { return matchMedia('(pointer: fine)').matches; } catch { return false; } };

export function viewSize() {
	// The visible box, not the layout viewport: in an iOS Safari / Stake iframe innerHeight can include area under the
	// browser bars, which pushed the top of the stage (logo, Roxy's head) off screen.
	// Do not Math.min() in visualViewport unconditionally: after a window grow (2560x1440 → 2560x1600)
	// a stale visualViewport kept the previous height and the layout stayed on the old kind for hundreds of ms.
	const de = document.documentElement, vv = window.visualViewport;
	const iw = innerWidth || 0, ih = innerHeight || 0;
	const cw = de.clientWidth || 0, ch = de.clientHeight || 0;
	// Prefer the window size. clientWidth/Height can lag a frame behind a grow,
	// and min(client, inner) then kept the previous layout after a resize.
	let vw = iw || cw || 1;
	let vh = ih || ch || 1;
	if (vv) {
		const vvw = (vv.width || 0) * (vv.scale || 1);
		const vvh = (vv.height || 0) * (vv.scale || 1);
		// Use visualViewport only when it is a modest inset of the current window (iOS chrome / pinch zoom),
		// never when it still reports a previous window size.
		if (vvw > 0 && vvh > 0 && vvw <= vw + 1 && vvh <= vh + 1) {
			const dW = vw - vvw, dH = vh - vvh;
			if (dW < 48 && dH < Math.min(120, vh * 0.15)) { vw = vvw; vh = vvh; }
		}
	}
	return { vw: Math.max(1, vw), vh: Math.max(1, vh) };
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
	document.body.classList.toggle('wide', kind === 'landscape' && vw / Math.max(1, vh) >= 16/9);
	document.body.classList.toggle('phone', kind === 'portrait' && Math.min(vw, vh) <= 500);
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
	// Immediate pass, then one follow-up on the next frame so a size that settles
	// after the event (iframe client box, iOS rotation) is applied within 1 frame.
	let q = 0;
	const kick = () => { fn(); if (!q) q = requestAnimationFrame(() => { q = 0; fn(); }); };
	addEventListener('resize', kick);
	visualViewport?.addEventListener('resize', kick);
	addEventListener('orientationchange', kick);
	addEventListener('visibilitychange', kick);
	addEventListener('pageshow', kick);
	try {
		const ro = new ResizeObserver(() => kick());
		ro.observe(document.documentElement);
		if (document.body) ro.observe(document.body);
	} catch { /* older webviews */ }
	const hookDpr = () => {
		try {
			const mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
			mq.addEventListener?.('change', () => { hookDpr(); kick(); }, { once: true });
		} catch { /* older webviews */ }
	};
	hookDpr();
	startViewportWatch(kick);
}

// Event-driven layout: immediate pass plus one next-frame kick. Stake iframes do
// not always fire window.resize, so a short poll may run after one of those events
// (or while the host box is still 0x0 / tiny) and then stops. Never a permanent
// ticker or interval while the game is idle.
const watchFns = new Set<() => void>();
let hooked = false;
let pollId = 0, rafId = 0, pollUntil = 0;
const POLL_MS = 50, POLL_FOR_MS = 1000;
const watchState = () => ({ poll: !!pollId, raf: !!rafId });

function viewportCheck() {
	try {
		const { vw, vh } = viewSize();
		if (vw < 32 || vh < 32) return false;
		if (Math.abs(vw - ST.vw) <= 0.5 && Math.abs(vh - ST.vh) <= 0.5) return false;
		for (const f of watchFns) {
			try { f(); } catch { /* keep going */ }
		}
		if (Math.abs(vw - ST.vw) > 0.5 || Math.abs(vh - ST.vh) > 0.5) {
			dispatchEvent(new Event('resize'));
		}
		return true;
	} catch { return false; }
}

function stopPoll() {
	if (pollId) { clearInterval(pollId); pollId = 0; }
	pollUntil = 0;
}

function armPoll() {
	pollUntil = Date.now() + POLL_FOR_MS;
	if (pollId) return;
	pollId = setInterval(() => {
		const changed = viewportCheck();
		const { vw, vh } = viewSize();
		// The host has not given a real box yet (0x0 / tiny boot): keep polling.
		if (vw < 32 || vh < 32) { pollUntil = Date.now() + POLL_FOR_MS; return; }
		if (changed) pollUntil = Date.now() + POLL_FOR_MS;
		if (Date.now() >= pollUntil) stopPoll();
	}, POLL_MS);
}

function kickViewport() {
	viewportCheck();
	if (!rafId) rafId = requestAnimationFrame(() => { rafId = 0; viewportCheck(); });
	armPoll();
}

export function startViewportWatch(fn?: () => void) {
	if (typeof window === 'undefined') return;
	if (fn) watchFns.add(fn);
	if (hooked) return;
	hooked = true;
	addEventListener('resize', kickViewport);
	visualViewport?.addEventListener('resize', kickViewport);
	addEventListener('orientationchange', kickViewport);
	addEventListener('visibilitychange', kickViewport);
	addEventListener('pageshow', kickViewport);
	try {
		const ro = new ResizeObserver(() => kickViewport());
		ro.observe(document.documentElement);
		if (document.body) ro.observe(document.body);
	} catch { /* older webviews */ }
	const hookDpr = () => {
		try {
			const mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
			mq.addEventListener?.('change', () => { hookDpr(); kickViewport(); }, { once: true });
		} catch { /* older webviews */ }
	};
	hookDpr();
	kickViewport();
}

/** A screen-space DOMRect (getBoundingClientRect) in stage design px. Retired once nothing places from DOM rects. */
export function toStage(r: DOMRect) {
	const x = (r.left - ST.ox) / ST.s, y = (r.top - ST.oy) / ST.s, w = r.width / ST.s, h = r.height / ST.s;
	return { left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, x, y } as DOMRect;
}

if (typeof globalThis !== 'undefined') {
	(globalThis as any).__ST = ST;
	(globalThis as any).__layout = getLayout;
	(globalThis as any).__viewportWatch = watchState;
}
