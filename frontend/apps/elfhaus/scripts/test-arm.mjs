// v3.17 persistent arming (LOCKED James rule, overrides re-audit M5): source guard, runs in `pnpm test`.
// A confirmed mode stays armed until the player turns it off or picks another; round() never disarms; the only
// automatic return to base is after a RESUMED round. Behaviour (two consecutive rounds) is checked by e2e-arm.mjs.
import { readFileSync } from 'node:fs';
const g = readFileSync(new URL('../src/game/game.ts', import.meta.url), 'utf8');
let fail = 0; const ok = (c, m) => { if (c) console.log('  OK ' + m); else { fail++; console.error('  FAIL ' + m); } };
console.log('\n=== persistent arming ===');
const round = g.slice(g.indexOf('async function round('), g.indexOf('// ---------- startup'));
ok(round.length > 100, 'found round()');
ok(!/setArm\(|pickArm\(|armed\s*=/.test(round), 'round() never disarms (no setArm / pickArm / armed = after a round)');
ok(/INSUFFICIENT BALANCE[^\n]*return;/.test(round), 'insufficient balance stops the press (no silent base spin)');
const calls = [...g.matchAll(/setArm\(null[^)]*\)/g)].map((m) => g.slice(0, m.index).split('\n').length);
const resume = g.slice(g.indexOf('async function resume('), g.indexOf('/** v3.16c: the unfinished-round card'));
ok(calls.every((ln) => { const at = g.split('\n').slice(0, ln).join('\n').length; return at > g.indexOf('async function resume(') && at < g.indexOf('async function resume(') + resume.length; }), `setArm(null) only inside resume() (lines ${calls.join(', ')})`);
ok(/function betStep[\s\S]{0,200}setArm\(armed, S\.ante\)/.test(g), 'bet change keeps the armed mode');
ok(/modeCost\(m\) > CONFIRM_ABOVE_X\) openConfirm\(m\)/.test(g), 'arming above CONFIRM_ABOVE_X opens the confirm card');
console.log(fail ? `\narm tests: ${fail} FAILED` : '\narm tests: all passed');
process.exit(fail ? 1 : 0);
