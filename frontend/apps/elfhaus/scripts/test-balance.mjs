// v20: the strip balance is credited at the end of the round (finishRound), never at the next press.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { transformWithEsbuild } from 'vite';
const app = resolve(import.meta.dirname, '..');
const load = async (f) => import('data:text/javascript;base64,' + Buffer.from((await transformWithEsbuild(readFileSync(join(app, f), 'utf8'), f, { loader: 'ts', format: 'esm' })).code).toString('base64'));
const { creditedBalance } = await load('src/game/balance.ts');
let fail = 0;
const ok = (c, m) => { if (c) console.log('  PASS: ' + m); else { console.error('  FAIL: ' + m); fail++; } };
const near = (a, b) => Math.abs(a - b) < 1e-6;
// James's Stake round: $982.07 before, $7.50 EGW spin -> play balance $974.57, win $5.368
ok(near(creditedBalance(974.57, 5.368, 979.938), 979.938), 'end-round balance with the win is the server truth');
ok(near(creditedBalance(974.57, 5.368, 974.57), 979.938), 'end-round balance without the win yet: play balance + payout shown at round end');
ok(near(creditedBalance(974.57, 5.368, NaN), 979.938), 'no end-round balance: play balance + payout');
ok(near(creditedBalance(974.57, 0, 974.57), 974.57), 'no win: unchanged');
ok(near(creditedBalance(974.57, 5.368, 990), 990), 'a higher server balance always wins');
// next press only takes the bet
ok(near(creditedBalance(974.57, 5.368, 974.57) - 7.5, 972.438), 'next press: $979.94 -> $972.44, no up-then-down');
const game = readFileSync(join(app, 'src/game/game.ts'), 'utf8'), mock = readFileSync(join(app, 'src/mock/mockRgs.ts'), 'utf8');
ok(/await playBookEvents\(evs\);[\s\S]{0,200}?await finishRound\(rd\);/.test(game), 'finishRound (the credit) runs right after the presentation');
ok(/S\.balance = creditedBalance\(playBal, payout, endBal\)/.test(game), 'finishRound credits through creditedBalance');
ok(/mockBalance -= Math\.round\(amount \* mockModeCost/.test(mock) && /mockBalance \+= mockPending/.test(mock), 'mock RGS: play takes the cost, end-round credits the win (as the RGS does)');
if (fail) { console.error(`test-balance: ${fail} failure(s)`); process.exit(1); }
console.log('test-balance: all passed');
