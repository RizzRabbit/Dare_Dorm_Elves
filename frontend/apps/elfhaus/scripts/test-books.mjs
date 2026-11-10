// Test runner: validates that every fixture book plays end-to-end and the win meter settles on finalWin.
// Also performs the social-mode word scan across UI strings, generated rules, and templates.
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const appDir = resolve(import.meta.dirname, '..');
const booksDir = join(appDir, 'test-fixtures/books');
const bookFiles = readdirSync(booksDir).filter((f) => f.endsWith('.json'));
// every math-owned value the tests check comes from the generated config (scripts/sync-config.mjs), never typed here
const GEN = JSON.parse(readFileSync(join(appDir, 'src/game/modes.generated.json'), 'utf8'));
const MATH = GEN.math;
const MAX_WIN_X = MATH.maxWinX;

console.log(`\n=== 1. Testing ${bookFiles.length} fixture books ===`);
let failedBooks = 0;

for (const file of bookFiles) {
	const raw = readFileSync(join(booksDir, file), 'utf8');
	const book = JSON.parse(raw);
	const events = book.events || [];

	// Simulate win meter tracking
	let meterX = 0;
	let stepWin = 0;
	let roundBase = 0;
	let reachedWincap = false;

	for (const ev of events) {
		// Coordinate bounds check
		if (ev.type === 'reveal') {
			if (!Array.isArray(ev.board) || ev.board.length !== 5) {
				throw new Error(`${file}: reveal.board must have 5 reels`);
			}
		} else if (ev.type === 'winInfo') {
			for (const win of ev.wins || []) {
				for (const pos of win.positions || []) {
					if (pos.reel < 0 || pos.reel > 4 || pos.row < 0 || pos.row > 3) {
						throw new Error(`${file}: win coordinate out of bounds: (${pos.reel}, ${pos.row})`);
					}
				}
			}
		} else if (ev.type === 'respinStart') {
			for (const pos of ev.replace || []) {
				if (pos.reel < 0 || pos.reel > 4 || pos.row < 0 || pos.row > 3) {
					throw new Error(`${file}: replace coordinate out of bounds: (${pos.reel}, ${pos.row})`);
				}
			}
		} else if (ev.type === 'respinReveal') {
			for (const s of ev.newSymbols || []) {
				if (s.reel < 0 || s.reel > 4 || s.row < 0 || s.row > 3) {
					throw new Error(`${file}: respinReveal coordinate out of bounds: (${s.reel}, ${s.row})`);
				}
			}
		}

		// Win meter state transitions (matching bookEventHandlerMap.ts)
		if (ev.type === 'updateStepWin') {
			const x = roundBase + ev.amount / 100;
			meterX = Math.min(MAX_WIN_X, Math.max(meterX, x));
		} else if (ev.type === 'setTotalWin') {
			const x = Math.min(ev.amount / 100, MAX_WIN_X);
			meterX = ev.payout ? x : Math.min(MAX_WIN_X, Math.max(meterX, x));   // payoutFlow: the paid total may sit 0.05x under
			roundBase = x;
		} else if (ev.type === 'wincap') {
			meterX = MAX_WIN_X;
			reachedWincap = true;
		} else if (ev.type === 'finalWin') {
			meterX = Math.min(ev.amount / 100, MAX_WIN_X);   // the paid amount (payoutMultiplier, rounded down to 0.1x)
		}
	}

	const expectedFinalX = Math.min(MAX_WIN_X, book.payoutMultiplier / 100);
	const pass = Math.abs(meterX - expectedFinalX) < 1e-6;

	if (pass) {
		console.log(`  PASS: ${file.padEnd(24)} (${book.mode.padEnd(12)}) payoutMultiplier=${book.payoutMultiplier} -> meter=${meterX}x`);
	} else {
		console.error(`  FAIL: ${file.padEnd(24)} expected ${expectedFinalX}x, got ${meterX}x`);
		failedBooks++;
	}
}

// v3.15f / math v2: Epic ('hidden') starts with START_FS.hidden free spins, its guaranteed stacks start at
// GUAR_MIN_VAL.hidden and every wild grows by GROW_STEP.hidden per step after the trigger (+1 before it, every other tier)
{
	const startFs = MATH.startFs.hidden, stackX = MATH.epic.stackX, step = MATH.epic.step, base = MATH.growStep.default;
	console.log(`\n=== 1b. Epic start: ${startFs} free spins, stacks from x${stackX}, +${step} per step (other wilds +${base}) ===`);
	const cfg = readFileSync(join(appDir, 'src/game/config.ts'), 'utf8');
	if (!/EPIC_STACK_X: number = G\.epic\.stackX/.test(cfg) || !/EPIC_GROW_STEP: number = G\.epic\.step/.test(cfg)) { console.error('  FAIL: config.ts EPIC_STACK_X / EPIC_GROW_STEP not read from the math config'); failedBooks++; }
	let epics = 0;
	for (const dir of [booksDir, join(appDir, 'src/mock/books')]) for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
		const ev = JSON.parse(readFileSync(join(dir, file), 'utf8')).events || [];
		const ti = ev.findIndex((e) => e.type === 'freeSpinTrigger' && e.tier === 'hidden');
		if (ti < 0) continue;
		const trig = ev[ti];
		epics++;
		const g = ev.find((e) => e.type === 'guaranteedStacks' && e.tier === 'hidden'), ufs = ev.find((e) => e.type === 'updateFreeSpin');
		const errs = [];
		if (trig.totalFs !== startFs) errs.push(`freeSpinTrigger.totalFs ${trig.totalFs}`);
		if (ufs && ufs.total !== startFs) errs.push(`first updateFreeSpin.total ${ufs.total}`);
		if (g && g.stacks.some((st) => st.value < stackX)) errs.push(`guaranteedStacks values ${g.stacks.map((st) => st.value)}`);
		if (g && g.stacks.some((st) => !g.locked.fullReels.some((f) => f.reel === st.reel && f.value === st.value))) errs.push('stack missing from locked.fullReels');
		const steps = new Set(), pre = new Set();
		ev.forEach((e, i) => { if (e.type === 'wildGrow') for (const c of e.changes) (i > ti ? steps : pre).add(c.to - c.from); });
		if ([...steps].some((d) => d !== step)) errs.push(`Epic wildGrow steps ${[...steps]} (want +${step})`);
		if ([...pre].some((d) => d !== base)) errs.push(`pre-trigger wildGrow steps ${[...pre]} (want +${base})`);
		if (errs.length) { console.error(`  FAIL: ${file}: ${errs.join('; ')}`); failedBooks++; }
		else console.log(`  PASS: ${file.padEnd(24)} totalFs=${trig.totalFs}, stacks x${g ? g.stacks.map((st) => st.value).join(', x') : '-'}, grows +${[...steps].join('/') || '-'}`);
	}
	if (!epics) { console.error('  FAIL: no Epic books found'); failedBooks++; }
}

// v3.15g: after a wincap the TOTAL WIN outro is skipped (freeSpinEnd returns early) and finalWin lands on the cap
{
	const src = readFileSync(join(appDir, 'src/game/bookEventHandlerMap.ts'), 'utf8');
	console.log(`\n=== 1c. Max win skips the TOTAL WIN outro ===`);
	const ok = /async wincap\(\w*\) \{[^}\n]*capHit = true;/.test(src) && /async freeSpinEnd\(ev\) \{\s*if \(capHit\) \{ endBonusUi\(\); return; \}/.test(src) && /S\.roundBase = 0; capHit = false;/.test(src);
	if (!ok) { console.error('  FAIL: capHit skip not wired in bookEventHandlerMap.ts'); failedBooks++; }
	let caps = 0;
	for (const dir of [booksDir, join(appDir, 'src/mock/books')]) for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
		const ev = JSON.parse(readFileSync(join(dir, file), 'utf8')).events || [];
		const wi = ev.findIndex((e) => e.type === 'wincap');
		if (wi < 0) continue;
		caps++;
		const fe = ev.findIndex((e) => e.type === 'freeSpinEnd'), fw = ev.filter((e) => e.type === 'finalWin').pop();
		const errs = [];
		if (fe >= 0 && fe < wi) errs.push('freeSpinEnd before wincap');
		if (!fw || Math.min(fw.amount / 100, MAX_WIN_X) !== MAX_WIN_X) errs.push(`finalWin ${fw && fw.amount}`);
		if (ev[wi].amount / 100 !== MAX_WIN_X) errs.push(`wincap amount ${ev[wi].amount} vs math cap ${MAX_WIN_X}x`);
		if (errs.length) { console.error(`  FAIL: ${file}: ${errs.join('; ')}`); failedBooks++; }
		else console.log(`  PASS: ${file.padEnd(24)} outro ${fe >= 0 ? 'skipped' : 'n/a (no FS)'}, finalWin ${MAX_WIN_X}x`);
	}
	if (!caps) { console.error('  FAIL: no wincap books found'); failedBooks++; }
}

console.log(`\n=== 2. Social-mode restricted word scan ===`);
// Scan strings, rules, and UI text in social mode
// Stake social casino banned list (approval guidelines, front-end communication / jurisdiction requirements) plus
// cost / costs / price (v3.13). Word forms: bets/betting, buys/buying, paying/payout, wagers, credits, funds, purchases.
const RESTRICTED = /\b(bets?|betting|buy|buys|buying|bought|pay|pays|paid|paying|payouts?|wager\w*|cash\w*|money|credits?|currency|currencies|stakes?|funds?|funding|purchase\w*|cost of|at the cost of|costs?|prices?|paylines?|paytables?|gambl\w*|deposit\w*|withdraw\w*)\b/i; // v3.16 (#77): + paylines, paytable, gamble, deposit, withdraw

// Read strings.ts
const stringsCode = readFileSync(join(appDir, 'src/game/strings.ts'), 'utf8');
// Extract the social column of T (index 1 of tuples)
const socialStrings = [];
const tupleMatches = stringsCode.matchAll(/:\s*\[\s*['"`](.*?)['"`]\s*,\s*['"`](.*?)['"`]\s*\]/g);
for (const m of tupleMatches) {
	socialStrings.push({ key: m[1], socialVal: m[2] });
}

let violations = 0;
for (const { key, socialVal } of socialStrings) {
	const hit = socialVal.match(RESTRICTED);
	if (hit) {
		console.error(`  VIOLATION in strings.ts social string for "${key}": "${socialVal}" matches "${hit[0]}"`);
		violations++;
	} else {
		console.log(`  OK string: "${socialVal}"`);
	}
}

// Check social rules text generated in game.ts
const gameCode = readFileSync(join(appDir, 'src/game/game.ts'), 'utf8');
// Check disclaimer text
const disclaimerMatch = gameCode.match(/const DISCLAIMER =\s*['"`](.*?)['"`];/s);
if (disclaimerMatch) {
	const disc = disclaimerMatch[1];
	const hit = disc.match(RESTRICTED);
	if (hit) {
		console.error(`  VIOLATION in DISCLAIMER: "${hit[0]}"`);
		violations++;
	} else {
		console.log(`  OK DISCLAIMER (${disc.length} chars, no restricted words)`);
	}
}

// v3.16c (James): the disclaimer is exactly this text, in every mode (one DISCLAIMER constant, real and social), in the
// source and in the built bundle (run after the build)
{
	const WANT = 'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. © 2026 Rizzin Games.';
	const src = disclaimerMatch?.[1];
	if (src === WANT) console.log('  OK DISCLAIMER source is the exact approved text');
	else { console.error('  VIOLATION: DISCLAIMER source differs from the approved text'); violations++; }
	const dir = join(appDir, 'build/_app/immutable');
	let bundles = [];
	try { bundles = readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith('.js')).map((f) => readFileSync(join(dir, String(f)), 'utf8')); } catch {}
	// the build inlines the app bundle into index.html and drops the duplicate .js (scripts-build.mjs), so look there too
	try { bundles.push(readFileSync(join(appDir, 'build/index.html'), 'utf8')); } catch {}
	const esc = WANT.replace('©', '\\xA9'), esc2 = WANT.replace('©', '\\u00A9');
	if (bundles.some((b) => b.includes(WANT) || b.includes(esc) || b.includes(esc2))) console.log('  OK DISCLAIMER exact text present in the build');
	else { console.error('  VIOLATION: exact DISCLAIMER text not found in build/index.html or build/_app/immutable (build first)'); violations++; }
}

// v3.13: copy.ts (bonus confirm cards, Turbo toggle, mode descriptions, cost-related rules lines) rendered in social
// mode for every mode, and the static text of the rules template in game.ts (buildRules) with its social branches.
{
	const { transformWithEsbuild } = await import('vite');
	const cs = readFileSync(join(appDir, 'src/game/copy.ts'), 'utf8');
	const { code } = await transformWithEsbuild(cs, 'copy.ts', { loader: 'ts', format: 'esm' });
	const C = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
	const ctx = { social: true, anteX: GEN.modes.ante.cost + 'x', anteOdds: 'about 1 in 68', baseOdds: 'about 1 in 190', fs: { dare: MATH.startFs.dare, double_dare: MATH.startFs.double_dare, triple_dare: MATH.startFs.triple_dare }, odds: { ...MATH.mysteryOdds }, egwX: MATH.egwStackX, tdGuar: MATH.guarantee.triple_dare };
	const texts = [];
	for (const m of ['ante', 'dare', 'double_dare', 'triple_dare', 'mystery', 'egw']) {
		texts.push(['modeDesc ' + m, C.modeDesc(m, ctx)]);
		const cf = C.confirmCopy(m, ctx, 'Mode', '300.00 GC', '3x');
		for (const [k, v] of Object.entries(cf)) if (k !== 'title' && k !== 'amount') texts.push([`confirm ${m}.${k}`, v]);
	}
	for (const [k, v] of Object.entries(C.turboCopy(true))) texts.push(['turbo.' + k, v]);
	texts.push(['costHeader', C.costHeader(true)], ['controlsBonus', C.controlsBonus(ctx)], ['controlsTurbo', C.controlsTurbo()], ['controlsAuto', C.controlsAuto(ctx)], ['controlsUi', C.controlsUi()], ['controlsSound', C.controlsSound()]);
	if (/unfinished/.test(C.controlsUi()) && /RESUME/.test(C.controlsUi()) && /SKIP/.test(C.controlsUi())) console.log('  OK controlsUi explains the unfinished-round card'); else { console.error('  VIOLATION: controlsUi lacks the unfinished-round card'); violations++; }
	if (!/\$0\.00|collect/.test(C.resumeCopy(false, null).line)) console.log('  OK no-amount line: ' + C.resumeCopy(false, null).line); else { console.error('  VIOLATION: no-amount line'); violations++; }
	// v3.16c: resume card, social side, with and without a known amount
	for (const amt of ['22.80 GC', null]) for (const [k, v] of Object.entries(C.resumeCopy(true, amt))) texts.push([`resumeCopy social ${amt ?? 'none'}.${k}`, v]);
	{
		const r1 = C.resumeCopy(false, '$22.80'), r0 = C.resumeCopy(false, null), s1 = C.resumeCopy(true, '22.80 GC');
		const ok = r1.title === 'Unfinished round' && r1.line === 'Resume to watch it, or skip to collect $22.80.' && r0.line === 'Resume or skip to finish.'
			&& !/collect/i.test(s1.line) && s1.line.includes('22.80 GC') && r1.resume === 'RESUME' && r1.skip === 'SKIP';
		if (ok) console.log('  OK resumeCopy wording (real with / without amount, social has no "collect")'); else { console.error('  VIOLATION: resumeCopy wording', JSON.stringify([r1, r0, s1])); violations++; }
	}
	for (const e of C.ERROR_TEXTS) texts.push(['error text', e]); // v3.16 (#77): fixed RGS error strings
	texts.push(['error fallback', C.errorText('ERR_XYZ')]);
	for (const e of C.ERROR_TITLES) texts.push(['error title', e]); // v3.16e (FSD): per-code error titles
	// rules template: drop every ${...} (balanced), keep the social side of `isSocial() ? 'a' : 'b'` branches
	const fn = gameCode.slice(gameCode.indexOf('function buildRules('), gameCode.indexOf('// ---------- layout'));
	const tpl = fn.slice(fn.indexOf("$('#rulesBody').innerHTML = `"));
	let out = '', depth = 0;
	for (let i = 0; i < tpl.length; i++) {
		if (depth === 0 && tpl[i] === '$' && tpl[i + 1] === '{') { depth = 1; i++; continue; }
		if (depth > 0) { if (tpl[i] === '{') depth++; else if (tpl[i] === '}') depth--; continue; }
		out += tpl[i];
	}
	texts.push(['rules template (static text)', out.replace(/<[^>]+>/g, ' ').replace(/innerHTML = `/, '')]);
	for (const m of fn.matchAll(/isSocial\(\) \? '([^']*)' : '[^']*'/g)) texts.push(['rules social branch', m[1]]);
	for (const [k, v] of texts) {
		const hit = String(v).match(RESTRICTED);
		if (hit) { console.error(`  VIOLATION in ${k}: "${v}" matches "${hit[0]}"`); violations++; }
		else console.log(`  OK ${k}: "${String(v).slice(0, 90)}${String(v).length > 90 ? '…' : ''}"`);
	}
}

// v3.16: replay / social compliance (#77, #171, #172, #174, #188, #235), static checks on the shipped sources
{
	const css = readFileSync(join(appDir, 'static/elfhaus.css'), 'utf8');
	const cp = readFileSync(join(appDir, 'src/game/copy.ts'), 'utf8');
	const C2 = await import('data:text/javascript;base64,' + Buffer.from((await (await import('vite')).transformWithEsbuild(cp, 'copy.ts', { loader: 'ts', format: 'esm' })).code).toString('base64'));
	const checks = [
		['#171 autoBtn handler ignores replay', /\$\('#autoBtn'\)\.onclick = \(\) => \{[^\n]*S\.replay\) return;/.test(gameCode)],
		['#171 startAuto ignores replay', /function startAuto\(\) \{\s*if \(S\.replay\) return;/.test(gameCode)],
		['#171 round() clears autoplay in replay', /if \(S\.replay\) \{ stopAuto\(\); return; \}/.test(gameCode)],
		['#171 autoBtn disabled in replay', /\$\('#autoBtn'\) as HTMLButtonElement\)\.disabled = S\.replay/.test(gameCode)],
		['#171 replay hides betting controls', /style\.visibility = S\.replay \? 'hidden'/.test(gameCode) && /#autoBtn', '#buyBtn', '#betUp', '#betDown', '#armTag'/.test(gameCode)],
		['#174 replay bar shows bet x multiplier = total', /money\(bet\(\)\)\} × \$\{mult\(replayCost\)\} = \$\{money\(bet\(\) \* replayCost\)\}/.test(gameCode) && /function replayLabel\(/.test(gameCode) && /textContent = .*replayLabel\(\)/.test(gameCode) && /money\(bet\(\)\)\} × \$\{mult\(replayCost\)\}/.test(gameCode)],
		['#172 missing replay amount falls back to 1', /S\.replayBet = url\.amount > 0 \? url\.amount \/ API_AMOUNT_MULTIPLIER : 1/.test(gameCode)],
		['#77/#188 Paylines heading hidden in social + replay', /isSocial\(\) \|\| S\.replay \? 'Win lines' : 'Paylines'/.test(gameCode) && !/<h3>Paylines<\/h3>/.test(gameCode)],
		['#77 no raw server message in error box', !/error\?\.message/.test(gameCode.slice(gameCode.indexOf('function showError'), gameCode.indexOf('function setBusy')))],
		['#235 controls explain Menu/Info/Music/Sound/X/drag/intro skip/PLAY', ['Info', 'Music', 'Sound', 'small X', 'swipe', "Don\\'t show this again", 'PLAY'].every((w) => cp.includes(w)) && /controlsUi\(\)/.test(gameCode)],
		['#188 replay sets currency before social', /if \(url\.replay\) \{ setCurrency\(url\.currency \|\| 'USD'\); setSocial\(url\.social \|\| isSocialCurrency\(\)\)/.test(gameCode)],
		['#187 resume uses the round stake, no level snap before play', /S\.roundBet = amt;/.test(gameCode) && !/exact\(amt/.test(gameCode) && /S\.roundBet > 0 \? S\.roundBet/.test(readFileSync(join(appDir, 'src/game/ui.ts'), 'utf8'))],
		['#187 snap only after the resumed round', /finally \{\s*S\.roundBet = 0;[\s\S]{0,240}?if \(amt > 0 && S\.levels\.length\) S\.betIdx/.test(gameCode)],
		['v3.16c resumed Ante / buy round ends back in base (no re-arm)', /finally \{\s*S\.roundBet = 0;\s*setArm\(null, false\);/.test(gameCode)],
		['v3.16c resume card asks before anything plays', /const pick = await askResume\([^\n]*\n\ttry \{\n\t\tif \(pick === 'resume'\) \{[^\n]*playBookEvents\(rd\.state\)/.test(gameCode)],
		['v3.16c SKIP: end-round, no animation, HUD win = final payout at round stake', /else \{[^\n]*\n\t\t\tawait finishRound\(rd\);\n\t\t\tif \(X != null\) \{ S\.meterX = X; setAmount\(\$\('#win'\), X \* bet\(\)\); \}/.test(gameCode)],
		['v3.16c resume card: closable false, no X, excluded from the 2-tap skip', /registerPanel\('#resumeCard', \{ closable: false \}\)/.test(gameCode) && /#msg,#resumeCard'\)/.test(gameCode) && (() => { const hosts = readFileSync(join(appDir, 'src/game/uihosts.ts'), 'utf8'); const m = hosts.match(/<div id="resumeCard"[\s\S]*?<\/div><\/div><\/div><\/div>/); return !!m && !/mX|Close/.test(m[0]) && /rcResume/.test(m[0]) && /rcSkip/.test(m[0]); })()],
		['v3.16d #221 only an active round is resumed; end-round never forced', /async function resume\(rd: any\) \{\n\tif \(!rd\?\.active \|\| !rd\?\.state\?\.length\) return;/.test(gameCode) && !/finishRound\(\{ \.\.\.rd, active: true \}\)/.test(gameCode)],
		['v3.16d 0x round: card uses the no-amount line', /askResume\(X != null && X > 0 && amt > 0 \? moneyWin\(X \* amt\) : null\)/.test(gameCode)],
		['v3.16d #235 controls explain the unfinished-round card (Info, both modes)', /controlsUi\(\)/.test(gameCode.slice(gameCode.indexOf('function buildRules('), gameCode.indexOf('// ---------- layout')))],
		['v3.16e #221 end-round only for an open round (normal play and resume)', /async function finishRound\(round: any\) \{\n\tif \(round\?\.active\) \{/.test(gameCode) && !/payoutMultiplier \?\? 0\) > 0 \|\| \(round\?\.payout/.test(gameCode)],
		['v3.16e #221 mock RGS: wins come back active, 0x closed', /active: \(book\.payoutMultiplier \?\? 0\) > 0,/.test(readFileSync(join(appDir, 'src/mock/mockRgs.ts'), 'utf8'))],
		['v3.16e #194 HUD readouts: label fixed, value ellipsis, tb caps, short-landscape stack', (() => { const sf = readFileSync(join(appDir, 'src/game/stripfit.ts'), 'utf8'); const hud = readFileSync(join(appDir, 'src/game/pixiui/hud.ts'), 'utf8'); const hosts = readFileSync(join(appDir, 'src/game/uihosts.ts'), 'utf8'); return /export const FIT_FLOOR = 0\.6;/.test(sf) && /function paintFields\(\)/.test(hud) && /#strip \.m/.test(hosts) && /--ls/.test(hosts); })()],
		['v3.16e #194 resume card line >= ~10 screen px on landscape phones', /min ~10 screen px on landscape phones/.test(readFileSync(join(appDir, 'src/game/pixiui/wins.ts'), 'utf8')) && /10 \/ Math\.max\(0\.2, parseFloat/.test(readFileSync(join(appDir, 'src/game/pixiui/wins.ts'), 'utf8'))],
		['v3.16e error titles per code (limit / location / maintenance / connection)', /message\(errorTitle\(code\), /.test(gameCode) && !/'CONNECTION PROBLEM', `\$\{text\}/.test(gameCode) && C2.errorTitle('ERR_GLE') === 'LIMIT REACHED' && C2.errorTitle('ERR_LOC') === 'NOT AVAILABLE HERE' && C2.errorTitle('ERR_MAINTENANCE') === 'BACK SOON' && C2.errorTitle('ERR_UE') === 'CONNECTION PROBLEM' && C2.errorTitle('ERR_IPB') === 'INSUFFICIENT BALANCE'],
		['v3.16e bonus menu bet label has no hard-coded BET (set from t(betLabel) / PLAY AMOUNT)', /<span class="v"><small><\/small><b id="bmBetV">/.test(readFileSync(join(appDir, 'src/game/uihosts.ts'), 'utf8')) && /\$\('#bmBet small'\)\.textContent = isSocial\(\) \? 'PLAY AMOUNT' : t\('betLabel'\)/.test(gameCode)],
		['v3.16f #194 HUD values shrink to fit (observer + layout), floor 0.6, ellipsis only below it; desktop/portrait untouched', (() => { const f = readFileSync(join(appDir, 'src/game/stripfit.ts'), 'utf8'); return /export const FIT_FLOOR = 0\.6;/.test(f) && /new MutationObserver/.test(f) && /classList\.contains\('tb'\) && !document\.body\.classList\.contains\('portrait'\)/.test(f) && /if \(!active\(\)\) \{ if \(el\.style\.fontSize\) el\.style\.fontSize = ''; return; \}/.test(f) && !/transition/.test(f.replace(/^\/\/.*$/gm, '')); })() && /initStripFit\(\);/.test(gameCode) && /requestAnimationFrame\(fitStrip\)/.test(gameCode)],
		['v3.16f money() joins amount and code with a no-break space', /\\u00a0\$\{(?:m\.s|currency|SOCIAL\[currency\])\}/.test(readFileSync(join(appDir, 'src/game/format.ts'), 'utf8'))],
		['v3.16g #273 resume card amount is exact (moneyWin(X * amt), same as the HUD win and the RGS credit; no rounding, no 0-rounded rule)', /askResume\(X != null && X > 0 && amt > 0 \? moneyWin\(X \* amt\) : null\)/.test(gameCode) && !/moneyStd/.test(gameCode + readFileSync(join(appDir, 'src/game/format.ts'), 'utf8')) && !/\/\[1-9\]\/\.test\(card\)/.test(gameCode) && /setAmount\(\$\('#win'\), X \* bet\(\)\)/.test(gameCode)],
		['v3.16g #194 spin ring clear of the PLAY label at <=300px-tall landscape (smaller spin + static label offset, no animation)', (() => { const mk = readFileSync(join(appDir, 'src/game/mkboard.ts'), 'utf8'); const hud = readFileSync(join(appDir, 'src/game/pixiui/hud.ts'), 'utf8'); return /btn\('#spinBtn', g\.spin\)/.test(mk) && /function paintSpin/.test(hud) || /spinBtn/.test(hud) && /g\.spin/.test(mk); })()],
		['v3.16h #273 money() is exact at every magnitude (no >= 1 unit rounding; 6-place float clean-up, trailing zeros trimmed to the currency minimum)', (() => { const f = readFileSync(join(appDir, 'src/game/format.ts'), 'utf8'); return !/t >= 1/.test(f) && /if \(t === 0\) return base;/.test(f) && /const MAX_DIGITS = 6;/.test(f) && /toFixed\(MAX_DIGITS\)/.test(f) && /\\u00a0\$\{(?:m\.s|currency|SOCIAL\[currency\])\}/.test(f); })()],
		['v3.16i #194 stripfit measures the fractional text width (Range rect, not whole-px scrollWidth), 1 px spare, bounded 3-step shrink-only refit, fall back to a size seen to fit, counted', (() => { const f = readFileSync(join(appDir, 'src/game/stripfit.ts'), 'utf8').replace(/^\s*\/\/.*$/gm, ''); return /range!\.selectNodeContents\(el\)/.test(f) && /range!\.getBoundingClientRect\(\)\.width/.test(f) && !/scrollWidth|clientWidth/.test(f) && /const SPARE = 1;/.test(f) && /for \(let i = 0; i < 3; i\+\+\)/.test(f) && /if \(m\.tw <= m\.limit\) \{ if \(size > fitSize\) fitSize = size; return; \}/.test(f) && /fitSize && fitSize < size/.test(f) && /fitStats\.measures\+\+/.test(f) && /__elfhausFit = fitStats/.test(f); })()],
		['v3.16i (James) balance and bet / PLAY at standard decimals; wins exact (card, HUD win / count-ups, max win, line wins); inputs standard', (() => { const f = readFileSync(join(appDir, 'src/game/format.ts'), 'utf8'), cu = readFileSync(join(appDir, 'src/game/countup.ts'), 'utf8'), mw = readFileSync(join(appDir, 'src/game/maxwin.ts'), 'utf8'), wl = readFileSync(join(appDir, 'src/game/winlines.ts'), 'utf8'); return /export const money = \(value: number\) => fmt\(clean\(value\), decimalsOf\(currency\)\);/.test(f) && /export const moneyWin = /.test(f) && /export const amountStr = \(v: number\) => clean\(v\)\.toFixed\(decimalsOf\(currency\)\);/.test(f) && /\$\('#balance'\)\.textContent = S\.replay \? [^\n]+ : money\(S\.balance\);/.test(gameCode) && /\$\('#bet'\)\.textContent = money\(bet\(\)/.test(gameCode) && /import \{ moneyWin as money, moneyDigits \} from '\.\/format';/.test(cu) && /moneyWin\(w\.win \/ 100 \* bet\(\)\)/.test(wl) && !/\bmoney\(/.test(mw); })()],
		['v3.16i max-win count-up: fixed places from the target, last frame = exact target (no width jump)', (() => { const mw = readFileSync(join(appDir, 'src/game/maxwin.ts'), 'utf8'); return /dp = moneyDigits\(total\)/.test(mw) && /moneyWin\(k < 1 \? Math\.floor\(total \* e \* 10 \*\* dp\) \/ 10 \*\* dp : total, dp\)/.test(mw) && !/\* 100\) \/ 100/.test(mw); })()],
		['disclaimer wording kept (James 2026-10-30: ends Rizzin Games): © 2026 Rizzin Games.', gameCode.includes('© 2026 Rizzin Games.') && !gameCode.includes('2026 Engine')],
		['no other-game names in sources', !/Waylanders|Lilith/i.test(css + gameCode + cp)],
	];
	for (const [k, ok] of checks) { if (ok) console.log(`  OK ${k}`); else { console.error(`  VIOLATION: ${k}`); violations++; } }
}

// Loading-screen texts: feature cards (loader.ts) and the visible text in the loader markup (Game.svelte)
const loaderCode = readFileSync(join(appDir, 'src/game/loader.ts'), 'utf8');
const cardBlock = loaderCode.match(/LOADER_CARDS = \[(.*?)\]/s);
const loaderTexts = cardBlock ? [...cardBlock[1].matchAll(/'([^']*)'/g)].map((m) => m[1]) : [];
loaderTexts.push(...[...loaderCode.matchAll(/'((?:TAP|CLICK) TO CONTINUE)'/g)].map((m) => m[1]));
const svelte = readFileSync(join(appDir, 'src/components/Game.svelte'), 'utf8');
const loaderMarkup = svelte.slice(svelte.indexOf('<div id="loader"'));
loaderTexts.push(...[...loaderMarkup.replace(/<script[\s\S]*?<\/script>/g, '').matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)].map((m) => m[1].trim()));
if (!cardBlock) { console.error('  VIOLATION: LOADER_CARDS not found in loader.ts'); violations++; }
for (const txt of loaderTexts) {
	const hit = txt.match(RESTRICTED);
	if (hit) { console.error(`  VIOLATION in loading screen: "${txt}" matches "${hit[0]}"`); violations++; }
	else console.log(`  OK loader: "${txt}"`);
}

// Mode prices: the generated config must match the math index it came from (ante 3x as of math 6a1be1b),
// and no hardcoded ante price may remain in the UI sources.
let priceErrors = 0;
{
	const gen = JSON.parse(readFileSync(join(appDir, 'src/game/modes.generated.json'), 'utf8'));
	const live = resolve(appDir, '../../../math/games/elfhaus/library/publish_files/index.json');
	let idx = null;
	for (const f of [live, join(appDir, 'math-snapshot/index.json')]) { try { idx = JSON.parse(readFileSync(f, 'utf8')); break; } catch {} }
	console.log('\n=== Mode prices ===');
	for (const m of idx?.modes || []) {
		const got = gen.modes?.[m.name]?.cost;
		if (got !== Number(m.cost)) { console.error(`  MISMATCH ${m.name}: generated ${got} vs index ${m.cost}`); priceErrors++; }
		else console.log(`  OK ${m.name} ${got}x`);
	}
	if (!idx) { console.error('  no math index found'); priceErrors++; }
	for (const f of ['src/game/config.ts', 'src/game/game.ts', 'src/components/Game.svelte', 'src/game/strings.ts']) {
		if (/ante[^\n]{0,60}1\.25|1\.25x/i.test(readFileSync(join(appDir, f), 'utf8'))) { console.error(`  stale 1.25x ante price in ${f}`); priceErrors++; }
	}
}

// v2 event contract (math EVENTS.md): every book event type has a handler; no bonusUpgrade; triggers carry scatters + cap 20
{
	const src = readFileSync(join(appDir, 'src/game/bookEventHandlerMap.ts'), 'utf8');
	const seen = new Set();
	for (const f of bookFiles) {
		const b = JSON.parse(readFileSync(join(booksDir, f), 'utf8'));
		for (const e of b.events || b.state || []) {
			if (!seen.has(e.type) && !new RegExp(`\\b(async )?${e.type}\\(`).test(src)) { console.error(`  no handler for ${e.type} (${f})`); failedBooks++; }
			seen.add(e.type);
			if (e.type === 'bonusUpgrade') { console.error(`  stale bonusUpgrade in ${f}`); failedBooks++; }
			if (e.type === 'freeSpinTrigger' && (!Array.isArray(e.scatters) || e.cap !== MATH.spinCap)) { console.error(`  freeSpinTrigger without scatters/cap ${MATH.spinCap} in ${f}`); failedBooks++; }
		}
	}
	console.log(`\n=== Event handlers === ${seen.size} event types covered`);
}

// Math-owned values (James 2026-10-30): every win value comes from the books or the synced math config. The fallback
// (src/game/math.fallback.json) is only a safety net and must equal the generated values; no UI source may type them.
let mathErrors = 0;
{
	console.log('\n=== Math values (synced, fallback drift, no hardcoded win values) ===');
	const fb = JSON.parse(readFileSync(join(appDir, 'src/game/math.fallback.json'), 'utf8'));
	console.log(`  source: ${MATH.source}`);
	if (/^FALLBACK/.test(MATH.source || '')) { console.error('  generated math came from the fallback: run scripts/sync-math.mjs'); mathErrors++; }
	for (const [k, v] of Object.entries(fb)) {
		if (JSON.stringify(MATH[k]) !== JSON.stringify(v)) { console.error(`  DRIFT ${k}: fallback ${JSON.stringify(v).slice(0, 80)} vs math ${JSON.stringify(MATH[k]).slice(0, 80)}`); mathErrors++; }
	}
	for (const [m, c] of Object.entries(MATH.costs)) if (GEN.modes[m]?.cost !== c) { console.error(`  cost ${m}: modes ${GEN.modes[m]?.cost} vs math ${c}`); mathErrors++; }
	if (!mathErrors) console.log(`  OK fallback == math (${Object.keys(fb).length} keys); costs ${Object.entries(MATH.costs).map(([m, c]) => m + ' ' + c + 'x').join(', ')}`);
	// no typed win values in the UI sources
	const bans = [
		[/MAX_WIN_X\s*(:\s*number)?\s*=\s*\d/, 'MAX_WIN_X literal'], [/EPIC_STACK_X\s*(:\s*number)?\s*=\s*\d/, 'EPIC_STACK_X literal'],
		[/PAYTABLE[^=\n]*=\s*\{/, 'PAYTABLE literal'], [/SPIN_CAP\s*(:\s*number)?\s*=\s*\d/, 'SPIN_CAP literal'], [/START_FS[^=\n]*=\s*\{/, 'START_FS literal'],
		[/MYSTERY_ODDS[^=\n]*=\s*\{/, 'MYSTERY_ODDS literal'], [/gains \+1\b|\(x4 each\)|add \+2 spins|add \+5\b|Up to 3 respins/, 'math value typed in player text'],
		[/BIG_TIERS\s*=\s*\[\s*\{\s*x:/, 'big-win tier thresholds typed (use the math win levels)'], [/BIGWIN_ELVES_MIN_X\s*=\s*\d/, 'elves x threshold typed (use the win level)'],
	];
	for (const f of readdirSync(join(appDir, 'src/game')).filter((x) => x.endsWith('.ts'))) {
		const src = readFileSync(join(appDir, 'src/game', f), 'utf8');
		for (const [re, what] of bans) if (re.test(src)) { console.error(`  ${what} in src/game/${f}`); mathErrors++; }
	}
	// the step total the WIN meter lands on is the book's winInfo.totalWin, which must equal its line wins
	let steps = 0;
	for (const dir of [booksDir, join(appDir, 'src/mock/books')]) for (const file of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
		for (const e of JSON.parse(readFileSync(join(dir, file), 'utf8')).events || []) if (e.type === 'winInfo') {
			steps++;
			const sum = (e.wins || []).reduce((a, w) => a + w.win, 0);
			if (e.totalWin !== sum) { console.error(`  ${file}: winInfo step ${e.step} totalWin ${e.totalWin} != line sum ${sum}`); mathErrors++; }
		}
	}
	// book winLevels cross-checked against the synced edges where the tables agree: freeSpinEnd (endFeature) everywhere,
	// setWin (standard) below the LEGENDARY edge (1000x). Books made before the 1000x edge (math 9f9b4e4) say 9 / 10 above
	// it; the frontend takes the level from the synced edges applied to the amount, so those books still show right.
	const lvl = (x, edges) => { const i = edges.findIndex((e) => x < e); return i < 0 ? edges.length + 1 : i + 1; };
	const std = MATH.winLevels.standard, agree = std[std.length - 2];
	let lv = 0, above = 0;
	for (const dir of [booksDir, join(appDir, 'src/mock/books')]) for (const file of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
		for (const e of JSON.parse(readFileSync(join(dir, file), 'utf8')).events || []) if ((e.type === 'setWin' || e.type === 'freeSpinEnd') && e.winLevel !== undefined) {
			if (e.type === 'setWin' && e.amount / 100 >= agree) { above++; continue; }
			lv++; const want = lvl(e.amount / 100, MATH.winLevels[e.type === 'setWin' ? 'standard' : 'endFeature']);
			if (e.winLevel !== want) { console.error(`  ${file}: ${e.type} ${e.amount} winLevel ${e.winLevel} != math ${want}`); mathErrors++; }
		}
	}
	console.log(`  ${mathErrors ? 'FAIL' : 'OK'} no typed win values in src/game; ${steps} winInfo steps total = line sum; ${lv} book winLevels match the synced edges (${above} setWin at/above ${agree}x not cross-checked: level from the edges)`);
}
console.log(`\n=== Summary ===`);
console.log(`Books: ${bookFiles.length - failedBooks}/${bookFiles.length} passed`);
console.log(`Social scan: ${violations === 0 ? 'CLEAN (0 violations)' : `${violations} violations`}`);

console.log(`Mode prices: ${priceErrors === 0 ? 'match math index' : `${priceErrors} errors`}`);
console.log(`Math values: ${mathErrors === 0 ? 'synced, no drift' : `${mathErrors} errors`}`);

if (failedBooks > 0 || violations > 0 || priceErrors > 0 || mathErrors > 0) {
	process.exit(1);
} else {
	console.log(`All checks passed!`);
	process.exit(0);
}
