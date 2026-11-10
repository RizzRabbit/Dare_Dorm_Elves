// One handler per design/EVENTS.md event (ported from prototype/app.js H). Handlers only display.
import { MAX_WIN_X, ROWS, REELS, WIN_LEVELS, TIER_LABEL, SPIN_CAP as MAX_FS, type Tier } from './config';
import { egwParts } from './egwParts';
import type { BookEvent, BookEventOf, BookEventType, Locked, Pos } from './typesBookEvent';
import { roxy, roxyState, roxySmile } from './roxy';
import { maxWinCelebration, preloadMaxWin } from './maxwin';
import { elvesLevel, preloadBigWinElves, LEGEND_ELVES_LEVEL } from './bigwinElves';
import { showRespin, endRespin, hideRespin } from './respin';
import { lockFx, clearSymWins, symLand, symWin } from './fx';
import { cardFlip } from './cardflip';
import { timing, isSpinning, startSpin, markStopped, sinceStart, sleep, spinMini, stopMini, stopReel, stopLead } from './reels';
import { $, S, k, bet, wait, titleHTML, banner, hideToast, bigWin, roundMinX, setWinMeter, clearLines, renderCell, renderOverlays, cellEl, setGem, ovMx, ovArt } from './ui';
import { playWins } from './winlines';
import { trailToMeter } from './wintrail';
import { puffWith } from './puff';
import { wildLand, wfExpand } from './wildfx';
import { setBg } from './bg';
import { stackIn, mergeIn, growIn, clearOvWins, flyGems } from './mergefx';
import { stackPrefetch } from './stacks';
import { frameIn } from './wildframe';
/** stack_form sheets decode ahead for reels with 2+ wilds that are not full yet (stacks.ts loads sheets on demand). */
const warmStacks = () => stackPrefetch(S.sym.flatMap((c, r) => (!S.full.has(r) && c.filter((x) => x === 'W').length >= 2 ? [r] : [])));
import { featOpen, featPop, featClose } from './featfx';
import { countTo, countMs, setAmount, skipCounts, BIG_TIERS, levelOf, WIN_EDGES } from './countup';
import { grab, combineInto, clearCoveredGems } from './combine';
import { tempo, hold, gtempo } from './tempo';
import { boardTease, boardPunch } from './boardfx';
import { sfx, loop, music, musicSting, stingInMs, beatSnapMs, duck, duckFor, playVoice, type Handle } from './audio';
import { voice, voiceSpin, teaseOk } from './voice';
import { payoutFlow } from './payoutFlow';
import { crumb, scrub, setPhase } from './diag';
import { bannerLevel } from './bannerLevel';
import { titleType, titleTypeMirror } from './titletype';
import { ninePanel, CARD, BTN, WINDOW } from './ninepanel';
// Pauses here use ui.wait: the old pace x ANIM_TEMPO, skippable by tap / Space (tempo.ts); turbo keeps its short values.

const scattersOnBoard = (): Pos[] => S.sym.flatMap((col, reel) => col.map((n, row) => ({ reel, row, n }))).filter((c) => c.n === 'S').map(({ reel, row }) => ({ reel, row }));
const TL = (t: Tier) => TIER_LABEL[t].toUpperCase();
const setFsTotal = (n: number) => { const el = $('#fsCount'); el.textContent = el.textContent!.replace(/\/ \d+/, '/ ' + n); };
const showFsBar = () => { setBg(true); S.inBonus = true; document.body.classList.add('inBonus'); $('#fsBar').classList.remove('hidden'); setPhase('bonus'); };
/** Scatter highlight: the Ski Passes play their win loop, everything else dims. */
async function showScatters(ps: Pos[], ms: number) {
	if (!ps.length) return;
	const on = new Set(ps.map((p) => k(p.reel, p.row)));
	for (let r = 0; r < REELS; r++) for (let row = 0; row < ROWS; row++) cellEl(r, row).classList.toggle('dim', !on.has(k(r, row)));
	ps.forEach((p) => { const c = cellEl(p.reel, p.row); c.classList.add('win', 'pulse'); symWin(c); });
	// motion pass: same flake trail to the WIN meter on a scatter trigger as on a line win
	trailToMeter([{ positions: ps }]);
	await wait(S.turbo ? ms / 2 : ms);
}
/** v3.14 retrigger card: big "+X" over "FREE SPINS" ("MAX 20" when the cap swallows the whole retrigger). Small and
 * light next to the FS intro. Opacity + a soft 0.92 -> 1 scale only: in 450 ms, out 350 ms (turbo: half). On screen
 * hold(800) = 1.6 s at board tempo 2 (turbo 0.8 s); a tap anywhere ends it early (game.ts pointerdown -> skipHolds). */
async function fsMoreCard(added: number) {
	const O = $('#fsMore'), card = O.querySelector<HTMLElement>('.card')!, big = O.querySelector<HTMLElement>('.fmBig')!;
	titleType(big, added > 0 ? `+${added}` : `MAX ${MAX_FS}`); O.dataset.max = added > 0 ? '' : '1';
	titleType(O.querySelector<HTMLElement>('.fmSub'), 'FREE SPINS'); ninePanel(card, CARD);   // the card's words in the title lettering (sprite glyphs)
	const calm = !matchMedia('(prefers-reduced-motion: reduce)').matches, f = S.turbo ? 0.5 : 1;
	const from = { opacity: 0, transform: calm ? 'scale(.92)' : 'none' }, to = { opacity: 1, transform: 'none' };
	O.classList.remove('hidden');
	O.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450 * f, easing: 'ease-out' });
	card.animate([from, to], { duration: 450 * f, easing: 'cubic-bezier(.2,.8,.3,1)' });
	await Promise.race([hold(800), new Promise<void>((res) => (O.onclick = () => res()))]);
	O.onclick = null;
	const out = { duration: 350 * f, easing: 'ease-in', fill: 'forwards' as const };
	O.animate([{ opacity: 1 }, { opacity: 0 }], out);
	await card.animate([to, { opacity: 0, transform: calm ? 'scale(.96)' : 'none' }], out).finished.catch(() => {});
	O.classList.add('hidden'); O.getAnimations().forEach((a) => a.cancel()); card.getAnimations().forEach((a) => a.cancel());
}
const unScatter = () => { document.querySelectorAll('.cell').forEach((c) => c.classList.remove('win', 'dim')); clearSymWins(); };
/** Wilds that stay for the bonus: lock them in place on the current board (no re-render, so nothing jumps). */
function lockCarried(l: Locked) {
	let fresh = false;
	l.singles.forEach((s) => { const c = cellEl(s.reel, s.row); if (!c.classList.contains('locked')) { c.classList.add('locked'); lockFx(c); fresh = true; } });
	if (fresh) sfx('wild_sticky_lock');
}
/** Bonus start card: resolves on START / a tap on the overlay (after a 300 ms guard against a leftover tap from the spin).
 *  v3.18b (James): no timed advance in manual play or in autoplay, turbo on or off. Only autoplay with AUTO-PLAY BONUS on
 *  passes `autoMs` (hands-free: the old pace, ui.wait). */
export function startGate(I: HTMLElement, autoMs = 0): Promise<void> {
	const shown = performance.now(); I.dataset.waiting = autoMs ? 'auto' : 'start';
	return new Promise<void>((res) => {
		const done = () => { I.onclick = null; delete I.dataset.waiting; res(); };
		I.onclick = () => { if (performance.now() - shown >= 300) done(); };
		if (autoMs) wait(autoMs).then(() => { if (I.dataset.waiting) done(); });
	});
}
/** v3.18b: autoplay with the AUTO-PLAY BONUS toggle on plays bonuses hands-free; otherwise every bonus waits for taps. */
const handsFree = () => S.auto > 0 && S.autoBonus;

export const endBonusUi = () => { music('base'); setBg(false); document.body.classList.remove('inBonus'); $('#fsBar').classList.add('hidden'); $('#intro').classList.add('hidden'); $('#fsMore').classList.add('hidden'); S.inBonus = false; setPhase('base'); };

/** EGW: the reels named by egwStart (reel -> stack value). The math sends them as already-locked full reels in the
 * next reveal; that reveal spins them like any other reel instead (they stop left to right with the normal settle and
 * land as four single wilds whose badges add up to the stack value, egwParts.ts). v3.17: from there EGW uses the base /
 * ante flow unchanged: playBookEvents (egwFlow) adds one ordinary stackComplete per EGW reel after the reveal, then the
 * book's mergeGroups and wins play as in any mode. No EGW-only animation path. */
let egwPending: Map<number, number> | null = null;
/** v3.15g (James): set by wincap; the max-win screen already showed the capped total, so freeSpinEnd skips its TOTAL WIN outro */
let capHit = false;

async function formStack(ev: { reel: number; value: number; instant?: boolean; parts?: number[] }, react = true) {
	// the four wild values ADD into the stack's value (SPEC: sum of the 4 cell values)
	const parts = ev.parts?.length === 4 ? ev.parts : [0, 1, 2, 3].map((row) => S.vals.get(k(ev.reel, row)) || 1);
	const flying = grab([0, 1, 2, 3].map((row) => cellEl(ev.reel, row).querySelector<HTMLElement>('.mx')));
	const render = (frameDelay = 0) => {
		S.full.set(ev.reel, ev.value);
		for (let row = 0; row < ROWS; row++) { S.vals.delete(k(ev.reel, row)); cellEl(ev.reel, row).style.visibility = 'hidden'; }
		renderOverlays(false);
		frameIn(document.querySelector<HTMLElement>(`.ov.full[data-reel="${ev.reel}"]`), frameDelay); // the stack lands: its frame draws in
		// the sum gem waits for the flying badges (flyGems shows it), no leftover cell badges over the elf
		if (!S.turbo && flying.length) { const g = ovMx(ev.reel); if (g) g.style.visibility = 'hidden'; }
	};
	sfx('wild_stack_merge', { throttle: 250 });
	if (ev.instant) render(); else await stackIn(ev.reel, render, react); // singles ease together → crossfade into the full-reel elf (turbo: squash → flash → pop)
	const mx = ovMx(ev.reel);
	if (mx) mx.style.visibility = '';
	await flyGems(flying, mx, parts, ev.value, ev.value >= 8, true, 'add');
	clearCoveredGems();
	await wait(250);
}

type Handlers = { [T in BookEventType]: (ev: BookEventOf<T>) => Promise<void> };
export const bookEventHandlerMap: Handlers = {
	// Reels stop left to right (reels.ts timing); the spin press already started the blur in base play, free spins
	// start it here. A reel flagged for anticipation holds a little longer before it stops (no text).
	async reveal(ev) {
		clearLines(); hideToast(); hideRespin();
		const lockedSingles = new Set(ev.locked.singles.map((s) => k(s.reel, s.row)));
		const egw = egwPending; egwPending = null;
		const fullLocked = new Set(ev.locked.fullReels.filter((f) => !egw?.has(f.reel)).map((f) => f.reel));
		if (!isSpinning()) startSpin((r, row) => fullLocked.has(r) || lockedSingles.has(k(r, row)));
		S.sym = ev.board.map((col) => col.slice(1, 1 + ROWS).map((s) => s.name));
		S.vals = new Map(); S.full = new Map();
		ev.locked.fullReels.forEach((f) => { if (!egw?.has(f.reel)) S.full.set(f.reel, f.value); });
		// merged groups whose stacks are all carried over stay merged (no re-merge animation every free spin)
		S.groups = S.groups.filter((g) => g.reels.every((r) => S.full.has(r))).map((g) => {
			const values = g.reels.map((r) => S.full.get(r)!); return { reels: g.reels, values, product: values.reduce((a, b) => a * b, 1) };
		});
		ev.board.forEach((col, r) => col.slice(1, 1 + ROWS).forEach((s, row) => { if (s.wild && !S.full.has(r)) S.vals.set(k(r, row), s.multiplier || 1); }));
		egw?.forEach((v, r) => egwParts(v, ROWS).forEach((p, row) => { S.sym[r][row] = 'W'; S.vals.set(k(r, row), p); }));
		renderOverlays(false); warmStacks();
		const T = timing();
		const ant = ev.anticipation.some((a) => a > 0);
		if (ant && ev.gameType === 'basegame') roxy('anticipation');
		// every reel gets an absolute settle time; reels.ts eases each one in (decel, overshoot, settle)
		// anticipation reels (math flags them once 2 Dare Cards have landed) each glow from the previous reel's stop,
		// hold an extra T.ant and brake slowly, one after another, so reel 5 always lands last
		let at = Math.max(T.first, sinceStart() + stopLead()), prev = at; // v3.17: late RGS answer = still staggered (reels.ts stopLead)
		const stops: Promise<void>[] = [];
		let riser: Handle | null = null, riserT = 0;
		// tease (James: longer, more dramatic): each teasing reel holds ~1 bar extra, the last ~2 bars of tease; turbo half.
		// Every teasing land is snapped onto a 150 BPM beat line of the music grid.
		const lastAnt = ev.anticipation.reduce((a, v, i) => (v > 0 ? i : a), -1);
		const hold = (r: number) => (S.turbo ? 0.5 : 1) * (r === lastAnt ? 2800 : 1600);
		for (let r = 0; r < REELS; r++) {
			prev = at;
			if (r > 0) at += T.gap;
			const slow = ev.anticipation[r] > 0 ? T.antD : 0;
			// the riser starts with the first slowed reel's glow and fades out on the last land
			if (slow && !riserT) riserT = window.setTimeout(() => { riser = loop('anticipation_riser', 0.9); boardTease(true); document.body.classList.add('teasing'); }, Math.max(0, prev - sinceStart()));
			if (slow) { at += hold(r); at += beatSnapMs(at - sinceStart()); }
			// each cell is rendered as its own spinner settles (the reel's still cells with its first stop); the
			// spinner already gave the landing its bounce, the tile its thud + glint, so no extra squash here
			stops.push(stopReel(r, at, (row) => {
				const locked = lockedSingles.has(k(r, row));
				renderCell(r, row, null);
				cellEl(r, row).classList.toggle('locked', locked);
				if (!locked && !fullLocked.has(r) && S.sym[r][row] === 'W') { wildLand(cellEl(r, row)); voice('wild', { reel: r }); }
				else if (S.sym[r][row] === 'S') symLand(cellEl(r, row));
			}, slow, prev));
		}
		await Promise.all(stops);
		clearTimeout(riserT); (riser as Handle | null)?.stop(150); if (riserT) boardTease(false); document.body.classList.remove('teasing');
		markStopped();
		await sleep(T.land);
		// EGW (v3.17, James: "the same flow as normal / ante"): nothing EGW-specific here any more. The EGW reels landed as
		// four single wilds like any reel; playBookEvents (egwFlow) follows this reveal with one ordinary stackComplete per
		// EGW reel, left to right, so they stack exactly like base / ante stacks, then the book's mergeGroups merges them.
	},
	async stackComplete(ev) { await formStack(ev); },
	async mergeGroups(ev) {
		// adjacent stacks MULTIPLY into one number per group (SPEC: product within a group)
		// each fresh group: anticipation → lean → hit (shockwave, burst, shake) → letters ignite →
		// the per-reel corner gems recombine into the group's one gem (mergefx.ts); tap / turbo snaps to the end state
		const fresh = ev.groups.filter((g) => !S.groups.find((o) => o.reels.join() === g.reels.join()));
		const apply = () => {
			S.groups = ev.groups.map((g) => ({ reels: [...g.reels], values: [...g.values], product: g.product })); renderOverlays(false);
			// at the hard cut (the group scales up under the fading bloom) each fresh group's frame draws in
			fresh.forEach((g) => frameIn([...document.querySelectorAll<HTMLElement>('.ov.merge')].find((o) => o.dataset.reels === g.reels.join()), 60));
		};
		if (!fresh.length) { apply(); return; }
		sfx('wild_stack_merge', { throttle: 250 }); // one per merge step (the fresh groups play together)
		let applied = false; const once = () => { if (!applied) { applied = true; apply(); } };
		await Promise.all(fresh.map((g) => mergeIn(g.reels, g.values, g.product, once)));
		once();
	},
	async winInfo(ev) {
		// one thin line at a time races along each payline; its amount ticks into WIN (winlines.ts); Roxy smiles on it
		if (ev.wins?.length) roxySmile();
		// chalet item 6: the line hit and the pop + snow puff play together (puff.ts puffWith, started by playWins as the
		// lines draw on); a following respin then refills the popped cells
		await playWins(ev.wins, S.roundBase, ev.totalWin, puffWith(ev.wins, boardNext));
	},
	async updateStepWin(ev) { setWinMeter(S.roundBase + ev.amount / 100); },
	async wildGrow(ev) {
		const before = S.groups.map((g) => ({ reels: g.reels.join(), values: [...g.values], product: g.product }));
		ev.changes.forEach((c) => {
			if (c.kind === 'full') {
				S.full.set(c.reel, c.to);
				S.groups.forEach((g) => { const i = g.reels.indexOf(c.reel); if (i >= 0) { g.values[i] = c.to; g.product = g.values.reduce((a, b) => a * b, 1); } });
			} else S.vals.set(k(c.reel, c.row), c.to);
		});
		renderOverlays(false);
		ev.changes.forEach((c) => {
			if (c.kind !== 'single') return;
			const el = cellEl(c.reel, c.row);
			setGem(el.querySelector('.mx'), c.to);
		});
		// a lone full reel ticks up by its grow step (+1, +2 in Powder Day) on its own corner gem (pop); a merged group splits into per-reel gems, ticks, recombines
		const grouped = new Set<number>(); S.groups.forEach((g) => g.reels.forEach((r) => grouped.add(r)));
		ev.changes.forEach((c) => { if (c.kind === 'full' && !grouped.has(c.reel)) setGem(ovMx(c.reel), c.to); });
		const grows = S.groups.map((g) => {
			const old = before.find((o) => o.reels === g.reels.join()); if (!old || old.product === g.product) return null;
			const ov = [...document.querySelectorAll<HTMLElement>('.ov.merge')].find((o) => o.dataset.reels === g.reels.join());
			return ov ? growIn(ov, old.values, g.values, old.product, g.product) : null;
		}).filter(Boolean);
		if (grows.length) await Promise.all(grows); else await wait(650);
	},
	// Respin: the cells being replaced go straight back to spinning (no marker text) and stop reel by reel.
	async respinStart(ev) {
		hideToast(); sfx('respin_transition', { throttle: 250 });
		document.querySelectorAll('.cell').forEach((c) => c.classList.remove('win', 'dim')); clearSymWins(); clearOvWins();
		clearLines();
		ev.locked.singles.forEach((s) => {
			const c = cellEl(s.reel, s.row);
			if (!c.classList.contains('locked')) { c.classList.add('locked'); lockFx(c); }
		});
		showRespin(ev.step, ev.remaining);
		await wait(450);
		spinMini(ev.replace);
	},
	async respinReveal(ev) {
		const T = timing();
		ev.newSymbols.forEach((s) => {
			S.sym[s.reel][s.row] = s.name;
			if (s.wild) S.vals.set(k(s.reel, s.row), s.multiplier || 1); else S.vals.delete(k(s.reel, s.row));
		});
		warmStacks();
		// each replaced cell lands on its own, left to right then top to bottom
		const order = [...ev.newSymbols].sort((x, y) => x.reel - y.reel || x.row - y.row);
		const at0 = Math.max(T.resp, sinceStart() + 120);
		await Promise.all(order.map((s, i) => stopMini(s.reel, s.row, at0 + i * T.cell, () => {
			renderCell(s.reel, s.row, null); const c = cellEl(s.reel, s.row);
			if (S.sym[s.reel][s.row] === 'W') { wildLand(c); voice('wild', { reel: s.reel }); } else if (S.sym[s.reel][s.row] === 'S') symLand(c);
		})));
		markStopped();
		await sleep(T.land);
	},
	async respinEnd(ev) {
		// the 350 ms beat only closes a real respin sequence (no respin: no dead pause after the win)
		if (ev.step > 0) { endRespin(); await wait(350); }
	},
	// v3.19: the banner and its stages follow the math win level of the amount (synced standard edges; the book's winLevel
	// is cross-checked, winLevel()); below the first banner level is a normal win, the max level is the wincap screen
	async setWin(ev) {
		const x = ev.amount / 100, lvl = winLevel(ev);
		const bl = BIG_TIERS.length ? bannerLevel(ev.amount, WIN_EDGES, BIG_TIERS[0].level, MAX_WIN_X, roundMinX) : 0;
		(globalThis as any).__elfWin?.wins.push({ amount: ev.amount, x, lvl, book: ev.winLevel, banner: bl });
		if (bl) { roxy('win'); await bigWin(x, undefined, lvl); }
	},
	async setTotalWin(ev) { const x = Math.min(ev.amount / 100, MAX_WIN_X); setWinMeter(x, !!(ev as { payout?: boolean }).payout); S.roundBase = x; },
	async cardFlip(ev) {
		await showScatters(scattersOnBoard(), 900);
		unScatter(); roxy('excited');
		await cardFlip(ev.result);
	},
	async freeSpinTrigger(ev) {
		hideToast(); roxy('excited'); sfx('scatter_trigger_bell'); sfx('bonus_trigger', { gain: 0.7 }); music('bonus'); boardPunch(stingInMs()); voice('bonus');   // v9: next bar line -> sung trigger stinger -> bonus loop
		// the trigger scatters light up on the board, the wilds that stay lock in place (Dare carries nothing);
		// the board itself is never cleared or re-rendered, so a Mystery bonus continues on the Mystery board
		await showScatters(ev.scatters, 1100);
		lockCarried(ev.carried);
		const I = $('#intro');
		(I.querySelector('.tierName') as HTMLElement).innerHTML = titleHTML(ev.tier, TL(ev.tier) + '!');
		// the spin count is the card's hero line, in the title lettering (sprite glyphs; the text stays for screen readers)
		titleType(I.querySelector<HTMLElement>('.spins'), `${ev.totalFs} FREE SPINS`); titleType(I.querySelector<HTMLElement>('.cont'), 'START');
		ninePanel(I.querySelector<HTMLElement>('.card'), CARD); ninePanel(I.querySelector<HTMLElement>('.cont'), BTN);
		// chalet: the tier's elves on the card, so it reads as a scene, not a dialog: the tier's approved square card art
		// (assets/cards, the same paintings as the buy menu) shown whole, so nobody is cut at the face or chest. c = the
		// crop as fractions of the image [x0, y0, x1, y1] (the whole image) and the window takes its aspect.
		{ const art: Record<string, { u: string; c: [number, number, number, number]; px: [number, number] }> = {
				dare: { u: 'assets/cards/card_dare.webp', c: [0, 0, 1, 1], px: [640, 640] },
				double_dare: { u: 'assets/cards/card_double_dare.webp', c: [0, 0, 1, 1], px: [640, 640] },
				triple_dare: { u: 'assets/cards/card_triple_dare.webp', c: [0, 0, 1, 1], px: [640, 640] },
				hidden: { u: 'assets/cards/card_powder_day.webp', c: [0, 0, 1, 1], px: [640, 640] } };
		  const t = art[ev.tier] || art.double_dare, [x0, y0, x1, y1] = t.c, cw = x1 - x0, ch = y1 - y0;
		  let wv = I.querySelector<HTMLElement>('.card .tArtWin'), a = wv?.querySelector<HTMLImageElement>('img.tArt');
		  if (!wv || !a) { wv = document.createElement('div'); wv.className = 'tArtWin'; a = document.createElement('img'); a.className = 'tArt'; a.alt = ''; a.draggable = false;
		    const fr = document.createElement('i'); fr.className = 'tArtFr'; wv.append(a, fr); I.querySelector('.card .spins')!.before(wv); ninePanel(fr, WINDOW); }
		  wv.style.setProperty('--ar', ((cw * t.px[0]) / (ch * t.px[1])).toFixed(4));
		  Object.assign(a.style, { width: `${100 / cw}%`, height: `${100 / ch}%`, left: `${(-x0 / cw) * 100}%`, top: `${(-y0 / ch) * 100}%` });
		  if (a.getAttribute('src') !== t.u) a.src = t.u; }
		I.dataset.tier = ev.tier; I.classList.remove('hidden');
		music('bonus');   // no-op when the trigger already switched it
		const fx = I.querySelector<HTMLElement>('.bwFx'); featOpen(fx); featPop(I.querySelector('.tierName'));
		// v3.18 (James 2026-10-30): the player starts every bonus with START (or a tap on the card / Space), in turbo
		// exactly as without it; the old timer advanced it on its own (turbo: ~0.5 s, which read as "starts by itself").
		// Only autoplay keeps the timed advance. Taps in the first 300 ms are ignored (a slam-stop double tap).
		await startGate(I, handsFree() ? (S.turbo ? 1400 : 2600) : 0);   // v3.18b: waits for START (autoplay too, count kept) unless AUTO-PLAY BONUS
		I.onclick = null; I.classList.add('hidden'); featClose(fx); unScatter(); voice('fsstart', { tier: ev.tier });
		showFsBar();
		$('#fsTier').textContent = TL(ev.tier); $('#fsCount').textContent = `FREE SPIN 0 / ${ev.totalFs}`;
	},
	async guaranteedStacks(ev) {
		// Triple Dare / Epic: the missing full-reel wilds grow in on their reels; carried singles there fly into them
		for (const st of ev.stacks) {
			const flying = grab(st.absorbed.map((a) => cellEl(st.reel, a.row).querySelector<HTMLElement>('.mx')));
			S.full.set(st.reel, st.value);
			for (let row = 0; row < ROWS; row++) S.vals.delete(k(st.reel, row));
			// v3.11: the stack forms IN PLACE over the reel: one overlay, centre anchor, opacity + a 3 % scale settle (no
			// CSS settle scaleY from the top, no second expand sprite); the reel's cells fade out under it, then hide
			renderOverlays(false);
			const ov = document.querySelector<HTMLElement>(`.ov.full[data-reel="${st.reel}"]`);
			const cells = Array.from({ length: ROWS }, (_, row) => cellEl(st.reel, row)), base = S.turbo ? 220 : 600, dur = S.turbo ? base : base * tempo(); // wait() applies the tempo itself
			if (ov) { ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur, easing: 'cubic-bezier(.3,.1,.3,1)' }); ovArt(ov).forEach((e) => e.animate([{ transform: 'scale(1.03)' }, { transform: 'none' }], { duration: dur, easing: 'cubic-bezier(.3,.1,.3,1)' })); }
			cells.forEach((el) => el.animate([{ opacity: 1 }, { opacity: 1, offset: 0.4 }, { opacity: 0 }], { duration: dur, easing: 'ease-in-out', fill: 'forwards' }));
			frameIn(ov, S.turbo ? 0 : base * 0.5);
			sfx('wild_stack_merge', { throttle: 250 });
			wfExpand(ov); // top shine only (v3.11: no per-reel elf expand sheet)
			await Promise.all([combineInto(flying, ovMx(st.reel)), wait(base)]);
			cells.forEach((el) => { el.getAnimations().forEach((a) => a.cancel()); el.style.visibility = 'hidden'; });
			await wait(S.turbo ? 150 : 350);
		}
		lockCarried(ev.locked);
	},
	async updateFreeSpin(ev) {
		showFsBar();
		if (ev.tier) $('#fsTier').textContent = TL(ev.tier);
		$('#fsCount').textContent = `FREE SPIN ${ev.amount} / ${ev.total}`;
		await wait(250);
	},
	async freeSpinRetrigger(ev) {
		// 2 Dare Cards = +2, 3+ = +5, up to the 20-spin cap
		// v3.14 (James): a brief "+X FREE SPINS" card over the lit Dare Cards; the fs counter updates as it appears
		const hl = showScatters(ev.scatters, 900); sfx('bonus_trigger', { gain: 0.6 });
		setFsTotal(ev.totalFs);
		await Promise.all([fsMoreCard(ev.addedFs), hl]); unScatter(); await wait(200);
	},
	async freeSpinEnd(ev) {
		if (capHit) { endBonusUi(); return; }   // v3.15g: after a capped max win go straight back to base (finalWin sets the meter)
		// outro: TOTAL WIN counts up over a burst + confetti; tap = jump to the amount, tap again = close
		const O = $('#outro'), fx = O.querySelector<HTMLElement>('.bwFx'), amt = O.querySelector<HTMLElement>('.otAmt')!;
		const total = Math.min(ev.amount / 100, MAX_WIN_X) * bet();
		titleTypeMirror(amt); titleType(O.querySelector<HTMLElement>('.tierName'), 'TOTAL WIN'); titleType(O.querySelector<HTMLElement>('.otHint'), 'TAP TO CONTINUE'); ninePanel(O.querySelector<HTMLElement>('.card'), CARD);
		setAmount(amt, 0); O.classList.remove('hidden'); featOpen(fx); musicSting('bigwin'); duck(true); const cu = loop('bigwin_countup_loop');   // no star glints on the total-win screen (round 6)
		// v3.18b (James): the screen waits for a tap once landed, turbo on or off and in autoplay too (autoplay keeps its count and
		// resumes right after the tap). Only autoplay with AUTO-PLAY BONUS on closes it by itself after the short hold.
		// Staged: a tap during the count-up lands it; once landed a tap / Space / Enter closes it (300 ms guard vs leftover taps).
		let close = () => {}; const closed = new Promise<void>((r) => (close = r)); let landedAt = 0;
		O.classList.remove('landed'); delete O.dataset.waiting;
		O.onclick = () => { if (!landedAt) skipCounts(); else if (performance.now() - landedAt >= 300) close(); };
		await countTo(amt, total, countMs(total / Math.max(bet(), 1e-9), S.turbo) * gtempo()); // anim-v4: studio pace
		landedAt = performance.now(); cu.stop(200); O.classList.add('landed');
		if (handsFree()) { O.dataset.waiting = 'auto'; await Promise.race([wait(S.turbo ? 900 : 1800), closed]); }   // AUTO-PLAY BONUS: short hold
		else { O.dataset.waiting = 'tap'; await closed; }
		duck(false); delete O.dataset.waiting; O.classList.remove('landed');
		O.onclick = null; O.classList.add('hidden'); featClose(fx); endBonusUi();
	},
	async mysteryStart() { await wait(200); },
	async mysteryResult(ev) {
		roxy(ev.outcome === 'none' ? 'disappointed' : 'excited');
		if (ev.outcome !== 'none') { banner(`${TL(ev.outcome)}!`, 1500); sfx('bonus_trigger'); duckFor(3000); voice('bonus'); }
		await wait(ev.outcome === 'none' ? 500 : 1100);
	},
	async egwStart(ev) { egwPending = new Map(ev.reels.map((r) => [r, ev.value])); },
	async buyTriggerStart() { await wait(200); },
	async wincap(ev) { const capX = Number.isFinite(ev.amount) ? ev.amount / 100 : MAX_WIN_X; capHit = true; hideRespin(); setWinMeter(capX); await maxWinCelebration(capX); },
	async finalWin(ev) { setWinMeter(Math.min(ev.amount / 100, MAX_WIN_X), true); },   // the paid amount (payoutMultiplier); equals the running total on 0.1x-step math (payoutFlow guards older books)
};

/** v3.17: EGW runs the base / ante flow. The math sends egwStart (reels + value) and then a reveal that already holds
 *  those reels as locked full reels; base books instead land the singles in the reveal and send one stackComplete per
 *  reel after it. Rewrite the EGW book into that same shape (data only, no EGW animation code): the reveal lands the
 *  EGW reels as four single wilds (egwParts badges, reveal handler) and a stackComplete per EGW reel, left to right,
 *  follows it, before the book's own mergeGroups / wins. */
export function egwFlow(events: BookEvent[]): BookEvent[] {
	const out: BookEvent[] = []; let pend: { reels: number[]; value: number } | null = null;
	for (const ev of events) {
		out.push(ev);
		if (ev.type === 'egwStart') pend = { reels: [...(ev as BookEventOf<'egwStart'>).reels].sort((a, b) => a - b), value: (ev as BookEventOf<'egwStart'>).value };
		else if (ev.type === 'reveal' && pend) {
			for (const reel of pend.reels) out.push({ type: 'stackComplete', step: 0, reel, parts: egwParts(pend.value, ROWS), value: pend.value, instant: false } as unknown as BookEvent);
			pend = null;
		}
	}
	return out;
}

/** Math win level of a setWin: the synced standard edges applied to the amount (math-sourced). The book's winLevel is
 *  cross-checked only below the LEGENDARY edge, where it matches books made before the 1000x edge was added (those
 *  books say 9 / 10 above 1000x; the synced edges say 10 / 11). A mismatch there warns in dev and the edges win. */
export const winLevel = (ev: { amount: number; winLevel?: number }) => {
	const lv = levelOf(ev.amount / 100, WIN_EDGES);   // v20: the round's mode edges (bonus buys x10, setRoundMode)
	if (import.meta.env?.DEV && WIN_EDGES === WIN_LEVELS.standard && Number.isFinite(ev.winLevel) && lv < LEGEND_ELVES_LEVEL && ev.winLevel !== lv) console.warn(`setWin ${ev.amount}: book winLevel ${ev.winLevel} != math edges ${lv}`);
	return lv;
};
/** The next book event that changes the board (puff.ts: a respinStart there refills the popped cells). */
const BOARD_EVENTS = new Set<string>(['respinStart', 'respinEnd', 'reveal', 'freeSpinTrigger', 'freeSpinEnd', 'cardFlip', 'wincap', 'finalWin']);
let boardNext: BookEvent | undefined;
export async function playBookEvents(events: BookEvent[]) {
	events = payoutFlow(egwFlow(events));   // the closing amounts land on the paid (0.1x-rounded) finalWin
	S.roundBase = 0; capHit = false; voiceSpin();
	// celebration sheets are lazy: start decoding them only once this round's book shows they're needed (the reels spin
	// meanwhile); they're released again after the screen closes
	if (events.some((e) => e.type === 'wincap')) void preloadMaxWin();
	else { const top = Math.max(0, ...events.filter((e) => e.type === 'setWin').map((e) => winLevel(e as { amount: number; winLevel?: number }))); if (elvesLevel(top)) void preloadBigWinElves(top); } // that level's layers only
	if (roxyState() === 'anticipation') roxy('idle');
	for (let i = 0; i < events.length; i++) {
		const ev = events[i];
		boardNext = events.slice(i + 1).find((e) => BOARD_EVENTS.has(e.type));
		const h = (bookEventHandlerMap as any)[ev.type];
		if (!h) { if (import.meta.env.DEV) throw new Error(`Unknown book event: ${ev.type}`); console.warn('skipped unknown book event', ev.type); continue; }
		// v26 (James on Stake: ERR_UE after a win): a front-end presentation failure (animation / audio / banner) is logged
		// and the round carries on with the next event; it never reaches the RGS error screen
		try { await h(ev); } catch (e) { feError('book event ' + ev.type, e); }
	}
	// a tease that never turned into a bonus
	try { if (roxyState() === 'anticipation') { roxy('disappointed'); if (teaseOk(events, S.roundBase)) { if (!playVoice(Math.random() < 0.5 ? 'vo_roxy_miss_1' : 'vo_roxy_miss_2')) voice('tease'); } } } catch (e) { feError('round end fx', e); }
}
/** Front-end (non-RGS) failure: console.error + kept in window.__elfErr (last 20) for a Stake test to read. */
export function feError(where: string, e: unknown) {
	console.error('[elfhaus] ' + where, e);
	const g = globalThis as any, l = (g.__elfErr ||= []);
	const msg = String((e as any)?.message ?? e);
	l.push({ where, at: new Date().toISOString(), msg, stack: String((e as any)?.stack ?? '').slice(0, 1500), raw: e }); if (l.length > 20) l.shift();
	crumb('fe', { where: scrub(where), msg: scrub(msg) });
}
