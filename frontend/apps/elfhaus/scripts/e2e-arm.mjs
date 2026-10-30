// v3.17 persistent arming (LOCKED James rule, overrides re-audit M5): a confirmed buy stays armed across rounds.
// Browser check against a served DEV/mock build: arms EGW through its confirm card, plays two consecutive rounds and
// asserts both presses bet 'egw' and the mode is still armed (armTag shown, spin button armed) after each round.
// Run: URL=http://127.0.0.1:3063/ PW=<playwright index.mjs> VT=<virtual-clock init script> node scripts/e2e-arm.mjs
const PW = process.env.PW || '/usr/local/lib/pnpm/5/.pnpm/playwright@1.63.0-alpha-2026-08-31/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);
const URL = process.env.URL || 'http://127.0.0.1:3063/', VT = process.env.VT || '/workspace/elfhaus-shots/wins-current/vt2.js';
let fail = 0; const ok = (c, m) => { if (c) console.log('  OK ' + m); else { fail++; console.error('  FAIL ' + m); } };
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript({ path: VT });
const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('pageerror', e.message));
const step = (n = 1) => p.evaluate(async (n) => { for (let i = 0; i < n; i++) await window.__vt.step(1000 / 60); }, n);
const until = async (fn, max = 6000) => { for (let i = 0; i < max; i += 6) { if (await p.evaluate(fn)) return true; await step(6); } return false; };
const state = () => p.evaluate(() => ({ tag: !document.querySelector('#armTag')?.classList.contains('hidden'), armed: document.querySelector('#spinBtn')?.classList.contains('armed'), label: document.querySelector('#spinBtn')?.getAttribute('aria-label'), bets: [...(window.__mockBets || [])] }));
await p.goto(URL + '?mock=true&book=egw_nonadjacent');
await until(() => !!document.querySelector('#loader.ready'));
await p.keyboard.press('Enter');
await until(() => !!window.ELFHAUS_INTRO_DONE); await step(60);
console.log('\n=== persistent arming (EGW, 2 rounds) ===');
await p.click('#buyBtn'); await step(30);
await p.click('.bcard[data-m="egw"]'); await step(30);
ok(await p.evaluate(() => !document.querySelector('#bmConfirm')?.classList.contains('hidden')), 'confirm card shows on arming a mode above CONFIRM_ABOVE_X');
await p.click('#cfYes'); await step(60);
let s = await state(); ok(s.tag && s.armed, `armed after CONFIRM (${s.label})`);
for (let n = 1; n <= 2; n++) {
	await p.click('#spinBtn'); await step(10);
	ok(await until(() => document.querySelector('#spinBtn')?.classList.contains('busy'), 600), `round ${n} started`);
	ok(await until(() => !document.querySelector('#spinBtn')?.classList.contains('busy'), 20000), `round ${n} finished`);
	await step(30);
	for (let i = 0; i < 5; i++) { if (await p.evaluate(() => { const o = [...document.querySelectorAll('.overlay:not(.hidden)')]; o.forEach((e) => e.click()); return !o.length; })) break; await step(30); }
	s = await state();
	ok(s.bets.length === n && s.bets[n - 1] === 'egw', `round ${n} bet mode ${s.bets[n - 1]} (bets ${s.bets.join(',')})`);
	ok(s.tag && s.armed, `still armed after round ${n} (${s.label})`);
}
await b.close();
console.log(fail ? `\narm e2e: ${fail} FAILED` : '\narm e2e: all passed');
process.exit(fail ? 1 : 0);
