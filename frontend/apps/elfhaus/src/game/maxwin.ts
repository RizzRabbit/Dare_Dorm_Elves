// MAX WIN celebration (sprite version): shown ONLY when a round hits the 50,000x cap (wincap event).
// Five elves (Coco | Jade | wild elf | Roxy | Vi) packed shoulder to shoulder lean in over the player (first-person
// POV), gawk at the count-up, then react in a staggered wave; Roxy and the wild elf peak with a comedic ahegao.
// The row is ONE group sprite sheet (sprite.ts SpriteAnim); the only CSS motion is its rise-in and the overlay fade. Sheets are lazy: preloadMaxWin() fetches them at idle time after the game is up,
// releaseMaxWin() drops them after the show so ~55 MB of decoded textures don't sit in memory.
import { $, bet } from './ui';
import { MAX_WIN_X } from './config';
import { money } from './format';
import { loadSheet, hasSheet, play, stop, unloadSheet, type Anim, type Atlas } from './sprite';

// atlases live outside ./fx/ on purpose so fx.ts doesn't load them on the loading screen
const ATL = import.meta.glob('./maxwin/*.json', { eager: true, import: 'default' }) as Record<string, Atlas>;
const IMG = import.meta.glob('../../assets/maxwin/*.webp', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;
const ids = Object.keys(ATL).map((p) => p.split('/').pop()!.replace('.json', ''));
const src = (id: string) => Object.entries(IMG).find(([p]) => p.endsWith('/' + id + '.webp'))?.[1] || '';

const GROUP = 'maxwin_group';
const RISE = 150;                     // ms: group rise-in starts (CSS), intro sprite at RISE + 250
const SPARK = [[30, 16], [70, 14], [22, 32], [78, 30], [42, 8], [58, 36], [36, 40], [64, 6]];
const COUNT_MS = 4200, COUNT_AT = 600;

let loading: Promise<void> | null = null;
export function preloadMaxWin() {
	const go = () => { loading ??= Promise.all(ids.map((id) => hasSheet(id) ? 0 : loadSheet(id, src(id), ATL['./maxwin/' + id + '.json']).catch(() => {}))).then(() => {}); };
	const ric = (window as any).requestIdleCallback as ((f: () => void, o?: object) => void) | undefined;
	setTimeout(() => (ric ? ric(go, { timeout: 4000 }) : go()), 1500);
}
/** Free the decoded textures after the show (they reload lazily if a second max win ever happens). */
export function releaseMaxWin() { ids.forEach((id) => unloadSheet(id)); loading = null; }

const live = new Set<Anim>(); const timers: number[] = [];
const later = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));
function run(id: string, name: string, host: Element, o: Parameters<typeof play>[3] = {}) {
	const a = play(id, name, host, { cls: 'mwSpr', ...o }); if (a) live.add(a); return a;
}
/** Swap the animation on a host without a blank frame: the new canvas sits on top, the old one goes 2 rAFs later. */
function swap(old: Anim | null, id: string, name: string, host: Element, o: Parameters<typeof play>[3] = {}) {
	const a = run(id, name, host, o);
	if (old) requestAnimationFrame(() => requestAnimationFrame(() => { stop(old); live.delete(old); }));
	return a;
}
function groupShow(host: HTMLElement, landAt: number) {
	later(RISE, () => host.classList.add('up'));                         // CSS rise-in (450 ms ease-out)
	let cur: Anim | null = null;
	later(RISE + 250, () => {
		cur = run(GROUP, 'intro', host, { hold: true, onEnd: () => { cur = swap(cur, GROUP, 'loop', host, { delay: 0 }); } });
	});
	// peak: the per-elf stagger (Jade, Coco, Vi, Roxy, WF) is baked into the 9-frame 'peak' anim
	later(landAt, () => {
		cur = swap(cur, GROUP, 'peak', host, { hold: true, onEnd: () => {
			cur = swap(cur, GROUP, 'peakHold', host);
			later(1600, () => { cur = swap(cur, GROUP, 'settle', host, { hold: true, onEnd: () => { cur = swap(cur, GROUP, 'loop', host); } }); });
		} });
	});
}
function sparkle(stage: HTMLElement, i: number) {
	const h = document.createElement('div'); h.className = 'mwSpark'; stage.appendChild(h);
	const again = () => {
		const [x, y] = SPARK[(Math.random() * SPARK.length) | 0];
		h.style.left = x + (Math.random() * 6 - 3) + '%'; h.style.top = y + (Math.random() * 6 - 3) + '%';
		h.style.setProperty('--s', String(0.6 + Math.random() * 0.8));
		run('maxwin_sparkle', 'twinkle', h, { onEnd: () => later(250 + Math.random() * 900, again) });
	};
	later(500 + i * 260, again);
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);
export async function maxWinCelebration() {
	const M = $('#maxwin'); const stage = M.querySelector('.mwStage') as HTMLElement;
	await (loading ?? (preloadMaxWin(), loading));
	const crowd = document.createElement('div'); crowd.className = 'mwCrowd'; stage.appendChild(crowd);
	const conf = document.createElement('div'); conf.className = 'mwConfetti'; stage.insertBefore(conf, crowd);
	const portrait = document.body.classList.contains('portrait');
	for (let i = 0; i < (portrait ? 3 : 1); i++) {                       // 16:9 confetti tiles, stacked in portrait
		const t = document.createElement('div'); t.className = 'mwConfTile'; t.style.top = `calc(${i} * 100vw * 9 / 16)`; conf.appendChild(t);
		run('maxwin_confetti', 'fall', t, { delay: 150 + i * 270 });
	}
	const xEl = M.querySelector('.mwX') as HTMLElement, amtEl = M.querySelector('.mwAmt') as HTMLElement, hint = M.querySelector('.mwHint') as HTMLElement;
	const tier = M.querySelector('.mwTier') as HTMLElement; tier.classList.add('spr');
	const total = MAX_WIN_X * bet(); let skipped = false;
	xEl.textContent = '0x'; amtEl.textContent = money(0);
	hint.textContent = matchMedia('(pointer: coarse)').matches ? 'TAP TO CONTINUE' : 'CLICK TO CONTINUE';
	M.classList.remove('hidden', 'held', 'out'); void M.offsetWidth; M.classList.add('on');
	const landAt = COUNT_AT + COUNT_MS;
	const g = document.createElement('div'); g.className = 'mwGroup'; crowd.appendChild(g); groupShow(g, landAt);
	later(400, () => run('maxwin_title', 'intro', tier, { hold: true, onEnd: () => run('maxwin_title', 'shine', tier) }));
	SPARK.slice(0, 5).forEach((_, i) => sparkle(stage, i));
	// count-up (live text); a tap during the show skips straight to the final amount
	const skip = () => { skipped = true; };
	M.addEventListener('pointerdown', skip, { once: true });
	await new Promise<void>((res) => {
		const t0 = performance.now() + COUNT_AT;
		const tick = (now: number) => {
			const k = skipped ? 1 : Math.max(0, Math.min(1, (now - t0) / COUNT_MS)), e = ease(k);
			xEl.textContent = `${Math.round(MAX_WIN_X * e).toLocaleString('en-US')}x`;
			amtEl.textContent = money(k < 1 ? Math.floor(total * e * 100) / 100 : total);
			k < 1 ? requestAnimationFrame(tick) : res();
		};
		requestAnimationFrame(tick);
	});
	M.removeEventListener('pointerdown', skip);
	M.classList.add('landed');
	await new Promise((r) => setTimeout(r, skipped ? 300 : 2200));
	M.classList.add('held');
	await new Promise<void>((res) => {
		const done = (e: Event) => {
			if (e instanceof KeyboardEvent && !['Space', 'Enter', 'Escape'].includes(e.code)) return;
			e.preventDefault(); e.stopPropagation();
			M.removeEventListener('pointerdown', done); removeEventListener('keydown', done, { capture: true } as any); res();
		};
		M.addEventListener('pointerdown', done); addEventListener('keydown', done, { capture: true });
	});
	M.classList.add('out');
	await new Promise((r) => setTimeout(r, 450));
	timers.splice(0).forEach(clearTimeout); live.forEach((a) => stop(a)); live.clear();
	crowd.remove(); conf.remove(); stage.querySelectorAll('.mwSpark').forEach((n) => n.remove()); tier.classList.remove('spr');
	M.classList.add('hidden'); M.classList.remove('on', 'landed', 'held', 'out');
	releaseMaxWin();
}
