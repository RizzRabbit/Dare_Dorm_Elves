// UI effects played through SpriteAnim (sheet "fx", scripts/sprites/gen_fx_ui.py -> assets/final/fx/fx_ui.*).
import { loadSheet, play, stop, frameCSS, hasSheet, type Atlas } from './sprite';
// Every generated atlas (scripts/sprites/*) is bundled; its sheet image comes from the art manifest under the same key.
const ATLASES = import.meta.glob('./fx/*.atlas.json', { eager: true, import: 'default' }) as Record<string, Atlas>;
import ART_JSON from './art.generated.json';
const ART = ART_JSON as Record<string, string | null>;

export const FX = 'fx_ui';
/** Load every sprite sheet (called once from the loading screen; each counts toward the progress bar). */
export function loadAllFx(track: <T>(p: Promise<T>) => Promise<T>) {
	return Promise.all(Object.entries(ATLASES).map(([path, atlas]) => {
		const id = path.split('/').pop()!.replace('.atlas.json', '');
		const src = ART[id];
		return src ? track(loadSheet(id, src, atlas).catch(() => console.warn('sprite sheet missing', id))) : Promise.resolve();
	}));
}

// ---------- symbols (scripts/sprites/gen_symbols.py: sheet sym_<S> with land / win / idle) ----------
const symOf = (cell: Element) => cell.querySelector<HTMLElement>('.sym');
const symName = (cell: Element) => [...(symOf(cell)?.classList || [])].find((c) => /^(H\d|L\d|W|S)$/.test(c)) || '';
/** Wild idle loop (random phase so neighbouring wilds don't breathe in sync). */
export function symIdle(cell: HTMLElement) {
	const sym = symOf(cell); if (!sym || symName(cell) !== 'W' || !hasSheet('sym_W') || sym.querySelector('canvas.fxIdle')) return;
	play('sym_W', 'idle', sym, { cls: 'fxFill symFx fxIdle', delay: -Math.random() * 1000, prepend: false });
}
/** Win highlight: the symbol's own win loop (pulse, shine, edge glow, sparkles; characters lean and sway). */
export function symWin(cell: HTMLElement) {
	const sym = symOf(cell), n = symName(cell); if (!sym || !hasSheet('sym_' + n) || sym.querySelector('canvas.fxWin')) return false;
	play('sym_' + n, 'win', sym, { cls: 'fxFill symFx fxWin' });
	cell.classList.add('sprWin');
	return true;
}
/** Scatter land: the Dare Card's own land sheet (squash-pop + ring flash + sparkles); the only symbol with one. */
export function symLand(cell: HTMLElement) {
	const sym = symOf(cell); if (!sym || symName(cell) !== 'S' || !hasSheet('sym_S')) return;
	sym.querySelectorAll('canvas.fxLand').forEach((c) => c.remove());
	play('sym_S', 'land', sym, { cls: 'fxFill symFx fxLand', onEnd: () => sym.querySelectorAll('canvas.fxLand').forEach((c) => c.remove()) });
}
/** Landing weight on reel stop: squash and stretch (~120 ms, WAAPI transform only); wilds and scatters hit harder. */
export function landBump(cell: HTMLElement) {
	const sym = symOf(cell); if (!sym) return;
	const n = symName(cell), heavy = n === 'W' || n === 'S';
	sym.animate(heavy
		? [{ transform: 'scale(1.12,.84)' }, { transform: 'scale(.95,1.07)', offset: .45 }, { transform: 'none' }]
		: [{ transform: 'scale(1.05,.93)' }, { transform: 'scale(.98,1.02)', offset: .5 }, { transform: 'none' }],
		{ duration: heavy ? 190 : 120, easing: 'ease-out' });
	if (heavy) burst(cell, 'land');
}
/** Win "lit" state: a glow behind the symbol (.lit, per-symbol via data-s so a lit sprite or an accent outline per
 * symbol can replace the temporary radial glow without touching the win logic). */
export function litOn(cell: HTMLElement) {
	// 3D pop toward the camera: tilt away from the board centre (cell id c<reel><row>), plus a soft shadow layer that
	// drifts with it. Art-agnostic: it moves whatever .sym holds; transform/opacity only (styles in elfhaus.css).
	const m = /^c(\d)(\d)$/.exec(cell.id);
	if (m) { cell.style.setProperty('--tY', ((+m[1] - 2) * 3.5).toFixed(1) + 'deg'); cell.style.setProperty('--tX', ((1.5 - +m[2]) * 4.5).toFixed(1) + 'deg'); cell.style.setProperty('--shX', ((2 - +m[1]) * 4) + '%'); }
	if (!cell.querySelector(':scope > .symSh')) { const sh = document.createElement('i'); sh.className = 'symSh'; cell.prepend(sh); }
	if (cell.querySelector(':scope > .lit, .olWin')) return; // frameless art carries its own lit outline layer
	const i = document.createElement('i'); i.className = 'lit'; i.dataset.s = symName(cell); cell.prepend(i);
}
/** Impact bursts (fx_burst, glow baked; frame-shape independent): land 1.5x cell (wild / scatter landing),
 * lock 1.9x (wild locks or merges), pop 0.9x (win-cell pop). Drawn above the symbol, centred on the host. */
const BURST = { land: 1.5, lock: 1.9, pop: 0.9, big: 3.2 } as const; // big = the lock anim, scaled up (4-5 wide merges)
export function burst(host: HTMLElement, kind: keyof typeof BURST, delay = 0) {
	if (!hasSheet('fx_burst')) return;
	const k = BURST[kind];
	play('fx_burst', kind === 'big' ? 'lock' : kind, host, { cls: 'bfx', delay, prepend: false, style: `width:calc(var(--cell)*${k});height:calc(var(--cell)*${k});margin:calc(var(--cell)*${-k / 2}) 0 0 calc(var(--cell)*${-k / 2})` });
}
export function clearSymWins() {
	document.querySelectorAll('canvas.fxWin').forEach((c) => c.remove());
	document.querySelectorAll('.cell.sprWin').forEach((c) => c.classList.remove('sprWin'));
}

/** Multiplier increase: burst sheet behind the lettering, centred on the text. */
export function mxBurst(mx: HTMLElement) {
	const c = Number(mx.dataset.cx || 70);
	play(FX, 'mxburst', mx, { cls: 'fxBurst', style: `left:${c}%`, prepend: true });
	mxGlint(mx, 0);
}
// Glint anchors (percent of the .mx box) relative to the text span: [fraction along text, y%].
const GL = [[0.82, 22], [0.3, 48], [0.58, 80]];
export function mxGlint(mx: HTMLElement, k = Math.floor(Math.random() * GL.length)) {
	const l = Number(mx.dataset.tl || 50), r = Number(mx.dataset.tr || 97);
	const [f, y] = GL[k];
	play(FX, 'glint', mx, { cls: 'fxGlint', style: `left:${(l + (r - l) * f).toFixed(1)}%;top:${y}%` });
}
/** LOCKED: padlock clamps in the tag icon slot and a sparkle burst runs round the cell border. */
export function lockFx(cell: HTMLElement) {
	const slot = cell.querySelector<HTMLElement>('.lock .lkI');
	if (slot) {
		slot.querySelectorAll('canvas').forEach((c) => c.remove());
		if (play(FX, 'lock', slot, { cls: 'fxFill', onEnd: () => setLockIcon(slot) })) slot.style.cssText = '';
	}
	play(FX, 'lockrim', cell, { cls: 'fxRim' });
	burst(cell, 'lock'); // sparkle burst as the wild locks
}
export function setLockIcon(slot: HTMLElement) {
	slot.style.cssText = frameCSS(FX, 'lock', -1);
}
void stop;
export const lockIconCSS = () => frameCSS(FX, 'lock', -1);

/** Respin circles: static frames for empty / filled, the sheet for fill (forward) and reset (reverse). */
export const rcCSS = (filled: boolean) => frameCSS(FX, 'rcfill', filled ? -1 : 0);
export function rcFill(dot: HTMLElement, reverse = false) {
	dot.querySelectorAll('canvas').forEach((c) => c.remove());
	const a = play(FX, 'rcfill', dot, { cls: 'fxFill', reverse, fps: reverse ? 48 : undefined, });
	void a;
}
/** Relight flash over a respin circle (ring burst + star), drawn larger than the dot. */
export function rcFlash(dot: HTMLElement) { play(FX, 'rcflash', dot, { cls: 'rcFlash', prepend: false }); }
