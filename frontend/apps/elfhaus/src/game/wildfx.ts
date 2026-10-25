// Wild moments (fx_wild sheet, gen_fx_wild.py). Every effect is a pre-baked sprite (glow baked in) on a pooled
// canvas; only transform/opacity are animated by CSS, nothing animates filter or shadow.
//   wildLand(cell)   : the round frame flares (wflash) + a soft ring and six sparkles (wland) when a wild lands
//   stackForm(reel)  : four row flashes pull into one light column as a reel fills with wilds
//   wfExpand(ov)     : the full-reel wild unfurls from the middle rows (bakes the real WF art)
//   mergeFx(reels)   : light seams close between adjacent full reels + one soft sweep over the merged group
//   shimmer          : ONE shared scheduler; every ~1.6 s the next visible wild gets a single comet round its
//                      frame (so each wild shimmers every few seconds), at most 2 at once, paused while the reels
//                      spin, during win lines, or when the tab is hidden
import { play, hasSheet } from './sprite';
import { burst } from './fx';
import { S, $, wait, setGem } from './ui';
import { isSpinning } from './reels';
import { linesActive } from './winlines';
const ID = 'fx_wild';
const ok = () => hasSheet(ID);

export function wildLand(cell: HTMLElement) {
	if (!ok()) return;
	cell.classList.remove('wLand'); void cell.offsetWidth; cell.classList.add('wLand');
	play(ID, 'wflash', cell, { cls: 'wfx wfxRing' });
	play(ID, 'wland', cell, { cls: 'wfx wfxBurst', onEnd: () => cell.classList.remove('wLand') });
}
function column(r: number) {
	const d = document.createElement('div'); d.className = 'wfxCol';
	d.style.left = r * S.cell + 'px'; d.style.width = S.cell + 'px';
	$('#board').appendChild(d); return d;
}
export function stackForm(reel: number) {
	if (!ok()) return Promise.resolve();
	const host = column(reel);
	return new Promise<void>((res) => { if (!play(ID, 'stackform', host, { cls: 'wfx', onEnd: () => { host.remove(); res(); } })) { host.remove(); res(); } });
}
export function wfExpand(ov: HTMLElement | null) {
	if (!ok() || !ov) return;
	ov.classList.add('wfxOpen');
	play(ID, 'wfexpand', ov, { cls: 'wfx wfxIn', onEnd: () => ov.classList.remove('wfxOpen') });
	play(ID, 'wshineT', ov, { cls: 'wfx wfxIn wfxTop', delay: 420 });
}
export function mergeFx(reels: number[]) {
	if (!ok() || reels.length < 2) return;
	const lo = Math.min(...reels), hi = Math.max(...reels);
	for (let r = lo + 1; r <= hi; r++) { const h = column(r); h.classList.add('seam'); play(ID, 'seam', h, { cls: 'wfx', onEnd: () => h.remove() }); }
	const g = column(lo); g.style.width = (hi - lo + 1) * S.cell + 'px';
	play(ID, 'msweep', g, { cls: 'wfx', delay: 180, onEnd: () => g.remove() });
	// sparkle burst on every merged reel's centre
	for (let r = lo; r <= hi; r++) { const h = column(r); h.classList.add('burstCol'); burst(h, 'lock', 120 + (r - lo) * 60); setTimeout(() => h.remove(), 900 + (r - lo) * 60); }
}

// ---- shared shimmer scheduler ----
let timer = 0, turn = 0;
function visibleWilds(): HTMLElement[] {
	const singles = [...document.querySelectorAll<HTMLElement>('#cells .cell.wild')].filter((c) => c.style.visibility !== 'hidden' && !c.classList.contains('dim') && !c.querySelector('canvas.wfxShine'));
	const fulls = [...document.querySelectorAll<HTMLElement>('#overlays .ov.full')].filter((o) => !o.querySelector('canvas.wfxShine'));
	return [...singles, ...fulls];
}
function step() {
	timer = window.setTimeout(step, S.turbo ? 1200 : 1600);
	if (document.hidden || isSpinning() || linesActive() || document.querySelectorAll('canvas.wfxShine').length >= 2) return;
	const w = visibleWilds(); if (!w.length || !ok()) return;
	const el = w[turn++ % w.length], full = el.classList.contains('ov');
	play(ID, full ? 'wshineT' : 'wshine', el, { cls: 'wfx wfxShine' + (full ? ' wfxIn wfxTop' : ' wfxRing') });
}
export function startShimmer() { if (!timer) timer = window.setTimeout(step, 2000); }

// ---- merged-group growth (display only): each reel's own value ticks first, then the product is shown as a formula ----
// e.g. x6→x7 and x5→x6 pop on their own columns, then "x7 × x6 = x42" counts up and the group's gem lands on x42.
// Transform/opacity only (WAAPI); text changes are on small absolutely positioned boxes (no layout of the board).
export async function growGroup(ov: HTMLElement, from: number[], to: number[], fromProd: number, toProd: number) {
	const mx = ov.querySelector<HTMLElement>('.mx'); if (mx) setGem(mx, fromProd);
	const f = S.turbo ? 0.5 : 1, n = to.length, made: HTMLElement[] = [];
	const badges = to.map((v, i) => {
		const b = document.createElement('div'); b.className = 'rGrow'; b.style.left = ((i + 0.5) / n) * 100 + '%';
		b.textContent = 'x' + from[i]; ov.appendChild(b); made.push(b);
		b.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.6)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }], { duration: 160 * f, fill: 'forwards' });
		return b;
	});
	await wait(220 * f);
	for (let i = 0; i < n; i++) {
		if (to[i] === from[i]) continue;
		const b = badges[i];
		setTimeout(() => {
			b.textContent = 'x' + to[i]; b.classList.add('up');
			b.animate([{ transform: 'translate(-50%,-50%) scale(1)' }, { transform: 'translate(-50%,-50%) scale(1.35)', offset: .35 }, { transform: 'translate(-50%,-50%) scale(1)' }], { duration: 320 * f, easing: 'cubic-bezier(.3,1.6,.5,1)' });
		}, i * 140 * f);
	}
	await wait((n * 140 + 380) * f);
	const fm = document.createElement('div'); fm.className = 'rGrowSum'; ov.appendChild(fm); made.push(fm);
	const head = to.map((v) => 'x' + v).join(' × ') + ' = x';
	fm.textContent = head + fromProd;
	const len = (head + toProd).length + 1.5; // fit the formula inside the merged width (overlay clips)
	fm.style.fontSize = `min(calc(var(--cell)*.3), calc(var(--cell)*${(n * 0.9 / (len * 0.62)).toFixed(3)}))`;
	fm.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.8)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }], { duration: 180 * f, fill: 'forwards' });
	const dur = 520 * f, t0 = performance.now();
	await new Promise<void>((res) => {
		const tick = (t: number) => {
			const u = Math.min(1, (t - t0) / dur), v = Math.round(fromProd + (toProd - fromProd) * (1 - (1 - u) ** 3));
			fm.textContent = head + v;
			if (u < 1) requestAnimationFrame(tick); else res();
		};
		requestAnimationFrame(tick);
	});
	fm.animate([{ transform: 'translate(-50%,-50%) scale(1)' }, { transform: 'translate(-50%,-50%) scale(1.15)' }, { transform: 'translate(-50%,-50%) scale(1)' }], { duration: 260 * f });
	if (mx) setGem(mx, toProd); // pops with the gem's own burst
	burst(ov, 'pop', 0);
	await wait(700 * f);
	made.forEach((e) => e.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250 * f, fill: 'forwards' }).finished.then(() => e.remove()));
}
