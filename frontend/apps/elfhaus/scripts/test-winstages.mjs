// v3.17 staged win skip + count-up motion: unit tests, run by `pnpm test`.
// - winstage.ts: a skip ends exactly one stage, a double tap (2 taps < COALESCE_MS) counts as one skip, taps between
//   stages are consumed.
// - countup.ts countTiers under a simulated display (60 / 120 / 144 Hz): rapid double taps step through EVERY tier
//   checkpoint and then the final amount, in order; each checkpoint and the end land on the exact value; the whole
//   part never passes a checkpoint early; the decimals keep churning during the slowdown.
import { readFileSync } from 'node:fs';
import { transformWithEsbuild } from 'vite';
const load = async (f, patch = (s) => s) => {
	const src = patch(readFileSync(new URL('../src/game/' + f, import.meta.url), 'utf8'));
	const { code } = await transformWithEsbuild(src, f, { loader: 'ts', format: 'esm' });
	return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
};
let fail = 0; const ok = (c, m) => { if (c) console.log('  OK ' + m); else { fail++; console.error('  FAIL ' + m); } };

// ---- fake clock + rAF at a given Hz
let now = 0, q = [];
globalThis.performance = { now: () => now };
globalThis.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
globalThis.cancelAnimationFrame = () => {};
let HZ = 60;
const tick = () => { now += 1000 / HZ; const c = q; q = []; c.forEach((f) => f(now)); };
const run = (ms) => { const end = now + ms; while (now < end) tick(); };

const W = await load('winstage.ts');
const C = await load('countup.ts', (s) => s.replace(/import \{ moneyWin as money, moneyDigits \} from '\.\/format';[^\n]*/, () => `const money = (v, d = 2) => '$' + Number(v).toFixed(d); const moneyDigits = () => 2;`));

// v3.19: the banner stages come from the math's standard win levels (synced into modes.generated.json)
const GEN = JSON.parse(readFileSync(new URL('../src/game/modes.generated.json', import.meta.url), 'utf8'));
const EDGES = GEN.math.winLevels.standard; C.setWinLevels(EDGES);
// the math's own win_level (game_calculations.py): first edge above x, 1-based; past the last edge = max level
const mathLevel = (x) => { const i = EDGES.findIndex((e) => x < e); return i < 0 ? EDGES.length + 1 : i + 1; };

console.log('\n=== big-win stages follow the math win levels ===');
ok(EDGES.length >= 5 && EDGES.every((e, i) => !i || e > EDGES[i - 1]), `synced standard edges: ${EDGES.join(', ')}`);
const probes = [0, ...EDGES.flatMap((e) => [e - 0.01, e, e + 0.01]), EDGES.at(-1) * 2];
ok(probes.every((x) => C.levelOf(x, EDGES) === mathLevel(x)), 'levelOf matches the math win_level at every edge');
const top = EDGES.length + 1;
ok(C.maxLevel() === top, `max level ${top} (wincap screen, not a banner stage)`);
ok(C.BIG_TIERS.every((t) => t.x === EDGES[t.level - 2] && C.STAGE_OF_LEVEL[t.level] === t.name), 'each stage starts at its level\'s lower math edge: ' + C.BIG_TIERS.map((t) => `L${t.level} ${t.name} >= ${t.x}x`).join(' | '));
ok(!C.BIG_TIERS.some((t) => t.level >= top), 'no banner stage on the max level');
ok(C.BIG_TIERS.map((t) => t.level).join() === Object.keys(C.STAGE_OF_LEVEL).map(Number).sort((a, b) => a - b).join(), 'every mapped level has a stage');
for (let L = 1; L < top; L++) {
	const lo = L === 1 ? 0 : EDGES[L - 2], hi = EDGES[L - 1], xs = [lo, (lo + hi) / 2, hi - 0.01].filter((x) => x >= 0 && mathLevel(x) === L);
	const want = C.BIG_TIERS.filter((t) => t.level <= L).map((t) => t.name).join();
	ok(xs.every((x) => C.tierPlan(x, false, L).tiers.map((t) => t.name).join() === want && C.tierPlan(x).tiers.map((t) => t.name).join() === want), `level ${L} (${lo}x-${hi}x): ${want || 'normal win, no banner'}`);
}
// the book's winLevel decides, not the amount: a level-6 event shows BIG only even if the amount sits higher
ok(C.tierPlan(EDGES[6] + 1, false, 6).tiers.map((t) => t.name).join() === C.BIG_TIERS[0].name, 'the event winLevel decides the stages (level 6 at a higher amount = BIG WIN only)');
ok(C.tierPlan(EDGES[4] - 1, false, 9).tiers.every((t) => t.x <= EDGES[4] - 1), 'never crawls past the amount even if the level says more');
const bwe = readFileSync(new URL('../src/game/bigwinElves.ts', import.meta.url), 'utf8');
ok(/BIGWIN_ELVES_LEVEL = Math\.max\(\.\.\.Object\.keys\(STAGE_OF_LEVEL\)/.test(bwe) && !/MIN_X\s*=\s*\d/.test(bwe), 'the elves layer is tied to the top banner level (no x threshold)');
const ui = readFileSync(new URL('../src/game/ui.ts', import.meta.url), 'utf8'), bem = readFileSync(new URL('../src/game/bookEventHandlerMap.ts', import.meta.url), 'utf8'), cu = readFileSync(new URL('../src/game/countup.ts', import.meta.url), 'utf8');
ok(!/x:\s*(10|25|50|100|1000)\b/.test(cu) && !/>=\s*1000\b/.test(ui) && /bigWin\(x, undefined, lvl\)/.test(bem) && /ev\.winLevel/.test(bem), 'no frontend win thresholds; setWin passes the book winLevel');

console.log('\n=== win stages: coalescing ===');
W._resetStages(); W.presenting(true);
let s1 = 0; W.beginStage('a', () => s1++);
now = 10000; ok(W.skipStage(now) === true && s1 === 1, 'tap skips stage a');
W.endStage('a'); W.beginStage('b', () => s1++);
ok(W.skipStage(now + 80) === true && s1 === 1, 'its double-tap partner (80 ms later) is coalesced: b still runs');
ok(W.skipStage(now + 500) === true && s1 === 2, 'the next tap (500 ms later) skips b');
ok(W.skipStage(now + 1000) === true && s1 === 2, 'a tap between stages is consumed');
W.presenting(false); ok(W.skipStage(now + 2000) === false, 'no presentation: the tap is not taken');
W.noteTap(now + 3000); W.presenting(true); W.beginStage('a', () => s1++);
ok(W.skipStage(now + 3080) === true && s1 === 2, 'a slam-stop tap\'s partner does not skip the first win stage');
W.presenting(false);

for (const hz of [60, 120, 144]) {
	HZ = hz; now = 1000; q = [];
	console.log(`\n=== big-win count, staged double taps @ ${hz} Hz ===`);
	W._resetStages(); W.presenting(true);
	const X = 222.95, unit = 1, el = { textContent: '', firstChild: null };
	const plan = C.tierPlan(X); const names = [...plan.tiers.map((t) => 'bw:' + t.name), 'bw:final'];
	let ix = 0, tiers = [], landed = false; const txt = [];
	const p = C.countTiers(el, X, unit, { onTier: (i) => { tiers.push([i, el.textContent]); W.endStage(names[ix]); ix++; W.beginStage(names[ix] ?? 'bw:final', () => p.next()); } });
	W.beginStage(names[0], () => p.next());
	p.then(() => { landed = true; });
	// rapid double taps: two taps 80 ms apart, a pair every 420 ms
	let guard = 0; const shownAtTier = [];
	while (!landed && guard++ < 200) { W.skipStage(now); run(80); W.skipStage(now); run(340); txt.push(el.textContent); await null; }
	await Promise.resolve(); await Promise.resolve();
	const ev = W._stageLog(), skipped = ev.filter((e) => e[0] === 'skip').map((e) => e[1]), started = ev.filter((e) => e[0] === 'start').map((e) => e[1]);
	ok(landed, `count landed (${guard} double taps)`);
	ok(JSON.stringify(started) === JSON.stringify(names), `every stage started in order: ${started.join(' > ')}`);
	ok(skipped.length === names.length && skipped.every((s, i) => s === names[i]), `each double tap skipped exactly one stage (${skipped.length} skips for ${names.length} stages)`);
	ok(tiers.map((t) => t[0]).join() === plan.tiers.map((t) => t.i).join(), 'tier titles fired in order, once each');
	ok(el.textContent === '$222.95', `lands exactly on the win (${el.textContent})`);
	W.presenting(false);

	// unskipped: checkpoints land exact, whole part never passes a threshold early, decimals churn in the crawl
	now = 1000; q = []; const el2 = { textContent: '', firstChild: null }; const hits = []; let done2 = false;
	const seen = []; C.countTiers(el2, X, unit, { onTier: (i) => hits.push(el2.textContent) }).then(() => { done2 = true; });
	const crawl = plan.keys.find((k) => k.kind === 'crawl'); const cents = new Set();
	while (!done2 && now < 30000) { tick(); seen.push([now - 1000, el2.textContent]); await null; }
	await Promise.resolve();
	for (const [t, s] of seen) if (t > crawl.t0 + 50 && t < crawl.t1 - 50) cents.add(s.slice(-2));
	ok(hits.length === plan.tiers.length, `${hits.length} tier hits`);
	const firstAt = (v) => seen.find(([, s]) => parseFloat(s.slice(1).replace(/,/g, '')) >= v);
	ok(plan.tiers.every((t) => { const f = firstAt(t.x); return f && Math.abs(f[0] - plan.keys.find((k) => k.tier === t.i).t1) <= 1000 / hz + 1; }), 'no tier threshold shown before its crawl lands');
	ok(cents.size >= Math.min(20, Math.floor((crawl.t1 - crawl.t0 - 100) / (1000 / hz)) * 0.6), `decimals churn during the BIG WIN crawl (${cents.size} distinct cent values while the whole part crawls)`);
	ok(el2.textContent === '$222.95', 'unskipped count lands exactly');
	const total = Math.round(now - 1000); ok(Math.abs(total - plan.total) <= 2 * 1000 / hz + 1, `length ${total} ms = plan ${Math.round(plan.total)} ms (frame-rate independent)`);
}

console.log('\n=== churn never shows more than the stage end ===');
let bad = 0; for (let t = 0; t < 2000; t += 7) { const v = C.churnValue(12.1, 2, t, 12.3); if (v > 12.3 || Math.floor(v) !== 12) bad++; }
ok(bad === 0, 'churnValue stays in [12.00, 12.30) for cap 12.30');

console.log(fail ? `\nwin stage tests: ${fail} FAILED` : '\nwin stage tests: all passed');
process.exit(fail ? 1 : 0);
