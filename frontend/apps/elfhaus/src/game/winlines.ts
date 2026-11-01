// Win-line presentation: one thin glowing line at a time races along a winning payline from reel 1 to reel 5
// (canvas overlay, rAF, time-based). While a line plays only its winning symbols run the win sprite, its amount
// ticks into the WIN field and a small amount label shows near the line's end. After the last line a short summary
// highlights every winning symbol with no line over the board. v3.17: staged (winstage.ts): a = the glow + draw-on and
// hold, b = the lines one by one, c = the WIN meter count to the step total; a tap / double tap ends only the current
// stage (eased settle) and the next one plays normally. Turbo plays a fast version (no b). Normal pace = studio pace (anim-v4, tempo.ts TG; was x ANIM_TEMPO).
// Cost: one canvas, three strokes per frame (wide faint glow, mid glow, bright core) plus a pre-rendered head stamp;
// nothing animates filter/shadow, and the canvas is cleared and idle between lines.
import { LINES, REELS } from './config';
import { S, $, bet, cellEl, setWinMeter } from './ui';
import { symWin, clearSymWins, litOn, burst } from './fx';
import { ovWin, clearOvWins } from './mergefx';
import { moneyWin } from './format';
import type { LineWin } from './typesBookEvent';
import { TG } from './tempo'; // anim-v4: win lines run at gameplay pace (not ANIM_TEMPO)
import { sfx } from './audio';
import { voice } from './voice';
import { skipCounts, levelOf, WIN_EDGES, BIG_TIERS, maxLevel } from './countup';
import { presenting, stage } from './winstage';

let cv: HTMLCanvasElement | null = null, ctx: CanvasRenderingContext2D | null = null, dpr = 1;
let head: HTMLCanvasElement | null = null;
let skipLine = false, skipAll = false, active = false;

function ensure() {
	const board = $('#board');
	if (!cv) { cv = $('#lines') as unknown as HTMLCanvasElement; ctx = cv.getContext('2d'); }
	const w = board.clientWidth, h = board.clientHeight; dpr = Math.min(2, window.devicePixelRatio || 1);
	if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
	if (!head) { // baked soft head glow (drawn once)
		head = document.createElement('canvas'); head.width = head.height = 64; const g = head.getContext('2d')!;
		const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
		rg.addColorStop(0, '#FFFFFFFF'); rg.addColorStop(.18, '#FFF1C8F0'); rg.addColorStop(.45, '#FFC83D70'); rg.addColorStop(1, '#FFC83D00');
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
	stroke(g, pts, p, alpha);
	g.globalAlpha = 1;
}
/** M1: thicker line with a gold glow (black-gold kit), drawn on progressively; the head stamp leads it. */
function stroke(g: CanvasRenderingContext2D, pts: number[][], p: number, alpha: number) {
	const k = S.cell / 78; // 4 px core on a ~78 px phone cell, proportional on desktop
	g.lineCap = 'round'; g.lineJoin = 'round'; g.globalAlpha = alpha;
	for (const [w, col] of [[16 * k, '#FFC83D1c'], [9 * k, '#FFC83D55'], [5 * k, '#FFD86Acc'], [2.2 * k, '#FFF8E6']] as const) {
		g.lineWidth = w; g.strokeStyle = col; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
		for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
		g.stroke();
	}
	if (p < 1) { const h = pts[pts.length - 1], s = 30 * k; g.drawImage(head!, h[0] - s / 2, h[1] - s / 2, s, s); }
}
function cut(P: ReturnType<typeof path>, p: number) {
	let left = P.len * p; const pts = [P.pts[0]];
	for (let i = 0; i < P.seg.length && left > 0; i++) {
		const f = Math.min(1, left / P.seg[i]), a = P.pts[i], b = P.pts[i + 1];
		pts.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); left -= P.seg[i];
	}
	return pts;
}
function drawAll(Ps: ReturnType<typeof path>[], p: number, alpha: number) {
	const g = ctx!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, cv!.width, cv!.height);
	if (alpha <= 0) return;
	for (const P of Ps) stroke(g, cut(P, p), p, alpha);
	g.globalAlpha = 1;
}
const frame = () => new Promise<number>((r) => requestAnimationFrame(r));
const easeIO = (t: number) => (t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
async function run(ms: number, fn: (t: number) => void) {
	const t0 = performance.now();
	for (;;) { const now = await frame(); if (skipLine || skipAll) { fn(1); return; } const t = Math.min(1, (now - t0) / ms); fn(t); if (t >= 1) return; }
}
async function hold(ms: number) { const t0 = performance.now(); while (performance.now() - t0 < ms && !skipLine && !skipAll) await frame(); }

/** Legacy tap hook (game.ts): win taps now go through winstage.skipStage; kept as a no-op for callers. */
export function tapLines() {}
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

/** Re-audit M1/M2: every line of the step draws on at once (thick gold glow), every winning symbol pops while the
 *  rest dim, and the WIN meter counts smoothly from the step's start to its total in one go (no per-line steps, no
 *  jump). Then, when there is more than one line, each line is shown once on its own with its amount (a short cycle,
 *  capped so a step never drags). v3.17 stages (winstage.ts): a = draw-on + hold, b = the line cycle, c = the meter
 *  landing on the step total; a skip ends only the current stage. base = WIN meter value (x bet) before this step. */
export type WithLines = { start: () => Promise<void>; finish: () => void; holes: boolean } | null;
export async function playWins(wins: LineWin[], base: number, stepTotal?: number, fx: WithLines = null) {
	ensure(); active = true; skipAll = false; skipLine = false;
	presenting(true);
	try {
	const cells = document.querySelectorAll('.cell'); cells.forEach((c) => c.classList.add('dim'));
	const n = wins.length, turbo = S.turbo;
	// the step total is the book's winInfo.totalWin (math); the line sum is only a fallback for a book without it
	const tot = base + (Number.isFinite(stepTotal) ? stepTotal! : wins.reduce((a, w) => a + w.win, 0)) / 100;
	const Ps = wins.map((w) => path(w.lineIndex));
	// v20 (James: ~4 s of count-up on a 0.05x win): the presentation scales with the step's size (x bet): the line cycle is
	// capped at 0.9 s under 1x, 1.6 s under 5x, else 2.4 s; the all-lines hold at 0.5 s under 1x
	const sx = tot - base, small = sx < 1, cycleMs = sx < 1 ? 900 : sx < 5 ? 1600 : 2400;
	// a) all at once: symbols pop, lines draw on together; the meter starts counting to the step total (it keeps
	//    counting through a / b skips: its own stage is c)
	if (n) sfx('winline_highlight');
	clearSymWins(); clearOvWins();
	wins.forEach((w) => w.positions.forEach((p) => { ovWin(p.reel); const c = cellEl(p.reel, p.row); c.classList.remove('dim');
		const fresh = !c.classList.contains('win'); c.classList.add('win'); litOn(c); symWin(c); if (fresh && !turbo) burst(c, 'pop'); }));
	const meter = setWinMeter(tot);
	const drawOn = turbo ? 160 : TG(420);
	// chalet item 6: the winning symbols pop and puff into snow WHILE the lines draw on (fx, puff.ts puffWith): the
	// puff fires as the lines reach across (~half the draw-on) and stage a holds until both are done
	await stage('a', () => { skipLine = true; fx?.finish(); }, async () => {
		const puff = fx ? new Promise<void>((r) => setTimeout(r, skipLine ? 0 : drawOn * 0.45)).then(fx.start) : null;
		await run(drawOn, (t) => drawAll(Ps, easeIO(t), 1));
		await hold(turbo ? 120 : TG(Math.min(small ? 500 : 900, 380 + 120 * n)));
		if (puff) await puff;
	});
	skipLine = false;
	// b) cycle: each line alone with its amount (more than one line, not turbo); capped at ~2.4 s in total
	// (a respin refills the puffed cells next: no per-line cycle over the empty cells)
	if (n > 1 && !turbo && !fx?.holes) {
		await stage('b', () => { skipAll = true; }, async () => {
			const per = TG(Math.max(240, Math.min(520, cycleMs / n)));
			for (let i = 0; i < n && !skipAll; i++) {
				skipLine = false; const w = wins[i];
				document.querySelectorAll('.cell.win').forEach((c) => c.classList.add('soft'));
				w.positions.forEach((p) => { const c = cellEl(p.reel, p.row); c.classList.remove('soft'); c.classList.remove('pulse'); void (c as HTMLElement).offsetWidth; c.classList.add('pulse'); });
				const L = label(w.positions, moneyWin(w.win / 100 * bet()));
				await run(per * 0.3, (t) => draw(Ps[i], 1, t));
				await hold(per * 0.7);
				L.remove();
			}
		});
		document.querySelectorAll('.cell.soft').forEach((c) => c.classList.remove('soft'));
		document.querySelectorAll('.wlAmt').forEach((e) => e.remove());
	}
	skipLine = false; skipAll = false;
	clearRace();
	// c) the meter lands on the step total (a skip eases it there, countup SETTLE_MS), then a short beat
	let skipC = false;
	await stage('c', () => { skipC = true; skipCounts(); }, async () => {
		await meter;
		// v3.19: by the round's math win level (standard edges): up to the level below 2x small, the next medium, the one
		// below the first banner level big; banner levels get the big-win sting instead; turbo = small only
		const lv = levelOf(tot, WIN_EDGES), bl = BIG_TIERS[0]?.level ?? maxLevel(), medL = bl - 2;
		if (n && lv < bl) sfx(turbo || lv < medL ? 'win_small' : lv === medL ? 'win_medium' : 'win_big');
		if (n && !turbo && lv >= medL && lv < bl) voice('win');
		wins.forEach((w) => w.positions.forEach((p) => { ovWin(p.reel); const c = cellEl(p.reel, p.row); c.classList.remove('dim'); c.classList.add('win'); litOn(c); symWin(c); }));
		if (!skipC) { const t0 = performance.now(), ms = turbo ? 200 : TG(small ? 300 : 500); while (performance.now() - t0 < ms && !skipC) await frame(); }
	});
	document.querySelectorAll('.cell.pulse').forEach((c) => c.classList.remove('pulse'));
	} finally { active = false; skipAll = false; skipLine = false; presenting(false); }
}
