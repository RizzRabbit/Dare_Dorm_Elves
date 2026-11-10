// Intro: Rizzin Games studio sting (2.3 s, tap skips), then the feature splash (title + 3 feature cards + TAP TO START)
// over the loading screen while assets finish loading. Art: /workspace/elfhaus-polish (INTEGRATION.md §4-5).
// "Don't show this again" (localStorage) skips the splash for returning players: after the sting the game opens as
// soon as loading is done. Motion is transform/opacity only (WAAPI); glow is baked into the images.
import { Application, Assets, Container, Sprite, type Texture } from 'pixi.js';
import { gsap } from 'gsap';
import { cssEase } from './board/motion';
import { LOADER_CARDS } from './loader';
import LAYOUT from '../assets/intro/splash_layout.json';
import { ART } from './ui';
import { symArtReady } from './symrig';
import { fitStage, isReplayUrl } from './stage';
const U = import.meta.glob('../assets/intro/*.webp', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;
const url = (f: string) => U['../assets/intro/' + f] || '';

// art: an ART key, or (egw, v3.6) the approved stacks r8d still of the merged pair instead of the old static WM2 scene
const CARDS: Record<'modes' | 'sticky' | 'egw', { art: string; title: string; line: string }> = {
	modes: { art: 'S', title: '4 Bonus Modes', line: 'Bunny Slope, Black Diamond, Double Black or Secret Santa.' },
	sticky: { art: 'W_R2', title: 'Sticky Wilds', line: 'Wilds lock in place and grow every respin.' },
	egw: { art: 'assets/stacks/still/WM2_R1-2.webp', title: 'Wild Winter Spins', line: 'Full wild reels side by side multiply.' },
};

const KEY = 'elfhaus.skipSplash';
export const skipSplash = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
/** v21 (review #193): no door intro in a replay (straight to the board + replay bar); else the player's own choice. */
export const noIntro = () => isReplayUrl() || skipSplash();

let stingRes: () => void = () => {}; const sting = new Promise<void>((r) => (stingRes = r));
export const stingDone = () => sting;

type Lay = { size: number[]; bg: string; title: { img: string; cx: number; cy: number; w: number }; panels: { img: string; cx: number; cy: number; w: number; delayMs: number }[]; tap: { img: string; cx: number; cy: number; w: number } };
const L = LAYOUT as unknown as Record<'land' | 'port', Lay>;
const place = (el: HTMLElement, o: { cx: number; cy: number; w: number }) => { el.style.left = o.cx + 'px'; el.style.top = o.cy + 'px'; el.style.width = o.w + 'px'; };

function layout() {
	const R = document.getElementById('loader'); if (!R) return;
	// The loader lives inside #root, which stage.ts already scales to the window (one shared scale). So the splash is
	// laid out against the STAGE (design px), not the window: using innerWidth/innerHeight here scaled it twice (tiny
	// splash on every window that is not 390-wide portrait or 1920x1080) and could pick the other orientation than the
	// game (window 1.0-1.1 tall). fitStage() is idempotent and makes ST current even before the game's first layout().
	const S = fitStage(), o: 'land' | 'port' = S.portrait ? 'port' : 'land', d = L[o];
	R.dataset.o = o;
	const st = R.querySelector<HTMLElement>('.spStage')!;
	st.style.width = d.size[0] + 'px'; st.style.height = d.size[1] + 'px';
	// portrait: keep a strip free under the splash for the "Don't show this again" row (.spSkip, bottom of the loader);
	// on short phones (Stake in iPhone Safari, ~390x550-660 visible) TAP TO START sat on top of it and a tap ticked the box
	const keep = o === 'port' ? 2 * 30 : 0;
	st.style.setProperty('--sps', String(Math.min(S.w / d.size[0], (S.h - keep) / d.size[1])));
	R.querySelector<HTMLElement>('.spBg')!.style.backgroundImage = `url(${(o === 'port' && ART.background_portrait) || ART.background || url(d.bg)})`;   // chalet room
	const t = R.querySelector<HTMLImageElement>('.spTitle')!, ts = ART.logo || url(d.title.img); if (t.getAttribute('src') !== ts) t.src = ts; place(t, d.title);
	// aifix (audit 3): the painted panels (garbled AI lettering, fake mini-boards) are replaced by plain HTML cards: the
	// real in-game art + a short title + one line, in the layout's slots (3 across in landscape, stacked in portrait).
	let ps = [...R.querySelectorAll<HTMLElement>('.spPanel')];
	if (ps.length !== d.panels.length) {
		ps.forEach((p) => p.remove());
		ps = d.panels.map(() => { const p = document.createElement('div'); p.className = 'spEl spPanel spCard'; st.insertBefore(p, st.querySelector('.spBarWrap')); return p; });
	}
	ps.forEach((p, i) => { const q = d.panels[i];
		const key = /modes/.test(q.img) ? 'modes' : /sticky/.test(q.img) ? 'sticky' : 'egw', c = CARDS[key];
		if (p.dataset.k !== key) { const src = c.art.includes('/') ? c.art : ART[c.art];
			// symbol art is baked from the sheet just after start: lay out again once it is there
			if (src) p.dataset.k = key; else void symArtReady.then(() => window.dispatchEvent(new Event('resize')));
			p.setAttribute('aria-label', LOADER_CARDS[key === 'modes' ? 0 : key === 'sticky' ? 1 : 2]);
			p.innerHTML = `<div class="spArt">${src ? `<img src="${src}" alt="" draggable="false">` : ''}</div><div class="spTxt"><h3></h3><p></p></div>`;
			p.querySelector('h3')!.textContent = c.title; p.querySelector('p')!.textContent = c.line; }
		place(p, q); p.style.setProperty('--d', q.delayMs + 'ms'); });
	// chalet: TAP TO START is a lettered CSS plate (chalet.css #lGo), no image
	place(R.querySelector<HTMLElement>('#lGo')!, d.tap);
	place(R.querySelector<HTMLElement>('.spBarWrap')!, { ...d.tap, w: d.tap.w * 0.9 });
}

// L1: the inline first-paint loader (#preL in app.html): hidden while the sting logo is up, back between the sting and
// the foyer, removed once the splash / game shows (CSS also hides it on #loader.pxOn / .ready / .out)
const preHold = (on: boolean) => document.getElementById('preL')?.classList.toggle('hold', on);
export const preOut = () => { const p = document.getElementById('preL'); if (p) { p.classList.add('out'); setTimeout(() => p.remove(), 220); } };

/** Studio sting on its own Pixi canvas inside #sting (sprites from the existing sting art; GSAP on real time).
 *  Timing is the old WAAPI one: plate 2.3 s (in 0.45 s, hold to 1.8 s with a 1 % drift, out to 1.04), logo settle 0.45 s
 *  ease cubic-bezier(.34,1.56,.64,1), glow 2 s after 0.2 s (0 / .8 / .9 / .7 / .8). Tap skips (0.25 s fade). */
function runSting() {
	const S = document.getElementById('sting'); if (!S) { preHold(false); stingRes(); return; }
	S.querySelectorAll('.stBox').forEach((e) => e.remove());   // the DOM imgs never paint; the sting is the canvas
	let ended = false, app: Application | null = null, stage: Container | null = null; const timers: number[] = [];
	const finish = () => {
		const a = app; app = null;
		if (a) { try { a.ticker.stop(); a.stop(); } catch { /* */ } }   // stopped, not destroyed (other renderers share the GPU)
		S.remove(); stingRes();
	};
	const end = () => {
		if (ended) return; ended = true; timers.forEach(clearTimeout); preHold(false);
		if (!stage) { finish(); return; }
		gsap.killTweensOf(stage);
		gsap.to(stage, { alpha: 0, duration: 0.25, ease: 'none', onComplete: finish });
	};
	S.addEventListener('pointerdown', end);
	(async () => {
		const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
		cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
		S.appendChild(cv);
		const W = Math.max(1, S.clientWidth || innerWidth), H = Math.max(1, S.clientHeight || innerHeight);
		const a = new Application();
		await a.init({ canvas: cv, width: W, height: H, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: false,
			backgroundAlpha: 0, antialias: true, preference: 'webgl', sharedTicker: false, hello: false });
		const [logoT, glowT] = await Promise.race([
			Promise.all([Assets.load(url('sting_logo.webp')) as Promise<Texture>, Assets.load(url('sting_glow.webp')) as Promise<Texture>]),
			new Promise<never>((_, rej) => setTimeout(() => rej(new Error('sting art late')), 1500)),
		]);
		if (ended) { cv.remove(); return; }
		app = a;
		const root = new Container(); stage = root; a.stage.addChild(root);
		const box = new Container(); root.addChild(box);
		// .stBox: 62 vmin tall, 640 / 636 aspect, centred; glow 135 % wide, centred; logo fills the box
		const bh = Math.min(W, H) * 0.62, bw = bh * (640 / 636);
		box.position.set(W / 2, H / 2);
		const glow = new Sprite(glowT); glow.anchor.set(0.5); glow.width = bw * 1.35; glow.scale.y = glow.scale.x; glow.alpha = 0; box.addChild(glow);
		const logo = new Sprite(logoT); logo.anchor.set(0.5); logo.width = bw; logo.height = bh; box.addChild(logo);
		const lk = logo.scale.x, lky = logo.scale.y;
		preHold(true);
		box.alpha = 0; box.scale.set(0.9);
		const tl = gsap.timeline();
		tl.to(box, { alpha: 1, duration: 0.45, ease: 'none' }, 0).to(box.scale, { x: 1, y: 1, duration: 0.45, ease: 'none' }, 0)
			.to(box.scale, { x: 1.01, y: 1.01, duration: 1.35, ease: 'none' }, 0.45)
			.to(box, { alpha: 0, duration: 0.5, ease: 'none' }, 1.8).to(box.scale, { x: 1.04, y: 1.04, duration: 0.5, ease: 'none' }, 1.8);
		logo.scale.set(lk * 0.96, lky * 0.96);
		gsap.to(logo.scale, { x: lk, y: lky, duration: 0.45, ease: cssEase('cubic-bezier(.34,1.56,.64,1)') });
		gsap.timeline({ delay: 0.2 }).to(glow, { alpha: 0.8, duration: 0.4, ease: 'none' }).to(glow, { alpha: 0.9, duration: 0.5, ease: 'none' })
			.to(glow, { alpha: 0.7, duration: 0.5, ease: 'none' }).to(glow, { alpha: 0.8, duration: 0.6, ease: 'none' });
		timers.push(window.setTimeout(end, 2300));
	})().catch(() => { S.querySelectorAll('canvas').forEach((c) => c.remove()); end(); });
}

export function initSplash() {
	const R = document.getElementById('loader'); if (!R) return;
	R.classList.toggle('quick', noIntro());
	const cb = R.querySelector<HTMLInputElement>('#spSkip')!;
	cb.checked = skipSplash();
	cb.onchange = () => { try { cb.checked ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY); } catch {} };
	layout(); addEventListener('resize', layout);
	// iOS: the visible box changes without a window resize (bars) and reports late after a rotation
	visualViewport?.addEventListener('resize', layout); addEventListener('orientationchange', () => { setTimeout(layout, 120); setTimeout(layout, 500); });
	sting.then(() => { R.classList.add('in'); removeEventListener('resize', layout); addEventListener('resize', layout); });
	runSting();
}
