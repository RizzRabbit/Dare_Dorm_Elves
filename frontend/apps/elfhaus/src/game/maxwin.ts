// MAX WIN celebration (sprite version): shown ONLY when a round hits the 50,000x cap (wincap event).
// Five elves (Coco | Jade | Delilah | Roxy | Vi) packed shoulder to shoulder lean in over the player (first-person
// POV), gawk at the count-up, then lose it one by one (not on a grid): each breaks into a comedic ecstatic face.
// Round 4: each elf is her OWN sheet (maxwin_elf_*: drawn expression frames + blush/heart overlays) driven by elfrig.ts:
// 30 fps expression steps with drawn in-betweens, transform-only bob/sway/squash/tilt/hop/giggle, staggered rise-in.
// Sheets are lazy: nothing is decoded at idle. preloadMaxWin() starts the decode the moment a max win is known (playBookEvents
// sees a wincap in the round's book, i.e. before the reels even spin); maxWinCelebration() awaits it before the entrance, so
// nothing pops in, and releaseMaxWin() closes the ImageBitmaps after the screen closes (~8.5 MB decoded for the five elf sheets).
// Round 6 (anti-AI-look art pass): new cast art (distinct poses / faces / outfits per elf, full figures; expression frames are
// face patches over one base frame), a blurred Lounge plate replaces the black backdrop, no four-point star glints.
import { sfx, loop, duck } from './audio';
import { voice, VOICE } from './voice';
import { $, bet } from './ui';
import { MAX_WIN_X } from './config';
import { moneyWin, moneyDigits } from './format';
import { loadSheet, hasSheet, play, stop, unloadSheet, type Anim, type Atlas } from './sprite';
import { ElfRig, TEMPO, type ElfCfg } from './elfrig';

// atlases live outside ./fx/ on purpose so fx.ts doesn't load them on the loading screen
const ATL = import.meta.glob('./maxwin/*.json', { eager: true, import: 'default' }) as Record<string, Atlas>;
const IMG = import.meta.glob('../assets/maxwin/*.webp', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;
const ids = Object.keys(ATL).map((p) => p.split('/').pop()!.replace('.json', ''));
const src = (id: string) => Object.entries(IMG).find(([p]) => p.endsWith('/' + id + '.webp'))?.[1] || '';

const RISE = 150;                     // ms: first elf starts rising (staggered, centre out)
// Round 6: the backdrop is a pre-blurred, dimmed Lounge plate (same room + light as the base game), loaded with the sheets
const BG = { land: src('maxwin_bg_land'), port: src('maxwin_bg_port') };
let bgImg: HTMLImageElement | null = null;
const bgUrl = () => (document.body.classList.contains('portrait') ? BG.port : BG.land);
function loadBg(): Promise<unknown> {
	const u = bgUrl(); if (!u) return Promise.resolve();
	if (bgImg?.dataset.u === u) return bgImg.decode().catch(() => {});
	bgImg = new Image(); bgImg.dataset.u = u; bgImg.src = u; return bgImg.decode().catch(() => {});
}
const COUNT_MS = 4200, COUNT_AT = 600;

let loading: Promise<void> | null = null;
/** Start decoding the max-win sheets (idempotent; returns the pending decode). Call as soon as a max win is determined. */
export function preloadMaxWin(): Promise<void> {
	return (loading ??= Promise.all([loadBg(), ...ids.map((id) => hasSheet(id) ? 0 : loadSheet(id, src(id), ATL['./maxwin/' + id + '.json']).catch((e) => console.warn('maxwin sheet', id, e)))]).then(() => {}));
}
/** Free the decoded textures after the show (ImageBitmap.close via unloadSheet; they reload on the next max win). */
export function releaseMaxWin() { ids.forEach((id) => unloadSheet(id)); if (bgImg) bgImg.src = ''; bgImg = null; loading = null; }

const live = new Set<Anim>(); const timers: number[] = []; let rig: ElfRig | null = null;
const later = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));
function run(id: string, name: string, host: Element, o: Parameters<typeof play>[3] = {}) {
	const a = play(id, name, host, { cls: 'mwSpr', ...o }); if (a) live.add(a); return a;
}
/** Swap the animation on a host without a blank frame. play() paints frame 0 synchronously when there is no delay,
 *  so the old canvas goes on the SAME frame (a 2-rAF overlap let e.g. Delilah's heart show through the next anim);
 *  only a delayed start keeps the old canvas 2 rAFs as a fallback. */
function swap(old: Anim | null, id: string, name: string, host: Element, o: Parameters<typeof play>[3] = {}) {
	const a = run(id, name, host, o);
	if (old) {
		if (a && !o.delay) { stop(old); live.delete(old); }
		else requestAnimationFrame(() => requestAnimationFrame(() => { stop(old); live.delete(old); }));
	}
	return a;
}
// Expression in-betweens (state, frames at 30 fps) for every change: anticipation squint/giggle ('ant'),
// half-rolled eyes + half-open mouth ('half'), half-lids ('blinkh'). Never a cross-fade of two faces.
const TRANS: Record<string, [string, number][]> = {
	'gawk>blink': [['blinkh', 1]], 'blink>gawk': [['blinkh', 1]],
	'gawk>peak': [['blinkh', 1], ['ant', 2]], 'peak>ahe': [['ant', 2], ['half', 2]], 'ahe>peak': [['half', 2], ['ant', 1]],
	'peak>gawk': [['ant', 1], ['blinkh', 2]], 'ahe>gawk': [['half', 2], ['blinkh', 1]], 'gawk>ahe': [['ant', 2], ['half', 2]],
};
// Roxy's ecstatic face is her 'peak' layer, so her gawk<->peak runs through the ahegao in-betweens
const TRANS_RX = { ...TRANS, 'gawk>peak': [['blinkh', 1], ['ant', 2], ['half', 2]], 'peak>gawk': [['half', 2], ['blinkh', 1]] } as typeof TRANS;
const FX: ElfCfg['fx'] = { peak: ['squash', 'tilt', 'giggle'], ahe: ['squash', 'tilt', 'hop'], gawk: ['squash', 'tilt0'] };
const BLUSH = { ant: 0.35, half: 0.8, ahe: 1, peak: 0.55 };
const ELVES = ['coco', 'jade', 'delilah', 'roxy', 'vi'];
const CO = 0, JA = 1, DL = 2, RX = 3, VI = 4;
// The peak, ms after the count lands. Irregular on purpose: Roxy breaks first, Coco + Jade almost together, Delilah
// after a short laugh (her hearts), Vi late; each drifts back to her laugh at her own time, then all settle.
const PEAK: [number, string, number][] = [
	[RX, 'peak', 133], [CO, 'peak', 67], [JA, 'peak', 200], [DL, 'peak', 333], [CO, 'ahe', 533], [JA, 'ahe', 600],
	[DL, 'ahe', 733], [VI, 'peak', 1067], [JA, 'peak', 1267], [RX, 'gawk', 1467], [VI, 'ahe', 1467], [CO, 'peak', 1533],
	[DL, 'peak', 2067], [RX, 'peak', 2200], [VI, 'peak', 2333],
	[RX, 'gawk', 3400], [VI, 'gawk', 3560], [DL, 'gawk', 3700], [CO, 'gawk', 3820], [JA, 'gawk', 3980],
];
function groupShow(host: HTMLElement, landAt: number) {
	const cfg = (n: string, i: number): ElfCfg => ({ id: 'maxwin_elf_' + n, base: 'gawk', trans: i === RX ? TRANS_RX : TRANS,
		fx: i === RX ? { ...FX, peak: ['squash', 'tilt', 'hop'] } : FX, blush: i === RX ? { ...BLUSH, peak: 1 } : BLUSH,
		heartOn: i === DL ? 'peak' : undefined, blink: ['blink', 'gawk', 2300, 4200] });
	const rig = new ElfRig(host, ELVES.map(cfg));
	rig.enter(RISE, [DL, JA, RX, CO, VI], 60);                          // centre out, ease-out-back rise (elfrig)
	for (const [i, s, t] of PEAK) rig.set(i, s, landAt + Math.round(t * TEMPO));   // same irregular order, stretched (elfrig TEMPO)
	return rig;
}
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
export async function maxWinCelebration() {
	const M = $('#maxwin'); const stage = M.querySelector('.mwStage') as HTMLElement;
	await preloadMaxWin();                                             // fallback: wait for the decode before the entrance (instant if already preloaded)
	await loadBg();                                                    // (orientation may have changed since the preload)
	const bgEl = M.querySelector('.mwBg') as HTMLElement | null; if (bgEl) bgEl.style.backgroundImage = `url(${bgUrl()})`;
	const crowd = document.createElement('div'); crowd.className = 'mwCrowd'; stage.appendChild(crowd);
	// calm screen: no falling paper confetti over the max win (turbo/skip unchanged)
	const xEl = M.querySelector('.mwX') as HTMLElement, amtEl = M.querySelector('.mwAmt') as HTMLElement, hint = M.querySelector('.mwHint') as HTMLElement;
	const tier = M.querySelector('.mwTier') as HTMLElement; tier.classList.add('spr');
	const total = MAX_WIN_X * bet(), dp = moneyDigits(total); let skipped = false;
	xEl.textContent = '0x'; amtEl.textContent = moneyWin(0, dp);
	hint.textContent = matchMedia('(pointer: coarse)').matches ? 'TAP TO CONTINUE' : 'CLICK TO CONTINUE';
	M.classList.remove('hidden', 'held', 'out'); void M.offsetWidth; M.classList.add('on');
	sfx('bigwin_sting'); duck(true); const cu = loop('bigwin_countup_loop'); setTimeout(() => voice('maxwin'), VOICE.bigWinDelayMs);
	const landAt = COUNT_AT + COUNT_MS;
	const g = document.createElement('div'); g.className = 'mwGroup'; crowd.appendChild(g);
	rig = groupShow(g, landAt).start();                                // one rAF clock for the elves + title cue
	rig.at(400, () => {                                                // title: soft scale overshoot as its sprite starts
		tier.classList.add('pop');
		const a = run('maxwin_title', 'intro', tier, { hold: true, onEnd: () => { swap(a, 'maxwin_title', 'shine', tier); } });
	});
	// count-up (live text); a tap during the show skips straight to the final amount
	const skip = () => { skipped = true; };
	M.addEventListener('pointerdown', skip, { once: true });
	await new Promise<void>((res) => {
		const t0 = performance.now() + COUNT_AT;
		const tick = (now: number) => {
			const k = skipped ? 1 : Math.max(0, Math.min(1, (now - t0) / COUNT_MS)), e = ease(k);
			xEl.textContent = `${Math.round(MAX_WIN_X * e).toLocaleString('en-US')}x`;
			amtEl.textContent = moneyWin(k < 1 ? Math.floor(total * e * 10 ** dp) / 10 ** dp : total, dp); // v3.16i: fixed places, the last frame is the exact target
			k < 1 ? requestAnimationFrame(tick) : res();
		};
		requestAnimationFrame(tick);
	});
	M.removeEventListener('pointerdown', skip); cu.stop(200);
	M.classList.add('landed');
	// the slower peak plays out under the hold; the continue hint shows after it, but a click works from the landing on
	const heldT = setTimeout(() => M.classList.add('held'), skipped ? 300 : Math.round(2200 * TEMPO));
	await new Promise<void>((res) => {
		const done = (e: Event) => {
			if (e instanceof KeyboardEvent && !['Space', 'Enter', 'Escape'].includes(e.code)) return;
			e.preventDefault(); e.stopPropagation(); clearTimeout(heldT);
			M.removeEventListener('pointerdown', done); removeEventListener('keydown', done, { capture: true } as any); res();
		};
		M.addEventListener('pointerdown', done); addEventListener('keydown', done, { capture: true });
	});
	M.classList.add('out');                                            // fade + slide the row down (CSS, transform/opacity)
	await new Promise<void>((r) => (rig ? rig.at(rig.ms + 600, r) : setTimeout(r, 600)));   // on the rig's rAF clock: the elves keep moving through the fade
	timers.splice(0).forEach(clearTimeout); live.forEach((a) => stop(a)); live.clear(); rig?.destroy(); rig = null;
	crowd.remove(); if (bgEl) bgEl.style.backgroundImage = ''; tier.classList.remove('spr', 'pop');
	M.classList.add('hidden'); M.classList.remove('on', 'landed', 'held', 'out');
	duck(false);
	releaseMaxWin();
}
