// Win-line presentation: one thin glowing line at a time races along a winning payline from reel 1 to reel 5
// (canvas overlay, rAF, time-based). While a line plays only its winning symbols run the win sprite, its amount
// ticks into the WIN field and a small amount label shows near the line's end. After the last line a short summary
// highlights every winning symbol with no line over the board. v3.17: staged (winstage.ts): a = the glow + draw-on and
// hold, b = the lines one by one, c = the WIN meter count to the step total; a tap / double tap ends only the current
// stage (eased settle) and the next one plays normally. Turbo plays a fast version (no b). Normal pace = studio pace (anim-v4, tempo.ts TG; was x ANIM_TEMPO).
// Cost: one canvas, one painted line_seg per segment + joints + the line_head stamp (fx atlas);
// nothing animates filter/shadow, and the canvas is cleared and idle between lines.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { loadAtlas, atlasTex } from './scene/atlas';
import { boardStage, layer, kick, centreOf, animate, resolution } from './board/stage';
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

let skipLine = false, skipAll = false, active = false;
// fix7: the lines are Pixi sprites (painted fx-atlas line_seg / line_joint / line_head) in the unified board stage
// (board/stage.ts layer `lines`), drawn once per frame at device px. Nodes sit on each cell's real centre (centreOf).
let G: Container | null = null, ready = false;
const pool: Sprite[] = []; let used = 0;
function ensure() {
	void boardStage().then((a) => { if (!a || G) return; G = new Container(); G.label = 'winlines'; layer.lines.addChild(G); });
	if (!ready) void loadAtlas('fx').then(() => { ready = true; });
}
function begin() { used = 0; }
function end() { for (let i = used; i < pool.length; i++) pool[i].visible = false; kick(); }
function put(name: string, x: number, y: number, w: number, h: number, rot: number, alpha: number) {
	if (!G || !ready) return;
	let s = pool[used]; if (!s) { s = new Sprite(); s.anchor.set(0.5); pool.push(s); G.addChild(s); }
	used++; s.texture = atlasTex('fx', name); s.visible = true; s.position.set(x, y); s.rotation = rot; s.width = w; s.height = h; s.alpha = alpha;
}
/** Points of the line through the cells' real centres (frame-local px), from just outside reel 1 to just outside the last reel. */
function path(li: number) {
	const ln = LINES[li - 1], pts = ln.map((row, r) => { const C = centreOf(cellEl(r, row)); return [C.x, C.y]; });
	const c = cellEl(0, 0).offsetWidth || S.cell, ext = c * 0.42;
	pts.unshift([pts[0][0] - ext, pts[0][1]]); pts.push([pts[pts.length - 1][0] + ext, pts[pts.length - 1][1]]);
	const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
	return { pts, seg, len: seg.reduce((a, b) => a + b, 0), c };
}
function draw(P: ReturnType<typeof path>, p: number, alpha: number) {
	begin(); if (alpha > 0) stroke(cut(P, p), p, alpha, P.c); end();
}
/** The win line as painted fx-atlas parts laid along the path: line_seg stretched along each segment, line_joint on every
 *  bend, line_head leading while it draws on (no code-drawn strokes or gradients). */
function stroke(pts: number[][], p: number, alpha: number, c: number) {
	const k = c / 78, th = 18 * k;
	for (let i = 1; i < pts.length; i++) {
		const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (L < 0.5) continue;
		put('line_seg', (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, L + th * 0.5, th, Math.atan2(dy, dx), alpha);
	}
	for (let i = 1; i < pts.length - 1; i++) put('line_joint', pts[i][0], pts[i][1], th * 1.3, th * 1.3, 0, alpha);
	if (p < 1) { const h = pts[pts.length - 1], s = 30 * k; put('line_head', h[0], h[1], s, s, 0, alpha); }
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
	begin(); if (alpha > 0) for (const P of Ps) stroke(cut(P, p), p, alpha, P.c); end();
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

/** The line's amount: a cream pill (ink rim, gold inner line, Lilita One) over the middle of its winning cells, in the
 *  board stage's winAmt layer, its text rasterised once at the stage's device resolution. Rises 6 px and fades in. */
const amts = new Set<Container>();
function label(pos: { reel: number; row: number }[], txt: string) {
	const box = new Container(); box.label = 'wlAmt';
	const m = pos[Math.floor((pos.length - 1) / 2)], C = centreOf(cellEl(m.reel, m.row)), c = C.w || S.cell;
	const t = new Text({ text: txt, resolution: resolution(), style: { fontFamily: 'Lilita One', fontSize: Math.round(c * 0.22), fill: 0x26140f } });
	t.anchor.set(0.5);
	const h = Math.round(c * 0.42), w = Math.max(Math.round(c * 0.95), Math.ceil(t.width + c * 0.3)), r = h / 2;
	const g = new Graphics().roundRect(-w / 2, 3 - h / 2, w, h, r).fill(0x26140f)
		.roundRect(-w / 2, -h / 2, w, h, r).fill(0xfbf3e4).stroke({ width: 3, color: 0x26140f, alignment: 1 })
		.roundRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, r - 2).stroke({ width: 2, color: 0xf2b935, alignment: 1 });
	box.addChild(g, t);
	// kept inside the board window, at the cell's real centre (frame-local px)
	const bd = centreOf($('#board')), x = Math.max(bd.x - bd.w / 2 + w / 2 + 4, Math.min(bd.x + bd.w / 2 - w / 2 - 4, C.x));
	box.position.set(x, C.y + 6); box.alpha = 0; layer.winAmt?.addChild(box); amts.add(box);
	const t0 = performance.now();
	animate(() => { if (box.destroyed) return false; const u = Math.min(1, (performance.now() - t0) / 180); box.alpha = u; box.y = C.y + 6 * (1 - u); return u < 1; });
	return { remove: () => { amts.delete(box); if (!box.destroyed) box.destroy({ children: true }); kick(); } };
}
export function clearAmts() { for (const b of [...amts]) { amts.delete(b); if (!b.destroyed) b.destroy({ children: true }); } kick(); }
export function clearRace() {
	begin(); end(); clearAmts();
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
		clearAmts();
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
