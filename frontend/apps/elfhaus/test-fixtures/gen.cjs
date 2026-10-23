// Fixture-book generator (TEST ONLY, not shipped). Uses the prototype engine (prototype/engine.js), which emits
// design/EVENTS.md events, and searches seeds for one book per feature state. Replace with math/samples/ books
// (EVENTS.md "Sample books") when the math team delivers them.
const fs = require('fs'), path = require('path');
const E = require('../../../../prototype/engine.js');
const out = path.join(__dirname, 'books');
const has = (b, t) => b.events.some(e => e.type === t);
const find = (name, mode, pred, max = 400000) => {
  for (let s = 1; s < max; s++) { E.seed(s * 7919 + name.length); const b = E.book(mode); if (pred(b)) { b.mode = mode; b.seed = s; return save(name, b); } }
  console.log('NOT FOUND', name);
};
const save = (name, b) => { b.events.forEach((e, i) => (e.index = i)); fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify({ id: name, mode: b.mode, payoutMultiplier: b.payoutMultiplier, events: b.events }, null, 1)); console.log(name, b.mode, b.payoutMultiplier, b.events.length); return true; };
const myst = b => (b.events.find(e => e.type === 'mysteryResult') || {}).outcome;
const egwReels = b => (b.events.find(e => e.type === 'egwStart') || {}).reels || [];
const adj = r => r.some((x, i) => i && x === r[i - 1] + 1);
find('base_zero', 'base', b => b.payoutMultiplier === 0);
find('base_win', 'base', b => b.payoutMultiplier > 0 && !has(b, 'respinStart') && !b.tier);
find('base_respin', 'base', b => b.events.filter(e => e.type === 'respinStart').length >= 2 && !b.tier);
find('ante_win', 'ante', b => b.payoutMultiplier > 0 && !b.tier);
find('ante_trigger', 'ante', b => !!b.tier);
find('dare_buy', 'dare', b => has(b, 'bonusUpgrade'), 20000);
find('double_buy', 'double_dare', b => has(b, 'freeSpinRetrigger') && b.events.some(e => e.type === 'mergeGroups' && e.groups.length), 4000) || find('double_buy', 'double_dare', b => true, 2);
find('triple_buy', 'triple_dare', b => b.payoutMultiplier > 0, 50);
find('mystery_none', 'mystery', b => myst(b) === 'none');
find('mystery_double', 'mystery', b => myst(b) === 'double_dare');
find('mystery_triple', 'mystery', b => myst(b) === 'triple_dare');
find('mystery_hidden', 'mystery', b => myst(b) === 'hidden');
find('egw_nonadjacent', 'egw', b => !adj(egwReels(b)));
find('egw_adjacent', 'egw', b => adj(egwReels(b)) && b.payoutMultiplier > 0);
// Wincap (EVENTS.md "Wincap anywhere"): all-wild board, 5 instant stacks merge 4^5 -> capped at 50,000x in step 0.
for (const mode of ['base', 'egw']) {
  const ev = []; const emit = e => ev.push(e);
  if (mode === 'egw') emit({ type: 'egwStart', reels: [0, 1, 2, 3, 4], value: 4 });
  const W = { name: 'W', wild: true, multiplier: 1 };
  emit({ type: 'reveal', board: [0, 1, 2, 3, 4].map(() => [{ name: 'L3' }, W, W, W, W, { name: 'H2' }]), paddingPositions: [3, 9, 14, 2, 21], gameType: 'basegame', anticipation: [0, 0, 0, 0, 0],
    locked: { fullReels: mode === 'egw' ? [0, 1, 2, 3, 4].map(r => ({ reel: r, value: 4 })) : [], singles: [] } });
  const tmp = []; E.play('W W W W W\nW W W W W\nW W W W W\nW W W W W', { emit: e => tmp.push(e), priorX: 0 });
  for (const e of tmp) { if (mode === 'egw' && e.type === 'stackComplete') continue; emit(e); if (e.type === 'respinEnd') break; }
  if (!ev.some(e => e.type === 'respinEnd')) emit({ type: 'respinEnd', step: 0, reason: 'wincap' });
  emit({ type: 'wincap', amount: 5000000 }); emit({ type: 'setTotalWin', amount: 5000000 }); emit({ type: 'finalWin', amount: 5000000 });
  save(mode + '_wincap', { mode, payoutMultiplier: 5000000, events: ev });
}
