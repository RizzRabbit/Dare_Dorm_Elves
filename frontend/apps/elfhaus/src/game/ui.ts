// DOM renderer (ported from prototype/app.js). It only displays what book events say.
import { bwpStart, bwpTier, bwpEnd } from './bwparticles'; // re-audit M1: code particles on the big-win banner
import { sfx, loop, duck } from './audio';
import { voice, VOICE } from './voice';
import { frameHTML } from './wildframe';
import ART_JSON from './art.generated.json';
import { MAX_WIN_X, ROWS, REELS, SYMBOL_NAMES, WIN_LEVELS, winEdgesFor, TITLE_ART } from './config';
import { elvesLevel } from './bigwinElves';
import type { Group } from './typesBookEvent';
import { DOTS } from './respin';
import { mxBurst, lockIconCSS, clearSymWins } from './fx';
import STACKS from './chalet/stacks.json';
import LETS_JSON from './chalet/stackletters.json';
import { hasRig, ovEdgeHTML, rigGlowHTML, rigHTML, tileHTML, tileTopHTML, wildLetsHTML } from './symrig';
import { countTo, countMs, setAmount, countTiers, BIG_TIERS, tierPlan, isCounting, setWinLevels, levelOf, WIN_EDGES } from './countup';
setWinLevels(WIN_LEVELS.standard); // v3.19: banner stages from the math's standard win levels
/** v20: the round's win-level edges by its mode (math WIN_LEVEL_EDGES_BY_MODE; base / ante / Dare = standard). Called at every round start. */
export function setRoundMode(mode?: string) { setWinLevels(winEdgesFor(mode)); }
import { presenting, beginStage, endStage, skipStage } from './winstage';
import { hold, tempo, gtempo } from './tempo';
import { clearRace } from './winlines';

export const ART = ART_JSON as Record<string, string | null>;
export const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;

export const S = {
	currency: 'USD', balance: 0, levels: [] as number[], betIdx: 0, ante: false, turbo: false, busy: false, auto: 0, autoBonus: false,   /* v3.18b: autoplay plays bonuses hands-free (AUTO-PLAY BONUS toggle, default off) */
	sym: [] as string[][], vals: new Map<number, number>(), full: new Map<number, number>(), groups: [] as Group[],
	roundBase: 0, meterX: 0, inBonus: false, cell: 100, ready: false, replay: false, replayBet: 0, roundBet: 0,
	jur: {} as Record<string, any>,
};
export const k = (r: number, row: number) => r * ROWS + row;
// v3.16b (#187): a resumed round shows and pays at its own stake (roundBet, from round.amount), never a snapped level
export const bet = () => (S.replay ? S.replayBet : S.roundBet > 0 ? S.roundBet : S.levels[S.betIdx] ?? 0);
/** Board pause at the old pace: stretched by ANIM_TEMPO and skippable by tap / Space (tempo.ts hold); turbo = 0.35x as before. */
export const wait = (ms: number) => (S.turbo ? waitRaw(ms * 0.35) : hold(ms));
/** Plain timer (win screens / resume: their pace is their own). */
export const waitRaw = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
export const pos = (r: number, row: number) => ({ x: r * S.cell, y: row * S.cell });

const ph = (_key: string) => ''; // no visible placeholder labels in release builds
// frameless set: the lit (win) outline is a second layer over the idle art, crossfaded by .cell.win (opacity only)
/** Hand-lettered bonus title (img, the label as its alt text) or the plain label when the art is missing. */
export function titleHTML(key: string, text: string) {
	const src = ART['bonus_' + (TITLE_ART[key] || key)], e = text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
	return src ? `<img class="tTitle" src="${src}" alt="${e}" draggable="false">` : e;
}
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
const stillSrc = (reels: number[]) => `assets/stacks/still/${stillPos(reels)}.webp`;
/** The WILD letters still: one trimmed frame per overlay width on a shared sheet (stackletters.json; WM3-WM5 share one). */
const LETS = LETS_JSON as unknown as { image: string; size: [number, number]; frames: Record<string, { x: number; y: number; w: number; h: number }>; place: Record<string, { f: string; src: [number, number]; box: [number, number, number, number] }> };
function letsHTML(reels: number[]) {
	const p = LETS.place[stillPos(reels)]; if (!p) return '';
	const f = LETS.frames[p.f], [AW, AH] = LETS.size, [W, H] = p.src, [x0, y0, x1, y1] = p.box, q = (v: number) => v.toFixed(3) + '%';
	const st = `left:${q((x0 / W) * 100)};top:${q((y0 / H) * 100)};width:${q(((x1 - x0) / W) * 100)};height:${q(((y1 - y0) / H) * 100)};` +
		`background-image:url(${LETS.image});background-size:${q((AW / f.w) * 100)} ${q((AH / f.h) * 100)};background-position:${q((f.x / (AW - f.w)) * 100)} ${q((f.y / (AH - f.h)) * 100)}`;
	return `<div class="mLets mStill"><i class="stkLets" style="${st}"></i></div>`;
}
/** Stack panels: one per reel for single stacks (each elf's colour), one per width for merges (positions only moved the flakes). */
const panelSrc = (reels: number[]) => `assets/stacks/still/${reels.length === 1 ? stillPos(reels) : 'WM' + reels.length}_panel.webp`;
// Chalet stacks: the panel plate + each full-body elf as her own cut-out layer (chalet/stacks.json boxes, art from
// assets/rig), so the elves breathe / sway / react on the board (chalet.css .stkElf, real-time CSS animation) instead of
// sitting in one flat picture. A merged stack shows each reel's elf over ONE panel and carries one multiplier.
const STK = STACKS as unknown as Record<string, { W: number; H: number; elves: { elf: string; x: number; y: number; w: number; h: number }[] }>;
const ELF_PHASE: Record<string, number> = { roxy: 0, jade: 1.3, vi: 2.1, coco: 0.7, delilah: 2.8 };
// fix4 B: every stack panel + elf cut-out is fetched and decoded once at load (kept referenced), so a merge / stack never
// waits on a lazy <img> load (no pop-in or blank frame when the merged overlay replaces the singles).
const stackKeep: HTMLImageElement[] = [];
let stacksWarm: Promise<void> | null = null;
export function preloadStacks() {
	if (stacksWarm) return stacksWarm;
	const urls = ['assets/stacks/still/WM2_panel.webp', 'assets/stacks/still/WM3_panel.webp', 'assets/stacks/still/WM4_panel.webp', 'assets/stacks/still/WM5_panel.webp',
		...[1, 2, 3, 4, 5].map((r) => `assets/stacks/still/WF_R${r}_panel.webp`), ...Object.keys(ELF_PHASE).map((e) => `assets/rig/elf_${e}.webp`)];
	stacksWarm = Promise.all(urls.map((u) => { const im = new Image(); im.decoding = 'async'; im.src = u; stackKeep.push(im); return im.decode().catch(() => {}); })).then(() => {});
	return stacksWarm;
}
function stillHTML(reels: number[]) {
	const L = STK[stillPos(reels)];
	if (!L) return `<div class="wart"><img src="${stillSrc(reels)}" alt="" draggable="false"></div>` + letsHTML(reels);
	const px = (v: number, d: number) => ((v / d) * 100).toFixed(3) + '%';
	const clip = `inset(${px(6, L.H)} ${px(7, L.W)} ${px(7, L.H)} ${px(6, L.W)} round ${px(34, L.W)} / ${px(34, L.H)})`;
	const elves = L.elves.map((e) => `<img class="stkElf e_${e.elf}" src="assets/rig/elf_${e.elf}.webp" alt="" draggable="false" style="left:${(e.x * 100).toFixed(3)}%;top:${(e.y * 100).toFixed(3)}%;width:${(e.w * 100).toFixed(3)}%;height:${(e.h * 100).toFixed(3)}%;--ph:${ELF_PHASE[e.elf] ?? 0}s">`).join('');
	return `<div class="wart chaletStk"><img class="stkPanel" src="${panelSrc(reels)}" alt="" draggable="false"><div class="stkElves" style="clip-path:${clip}"><div class="stkGrp">${elves}</div></div></div>` + letsHTML(reels);
}
// Multiplier lettering: text only, flat gold with a thick ink outline and one light band across the cap tops (chalet.css).
// All layers are SVG text sharing one viewBox (60 units high, 48-unit type), so it renders the same in Chrome and Safari.
const MX_H = 60, MX_FS = 48, MX_BASE = 50, CHAR_W = 27;
function ensureMxDefs() {
	if (document.getElementById('mxDefs')) return;
	const d = document.createElement('div');
	d.innerHTML = `<svg id="mxDefs" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true"></svg>`;
	document.body.appendChild(d.firstChild!);
}
type Anchor = 'start' | 'end' | 'middle';
const ax = (anchor: Anchor, w: number) => (anchor === 'end' ? w - 5 : anchor === 'start' ? 5 : w / 2);
// SPRITE_MAP 20 / 59: the multiplier is set in the painted gold bitmap font (font_gold atlas: cream-gold fill, ink line,
// offset shadow baked); each glyph is a nested <svg> window onto the atlas page. Until the font is decoded the old
// lettering shows for that frame only.
let FG: { img: string; W: number; H: number; px: number; base: number; fr: Record<string, { x: number; y: number; w: number; h: number; ox: number; oy: number; sw: number; sh: number; adv: number }> } | null = null;
fetch('assets/sprites/font_gold/font_gold.json').then((r) => r.json()).then((J) => {
	const fr: NonNullable<typeof FG>['fr'] = {};
	for (const [k, f] of Object.entries<any>(J.frames)) fr[k] = { x: f.frame.x, y: f.frame.y, w: f.frame.w, h: f.frame.h, ox: f.spriteSourceSize?.x || 0, oy: f.spriteSourceSize?.y || 0, sw: f.sourceSize.w, sh: f.sourceSize.h, adv: f.adv ?? f.sourceSize.w };
	FG = { img: 'assets/sprites/font_gold/' + J.meta.pages[0].image, W: J.meta.pages[0].size.w, H: J.meta.pages[0].size.h, px: J.meta.px, base: J.meta.asc, fr };
}).catch(() => {});
function mxGlyphs(t: string, w: number, anchor: Anchor) {
	const F = FG!, k = (MX_FS * 1.1) / F.px, gl = [...t].map((c) => F.fr['u' + c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')]);
	const adv = gl.reduce((s, f) => s + (f ? f.adv : 18), 0) * k;
	let x = anchor === 'end' ? w - 5 - adv : anchor === 'start' ? 5 : (w - adv) / 2; const y = MX_BASE - F.base * k;
	let out = '';
	for (const f of gl) { if (!f) { x += 18 * k; continue; }
		out += `<svg x="${(x + f.ox * k).toFixed(2)}" y="${(y + f.oy * k).toFixed(2)}" width="${(f.w * k).toFixed(2)}" height="${(f.h * k).toFixed(2)}" viewBox="${f.x} ${f.y} ${f.w} ${f.h}" overflow="hidden" preserveAspectRatio="none"><image href="${F.img}" width="${F.W}" height="${F.H}"/></svg>`;
		x += f.adv * k; }
	return `<svg viewBox="0 0 ${w} ${MX_H}" overflow="visible" aria-hidden="true">${out}</svg>`;
}
function mxSVG(t: string, w: number, anchor: Anchor) {
	if (FG) return mxGlyphs(t, w, anchor);
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
// Every wild's multiplier is ONE gold multiplier in the wild's top-left corner (single wild cell, full reel, merged group =
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
		const rk = reel !== undefined && (hasRig('W_R' + (reel + 1)) || ART['W_R' + (reel + 1)]) ? 'W_R' + (reel + 1) : '';
		const tail = `${v === 0 ? '' : gemHTML(val, '', nudgeCSS('W'))}<div class="lock"><i class="lkI" style="${lockIconCSS()}"></i><span class="lkT">LOCKED</span>${DOTS}</div>`;
		// rigged bust: separate pieces (tile card + recess | bust | tile border + light | WILD lettering | glow behind)
		if (rk && hasRig(rk)) return `${tileHTML(rk)}<div class="sym W art wReel rigd">${rigHTML(rk)}</div>${tileTopHTML(rk)}${wildLetsHTML(rk)}<div class="sym W art rigd symBack">${rigGlowHTML(rk, 2)}</div>${tail}`;
		const wArt = rk ? glowLayer(rk, 2) + img(rk) : ART.W ? glowLayer('W') + img('W') + winFx('W') : '';
		return `<div class="sym W${wArt ? ' art' : ''}${rk ? ' wReel' : ''}">${wArt ? wArt : `<span class="nm">WILD</span>${ph('W')}<span class="plate">WILD</span>`}</div>${tail}`;
	}
	const t = name[0];
	// the tile is its own piece beside the symbol (.cell > .tile + .sym): symbol motion never moves the tile
	if (hasRig(name)) { const fr = tileHTML(name); return `${fr}<div class="sym ${t} ${name} art rigd${fr ? ' fr' : ''}">${rigGlowHTML(name)}${rigHTML(name)}</div>`; }
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
	d.classList.remove('sprWin', 'spinning', 'noBlur', 'puffed');
	if (cls) {
		d.classList.remove(cls); void d.offsetWidth; d.classList.add(cls);
		if (delayMs) (d.querySelector('.sym') as HTMLElement | null)?.style.setProperty('animation-delay', delayMs + 'ms');
	}
}
/** An overlay's art pieces (the stack / merge art, its lettering and canvases, the badge), not its tile edge + light:
 *  entrance and win motion go on these, so the overlay's tile holds still like a cell's. */
export const ovArt = (ov: HTMLElement) => [...ov.querySelectorAll<HTMLElement>(':scope>:is(.wart,.mLets,canvas,.mx)')];
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
		d.innerHTML = stillHTML(g.reels) + ovEdgeHTML() + `<i class="ovWinO"></i>` + frameHTML(g.reels) + gemHTML(g.product, 'stack', nudgeCSS(key)) + `<div class="ovrd">${DOTS}</div>`;
		d.dataset.reels = g.reels.join(',');
		if (anim) d.classList.add('ovIn');
		o.appendChild(d);
	});
	[...S.full].forEach(([r, v]) => {
		if (inGroup.has(r)) return;
		const d = document.createElement('div'); d.className = 'ov full';
		d.style.left = pos(r, 0).x + 'px'; d.style.width = S.cell + 'px';
		d.classList.add('art');
		d.innerHTML = stillHTML([r]) + ovEdgeHTML() + `<i class="ovWinO"></i>` + frameHTML([r]) + gemHTML(v, 'stack', nudgeCSS('WF')) + `<div class="ovrd">${DOTS}</div>`;
		d.dataset.reel = String(r);
		if (anim === r) d.classList.add('ovIn');
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
	clearRace();
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
/** `payout`: the round's paid amount (finalWin / payoutFlow), which may sit up to 0.05x under the running total; the
 *  meter then settles on it (the only time it steps down). */
export function setWinMeter(x: number, payout = false): Promise<void> {
	const nx = Math.min(MAX_WIN_X, payout ? Math.max(0, x) : Math.max(S.meterX, x)), dx = nx - S.meterX;
	S.meterX = nx;
	if (dx > 0) return countTo($('#win'), nx * bet(), countMs(dx, S.turbo) * gtempo()); // anim-v4: studio pace (was x ANIM_TEMPO); turbo halves it
	if (dx < 0) return countTo($('#win'), nx * bet(), 120);   // payout settle: a short step down to the paid amount
	if (!isCounting($('#win'))) setAmount($('#win'), nx * bet()); // v3.17: never cut a running count short (staged skip)
	return Promise.resolve();
}
export function resetWinMeter() { S.meterX = 0; setAmount($('#win'), 0); }
/** Big-win banner. The amount climbs through the tiers (countup.ts countTiers paced2: races between tiers, crawls the last 1% into each
 *  threshold for ~1 s, holds while the tier title pops (overshoot + glow burst), jumps ahead and races on; eased into the
 *  exact amount). At EPIC WIN the 3-elf layer rises behind the amount, at LEGENDARY WIN (1000x) the 4-elf layer takes over behind the amount (bigwinElves.ts, the Vi / Roxy / Coco POV group). Tap once = jump to the
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
// v3.17 motion (James 2026-10-30): our original count-up motion, tuned to an industry-standard pacing reference. Everything the
// tier hits need is made before the count starts (title sprites decoded and painted once, glow + ghost layers
// created, geometry read once), and the hits are WAAPI transform / opacity only: no class restarts, no forced
// reflow, no text node or element creation, no getComputedStyle at a tier.
const EASE_BACK = 'cubic-bezier(.34,1.56,.64,1)';
type BwRig = { glow: HTMLElement; ghost: HTMLElement; warm: HTMLElement; neon: Record<string, string> };
let rig: BwRig | null = null;
async function prewarmBigWin(B: HTMLElement, T: HTMLElement, tiers: number[]) {
	const P = T.parentElement as HTMLElement;
	if (!rig) {
		const glow = document.createElement('div'); glow.className = 'bwGlow'; glow.setAttribute('aria-hidden', 'true');
		const ghost = document.createElement('div'); ghost.className = 'bwTier bwGhost'; ghost.setAttribute('aria-hidden', 'true');
		const warm = document.createElement('div'); warm.className = 'bwWarm'; warm.setAttribute('aria-hidden', 'true');
		rig = { glow, ghost, warm, neon: {} };
	}
	if (rig.glow.parentElement !== P) P.insertBefore(rig.glow, T);
	if (rig.ghost.parentElement !== P) P.insertBefore(rig.ghost, T);
	if (rig.warm.parentElement !== B) B.appendChild(rig.warm);
	// decode every title sprite this win will show and paint each once (a near-invisible layer) so the GPU has it
	rig.warm.textContent = '';
	const decodes: Promise<unknown>[] = [];
	for (const i of tiers) {
		const tier = BIG_TIERS[i].name.split(' ')[0].toLowerCase(), src = ART['title_' + tier + 'win'];
		if (!src) continue;
		const im = new Image(); im.src = src; decodes.push(im.decode().catch(() => {}));
		const d = document.createElement('div'); d.style.backgroundImage = `url("${src}")`; rig.warm.appendChild(d);
	}
	// neon colours per tier read once (CSS vars by data-tier), not at the hit
	const keep = T.dataset.tier;
	for (const i of tiers) { const tier = BIG_TIERS[i].name.split(' ')[0].toLowerCase(); T.dataset.tier = tier; rig.neon[tier] = getComputedStyle(T).getPropertyValue('--tt-neon').trim() || '#FFD27A'; }
	if (keep) T.dataset.tier = keep; else delete T.dataset.tier;
	await Promise.race([Promise.all(decodes), new Promise((r) => setTimeout(r, 250))]);
}
/** Tier hit: the new title scale-pops (0.7 -> 1.08 -> 1, ~220 ms ease-out-back), the outgoing title crossfades out
 *  (opacity + a small scale-up, ~180 ms), the round glow bursts behind it in the tier's neon, the amount gets a bump. */
function tierHit(T: HTMLElement, amt: HTMLElement, name: string, first: boolean, at: number) {
	const r = rig!; const tier = name.split(' ')[0].toLowerCase();
	if (!first) { // ghost = the outgoing title, same box (absolute over it), fades while the new one pops
		r.ghost.className = T.className + ' bwGhost'; r.ghost.dataset.tier = T.dataset.tier || ''; r.ghost.textContent = T.textContent;
		const img = T.style.getPropertyValue('--title-img'); if (img) r.ghost.style.setProperty('--title-img', img); else r.ghost.style.removeProperty('--title-img');
		r.ghost.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.12)' }], { duration: 180 * at, easing: 'ease-out', fill: 'forwards' });
	}
	if (T.textContent !== name) T.textContent = name; titleHook(T, name); T.classList.add('on');
	T.animate([{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 220 * at, easing: EASE_BACK });
	r.glow.style.setProperty('--tt-neon', r.neon[tier] || '#FFD27A');
	r.glow.animate([{ opacity: 0, transform: 'translateX(-50%) scale(.4)' }, { opacity: 0.95, transform: 'translateX(-50%) scale(1.05)', offset: 0.25 }, { opacity: 0, transform: 'translateX(-50%) scale(1.35)' }], { duration: 700 * at, easing: 'ease-out' });
	amt.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06)', offset: 0.35 }, { transform: 'scale(1)' }], { duration: 200 * at, easing: 'ease-out' });
}
/** `level` = the math win level from the synced edges applied to x (setWin passes it; computed here when absent). */
export async function bigWin(x: number, label?: string, level?: number) {
	const B = $('#bigwin'), T = B.querySelector('.bwTier') as HTMLElement;
	const at = S.turbo ? 0.6 : 1;
	const lvl = Number.isFinite(level) ? level! : levelOf(x, WIN_EDGES), top = elvesLevel(lvl);
	const { tiers } = tierPlan(x, S.turbo, lvl), idx = tiers.map((t) => t.i);
	T.textContent = label || ''; T.classList.toggle('on', !!label); T.classList.remove('spr', 'pop'); delete T.dataset.tier; if (label) T.dataset.tier = 'label';
	(B.querySelector('.bwX') as HTMLElement).textContent = `${x.toLocaleString('en-US')}x`;
	const amt = B.querySelector('.bwAmt') as HTMLElement; setAmount(amt, 0);
	B.classList.remove('hidden', 'out'); B.classList.remove('chars');
	// reserve the first title's box (invisible) so its landing does not push the amount down (no layout jump)
	if (!label && idx.length) { T.textContent = BIG_TIERS[idx[0]].name; titleHook(T, BIG_TIERS[idx[0]].name); }
	presenting(true);
	await prewarmBigWin(B, T, idx);
	// geometry for the glow, read once (not at the hit)
	{ const h = T.offsetHeight || 100; rig!.glow.style.top = `${T.offsetTop - h * 0.7}px`; rig!.glow.style.height = `${h * 2.4}px`;
		const g = rig!.ghost.style; g.position = 'absolute'; g.left = '0'; g.right = '0'; g.top = `${T.offsetTop}px`; g.opacity = '0'; g.pointerEvents = 'none'; }
	fxHooks.start?.(B, x, lvl); bwpStart(B, x);
	sfx('bigwin_sting'); duck(true); const cu = loop('bigwin_countup_loop'); setTimeout(() => voice('bigwin'), VOICE.bigWinDelayMs);
	let close = () => {}; const closed = new Promise<void>((r) => (close = r));
	let stIx = 0;
	// stages (winstage.ts): one per tier checkpoint, then the run to the final amount, then the landed banner
	const names = [...(label ? [] : idx.map((i) => 'bw:' + BIG_TIERS[i].name)), 'bw:final'];
	const counted = countTiers(amt, x, bet(), {
		turbo: S.turbo, level: lvl,
		onTier: (i) => {
			endStage(names[stIx]); stIx++; beginStage(names[stIx] ?? 'bw:final', () => counted.next());
			if (label) return; tierHit(T, amt, BIG_TIERS[i].name, i === idx[0], at); fxHooks.tier?.(B, i); bwpTier(i);
			if (top && elvesLevel(BIG_TIERS[i].level)) { B.classList.add('chars'); fxHooks.chars?.(B, BIG_TIERS[i].level); } // EPIC: 3 elves, LEGENDARY: 4
		},
	});
	beginStage(names[0], () => counted.next());
	const tap = () => { skipStage(); };
	B.addEventListener('pointerdown', tap);
	await counted;
	endStage(names[stIx] ?? 'bw:final');
	// the end: the amount lands on the exact value with a confident pop, then holds
	amt.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 280 * at, easing: EASE_BACK });
	cu.stop(200);
	beginStage('bw:landed', () => close());
	await Promise.race([waitRaw(S.turbo ? 700 * 0.35 : top ? 2200 : 1500), closed]);
	endStage('bw:landed');
	duck(false);
	B.removeEventListener('pointerdown', tap);
	// dismiss: a short fade (opacity only), then hidden
	B.classList.add('out'); await waitRaw(220 * at);
	B.classList.add('hidden'); B.classList.remove('out', 'chars'); fxHooks.end?.(B); bwpEnd(); rig?.warm && (rig.warm.textContent = '');
	presenting(false);
}
type BwHooks = { start?: (B: HTMLElement, x: number, level: number) => void; tier?: (B: HTMLElement, i: number) => void; chars?: (B: HTMLElement, level: number) => void; end?: (B: HTMLElement) => void };
const fxHooks: BwHooks = {};
export function setBigWinFx(h: BwHooks) { Object.assign(fxHooks, h); }
if (import.meta.env.DEV) (window as any).__bigWin = bigWin; // dev-only test hook (headless shots of the big-win tiers)
