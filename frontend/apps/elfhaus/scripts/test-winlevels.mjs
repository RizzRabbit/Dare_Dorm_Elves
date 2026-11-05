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
// EGW (Wild Winter Spins, James 2026-11-05 on Stake): one setWin per round = the round total after the feature respins
// (updateStepWin per respin never opens a banner). Banner = egw edges AND at least the buy price (cost, x of base).
const COST = JSON.parse(readFileSync(join(app, 'math-snapshot/index.json'), 'utf8')).modes.find((m) => m.name === 'egw').cost;
const eg = WL.byMode.egw, egB = (x) => name(bannerLevel(Math.round(x * 100), eg, FIRST, MAX, COST));
console.log(`egw (cost ${COST}x)  ` + [7, 8, 50, 150, 300, 500, 749, 750, 1000, 5000].map((x) => `${x}x:${egB(x)}`).join('  '));
for (const [x, want] of [[7, '(no banner)'], [8, '(no banner)'], [300, '(no banner)'], [500, '(no banner)'], [750, 'SUPER WIN'], [1000, 'EPIC WIN']]) if (egB(x) !== want) { console.error(`FAIL egw ${x}x -> ${egB(x)} (want ${want})`); fail++; }
const { normMode, winEdges } = { normMode: (m) => { const a = { wild_winter: 'egw', wildwinter: 'egw', wild_winter_spins: 'egw' }; const k = String(m ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_'); return a[k] || k; } };
for (const m of ['egw', 'EGW', ' Egw ', 'WILD_WINTER', 'wild winter spins']) if ((WL.byMode[normMode(m)] ?? WL.standard) !== eg) { console.error(`FAIL mode '${m}' falls back to standard`); fail++; }
// real books (local only): ELFHAUS_BOOKS=<publish_files> scans books_egw for any banner below the buy price
if (process.env.ELFHAUS_BOOKS) {
	const { createReadStream } = await import('node:fs'); const { createZstdDecompress } = await import('node:zlib'); const { createInterface } = await import('node:readline');
	const rl = createInterface({ input: createReadStream(join(process.env.ELFHAUS_BOOKS, 'books_egw.jsonl.zst')).pipe(createZstdDecompress()) });
	let n = 0, ban = 0, bad = 0;
	for await (const line of rl) { const d = JSON.parse(line); n++; for (const e of d.events) { if (e.type !== 'setWin') continue; const lv = bannerLevel(e.amount, eg, FIRST, MAX, COST); if (lv) ban++; if (lv && e.amount / 100 < COST) bad++; } if (n >= 50000) break; }
	console.log(`egw books: ${n} rounds, ${ban} banners, ${bad} below the buy price`); if (bad) fail++;
}
if (bannerLevel(700, WL.standard, FIRST, MAX) !== 0) { console.error('FAIL base 7x shows a banner'); fail++; }
console.log(fail ? `${fail} FAIL` : 'PASS: no banner under the mode BIG edge; 7x = no banner');
process.exit(fail ? 1 : 0);
