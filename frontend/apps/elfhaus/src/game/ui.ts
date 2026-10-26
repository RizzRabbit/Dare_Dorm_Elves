// DOM renderer (ported from prototype/app.js). It only displays what book events say.
import { sfx, loop, duck } from './audio';
import { voice, VOICE } from './voice';
import { frameHTML } from './wildframe';
import ART_JSON from './art.generated.json';
import { LINES, MAX_WIN_X, ROWS, REELS, SYMBOL_NAMES } from './config';
import { money } from './format';
import type { Group, LineWin } from './typesBookEvent';
import { DOTS } from './respin';
import { mxBurst, lockIconCSS, symWin, clearSymWins } from './fx';
import { countTo, countMs, setAmount, skipCounts, countTiers, BIG_TIERS } from './countup';
import { hold, tempo } from './tempo';

export const ART = ART_JSON as Record<string, string | null>;
export const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const LINE_COLORS = ['#C8435F', '#4E6A8C', '#B79BE0', '#7E9C6B', '#9A6FB0', '#8B7FA8', '#5E8F95', '#6E6880'];

export const S = {
	currency: 'USD', balance: 0, levels: [] as number[], betIdx: 0, ante: false, turbo: false, busy: false, auto: 0,
	sym: [] as string[][], vals: new Map<number, number>(), full: new Map<number, number>(), groups: [] as Group[],
	roundBase: 0, meterX: 0, inBonus: false, cell: 100, ready: false, replay: false, replayBet: 0,
	jur: {} as Record<string, any>,
};
export const k = (r: number, row: number) => r * ROWS + row;
export const bet = () => (S.replay ? S.replayBet : S.levels[S.betIdx] ?? 0);
/** Board pause at the old pace: stretched by ANIM_TEMPO and skippable by tap / Space (tempo.ts hold); turbo = 0.35x as before. */
export const wait = (ms: number) => (S.turbo ? waitRaw(ms * 0.35) : hold(ms));
/** Plain timer (win screens / resume: their pace is their own). */
export const waitRaw = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
export const pos = (r: number, row: number) => ({ x: r * S.cell, y: row * S.cell });

const ph = (_key: string) => ''; // no visible placeholder labels in release builds
// frameless set: the lit (win) outline is a second layer over the idle art, crossfaded by .cell.win (opacity only)
const winLayer = (key: string) => (ART[key + '_win'] ? `<img class="olWin" src="${ART[key + '_win']}" alt="" draggable="false">` : '');
// Win glow: the symbol's own outline as a neon sprite (<KEY>_glow, same size + registration as the symbol art), drawn
// BEHIND the art and shown only on .cell.win (CSS: opacity fade in, slow opacity/scale pulse, fade out). The outer <i>
// carries the fade, the inner <img> the pulse. Where a key has a glow, the old *_win crossfade layer is not used.
// v3.7: a wild's glow draws its sprite twice (same file, one decode) so its always-on neon reads stronger than a symbol's.
const glowLayer = (key: string, n = 1) => (ART[key + '_glow'] ? `<i class="symGlow">${`<img src="${ART[key + '_glow']}" alt="" draggable="false">`.repeat(n)}</i>` : '');
const winFx = (key: string) => (ART[key + '_glow'] ? '' : winLayer(key));
const img = (key: string) => (ART[key] ? `<img src="${ART[key]}" alt="" draggable="false">` : '');
// Stacked / merged wild stills (scripts/gen-stack-stills.py): the approved stacks r8d art per overlay position, frame 0
// of merge_idle (body) and the held last frame of letters_ignite (WILD), so an overlay shows the same elves and letters
// from its first frame until its sheets decode (the canvases then cover them). Also the bonus-buy / splash card art.
const stillPos = (reels: number[]) => (reels.length === 1 ? `WF_R${reels[0] + 1}` : `WM${reels.length}_R${reels[0] + 1}-${reels[reels.length - 1] + 1}`);
const stillSrc = (reels: number[], letters = false) => `assets/stacks/still/${stillPos(reels)}${letters ? '_letters' : ''}.webp`;
const stillHTML = (reels: number[]) => `<div class="wart"><img src="${stillSrc(reels)}" alt="" draggable="false"></div>` +
	`<div class="mLets mStill"><img src="${stillSrc(reels, true)}" alt="" draggable="false"></div>`;
// Multiplier lettering: text only, in a faceted pink "gemstone" fill (repeating diagonal hard-stop bands) with a
// light-pink inner outline, a thin dark-plum outer stroke, a white specular band across the cap tops and a few
// tiny 4-point glints (sprite sheet, fx.ts) that twinkle now and then. All layers are SVG text sharing one viewBox (60 units high,
// 48-unit Nunito Black, caps ~34 units), so it renders identically in Chrome and Safari. Gradients live once
// in a hidden <svg> (userSpaceOnUse, so every instance gets the same facet scale).
const MX_H = 60, MX_FS = 48, MX_BASE = 50, CHAR_W = 27;
function ensureMxDefs() {
	if (document.getElementById('mxDefs')) return;
	const d = document.createElement('div');
	d.innerHTML = `<svg id="mxDefs" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true"><defs>` +
		`<linearGradient id="mxFacet" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="15" y2="21" spreadMethod="repeat">` +
		`<stop offset="0" stop-color="#FF96C8"/><stop offset=".3" stop-color="#FF96C8"/><stop offset=".3" stop-color="#E44792"/>` +
		`<stop offset=".55" stop-color="#E44792"/><stop offset=".55" stop-color="#FFC4E0"/><stop offset=".68" stop-color="#FFC4E0"/>` +
		`<stop offset=".68" stop-color="#C42A78"/><stop offset="1" stop-color="#C42A78"/></linearGradient>` +
		`<linearGradient id="mxShade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${MX_H}">` +
		`<stop offset=".27" stop-color="#fff" stop-opacity="0"/><stop offset=".3" stop-color="#fff" stop-opacity=".85"/>` +
		`<stop offset=".39" stop-color="#fff" stop-opacity=".3"/><stop offset=".43" stop-color="#fff" stop-opacity="0"/>` +
		`<stop offset=".62" stop-color="#3A0A26" stop-opacity="0"/><stop offset=".84" stop-color="#3A0A26" stop-opacity=".38"/></linearGradient>` +
		`</defs></svg>`;
	document.body.appendChild(d.firstChild!);
}
type Anchor = 'start' | 'end' | 'middle';
const ax = (anchor: Anchor, w: number) => (anchor === 'end' ? w - 5 : anchor === 'start' ? 5 : w / 2);
function mxSVG(t: string, w: number, anchor: Anchor) {
	const x = ax(anchor, w);
	const txt = (cls: string) => `<text class="${cls}" x="${x}" y="${MX_BASE}" text-anchor="${anchor}" font-size="${MX_FS}">${t}</text>`;
	return `<svg viewBox="0 0 ${w} ${MX_H}" aria-hidden="true">${txt('o')}${txt('i')}${txt('f')}${txt('h')}</svg>`;
}
/** Text span of the lettering as % of its box (data-tl / data-tr / data-cx), used to place glints and bursts. */
function mxSpan(t: string, w: number, anchor: Anchor) {
	const tw = t.length * CHAR_W, x = ax(anchor, w), l = anchor === 'end' ? x - tw : anchor === 'start' ? x : x - tw / 2;
	const pc = (v: number) => ((v / w) * 100).toFixed(1);
	return `data-tl="${pc(l)}" data-tr="${pc(l + tw)}" data-cx="${pc(l + tw / 2)}"`;
}
// Every wild's multiplier is ONE pink gem in the wild's top-left corner (single wild cell, full reel, merged group =
// the product). Left-aligned in a 150-wide box so "x4" .. "x1000" all start at the corner. MX_NUDGE moves it per
// art key (fractions of a cell, +x right, +y down) if an art set ever puts a face there; the current set's corners
// are hair / ceiling / props, so all zero.
const CORNER_W = 150;
export const MX_NUDGE: Record<string, [number, number]> = { W: [0, 0], WF: [0, 0], WM2: [0, 0], WM3: [0, 0], WM4: [0, 0], WM5: [0, 0] };
export const nudgeCSS = (key: string) => { const [x, y] = MX_NUDGE[key] || [0, 0]; return x || y ? `--mxdx:${x};--mxdy:${y};` : ''; };
export function gemHTML(v: number, extra = '', style = '') {
	ensureMxDefs();
	return `<div class="mx${extra ? ' ' + extra : ''}" style="${style}" data-v="${v}" ${mxSpan('x' + v, CORNER_W, 'start')}>${mxSVG('x' + v, CORNER_W, 'start')}</div>`;
}
/** Update a multiplier in place; by default it pops (transform only) over its burst sprite. fx=false: text only. */
export function setGem(el: Element | null, v: number, fx = true) {
	if (!el) return;
	const g = el as HTMLElement, t = 'x' + v;
	if (g.dataset.v === String(v) && !fx) return;
	g.innerHTML = mxSVG(t, CORNER_W, 'start');
	const tw = t.length * CHAR_W, pc = (n: number) => ((n / CORNER_W) * 100).toFixed(1);
	g.dataset.v = String(v); g.dataset.tl = pc(5); g.dataset.tr = pc(5 + tw); g.dataset.cx = pc(5 + tw / 2);
	if (!fx) return;
	mxBurst(g);
	g.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.32)', offset: .35 }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(.3,1.6,.5,1)' });
}
/** reel (0-based) picks that reel's own elf as the single wild (W_R1..W_R5, the same elf that fills the reel when the
 * wilds merge); without art for that reel it falls back to the generic W (+ its win pose). */
export function symHTML(name: string, v?: number, reel?: number) {
	if (name === 'W') {
		const val = v || 1; // v === 0 (an EGW split under 4, egwParts.ts): no badge at all
		const rk = reel !== undefined && ART['W_R' + (reel + 1)] ? 'W_R' + (reel + 1) : '';
		const wArt = rk ? glowLayer(rk, 2) + img(rk) : ART.W ? glowLayer('W') + img('W') + winFx('W') : '';
		return `<div class="sym W${wArt ? ' art' : ''}${rk ? ' wReel' : ''}">${wArt ? wArt : `<span class="nm">WILD</span>${ph('W')}<span class="plate">WILD</span>`}</div>${v === 0 ? '' : gemHTML(val, '', nudgeCSS('W'))}<div class="lock"><i class="lkI" style="${lockIconCSS()}"></i><span class="lkT">LOCKED</span>${DOTS}</div>`;
	}
	const t = name[0];
	if (ART[name]) return `<div class="sym ${t} ${name} art">${glowLayer(name)}${img(name)}${winFx(name)}</div>`;
	return `<div class="sym ${t} ${name}"><span class="nm">${(SYMBOL_NAMES[name] || name).toUpperCase()}</span>${ph(name)}</div>`;
}
export function buildCells() {
	const c = $('#cells'); c.innerHTML = '';
	for (let r = 0; r < REELS; r++) for (let row = 0; row < ROWS; row++) {
		const d = document.createElement('div'); d.className = 'cell'; d.id = `c${r}${row}`; c.appendChild(d);
	}
}
export const cellEl = (r: number, row: number) => document.getElementById(`c${r}${row}`) as HTMLElement;
/** Render one cell (reel stops are animated by reels.ts; cls adds a one-shot CSS class). */
export function renderCell(r: number, row: number, cls?: string | null, delayMs = 0) {
	const d = cellEl(r, row), p = pos(r, row);
	d.style.left = p.x + 'px'; d.style.top = p.y + 'px';
	d.innerHTML = symHTML(S.sym[r]?.[row] ?? 'L5', S.vals.get(k(r, row)), r);
	d.classList.toggle('wild', S.sym[r]?.[row] === 'W');
	d.style.visibility = S.full.has(r) ? 'hidden' : 'visible';
	d.classList.remove('sprWin', 'spinning', 'noBlur');
	if (cls) {
		d.classList.remove(cls); void d.offsetWidth; d.classList.add(cls);
		if (delayMs) (d.querySelector('.sym') as HTMLElement | null)?.style.setProperty('animation-delay', delayMs + 'ms');
	}
}
let ovHook: ((ov: HTMLElement) => void) | null = null;
/** Called for every overlay after each render (stacks.ts starts the merge_idle / letters sheets there). */
export function setOverlayHook(f: (ov: HTMLElement) => void) { ovHook = f; }
export function renderOverlays(anim: boolean | number = false) {
	const o = $('#overlays'); o.innerHTML = '';
	const inGroup = new Set<number>(); S.groups.forEach((g) => g.reels.forEach((r) => inGroup.add(r)));
	S.groups.forEach((g) => {
		const n = g.reels.length, key = `WM${n}`;
		const d = document.createElement('div'); d.className = 'ov merge';
		d.style.left = pos(g.reels[0], 0).x + 'px'; d.style.width = n * S.cell + 'px';
		// The r8d still (n reels x 4 rows, same aspect as the merged area) fills the overlay edge to edge.
		d.classList.add('art');
		d.innerHTML = stillHTML(g.reels) + `<i class="ovWinO"></i>` + frameHTML(g.reels) + gemHTML(g.product, 'stack', nudgeCSS(key)) + `<div class="ovrd">${DOTS}</div>`;
		d.dataset.reels = g.reels.join(',');
		if (!anim) d.style.animation = 'none';
		o.appendChild(d);
	});
	[...S.full].forEach(([r, v]) => {
		if (inGroup.has(r)) return;
		const d = document.createElement('div'); d.className = 'ov full';
		d.style.left = pos(r, 0).x + 'px'; d.style.width = S.cell + 'px';
		d.classList.add('art');
		d.innerHTML = stillHTML([r]) + `<i class="ovWinO"></i>` + frameHTML([r]) + gemHTML(v, 'stack', nudgeCSS('WF')) + `<div class="ovrd">${DOTS}</div>`;
		d.dataset.reel = String(r);
		if (anim !== r) d.style.animation = 'none';
		o.appendChild(d);
	});
	if (ovHook) o.querySelectorAll<HTMLElement>('.ov').forEach((d) => ovHook!(d));
}
/** The multiplier shown for reel r's stack (its own full-reel wild, or the merged group it belongs to). */
export const ovMx = (r: number) => (document.querySelector<HTMLElement>(`.ov.full[data-reel="${r}"] .mx`) ||
	[...document.querySelectorAll<HTMLElement>('.ov.merge')].find((o) => o.dataset.reels?.split(',').includes(String(r)))?.querySelector<HTMLElement>('.mx') || null);
export function renderAll() {
	for (let r = 0; r < REELS; r++) for (let row = 0; row < ROWS; row++) renderCell(r, row);
	renderOverlays(false);
}
export function clearLines() {
	const c = $('#lines') as unknown as HTMLCanvasElement; c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
	document.querySelectorAll('.wlAmt').forEach((e) => e.remove());
	document.querySelectorAll('.cell').forEach((c) => c.classList.remove('win', 'dim', 'replace', 'out'));
	document.querySelectorAll('.ov.win').forEach((o) => o.classList.remove('win'));
	clearSymWins();
}
export function toast(html: string) { const t = $('#stepToast'); t.innerHTML = html; t.classList.remove('hidden'); }
export const hideToast = () => $('#stepToast').classList.add('hidden');
let bannerT: any;
export function banner(txt: string, ms = 1400) {
	const b = $('#banner'); b.textContent = txt; b.classList.remove('hidden'); clearTimeout(bannerT);
	if (ms) bannerT = setTimeout(() => b.classList.add('hidden'), ms * (S.turbo ? 0.5 : tempo()));
}
// C17: the round's win meter only counts up and never exceeds the 50,000x cap.
/** WIN field: counts up smoothly from what it shows to the new total (duration scaled by the step's size). */
export function setWinMeter(x: number) {
	const nx = Math.min(MAX_WIN_X, Math.max(S.meterX, x)), dx = nx - S.meterX;
	S.meterX = nx;
	if (dx > 0) countTo($('#win'), nx * bet(), countMs(dx, S.turbo) * tempo()); // x ANIM_TEMPO (turbo: 1)
	else setAmount($('#win'), nx * bet());
}
export function resetWinMeter() { S.meterX = 0; setAmount($('#win'), 0); }
/** Big-win banner. The amount climbs through the tiers (countup.ts countTiers: fast between tiers, a short crawl
 *  into each threshold, the tier title swaps in with a pop as it crosses, much faster past 1000x, eased into the
 *  exact amount). At 1000x the character layer fades in behind the amount (bigwinElves.ts, the Vi / Roxy / Coco POV group). Tap once = jump to the
 *  end, tap again (or wait) = close. Turbo shortens everything. featfx.ts adds burst / confetti / pop sheets. */
/** aifix 12: win-title type system hook. Sets data-tier (big|mega|super|epic|legendary) for the CSS type ramp and,
 *  when the hand-lettered sprite exists (manifest key title_<tier>win, from elfhaus-brand-v3/titles), swaps the text
 *  for it via --title-img + .spr. The text stays in the DOM (aria-label) so a missing sprite falls back to type. */
function titleHook(T: HTMLElement, name: string) {
	const tier = name.split(' ')[0].toLowerCase(), src = ART['title_' + tier + 'win'];
	T.dataset.tier = tier; T.setAttribute('aria-label', name);
	T.classList.toggle('spr', !!src);
	if (src) T.style.setProperty('--title-img', `url("${src}")`); else T.style.removeProperty('--title-img');
}
export async function bigWin(x: number, label?: string) {
	const B = $('#bigwin'), T = B.querySelector('.bwTier') as HTMLElement;
	T.textContent = label || ''; T.classList.toggle('on', !!label); T.classList.remove('spr'); delete T.dataset.tier; if (label) T.dataset.tier = 'label';
	(B.querySelector('.bwX') as HTMLElement).textContent = `${x.toLocaleString('en-US')}x`;
	const amt = B.querySelector('.bwAmt') as HTMLElement; setAmount(amt, 0);
	B.classList.remove('hidden'); B.classList.remove('chars'); fxHooks.start?.(B, x);
	sfx('bigwin_sting'); duck(true); const cu = loop('bigwin_countup_loop'); setTimeout(() => voice('bigwin'), VOICE.bigWinDelayMs);
	let close = () => {}; const closed = new Promise<void>((r) => (close = r));
	let landed = false, chars = false;
	const tap = () => { if (!landed) skipCounts(); else close(); };
	B.addEventListener('pointerdown', tap);
	await countTiers(amt, x, bet(), {
		turbo: S.turbo,
		onTier: (i) => { if (label) return; T.textContent = BIG_TIERS[i].name; titleHook(T, BIG_TIERS[i].name); T.classList.add('on'); T.classList.remove('pop'); void T.offsetWidth; T.classList.add('pop'); fxHooks.tier?.(B, i); },
		onX: (v) => { if (!chars && v >= 1000) { chars = true; B.classList.add('chars'); fxHooks.chars?.(B); } },
	});
	landed = true; cu.stop(200);
	await Promise.race([waitRaw(S.turbo ? 700 * 0.35 : x >= 1000 ? 2200 : 1500), closed]);
	duck(false);
	B.removeEventListener('pointerdown', tap); B.classList.add('hidden'); B.classList.remove('chars'); fxHooks.end?.(B);
}
type BwHooks = { start?: (B: HTMLElement, x: number) => void; tier?: (B: HTMLElement, i: number) => void; chars?: (B: HTMLElement) => void; end?: (B: HTMLElement) => void };
const fxHooks: BwHooks = {};
export function setBigWinFx(h: BwHooks) { Object.assign(fxHooks, h); }
