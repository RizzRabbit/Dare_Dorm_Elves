// Intro: Rizzin Games studio sting (2.3 s, tap skips), then the feature splash (title + 3 panels + TAP TO CONTINUE)
// over the loading screen while assets finish loading. Art: /workspace/elfhaus-polish (INTEGRATION.md §4-5).
// "Don't show this again" (localStorage) skips the splash for returning players: after the sting the game opens as
// soon as loading is done. Motion is transform/opacity only (WAAPI); glow is baked into the images.
import { loadSheet, play, type Atlas } from './sprite';
import LAYOUT from '../assets/intro/splash_layout.json';
import GLINT_ATLAS from '../assets/intro/sting_glint.atlas.json';
const U = import.meta.glob('../assets/intro/*.webp', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;
const url = (f: string) => U['../assets/intro/' + f] || '';

const KEY = 'elfhaus.skipSplash';
export const skipSplash = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };

let stingRes: () => void = () => {}; const sting = new Promise<void>((r) => (stingRes = r));
export const stingDone = () => sting;

type Lay = { size: number[]; bg: string; title: { img: string; cx: number; cy: number; w: number }; panels: { img: string; cx: number; cy: number; w: number; delayMs: number }[]; tap: { cx: number; cy: number; w: number } };
const L = LAYOUT as unknown as Record<'land' | 'port', Lay>;
const place = (el: HTMLElement, o: { cx: number; cy: number; w: number }) => { el.style.left = o.cx + 'px'; el.style.top = o.cy + 'px'; el.style.width = o.w + 'px'; };

function layout() {
	const R = document.getElementById('loader'); if (!R) return;
	const o: 'land' | 'port' = innerWidth >= innerHeight ? 'land' : 'port', d = L[o];
	R.dataset.o = o;
	const st = R.querySelector<HTMLElement>('.spStage')!;
	st.style.width = d.size[0] + 'px'; st.style.height = d.size[1] + 'px';
	st.style.setProperty('--sps', String(Math.min(innerWidth / d.size[0], innerHeight / d.size[1])));
	R.querySelector<HTMLElement>('.spBg')!.style.backgroundImage = `url(${url(d.bg)})`;
	const t = R.querySelector<HTMLImageElement>('.spTitle')!; if (!t.src.endsWith(d.title.img)) t.src = url(d.title.img); place(t, d.title);
	R.querySelectorAll<HTMLImageElement>('.spPanel').forEach((p, i) => { const q = d.panels[i]; const src = url(q.img); if (p.getAttribute('src') !== src) p.src = src; place(p, q); p.style.setProperty('--d', q.delayMs + 'ms'); });
	place(R.querySelector<HTMLElement>('#lGo')!, d.tap);
	place(R.querySelector<HTMLElement>('.spBarWrap')!, { ...d.tap, w: d.tap.w * 0.9 });
}

function runSting() {
	const S = document.getElementById('sting'); if (!S) { stingRes(); return; }
	const logo = S.querySelector<HTMLImageElement>('.stLogo')!, glow = S.querySelector<HTMLImageElement>('.stGlow')!, gl = S.querySelector<HTMLElement>('.stGlint')!, box = S.querySelector<HTMLElement>('.stBox')!;
	logo.src = url('sting_logo.webp'); glow.src = url('sting_glow.webp');
	const sheet = loadSheet('sting_glint', url('sting_glint.webp'), GLINT_ATLAS as unknown as Atlas).catch(() => {});
	let ended = false; const timers: number[] = [];
	const end = () => {
		if (ended) return; ended = true; timers.forEach(clearTimeout);
		S.animate([{ opacity: getComputedStyle(S).opacity }, { opacity: 0 }], { duration: 250, fill: 'forwards' }).finished.then(() => { S.remove(); stingRes(); });
	};
	S.addEventListener('pointerdown', end);
	Promise.race([logo.decode().catch(() => {}), new Promise((r) => setTimeout(r, 600))]).then(() => {
		if (ended) return;
		const ease = 'cubic-bezier(.34,1.56,.64,1)';
		box.animate([{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'scale(1)', offset: 450 / 2300, easing: 'linear' }, { opacity: 1, transform: 'scale(1.01)', offset: 1800 / 2300 }, { opacity: 0, transform: 'scale(1.04)' }],
			{ duration: 2300, fill: 'forwards' });
		logo.animate([{ transform: 'scale(.96)' }, { transform: 'none' }], { duration: 450, easing: ease });
		glow.animate([{ opacity: 0 }, { opacity: .8, offset: .2 }, { opacity: .9, offset: .45 }, { opacity: .7, offset: .7 }, { opacity: .8 }], { duration: 2000, delay: 200, fill: 'both' });
		timers.push(window.setTimeout(() => sheet.then(() => !ended && play('sting_glint', 'glint', gl, { cls: 'fxFill' })), 700));
		timers.push(window.setTimeout(end, 2300));
	});
}

export function initSplash() {
	const R = document.getElementById('loader'); if (!R) return;
	R.classList.toggle('quick', skipSplash());
	R.querySelector<HTMLImageElement>('#lGo img')!.src = url('splash_tap0.webp');
	const cb = R.querySelector<HTMLInputElement>('#spSkip')!;
	cb.checked = skipSplash();
	cb.onchange = () => { try { cb.checked ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY); } catch {} };
	layout(); addEventListener('resize', layout);
	sting.then(() => { R.classList.add('in'); removeEventListener('resize', layout); addEventListener('resize', layout); });
	runSting();
}
