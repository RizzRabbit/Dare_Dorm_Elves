// Unit tests for src/game/format.ts (money decimals rules). Run by `pnpm test`.
// v3.16i (James): money() = balance / bet / prices / inputs at standard decimals; moneyWin() = win amounts, exact.
import { readFileSync } from 'node:fs';
import { transformWithEsbuild } from 'vite';
const src = readFileSync(new URL('../src/game/format.ts', import.meta.url), 'utf8');
const { code } = await transformWithEsbuild(src, 'format.ts', { loader: 'ts', format: 'esm' });
const F = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const cases = [ // moneyWin(): exact win amounts
	['USD', 0, '$0.00'], ['USD', 0.01, '$0.01'], ['USD', 0.0025, '$0.0025'], ['USD', 0.025, '$0.025'], ['USD', 0.0250, '$0.025'],
	['USD', 1.5, '$1.50'], ['USD', 1234.5678, '$1,234.5678'], ['USD', 1234567.891, '$1,234,567.891'], ['USD', 25000000, '$25,000,000.00'],
	['USD', 0.1 + 0.2, '$0.30'], ['USD', 0.30000000004, '$0.30'], ['USD', 12.3456, '$12.3456'], ['USD', 0.2, '$0.20'], ['USD', -1.5, '-$1.50'],
	['JPY', 1234.5, '¥1,234.5'], ['JPY', 0.5, '¥0.5'], ['EUR', 1.5, '€1.50'], ['XGC', 1234.5, '1,234.50\u00a0GC'], ['XSC', 0.0025, '0.0025\u00a0SC'], ['XGC', 1234567.891, '1,234,567.891\u00a0GC'], ['XEC', 22.8, '22.80\u00a0SC'], ['CHF', 1.5, 'CHF\u00a01.50'], ['ZZZ', 1.5, 'ZZZ\u00a01.50'],
];
let fail = 0;
console.log('\n=== Money formatter ===');
for (const [cur, v, want] of cases) {
	F.setCurrency(cur); const got = F.moneyWin(v);
	if (got !== want) { fail++; console.error(`  FAIL ${cur} ${v}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); } else console.log(`  OK ${cur} ${v} -> ${got}`);
}
F.setCurrency('USD');
if (F.moneyWin(0.1234, 2) !== '$0.12') { fail++; console.error('  FAIL fixed digits'); }
// v3.16i: inputs back to standard decimals
for (const [v, w] of [[1.5, '1.50'], [0.0025, '0.00'], [10, '10.00'], [1001.212, '1001.21'], [0.1 + 0.2, '0.30']]) if (F.amountStr(v) !== w) { fail++; console.error(`  FAIL amountStr ${v} -> ${F.amountStr(v)}`); }
F.setCurrency('JPY'); if (F.amountStr(1234.5) !== '1235') { fail++; console.error(`  FAIL amountStr JPY 1234.5 -> ${F.amountStr(1234.5)}`); } F.setCurrency('USD');
// v3.16b (#188): social currencies are detected from the currency alone
for (const [c, w] of [['XSC', true], ['XGC', true], ['xsc', true], ['XEC', true], ['USD', false], ['', false]]) { F.setCurrency(c); if (F.isSocialCurrency() !== w) { fail++; console.error(`  FAIL isSocialCurrency ${c}`); } else console.log(`  OK isSocialCurrency ${c || '(none)'} = ${w}`); }
// v3.16f: amount and currency code / symbol are joined by a no-break space, never a plain space
{ const f0 = fail; for (const c of ['XGC', 'XSC', 'XEC', 'USD', 'EUR', 'CHF', 'ZZZ']) { F.setCurrency(c); for (const v of [0, 22.8, 1234567.89]) { for (const m of [F.money(v), F.moneyWin(v)]) if (/ /.test(m)) { fail++; console.error(`  FAIL plain space in ${c} ${JSON.stringify(m)}`); } } }
if (fail === f0) console.log('  OK no plain space between amount and currency (7 currencies x 3 amounts, both formatters)'); }
// v3.16g (#273): sub-unit wins keep their exact places (the resume card, the HUD win and the RGS credit agree)
{ const f0 = fail; for (const [c, v, w] of [['USD', 0.975, '$0.975'], ['USD', 0.5625, '$0.5625'], ['USD', 0.1 * 0.05, '$0.005'], ['USD', 0.001, '$0.001'], ['USD', 0.125, '$0.125'], ['USD', 1.005, '$1.005'], ['USD', 0.1 + 0.2, '$0.30'], ['USD', 1234.5678, '$1,234.5678'], ['JPY', 0.075, '¥0.075'], ['XGC', 0.975, '0.975\u00a0GC'], ['XSC', 0.5625, '0.5625\u00a0SC']]) {
	F.setCurrency(c); const g = F.moneyWin(v); if (g !== w) { fail++; console.error(`  FAIL exact sub-unit ${c} ${v}: got ${JSON.stringify(g)} want ${JSON.stringify(w)}`); } }
if (fail === f0) console.log('  OK exact sub-unit amounts ($0.975, $0.5625, $0.005, $0.001, ¥0.075, 0.975 GC)'); }
// v3.16h (#273): the exact value at every magnitude: currency minimum, extra places only when nonzero, up to 6; float-safe
{ const f0 = fail; for (const [c, v, w] of [['USD', 1.2 * 1.01, '$1.212'], ['USD', 0.1 * 22.25, '$2.225'], ['USD', 1234.5675, '$1,234.5675'], ['USD', 50400, '$50,400.00'], ['USD', 50400.0000001, '$50,400.00'],
	['USD', 0.1 + 0.2, '$0.30'], ['USD', 1001.212, '$1,001.212'], ['USD', 1234567.891234, '$1,234,567.891234'], ['USD', 1.23456789, '$1.234568'], ['XGC', 1234567.891234, '1,234,567.891234\u00a0GC'], ['XGC', 2.225, '2.225\u00a0GC'], ['XSC', 1.212, '1.212\u00a0SC'], ['XSC', 50400, '50,400.00\u00a0SC'],
	['JPY', 1.212, '¥1.212'], ['JPY', 50400, '¥50,400'], ['JPY', 2.5, '¥2.5']]) {
	F.setCurrency(c); const g = F.moneyWin(v); if (g !== w) { fail++; console.error(`  FAIL exact ${c} ${v}: got ${JSON.stringify(g)} want ${JSON.stringify(w)}`); } }
if (fail === f0) console.log('  OK exact at every magnitude ($1.212, $2.225, $1,234.5675, $50,400.00, 1,234,567.891234 GC, 1.212 SC, ¥1.212, ¥50,400; 0.1+0.2 -> $0.30)'); }
// v3.16i (James): balance and bet / PLAY always at the currency's standard decimals, normal rounding, float-safe
{ const f0 = fail; for (const [c, v, w] of [['USD', 0, '$0.00'], ['USD', 1001.212, '$1,001.21'], ['USD', 1002.225, '$1,002.23'], ['USD', 1234567.891234, '$1,234,567.89'], ['USD', 1.005, '$1.01'], ['USD', 0.1 + 0.2, '$0.30'], ['USD', 0.0025, '$0.00'], ['USD', 50400, '$50,400.00'], ['USD', 1.2, '$1.20'], ['USD', -1.5, '-$1.50'],
	['JPY', 1234.5, '¥1,235'], ['JPY', 50400, '¥50,400'], ['EUR', 1.5, '€1.50'], ['XGC', 1234567.891234, '1,234,567.89\u00a0GC'], ['XGC', 1001.212, '1,001.21\u00a0GC'], ['XSC', 10000, '10,000.00\u00a0SC'], ['XEC', 22.8, '22.80\u00a0SC'], ['CHF', 1.5, 'CHF\u00a01.50'], ['ZZZ', 1.5, 'ZZZ\u00a01.50']]) {
	F.setCurrency(c); const g = F.money(v); if (g !== w) { fail++; console.error(`  FAIL standard ${c} ${v}: got ${JSON.stringify(g)} want ${JSON.stringify(w)}`); } }
if (fail === f0) console.log('  OK standard decimals for balance / bet ($1,001.21 not $1,001.212, $1,234,567.89, ¥1,235, 1,234,567.89 GC, 10,000.00 SC)'); }
// v3.16i: the same win is $1.212 on the card / HUD win (moneyWin) while the balance after it reads $1,001.21 (money)
F.setCurrency('USD'); if (F.moneyWin(1.2 * 1.01) !== '$1.212' || F.money(1000 + 1.2 * 1.01) !== '$1,001.21') { fail++; console.error('  FAIL win exact / balance standard split'); } else console.log('  OK win $1.212 (exact) / balance $1,001.21 (standard)');
F.setCurrency('USD');
console.log(`Formatter: ${fail ? fail + ' failures' : `${cases.length + 15}/${cases.length + 15} passed`}`);
process.exit(fail ? 1 : 0);
