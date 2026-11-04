import { drawFrame } from './skin';
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
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const turbo = () => S.turbo;
const live = new Set<Animation>();
const anim = (el: Element, kf: Keyframe[], o: KeyframeAnimationOptions) => { const a = el.animate(kf, o); live.add(a); a.finished.catch(() => {}).finally(() => live.delete(a)); return a; };
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
	const at = delay + 190 * kT;   // the burst fires as the symbol collapses
	const parts: Animation[] = [pop];
	// cloud puffs: a ring of 5 flat cream blobs that swell and fade
	for (let i = 0; i < 5; i++) {
		const a = (i / 5) * Math.PI * 2 + 0.4, b = document.createElement('i'); b.className = 'pfCloud'; paintPart(b, 'puff_cloud'); fx.appendChild(b);
		const dx = Math.cos(a) * 22, dy = Math.sin(a) * 22;
		parts.push(anim(b, [
			{ transform: 'translate(-50%,-50%) translate(0,0) scale(.2)', opacity: 1 },
			{ transform: `translate(-50%,-50%) translate(${dx * 0.8}%,${dy * 0.8}%) scale(1)`, opacity: 1, offset: 0.45 },
			{ transform: `translate(-50%,-50%) translate(${dx}%,${dy}%) scale(.6)`, opacity: 0 },
		], { duration: 380 * kT, delay: at, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'both' }));
	}
	// flakes: 7 tumble out and drift down a touch
	for (let i = 0; i < 7; i++) {
		const a = (i / 7) * Math.PI * 2 + Math.random() * 0.5, r = 70 + Math.random() * 40, f = document.createElement('i');
		f.className = 'pfFlake'; paintPart(f, 'puff_flake'); fx.appendChild(f);
		const sc = 0.75 + Math.random() * 0.5, rot = (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 120);
		const dx = Math.cos(a) * r, dy = Math.sin(a) * r;
		parts.push(anim(f, [
			{ transform: `translate(-50%,-50%) translate(0,0) rotate(0deg) scale(${sc * 0.3})`, opacity: 1 },
			{ transform: `translate(-50%,-50%) translate(${dx * 0.75}%,${dy * 0.75}%) rotate(${rot * 0.6}deg) scale(${sc})`, opacity: 1, offset: 0.55 },
			{ transform: `translate(-50%,-50%) translate(${dx}%,${dy + 30}%) rotate(${rot}deg) scale(${sc * 0.7})`, opacity: 0 },
		], { duration: 520 * kT, delay: at + i * 8, easing: 'cubic-bezier(.15,.75,.35,1)', fill: 'both' }));
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
	for (let i = 0; i < 6; i++) {
		const a = (i / 6) * Math.PI * 2 + 0.25 + Math.random() * 0.4, r = 230 + Math.random() * 90, f = partEl(fx, 'flake', 13 + Math.random() * 5);
		const dx = Math.cos(a) * r, dy = Math.sin(a) * r - 40, sw = (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 25), rot = (Math.random() < 0.5 ? -1 : 1) * (160 + Math.random() * 160);
		parts.push(anim(f, [
			{ transform: 'translate(-50%,-50%) translate(0,0) rotate(0deg) scale(.3)', opacity: 0 },
			{ transform: `translate(-50%,-50%) translate(${dx * 0.7}%,${dy * 0.7}%) rotate(${rot * 0.45}deg) scale(1)`, opacity: 1, offset: 0.3, easing: 'cubic-bezier(.45,0,.55,1)' },
			{ transform: `translate(-50%,-50%) translate(${dx * 0.86 + sw}%,${dy * 0.86 + 70}%) rotate(${rot * 0.75}deg) scale(.9)`, opacity: .55, offset: 0.62, easing: 'cubic-bezier(.45,0,.55,1)' },
			{ transform: `translate(-50%,-50%) translate(${dx * 0.92 + sw * 0.4}%,${dy * 0.92 + 110}%) rotate(${rot * 0.88}deg) scale(.85)`, opacity: 1, offset: 0.8, easing: 'cubic-bezier(.45,0,.55,1)' },
			{ transform: `translate(-50%,-50%) translate(${dx + sw}%,${dy + 160}%) rotate(${rot}deg) scale(.6)`, opacity: 0 },
		], { duration: 600 * kT, delay: at + 20 * kT + i * 10 * kT, easing: 'cubic-bezier(.15,.75,.35,1)', fill: 'both' }));
	}
	// glints: pop in round the burst and wink out
	for (let i = 0; i < 4; i++) {
		const a = (i / 4) * Math.PI * 2 + 0.8 + Math.random() * 0.5, r = 150 + Math.random() * 80, g = partEl(fx, 'glint', 20 + Math.random() * 6);
		const dx = Math.cos(a) * r, dy = Math.sin(a) * r;
		parts.push(anim(g, [
			{ transform: `translate(-50%,-50%) translate(${dx}%,${dy}%) scale(0) rotate(0deg)`, opacity: 1 },
			{ transform: `translate(-50%,-50%) translate(${dx}%,${dy}%) scale(1.1) rotate(45deg)`, opacity: 1, offset: 0.4 },
			{ transform: `translate(-50%,-50%) translate(${dx}%,${dy - 12}%) scale(0) rotate(90deg)`, opacity: 0 },
		], { duration: 320 * kT, delay: at + (60 + i * 45) * kT, easing: 'cubic-bezier(.3,0,.4,1)', fill: 'both' }));
	}
	// the symbol has burst: its tile stays and plays its border glint (the next unit drops in over it on a respin)
	setTimeout(() => { cell.style.setProperty('--gd', '0ms'); cell.classList.remove('tGlint'); void cell.offsetWidth; cell.classList.add('tGlint'); }, Math.max(0, at + 60 * kT));
	return Promise.all(parts.map(done)).then(() => { fx.remove(); cell.classList.add('puffed'); });
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
	const repl = next && next.type === 'respinStart' ? new Set((next as { replace: Pos[] }).replace.map((p) => k(p.reel, p.row))) : null;
	for (const w of wins) for (const p of w.positions) {
		const key = k(p.reel, p.row);
		if (seen.has(key)) continue; seen.add(key);
		if (S.full.has(p.reel) || S.sym[p.reel]?.[p.row] === 'W') continue;
		if (repl && !repl.has(key)) continue;
		out.push(p);
	}
	return { cells: out, refill: !!repl };
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
		await Promise.all(els.map((c, i) => puffCell(c, fast ? 0 : i * 35 * kT, kT)));
		if (fast) finish();
		if (refill) return;   // the respin's mini spins take these cells over (reels.ts spinMini clears .puffed)
		if (!fast) await new Promise<void>((r) => setTimeout(r, 120 * kT));
		await Promise.all(els.map((c, i) => reform(c, fast ? 0 : i * 25 * kT, kT)));
		if (fast) finish();
	};
	return { start, finish, holes: refill };
}
