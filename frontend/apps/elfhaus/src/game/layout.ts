// One layout pass for the whole game. Design tables in design units, then a single
// uniform contain scale onto the viewport. See docs/layout-architecture.md.
// The cover background (room) is the only element that uses a different scale.

export type LayoutKind = 'phonePort' | 'tabletPort' | 'square' | 'land' | 'wide';

export const DESIGNS: Record<LayoutKind, { w: number; h: number }> = {
	phonePort: { w: 390, h: 844 },
	tabletPort: { w: 768, h: 1024 },
	square: { w: 1024, h: 768 },
	land: { w: 1280, h: 800 },
	wide: { w: 1920, h: 1080 },
};

/** Aspect-ratio buckets. 16:10 is `land`; 16:9 and wider are `wide`. */
export function layoutKind(vw: number, vh: number): LayoutKind {
	const r = vw / Math.max(1, vh);
	if (r < 0.72) return 'phonePort';
	if (r < 0.95) return 'tabletPort';
	if (r < 1.45) return 'square';
	if (r < 1.70) return 'land';
	return 'wide';
}

export const isPortraitKind = (k: LayoutKind) => k === 'phonePort' || k === 'tabletPort';

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
	portrait: boolean; tablet: boolean; compact: boolean;
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

type Chrome = Omit<Layout, 'kind' | 'W' | 'H' | 'scale' | 'ox' | 'oy' | 'vw' | 'vh' | 'resolution' | 'portrait' | 'tablet' | 'compact' | 'safe'>;

const kNum = (v: number, k: number) => v * k;
function kChrome(c: Chrome, k: number): Chrome {
	const btn = (b: Btn): Btn => ({ x: b.x * k, y: b.y * k, s: b.s * k, ic: b.ic });
	const field = (f: Field): Field => ({ x: f.x * k, y: f.y * k, ls: f.ls * k, vs: f.vs * k, w: f.w * k });
	return {
		board: { x: c.board.x * k, y: c.board.y * k, w: c.board.w * k, h: c.board.h * k, bs: c.board.bs * k, cell: CELL * c.board.bs * k, T: c.board.T * k },
		logo: { x: c.logo.x * k, y: c.logo.y * k, s: c.logo.s * k },
		roxy: { x: c.roxy.x * k, y: c.roxy.y * k, s: c.roxy.s * k, peek: c.roxy.peek },
		hud: { x: c.hud.x * k, y: c.hud.y * k, w: c.hud.w * k, h: c.hud.h * k, r: c.hud.r * k },
		fBal: field(c.fBal), fBet: field(c.fBet), fWin: field(c.fWin),
		minus: btn(c.minus), plus: btn(c.plus), spin: btn(c.spin), auto: btn(c.auto), turbo: btn(c.turbo),
		buy: { v: c.buy.v, x: c.buy.x * k, y: c.buy.y * k, s: c.buy.s * k },
		menu: { x: c.menu.x * k, y: c.menu.y * k, s: c.menu.s * k },
		intro: {
			doors: scaleRect(c.intro.doors, k),
			cards: scaleRect(c.intro.cards, k),
			tap: scaleRect(c.intro.tap, k),
			skip: scaleRect(c.intro.skip, k),
		},
	};
}
function scaleRect(r: { x: number; y: number; w: number; h: number }, k: number) {
	return { x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k };
}

/** Phone portrait authored in 1080 × 2337 (same aspect as 390×844). */
function chromePhone(AW: number, AH: number): Chrome {
	const loose = AH >= 2100, hu = loose ? 0.92 : 0.86, HB = 344 * hu, hudY = AH - HB - 18;
	const kk = loose ? 0.9 : 0.76, GAPB = loose ? 40 : 18, RH = 176 * kk;
	const menuS = 144, menuB = 12 + menuS;
	const TOP_MIN = menuB + 12 + 64 + 412 * 0.4 * 0.62;
	const HBp = HB + 110;
	const hudYp = hudY - (HBp - HB);
	const gapRow = Math.max(GAPB, 96);
	const belowP0 = 2 * gapRow + RH;
	const BS_W = 1026 / FW;
	const bs0 = Math.max(0.92, Math.min(1.28, (AH - 344 - 18 - (2 * (loose ? 44 : 22) + 176 * (loose ? 1 : 0.86)) - 690) / (BH + FB)));
	let bs = Math.max(Math.min(bs0, BS_W), Math.min(BS_W, (hudYp - belowP0 - TOP_MIN) / (BH + FB + FT)));
	const BC = 540;
	let by = hudYp - belowP0 - (BH + FB) * bs;
	const bx = BC - BW * bs / 2;
	let T = by - FT * bs;
	if (T < TOP_MIN) { by = TOP_MIN + FT * bs; T = TOP_MIN; }
	const boardFoot = by + (BH + FB) * bs;
	const rowYp = (boardFoot + hudYp) / 2;
	const bSz = Math.max(124 * hu, 44);
	const padB = Math.max(72 * hu, HBp * (80 / 313) + 18);
	const betY = hudYp + HBp - padB - bSz / 2 + 12;
	const BX = BC - 70;
	const topY = hudYp + 20 * hu;
	const zone = 360;
	const spSz = 250 * hu;
	const abP = 156;
	return {
		board: { x: bx, y: by, w: BW * bs, h: BH * bs, bs, cell: CELL * bs, T },
		logo: { x: BC, y: T - 64, s: 0.4 },
		roxy: { x: BC, y: T + 8, s: 0.62, peek: true },
		hud: { x: 14, y: hudYp, w: 1052, h: HBp, r: 22 },
		fBal: { x: BC - zone - 16, y: topY - 4, ls: 28 * hu, vs: 66 * hu, w: zone - 56 },
		fWin: { x: BC + 16, y: topY - 4, ls: 28 * hu, vs: 66 * hu, w: Math.min(zone, (14 + 1052 - 36 - spSz) - 20 - (BC + 16)) },
		fBet: { x: BX - 110, y: betY - bSz * 0.95, ls: 26 * hu, vs: 60 * hu, w: 220 },
		minus: { x: BX - 170, y: betY, s: bSz, ic: 2.35 }, plus: { x: BX + 170, y: betY, s: bSz, ic: 2.35 },
		spin: { x: 14 + 1052 - 36 - spSz / 2, y: hudYp + HBp / 2, s: spSz, ic: 2.6 },
		auto: { x: 30 + abP / 2, y: rowYp, s: abP, ic: 2.3 },
		turbo: { x: 30 + abP * 1.5 + 20, y: rowYp, s: abP, ic: 2.3 },
		buy: { v: 'p', x: 1066 - 290, y: rowYp, s: 0.95 },
		menu: { x: 12 + menuS / 2, y: 12 + menuS / 2, s: menuS },
		intro: introChrome(AW, AH, true),
	};
}

/** Tablet portrait authored in 1080 × 1440 (same aspect as 768×1024). Buy, turbo, auto | spin under the board. */
function chromeTablet(AW: number, AH: number): Chrome {
	// Author in this design's own size. The board takes the largest uniform scale
	// that fits between the peeking logo/Roxy, the buy/auto/spin row, and the bet bar.
	const menuS = Math.min(88, Math.max(64, AH * 0.085));
	const maxBsW = (AW - 32) / (BW + 2 * FT);
	const floorHud = Math.min(160, AH * 0.16), floorSp = Math.min(88, AH * 0.09), floorTop = Math.min(120, AH * 0.12);
	let hudH = Math.min(230, Math.max(floorHud, AH * 0.18));
	let spSz = Math.min(160, Math.max(floorSp, AH * 0.14));
	let topMin = Math.min(220, Math.max(floorTop, menuS + 8 + 48 + 64));
	const spinRowOf = () => spSz + 12;
	const room = () => AH - 12 - hudH - 10 - spinRowOf() - topMin;
	const need = maxBsW * (BH + FB + FT);
	if (room() < need) {
		const spareHud = hudH - floorHud, spareSp = spSz - floorSp, spareTop = topMin - floorTop;
		const spare = spareHud + spareSp + spareTop, deficit = need - room();
		if (spare > 0) {
			const k = Math.min(1, deficit / spare);
			hudH -= spareHud * k; spSz -= spareSp * k; topMin -= spareTop * k;
		}
	}
	const hudYp = AH - hudH - 12, spinRow = spinRowOf();
	const maxBsH = (hudYp - 10 - spinRow - topMin) / (BH + FB + FT);
	const bs = Math.min(maxBsW, Math.max(0.4, maxBsH));
	const fw = (BW + 2 * FT) * bs;
	const bx = AW / 2 - fw / 2 + FT * bs;
	let by = hudYp - 10 - spinRow - (BH + FB) * bs;
	if (by - FT * bs < topMin) by = topMin + FT * bs;
	const T = by - FT * bs;
	const BC2 = bx + BW * bs / 2;
	const kUi = Math.min(1, spSz / 160);
	const abT = Math.max(64, 110 * kUi);
	const buyS = Math.max(0.5, 0.72 * kUi), buyW = 216 * buyS * 0.92, buyH = 240 * buyS * 0.92;
	const spX = Math.min(BC2 + fw / 2 - spSz / 2, AW - 16 - spSz / 2);
	const spY = Math.min(by + (BH + FB) * bs + 6 + spSz / 2, hudYp - 8 - spSz / 2);
	const autoX = spX - spSz / 2 - 16 - abT / 2;
	const turboX = autoX - abT - 14;
	const buyX = turboX - abT / 2 - 16 - buyW / 2;
	const pairY = spY, buyY = Math.min(spY, hudYp - 8 - buyH / 2);
	const mb = Math.max(72, 120 * (hudH / 200)), betHalf = Math.max(90, 130 * (hudH / 200));
	const clear = betHalf + mb / 2 + 16;
	const hudW = Math.min(AW - 16, Math.max(fw + 24, AW * 0.92)), hudX = BC2 - hudW / 2;
	const balX = hudX + 28, winR = hudX + hudW - 28;
	const zoneL = Math.max(120, (BC2 - clear) - balX), zoneR = Math.max(120, winR - (BC2 + clear));
	const ls = 22 * (hudH / 180), vs = 40 * (hudH / 180);
	return {
		board: { x: bx, y: by, w: BW * bs, h: BH * bs, bs, cell: CELL * bs, T },
		logo: { x: BC2, y: T - 40, s: 0.38 },
		roxy: { x: bx + BW * bs * 0.62, y: T + 8, s: 0.55, peek: true },
		hud: { x: hudX, y: hudYp, w: hudW, h: hudH, r: 18 },
		fBal: { x: balX, y: hudYp + 36 * (hudH / 180), ls, vs, w: zoneL },
		fBet: { x: BC2 - 70, y: hudYp + 36 * (hudH / 180), ls, vs, w: 140 },
		fWin: { x: BC2 + clear, y: hudYp + 36 * (hudH / 180), ls, vs, w: zoneR },
		minus: { x: BC2 - betHalf, y: hudYp + hudH / 2, s: mb, ic: 2.3 },
		plus: { x: BC2 + betHalf, y: hudYp + hudH / 2, s: mb, ic: 2.3 },
		spin: { x: spX, y: spY, s: spSz, ic: 2.5 },
		auto: { x: autoX, y: pairY, s: abT, ic: 2.1 },
		turbo: { x: turboX, y: pairY, s: abT, ic: 2.1 },
		buy: { v: 'v', x: buyX, y: buyY, s: buyS },
		menu: { x: 12 + menuS / 2, y: 12 + menuS / 2, s: menuS },
		intro: introChrome(AW, AH, true),
	};
}

/** Landscape / square / wide: board left, buy above spin above auto/turbo, Roxy right, HUD under the board. */
function chromeLand(AW: number, AH: number): Chrome {
	// Author in this design's own size (no second fit). HUD is reserved first, then the board
	// takes the largest remaining rect that keeps square cells and the right-stack + Roxy column.
	const ab = Math.min(120, AH * 0.12);
	const buyS = 0.85, buyW = 216 * buyS * 0.92, buyH = 240 * buyS * 0.92;
	const ROXY_CLEAR = Math.round(AW * 0.80);
	const spSz = Math.min(200, AH * 0.20);
	const btnCol = Math.max(spSz, buyW) + 16;
	const hudH = Math.min(300, Math.max(160, AH * 0.185));
	const hudY = AH - hudH - 16;
	const topMin = Math.min(215, Math.max(140, AH * 0.15));
	const maxBsH = (hudY - 24 - topMin) / (BH + FB + FT);
	const playL = 64, playR = ROXY_CLEAR - 8;
	const maxBsW = (playR - playL - btnCol - 14) / (BW + 2 * FT);
	const bs = Math.min(1.32, maxBsH, maxBsW);
	const fw = (BW + 2 * FT) * bs;
	const playW = fw + 14 + btnCol;
	const playX0 = playL + Math.max(0, (playR - playL - playW) / 2);
	const bx = playX0 + FT * bs;
	let by = hudY - 22 - (BH + FB) * bs;
	if (by - FT * bs < topMin) by = topMin + FT * bs;
	const T = by - FT * bs;
	const BC = bx + BW * bs / 2;
	const spinX = playX0 + fw + 14 + btnCol / 2 - 8;
	const buyX = spinX, buyY = by - FT * bs + buyH / 2;
	const spinY = buyY + buyH / 2 + 16 + spSz / 2;
	const autoX = spinX, turboX = spinX;
	const autoY = spinY + spSz / 2 + 14 + ab / 2;
	const turboY = autoY + ab + 12;
	const hudW = Math.min(1400, 2 * (BC - 44), 2 * (ROXY_CLEAR - 16 - BC));
	const hudX = BC - hudW / 2;
	const mbT = Math.round(hudH * 0.45), betHalf = 156, clear = betHalf + mbT / 2 + 52;
	const balX = hudX + 44, winR = hudX + hudW - 44;
	const zoneL = Math.max(240, (BC - clear) - balX), zoneR = Math.max(240, winR - (BC + clear));
	const tls = 42 * (hudH / 300), tvs = 80 * (hudH / 300);
	const gutter = AW - playR;
	const roxyS = Math.min(gutter / 700, (T + FH * bs) / 1400) * 1.15;
	return {
		board: { x: bx, y: by, w: BW * bs, h: BH * bs, bs, cell: CELL * bs, T },
		logo: { x: BC, y: T - 18, s: 0.44 },
		roxy: { x: playR + gutter / 2, y: by + (BH + FB) * bs, s: Math.max(0.35, roxyS), peek: false },
		hud: { x: hudX, y: hudY, w: hudW, h: hudH, r: 22 },
		fBal: { x: balX, y: hudY + 50 * (hudH / 300), ls: tls, vs: tvs, w: zoneL },
		fBet: { x: BC - 96, y: hudY + 50 * (hudH / 300), ls: tls, vs: tvs, w: 192 },
		fWin: { x: BC + clear, y: hudY + 50 * (hudH / 300), ls: tls, vs: tvs, w: zoneR },
		minus: { x: BC - betHalf, y: hudY + hudH / 2 - 4, s: mbT, ic: 2.2 },
		plus: { x: BC + betHalf, y: hudY + hudH / 2 - 4, s: mbT, ic: 2.2 },
		spin: { x: spinX, y: spinY, s: spSz, ic: 2.05 },
		auto: { x: autoX, y: autoY, s: ab, ic: 1.95 }, turbo: { x: turboX, y: turboY, s: ab, ic: 1.95 },
		buy: { v: 'v', x: buyX, y: buyY, s: buyS },
		menu: { x: 16 + 56, y: 16 + 56, s: 112 },
		intro: introChrome(AW, AH, false),
	};
}

function introChrome(AW: number, AH: number, port: boolean): Chrome['intro'] {
	if (port) {
		const dw = 540, dh = 780, cx = AW / 2, FL = AH * 0.62;
		const top = FL - dh;
		const cw = Math.min(AW * 0.74, 360), ch = Math.max(200, cw * 1.3);
		const btnH = 132, btnW = 620;
		return {
			doors: { x: cx - dw / 2, y: top, w: dw, h: dh },
			cards: { x: cx - cw / 2, y: top + dh * 0.22, w: cw, h: ch },
			tap: { x: cx - btnW / 2, y: FL + 130 - btnH / 2, w: btnW, h: btnH },
			skip: { x: cx - 200, y: AH - 72, w: 400, h: 56 },
		};
	}
	const ks = Math.min(AW / 1920, AH / 1080);
	const dw = 520 * ks, dh = 580 * ks, cx = AW / 2, FL = AH / 2 + 400 * ks;
	const top = FL - dh, cw = Math.min(AW * 0.6, 760, 400), ch = Math.min(400, AH * 0.35);
	const btnH = 100 * ks, btnW = 470 * ks;
	return {
		doors: { x: cx - dw / 2, y: top, w: dw, h: dh },
		cards: { x: cx - cw / 2, y: top + 80 * ks, w: cw, h: ch },
		tap: { x: cx - btnW / 2, y: FL + 64 * ks - btnH / 2, w: btnW, h: btnH },
		skip: { x: AW - 280, y: AH - 64, w: 260, h: 48 },
	};
}

function chromeFor(kind: LayoutKind, W: number, H: number): Chrome {
	// Author in a matched-aspect space, then map once into the design (no second letterbox).
	if (kind === 'phonePort') return kChrome(chromePhone(1080, 1080 * (844 / 390)), W / 1080);
	if (kind === 'tabletPort') return chromeTablet(W, H);
	if (kind === 'square') return kChrome(chromeLand(1920, 1440), W / 1920);
	if (kind === 'land') return kChrome(chromeLand(1920, 1200), W / 1920);
	return chromeLand(W, H); // wide: authored in 1920×1080
}

function readSafe(scale: number, raw?: Partial<Safe>): Safe {
	const fromEnv = (name: string) => {
		if (typeof window === 'undefined' || typeof getComputedStyle === 'undefined') return 0;
		const v = getComputedStyle(document.documentElement).getPropertyValue(name);
		return parseFloat(v) || 0;
	};
	const scr = {
		t: raw?.t ?? (fromEnv('--sat') || fromEnv('env(safe-area-inset-top)')), // env() not readable this way; callers pass screen px
		r: raw?.r ?? 0,
		b: raw?.b ?? 0,
		l: raw?.l ?? 0,
	};
	const s = Math.max(1e-6, scale);
	return { t: scr.t / s, r: scr.r / s, b: scr.b / s, l: scr.l / s };
}

/** Single layout pass. `safe` is in screen pixels and is converted to design units. */
export function layoutPass(vw: number, vh: number, dpr = 1, opts: LayoutOpts = {}): Layout {
	const kind = layoutKind(vw, vh);
	const D = DESIGNS[kind];
	const W = D.w, H = D.h;
	const scale = Math.min(vw / W, vh / H);
	const ox = (vw - W * scale) / 2, oy = (vh - H * scale) / 2;
	const portrait = isPortraitKind(kind);
	const tablet = kind === 'tabletPort' || kind === 'square';
	const compact = !!opts.compact;
	const resolution = capResolution(opts.dpr ?? dpr);
	const safe = readSafe(scale, opts.safe);
	const chrome = chromeFor(kind, W, H);
	// Edge-anchored chrome: menu and skip sit in design space from the safe insets (no second scale).
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
	const L: Layout = { kind, W, H, scale, ox, oy, vw, vh, resolution, portrait, tablet, compact, safe, ...chrome };
	current = L;
	return L;
}

