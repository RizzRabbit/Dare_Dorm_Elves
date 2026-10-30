// v3.18 e2e: the intro card carousel. A drag or a tap on the cards never enters the game; the checkbox does not either;
// a tap on TAP TO PARTY does. Usage: URL=http://127.0.0.1:3084/ node scripts/e2e-introswipe.mjs  (dev build, ?mock=true)
const PW = process.env.PW || '/usr/local/lib/pnpm/5/.pnpm/playwright@1.63.0-alpha-2026-08-31/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);
const URL = process.env.URL || 'http://127.0.0.1:4173/';
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
for (const [w, h] of [[390, 844], [1280, 720]]) {
	const mob = w < 1000, ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob });
	const p = await ctx.newPage(); p.setDefaultTimeout(120000);
	await p.goto(URL + '?mock=true&book=base_zero');
	await p.waitForFunction(() => !!document.querySelector('#loader.ready') && window.__intro?.state === 'tap', null, { timeout: 240000 }); await p.waitForTimeout(800);
	const I = () => p.evaluate(() => ({ s: window.__intro.state, c: window.__intro.card, y: window.__intro.cardY, by: window.__intro.btnY }));
	let i = await I(); const y = i.y, c0 = i.c;
	await p.mouse.move(w / 2 + 80, y); await p.mouse.down(); for (let k = 1; k <= 8; k++) { await p.mouse.move(w / 2 + 80 - k * 25, y); await p.waitForTimeout(30); } await p.mouse.up(); await p.waitForTimeout(900);
	i = await I(); ok(i.s === 'tap' && i.c === (c0 + 1) % 3, `${w}x${h} drag left -> next card, intro stays (${JSON.stringify(i)})`);
	await p.mouse.click(w - 12, y); await p.waitForTimeout(900);
	i = await I(); ok(i.s === 'tap' && i.c === (c0 + 2) % 3, `${w}x${h} tap right side card -> it centres, intro stays`);
	await p.mouse.click(w / 2, y); await p.waitForTimeout(600);
	i = await I(); ok(i.s === 'tap' && i.c === (c0 + 2) % 3, `${w}x${h} tap centre card -> nothing, intro stays`);
	await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(600);
	i = await I(); ok(i.s === 'tap' && i.c === (c0 + 1) % 3, `${w}x${h} ArrowLeft -> previous card`);
	await p.click('label.spSkip'); await p.waitForTimeout(400); await p.click('label.spSkip'); await p.waitForTimeout(400);
	i = await I(); ok(i.s === 'tap' && !(await p.isChecked('#spSkip')), `${w}x${h} checkbox toggles, intro stays`);
	await p.mouse.click(w / 2, i.by); await p.waitForTimeout(500);
	i = await I(); ok(i.s === 'trans' || i.s === 'done', `${w}x${h} TAP TO PARTY enters (${i.s})`);
	await ctx.close();
}
await b.close();
console.log(fail ? `intro swipe e2e: ${fail} FAILED` : 'intro swipe e2e: all passed'); process.exit(fail ? 1 : 0);
