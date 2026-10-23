// Node test: JS engine vs SPEC §12 totals vs design/prototypes/reference_rules.py output. Run: node tests/run_tests.js
const E = require('../engine.js');
const { execSync } = require('child_process');
const path = require('path');
let fails = 0; const log = (ok, msg) => { if (!ok) fails++; console.log((ok ? 'MATCH    ' : 'MISMATCH ') + msg); };
let py = {};
try {
  const out = execSync('python3 worked_examples.py', { cwd: path.join(__dirname, '../../design/prototypes') }).toString();
  const m = out.match(/SUMMARY \(x bet\): (\{.*\})/); py = JSON.parse(m[1].replace(/'/g, '"'));
} catch (e) { console.log('WARN could not run reference_rules.py:', e.message); }
console.log('id    SPEC      python    JS');
for (const id of Object.keys(E.EX)) {
  const ex = E.EX[id], js = E.runExample(id).rawX, p = py[id];
  log(Math.abs(js - ex.expected) < 1e-9 && (p === undefined || Math.abs(js - p) < 1e-9), `${id.padEnd(5)} ${String(ex.expected).padEnd(9)} ${String(p).padEnd(9)} ${js}`);
  const bk = E.exampleBook(id);
  if (ex.tier) { const t = bk.events.find(e => e.type === 'freeSpinTrigger'); log(t && t.tier === ex.tier, `${id} trigger tier ${ex.tier} -> ${t && t.tier}`); }
  if (ex.expectedRound) log(bk.payoutMultiplier === ex.expectedRound * 100 && bk.events.some(e => e.type === 'wincap'), `${id} round capped at ${bk.payoutMultiplier / 100}x with wincap event`);
}
// E11 spin counts
let s = E.addSpins(8, 1), s2 = E.addSpins(s, 2), h = E.addSpins(14, 2), h3 = E.addSpins(h, 1);
log(s === 10 && s2 === 14 && h === 18 && h3 === 18, `E11   Dare 8->${s}->${s2}; Hidden 14->${h}->${h3} (cap 18)`);
// E3 end state: R3 locked x13, singles x5 and x3
{ const r = E.runExample('E3'); log(r.full.get(2) === 13 && [...r.sv.values()].sort().join() === '3,5', `E3 end state R3 x${r.full.get(2)}, singles ${[...r.sv.values()]}`); }
{ const r = E.runExample('E8'); log(r.full.get(2) === 11 && [...r.sv.values()].join() === '4', `E8 end state R3 x${r.full.get(2)}, single x${[...r.sv.values()]}`); }
// Event-schema invariants on random books
const TYPES = new Set(['reveal','stackComplete','mergeGroups','winInfo','updateStepWin','wildGrow','respinStart','respinReveal','respinEnd','setWin','setTotalWin','freeSpinTrigger','updateFreeSpin','freeSpinRetrigger','freeSpinEnd','mysteryStart','mysteryResult','egwStart','buyTriggerStart','wincap','finalWin']);
E.seed(42); let bad = 0, n = 0;
for (const mode of Object.keys(E.MODES)) for (let i = 0; i < (mode === 'base' || mode === 'ante' ? 400 : 40); i++) {
  const bk = E.book(mode); n++;
  const evs = bk.events, last = evs[evs.length - 1];
  const tot = evs.filter(e => e.type === 'setTotalWin').pop();
  const ok = evs.every((e, j) => e.index === j && TYPES.has(e.type)) && last.type === 'finalWin' && last.amount === bk.payoutMultiplier
    && (!tot || tot.amount === last.amount || evs.some(e => e.type === 'wincap')) && bk.payoutMultiplier <= 5000000
    && evs.filter(e => e.type === 'respinStart').every(e => e.step >= 1 && e.step <= 3)
    && (mode !== 'egw' || !evs.some(e => e.type === 'freeSpinTrigger'))
    && (mode !== 'mystery' || evs.some(e => e.type === 'mysteryResult'))
    && evs.filter(e => e.type === 'updateFreeSpin').every(e => e.amount <= 18 && e.total <= 18);
  if (!ok) { bad++; if (bad < 3) console.log('bad book', mode, JSON.stringify(evs.slice(-4))); }
}
log(bad === 0, `event schema invariants on ${n} random books (${bad} bad)`);
console.log('\nAUTOPLAY SANITY (toy strips from toy_sim4.py P0, toy prices; NOT tuning):');
E.seed(2026);
for (const [m, k] of [['base', 50000], ['ante', 50000], ['dare', 500], ['double_dare', 500], ['triple_dare', 500], ['mystery', 500], ['egw', 2000]]) {
  const a = E.autoplay(m, k);
  console.log(`${m.padEnd(12)} n=${k} cost=${a.cost}x hit=${(a.hitRate * 100).toFixed(1)}% RTP=${(a.rtp * 100).toFixed(1)}% mean=${a.meanX.toFixed(1)}x max=${a.maxX}x P(>=5000x)=${(a.p5k * 100).toFixed(2)}% trig=${JSON.stringify(a.triggers)}`);
}
console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL TESTS PASS'); process.exit(fails ? 1 : 0);
