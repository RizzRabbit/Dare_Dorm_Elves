// Intro: Rizzin Games studio sting (2.3 s, tap skips), then the feature splash (title + 3 feature cards + TAP TO PARTY)
// over the loading screen while assets finish loading. Art: /workspace/elfhaus-polish (INTEGRATION.md §4-5).
// "Don't show this again" (localStorage) skips the splash for returning players: after the sting the game opens as
// soon as loading is done. Motion is transform/opacity only (WAAPI); glow is baked into the images.
import { loadSheet, play, type Atlas } from './sprite';
import { LOADER_CARDS } from './loader';
import LAYOUT from '../assets/intro/splash_layout.json';
import { ART } from './ui';
import { fitStage } from './stage';
import GLINT_ATLAS from '../assets/intro/sting_glint.atlas.json';
const U = import.meta.glob('../assets/intro/*.webp', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;
const url = (f: string) => U['../assets/intro/' + f] || '';

// art: an ART key, or (egw, v3.6) the approved stacks r8d still of the merged pair instead of the old static WM2 scene
const CARDS: Record<'modes' | 'sticky' | 'egw', { art: string; title: string; line: string }> = {
	modes: { art: 'S', title: '4 Bonus Modes', line: 'Dare, Double, Triple or a Mystery Spin.' },
	sticky: { art: 'W_R2', title: 'Sticky Wilds', line: 'Wilds lock in place and grow every respin.' },
	egw: { art: 'assets/stacks/still/WM2_R1-2.webp', title: 'Elves Gone Wild', line: 'Full wild reels side by side multiply.' },
};

const KEY = 'elfhaus.skipSplash';
export const skipSplash = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };

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
	// on short phones (Stake in iPhone Safari, ~390x550-660 visible) TAP TO PARTY sat on top of it and a tap ticked the box
	const keep = o === 'port' ? 2 * 30 : 0;
	st.style.setProperty('--sps', String(Math.min(S.w / d.size[0], (S.h - keep) / d.size[1])));
	R.querySelector<HTMLElement>('.spBg')!.style.backgroundImage = `url(${url(d.bg)})`;
	const t = R.querySelector<HTMLImageElement>('.spTitle')!; if (!t.src.endsWith(d.title.img)) t.src = url(d.title.img); place(t, d.title);
	// aifix (audit 3): the painted panels (garbled AI lettering, fake mini-boards) are replaced by plain HTML cards: the
	// real in-game art + a short title + one line, in the layout's slots (3 across in landscape, stacked in portrait).
	let ps = [...R.querySelectorAll<HTMLElement>('.spPanel')];
	if (ps.length !== d.panels.length) {
		ps.forEach((p) => p.remove());
		ps = d.panels.map(() => { const p = document.createElement('div'); p.className = 'spEl spPanel spCard'; st.insertBefore(p, st.querySelector('.spBarWrap')); return p; });
	}
	ps.forEach((p, i) => { const q = d.panels[i];
		const key = /modes/.test(q.img) ? 'modes' : /sticky/.test(q.img) ? 'sticky' : 'egw', c = CARDS[key];
		if (p.dataset.k !== key) { p.dataset.k = key; p.setAttribute('aria-label', LOADER_CARDS[key === 'modes' ? 0 : key === 'sticky' ? 1 : 2]);
			const src = c.art.includes('/') ? c.art : ART[c.art];
			p.innerHTML = `<div class="spArt">${src ? `<img src="${src}" alt="" draggable="false">` : ''}</div><div class="spTxt"><h3></h3><p></p></div>`;
			p.querySelector('h3')!.textContent = c.title; p.querySelector('p')!.textContent = c.line; }
		place(p, q); p.style.setProperty('--d', q.delayMs + 'ms'); });
	const tp = R.querySelector<HTMLImageElement>('#lGo img')!; if (tp.getAttribute('src') !== url(d.tap.img)) tp.src = url(d.tap.img);
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
		// aifix: the sting_glint sheet ends in four-point stars, so the studio logo just settles in (scale + glow opacity)
		void sheet; void gl; void play;
		timers.push(window.setTimeout(end, 2300));
	});
}

export function initSplash() {
	const R = document.getElementById('loader'); if (!R) return;
	R.classList.toggle('quick', skipSplash());
	const cb = R.querySelector<HTMLInputElement>('#spSkip')!;
	cb.checked = skipSplash();
	cb.onchange = () => { try { cb.checked ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY); } catch {} };
	layout(); addEventListener('resize', layout);
	// iOS: the visible box changes without a window resize (bars) and reports late after a rotation
	visualViewport?.addEventListener('resize', layout); addEventListener('orientationchange', () => { setTimeout(layout, 120); setTimeout(layout, 500); });
	sting.then(() => { R.classList.add('in'); removeEventListener('resize', layout); addEventListener('resize', layout); });
	runSting();
}
