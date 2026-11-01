// Cell spin unit stability (James: every symbol is assembled with its own tile as one unit; nothing ever recolours).
// Browser check against the dev/mock server, frame by frame on a controlled clock (JS time + CSS animations stepped
// together). For every spinner unit on every frame:
//   - the unit's tile matches its symbol's class (H -> hi tile, L -> lo, S -> scatter tile, W -> its wild card), and a
//     tile image always maps to one tier (no neutral tile, no recolour);
//   - a unit's tile never changes while it shows the same symbol;
//   - the symbol is centred on its own tile within 1 px;
// and every landed cell shows the unit that landed (same symbol), its tile matching its symbol class, the tile and the
// symbol box centred within 1 px (outside the defined land squash).
// Wins: every popped cell shows the pop (symbol scaled up) and the snow puff (particles visible) for at least POPN /
// SNOWN frames before the symbol clears; the burst runs before the cell is cleared; and no cell is ever empty black
// (every cell shows its tile, or is covered by its spinner).
// Run: URL=http://127.0.0.1:3078/ node scripts/e2e-cellspin.mjs  [BOOKS=base_win,base_dare,base_respin3] [TURBO=1]
const PW = process.env.PW || '/usr/local/lib/pnpm/5/.pnpm/playwright@1.63.0-alpha-2026-08-31/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);
const URL = process.env.URL || 'http://127.0.0.1:3078/';
const POPN = +(process.env.POPN || 3), SNOWN = +(process.env.SNOWN || 6);
const BOOKS = (process.env.BOOKS || 'base_win,base_dare,base_respin3').split(',');
let fail = 0; const bad = new Map();
const err = (m) => { fail++; const k = m.split(':')[0]; bad.set(k, (bad.get(k) || 0) + 1); if (bad.get(k) <= 3) console.error('  FAIL ' + m); };
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const book of BOOKS) {
	const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
	const p = await ctx.newPage(); p.on('pageerror', (e) => err('pageerror: ' + e.message));
	await p.clock.install();
	await p.goto(URL + '?mock=true&book=' + book); await p.waitForSelector('#loader.ready', { timeout: 120000 });
	await p.keyboard.press('Enter'); await p.waitForFunction(() => window.ELFHAUS_INTRO_DONE, null, { timeout: 60000 }).catch(() => {});
	await p.waitForTimeout(2500);
	if (process.env.TURBO) await p.evaluate(() => document.querySelector('#turboBtn')?.click());
	await p.clock.pauseAt(Date.now() + 2000);
	const step = (dt) => p.evaluate((dt) => { const M = (window.__AM ||= new WeakMap());
		for (const a of document.getAnimations()) { if (!M.has(a)) { M.set(a, 1); try { a.pause(); } catch {} } a.currentTime = (a.currentTime ?? 0) + dt;
			if (a.effect && a.currentTime != null) { const e = a.effect.getComputedTiming().endTime; if (Number.isFinite(e) && a.currentTime >= e) a.finish(); } } }, dt);
	await p.evaluate(({ POPN, SNOWN }) => {
		const tierOf = (k) => (k[0] === 'H' ? 'hi' : k[0] === 'L' ? 'lo' : k === 'S' ? 'sp' : 'wild');
		const st = (window.__cs = { frames: 0, units: 0, landed: 0, errs: [], tile2tier: {}, unitTile: new WeakMap(), near: new Map(), puff: new Map(), pops: 0 });
		const e = (m) => { if (st.errs.length < 400) st.errs.push(m); };
		const cellTier = (c) => { const t = c.querySelector(':scope>.tile'); if (!t) return null; if (t.classList.contains('tW')) return 'wild'; const m = t.innerHTML.match(/f__tile_(hi|lo|sp)/); return m ? m[1] : null; };
		const symKey = (c) => { const s = c.querySelector(':scope>.sym'); if (!s) return null; return s.classList.contains('W') ? 'W' : [...s.classList].find((x) => /^(H\d|L\d|S)$/.test(x)) || null; };
		window.__csCheck = () => {
			st.frames++;
			const live = new Set();
			for (const sp of document.querySelectorAll('#strips .cspin')) {
				const id = sp.dataset.cell; live.add(id);
				const win = sp.querySelector('.cwin').getBoundingClientRect(); let best = null;
				for (const u of sp.querySelectorAll('.sl')) {
					const k = u.dataset.k; if (!k) continue;
					const T = u.firstElementChild, Sy = u.lastElementChild, rt = T.getBoundingClientRect(), rs = Sy.getBoundingClientRect();
					if (rt.bottom < win.top || rt.top > win.bottom) continue;   // out of the window
					st.units++;
					const tier = tierOf(k), img = T.style.backgroundImage;
					if (u.dataset.tier !== tier) e(`tier: unit ${k} tagged ${u.dataset.tier}`);
					if (!img || img === 'none') e(`tile: unit ${k} has no tile`);
					const want = tier === 'wild' ? 'wild:' + k : tier, had = st.tile2tier[img];
					if (had && had !== want) e(`recolour: one tile image used for ${had} and ${want}`); st.tile2tier[img] = want;
					const prev = st.unitTile.get(u);
					if (prev && prev.k === k && prev.img !== img) e(`recolour: unit ${k} tile changed mid-flight`);
					st.unitTile.set(u, { k, img });
					const dx = Math.abs(rt.left + rt.width / 2 - (rs.left + rs.width / 2)), dy = Math.abs(rt.top + rt.height / 2 - (rs.top + rs.height / 2));
					if ((dx > 1 || dy > 1) && !u.dataset.empty) e(`centre: unit ${k} symbol off its tile by ${dx.toFixed(2)},${dy.toFixed(2)} px`);
					const d = Math.abs(rt.top + rt.height / 2 - (win.top + win.height / 2));
					if (!best || d < best.d) best = { d, k };
				}
				if (best) st.near.set(id, best.k);
			}
			// pop + snow puff on wins
			for (const c of document.querySelectorAll('#cells .cell')) {
				const fx = c.querySelector(':scope>.puffFx'), P = st.puff.get(c.id);
				if (fx) {
					const r = P || { pop: 0, snow: 0, popAt: -1, cleared: false }; st.puff.set(c.id, r);
					const s = c.querySelector(':scope>.sym'), m = s && new DOMMatrixReadOnly(getComputedStyle(s).transform);
					if (m && Math.hypot(m.a, m.b) > 1.03 && +getComputedStyle(s).opacity > 0.5) { r.pop++; if (r.popAt < 0) r.popAt = st.frames; }
					const parts = [...fx.children].filter((e) => +getComputedStyle(e).opacity > 0.05 && e.getBoundingClientRect().width > 1);
					if (parts.length >= 3) r.snow++;
					if (m && Math.hypot(m.a, m.b) < 0.05 && r.pop === 0) e(`pop: cell ${c.id} cleared with no pop`);
				} else if (P && !P.done) {
					P.done = true; st.pops++;
					if (P.pop < POPN) e(`pop: cell ${c.id} popped for ${P.pop} frames (< ${POPN})`);
					if (P.snow < SNOWN) e(`snow: cell ${c.id} snow puff visible for ${P.snow} frames (< ${SNOWN})`);
				}
				if (!fx && P && P.done && !c.classList.contains('puffed') && !c.classList.contains('spinning')) st.puff.delete(c.id);
				// never a black empty cell: the tile shows, or the cell's spinner covers it
				const t = c.querySelector(':scope>.tile'), cs = getComputedStyle(c);
				if (c.classList.contains('spinning')) { if (!live.has(c.id)) e(`black: cell ${c.id} hidden with no spinner`); }
				else if (t && cs.visibility !== 'hidden' && (+cs.opacity < 0.05 || +getComputedStyle(t).opacity < 0.05)) e(`black: cell ${c.id} tile not showing`);
			}
			for (const [id, k] of [...st.near]) {
				if (live.has(id)) continue;
				st.near.delete(id); st.landed++;
				const c = document.getElementById(id); if (!c) { e(`landed: no cell ${id}`); continue; }
				const sk = symKey(c), want = k.startsWith('W') ? 'W' : k;
				if (sk !== want) e(`landed: cell ${id} shows ${sk}, the unit that landed was ${k}`);
				const ct = cellTier(c);
				if (sk && ct && ct !== tierOf(sk)) e(`landed: cell ${id} tile ${ct} under ${sk}`);
				const t = c.querySelector(':scope>.tile'), s = c.querySelector(':scope>.sym');
				if (t && s) { const a = t.getBoundingClientRect(), q = s.getBoundingClientRect(); const dx = Math.abs(a.left + a.width / 2 - q.left - q.width / 2), dy = Math.abs(a.top + a.height / 2 - q.top - q.height / 2);
					if (dx > 1 || dy > 1) e(`landed: cell ${id} symbol off its tile by ${dx.toFixed(2)},${dy.toFixed(2)} px`); }
			}
		};
		new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('cspin')) {
			const S = n.offsetWidth; n.dataset.cell = `c${Math.round(parseFloat(n.style.left) / S)}${Math.round(parseFloat(n.style.top) / S)}`; } })
			.observe(document.getElementById('strips'), { childList: true, subtree: true });
	}, { POPN, SNOWN });
	await step(0);
	await p.evaluate(() => document.getElementById('spinBtn').click());
	const dur = +(process.env.DUR || (book.includes('respin') ? 12000 : 5000));
	for (let t = 0; t < dur; t += 1000 / 60) { await p.clock.runFor(1000 / 60); await step(1000 / 60); await p.evaluate(() => window.__csCheck()); }
	const r = await p.evaluate(() => ({ pops: __cs.pops, frames: __cs.frames, units: __cs.units, landed: __cs.landed, errs: __cs.errs, tiles: Object.values(__cs.tile2tier) }));
	console.log(`\n=== ${book}${process.env.TURBO ? ' (turbo)' : ''}: ${r.frames} frames, ${r.units} unit checks, ${r.landed} landings, ${r.pops} pops, tiles: ${[...new Set(r.tiles)].sort().join(' ')}`);
	if (!r.units) err('units: no spinner units seen');
	if (!r.landed) err('landed: no landings seen');
	if (book.includes('respin') && !r.pops) err('pop: no win pops seen');
	r.errs.forEach(err);
	await ctx.close();
}
await b.close();
console.log(fail ? `\ne2e-cellspin: ${fail} FAIL` : '\ne2e-cellspin: all passed');
process.exit(fail ? 1 : 0);
