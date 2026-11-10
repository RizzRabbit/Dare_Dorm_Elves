// One shared scale for the whole game. A few design layouts are chosen by aspect
// ratio (not exact window size). Each is authored at a fixed design resolution;
// the whole stage (board, HUD, logo, Roxy, panels) is then fitted to the window
// with a single uniform contain scale — never stretched. Letterbox margins are
// filled by the room art (see Game.svelte #bg / #scene, which live outside #root).
export type LayoutKind = 'phonePort' | 'tabletPort' | 'square' | 'land';

export const DESIGNS: Record<LayoutKind, { w: number; h: number }> = {
	phonePort: { w: 390, h: 844 },
	tabletPort: { w: 768, h: 1024 },
	square: { w: 1024, h: 768 },
	land: { w: 1280, h: 800 },
};

/** Aspect-ratio buckets. 4:3 and near-square share `square`; 16:10 and wider are `land`. */
export function layoutKind(vw: number, vh: number): LayoutKind {
	const r = vw / Math.max(1, vh);
	if (r < 0.72) return 'phonePort';
	if (r < 0.95) return 'tabletPort';
	if (r < 1.45) return 'square';
	return 'land';
}

export const isPortraitKind = (k: LayoutKind) => k === 'phonePort' || k === 'tabletPort';

/** Cap renderer resolution so high-DPR devices stay sharp without blowing the fill rate. */
export const DPR_CAP = 2;
export const capResolution = () => Math.min(DPR_CAP, Math.max(1, window.devicePixelRatio || 1));

export const ST = { w: 1280, h: 800, s: 1, ox: 0, oy: 0, vw: 1280, vh: 800, kind: 'land' as LayoutKind, portrait: false, tablet: false, tb: 1, phl: false, railL: 0, railR: 0, compact: false, tap: 48 };
// v21 (review #193/#195/#243): COMPACT = small desktop popouts (a landscape window up to 600 px tall with a fine pointer:
// 400x225, 800x450, 1024x576) and every replay. Tap floor 28 screen px (not 48), text boost capped at 1.6 (not 2.2) and no
// 1.5x panel zoom, so the controls stop crowding a tiny stage. Touch phones (coarse pointer) are never compact outside a
// replay, so the approved 390x844 / 844x390 phone layouts are unchanged.
const COMPACT_MAX_H = 600, TAP = 48, TAP_COMPACT = 28, TB_MAX_COMPACT = 1.6;
export const isReplayUrl = () => { try { return new URLSearchParams(location.search).get('replay') === 'true'; } catch { return false; } };
const finePointer = () => { try { return matchMedia('(pointer: fine)').matches; } catch { return false; } };
// Legible-text floor: under one shared scale a phone in landscape renders the 800-px-tall stage at s ~0.4, so
// 13 design-px labels land small. --tb ("text boost") is the factor that brings UI / win text back to
// about the sizes portrait phones show: tb = clamp(1, TB_MIN / s, TB_MAX).
// It is 1 whenever s >= TB_MIN (every desktop / laptop window and portrait), so those layouts are untouched;
// CSS only applies it under body.tb (elfhaus.css "legible text floor").
const TB_MIN = 0.66, TB_MAX = 2.2;
// Phone landscape side-rail layout stays off (James v3.17): landscape phones use the desktop design, scaled uniformly.
const PHL_MAX_H = 0, PHL_H = 600;

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
	const kind = layoutKind(vw, vh);
	const D = DESIGNS[kind];
	const portrait = isPortraitKind(kind);
	const phl = !portrait && vh <= PHL_MAX_H;
	const tablet = kind === 'tabletPort' || kind === 'square';
	const w = phl ? Math.round(PHL_H * (D.w / D.h)) : D.w;
	const h = phl ? PHL_H : D.h;
	const s = Math.min(vw / w, vh / h);
	const ox = (vw - w * s) / 2, oy = (vh - h * s) / 2;
	const compact = isReplayUrl() || (!portrait && vh <= COMPACT_MAX_H && finePointer()), tap = compact ? TAP_COMPACT : TAP;
	const tb = portrait || phl ? 1 : Math.min(compact ? TB_MAX_COMPACT : TB_MAX, Math.max(1, TB_MIN / s));
	const railL = phl ? 230 : 0, railR = phl ? 190 : 0;
	Object.assign(ST, { w, h, s, ox, oy, vw, vh, kind, portrait, tablet, tb, phl, railL, railR, compact, tap });
	document.body.classList.toggle('phl', phl);
	document.body.classList.toggle('compact', compact);
	document.body.classList.toggle('tb', tb > 1.001);
	document.body.classList.toggle('portrait', portrait); // same rule for the loader, the game and every CSS layer
	document.body.classList.toggle('tablet', tablet);
	document.body.classList.toggle('phone', kind === 'phonePort' || (!tablet && Math.min(vw, vh) <= 500));
	const r = document.documentElement.style;
	r.setProperty('--dw', w + 'px'); r.setProperty('--dh', h + 'px'); r.setProperty('--s', String(s));
	r.setProperty('--tb', tb.toFixed(3)); r.setProperty('--tbs', Math.min(tb, 1.5).toFixed(3)); r.setProperty('--tbm', Math.min(tb, 1.6).toFixed(3));
	// --t48: 48 screen px in stage design px (every touch target is at least this big at any window size)
	r.setProperty('--t48', Math.ceil(tap / s) + 'px'); r.setProperty('--tap', tap + 'px'); r.setProperty('--t12', (12 / s).toFixed(2) + 'px'); r.setProperty('--t14', (14 / s).toFixed(2) + 'px');
	// --mz: zoom for panels / pop menu in landscape so their 13-15 px text lands at >= 12 screen px (1 at the land design)
	r.setProperty('--mz', (portrait || compact ? 1 : Math.min(1.5, Math.max(1, 0.95 / s))).toFixed(3));
	r.setProperty('--railL', railL + 'px'); r.setProperty('--railR', railR + 'px');
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

/** A screen-space DOMRect (getBoundingClientRect) in stage design px. */
export function toStage(r: DOMRect) {
	const x = (r.left - ST.ox) / ST.s, y = (r.top - ST.oy) / ST.s, w = r.width / ST.s, h = r.height / ST.s;
	return { left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, x, y } as DOMRect;
}
