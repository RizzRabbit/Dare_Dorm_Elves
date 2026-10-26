// v3.11 unit check for src/game/egwParts.ts: an Elves Gone Wild stack's four landing badges add up EXACTLY to the stack
// value (no forced minimum of 1 per badge; under 4 the extra rows are 0 = no badge). Run: node scripts/test-egw.mjs
import { readFileSync } from 'node:fs';
import { transformWithEsbuild } from 'vite';
const src = readFileSync(new URL('../src/game/egwParts.ts', import.meta.url), 'utf8');
const { code } = await transformWithEsbuild(src, 'egwParts.ts', { loader: 'ts', format: 'esm' });
const { egwParts } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
let fail = 0;
const ok = (c, m) => { if (c) console.log('  OK ' + m); else { fail++; console.error('  FAIL ' + m); } };
console.log('\n=== EGW badge split ===');
let allSum = true, allLen = true, allEven = true;
for (let v = 0; v <= 200; v++) {
	const p = egwParts(v);
	if (p.reduce((a, b) => a + b, 0) !== v) allSum = false;
	if (p.length !== 4) allLen = false;
	if (Math.max(...p) - Math.min(...p) > 1) allEven = false;
}
ok(allSum, 'badges sum exactly to the value for 0..200');
ok(allLen, 'always 4 parts (one per row)');
ok(allEven, 'even split (parts differ by at most 1)');
ok(egwParts(1).join() === '1,0,0,0', `1 -> ${egwParts(1)}`);
ok(egwParts(2).join() === '1,1,0,0', `2 -> ${egwParts(2)}`);
ok(egwParts(3).join() === '1,1,1,0', `3 -> ${egwParts(3)}`);
ok(egwParts(4).join() === '1,1,1,1', `4 -> ${egwParts(4)}`);
ok(egwParts(10).join() === '3,3,2,2', `10 -> ${egwParts(10)}`);
// a 0 part draws no badge (ui.ts symHTML), so the visible badges sum to the value too
const ui = readFileSync(new URL('../src/game/ui.ts', import.meta.url), 'utf8');
ok(/v === 0 \? '' : gemHTML\(/.test(ui), 'ui.ts symHTML hides the badge for a 0 part');
const bh = readFileSync(new URL('../src/game/bookEventHandlerMap.ts', import.meta.url), 'utf8');
ok(/from '\.\/egwParts'/.test(bh) && !/Math\.max\(1, x\)/.test(bh), 'bookEventHandlerMap uses egwParts (no Math.max(1, x))');
console.log(fail ? `\negw tests: ${fail} FAILED` : '\negw tests: all passed');
process.exit(fail ? 1 : 0);
