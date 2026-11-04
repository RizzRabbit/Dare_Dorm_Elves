import { drawFrame, preloadPkg } from './skin';
// Win pop + snowflake puff (James 2026-10-31): every win plays  land -> line hit (winlines.ts) -> the winning symbols
// pop and puff into a cartoon snowflake burst -> the next respin fills the empty cells. When no respin follows (the
// round's last step) the symbols re-form out of the puff so the board is never left with holes.
// House style: flat cream flakes and cloud puffs with thick ink outlines, no glows. WAAPI transform / opacity only,
// all timing in real elapsed ms (frame-rate independent). One skippable stage ('puff', winstage.ts); turbo ~0.5x.
import { S, k } from './ui';
import type { BookEvent, Pos } from './typesBookEvent';

// the flake and the cloud bits are painted frames of the fx atlas (puff_flake / puff_cloud), drawn on a canvas each
// (atlas canvas; no inline SVG shapes). paintPart() sizes the canvas to its box once it is in the DOM.
function paintPart(el: HTMLElement, name: string) {
	const cv = document.createElement('canvas'); cv.width = cv.height = 96; cv.style.cssText = 'width:100%;height:100%;display:block';
	el.appendChild(cv); const g = cv.getContext('2d')!;
	const go = () => { if (!drawFrame(g, 'fx', name, 48, 48, 96, 96)) requestAnimationFrame(go); }; go();
}

// chalet item 7 (pizzazz): the extra parts are frames on one trimmed sheet (assets/fx/puff_parts.webp, built by
// elfhaus-chalet/build_puff.py): a small flake, a rounded glint, a soft flash, an ice-blue ring. Short and snappy: they
// all live inside the puff's own ~0.55 s. Reduced motion: no particles, the symbol just fades.
const PP = { url: 'assets/fx/puff_parts.webp', W: 444, H: 192, f: { flake: [0, 0, 72, 72], glint: [74, 0, 44, 44], flash: [120, 0, 128, 128], ring: [250, 0, 192, 192] } } as const;
function partEl(fx: HTMLElement, n: keyof typeof PP.f, size: number) {
	const [x, y, w, h] = PP.f[n], e = document.createElement('i'); e.className = 'pfP pf_' + n;
	e.style.cssText = `width:${size}%;aspect-ratio:${w}/${h};background:url(${PP.url}) no-repeat;background-size:${(PP.W / w) * 100}% ${(PP.H / h) * 100}%;` +
		`background-position:${PP.W === w ? 0 : (x / (PP.W - w)) * 100}% ${PP.H === h ? 0 : (y / (PP.H - h)) * 100}%`;
	fx.appendChild(e); return e;
}
// fix4 puff_cold (James 2026-11-04 "the snow doesn't load fast enough to be seen"): every puff texture (the fx skin
// package with puff_flake / puff_cloud, and the puff_parts sheet used as a CSS background) is fetched, decoded and drawn
// once during the loader, and the parts sheet is held in a 1px off-screen element so the first respin win never lazy-loads.
const keepPP: HTMLImageElement[] = [];
export function preloadPuff() {
	const pp = new Promise<void>((res) => { const im = new Image(); im.onload = () => { keepPP.push(im); im.decode().catch(() => {}).then(() => {
		const c = document.createElement('canvas'); c.width = c.height = 4; try { c.getContext('2d')?.drawImage(im, 0, 0, 4, 4); } catch { /* */ } res(); }); }; im.onerror = () => res(); im.src = PP.url; });
	const hold = document.createElement('i'); hold.setAttribute('aria-hidden', 'true');
	hold.style.cssText = `position:fixed;left:-9px;top:-9px;width:2px;height:2px;opacity:.01;pointer-events:none;background:url(${PP.url}) no-repeat 0 0/100% 100%`;
	document.body.appendChild(hold);
	return Promise.all([pp, preloadPkg('fx')]).then(() => {});
}
// fix4 puff linger: the snow, powder and glitter outlive the cell's respin as a non-blocking overlay (#puffLinger, under
// the board's input, pointer-events none). reels.ts hands a cell's running burst here when its respin starts.
function lingerLayer(cell: HTMLElement) {
	const par = cell.offsetParent as HTMLElement | null; if (!par) return null;
	let L = par.querySelector<HTMLElement>(':scope>#puffLinger');
	if (!L) { L = document.createElement('div'); L.id = 'puffLinger'; L.setAttribute('aria-hidden', 'true'); par.appendChild(L); }
	return L;
}
/** A respin is taking `cell` over: keep its still-drifting burst going above the board, out of the way of input. */
export function lingerOut(fx: HTMLElement, cell: HTMLElement) {
	const L = fx.dataset.linger === '1' ? lingerLayer(cell) : null; if (!L) { fx.remove(); return; }
	const h = document.createElement('div'); h.className = 'pfHost';
	h.style.cssText = `left:${cell.offsetLeft}px;top:${cell.offsetTop}px;width:${cell.offsetWidth}px;height:${cell.offsetHeight}px`;
	L.appendChild(h); h.appendChild(fx); fx.dataset.host = '1';
}
/** The next event is here: fade any lingering burst out cleanly (200 ms). */
export function fadeLinger() {
	document.querySelectorAll<HTMLElement>('#puffLinger>.pfHost').forEach((h) => { if (h.dataset.out) return; h.dataset.out = '1';
		h.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {}).finally(() => h.remove()); });
}
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const turbo = () => S.turbo;
const live = new Set<Animation>();
// fix4: only the burst (pop / clouds / flash / ring) is skippable; the linger (snow / powder / glitter) stays
// out of `live` so a line-stage skip (finish) does not cut the drift short while the respin starts.
const anim = (el: Element, kf: Keyframe[], o: KeyframeAnimationOptions, track = true) => { const a = el.animate(kf, o); if (track) { live.add(a); a.finished.catch(() => {}).finally(() => live.delete(a)); } return a; };
const done = (a: Animation) => a.finished.then(() => {}, () => {});

/** Pop one cell's symbol and burst it into flakes. Resolves when the burst has cleared. */
function puffCell(cell: HTMLElement, delay: number, kT: number) {
	const sym = cell.querySelector<HTMLElement>('.sym'); if (!sym) return Promise.resolve();
	if (reduced()) return done(anim(sym, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay, easing: 'ease-out', fill: 'forwards' })).then(() => cell.classList.add('puffed'));
	const fx = document.createElement('div'); fx.className = 'puffFx'; fx.setAttribute('aria-hidden', 'true'); cell.appendChild(fx);
	const pop = anim(sym, [
		{ transform: 'scale(1)', opacity: 1 },
		{ transform: 'scale(1.2,1.12)', opacity: 1, offset: 0.35, easing: 'cubic-bezier(.3,0,.7,1)' },   // swell (pop)
		{ transform: 'scale(.82,.9)', opacity: 1, offset: 0.6 },                                          // squash
		{ transform: 'scale(0)', opacity: 0 },
	], { duration: 300 * kT, delay, easing: 'ease-in', fill: 'forwards' });
	const at = delay + 170 * kT;   // the burst fires as the symbol collapses
	// fix4 linger (James 2026-11-04): the burst itself (swell, pop, throw) keeps its timing; the snow, powder and glitter
	// then hang about ~1.2-1.5 s in all (flakes drift down, the powder fades slowly) so it reads at 1x. Turbo stays short.
	// Only `parts` (pop, clouds, flash, ring) gate the game flow; `slow` (the linger) never does.
	const L = kT < 1 ? 1 : 2.7, slow: Animation[] = [];
	const parts: Animation[] = [pop];
	const linger = (el: Element, kf: Keyframe[], o: KeyframeAnimationOptions) => { const a = anim(el, kf, o, false); slow.push(a); return a; };
	// cloud puffs: a ring of 5 flat cream blobs that swell and fade
	for (let i = 0; i < 6; i++) {
		const a = (i / 6) * Math.PI * 2 + 0.4, b = document.createElement('i'); b.className = 'pfCloud'; paintPart(b, 'puff_cloud'); fx.appendChild(b);
		const dx = Math.cos(a) * 22, dy = Math.sin(a) * 22;
		parts.push(anim(b, [
			{ transform: 'translate(-50%,-50%) translate(0,0) scale(.2)', opacity: 1 },
			{ transform: `translate(-50%,-50%) translate(${dx * 0.8}%,${dy * 0.8}%) scale(1)`, opacity: 1, offset: 0.45 },
			{ transform: `translate(-50%,-50%) translate(${dx}%,${dy}%) scale(.6)`, opacity: 0 },
		], { duration: 380 * kT, delay: at, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'both' }));
	}
	// flakes: 12 tumble out (James 2026-11-04 "More snow": was 7) and drift down a touch
	for (let i = 0; i < 12; i++) {
		const a = (i / 12) * Math.PI * 2 + Math.random() * 0.5, r = 85 + Math.random() * 45, f = document.createElement('i');
		f.className = 'pfFlake'; paintPart(f, 'puff_flake'); fx.appendChild(f);
		const sc = 0.75 + Math.random() * 0.5, rot = (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 120);
		const dx = Math.cos(a) * r, dy = Math.sin(a) * r;
		const sw = (Math.random() < 0.5 ? -1 : 1) * (15 + Math.random() * 20);
		linger(f, L > 1 ? [
			{ transform: `translate(-50%,-50%) translate(0,0) rotate(0deg) scale(${sc * 0.3})`, opacity: 1, easing: 'cubic-bezier(.15,.75,.35,1)' },
			{ transform: `translate(-50%,-50%) translate(${dx * 0.75}%,${dy * 0.75}%) rotate(${rot * 0.6}deg) scale(${sc})`, opacity: 1, offset: 0.6 / L, easing: 'cubic-bezier(.45,0,.55,1)' },
			{ transform: `translate(-50%,-50%) translate(${dx * 0.9 + sw}%,${dy * 0.9 + 70}%) rotate(${rot * 0.85}deg) scale(${sc * 0.9})`, opacity: 1, offset: 0.55, easing: 'cubic-bezier(.45,0,.55,1)' },
			{ transform: `translate(-50%,-50%) translate(${dx - sw * 0.5}%,${dy + 160}%) rotate(${rot}deg) scale(${sc * 0.7})`, opacity: 0 },
		] : [
			{ transform: `translate(-50%,-50%) translate(0,0) rotate(0deg) scale(${sc * 0.3})`, opacity: 1 },
			{ transform: `translate(-50%,-50%) translate(${dx * 0.75}%,${dy * 0.75}%) rotate(${rot * 0.6}deg) scale(${sc})`, opacity: 1, offset: 0.6 },
			{ transform: `translate(-50%,-50%) translate(${dx}%,${dy + 45}%) rotate(${rot}deg) scale(${sc * 0.7})`, opacity: 0 },
		], { duration: 480 * kT * L, delay: at + i * 5 * kT, easing: L > 1 ? 'linear' : 'cubic-bezier(.15,.75,.35,1)', fill: 'both' });
	}
	// short flash + an ice-blue ring that rings out as the symbol bursts
	const fl = partEl(fx, 'flash', 120);
	parts.push(anim(fl, [
		{ transform: 'translate(-50%,-50%) scale(.35)', opacity: 0 },
		{ transform: 'translate(-50%,-50%) scale(.95)', opacity: .95, offset: 0.3 },
		{ transform: 'translate(-50%,-50%) scale(1.15)', opacity: 0 },
	], { duration: 200 * kT, delay: at - 20 * kT, easing: 'ease-out', fill: 'both' }));
	const rg = partEl(fx, 'ring', 100);
	parts.push(anim(rg, [
		{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 },
		{ transform: 'translate(-50%,-50%) scale(.85)', opacity: 1, offset: 0.25 },
		{ transform: 'translate(-50%,-50%) scale(1.45)', opacity: 0 },
	], { duration: 380 * kT, delay: at, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'both' }));
	// small flakes: thrown further, then drift down with a sway and a twinkle
	for (let i = 0; i < 14; i++) {
		const a = (i / 14) * Math.PI * 2 + 0.25 + Math.random() * 0.4, r = 260 + Math.random() * 110, f = partEl(fx, 'flake', 13 + Math.random() * 5);
		const dx = Math.cos(a) * r, dy = Math.sin(a) * r - 40, sw = (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 25), rot = (Math.random() < 0.5 ? -1 : 1) * (160 + Math.random() * 160);
		linger(f, [
			{ transform: 'translate(-50%,-50%) translate(0,0) rotate(0deg) scale(.3)', opacity: 0, easing: L > 1 ? 'cubic-bezier(.15,.75,.35,1)' : undefined },
			{ transform: `translate(-50%,-50%) translate(${dx * 0.7}%,${dy * 0.7}%) rotate(${rot * 0.45}deg) scale(1)`, opacity: 1, offset: L > 1 ? 0.12 : 0.3, easing: 'cubic-bezier(.45,0,.55,1)' },
			{ transform: `translate(-50%,-50%) translate(${dx * 0.86 + sw}%,${dy * 0.86 + 70}%) rotate(${rot * 0.75}deg) scale(.9)`, opacity: .55, offset: 0.62, easing: 'cubic-bezier(.45,0,.55,1)' },
			{ transform: `translate(-50%,-50%) translate(${dx * 0.92 + sw * 0.4}%,${dy * 0.92 + 110}%) rotate(${rot * 0.88}deg) scale(.85)`, opacity: 1, offset: 0.8, easing: 'cubic-bezier(.45,0,.55,1)' },
			{ transform: `translate(-50%,-50%) translate(${dx + sw}%,${dy + 190}%) rotate(${rot}deg) scale(.6)`, opacity: 0 },
		], { duration: 480 * kT * L, delay: at + 20 * kT + i * 5 * kT, easing: L > 1 ? 'linear' : 'cubic-bezier(.15,.75,.35,1)', fill: 'both' });
	}
	// powder dust (James 2026-11-04): a fine misty bloom of snow dust behind the flakes (the painted cloud frame, large and
	// faint), blooms out and fades inside the burst
	for (let i = 0; i < 3; i++) {
		const a = (i / 3) * Math.PI * 2 + Math.random() * 0.6, b = document.createElement('i'); b.className = 'pfCloud pfDust'; paintPart(b, 'puff_cloud'); fx.prepend(b);
		b.style.width = (70 + Math.random() * 20) + '%';
		const dx = Math.cos(a) * 12, dy = Math.sin(a) * 12;
		linger(b, L > 1 ? [
			{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 0, easing: 'cubic-bezier(.2,.7,.3,1)' },
			{ transform: `translate(-50%,-50%) translate(${dx * 0.6}%,${dy * 0.6}%) scale(1)`, opacity: .42, offset: 0.13, easing: 'cubic-bezier(.3,0,.6,1)' },
			{ transform: `translate(-50%,-50%) translate(${dx * 0.85}%,${dy * 0.85 + 8}%) scale(1.25)`, opacity: .34, offset: 0.45, easing: 'cubic-bezier(.37,0,.63,1)' },
			{ transform: `translate(-50%,-50%) translate(${dx}%,${dy + 18}%) scale(1.45)`, opacity: 0 },
		] : [
			{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
			{ transform: `translate(-50%,-50%) translate(${dx * 0.6}%,${dy * 0.6}%) scale(1)`, opacity: .42, offset: 0.35 },
			{ transform: `translate(-50%,-50%) translate(${dx}%,${dy + 10}%) scale(1.35)`, opacity: 0 },
		], { duration: 480 * kT * L, delay: at - 10 * kT + i * 20 * kT, easing: L > 1 ? 'linear' : 'cubic-bezier(.2,.7,.3,1)', fill: 'both' });
	}
	// glitter: a few tiny sparkles (the painted glint frame, small) twinkle once around the burst
	for (let i = 0; i < (L > 1 ? 9 : 5); i++) {
		const a = Math.random() * Math.PI * 2, r = 90 + Math.random() * 160, g = partEl(fx, 'glint', 8 + Math.random() * 4);
		const dx = Math.cos(a) * r, dy = Math.sin(a) * r, t0 = at + (60 + Math.random() * (L > 1 ? 900 : 220)) * kT;
		linger(g, [
			{ transform: `translate(-50%,-50%) translate(${dx}%,${dy}%) scale(0) rotate(0deg)`, opacity: 0 },
			{ transform: `translate(-50%,-50%) translate(${dx}%,${dy}%) scale(1) rotate(30deg)`, opacity: 1, offset: 0.4 },
			{ transform: `translate(-50%,-50%) translate(${dx}%,${dy + 8}%) scale(0) rotate(60deg)`, opacity: 0 },
		], { duration: 220 * kT * (L > 1 ? 1.6 : 1), delay: t0, easing: 'ease-out', fill: 'both' });
	}
	// glints: pop in round the burst and wink out
	for (let i = 0; i < 4; i++) {
		const a = (i / 4) * Math.PI * 2 + 0.8 + Math.random() * 0.5, r = 150 + Math.random() * 80, g = partEl(fx, 'glint', 20 + Math.random() * 6);
		const dx = Math.cos(a) * r, dy = Math.sin(a) * r;
		linger(g, [
			{ transform: `translate(-50%,-50%) translate(${dx}%,${dy}%) scale(0) rotate(0deg)`, opacity: 1 },
			{ transform: `translate(-50%,-50%) translate(${dx}%,${dy}%) scale(1.1) rotate(45deg)`, opacity: 1, offset: 0.4 },
			{ transform: `translate(-50%,-50%) translate(${dx}%,${dy - 12}%) scale(0) rotate(90deg)`, opacity: 0 },
		], { duration: 320 * kT * (L > 1 ? 1.8 : 1), delay: at + (60 + i * 45) * kT, easing: 'cubic-bezier(.3,0,.4,1)', fill: 'both' });
	}
	// the symbol has burst: its tile stays and plays its border glint (the next unit drops in over it on a respin)
	setTimeout(() => { cell.style.setProperty('--gd', '0ms'); cell.classList.remove('tGlint'); void cell.offsetWidth; cell.classList.add('tGlint'); }, Math.max(0, at + 60 * kT));
	// the game flow waits for the burst only (plus the old burst length, so the respin keeps its normal timing); the
	// linger keeps drifting on its own and the fx clears itself when the last flake is gone (wherever reels.ts moved it)
	fx.dataset.linger = '1';
	const all = parts.concat(slow);
	Promise.all(all.map(done)).then(() => { const h = fx.parentElement; fx.remove(); if (h?.classList.contains('pfHost')) h.remove(); });
	const oldEnd = at + (20 + 13 * 5 + 480) * kT;
	return Promise.all([...parts.map(done), new Promise<void>((r) => setTimeout(r, oldEnd))]).then(() => { if (!fx.dataset.host) cell.classList.add('puffed'); });
}
/** Re-form a puffed symbol (no respin follows): a quick pop back in. */
function reform(cell: HTMLElement, delay: number, kT: number) {
	const sym = cell.querySelector<HTMLElement>('.sym'); if (!sym) return Promise.resolve();
	sym.getAnimations().forEach((a) => a.cancel());
	cell.classList.remove('puffed');
	if (reduced()) return done(anim(sym, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay, easing: 'ease-out' }));
	return done(anim(sym, [
		{ transform: 'scale(0)', opacity: 0 },
		{ transform: 'scale(1.12,1.08)', opacity: 1, offset: 0.6 },
		{ transform: 'scale(.97,1.02)', offset: 0.82 },
		{ transform: 'scale(1)', opacity: 1 },
	], { duration: 260 * kT, delay, easing: 'ease-out' }));
}

/** Which cells a win puffs: its winning positions that are ordinary symbols (wilds, locked cells and full-reel /
 *  merged wilds stay on the board). With a respin next, only the cells that respin replaces. */
export function puffTargets(wins: { positions: Pos[] }[], next: BookEvent | undefined) {
	const seen = new Set<number>(), out: Pos[] = [];
	// James 2026-11-04: pop + puff ONLY on a win that leads into a respin (the respin refills the burst cells). A plain
	// line win (no respin next) keeps its symbols on the board with just the line / win highlight: no puff, no re-form.
	if (!next || next.type !== 'respinStart') return { cells: out, refill: false };
	const repl = new Set((next as { replace: Pos[] }).replace.map((p) => k(p.reel, p.row)));
	for (const w of wins) for (const p of w.positions) {
		const key = k(p.reel, p.row);
		if (seen.has(key)) continue; seen.add(key);
		if (S.full.has(p.reel) || S.sym[p.reel]?.[p.row] === 'W') continue;
		if (!repl.has(key)) continue;
		out.push(p);
	}
	return { cells: out, refill: true };
}
/** Chalet item 6: the pop + puff runs WITH the line hit (winlines.ts playWins starts it as the lines draw on), not after
 *  it. Returns null when nothing puffs. `start` resolves when the puff (and, with no respin next, the re-form) is done;
 *  `finish` jumps every running puff animation to its end (a skip of the line stage); `holes` = a respin refills them. */
export function puffWith(wins: { positions: Pos[] }[], next: BookEvent | undefined) {
	const { cells, refill } = puffTargets(wins, next);
	if (!cells.length) return null;
	const kT = turbo() ? 0.7 : 1;   // turbo: shortened but still a clear pop + puff
	const els = cells.sort((a, b) => a.reel - b.reel || a.row - b.row).map((p) => document.getElementById(`c${p.reel}${p.row}`)).filter(Boolean) as HTMLElement[];
	let fast = false;
	const finish = () => { fast = true; [...live].forEach((a) => a.finish()); };
	const start = async () => {
		fadeLinger();
		await Promise.all(els.map((c, i) => puffCell(c, fast ? 0 : i * 35 * kT, kT)));
		if (fast) finish();
		if (refill) return;   // the respin's mini spins take these cells over (reels.ts spinMini clears .puffed)
		if (!fast) await new Promise<void>((r) => setTimeout(r, 120 * kT));
		await Promise.all(els.map((c, i) => reform(c, fast ? 0 : i * 25 * kT, kT)));
		if (fast) finish();
	};
	return { start, finish, holes: refill };
}
