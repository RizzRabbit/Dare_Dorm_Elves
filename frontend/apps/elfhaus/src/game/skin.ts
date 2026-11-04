// Painted-sprite skin for every DOM piece of the HUD, modals, signs and loader (SPRITE_MAP rows 3-5, 8, 9, 13, 18, 23-25,
// 31, 33-36, 43, 44, 49-51, 53, 55-58, 60, 65-69, 71, 73, 74, 78). Every plate, button, icon, pill, switch, word and number
// is a frame of a packed atlas (static/assets/sprites/<pkg>/<pkg>.json + WebP pages, scripts/import-art.mjs sprites):
// a canvas behind (or over) the element shows that frame, 9-sliced when the frame carries slice9, every piece snapped to
// whole device pixels (CSS border-image leaves hairlines under the stage scale). State frames (_down while pressed, _off
// when disabled, armed / on variants) are painted frames swapped in, never CSS colour. Text that changes (meters, win
// amounts, counters) is set in the painted bitmap fonts (font_cream / font_gold / font_ink / font_cran); fixed words are
// baked word sprites (titles atlas). The element keeps its real text for screen readers (it is made transparent).
// CSS (static/skin.css, body.skin) removes the old CSS fills, borders, radii, shadows and the inline SVG icons.
import { ST } from './stage';
type Fr = { x: number; y: number; w: number; h: number; ox: number; oy: number; sw: number; sh: number; s9?: number[]; pad?: number[]; adv?: number; page: number };
type Pkg = { img: HTMLImageElement[]; fr: Record<string, Fr>; meta: any };
const DIR = 'assets/sprites/', pk = new Map<string, Promise<Pkg | null>>(), ready = new Map<string, Pkg>();
const redraws = new Set<() => void>();
function load(name: string) {
	let p = pk.get(name);
	if (!p) pk.set(name, (p = fetch(`${DIR}${name}/${name}.json`).then((r) => r.json()).then(async (J) => {
		const img = await Promise.all((J.meta.pages as { image: string }[]).map((pg) => new Promise<HTMLImageElement>((res) => {
			const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = () => res(im); im.src = `${DIR}${name}/${pg.image}`; })));
		const fr: Record<string, Fr> = {};
		for (const [k, f] of Object.entries<any>(J.frames)) fr[k] = { x: f.frame.x, y: f.frame.y, w: f.frame.w, h: f.frame.h, ox: f.spriteSourceSize?.x || 0, oy: f.spriteSourceSize?.y || 0,
			sw: f.sourceSize.w, sh: f.sourceSize.h, s9: f.slice9, pad: f.pad, adv: f.adv, page: f.page || 0 };
		const P = { img, fr, meta: J.meta }; ready.set(name, P); redraws.forEach((f) => f()); return P;
	}).catch(() => null)));
	return p;
}
export type Look = { pkg: string; frame: string; nine?: boolean; k?: number; fit?: 'fill' | 'contain' | 'cover'; size?: number; over?: boolean; out?: number } | null;
const dpr = () => Math.max(0.25, ST.s * (window.devicePixelRatio || 1));
/** draw one frame into (dx,dy,dw,dh) of g; 9-sliced when the frame has slice9 and `nine` (k = sprite px per canvas px) */
function blit(g: CanvasRenderingContext2D, P: Pkg, f: Fr, dx: number, dy: number, dw: number, dh: number, nine: boolean, k: number) {
	const im = P.img[f.page]; if (!im?.naturalWidth) return;
	if (!nine || !f.s9) { const sx = dw / f.sw, sy = dh / f.sh; g.drawImage(im, f.x, f.y, f.w, f.h, dx + f.ox * sx, dy + f.oy * sy, f.w * sx, f.h * sy); return; }
	const [l, t, r, b] = f.s9, d = 1 / k, W = f.w, H = f.h;
	const dl = Math.round(l * d), dt = Math.round(t * d), dr = Math.round(r * d), db = Math.round(b * d);
	const sx = [0, l, W - r], sw = [l, W - l - r, r], sy = [0, t, H - b], sh = [t, H - t - b, b];
	const ex = [dx, dx + dl, dx + dw - dr], ew = [dl, dw - dl - dr, dr], ey = [dy, dy + dt, dy + dh - db], eh = [dt, dh - dt - db, db];
	for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) if (ew[i] > 0 && eh[j] > 0 && sw[i] > 0 && sh[j] > 0) g.drawImage(im, f.x + sx[i], f.y + sy[j], sw[i], sh[j], ex[i], ey[j], ew[i], eh[j]);
}
/** a frame for canvas-2D drawing code (winlines, particles): null until its package is decoded (loading starts) */
export function atlasFrame(pkg: string, name: string) { const P = ready.get(pkg); if (!P) { void load(pkg); return null; } const f = P.fr[name]; return f ? { img: P.img[f.page], f } : null; }
/** draw a frame centred at (x, y), size w x h, rotated by a */
export function drawFrame(g: CanvasRenderingContext2D, pkg: string, name: string, x: number, y: number, w: number, h: number, a = 0) {
	const F = atlasFrame(pkg, name); if (!F) return false; const { img, f } = F;
	g.save(); g.translate(x, y); if (a) g.rotate(a); const sx = w / f.sw, sy = h / f.sh;
	g.drawImage(img, f.x, f.y, f.w, f.h, -w / 2 + f.ox * sx, -h / 2 + f.oy * sy, f.w * sx, f.h * sy); g.restore(); return true;
}
const looks = new WeakMap<HTMLElement, () => void>();
/** Put a painted frame behind (or over) `el`; `look` is re-read on every redraw (state, class, disabled, pressed). */
export function skin(el: HTMLElement | null, look: (el: HTMLElement) => Look) {
	if (!el || looks.has(el)) return;
	const cv = document.createElement('canvas'); cv.className = 'skC'; cv.setAttribute('aria-hidden', 'true');
	el.classList.add('sk'); el.prepend(cv);
	let pressed = false;
	const draw = () => {
		if (!el.isConnected) return;
		const L = look(el); cv.style.display = L ? '' : 'none'; if (!L) return;
		const P = ready.get(L.pkg); if (!P) { void load(L.pkg); return; }
		const f = P.fr[pressed && P.fr[L.frame + '_down'] ? L.frame + '_down' : L.frame]; if (!f) return;
		const o = L.out ?? 0, w = el.offsetWidth + 2 * o, h = el.offsetHeight + 2 * o; if (!w || !h) return;
		cv.style.cssText = `position:absolute;left:${-o}px;top:${-o}px;width:${w}px;height:${h}px;pointer-events:none;z-index:${L.over ? 1 : -1}`;
		const k = dpr(), W = Math.round(w * k), H = Math.round(h * k);
		if (cv.width !== W) cv.width = W; if (cv.height !== H) cv.height = H;
		const g = cv.getContext('2d')!; g.clearRect(0, 0, W, H); g.imageSmoothingQuality = 'high';
		if (L.nine !== false && f.s9) { blit(g, P, f, 0, 0, W, H, true, (L.k ?? 2) / k); return; }
		const fit = L.fit || 'contain', s = (L.size ?? 1);
		let dw = W, dh = H;
		if (fit !== 'fill') { const a = f.sw / f.sh, c = fit === 'contain' ? Math.min(W / f.sw, H / f.sh) : Math.max(W / f.sw, H / f.sh); dw = f.sw * c; dh = f.sh * c; void a; }
		dw *= s; dh *= s; blit(g, P, f, (W - dw) / 2, (H - dh) / 2, dw, dh, false, 1);
	};
	looks.set(el, draw); redraws.add(draw);
	new ResizeObserver(draw).observe(el);
	new MutationObserver(draw).observe(el, { attributes: true, attributeFilter: ['class', 'disabled', 'aria-checked', 'aria-pressed', 'aria-expanded'] });
	el.addEventListener('pointerdown', () => { pressed = true; draw(); });
	for (const e of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(e, () => { if (pressed) { pressed = false; draw(); } });
	draw();
}
/** A painted icon / word inside `el` (its own child, so it sits above the plate). */
export function icon(el: HTMLElement | null, look: (el: HTMLElement) => Look, cls = 'skI') {
	if (!el || el.querySelector(':scope > .' + cls)) return;
	const i = document.createElement('i'); i.className = cls; i.setAttribute('aria-hidden', 'true'); el.append(i);
	skin(i, () => { const L = look(el); return L && { ...L, over: true }; });
	new MutationObserver(() => looks.get(i)?.()).observe(el, { attributes: true, attributeFilter: ['class', 'disabled', 'aria-checked', 'aria-pressed'] });
}
/** Set the element's text in a painted bitmap font (the element keeps the text, transparent, for screen readers). */
export function bmText(el: HTMLElement | null, font: string | ((el: HTMLElement) => string)) {
	if (!el || el.classList.contains('bm')) return;
	el.classList.add('bm');
	const cv = document.createElement('canvas'); cv.className = 'bmC'; cv.setAttribute('aria-hidden', 'true');
	const draw = () => {
		if (!el.isConnected) return;
		const fn = typeof font === 'string' ? font : font(el), P = ready.get(fn); if (!P) { void load(fn); return; }
		if (cv.parentNode !== el) el.append(cv);
		const txt = (el.textContent || '').trim(), cs = getComputedStyle(el), fs = parseFloat(cs.fontSize) || 16;
		const m = P.meta, sc = (fs * 1.05) / m.px, k = dpr();
		const gl = [...txt].map((ch) => (ch === ' ' ? null : P.fr['u' + ch.toUpperCase().codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')] || P.fr['u' + ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')]));
		const adv = gl.reduce((s, f) => s + (f ? f.adv ?? f.sw : m.space), 0) * sc;
		const w = Math.max(el.clientWidth, adv), h = Math.max(el.clientHeight, m.lh * sc);
		const W = Math.max(1, Math.round(w * k)), H = Math.max(1, Math.round(h * k));
		cv.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;pointer-events:none;z-index:2`;
		if (cv.width !== W) cv.width = W; if (cv.height !== H) cv.height = H;
		const g = cv.getContext('2d')!; g.clearRect(0, 0, W, H); g.imageSmoothingQuality = 'high';
		const al = cs.textAlign, x0 = al === 'left' || al === 'start' ? 0 : al === 'right' || al === 'end' ? w - adv : (w - adv) / 2;
		let x = x0 * k; const y = ((h - m.lh * sc) / 2) * k, s = sc * k;
		for (const f of gl) { if (!f) { x += m.space * s; continue; } blit(g, P, f, x, y, f.sw * s, f.sh * s, false, 1); x += (f.adv ?? f.sw) * s; }
	};
	redraws.add(draw);
	new MutationObserver(draw).observe(el, { childList: true, characterData: true, subtree: true });
	new ResizeObserver(draw).observe(el); draw();
}
const $$ = (q: string) => [...document.querySelectorAll<HTMLElement>(q)];
const dis = (el: HTMLElement) => (el as HTMLButtonElement).disabled || el.classList.contains('off') || el.getAttribute('aria-disabled') === 'true';
const on = (el: HTMLElement) => el.classList.contains('on') || el.classList.contains('active') || el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-checked') === 'true';
const btn = (base: 'btn_pine' | 'btn_cran' | 'btn_gold') => (el: HTMLElement): Look => ({ pkg: 'ui', frame: dis(el) ? base + '_off' : on(el) ? 'btn_gold' : base, k: 2 });
const go = (el: HTMLElement): Look => ({ pkg: 'ui', frame: dis(el) ? 'btn_go_off' : 'btn_go', k: 2 });
const WORDS: Record<string, string> = { 'TOTAL WIN': 'w_total_win', 'FREE SPINS': 'w_free_spins', 'MORE SPINS': 'w_more_spins', START: 'w_start', CONFIRM: 'w_confirm', CONTINUE: 'w_continue',
	'TAP TO START': 'w_tap_to_start', 'BUY BONUS': 'w_buy_bonus', AUTOPLAY: 'w_autoplay', SETTINGS: 'w_settings', 'GAME INFO': 'w_rules', RULES: 'w_rules', BALANCE: 'w_balance', BET: 'w_bet',
	PLAY: 'w_bet', WIN: 'w_win', ANTE: 'w_ante', BONUS: 'w_bonus', PAYTABLE: 'w_paytable', SOUND: 'w_sound', MUSIC: 'w_music', CANCEL: 'w_cancel', ARMED: 'w_armed', STOP: 'w_stop' };
/** a fixed word as its baked sprite; anything else in the bitmap font */
function word(el: HTMLElement | null, font = 'font_cream', gold = false) {
	if (!el) return;
	const key = () => WORDS[(el.textContent || '').trim().toUpperCase()];
	if (key()) {
		el.classList.add('skW');
		const put = () => icon(el, () => { const w = key(); return w ? { pkg: 'titles', frame: gold && ready.get('titles')?.fr[w + '_gold'] ? w + '_gold' : w, fit: 'contain' } : null; }, 'skWd');
		put();
		// game code re-sets textContent on locale load (e.g. #buyTitle), which drops the painted word: put it back
		new MutationObserver(() => { if (!el.querySelector(':scope > .skWd')) put(); }).observe(el, { childList: true });
	}
	else bmText(el, font);
}
const ICON: Record<string, (el: HTMLElement) => string> = {
	menuBtn: () => 'ico_menu', betDown: () => 'ico_minus', betUp: () => 'ico_plus', bmDown: () => 'ico_minus', bmUp: () => 'ico_plus',
	turboBtn: () => 'ico_turbo', autoBtn: (el) => (on(el) || el.classList.contains('running') ? 'ico_stop' : 'ico_auto'),
	spinBtn: (el) => (el.classList.contains('stop') || el.classList.contains('busy') ? 'ico_stop' : 'ico_spin'),
};
function apply() {
	skin(document.getElementById('bar'), () => ({ pkg: 'ui', frame: 'hud_bar', k: 2.4, out: 6 }));                       // 3
	for (const id of ['menuBtn', 'betDown', 'betUp', 'autoBtn', 'turboBtn', 'bmDown', 'bmUp']) {                         // 4, 8
		const el = document.getElementById(id); skin(el, btn('btn_pine')); icon(el, (e) => ({ pkg: 'ui', frame: ICON[id](e), size: 0.62 }));
	}
	const sp = document.getElementById('spinBtn');                                                                            // 5
	skin(sp, (el) => ({ pkg: 'ui', frame: dis(el) ? 'spin_plate_busy' : 'spin_plate', fit: 'contain', size: 1.06 }));
	icon(sp, (e) => ({ pkg: 'ui', frame: ICON.spinBtn(e), size: 0.5 }));
	skin(document.getElementById('buyBtn'), (el) => ({ pkg: 'ui', frame: dis(el) ? 'card_ticket_off' : 'buy_plate', k: 2 }));   // 9
	word(document.getElementById('buyLbl'));                                                                                  // 44
	$$('#strip label').forEach((e) => word(e, 'font_cream', true)); $$('#strip span').forEach((e) => bmText(e, 'font_cream'));   // 36
	skin(document.getElementById('fsBar'), () => ({ pkg: 'ui', frame: 'pill_cran', k: 2 })); bmText(document.getElementById('fsTier'), 'font_gold'); bmText(document.getElementById('fsCount'), 'font_cream');   // 33
	for (const id of ['banner', 'stepToast']) { const el = document.getElementById(id); skin(el, () => ({ pkg: 'ui', frame: 'toast', k: 2 })); bmText(el, 'font_ink'); }   // 50
	const arm = document.getElementById('armTag'); skin(arm, () => ({ pkg: 'ui', frame: 'pill_gold', k: 2 })); bmText(arm?.querySelector('.t') as HTMLElement, 'font_ink');   // 49
	$$('.modal').forEach((e) => skin(e, () => ({ pkg: 'ui', frame: 'plate_cream', k: 2 })));                                // 34, 73
	$$('.modal h2').forEach((e) => word(e, 'font_ink'));                                                                     // 60
	$$('.mX').forEach((e) => skin(e, () => ({ pkg: 'ui', frame: 'btn_close', fit: 'contain' })));                           // 55
	$$('button.go, #msgOk, #replayPlay').forEach((e) => { skin(e, go); word(e); });                                          // 58
	$$('.row').forEach((e) => skin(e, () => ({ pkg: 'ui', frame: 'row_plate', k: 2 })));                                    // 56
	// the switch: painted track (sw_on / sw_off) + its own painted knob part (sw_knob), slid by transform (skin.css .skK)
	$$('.sw').forEach((e) => { skin(e, (el) => ({ pkg: 'ui', frame: on(el) ? 'sw_on' : 'sw_off', nine: false, fit: 'fill' })); icon(e, () => ({ pkg: 'ui', frame: 'sw_knob', fit: 'contain' }), 'skK'); }); // track drawn whole: a 9-slice squashed the 160x90 pill's caps onto 64x36
	$$('.row input').forEach((e) => skin(e.parentElement?.querySelector('input') ? (e as HTMLElement) : null, () => ({ pkg: 'ui', frame: 'field', fit: 'fill' })));
	skin(document.getElementById('popMenu'), () => ({ pkg: 'ui', frame: 'plate_cream', k: 2 }));                           // 57
	const PM: Record<string, string> = { pmInfo: 'ico_info_ink', pmMusic: 'ico_music_ink', pmSound: 'ico_sound_ink', pmMute: 'ico_mute_ink', pmSettings: 'ico_chev_ink' };
	$$('#popMenu .pmRow').forEach((e) => icon(e, (el) => ({ pkg: 'ui', frame: (PM[el.id] || 'ico_info_ink').replace('ico_sound', on(el) ? 'ico_sound' : 'ico_mute'), size: 0.8 })));
	// fix2 Settings panel: painted labels, switches (above), painted slider track / fill / thumb
	$$('#settings .stRow .lbl').forEach((e) => word(e, 'font_ink'));
	$$('#settings .stSl').forEach((e) => { skin(e, () => ({ pkg: 'ui', frame: 'slider_track', k: 2 }));
		skin(e.querySelector<HTMLElement>('.slF'), () => ({ pkg: 'ui', frame: 'slider_fill', k: 2 })); skin(e.querySelector<HTMLElement>('.slT'), () => ({ pkg: 'ui', frame: 'slider_thumb', fit: 'contain' })); });
	bmText(document.querySelector<HTMLElement>('#pmSettings span'), 'font_ink');
	skin(document.getElementById('replayBar'), () => ({ pkg: 'ui', frame: 'toast', k: 2 }));                                 // 73
	$$('#intro .card, #outro .card, #fsMore .card').forEach((e) => skin(e, () => ({ pkg: 'ui', frame: 'sign_plate', k: 2 })));   // 24, 25
	$$('#intro .cont').forEach((e) => { skin(e, go); word(e); });
	$$('#outro .tierName, #fsMore .fmSub, #outro .otHint').forEach((e) => word(e, 'font_cream'));
	$$('#intro .spins, #outro .otAmt, #fsMore .fmBig, #bigwin .bwAmt, #bigwin .bwX, #maxwin .mwAmt, #maxwin .mwX').forEach((e) => bmText(e, 'font_gold'));   // 13, 43
	$$('#bigwin .bwFx, #intro .bwFx, #outro .bwFx').forEach((e) => skin(e, () => ({ pkg: 'fx', frame: 'sunburst', fit: 'cover', size: 1.2 })));   // 23
	$$('.overlay').forEach((e) => skin(e, () => ({ pkg: 'ui', frame: 'dim', fit: 'fill' })));                              // 71 (30% dim baked in the frame alpha)
	const lgo = document.getElementById('lGo'); skin(lgo, go); word(lgo);                                                   // 74
	const lb = document.getElementById('lBar'); skin(lb, () => ({ pkg: 'ui', frame: 'bar_track', k: 2 }));                 // 18 / 69 (DOM loader)
	skin(lb?.querySelector('i') as HTMLElement, () => ({ pkg: 'ui', frame: 'bar_fill', k: 2 }));
	skin(document.querySelector<HTMLElement>('#loader .spBg'), () => ({ pkg: 'fx', frame: 'logo_back', fit: 'cover' }));  // 67
	skin(document.querySelector<HTMLElement>('#sting .stBox'), () => ({ pkg: 'fx', frame: 'logo_glow', fit: 'contain', size: 1.4 }));   // 68
}
/** pieces built later (buy cards, rules headers, lock chips, respin pill, mystery badge, card faces, line-win ticket) */
function late(n: HTMLElement) {
	n.querySelectorAll<HTMLElement>('.bcard').forEach((e) => skin(e, (el) => ({ pkg: 'ui', frame: dis(el) ? 'card_ticket_off' : (el.classList.contains('armed') || el.classList.contains('on')) ? 'card_ticket_armed' : 'card_ticket', k: 2 })));   // 35
	n.querySelectorAll<HTMLElement>('#rulesBody h3').forEach((e) => { skin(e, () => ({ pkg: 'ui', frame: 'pill_cran', k: 2 })); });   // 78
	n.querySelectorAll<HTMLElement>('#rsCtr, .lock').forEach((e) => skin(e, () => ({ pkg: 'ui', frame: 'chip_cream', k: 2 })));   // 51, 65
	n.querySelectorAll<HTMLElement>('.rd > i').forEach((e) => skin(e, (el) => ({ pkg: 'ui', frame: on(el) || el.classList.contains('full') ? 'dot_full' : 'dot_empty', fit: 'contain' })));
	n.querySelectorAll<HTMLElement>('.bMystQ').forEach((e) => skin(e, () => ({ pkg: 'ui', frame: 'badge_q', fit: 'contain' })));   // 66
	n.querySelectorAll<HTMLElement>('.cpFront, .cpBack').forEach((e) => skin(e, (el) => ({ pkg: 'ui', frame: el.classList.contains('cpBack') ? 'pass_back' : 'pass_front', k: 2 })));   // 53
	n.querySelectorAll<HTMLElement>('.wlAmt').forEach((e) => { skin(e, () => ({ pkg: 'ui', frame: 'winplate', k: 2 })); bmText(e, 'font_cream'); });   // 31
	n.querySelectorAll<HTMLElement>('.strip .antGlow').forEach((e) => skin(e, () => ({ pkg: 'fx', frame: 'ant_column', k: 2 })));   // 54
	n.querySelectorAll<HTMLElement>('.symSh').forEach((e) => skin(e, () => ({ pkg: 'fx', frame: 'oval_shadow', fit: 'fill' })));   // 48
	n.querySelectorAll<HTMLElement>('.mfRays').forEach((e) => skin(e, () => ({ pkg: 'fx', frame: 'bloom_rays', fit: 'contain' })));   // 52
	n.querySelectorAll<HTMLElement>('.mfCore').forEach((e) => skin(e, () => ({ pkg: 'fx', frame: 'bloom_core', fit: 'contain' })));
	n.querySelectorAll<HTMLElement>('.mRing').forEach((e) => skin(e, () => ({ pkg: 'fx', frame: 'rim_glow', fit: 'contain' })));
	n.querySelectorAll<HTMLElement>('#autoCounts > button').forEach((e) => { skin(e, btn('btn_pine')); bmText(e, 'font_cream'); });
}
let started = false;
/** Turn the painted skin on (once, after the game DOM exists). */
export function initSkin() {
	if (started) return; started = true;
	document.body.classList.add('skin');
	for (const p of ['ui', 'titles', 'font_cream', 'font_gold', 'font_ink', 'fx']) void load(p);
	apply(); late(document.body);
	new MutationObserver((ms) => { for (const m of ms) m.addedNodes.forEach((n) => { if (n instanceof HTMLElement && !n.classList.contains('skC') && !n.classList.contains('bmC')) late(n.parentElement || n); }); })
		.observe(document.body, { childList: true, subtree: true });
	window.addEventListener('resize', () => requestAnimationFrame(() => redraws.forEach((f) => f())));
}
/** Preload a painted bitmap font package (for Pixi scenes that set text before the DOM skin runs). */
export const loadFont = (name: string) => load(name);
/** Set `txt` in a painted bitmap font onto a canvas (word-wrapped at wrapW CSS px, `px` = glyph cap size), drawn at
 *  `res` x for crisp scaling. Returns null until the font is decoded. Used by the intro cards (introPixi.ts cardText). */
export function paintTextCanvas(txt: string, font: string, px: number, wrapW: number, align: 'left' | 'center' = 'left', lineK = 1.25, res = 2) {
	const P = ready.get(font); if (!P) { void load(font); return null; }
	const m = P.meta, sc = (px * 1.05) / m.px;
	const glyph = (ch: string) => P.fr['u' + ch.toUpperCase().codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')] || P.fr['u' + ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')] || null;
	const wAdv = (w: string) => [...w].reduce((s, ch) => { const f = glyph(ch); return s + (f ? f.adv ?? f.sw : m.space); }, 0) * sc;
	const sp = m.space * sc, lines: string[] = [];
	let cur = '';
	for (const w of txt.split(/\s+/).filter(Boolean)) { const t = cur ? cur + ' ' + w : w; if (cur && wAdv(t) > wrapW) { lines.push(cur); cur = w; } else cur = t; }
	if (cur) lines.push(cur);
	const lh = m.lh * sc * lineK, W = Math.max(1, Math.ceil(Math.max(...lines.map(wAdv), 1))), H = Math.max(1, Math.ceil(lh * (lines.length - 1) + m.lh * sc));
	const cv = document.createElement('canvas'); cv.width = W * res; cv.height = H * res;
	const g = cv.getContext('2d')!; g.imageSmoothingQuality = 'high'; const s = sc * res;
	lines.forEach((ln, i) => { let x = (align === 'center' ? (W - wAdv(ln)) / 2 : 0) * res; const y = i * lh * res;
		for (const ch of ln) { if (ch === ' ') { x += sp * res; continue; } const f = glyph(ch); if (!f) { x += sp * res; continue; } blit(g, P, f, x, y, f.sw * s, f.sh * s, false, 1); x += (f.adv ?? f.sw) * s; } });
	return { cv, w: W, h: H, res };
}
