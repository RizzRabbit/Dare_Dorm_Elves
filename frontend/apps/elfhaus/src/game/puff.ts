// Win pop + snowflake puff (James 2026-10-31): every win plays  land -> line hit (winlines.ts) -> the winning symbols
// pop and puff into a cartoon snowflake burst -> the next respin fills the empty cells. When no respin follows (the
// round's last step) the symbols re-form out of the puff so the board is never left with holes.
// House style: flat cream flakes and cloud puffs with thick ink outlines, no glows. WAAPI transform / opacity only,
// all timing in real elapsed ms (frame-rate independent). One skippable stage ('puff', winstage.ts); turbo ~0.5x.
import { S, k } from './ui';
import { stage } from './winstage';
import type { BookEvent, Pos } from './typesBookEvent';

const NS = 'http://www.w3.org/2000/svg';
const INK = '#26140f', CREAM = '#fbf5ea', ICE = '#b9cfe0';
// one six-arm flake: ink under-stroke, cream top stroke (= outlined cartoon line), ice centre dot
const FLAKE = (() => {
	let d = '';
	for (let i = 0; i < 6; i++) {
		const a = (i * Math.PI) / 3, c = Math.cos(a), s = Math.sin(a), p = (r: number, o = 0) => `${(c * r - s * o).toFixed(1)} ${(s * r + c * o).toFixed(1)}`;
		d += `M0 0L${p(20)}M${p(11)}L${p(16, 6)}M${p(11)}L${p(16, -6)}`;
	}
	return `<svg viewBox="-26 -26 52 52" xmlns="${NS}"><path d="${d}" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>` +
		`<path d="${d}" fill="none" stroke="${CREAM}" stroke-width="4.2" stroke-linecap="round"/><circle r="4.5" fill="${ICE}" stroke="${INK}" stroke-width="2.5"/></svg>`;
})();
const PUFF = `<svg viewBox="-30 -30 60 60" xmlns="${NS}"><circle r="26" fill="${CREAM}" stroke="${INK}" stroke-width="5"/><circle cx="-8" cy="-9" r="7" fill="#fff"/></svg>`;

const turbo = () => S.turbo;
const live = new Set<Animation>();
const anim = (el: Element, kf: Keyframe[], o: KeyframeAnimationOptions) => { const a = el.animate(kf, o); live.add(a); a.finished.catch(() => {}).finally(() => live.delete(a)); return a; };
const done = (a: Animation) => a.finished.then(() => {}, () => {});

/** Pop one cell's symbol and burst it into flakes. Resolves when the burst has cleared. */
function puffCell(cell: HTMLElement, delay: number, kT: number) {
	const sym = cell.querySelector<HTMLElement>('.sym'); if (!sym) return Promise.resolve();
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
		const a = (i / 5) * Math.PI * 2 + 0.4, b = document.createElement('i'); b.className = 'pfCloud'; b.innerHTML = PUFF; fx.appendChild(b);
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
		f.className = 'pfFlake'; f.innerHTML = FLAKE; fx.appendChild(f);
		const sc = 0.75 + Math.random() * 0.5, rot = (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 120);
		const dx = Math.cos(a) * r, dy = Math.sin(a) * r;
		parts.push(anim(f, [
			{ transform: `translate(-50%,-50%) translate(0,0) rotate(0deg) scale(${sc * 0.3})`, opacity: 1 },
			{ transform: `translate(-50%,-50%) translate(${dx * 0.75}%,${dy * 0.75}%) rotate(${rot * 0.6}deg) scale(${sc})`, opacity: 1, offset: 0.55 },
			{ transform: `translate(-50%,-50%) translate(${dx}%,${dy + 30}%) rotate(${rot}deg) scale(${sc * 0.7})`, opacity: 0 },
		], { duration: 520 * kT, delay: at + i * 8, easing: 'cubic-bezier(.15,.75,.35,1)', fill: 'both' }));
	}
	return Promise.all(parts.map(done)).then(() => { fx.remove(); cell.classList.add('puffed'); });
}
/** Re-form a puffed symbol (no respin follows): a quick pop back in. */
function reform(cell: HTMLElement, delay: number, kT: number) {
	const sym = cell.querySelector<HTMLElement>('.sym'); if (!sym) return Promise.resolve();
	sym.getAnimations().forEach((a) => a.cancel());
	cell.classList.remove('puffed');
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
/** The pop + puff stage after a win's line hit. `next` = the book event after this win (a respinStart refills). */
export async function puffWins(wins: { positions: Pos[] }[], next: BookEvent | undefined) {
	const { cells, refill } = puffTargets(wins, next);
	if (!cells.length) return;
	const kT = turbo() ? 0.5 : 1;
	const els = cells.sort((a, b) => a.reel - b.reel || a.row - b.row).map((p) => document.getElementById(`c${p.reel}${p.row}`)).filter(Boolean) as HTMLElement[];
	const finishAll = () => [...live].forEach((a) => a.finish());
	await stage('puff', finishAll, () => Promise.all(els.map((c, i) => puffCell(c, i * 35 * kT, kT))));
	if (refill) return;   // the respin's mini spins take these cells over (reels.ts spinMini clears .puffed)
	let fast = false;
	await stage('reform', () => { fast = true; finishAll(); }, async () => {
		await new Promise<void>((r) => setTimeout(r, 120 * kT));
		await Promise.all(els.map((c, i) => reform(c, fast ? 0 : i * 25 * kT, kT)));
		if (fast) finishAll();
	});
}
/** Spin start / re-render: drop any leftover puff state. */
export function clearPuffs() {
	document.querySelectorAll('.puffFx').forEach((e) => e.remove());
	document.querySelectorAll<HTMLElement>('.cell.puffed').forEach((c) => { c.classList.remove('puffed'); c.querySelector<HTMLElement>('.sym')?.getAnimations().forEach((a) => a.cancel()); });
}
