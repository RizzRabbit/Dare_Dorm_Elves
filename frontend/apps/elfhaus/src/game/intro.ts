// Intro: Rizzin Games studio sting (2.3 s, tap skips), then the feature splash (title + 3 feature cards + TAP TO START)
// over the loading screen while assets finish loading. Art: /workspace/elfhaus-polish (INTEGRATION.md §4-5).
// "Don't show this again" (localStorage) skips the splash for returning players: after the sting the game opens as
// soon as loading is done. Motion is transform/opacity only (WAAPI); glow is baked into the images.
import { Application, Assets, Container, Sprite, type Texture } from 'pixi.js';
import { gsap } from 'gsap';
import { cssEase } from './board/motion';
import { isReplayUrl } from './stage';
const U = import.meta.glob('../assets/intro/*.webp', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;
const url = (f: string) => U['../assets/intro/' + f] || '';


const KEY = 'elfhaus.skipSplash';
export const skipSplash = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
export const setSkipSplash = (on: boolean) => { try { on ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY); } catch {} };
/** v21 (review #193): no door intro in a replay (straight to the board + replay bar); else the player's own choice. */
export const noIntro = () => isReplayUrl() || skipSplash();

let stingRes: () => void = () => {}; const sting = new Promise<void>((r) => (stingRes = r));
export const stingDone = () => sting;

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
	sting.then(() => { R.classList.add('in'); });
	runSting();
}
