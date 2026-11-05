// Win tier table check (James 2026-11-05: "showing mega win at 7x"). Book amounts are x100 of the BASE bet; the banner
// level = the round's mode edges applied to amount / 100 (bannerLevel.ts, the same function setWin uses). Prints x -> label
// for base and a buy mode and asserts nothing under the mode's BIG edge gets a banner.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { transformWithEsbuild } from 'vite';
const app = resolve(import.meta.dirname, '..');
const load = async (f) => { const { code } = await transformWithEsbuild(readFileSync(join(app, 'src/game', f), 'utf8'), f, { loader: 'ts', format: 'esm' }); return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64')); };
const { bannerLevel } = await load('bannerLevel.ts');
const WL = JSON.parse(readFileSync(join(app, 'math-snapshot/game_config.json'), 'utf8')).winLevels, MAX = 50000, FIRST = 6;
const name = (lv) => ({ 6: 'BIG WIN', 7: 'MEGA WIN', 8: 'SUPER WIN', 9: 'EPIC WIN', 10: 'LEGENDARY WIN' })[lv] || '(no banner)';
const XS = [5, 7, 10, 15, 25, 30, 50, 100, 150, 300, 500, 1000];
let fail = 0;
for (const m of ['base', 'ante', 'dare', 'double_dare', 'egw']) {
	const e = WL.byMode?.[m] ?? WL.standard;
	console.log(`${m.padEnd(12)} ` + XS.map((x) => `${x}x:${name(bannerLevel(Math.round(x * 100), e, FIRST, MAX))}`).join('  '));
	for (const x of XS) { const lv = bannerLevel(Math.round(x * 100), e, FIRST, MAX); if (x < e[4] && lv) { console.error(`FAIL ${m} ${x}x -> ${name(lv)}`); fail++; } }
}
if (bannerLevel(700, WL.standard, FIRST, MAX) !== 0) { console.error('FAIL base 7x shows a banner'); fail++; }
console.log(fail ? `${fail} FAIL` : 'PASS: no banner under the mode BIG edge; 7x = no banner');
process.exit(fail ? 1 : 0);
