// v3.18 e2e: in turbo a bonus start card waits for START (no timed advance), for a natural trigger and a Mystery reveal
// into Epic. Usage: URL=http://127.0.0.1:3084/ node scripts/e2e-bonusstart.mjs  (dev build, ?mock=true). SHOT=<png> saves a still.
const PW = process.env.PW || '/usr/local/lib/pnpm/5/.pnpm/playwright@1.63.0-alpha-2026-08-31/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);
const URL = process.env.URL || 'http://127.0.0.1:4173/';
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
for (const book of (process.env.BOOKS || 'base_dare,mystery_hidden').split(',')) {
	const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
	const p = await ctx.newPage(); p.setDefaultTimeout(120000);
	await p.goto(URL + '?mock=true&book=' + book);
	await p.waitForFunction(() => !!document.querySelector('#loader.ready'), null, { timeout: 240000 });
	await p.keyboard.press('Enter'); await p.waitForFunction(() => !!window.ELFHAUS_INTRO_DONE, null, { timeout: 120000 }); await p.waitForTimeout(800);
	await p.click('#turboBtn', { force: true }); await p.waitForTimeout(300);
	ok(await p.evaluate(() => document.body.classList.contains('turbo')), `${book}: turbo on`);
	await p.click('#spinBtn', { force: true });
	await p.waitForFunction(() => !document.querySelector('#intro')?.classList.contains('hidden'), null, { timeout: 180000 });
	await p.waitForTimeout(4000);   // old turbo timer: ~0.5 s; old normal timer: 5.2 s
	const st = await p.evaluate(() => ({ vis: !document.querySelector('#intro').classList.contains('hidden'), w: document.querySelector('#intro').dataset.waiting, tier: document.querySelector('#intro').dataset.tier, bar: !document.querySelector('#fsBar').classList.contains('hidden') }));
	ok(st.vis && st.w === 'start' && !st.bar, `${book}: start card still waiting after 4 s in turbo (${JSON.stringify(st)})`);
	if (process.env.SHOT && book === 'base_dare') await p.screenshot({ path: process.env.SHOT });
	await p.click('#intro .cont'); await p.waitForTimeout(600);
	const st2 = await p.evaluate(() => ({ vis: !document.querySelector('#intro').classList.contains('hidden'), bar: !document.querySelector('#fsBar').classList.contains('hidden') }));
	ok(!st2.vis && st2.bar, `${book}: START begins the free spins (${JSON.stringify(st2)})`);
	await ctx.close();
}
await b.close();
console.log(fail ? `bonus start e2e: ${fail} FAILED` : 'bonus start e2e: all passed'); process.exit(fail ? 1 : 0);
