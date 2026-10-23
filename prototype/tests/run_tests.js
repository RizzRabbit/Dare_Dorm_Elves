// Node test: JS engine vs SPEC §12 totals vs design/prototypes/reference_rules.py output. Run: node tests/run_tests.js
const E = require('../engine.js');
const { execSync } = require('child_process');
const path = require('path');
let fails = 0; const log = (ok, msg) => { if (!ok) fails++; console.log((ok ? 'MATCH    ' : 'MISMATCH ') + msg); };
let py = {}, pyBonus = null;
try {
  const out = execSync('python3 worked_examples.py', { cwd: path.join(__dirname, '../../design/prototypes') }).toString();
  const m = out.match(/SUMMARY \(x bet\): (\{.*\})/); py = JSON.parse(m[1].replace(/'/g, '"'));
  pyBonus = JSON.parse(out.match(/BONUS: (\{.*\})/)[1]);
} catch (e) { console.log('WARN could not run reference_rules.py:', e.message); }
console.log('id    SPEC      python    JS');
for (const id of Object.keys(E.EX)) {
  const ex = E.EX[id], js = E.runExample(id).rawX, p = py[id];
  log(Math.abs(js - ex.expected) < 1e-9 && (p === undefined || Math.abs(js - p) < 1e-9), `${id.padEnd(5)} ${String(ex.expected).padEnd(9)} ${String(p).padEnd(9)} ${js}`);
  const bk = E.exampleBook(id);
  if (ex.tier) { const t = bk.events.find(e => e.type === 'freeSpinTrigger'); log(t && t.tier === ex.tier, `${id} trigger tier ${ex.tier} -> ${t && t.tier}`); }
  if (ex.expectedRound) log(bk.payoutMultiplier === ex.expectedRound * 100 && bk.events.some(e => e.type === 'wincap'), `${id} round capped at ${bk.payoutMultiplier / 100}x with wincap event`);
}
// E11 spin counts + Dare->Double Dare upgrade (SPEC §6 LOCKED), JS vs python bonus_after_spin
const seq = (tier, budget, arr) => arr.map(n => { const st = E.bonusAfterSpin(tier, budget, n); tier = st.tier; budget = st.budget; return [tier, budget, !!st.upgrade, st.retrig.added]; });
const jsE11 = { dare_fs3_1_fs6_2: seq('dare', 8, [0,0,1,0,0,2]), dare_2_in_one: seq('dare', 8, [2]), double_1: seq('double_dare', 10, [1]),
  hidden_2_then_1: seq('hidden', 14, [2,1]), dare_no_stack_clears: (st => st.full.size === 0 && st.sv.size === 0)(E.bonusAfterSpin('dare', 8, 0, new Map(), new Map([['1,0', 3]]))) };
log(pyBonus && JSON.stringify(jsE11) === JSON.stringify(pyBonus.E11), `E11   spin counts/upgrade JS==python ${JSON.stringify(jsE11.dare_fs3_1_fs6_2.map(x => x[0][0] + x[1]))} 2-in-1 ${JSON.stringify(jsE11.dare_2_in_one)} hidden ${JSON.stringify(jsE11.hidden_2_then_1)}`);
{ const r = E.runExample('E13'); const st = E.bonusAfterSpin('dare', 8, r.full.size, r.full, r.sv);
  const js = { tier: st.tier, budget: st.budget, locked_full: Object.fromEntries([...st.full].map(([k, v]) => [String(k), v])),
    locked_singles: Object.fromEntries([...st.sv].map(([k, v]) => [`${Math.floor(k / E.ROWS)},${k % E.ROWS}`, v])), upgrade: st.upgrade };
  log(pyBonus && JSON.stringify(js) === JSON.stringify(pyBonus.E13), `E13   Dare stack -> ${js.tier} ${js.budget} FS, locked ${JSON.stringify(js.locked_full)} ${JSON.stringify(js.locked_singles)} (python ${pyBonus && pyBonus.E13.tier})`);
  const bk = E.exampleBook('E13'), u = bk.events.find(e => e.type === 'bonusUpgrade');
  log(u && u.from === 'dare' && u.to === 'double_dare' && u.spinsAdded === 2 && u.totalFs === 10, `E13 book emits bonusUpgrade ${u && JSON.stringify({from: u.from, to: u.to, spinsAdded: u.spinsAdded, totalFs: u.totalFs})}`); }
// E3 end state: R3 locked x13, singles x5 and x3
{ const r = E.runExample('E3'); log(r.full.get(2) === 13 && [...r.sv.values()].sort().join() === '3,5', `E3 end state R3 x${r.full.get(2)}, singles ${[...r.sv.values()]}`); }
{ const r = E.runExample('E8'); log(r.full.get(2) === 11 && [...r.sv.values()].join() === '4', `E8 end state R3 x${r.full.get(2)}, single x${[...r.sv.values()]}`); }
// Event-schema invariants on random books
const TYPES = new Set(['reveal','stackComplete','mergeGroups','winInfo','updateStepWin','wildGrow','respinStart','respinReveal','respinEnd','setWin','setTotalWin','freeSpinTrigger','updateFreeSpin','freeSpinRetrigger','freeSpinEnd','mysteryStart','mysteryResult','egwStart','buyTriggerStart','wincap','finalWin','bonusUpgrade']);
E.seed(42); let bad = 0, n = 0, upgrades = 0;
for (const mode of Object.keys(E.MODES)) for (let i = 0; i < (mode === 'base' || mode === 'ante' ? 400 : 40); i++) {
  const bk = E.book(mode); n++;
  const evs = bk.events, last = evs[evs.length - 1];
  const tot = evs.filter(e => e.type === 'setTotalWin').pop();
  const ok = evs.every((e, j) => e.index === j && TYPES.has(e.type)) && last.type === 'finalWin' && last.amount === bk.payoutMultiplier
    && (!tot || tot.amount === last.amount || evs.some(e => e.type === 'wincap')) && bk.payoutMultiplier <= 5000000
    && evs.filter(e => e.type === 'respinStart').every(e => e.step >= 1 && e.step <= 3)
    && (mode !== 'egw' || !evs.some(e => e.type === 'freeSpinTrigger'))
    && (mode !== 'mystery' || evs.some(e => e.type === 'mysteryResult'))
    && evs.filter(e => e.type === 'updateFreeSpin').every(e => e.amount <= 18 && e.total <= 18)
    && (ups => ups.length <= 1 && ups.every(u => u.from === 'dare' && u.to === 'double_dare' && evs.find(e => e.type === 'freeSpinTrigger').tier === 'dare'))(evs.filter(e => e.type === 'bonusUpgrade'));
  for (const e of evs) if (e.type === 'bonusUpgrade') upgrades++;
  if (!ok) { bad++; if (bad < 3) console.log('bad book', mode, JSON.stringify(evs.slice(-4))); }
}
log(bad === 0, `event schema invariants on ${n} random books (${bad} bad; ${upgrades} Dare->Double upgrades seen)`);
console.log('\nAUTOPLAY SANITY (toy v2 weights: reel 2 < 3 < 1 < 4-5; toy prices; NOT tuning):');
E.seed(2026);
for (const [m, k] of [['base', 50000], ['ante', 50000], ['dare', 500], ['double_dare', 500], ['triple_dare', 500], ['mystery', 500], ['egw', 2000]]) {
  const a = E.autoplay(m, k);
  console.log(`${m.padEnd(12)} n=${k} cost=${a.cost}x hit=${(a.hitRate * 100).toFixed(1)}% RTP=${(a.rtp * 100).toFixed(1)}% mean=${a.meanX.toFixed(1)}x max=${a.maxX}x P(>=5000x)=${(a.p5k * 100).toFixed(2)}% trig=${JSON.stringify(a.triggers)}`);
}
console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL TESTS PASS'); process.exit(fails ? 1 : 0);
