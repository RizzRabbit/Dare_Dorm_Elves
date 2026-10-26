// Test runner: validates that every fixture book plays end-to-end and the win meter settles on finalWin.
// Also performs the social-mode word scan across UI strings, generated rules, and templates.
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const appDir = resolve(import.meta.dirname, '..');
const booksDir = join(appDir, 'test-fixtures/books');
const bookFiles = readdirSync(booksDir).filter((f) => f.endsWith('.json'));

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
	const MAX_WIN_X = 50000;

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
			meterX = Math.min(MAX_WIN_X, Math.max(meterX, x));
			roundBase = x;
		} else if (ev.type === 'wincap') {
			meterX = MAX_WIN_X;
			reachedWincap = true;
		} else if (ev.type === 'finalWin') {
			const x = Math.min(ev.amount / 100, MAX_WIN_X);
			meterX = Math.min(MAX_WIN_X, Math.max(meterX, x));
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

// v3.15f: Epic ('hidden') starts with START_FS.hidden free spins and its guaranteed stacks start at EPIC_STACK_X
{
	const cfg = readFileSync(join(appDir, 'src/game/config.ts'), 'utf8');
	const startFs = Number(cfg.match(/START_FS = \{[^}]*hidden:\s*(\d+)/)[1]), stackX = Number(cfg.match(/EPIC_STACK_X = (\d+)/)[1]);
	console.log(`\n=== 1b. Epic start: ${startFs} free spins, stacks from x${stackX} ===`);
	if (startFs !== 14 || stackX !== 6) { console.error(`  FAIL: config START_FS.hidden=${startFs}, EPIC_STACK_X=${stackX} (want 14, 6)`); failedBooks++; }
	let epics = 0;
	for (const dir of [booksDir, join(appDir, 'src/mock/books')]) for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
		const ev = JSON.parse(readFileSync(join(dir, file), 'utf8')).events || [];
		const trig = ev.find((e) => e.type === 'freeSpinTrigger' && e.tier === 'hidden');
		if (!trig) continue;
		epics++;
		const g = ev.find((e) => e.type === 'guaranteedStacks' && e.tier === 'hidden'), ufs = ev.find((e) => e.type === 'updateFreeSpin');
		const errs = [];
		if (trig.totalFs !== startFs) errs.push(`freeSpinTrigger.totalFs ${trig.totalFs}`);
		if (ufs && ufs.total !== startFs) errs.push(`first updateFreeSpin.total ${ufs.total}`);
		if (g && g.stacks.some((st) => st.value < stackX)) errs.push(`guaranteedStacks values ${g.stacks.map((st) => st.value)}`);
		if (g && g.stacks.some((st) => !g.locked.fullReels.some((f) => f.reel === st.reel && f.value === st.value))) errs.push('stack missing from locked.fullReels');
		if (errs.length) { console.error(`  FAIL: ${file}: ${errs.join('; ')}`); failedBooks++; }
		else console.log(`  PASS: ${file.padEnd(24)} totalFs=${trig.totalFs}, stacks x${g ? g.stacks.map((st) => st.value).join(', x') : '-'}`);
	}
	if (!epics) { console.error('  FAIL: no Epic books found'); failedBooks++; }
}

// v3.15g: after a wincap the TOTAL WIN outro is skipped (freeSpinEnd returns early) and finalWin lands on the cap
{
	const src = readFileSync(join(appDir, 'src/game/bookEventHandlerMap.ts'), 'utf8');
	console.log(`\n=== 1c. Max win skips the TOTAL WIN outro ===`);
	const ok = /async wincap\(\) \{ capHit = true;/.test(src) && /async freeSpinEnd\(ev\) \{\s*if \(capHit\) \{ endBonusUi\(\); return; \}/.test(src) && /S\.roundBase = 0; capHit = false;/.test(src);
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
		if (!fw || Math.min(fw.amount / 100, 50000) !== 50000) errs.push(`finalWin ${fw && fw.amount}`);
		if (errs.length) { console.error(`  FAIL: ${file}: ${errs.join('; ')}`); failedBooks++; }
		else console.log(`  PASS: ${file.padEnd(24)} outro ${fe >= 0 ? 'skipped' : 'n/a (no FS)'}, finalWin 50000x`);
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
	const WANT = 'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Engine.';
	const src = disclaimerMatch?.[1];
	if (src === WANT) console.log('  OK DISCLAIMER source is the exact approved text');
	else { console.error('  VIOLATION: DISCLAIMER source differs from the approved text'); violations++; }
	const dir = join(appDir, 'build/_app/immutable');
	let bundles = [];
	try { bundles = readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith('.js')).map((f) => readFileSync(join(dir, String(f)), 'utf8')); } catch {}
	const esc = WANT.replace('©', '\\xA9'), esc2 = WANT.replace('©', '\\u00A9');
	if (bundles.some((b) => b.includes(WANT) || b.includes(esc) || b.includes(esc2))) console.log('  OK DISCLAIMER exact text present in the build');
	else { console.error('  VIOLATION: exact DISCLAIMER text not found in build/_app/immutable (build first)'); violations++; }
}

// v3.13: copy.ts (bonus confirm cards, Turbo toggle, mode descriptions, cost-related rules lines) rendered in social
// mode for every mode, and the static text of the rules template in game.ts (buildRules) with its social branches.
{
	const { transformWithEsbuild } = await import('vite');
	const cs = readFileSync(join(appDir, 'src/game/copy.ts'), 'utf8');
	const { code } = await transformWithEsbuild(cs, 'copy.ts', { loader: 'ts', format: 'esm' });
	const C = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
	const ctx = { social: true, anteX: '3x', anteOdds: 'about 1 in 68', baseOdds: 'about 1 in 190', fs: { dare: 8, double_dare: 10, triple_dare: 10 }, odds: { none: 50, double_dare: 37, triple_dare: 10, hidden: 3 } };
	const texts = [];
	for (const m of ['ante', 'dare', 'double_dare', 'triple_dare', 'mystery', 'egw']) {
		texts.push(['modeDesc ' + m, C.modeDesc(m, ctx)]);
		const cf = C.confirmCopy(m, ctx, 'Mode', '300.00 GC', '3x');
		for (const [k, v] of Object.entries(cf)) if (k !== 'title' && k !== 'amount') texts.push([`confirm ${m}.${k}`, v]);
	}
	for (const [k, v] of Object.entries(C.turboCopy(true))) texts.push(['turbo.' + k, v]);
	texts.push(['costHeader', C.costHeader(true)], ['controlsBonus', C.controlsBonus(ctx)], ['controlsTurbo', C.controlsTurbo()], ['controlsAuto', C.controlsAuto(ctx)], ['controlsUi', C.controlsUi()]);
	// v3.16c: resume card, social side, with and without a known amount
	for (const amt of ['22.80 GC', null]) for (const [k, v] of Object.entries(C.resumeCopy(true, amt))) texts.push([`resumeCopy social ${amt ?? 'none'}.${k}`, v]);
	{
		const r1 = C.resumeCopy(false, '$22.80'), r0 = C.resumeCopy(false, null), s1 = C.resumeCopy(true, '22.80 GC');
		const ok = r1.title === 'Unfinished round' && r1.line === 'Resume to watch it, or skip to collect $22.80.' && r0.line === 'Resume or skip to collect.'
			&& !/collect/i.test(s1.line) && s1.line.includes('22.80 GC') && r1.resume === 'RESUME' && r1.skip === 'SKIP';
		if (ok) console.log('  OK resumeCopy wording (real with / without amount, social has no "collect")'); else { console.error('  VIOLATION: resumeCopy wording', JSON.stringify([r1, r0, s1])); violations++; }
	}
	for (const e of C.ERROR_TEXTS) texts.push(['error text', e]); // v3.16 (#77): fixed RGS error strings
	texts.push(['error fallback', C.errorText('ERR_XYZ')]);
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
	const checks = [
		['#171 autoBtn handler ignores replay', /\$\('#autoBtn'\)\.onclick = \(\) => \{[^\n]*S\.replay\) return;/.test(gameCode)],
		['#171 startAuto ignores replay', /function startAuto\(\) \{\s*if \(S\.replay\) return;/.test(gameCode)],
		['#171 round() clears autoplay in replay', /if \(S\.replay\) \{ stopAuto\(\); return; \}/.test(gameCode)],
		['#171 autoBtn disabled in replay', /\$\('#autoBtn'\) as HTMLButtonElement\)\.disabled = S\.replay/.test(gameCode)],
		['#171 replay hides betting controls', /body\.replay #autoBtn,body\.replay #buyBtn,body\.replay #betUp,body\.replay #betDown/.test(css)],
		['#174 replay bar shows bet x multiplier = total', /money\(bet\(\)\)\} × \$\{mult\(replayCost\)\} = \$\{money\(bet\(\) \* replayCost\)\}/.test(gameCode) && (gameCode.match(/textContent = replayLabel\(\)/g) || []).length === 2],
		['#172 missing replay amount falls back to 1', /S\.replayBet = url\.amount > 0 \? url\.amount \/ API_AMOUNT_MULTIPLIER : 1/.test(gameCode)],
		['#77/#188 Paylines heading hidden in social + replay', /isSocial\(\) \|\| S\.replay \? 'Win lines' : 'Paylines'/.test(gameCode) && !/<h3>Paylines<\/h3>/.test(gameCode)],
		['#77 no raw server message in error box', !/error\?\.message/.test(gameCode.slice(gameCode.indexOf('function showError'), gameCode.indexOf('function setBusy')))],
		['#235 controls explain Menu/Info/Music/Sound/X/drag/intro skip/PLAY', ['Info', 'Music', 'Sound', 'small X', 'swipe', "Don\\'t show this again", 'PLAY'].every((w) => cp.includes(w)) && /controlsUi\(\)/.test(gameCode)],
		['#188 replay sets currency before social', /if \(url\.replay\) \{ setCurrency\(url\.currency \|\| 'USD'\); setSocial\(url\.social \|\| isSocialCurrency\(\)\)/.test(gameCode)],
		['#187 resume uses the round stake, no level snap before play', /S\.roundBet = amt;/.test(gameCode) && !/exact\(amt/.test(gameCode) && /S\.roundBet > 0 \? S\.roundBet/.test(readFileSync(join(appDir, 'src/game/ui.ts'), 'utf8'))],
		['#187 snap only after the resumed round', /finally \{\s*S\.roundBet = 0;[\s\S]{0,240}?if \(amt > 0 && S\.levels\.length\) S\.betIdx/.test(gameCode)],
		['v3.16c resumed Ante / buy round ends back in base (no re-arm)', /finally \{\s*S\.roundBet = 0;\s*setArm\(null, false\);/.test(gameCode)],
		['v3.16c resume card asks before anything plays', /const pick = await askResume\([^\n]*\n\ttry \{\n\t\tif \(pick === 'resume'\) \{[^\n]*playBookEvents\(rd\.state\)/.test(gameCode)],
		['v3.16c SKIP: end-round, no animation, HUD win = final payout at round stake', /else \{[^\n]*\n\t\t\tawait finishRound\(\{ \.\.\.rd, active: true \}\);\n\t\t\tif \(X != null\) \{ S\.meterX = X; setAmount\(\$\('#win'\), X \* bet\(\)\); \}/.test(gameCode)],
		['v3.16c resume card: closable false, no X, excluded from the 2-tap skip', /registerPanel\('#resumeCard', \{ closable: false \}\)/.test(gameCode) && /#msg,#resumeCard'\)/.test(gameCode) && (() => { const sv = readFileSync(join(appDir, 'src/components/Game.svelte'), 'utf8'); const m = sv.match(/<div id="resumeCard"[\s\S]*?<\/div><\/div><\/div><\/div>/); return !!m && !/mX|Close/.test(m[0]) && /rcResume/.test(m[0]) && /rcSkip/.test(m[0]); })()],
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
			if (e.type === 'freeSpinTrigger' && (!Array.isArray(e.scatters) || e.cap !== 20)) { console.error(`  freeSpinTrigger without scatters/cap 20 in ${f}`); failedBooks++; }
		}
	}
	console.log(`\n=== Event handlers === ${seen.size} event types covered`);
}
console.log(`\n=== Summary ===`);
console.log(`Books: ${bookFiles.length - failedBooks}/${bookFiles.length} passed`);
console.log(`Social scan: ${violations === 0 ? 'CLEAN (0 violations)' : `${violations} violations`}`);

console.log(`Mode prices: ${priceErrors === 0 ? 'match math index' : `${priceErrors} errors`}`);

if (failedBooks > 0 || violations > 0 || priceErrors > 0) {
	process.exit(1);
} else {
	console.log(`All checks passed!`);
	process.exit(0);
}
