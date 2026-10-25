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
import { S, $ } from './ui';
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
