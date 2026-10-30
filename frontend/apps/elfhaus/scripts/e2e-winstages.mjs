// v3.17 staged win skip, browser check against a served DEV/mock build (needs the dev hooks window.__winStages and
// window.__bigWin). Rapid double taps (2 pointer taps 80 ms apart, a pair every ~420 ms) must walk through EVERY win
// stage in order, one stage per double tap: a (glow + draw-on), b (lines one by one), c (WIN meter count), then on a
// big win each tier checkpoint, the run to the final amount and the landed banner. The WIN meter and the banner land
// on their exact amounts.
// Run: URL=http://127.0.0.1:3081/ node scripts/e2e-winstages.mjs
const PW = process.env.PW || '/usr/local/lib/pnpm/5/.pnpm/playwright@1.63.0-alpha-2026-08-31/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);
const URL = process.env.URL || 'http://127.0.0.1:3081/', VT = process.env.VT || '/workspace/elfhaus-shots/wins-current/vt2.js';
let fail = 0; const ok = (c, m) => { if (c) console.log('  OK ' + m); else { fail++; console.error('  FAIL ' + m); } };
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript({ path: VT });
const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('pageerror', e.message));
const step = (n = 1) => p.evaluate(async (n) => { for (let i = 0; i < n; i++) await window.__vt.step(1000 / 60); }, n);
const until = async (fn, max = 6000, arg) => { for (let i = 0; i < max; i += 3) { if (await p.evaluate(fn, arg)) return true; await step(3); } return false; };
const log = () => p.evaluate(() => (window.__winStages || []).map((e) => e.slice(0, 2)));
const tapAt = (sel) => p.evaluate((sel) => { const el = document.querySelector(sel); const r = el.getBoundingClientRect(); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerType: 'touch', isPrimary: true })); }, sel);
const dbl = async (sel) => { await tapAt(sel); await step(5); await tapAt(sel); await step(20); };

await p.goto(URL + '?mock=true&book=base_respin3');
await until(() => !!document.querySelector('#loader.ready'));
await p.keyboard.press('Enter');
await until(() => !!window.ELFHAUS_INTRO_DONE); await step(60);

console.log('\n=== staged skip: line win (3 lines) ===');
await p.click('#spinBtn');
ok(await until(() => (window.__winStages || []).some((e) => e[0] === 'start' && e[1] === 'a'), 3000), 'stage a started');
let pairs = 0;
while (pairs < 12 && !(await p.evaluate(() => (window.__winStages || []).some((e) => e[0] === 'end' && e[1] === 'c')))) { await dbl('#board'); pairs++; }
let L = await log();
const sk = L.filter((e) => e[0] === 'skip').map((e) => e[1]), st = L.filter((e) => e[0] === 'start').map((e) => e[1]);
ok(st.slice(0, 3).join() === 'a,b,c', `stages started in order: ${st.slice(0, 3).join(' > ')}`);
ok(sk.slice(0, 3).join() === 'a,b,c', `one stage per double tap: skipped ${sk.join(', ')} in ${pairs} double taps`);
await until(() => !document.querySelector('#spinBtn')?.classList.contains('busy'), 4000);
const meter = await p.evaluate(() => document.querySelector('#win')?.textContent);
ok(/9\.80/.test(meter || ''), `WIN meter landed on the step total (${meter})`);

console.log('\n=== staged skip: big win 222.95x (every tier checkpoint) ===');
await p.evaluate(() => { window.__winStages.length = 0; window.__bwDone = false; window.__bigWin(222.95).then(() => { window.__bwDone = true; }); });
await until(() => !document.querySelector('#bigwin')?.classList.contains('hidden'), 300);
let landedAmt = null; pairs = 0;
while (pairs < 20 && !(await p.evaluate(() => window.__bwDone))) {
	await dbl('#bigwin'); pairs++;
	const lst = await log(); if (!landedAmt && lst.some((e) => e[0] === 'start' && e[1] === 'bw:landed')) { await step(30); landedAmt = await p.evaluate(() => document.querySelector('#bigwin .bwAmt')?.textContent); }
}
await until(() => window.__bwDone, 600);
L = await log();
const want = ['bw:BIG WIN', 'bw:MEGA WIN', 'bw:SUPER WIN', 'bw:EPIC WIN', 'bw:final', 'bw:landed'];
const st2 = L.filter((e) => e[0] === 'start').map((e) => e[1]), sk2 = L.filter((e) => e[0] === 'skip').map((e) => e[1]);
ok(JSON.stringify(st2) === JSON.stringify(want), `every checkpoint reached in order: ${st2.join(' > ')}`);
ok(JSON.stringify(sk2) === JSON.stringify(want), `each double tap advanced exactly one stage (${sk2.length} skips, ${pairs} double taps)`);
ok(/222\.95/.test(landedAmt || ''), `banner landed on the exact amount (${landedAmt})`);
ok(await p.evaluate(() => document.querySelector('#bigwin').classList.contains('hidden')), 'banner closed after the last stage');

console.log('\n=== no taps: stages end on their own (autoplay never waits) ===');
await p.evaluate(() => { window.__winStages.length = 0; window.__bwDone = false; window.__bigWin(15).then(() => { window.__bwDone = true; }); });
ok(await until(() => window.__bwDone, 900), 'a 15x banner finishes with no taps');
await b.close();
console.log(fail ? `\nwin stage e2e: ${fail} FAILED` : '\nwin stage e2e: all passed');
process.exit(fail ? 1 : 0);
