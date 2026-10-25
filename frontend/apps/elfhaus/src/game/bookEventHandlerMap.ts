// One handler per design/EVENTS.md event (ported from prototype/app.js H). Handlers only display.
import { MAX_WIN_X, ROWS, REELS, TIER_LABEL, SPIN_CAP as MAX_FS, type Tier } from './config';
import { money } from './format';
import type { BookEvent, BookEventOf, BookEventType, Locked, Pos } from './typesBookEvent';
import { roxy, roxyState } from './roxy';
import { maxWinCelebration } from './maxwin';
import { showRespin, endRespin, hideRespin } from './respin';
import { mxBurst, lockFx, clearSymWins, symLand, symWin, landBump } from './fx';
import { cardFlip } from './cardflip';
import { timing, isSpinning, startSpin, markStopped, sinceStart, sleep, spinMini, stopMini, stopReel } from './reels';
import { $, S, k, bet, wait, banner, toast, hideToast, bigWin, setWinMeter, clearLines, renderCell, renderOverlays, cellEl, setGem, ovMx, symHTML } from './ui';
import { playWins } from './winlines';
import { wildLand, wfExpand, warmExpand } from './wildfx';
import { stackIn, mergeIn, growIn, clearOvWins } from './mergefx';
import { stackPrefetch } from './stacks';
/** stack_form sheets decode ahead for reels with 2+ wilds that are not full yet (stacks.ts loads sheets on demand). */
const warmStacks = () => stackPrefetch(S.sym.flatMap((c, r) => (!S.full.has(r) && c.filter((x) => x === 'W').length >= 2 ? [r] : [])));
import { featOpen, featPop, featClose } from './featfx';
import { countTo, countMs, setAmount, skipCounts } from './countup';
import { grab, combineInto } from './combine';

const scattersOnBoard = (): Pos[] => S.sym.flatMap((col, reel) => col.map((n, row) => ({ reel, row, n }))).filter((c) => c.n === 'S').map(({ reel, row }) => ({ reel, row }));
const TL = (t: Tier) => TIER_LABEL[t].toUpperCase();
const setFsTotal = (n: number) => { const el = $('#fsCount'); el.textContent = el.textContent!.replace(/\/ \d+/, '/ ' + n); };
const showFsBar = () => { S.inBonus = true; document.body.classList.add('inBonus'); $('#fsBar').classList.remove('hidden'); };
/** Scatter highlight: the Dare Cards play their win loop, everything else dims. */
async function showScatters(ps: Pos[], ms: number) {
	if (!ps.length) return;
	const on = new Set(ps.map((p) => k(p.reel, p.row)));
	for (let r = 0; r < REELS; r++) for (let row = 0; row < ROWS; row++) cellEl(r, row).classList.toggle('dim', !on.has(k(r, row)));
	ps.forEach((p) => { const c = cellEl(p.reel, p.row); c.classList.add('win'); symWin(c); });
	await wait(S.turbo ? ms / 2 : ms);
}
const unScatter = () => { document.querySelectorAll('.cell').forEach((c) => c.classList.remove('win', 'dim')); clearSymWins(); };
/** Wilds that stay for the bonus: lock them in place on the current board (no re-render, so nothing jumps). */
function lockCarried(l: Locked) {
	l.singles.forEach((s) => { const c = cellEl(s.reel, s.row); if (!c.classList.contains('locked')) { c.classList.add('locked'); lockFx(c); } });
}
export const endBonusUi = () => { document.body.classList.remove('inBonus'); $('#fsBar').classList.add('hidden'); $('#intro').classList.add('hidden'); S.inBonus = false; };

type Handlers = { [T in BookEventType]: (ev: BookEventOf<T>) => Promise<void> };
export const bookEventHandlerMap: Handlers = {
	// Reels stop left to right (reels.ts timing); the spin press already started the blur in base play, free spins
	// start it here. A reel flagged for anticipation holds a little longer before it stops (no text).
	async reveal(ev) {
		clearLines(); hideToast(); hideRespin();
		const lockedSingles = new Set(ev.locked.singles.map((s) => k(s.reel, s.row)));
		const fullLocked = new Set(ev.locked.fullReels.map((f) => f.reel));
		if (!isSpinning()) startSpin((r, row) => fullLocked.has(r) || lockedSingles.has(k(r, row)));
		S.sym = ev.board.map((col) => col.slice(1, 1 + ROWS).map((s) => s.name));
		S.vals = new Map(); S.full = new Map();
		ev.locked.fullReels.forEach((f) => S.full.set(f.reel, f.value));
		// merged groups whose stacks are all carried over stay merged (no re-merge animation every free spin)
		S.groups = S.groups.filter((g) => g.reels.every((r) => S.full.has(r))).map((g) => {
			const values = g.reels.map((r) => S.full.get(r)!); return { reels: g.reels, values, product: values.reduce((a, b) => a * b, 1) };
		});
		ev.board.forEach((col, r) => col.slice(1, 1 + ROWS).forEach((s, row) => { if (s.wild && !S.full.has(r)) S.vals.set(k(r, row), s.multiplier || 1); }));
		renderOverlays(false); warmStacks();
		const T = timing();
		const ant = ev.anticipation.some((a) => a > 0);
		if (ant && ev.gameType === 'basegame') roxy('anticipation');
		// every reel gets an absolute settle time; reels.ts eases each one in (decel, overshoot, settle)
		// anticipation reels (math flags them once 2 Dare Cards have landed) each glow from the previous reel's stop,
		// hold an extra T.ant and brake slowly, one after another, so reel 5 always lands last
		let at = Math.max(T.first, sinceStart() + 120), prev = at;
		const stops: Promise<void>[] = [];
		for (let r = 0; r < REELS; r++) {
			prev = at;
			if (r > 0) at += T.gap;
			const slow = ev.anticipation[r] > 0 ? T.antD : 0;
			if (slow) at += T.ant;
			const finals = Array.from({ length: ROWS }, (_, row) => symHTML(S.sym[r][row], S.vals.get(k(r, row))));
			stops.push(stopReel(r, at, finals, () => {
				for (let row = 0; row < ROWS; row++) {
					const locked = lockedSingles.has(k(r, row));
					renderCell(r, row, null);
					cellEl(r, row).classList.toggle('locked', locked);
					if (!locked && !fullLocked.has(r) && S.sym[r][row] === 'W') wildLand(cellEl(r, row));
					else if (S.sym[r][row] === 'S') symLand(cellEl(r, row));
					if (!locked && !fullLocked.has(r)) landBump(cellEl(r, row));
				}
			}, slow, prev));
		}
		await Promise.all(stops);
		markStopped();
		await sleep(T.land);
	},
	async stackComplete(ev) {
		// the four wild values ADD into the stack's value (SPEC: sum of the 4 cell values)
		const flying = grab([0, 1, 2, 3].map((row) => cellEl(ev.reel, row).querySelector<HTMLElement>('.mx')));
		const render = () => {
			S.full.set(ev.reel, ev.value);
			for (let row = 0; row < ROWS; row++) { S.vals.delete(k(ev.reel, row)); cellEl(ev.reel, row).style.visibility = 'hidden'; }
			renderOverlays(false);
		};
		if (ev.instant) render(); else await stackIn(ev.reel, render); // squash → flash → elastic pop
		await combineInto(flying, ovMx(ev.reel));
		await wait(250);
	},
	async mergeGroups(ev) {
		// adjacent stacks MULTIPLY into one number per group (SPEC: product within a group)
		// each fresh group: anticipation → lean → hit (shockwave, burst, shake) → letters ignite →
		// the per-reel corner gems recombine into the group's one gem (mergefx.ts); tap / turbo snaps to the end state
		const fresh = ev.groups.filter((g) => !S.groups.find((o) => o.reels.join() === g.reels.join()));
		const apply = () => { S.groups = ev.groups.map((g) => ({ reels: [...g.reels], values: [...g.values], product: g.product })); renderOverlays(false); };
		if (!fresh.length) { apply(); return; }
		let applied = false; const once = () => { if (!applied) { applied = true; apply(); } };
		await Promise.all(fresh.map((g) => mergeIn(g.reels, g.values, g.product, once)));
		once();
	},
	async winInfo(ev) {
		// one thin line at a time races along each payline; its amount ticks into WIN (winlines.ts)
		await playWins(ev.wins, S.roundBase);
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
		// a lone full reel ticks +1 on its own corner gem (pop); a merged group splits into per-reel gems, ticks, recombines
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
		hideToast();
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
			if (S.sym[s.reel][s.row] === 'W') wildLand(c); else if (S.sym[s.reel][s.row] === 'S') symLand(c);
		})));
		markStopped();
		await sleep(T.land);
	},
	async respinEnd(ev) {
		if (ev.step > 0) endRespin();
		await wait(350);
	},
	async setWin(ev) { const x = ev.amount / 100; if (x >= 10 && x < MAX_WIN_X) await bigWin(x); },
	async setTotalWin(ev) { const x = Math.min(ev.amount / 100, MAX_WIN_X); setWinMeter(x); S.roundBase = x; },
	async cardFlip(ev) {
		await showScatters(scattersOnBoard(), 900);
		unScatter(); roxy('excited');
		await cardFlip(ev.result);
	},
	async freeSpinTrigger(ev) {
		hideToast(); roxy('excited');
		// the trigger scatters light up on the board, the wilds that stay lock in place (Dare carries nothing);
		// the board itself is never cleared or re-rendered, so a Mystery bonus continues on the Mystery board
		await showScatters(ev.scatters, 1100);
		lockCarried(ev.carried);
		const I = $('#intro');
		(I.querySelector('.tierName') as HTMLElement).textContent = TL(ev.tier) + '!';
		(I.querySelector('.spins') as HTMLElement).textContent = `${ev.totalFs} FREE SPINS`;
		I.dataset.tier = ev.tier; I.classList.remove('hidden');
		const fx = I.querySelector<HTMLElement>('.bwFx'); featOpen(fx); featPop(I.querySelector('.tierName'));
		// brief and skippable: a tap anywhere on the overlay continues
		await Promise.race([wait(S.turbo ? 1400 : 2600), new Promise<void>((res) => (I.onclick = () => res()))]);
		I.onclick = null; I.classList.add('hidden'); featClose(fx); unScatter();
		showFsBar();
		$('#fsTier').textContent = TL(ev.tier); $('#fsCount').textContent = `FREE SPIN 0 / ${ev.totalFs}`;
	},
	async guaranteedStacks(ev) {
		// Triple Dare / Epic: the missing full-reel wilds grow in on their reels; carried singles there fly into them
		ev.stacks.forEach((st) => void warmExpand(st.reel)); // per-reel expand sheets decode while the first ones play
		for (const st of ev.stacks) {
			const flying = grab(st.absorbed.map((a) => cellEl(st.reel, a.row).querySelector<HTMLElement>('.mx')));
			S.full.set(st.reel, st.value);
			for (let row = 0; row < ROWS; row++) { S.vals.delete(k(st.reel, row)); cellEl(st.reel, row).style.visibility = 'hidden'; }
			renderOverlays(st.reel);
			wfExpand(document.querySelector<HTMLElement>(`.ov.full[data-reel="${st.reel}"]`));
			await combineInto(flying, ovMx(st.reel));
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
		const hl = showScatters(ev.scatters, 900);
		banner(ev.addedFs ? `+${ev.addedFs} SPINS` : `MAX ${MAX_FS} SPINS`, 1300);
		setFsTotal(ev.totalFs); await hl; unScatter(); await wait(200);
	},
	async freeSpinEnd(ev) {
		// outro: TOTAL WIN counts up over a burst + confetti; tap = jump to the amount, tap again (or wait) = close
		const O = $('#outro'), fx = O.querySelector<HTMLElement>('.bwFx'), amt = O.querySelector<HTMLElement>('.otAmt')!;
		const total = Math.min(ev.amount / 100, MAX_WIN_X) * bet();
		setAmount(amt, 0); O.classList.remove('hidden'); featOpen(fx); featPop(O.querySelector('.tierName'));
		let close = () => {}; const closed = new Promise<void>((r) => (close = r)); let landed = false;
		O.onclick = () => (landed ? close() : skipCounts());
		await countTo(amt, total, countMs(total / Math.max(bet(), 1e-9), S.turbo));
		landed = true;
		await Promise.race([wait(S.turbo ? 900 : 1800), closed]);
		O.onclick = null; O.classList.add('hidden'); featClose(fx); endBonusUi();
	},
	async mysteryStart() { await wait(200); },
	async mysteryResult(ev) {
		roxy(ev.outcome === 'none' ? 'disappointed' : 'excited');
		if (ev.outcome !== 'none') banner(`${TL(ev.outcome)}!`, 1500);
		await wait(ev.outcome === 'none' ? 500 : 1100);
	},
	async egwStart() { await wait(300); },
	async buyTriggerStart() { await wait(200); },
	async wincap() { hideRespin(); setWinMeter(MAX_WIN_X); await maxWinCelebration(); },
	async finalWin(ev) { setWinMeter(Math.min(ev.amount / 100, MAX_WIN_X)); },
};

export async function playBookEvents(events: BookEvent[]) {
	S.roundBase = 0;
	if (roxyState() === 'anticipation') roxy('idle');
	for (const ev of events) {
		const h = (bookEventHandlerMap as any)[ev.type];
		if (!h) { if (import.meta.env.DEV) throw new Error(`Unknown book event: ${ev.type}`); console.warn('skipped unknown book event', ev.type); continue; }
		await h(ev);
	}
	// a tease that never turned into a bonus
	if (roxyState() === 'anticipation') roxy('disappointed');
}
