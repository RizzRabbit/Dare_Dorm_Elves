// Wild moments (fx_wild sheet, gen_fx_wild.py). Every effect is a pre-baked sprite (glow baked in) on a pooled
// canvas; only transform/opacity are animated by CSS, nothing animates filter or shadow.
//   wildLand(cell)   : the round frame flares (wflash) + a soft ring and six sparkles (wland) when a wild lands
//   stackForm(reel)  : four row flashes pull into one light column as a reel fills with wilds
//   wfExpand(ov)     : v3.11: a top shine only. The per-reel fx_wfexpand_R<n> elf sheet is no longer drawn (it doubled the elf); it was: each reel plays its own fx_wfexpand_R<n> sheet
//                      when imported (assets/fx/, decoded on demand, freed FREE_MS after use, like Roxy's states); without
//                      it the elf frame is skipped (the stack stills / sheets show the right elf). v3.7: the old baked
//                      one-elf 'wfexpand' row is cropped out of fx_wild.webp
//   mergeFx(reels)   : light seams close between adjacent full reels + one soft sweep over the merged group
//   shimmer          : ONE shared scheduler; every ~1.6 s the next visible wild gets a single comet round its
//                      frame (so each wild shimmers every few seconds), at most 2 at once, paused while the reels
//                      spin, during win lines, or when the tab is hidden
import { sfx } from './audio';
import { play, hasSheet } from './sprite';
import { S, $ } from './ui';
import { isSpinning } from './reels';
import { linesActive } from './winlines';
const ID = 'fx_wild';
const ok = () => hasSheet(ID);

export function wildLand(cell: HTMLElement) {
	sfx('wild_land', { throttle: 60 });
	// aifix (audit 18): a calm landing: the symbol's own squash-pop (.wLand, transform only). The pink neon ring flare
	// (wflash) and the ring + star crown (wland) are gone; the glow budget goes to the merged / stacked wild frames.
	cell.classList.remove('wLand'); void cell.offsetWidth; cell.classList.add('wLand');
	setTimeout(() => cell.classList.remove('wLand'), 600);
}
function column(r: number) {
	const d = document.createElement('div'); d.className = 'wfxCol';
	d.style.left = r * S.cell + 'px'; d.style.width = S.cell + 'px';
	$('#board').appendChild(d); return d;
}
// aifix: stackform frames 0-4 are four-point stars at the four rows; only the light column (frames 5-11) plays
const COL_FROM = 5;
export function stackForm(reel: number) {
	if (!ok()) return Promise.resolve();
	const host = column(reel);
	return new Promise<void>((res) => { const a = play(ID, 'stackform', host, { cls: 'wfx', onEnd: () => { host.remove(); res(); } }); if (!a) { host.remove(); res(); } else { a.frames = a.frames.slice(COL_FROM); a.last = -1; } });
}
export function wfExpand(ov: HTMLElement | null) {
	if (!ov) return;
	// v3.11: no per-reel elf expand sheet any more. It drew a SECOND elf (its own framing / scale) over the stack's own
	// merge_idle canvas while the stack formed: a larger, offset Delilah on reel 5 in Triple Dare FS (bug 2026-10-26).
	// The stack stills / sheets are the only elf; this is the top shine only.
	if (ok()) play(ID, 'wshineT', ov, { cls: 'wfx wfxIn wfxTop', delay: 420 });
}
export function mergeFx(reels: number[], seams = true) {
	if (!ok() || reels.length < 2) return;
	const lo = Math.min(...reels), hi = Math.max(...reels);
	void seams; // aifix: the seam sheet has star crossings on the light lines; the soft sweep below is the merge cue
	const g = column(lo); g.style.width = (hi - lo + 1) * S.cell + 'px';
	play(ID, 'msweep', g, { cls: 'wfx', delay: 180, onEnd: () => g.remove() });
	// aifix: no sparkle burst per merged reel (four-point stars)
}

// ---- shared shimmer scheduler ----
let timer = 0, turn = 0;
function visibleWilds(): HTMLElement[] {
	const singles: HTMLElement[] = []; // aifix: no comet round single wilds (their round neon ring is gone); full reels keep the edge glint
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
