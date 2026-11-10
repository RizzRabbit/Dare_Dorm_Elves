// One layout pass. Kind selection matches Stake's web-sdk (createLayout.svelte.ts):
//   ratio = innerWidth/innerHeight
//   ratio <= 0.8  portrait  (1080×1920, stacked)
//   0.8 < r < 1.3 tablet    (1920×1920, stacked)
//   ratio >= 1.3  landscape (1920×1080); short-landscape / mobile when min(w,h) <= 480
// Uniform contain scale, then Phaser EXPAND: the spare axis grows (W or H = viewport/scale)
// so there is no letterbox. The board stays a fixed design size, centered. HUD, menu,
// Buy Bonus and Roxy anchor to the expanded edges and safe-area insets. The cover
// background is the only element that uses a different (cover) scale.

export type LayoutKind = 'portrait' | 'tablet' | 'landscape';

export const DESIGNS: Record<LayoutKind, { w: number; h: number }> = {
	portrait: { w: 1080, h: 1920 },
	tablet: { w: 1920, h: 1920 },
	landscape: { w: 1920, h: 1080 },
};

export function layoutKind(vw: number, vh: number): LayoutKind {
	const r = vw / Math.max(1, vh);
	if (r <= 0.8) return 'portrait';
	if (r < 1.3) return 'tablet';
	return 'landscape';
}

export const isPortraitKind = (k: LayoutKind) => k === 'portrait' || k === 'tablet';
export const isMobileViewport = (vw: number, vh: number) => Math.min(vw, vh) <= 480;

export const DPR_CAP = 2;
export const capResolution = (dpr?: number) => Math.min(DPR_CAP, Math.max(1, dpr ?? ((typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1)));

export const CELL = 160, FT = 34, FB = 52, BW = 800, BH = 640, FW = BW + 2 * FT, FH = BH + FT + FB, M = 40;

export type Btn = { x: number; y: number; s: number; ic: number };
export type Field = { x: number; y: number; ls: number; vs: number; w: number };
export type Safe = { t: number; r: number; b: number; l: number };

export type Layout = {
	kind: LayoutKind;
	W: number; H: number;
	scale: number; ox: number; oy: number;
	vw: number; vh: number;
	resolution: number;
	portrait: boolean; tablet: boolean; compact: boolean; mobile: boolean;
	safe: Safe;
	board: { x: number; y: number; w: number; h: number; bs: number; cell: number; T: number };
	logo: { x: number; y: number; s: number };
	roxy: { x: number; y: number; s: number; peek: boolean };
	hud: { x: number; y: number; w: number; h: number; r: number };
	fBal: Field; fBet: Field; fWin: Field;
	minus: Btn; plus: Btn; spin: Btn; auto: Btn; turbo: Btn;
	buy: { v: 'v' | 'p'; x: number; y: number; s: number };
	menu: { x: number; y: number; s: number };
	intro: {
		doors: { x: number; y: number; w: number; h: number };
		cards: { x: number; y: number; w: number; h: number };
		tap: { x: number; y: number; w: number; h: number };
		skip: { x: number; y: number; w: number; h: number };
	};
};

export type LayoutOpts = { compact?: boolean; dpr?: number; safe?: Partial<Safe> };

let current: Layout | null = null;
export const getLayout = () => current;
export function setLayout(L: Layout) { current = L; }

type Chrome = Omit<Layout, 'kind' | 'W' | 'H' | 'scale' | 'ox' | 'oy' | 'vw' | 'vh' | 'resolution' | 'portrait' | 'tablet' | 'compact' | 'mobile' | 'safe'>;

function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }

function screenInsets(): Safe {
	const z = { t: 0, r: 0, b: 0, l: 0 };
	if (typeof document === 'undefined') return z;
	try {
		const el = document.createElement('div');
		el.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
		document.documentElement.appendChild(el);
		const cs = getComputedStyle(el);
		z.t = parseFloat(cs.paddingTop) || 0;
		z.r = parseFloat(cs.paddingRight) || 0;
		z.b = parseFloat(cs.paddingBottom) || 0;
		z.l = parseFloat(cs.paddingLeft) || 0;
		el.remove();
	} catch { /* older webviews */ }
	return z;
}

function readSafe(scale: number, raw?: Partial<Safe>): Safe {
	const scr = raw ?? screenInsets();
	const s = Math.max(1e-6, scale);
	return { t: (scr.t ?? 0) / s, r: (scr.r ?? 0) / s, b: (scr.b ?? 0) / s, l: (scr.l ?? 0) / s };
}

function hudFields(hudX: number, hudY: number, hudW: number, hudH: number, bc: number): Pick<Chrome, 'fBal' | 'fBet' | 'fWin' | 'minus' | 'plus'> {
	const k = hudH / 200;
	const ls = 22 * k, vs = 40 * k;
	const mb = clamp(hudH * 0.45, 56, 120);
	const betHalf = clamp(hudW * 0.14, 90, 156);
	const clear = betHalf + mb / 2 + 24;
	const balX = hudX + 28, winR = hudX + hudW - 28;
	const zoneL = Math.max(120, (bc - clear) - balX), zoneR = Math.max(120, winR - (bc + clear));
	const fy = hudY + 36 * k;
	return {
		fBal: { x: balX, y: fy, ls, vs, w: zoneL },
		fBet: { x: bc - 70, y: fy, ls, vs, w: 140 },
		fWin: { x: bc + clear, y: fy, ls, vs, w: zoneR },
		minus: { x: bc - betHalf, y: hudY + hudH / 2, s: mb, ic: 2.3 },
		plus: { x: bc + betHalf, y: hudY + hudH / 2, s: mb, ic: 2.3 },
	};
}

function introChrome(W: number, H: number, stacked: boolean): Chrome['intro'] {
	const cx = W / 2;
	if (stacked) {
		const dw = Math.min(W * 0.72, 760), dh = Math.min(H * 0.52, dw * 1.45);
		const top = Math.max(80, H * 0.12);
		const cw = Math.min(dw * 0.92, W * 0.78, 680), ch = Math.min(cw * 1.28, dh * 0.86, H * 0.42);
		const cardsY = top + (dh - ch) * 0.28;
		const btnW = Math.min(W * 0.72, 620), btnH = Math.min(120, H * 0.07);
		const tapY = Math.min(H - 140, top + dh + 24);
		return {
			doors: { x: cx - dw / 2, y: top, w: dw, h: dh },
			cards: { x: cx - cw / 2, y: cardsY, w: cw, h: ch },
			tap: { x: cx - btnW / 2, y: tapY, w: btnW, h: btnH },
			skip: { x: cx - 200, y: H - 72, w: 400, h: 56 },
		};
	}
	const dw = Math.min(W * 0.42, 640), dh = Math.min(H * 0.72, 720);
	const top = (H - dh) / 2;
	const cw = Math.min(W * 0.5, 760, 640), ch = Math.min(dh * 0.82, 420);
	const btnW = Math.min(W * 0.36, 470), btnH = Math.min(100, H * 0.1);
	return {
		doors: { x: cx - dw / 2, y: top, w: dw, h: dh },
		cards: { x: cx - cw / 2, y: top + (dh - ch) / 2, w: cw, h: ch },
		tap: { x: cx - btnW / 2, y: Math.min(H - 90, top + dh + 16), w: btnW, h: btnH },
		skip: { x: W - 280, y: H - 64, w: 260, h: 48 },
	};
}

/** Portrait and tablet: reels use the base design width, controls stacked below. */
function chromeStacked(W: number, H: number, baseW: number, safe: Safe): Chrome {
	const pad = 8;
	const menuS = clamp(Math.min(W, H) * 0.08, 64, 120);
	const topPad = safe.t + pad + menuS + 8;
	const hudH = clamp(H * 0.14, 140, 260);
	const hudY = H - safe.b - pad - hudH;
	const spSz = clamp(Math.min(W, H) * 0.11, 88, 168);
	const buyS = clamp(spSz / 220, 0.5, 0.75);
	const ab = clamp(spSz * 0.7, 64, 120);
	const spinRow = Math.max(spSz, 240 * buyS * 0.92) + 16;
	const maxBsW = (baseW - 48) / FW;
	const maxBsH = (hudY - 12 - spinRow - topPad) / FH;
	const bs = Math.max(0.35, Math.min(maxBsW, maxBsH));
	const fw = FW * bs, fh = FH * bs;
	const bx = (W - fw) / 2 + FT * bs;
	const availTop = topPad, availBot = hudY - 12 - spinRow;
	let T = availTop + Math.max(0, (availBot - availTop - fh) / 2);
	if (T + fh > availBot) T = Math.max(availTop, availBot - fh);
	const by = T + FT * bs;
	const BC = bx + BW * bs / 2;
	const boardFoot = by + (BH + FB) * bs;
	const spY = Math.min(boardFoot + 8 + spSz / 2, hudY - 8 - spSz / 2);
	const spX = Math.min(BC + fw / 2 - spSz / 2, W - safe.r - 16 - spSz / 2);
	const autoX = spX - spSz / 2 - 16 - ab / 2;
	const turboX = autoX - ab - 14;
	const buyW = 216 * buyS * 0.92;
	const buyX = turboX - ab / 2 - 16 - buyW / 2;
	const hudW = Math.min(W - safe.l - safe.r - 16, Math.max(fw + 24, W * 0.92));
	const hudX = BC - hudW / 2;
	const fields = hudFields(hudX, hudY, hudW, hudH, BC);
	// Roxy: side spare if it is wide enough, else a peek above the board, else hide.
	const sideSpare = (W - fw) / 2;
	const topSpare = T - topPad;
	let roxy = { x: BC, y: T + 8, s: 0, peek: false };
	if (sideSpare >= 200) {
		roxy = { x: bx + BW * bs + sideSpare * 0.55, y: by + BH * bs * 0.7, s: Math.min(sideSpare / 700, fh / 1400) * 1.1, peek: false };
	} else if (topSpare >= 120) {
		roxy = { x: BC, y: T + 8, s: Math.min(0.55, topSpare / 400), peek: true };
	}
	const logoS = clamp(Math.min(W, 800) / 2800, 0.28, 0.42);
	return {
		board: { x: bx, y: by, w: BW * bs, h: BH * bs, bs, cell: CELL * bs, T },
		logo: { x: BC, y: Math.max(topPad, T - 20), s: logoS },
		roxy,
		hud: { x: hudX, y: hudY, w: hudW, h: hudH, r: 18 },
		...fields,
		spin: { x: spX, y: spY, s: spSz, ic: 2.5 },
		auto: { x: autoX, y: spY, s: ab, ic: 2.1 },
		turbo: { x: turboX, y: spY, s: ab, ic: 2.1 },
		buy: { v: 'v', x: buyX, y: spY, s: buyS },
		menu: { x: safe.l + pad + menuS / 2, y: safe.t + pad + menuS / 2, s: menuS },
		intro: introChrome(W, H, true),
	};
}

/** Landscape: board at a fixed design size, controls beside the reels so short height cannot push them off. */
function chromeLandscape(W: number, H: number, safe: Safe, mobile: boolean): Chrome {
	const pad = 8;
	const menuS = clamp(H * 0.1, 56, 96);
	const topPad = Math.max(safe.t + pad + menuS + 8, 24);
	const hudH = clamp(H * (mobile ? 0.18 : 0.15), 112, 180);
	const hudY = H - safe.b - pad - hudH;
	const spSz = clamp(H * 0.18, 88, 168);
	const buyS = clamp(spSz / 220, 0.5, 0.72);
	const buyW = 216 * buyS * 0.92, buyH = 240 * buyS * 0.92;
	const ab = clamp(H * 0.11, 64, 96);
	const btnCol = Math.max(spSz, buyW) + 16;
	const roxyMin = mobile ? 0 : Math.min(W * 0.16, 280);
	const maxBsH = (hudY - 12 - topPad) / FH;
	const maxBsW = (W - safe.l - safe.r - 48 - btnCol - roxyMin) / FW;
	const bs = Math.max(0.3, Math.min(maxBsH, maxBsW));
	const fw = FW * bs, fh = FH * bs;
	const playW = fw + 12 + btnCol;
	const playX0 = safe.l + 24 + Math.max(0, (W - safe.l - safe.r - roxyMin - playW) / 2);
	const bx = playX0 + FT * bs;
	let T = topPad + Math.max(0, (hudY - 12 - topPad - fh) / 2);
	if (T + fh > hudY - 12) T = Math.max(topPad, hudY - 12 - fh);
	const by = T + FT * bs;
	const BC = bx + BW * bs / 2;
	const spinX = playX0 + fw + 12 + btnCol / 2;
	const buyX = spinX, buyY = T + buyH / 2;
	const spinY = buyY + buyH / 2 + 12 + spSz / 2;
	const autoY = spinY + spSz / 2 + 10 + ab / 2;
	const turboY = autoY + ab + 10;
	const playR = playX0 + playW;
	const gutter = Math.max(0, W - safe.r - playR);
	let roxy = { x: playR + gutter / 2, y: by + BH * bs, s: 0, peek: false };
	if (gutter >= 180) roxy = { x: playR + gutter / 2, y: by + BH * bs, s: Math.min(gutter / 700, fh / 1400) * 1.15, peek: false };
	const hudW = Math.min(W - safe.l - safe.r - 16, Math.max(fw + 24, W * 0.7), 2 * (BC - playX0 + 20));
	const hudX = BC - hudW / 2;
	const fields = hudFields(hudX, hudY, hudW, hudH, BC);
	const logoS = clamp(H / 2800, 0.28, 0.4);
	return {
		board: { x: bx, y: by, w: BW * bs, h: BH * bs, bs, cell: CELL * bs, T },
		logo: { x: BC, y: Math.max(topPad, T - 16), s: logoS },
		roxy,
		hud: { x: hudX, y: hudY, w: hudW, h: hudH, r: 18 },
		...fields,
		spin: { x: spinX, y: spinY, s: spSz, ic: 2.05 },
		auto: { x: spinX, y: autoY, s: ab, ic: 1.95 },
		turbo: { x: spinX, y: turboY, s: ab, ic: 1.95 },
		buy: { v: 'v', x: buyX, y: buyY, s: buyS },
		menu: { x: safe.l + pad + menuS / 2, y: safe.t + pad + menuS / 2, s: menuS },
		intro: introChrome(W, H, false),
	};
}

/** Single layout pass. `safe` is in screen pixels and is converted to design units. */
export function layoutPass(vw: number, vh: number, dpr = 1, opts: LayoutOpts = {}): Layout {
	const kind = layoutKind(vw, vh);
	const D = DESIGNS[kind];
	const scale = Math.min(vw / D.w, vh / D.h) || 1e-6;
	// Phaser EXPAND: fill the spare axis so the design covers the viewport with no letterbox.
	const W = vw / scale, H = vh / scale;
	const ox = 0, oy = 0;
	const portrait = isPortraitKind(kind);
	const tablet = kind === 'tablet';
	const mobile = isMobileViewport(vw, vh);
	const compact = !!opts.compact;
	const resolution = capResolution(opts.dpr ?? dpr);
	const safe = readSafe(scale, opts.safe);
	const chrome = portrait ? chromeStacked(W, H, D.w, safe) : chromeLandscape(W, H, safe, mobile);
	const pad = 8;
	chrome.menu.x = safe.l + pad + chrome.menu.s / 2;
	chrome.menu.y = safe.t + pad + chrome.menu.s / 2;
	if (portrait) {
		chrome.intro.skip.y = H - safe.b - pad - chrome.intro.skip.h;
		chrome.intro.skip.x = W / 2 - chrome.intro.skip.w / 2;
	} else {
		chrome.intro.skip.x = W - safe.r - pad - chrome.intro.skip.w;
		chrome.intro.skip.y = H - safe.b - pad - chrome.intro.skip.h;
	}
	const L: Layout = { kind, W, H, scale, ox, oy, vw, vh, resolution, portrait, tablet, compact, mobile, safe, ...chrome };
	current = L;
	return L;
}
