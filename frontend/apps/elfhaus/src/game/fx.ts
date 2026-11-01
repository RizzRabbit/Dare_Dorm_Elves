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

// ---------- symbols (static art + CSS; the old baked sym_<S> sprite strips are gone) ----------
const symOf = (cell: Element) => cell.querySelector<HTMLElement>('.sym');
const symName = (cell: Element) => [...(symOf(cell)?.classList || [])].find((c) => /^(H\d|L\d|W|S)$/.test(c)) || '';
/** Win highlight: no sprite strip any more (winning symbols keep the static art + lit outline + CSS bob); false = not handled. */
export function symWin(_cell: HTMLElement) { return false; }
/** Scatter land: the Ski Pass's own land pop + a flash of its icy tile (chalet.css .cell.sLand), transform / opacity only. */
export function symLand(cell: HTMLElement) {
	if (symName(cell) === 'S') { cell.classList.remove('sLand'); void cell.offsetWidth; cell.classList.add('sLand'); setTimeout(() => cell.classList.remove('sLand'), 520); }
}
/** Landing weight on reel stop: squash and stretch (~120 ms, WAAPI transform only); wilds and scatters hit harder. */
export function landBump(cell: HTMLElement) {
	const sym = symOf(cell); if (!sym) return;
	const n = symName(cell), heavy = n === 'W' || n === 'S';
	// chalet item 3: a rigged wild bust lands with ONE eased squash-and-settle on its rig (.cell.rgLand, chalet.css
	// rgWLand); a second squash on .sym here stacked with it (and with wPop) and read as stepped / jittery.
	if (n === 'W' && sym.querySelector('.rig[class*="k_W_R"]')) return;
		// anim-v4: every symbol gets a quick squash-and-stretch on land in normal pace too (the reel's own bounce carries it,
	// this adds weight); wilds / scatters hit harder. Still transform only, ~150-220 ms.
	if (!document.body.classList.contains('turbo')) {
		sym.animate(heavy
			? [{ transform: 'translateY(4%) scale(1.14,.84)' }, { transform: 'translateY(-3%) scale(.94,1.08)', offset: .4 }, { transform: 'scale(1.02,.98)', offset: .72 }, { transform: 'none' }]
			: [{ transform: 'translateY(3%) scale(1.09,.9)' }, { transform: 'translateY(-2%) scale(.96,1.05)', offset: .42 }, { transform: 'scale(1.01,.99)', offset: .75 }, { transform: 'none' }],
			{ duration: heavy ? 260 : 200, easing: 'ease-out' });
		return;
	}
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
	// aifix: no round .lit glow disc any more (an old round-frame leftover); the win glow is the symbol's own outline
	// sprite (.symGlow, <sym>_glow art, ui.ts), shown by .cell.win in CSS.
}
/** Impact bursts (fx_burst, glow baked; frame-shape independent): land 1.5x cell (wild / scatter landing),
 * lock 1.9x (wild locks or merges), pop 0.9x (win-cell pop). Drawn above the symbol, centred on the host. */
const BURST = { land: 1.5, lock: 1.9, pop: 0.9, big: 3.2 } as const; // big = the lock anim, scaled up (4-5 wide merges)
// aifix: every fx_burst row is a ring of four-point stars (+ hearts), so impact bursts are off; landings keep the
// transform squash (landBump) and merges keep their own motion. Kept as a no-op so callers (mergefx, winlines) stay as is.
const BURSTS = false;
export function burst(host: HTMLElement, kind: keyof typeof BURST, delay = 0) {
	if (!BURSTS || !hasSheet('fx_burst')) return;
	const k = BURST[kind];
	play('fx_burst', kind === 'big' ? 'lock' : kind, host, { cls: 'bfx', delay, prepend: false, rate: kind === 'land' ? 1 : undefined, // the reel-stop impact keeps its snap (tempo.ts)
		 style: `width:calc(var(--cell)*${k});height:calc(var(--cell)*${k});margin:calc(var(--cell)*${-k / 2}) 0 0 calc(var(--cell)*${-k / 2})` });
}
export function clearSymWins() {
	document.querySelectorAll('canvas.fxWin').forEach((c) => c.remove());
	document.querySelectorAll('.cell.sprWin').forEach((c) => c.classList.remove('sprWin'));
}

/** Multiplier increase: burst sheet behind the lettering, centred on the text. */
export function mxBurst(mx: HTMLElement) {
	// aifix (audit 18, circle leftovers): the mxburst thorn-ring flash is off; the lettering's own pink glow carries the growth
	void mx;
	// aifix: no four-point star glint over the gem (mxGlint stays exported, unused)
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
	// aifix: the lockrim sheet (corner stars) and the sparkle burst are off; the padlock clamp above is the lock cue
}
export function setLockIcon(slot: HTMLElement) {
	slot.style.cssText = frameCSS(FX, 'lock', -1);
}
void stop;
export const lockIconCSS = () => frameCSS(FX, 'lock', -1);

/** Respin circles: static frames for empty / filled, the sheet for fill (forward) and reset (reverse). */
export function rcFill(dot: HTMLElement, reverse = false) {
	dot.querySelectorAll('canvas').forEach((c) => c.remove());
	const a = play(FX, 'rcfill', dot, { cls: 'fxFill', reverse, fps: reverse ? 48 : undefined, });
	void a;
}
/** Relight flash over a respin circle (ring burst + star), drawn larger than the dot. */
export function rcFlash(dot: HTMLElement) { void dot; } // aifix: the rcflash sheet is a four-point star; the fill anim is enough
