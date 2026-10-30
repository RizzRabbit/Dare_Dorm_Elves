// v3.18 e2e: in turbo a bonus start card waits for START (no timed advance), for a natural trigger and a Mystery reveal
// into Double Dare (mystery_hidden ends on the capped max-win screen, which skips TOTAL WIN); v3.18b: the TOTAL WIN end screen waits for a tap too (END_SHOT=<png> saves the landed screen); autoplay
// with AUTO-PLAY BONUS off (waits for taps, count kept) and on (hands-free). MANUAL=0 / AUTO=0 skip a part; MENU_SHOT=<png>. Usage: URL=http://127.0.0.1:3084/ node scripts/e2e-bonusstart.mjs  (dev build, ?mock=true). SHOT=<png> saves a still.
const PW = process.env.PW || '/usr/local/lib/pnpm/5/.pnpm/playwright@1.63.0-alpha-2026-08-31/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);
const URL = process.env.URL || 'http://127.0.0.1:4173/';
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
for (const book of (process.env.MANUAL === '0' ? [] : (process.env.BOOKS || 'base_dare,mystery_double').split(','))) {
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
	// v3.18b: the TOTAL WIN end screen waits for a tap in manual play (turbo too); first tap mid-count only lands the count
	await p.waitForFunction(() => !document.querySelector('#outro')?.classList.contains('hidden'), null, { timeout: 240000 });
	const early = await p.evaluate(() => document.querySelector('#outro').classList.contains('landed'));
	if (!early) { await p.click('#outro', { force: true }); await p.waitForFunction(() => document.querySelector('#outro').classList.contains('landed'), null, { timeout: 2500, polling: 50 }).catch(() => {}); }
	const o1 = await p.evaluate(() => ({ vis: !document.querySelector('#outro').classList.contains('hidden'), landed: document.querySelector('#outro').classList.contains('landed') }));
	ok(o1.vis && o1.landed, `${book}: first tap ${early ? '(count already landed)' : 'during the count-up lands it'}, screen stays up (${JSON.stringify(o1)})`);
	await p.waitForTimeout(4000);
	const o2 = await p.evaluate(() => { const O = document.querySelector('#outro'), h = O.querySelector('.otHint'); return { vis: !O.classList.contains('hidden'), w: O.dataset.waiting, hint: getComputedStyle(h).opacity, amt: O.querySelector('.otAmt').textContent }; });
	ok(o2.vis && o2.w === 'tap' && +o2.hint > 0.5, `${book}: end screen still up after 4 s in turbo with TAP TO CONTINUE (${JSON.stringify(o2)})`);
	if (process.env.END_SHOT && book === 'base_dare') await p.screenshot({ path: process.env.END_SHOT });
	if (book === 'base_dare') await p.click('#outro', { force: true }); else await p.keyboard.press('Enter');
	await p.waitForTimeout(600);
	ok(await p.evaluate(() => document.querySelector('#outro').classList.contains('hidden')), `${book}: ${book === 'base_dare' ? 'tap' : 'Enter'} closes the end screen`);
	await ctx.close();
}
// v3.18b (James 12:10/12:11): in autoplay the START card and the TOTAL WIN screen both wait for a tap; the end tap
// resumes autoplay with its remaining count intact.
async function autoRun(bonusOn) {
	const book = 'base_dare', tag = `autoplay, AUTO-PLAY BONUS ${bonusOn ? 'ON' : 'OFF'}`;
	const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
	const p = await ctx.newPage(); p.setDefaultTimeout(120000);
	await p.goto(URL + '?mock=true&book=' + book);
	await p.waitForFunction(() => !!document.querySelector('#loader.ready'), null, { timeout: 240000 });
	await p.keyboard.press('Enter'); await p.waitForFunction(() => !!window.ELFHAUS_INTRO_DONE, null, { timeout: 120000 }); await p.waitForTimeout(800);
	await p.click('#turboBtn', { force: true }); await p.waitForTimeout(300);
	await p.click('#autoBtn', { force: true }); await p.waitForTimeout(700);
	const def = await p.evaluate(() => document.querySelector('#stBonus').getAttribute('aria-checked'));
	ok(def === 'false', `${tag}: toggle defaults to off (${def})`);
	if (!bonusOn && process.env.MENU_SHOT) await p.screenshot({ path: process.env.MENU_SHOT });
	if (bonusOn) { await p.click('#stBonus', { force: true }); await p.waitForTimeout(200); ok(await p.evaluate(() => document.querySelector('#stBonus').getAttribute('aria-checked')) === 'true', `${tag}: toggle switches on`); }
	await p.click('#autoStart', { force: true });
	const n0 = await p.evaluate(() => document.querySelector('#autoN').textContent);
	await p.waitForFunction(() => !document.querySelector('#intro')?.classList.contains('hidden'), null, { timeout: 180000 });
	if (bonusOn) {
		const adv = await p.waitForFunction(() => document.querySelector('#intro').classList.contains('hidden'), null, { timeout: 20000, polling: 100 }).then(() => true, () => false);
		ok(adv, `${tag}: START card starts by itself`);
		await p.waitForFunction(() => !document.querySelector('#outro')?.classList.contains('hidden'), null, { timeout: 240000 });
		const closed = await p.waitForFunction(() => document.querySelector('#outro').classList.contains('hidden'), null, { timeout: 30000, polling: 100 }).then(() => true, () => false);
		ok(closed, `${tag}: TOTAL WIN closes by itself`);
		const resumed = await p.waitForFunction(() => !!document.querySelector('#cells .cell.spinning'), null, { timeout: 8000, polling: 50 }).then(() => true, () => false);
		const a = await p.evaluate(() => ({ n: document.querySelector('#autoN').textContent, on: document.querySelector('#autoBtn').classList.contains('on') }));
		ok(resumed && a.on && +a.n === +n0 - 1, `${tag}: autoplay continues with ${+n0 - 1} left (${JSON.stringify(a)}, resumed=${resumed})`);
	} else {
		await p.waitForTimeout(4000);
		const s1 = await p.evaluate(() => ({ vis: !document.querySelector('#intro').classList.contains('hidden'), w: document.querySelector('#intro').dataset.waiting, n: document.querySelector('#autoN').textContent, on: document.querySelector('#autoBtn').classList.contains('on'), bar: !document.querySelector('#fsBar').classList.contains('hidden') }));
		ok(s1.vis && s1.w === 'start' && !s1.bar && s1.on && s1.n === n0, `${tag}: START card still waiting after 4 s, autoplay still on (n0=${n0}, ${JSON.stringify(s1)})`);
		await p.click('#intro .cont'); await p.waitForTimeout(600);
		ok(await p.evaluate(() => !document.querySelector('#fsBar').classList.contains('hidden')), `${tag}: START begins the free spins`);
		await p.waitForFunction(() => document.querySelector('#outro')?.classList.contains('landed'), null, { timeout: 240000 });
		await p.waitForTimeout(4000);
		const a1 = await p.evaluate(() => ({ vis: !document.querySelector('#outro').classList.contains('hidden'), w: document.querySelector('#outro').dataset.waiting, n: document.querySelector('#autoN').textContent, on: document.querySelector('#autoBtn').classList.contains('on') }));
		ok(a1.vis && a1.w === 'tap' && a1.on && a1.n === n0, `${tag}: end screen still up after 4 s, autoplay still on (${JSON.stringify(a1)})`);
		await p.click('#outro', { force: true });
		const resumed = await p.waitForFunction(() => !!document.querySelector('#cells .cell.spinning'), null, { timeout: 8000, polling: 50 }).then(() => true, () => false);
		const a2 = await p.evaluate(() => ({ hidden: document.querySelector('#outro').classList.contains('hidden'), n: document.querySelector('#autoN').textContent, on: document.querySelector('#autoBtn').classList.contains('on') }));
		ok(resumed && a2.hidden && a2.on && +a2.n === +n0 - 1, `${tag}: tap closes it and autoplay resumes with ${+n0 - 1} left (${JSON.stringify(a2)}, resumed=${resumed})`);
	}
	await ctx.close();
}
if (process.env.AUTO !== '0') { await autoRun(false); await autoRun(true); }
await b.close();
console.log(fail ? `bonus start e2e: ${fail} FAILED` : 'bonus start e2e: all passed'); process.exit(fail ? 1 : 0);
