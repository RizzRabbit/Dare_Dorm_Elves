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

console.log(`\n=== 2. Social-mode restricted word scan ===`);
// Scan strings, rules, and UI text in social mode
const RESTRICTED = /\b(bet|buy|pay|pays|paid|wager|cash|money)\b/i;

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

console.log(`\n=== Summary ===`);
console.log(`Books: ${bookFiles.length - failedBooks}/${bookFiles.length} passed`);
console.log(`Social scan: ${violations === 0 ? 'CLEAN (0 violations)' : `${violations} violations`}`);

if (failedBooks > 0 || violations > 0) {
	process.exit(1);
} else {
	console.log(`All checks passed!`);
	process.exit(0);
}
