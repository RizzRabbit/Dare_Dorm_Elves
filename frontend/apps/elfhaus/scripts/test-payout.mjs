// The round's paid amount: math rounds the payout DOWN to 0.1x at finalWin (= payoutMultiplier) while the running events
// keep 0.05x steps. payoutFlow (src/game/payoutFlow.ts) moves the closing amounts onto the paid amount; the meter settles on
// finalWin. Synthetic books here; set ELFHAUS_BOOKS=<publish_files dir> to also replay real books (local only, never committed).
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { transformWithEsbuild } from 'vite';
const app = resolve(import.meta.dirname, '..');
const src = readFileSync(join(app, 'src/game/payoutFlow.ts'), 'utf8');
const { code } = await transformWithEsbuild(src, 'payoutFlow.ts', { loader: 'ts', format: 'esm' });
const { payoutFlow } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const MAX = JSON.parse(readFileSync(join(app, 'src/game/modes.generated.json'), 'utf8')).math.maxWinX;
let fail = 0;
const ok = (c, m) => { if (c) console.log('  PASS: ' + m); else { console.error('  FAIL: ' + m); fail++; } };

/** Mirrors the handlers: updateStepWin / setTotalWin count up only, a `payout` setTotalWin and finalWin settle exactly. */
function play(events) {
	const ev = payoutFlow(events);
	let meter = 0, base = 0; const banners = [], outros = [];
	for (const e of ev) {
		if (e.type === 'updateStepWin') meter = Math.min(MAX, Math.max(meter, base + e.amount / 100));
		else if (e.type === 'setTotalWin') { const x = Math.min(e.amount / 100, MAX); meter = e.payout ? x : Math.max(meter, x); base = x; }
		else if (e.type === 'setWin') banners.push(e.amount);
		else if (e.type === 'freeSpinEnd') outros.push(e.amount);
		else if (e.type === 'wincap') meter = MAX;
		else if (e.type === 'finalWin') meter = Math.min(e.amount / 100, MAX);
	}
	return { meter, banners, outros, ev };
}
console.log('\n=== payout: the closing amounts land on the rounded finalWin ===');
{
	const r = play([{ type: 'winInfo', totalWin: 1235 }, { type: 'updateStepWin', amount: 1235 }, { type: 'setWin', amount: 1235, winLevel: 4 }, { type: 'setTotalWin', amount: 1235 }, { type: 'finalWin', amount: 1230 }]);
	ok(r.meter === 12.3 && r.banners[0] === 1230, `base 12.35x round -> banner + meter 12.3x (got ${r.banners[0] / 100}x, ${r.meter}x)`);
}
{
	const r = play([{ type: 'setWin', amount: 300 }, { type: 'setTotalWin', amount: 300 }, { type: 'freeSpinTrigger' }, { type: 'setWin', amount: 1295 }, { type: 'setTotalWin', amount: 1595 }, { type: 'setTotalWin', amount: 1595 }, { type: 'freeSpinEnd', amount: 1295 }, { type: 'finalWin', amount: 1590 }]);
	ok(r.meter === 15.9 && r.outros[0] === 1290 && r.banners.join() === '300,1295', `bonus 15.95x -> outro TOTAL WIN 12.9x (free part), base banner untouched, meter 15.9x (got ${r.outros[0]}, ${r.banners}, ${r.meter})`);
	ok(r.ev.filter((e) => e.type === 'setTotalWin').map((e) => e.amount).join() === '300,1590,1590', 'trailing setTotalWin at the exact total -> paid total; earlier running totals unchanged');
}
{
	const r = play([{ type: 'setWin', amount: 1205 }, { type: 'setTotalWin', amount: 1205 }, { type: 'freeSpinTrigger' }, { type: 'setTotalWin', amount: 1205 }, { type: 'freeSpinEnd', amount: 0 }, { type: 'finalWin', amount: 1200 }]);
	ok(r.meter === 12 && r.outros[0] === 0 && r.banners[0] === 1200, `free wins 0 -> rounding off the base spin win (banner ${r.banners[0]}, outro ${r.outros[0]}, meter ${r.meter})`);
}
{
	const e = [{ type: 'setWin', amount: 1230 }, { type: 'setTotalWin', amount: 1230 }, { type: 'finalWin', amount: 1230 }];
	ok(payoutFlow(e) === e, 'already on 0.1x: book passes through untouched');
	const c = [{ type: 'wincap', amount: MAX * 100 }, { type: 'setTotalWin', amount: MAX * 100 }, { type: 'finalWin', amount: MAX * 100 }];
	ok(payoutFlow(c) === c && play(c).meter === MAX, 'capped round passes through, meter on the cap');
}
{
	const bh = readFileSync(join(app, 'src/game/bookEventHandlerMap.ts'), 'utf8'), ui = readFileSync(join(app, 'src/game/ui.ts'), 'utf8');
	ok(/events = payoutFlow\(egwFlow\(events\)\)/.test(bh), 'playBookEvents runs payoutFlow on every book');
	ok(/finalWin\(ev\) \{ setWinMeter\([^;]*, true\)/.test(bh) && /setWinMeter\(x, !!\(ev as \{ payout\?: boolean \}\)\.payout\)/.test(bh), 'finalWin + payout setTotalWin settle the meter exactly');
	ok(/payout \? Math\.max\(0, x\) : Math\.max\(S\.meterX, x\)/.test(ui), 'setWinMeter only steps down for the paid amount');
}
const dir = process.env.ELFHAUS_BOOKS, cap = Number(process.env.ELFHAUS_BOOKS_MAX || 200000);
if (dir && existsSync(dir)) {
	const zlib = await import('node:zlib'), { createInterface } = await import('node:readline'), { createReadStream } = await import('node:fs');
	for (const f of readdirSync(dir).filter((f) => /^books_.*\.jsonl(\.zst)?$/.test(f)).sort()) {
		const s = createReadStream(join(dir, f)), rl = createInterface({ input: f.endsWith('.zst') ? s.pipe(zlib.createZstdDecompress()) : s, crlfDelay: Infinity });
		let n = 0, bad = 0, moved = 0;
		for await (const line of rl) {
			if (!line) continue; const b = JSON.parse(line), r = play(b.events); n++;
			if (r.ev !== b.events) moved++;
			if (Math.abs(r.meter - Math.min(MAX, b.payoutMultiplier / 100)) > 1e-9) bad++;
			// the closing screen: bonus TOTAL WIN = the paid free-spin wins; no bonus: the last banner = the payout
			else if (b.criteria !== 'wincap' && r.outros.length && Math.abs(r.outros.at(-1) - Math.round(b.freeGameWins * 100)) > 1e-6) bad++;
			else if (b.criteria !== 'wincap' && !r.outros.length && r.banners.length && r.banners.at(-1) !== b.payoutMultiplier) bad++;
			if (n >= cap) break;
		}
		rl.close(); s.destroy();
		ok(!bad, `${f}: ${n} books, meter = payoutMultiplier, outro = freeGameWins, banner = payout in all (${moved} rounded rounds moved, ${bad} off)`);
	}
}
if (fail) { console.error(`\n${fail} payout check(s) failed`); process.exit(1); }
console.log('\nAll payout checks passed.');
