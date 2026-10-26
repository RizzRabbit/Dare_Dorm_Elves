// Win-line presentation: one thin glowing line at a time races along a winning payline from reel 1 to reel 5
// (canvas overlay, rAF, time-based). While a line plays only its winning symbols run the win sprite, its amount
// ticks into the WIN field and a small amount label shows near the line's end. After the last line a short summary
// highlights every winning symbol with no line over the board. Tap = finish this line now and go to the next one;
// a second quick tap = skip to the summary. Turbo plays a fast version. Normal pace = the old one x ANIM_TEMPO (tempo.ts).
// Cost: one canvas, three strokes per frame (wide faint glow, mid glow, bright core) plus a pre-rendered head stamp;
// nothing animates filter/shadow, and the canvas is cleared and idle between lines.
import { LINES, REELS } from './config';
import { S, $, bet, cellEl, setWinMeter } from './ui';
import { symWin, clearSymWins, litOn, burst } from './fx';
import { ovWin, clearOvWins } from './mergefx';
import { play } from './sprite';
import { money } from './format';
import type { LineWin } from './typesBookEvent';
import { T } from './tempo';
import { sfx } from './audio';
import { voice } from './voice';

let cv: HTMLCanvasElement | null = null, ctx: CanvasRenderingContext2D | null = null, dpr = 1;
let head: HTMLCanvasElement | null = null;
let skipLine = false, skipAll = false, lastTap = 0, active = false;

function ensure() {
	const board = $('#board');
	if (!cv) { cv = $('#lines') as unknown as HTMLCanvasElement; ctx = cv.getContext('2d'); }
	const w = board.clientWidth, h = board.clientHeight; dpr = Math.min(2, window.devicePixelRatio || 1);
	if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
	if (!head) { // baked soft head glow (drawn once)
		head = document.createElement('canvas'); head.width = head.height = 64; const g = head.getContext('2d')!;
		const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
		rg.addColorStop(0, '#FFFFFFFF'); rg.addColorStop(.18, '#FFE3F1F0'); rg.addColorStop(.45, '#F06AB070'); rg.addColorStop(1, '#C42A7800');
		g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
	}
}
/** Points of the line through cell centres, from just outside reel 1 to just outside the last reel. */
function path(li: number) {
	const ln = LINES[li - 1], c = S.cell, pts = ln.map((row, r) => [r * c + c / 2, row * c + c / 2]);
	const ext = c * 0.42; pts.unshift([pts[0][0] - ext, pts[0][1]]); pts.push([pts[pts.length - 1][0] + ext, pts[pts.length - 1][1]]);
	const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
	return { pts, seg, len: seg.reduce((a, b) => a + b, 0) };
}
function draw(P: ReturnType<typeof path>, p: number, alpha: number) {
	const g = ctx!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, cv!.width, cv!.height);
	if (alpha <= 0) return;
	let left = P.len * p; const pts = [P.pts[0]];
	for (let i = 0; i < P.seg.length && left > 0; i++) {
		const f = Math.min(1, left / P.seg[i]), a = P.pts[i], b = P.pts[i + 1];
		pts.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); left -= P.seg[i];
	}
	const k = S.cell / 78; // 2.5 px core on a ~78 px phone cell, proportional on desktop
	g.lineCap = 'round'; g.lineJoin = 'round'; g.globalAlpha = alpha;
	for (const [w, col] of [[9 * k, '#C42A7826'], [5 * k, '#F06AB066'], [2.5 * k, '#FFF2F8']] as const) {
		g.lineWidth = w; g.strokeStyle = col; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
		for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
		g.stroke();
	}
	if (p < 1) { const h = pts[pts.length - 1], s = 26 * k; g.drawImage(head!, h[0] - s / 2, h[1] - s / 2, s, s); }
	g.globalAlpha = 1;
}
const frame = () => new Promise<number>((r) => requestAnimationFrame(r));
const easeIO = (t: number) => (t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
async function run(ms: number, fn: (t: number) => void) {
	const t0 = performance.now();
	for (;;) { const now = await frame(); if (skipLine || skipAll) { fn(1); return; } const t = Math.min(1, (now - t0) / ms); fn(t); if (t >= 1) return; }
}
async function hold(ms: number) { const t0 = performance.now(); while (performance.now() - t0 < ms && !skipLine && !skipAll) await frame(); }

/** Tap handler (wired in game.ts): first tap finishes the current line, a second quick tap skips to the end. */
export function tapLines() {
	if (!active) return; const now = performance.now();
	if (now - lastTap < 400) skipAll = true; else skipLine = true;
	lastTap = now;
}
export const linesActive = () => active;

/** Small floating amount over the middle of the line's winning cells (rises and fades in; transform/opacity only). */
function label(pos: { reel: number; row: number }[], txt: string) {
	const el = document.createElement('div'); el.className = 'wlAmt'; el.innerHTML = `<b></b>`; el.firstElementChild!.textContent = txt;
	// aifix (audit 1): no win-plate glint (its sheet carries a four-point star)
	const m = pos[Math.floor((pos.length - 1) / 2)], W = REELS * S.cell;
	el.style.left = Math.max(S.cell * .6, Math.min(W - S.cell * .6, m.reel * S.cell + S.cell / 2)) + 'px'; el.style.top = (m.row * S.cell + S.cell * .5) + 'px';
	$('#board').appendChild(el); return el;
}
export function clearRace() {
	if (ctx && cv) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); }
	document.querySelectorAll('.wlAmt').forEach((e) => e.remove());
}

/** Play the step's line wins one at a time. base = WIN meter value (x bet) before this step. */
export async function playWins(wins: LineWin[], base: number) {
	ensure(); active = true; skipAll = false; lastTap = 0;
	const cells = document.querySelectorAll('.cell'); cells.forEach((c) => c.classList.add('dim'));
	const n = wins.length, turbo = S.turbo;
	// per line: race + hold; long lists get faster so a step never drags (old pace ~0.55 s/line, min ~0.3 s; x ANIM_TEMPO)
	const race = turbo ? 150 : T(Math.max(220, Math.min(380, 2600 / n - 180))), keep = turbo ? 90 : Math.max(T(100), Math.min(T(260), race * .7));
	let sum = 0, li = 0;
	for (const w of wins) {
		if (skipAll) break; skipLine = false;
		if (!turbo || li === 0) sfx('winline_highlight'); li++;
		clearSymWins(); document.querySelectorAll('.cell.win').forEach((c) => { c.classList.remove('win'); c.classList.add('dim'); });
		clearOvWins(); w.positions.forEach((p) => { ovWin(p.reel); const c = cellEl(p.reel, p.row); c.classList.remove('dim'); const fresh = !c.classList.contains('win'); c.classList.add('win'); litOn(c); symWin(c); if (fresh && !turbo) burst(c, 'pop'); });
		const P = path(w.lineIndex); sum += w.win / 100;
		setWinMeter(base + sum);
		const L = label(w.positions, money(w.win / 100 * bet()));
		await run(race, (t) => draw(P, easeIO(t), 1));
		await hold(keep);
		await run(turbo ? 60 : T(110), (t) => draw(P, 1, 1 - t));
		L.remove();
	}
	skipLine = false;
	// summary: every winning symbol highlighted, no line over the board
	const tot = base + wins.reduce((a, w) => a + w.win / 100, 0);
	clearRace(); setWinMeter(tot);
	// round win so far (x bet): < 2 small, 2-5 medium, 5-10 big; >= 10 gets the big-win sting instead; turbo = small only
	if (n && tot < 10) sfx(turbo || tot < 2 ? 'win_small' : tot < 5 ? 'win_medium' : 'win_big');
	if (n && !turbo && tot >= 2 && tot < 10) voice('win');
	wins.forEach((w) => w.positions.forEach((p) => { ovWin(p.reel); const c = cellEl(p.reel, p.row); c.classList.remove('dim'); c.classList.add('win'); litOn(c); symWin(c); }));
	if (!skipAll) await hold(turbo ? 200 : T(450));
	active = false; skipAll = false;
}
