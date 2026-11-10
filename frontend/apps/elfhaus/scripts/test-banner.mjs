// v20: the big-win banner level by the round's mode edges (math WIN_LEVEL_EDGES_BY_MODE, synced; bannerLevel.ts).
// James 2026-10-30 19:28 CDT: the bonus buys DD / TD / Mystery / EGW size every tier x10 (BIG 150x, MEGA 300x, SUPER 500x,
// EPIC 1000x, LEGENDARY 10000x; a tier at or above the cap is skipped); base, ante and Dare keep the standard 15/30/50/100/1000x.
// Replays EGW and every bonus / feature mode's books (mock + fixtures; ELFHAUS_BOOKS=<publish_files dir> adds the real books,
// local only): every setWin's banner level = the synced mode edges on the amount, and no banner below the mode's BIG edge.
import { readFileSync, readdirSync, existsSync, createReadStream } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { createZstdDecompress } from 'node:zlib';
import { transformWithEsbuild } from 'vite';
const app = resolve(import.meta.dirname, '..');
const load = async (f) => { const { code } = await transformWithEsbuild(readFileSync(join(app, 'src/game', f), 'utf8'), f, { loader: 'ts', format: 'esm' }); return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64')); };
const { bannerLevel, levelAt } = await load('bannerLevel.ts');
const GEN = JSON.parse(readFileSync(join(app, 'src/game/modes.generated.json'), 'utf8')), SNAP = JSON.parse(readFileSync(join(app, 'math-snapshot/game_config.json'), 'utf8'));
const FB = JSON.parse(readFileSync(join(app, 'src/game/math.fallback.json'), 'utf8'));
const WL = GEN.math.winLevels, MAX = GEN.math.maxWinX, FIRST = 6;
const edgesFor = (m) => WL.byMode?.[m] ?? WL.standard;
const stage = (lv) => ({ 6: 'BIG', 7: 'MEGA', 8: 'SUPER', 9: 'EPIC', 10: 'LEGENDARY' })[lv] || '-';
let fail = 0;
const ok = (c, m) => { if (c) console.log('  PASS: ' + m); else { console.error('  FAIL: ' + m); fail++; } };
console.log('\n=== banner: per-mode win-level edges (math-synced) ===');
ok(JSON.stringify(WL) === JSON.stringify(SNAP.winLevels) && JSON.stringify(FB.winLevels) === JSON.stringify(SNAP.winLevels), 'modes.generated + math.fallback winLevels = math-snapshot (math WIN_LEVEL_EDGES / _BY_MODE)');
const BUY = ['double_dare', 'triple_dare', 'mystery', 'egw'], STD = ['base', 'ante', 'dare'];
for (const m of BUY) { const e = edgesFor(m); ok(e.slice(4, 9).join() === WL.standard.slice(4, 9).map((v) => v * 10).join() && e.slice(4, 9).join() === '150,300,500,1000,10000', `${m}: BIG/MEGA/SUPER/EPIC/LEGENDARY from ${e.slice(4, 9).join('/')}x (standard x10), cap ${e[9]}x`); }
for (const m of STD) ok(edgesFor(m) === WL.standard && WL.standard.slice(4, 9).join() === '15,30,50,100,1000', `${m}: standard 15/30/50/100/1000x`);
const egw = edgesFor('egw');
ok(stage(bannerLevel(47330, egw, FIRST, MAX)) === 'MEGA' && stage(bannerLevel(34550, egw, FIRST, MAX)) === 'MEGA', `EGW 473.3x / 345.5x (James's $4.733 / $3.455 at $0.01) -> MEGA / MEGA (was EPIC + elves)`);
ok(bannerLevel(14990, egw, FIRST, MAX) === 0 && stage(bannerLevel(15000, egw, FIRST, MAX)) === 'BIG' && stage(bannerLevel(100000, egw, FIRST, MAX)) === 'EPIC' && stage(bannerLevel(1000000, egw, FIRST, MAX)) === 'LEGENDARY', 'EGW: no banner under 150x, BIG at 150x, EPIC at 1000x, LEGENDARY at 10000x');
ok(stage(bannerLevel(47330, WL.standard, FIRST, MAX)) === 'EPIC' && bannerLevel(1490, WL.standard, FIRST, MAX) === 0, 'base: 473.3x still EPIC, nothing under 15x');
ok(bannerLevel(MAX * 100, egw, FIRST, MAX) === 0, 'the cap is the max-win screen, never a banner');
const check = (mode, events, tag, acc) => {
	const e = edgesFor(mode), big = e[FIRST - 2];
	for (const ev of events) if (ev.type === 'setWin') {
		acc.n++; const x = ev.amount / 100, b = bannerLevel(ev.amount, e, FIRST, MAX), want = levelAt(x, e);
		const exp = want >= FIRST && want <= e.length && x < MAX ? want : 0;
		if (b !== exp || (b && x < big)) { acc.bad++; if (acc.bad < 4) console.error(`    ${tag}: setWin ${ev.amount} -> ${b} (want ${exp})`); }
		if (b) acc.st[stage(b)] = (acc.st[stage(b)] || 0) + 1;
	}
};
const fmt = (st) => Object.entries(st).map(([k, v]) => `${k} ${v}`).join(', ') || 'no banners';
for (const dir of ['src/mock/books', 'test-fixtures/books']) {
	const per = {};
	for (const f of readdirSync(join(app, dir)).filter((f) => f.endsWith('.json'))) {
		const b = JSON.parse(readFileSync(join(app, dir, f), 'utf8')), mode = b.mode || f.split('_')[0];
		if (mode === 'base') continue; per[mode] ??= { n: 0, bad: 0, st: {} }; check(mode, b.events || [], f, per[mode]);
	}
	for (const [m, a] of Object.entries(per)) ok(!a.bad, `${dir} ${m}: ${a.n} setWin (${fmt(a.st)}), ${a.bad} wrong`);
}
{
	const bh = readFileSync(join(app, 'src/game/bookEventHandlerMap.ts'), 'utf8'), ui = readFileSync(join(app, 'src/game/ui.ts'), 'utf8'), gm = readFileSync(join(app, 'src/game/game.ts'), 'utf8'), cf = readFileSync(join(app, 'src/game/config.ts'), 'utf8');
	ok(/bannerLevel\(ev\.amount, WIN_EDGES, BIG_TIERS\[0\]\.level, MAX_WIN_X/.test(bh) && /levelOf\(ev\.amount \/ 100, WIN_EDGES\)/.test(bh), "setWin banner + level on the round's mode edges");
	ok(/winEdgesFor = \(mode\?: string\): number\[\] => \{ const m = normMode\(mode\); return \(m && WIN_LEVELS\.byMode\?\.\[m\]\) \|\| WIN_LEVELS\.standard; \}/.test(cf) && /export function setRoundMode\(mode\?: string\) \{/.test(ui) && /setWinLevels\(e\)/.test(ui) && /winEdgesFor\(mode\)/.test(ui), 'edges per mode from the synced config (no thresholds in components)');
	ok(/setRoundMode\(mode\)/.test(gm) && /setRoundMode\(rd\.mode\)/.test(gm) && /setRoundMode\(url\.mode\)/.test(gm), 'set for a spin, a resumed round and a replay');
}
const dir = process.env.ELFHAUS_BOOKS, cap = Number(process.env.ELFHAUS_BOOKS_MAX || 200000);
if (dir && existsSync(dir)) for (const f of readdirSync(dir).filter((f) => /^books_.*\.jsonl\.zst$/.test(f)).sort()) {
	const mode = f.slice(6, -10); if (mode === 'base') continue;
	const s = createReadStream(join(dir, f)), rl = createInterface({ input: s.pipe(createZstdDecompress()), crlfDelay: Infinity });
	const acc = { n: 0, bad: 0, st: {} }; let n = 0;
	for await (const line of rl) { if (!line) continue; check(mode, JSON.parse(line).events, f, acc); if (++n >= cap) break; }
	rl.close(); s.destroy();
	ok(!acc.bad, `${f}: ${n} books, ${acc.n} setWin (${fmt(acc.st)}), all >= ${edgesFor(mode)[FIRST - 2]}x`);
}
if (fail) { console.error(`\n${fail} banner check(s) failed`); process.exit(1); }
console.log('\nAll banner checks passed.');
