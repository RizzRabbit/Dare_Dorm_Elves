// MAX WIN celebration: shown ONLY when a round hits the 50,000x cap (wincap event).
// Generated clip of the five elves jumping + code-driven matte confetti, carved "MAX WIN" and a 50,000x count-up.
// The clip is lazy: nothing is fetched during loading; preloadMaxWin() warms it once the game has started.
import { $, ART, bet } from './ui';
import { MAX_WIN_X } from './config';
import { money } from './format';

let vid: HTMLVideoElement | null = null;

function video(): HTMLVideoElement {
	if (vid) return vid;
	vid = document.createElement('video');
	vid.muted = true; vid.playsInline = true; vid.preload = 'auto';
	vid.setAttribute('playsinline', ''); vid.setAttribute('aria-hidden', 'true');
	for (const [src, type] of [[ART.maxwin_webm, 'video/webm'], [ART.maxwin_mp4, 'video/mp4']] as const) {
		if (!src) continue;
		const s = document.createElement('source'); s.src = src; s.type = type; vid.appendChild(s);
	}
	vid.className = 'mwVid';
	return vid;
}

/** Warm the clip in the background after the game is up (idle time, no effect on the loader). */
export function preloadMaxWin() {
	const go = () => { const v = video(); $('#maxwin .mwStage').prepend(v); v.load(); };
	const ric = (window as any).requestIdleCallback as ((f: () => void, o?: object) => void) | undefined;
	setTimeout(() => (ric ? ric(go, { timeout: 4000 }) : go()), 1500);
}

// ---- matte confetti (flat paper chips, greys/lilacs/plums; no glow) ----
const COLS = ['#F2EEFA', '#E4E1EC', '#CDBDEB', '#B9B3C6', '#A28FC8', '#8E7BB5', '#6E5C92', '#544870'];
type Chip = { x: number; y: number; vx: number; vy: number; r: number; vr: number; w: number; h: number; c: string; t: number };
function confetti(cv: HTMLCanvasElement, ms: number) {
	const ctx = cv.getContext('2d')!; const dpr = Math.min(2, devicePixelRatio || 1);
	const size = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
	size(); addEventListener('resize', size);
	const chips: Chip[] = []; let run = true; const t0 = performance.now(); let last = t0;
	const burst = (n: number, fromTop: boolean) => {
		for (let i = 0; i < n; i++) {
			const W = innerWidth, H = innerHeight;
			const side = Math.random() < 0.5 ? -1 : 1;
			chips.push(fromTop
				? { x: Math.random() * W, y: -20 - Math.random() * H * 0.3, vx: (Math.random() - 0.5) * 60, vy: 60 + Math.random() * 120, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 8, w: 6 + Math.random() * 7, h: 9 + Math.random() * 9, c: COLS[(Math.random() * COLS.length) | 0], t: Math.random() * 6.28 }
				: { x: side < 0 ? -10 : W + 10, y: H * (0.55 + Math.random() * 0.3), vx: -side * (380 + Math.random() * 520), vy: -(520 + Math.random() * 520), r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 12, w: 6 + Math.random() * 7, h: 9 + Math.random() * 9, c: COLS[(Math.random() * COLS.length) | 0], t: Math.random() * 6.28 });
		}
	};
	burst(140, false); burst(90, true);
	const timers = [setTimeout(() => burst(110, false), 1300), setTimeout(() => burst(80, true), 2600), setTimeout(() => burst(110, false), 3900)];
	const frame = (now: number) => {
		if (!run) return;
		const dt = Math.min(0.05, (now - last) / 1000); last = now;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, innerWidth, innerHeight);
		for (let i = chips.length - 1; i >= 0; i--) {
			const p = chips[i];
			p.vy += 520 * dt; p.vx *= 1 - 1.6 * dt; p.vy = Math.min(p.vy, 260); p.t += dt * 6;
			p.x += (p.vx + Math.sin(p.t) * 30) * dt; p.y += p.vy * dt; p.r += p.vr * dt;
			if (p.y > innerHeight + 30) { chips.splice(i, 1); continue; }
			ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, Math.abs(Math.cos(p.t)) * 0.8 + 0.2);
			ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
		}
		if (now - t0 < ms || chips.length) requestAnimationFrame(frame);
	};
	requestAnimationFrame(frame);
	return () => { run = false; timers.forEach(clearTimeout); removeEventListener('resize', size); ctx.clearRect(0, 0, cv.width, cv.height); };
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/** Full-screen MAX WIN: ~6s show (clip, confetti, count-up), then the amount holds until a click/tap/key. */
export async function maxWinCelebration() {
	const M = $('#maxwin'); const v = video();
	if (!v.parentElement) $('#maxwin .mwStage').prepend(v);
	const xEl = M.querySelector('.mwX') as HTMLElement, amtEl = M.querySelector('.mwAmt') as HTMLElement, hint = M.querySelector('.mwHint') as HTMLElement;
	const total = MAX_WIN_X * bet();
	xEl.textContent = '0x'; amtEl.textContent = money(0);
	hint.textContent = matchMedia('(pointer: coarse)').matches ? 'TAP TO CONTINUE' : 'CLICK TO CONTINUE';
	M.classList.remove('hidden', 'held', 'out'); void M.offsetWidth; M.classList.add('on');
	try { v.currentTime = 0; await v.play(); } catch { M.classList.add('noVid'); }
	const stop = confetti(M.querySelector('canvas') as HTMLCanvasElement, 6000);
	const dur = 4200, t0 = performance.now();
	await new Promise<void>((res) => {
		const tick = (now: number) => {
			const k = Math.min(1, (now - t0) / dur), e = ease(k);
			xEl.textContent = `${Math.round(MAX_WIN_X * e).toLocaleString('en-US')}x`;
			amtEl.textContent = money(k < 1 ? Math.floor(total * e * 100) / 100 : total);
			k < 1 ? requestAnimationFrame(tick) : res();
		};
		requestAnimationFrame(tick);
	});
	xEl.textContent = `${MAX_WIN_X.toLocaleString('en-US')}x`; amtEl.textContent = money(total);
	M.classList.add('landed');
	await new Promise((r) => setTimeout(r, 1600));
	M.classList.add('held');
	await new Promise<void>((res) => {
		const done = (e: Event) => {
			if (e instanceof KeyboardEvent && !['Space', 'Enter', 'Escape'].includes(e.code)) return;
			e.preventDefault(); e.stopPropagation();
			M.removeEventListener('pointerdown', done); removeEventListener('keydown', done, { capture: true } as any); res();
		};
		M.addEventListener('pointerdown', done); addEventListener('keydown', done, { capture: true });
	});
	M.classList.add('out'); stop();
	await new Promise((r) => setTimeout(r, 450));
	v.pause(); M.classList.add('hidden'); M.classList.remove('on', 'landed', 'held', 'out', 'noVid');
}
