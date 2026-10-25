// One handler per design/EVENTS.md event (ported from prototype/app.js H). Handlers only display.
import { MAX_WIN_X, ROWS, REELS, TIER_LABEL, type Tier } from './config';
import { money } from './format';
import type { BookEvent, BookEventOf, BookEventType } from './typesBookEvent';
import { roxy, roxyState } from './roxy';
import { maxWinCelebration } from './maxwin';
import { showRespin, endRespin, hideRespin } from './respin';
import { mxBurst, lockFx, clearSymWins } from './fx';
import { timing, isSpinning, startSpin, markStopped, sinceStart, sleep, spinCells, stopReel } from './reels';
import { $, S, k, bet, wait, banner, toast, hideToast, bigWin, setWinMeter, clearLines, renderCell, renderOverlays, cellEl, setGem, ovMx, symHTML } from './ui';
import { playWins } from './winlines';
import { grab, combineInto } from './combine';

const TL = (t: Tier) => TIER_LABEL[t].toUpperCase();
const setFsTotal = (n: number) => { const el = $('#fsCount'); el.textContent = el.textContent!.replace(/\/ \d+/, '/ ' + n); };
const showFsBar = () => { S.inBonus = true; document.body.classList.add('inBonus'); $('#fsBar').classList.remove('hidden'); };
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
		renderOverlays(false);
		const T = timing();
		const ant = ev.anticipation.some((a) => a > 0);
		if (ant && ev.gameType === 'basegame') roxy('anticipation');
		// every reel gets an absolute settle time; reels.ts eases each one in (decel, overshoot, settle)
		let at = Math.max(T.first, sinceStart() + 120);
		const stops: Promise<void>[] = [];
		for (let r = 0; r < REELS; r++) {
			if (r > 0) at += T.gap;
			if (ev.anticipation[r] > 0) at += T.ant;
			const finals = Array.from({ length: ROWS }, (_, row) => symHTML(S.sym[r][row], S.vals.get(k(r, row))));
			stops.push(stopReel(r, at, finals, () => {
				for (let row = 0; row < ROWS; row++) {
					const locked = lockedSingles.has(k(r, row));
					renderCell(r, row, null);
					cellEl(r, row).classList.toggle('locked', locked);
				}
			}));
		}
		await Promise.all(stops);
		markStopped();
		await sleep(T.land);
	},
	async stackComplete(ev) {
		// the four wild values ADD into the stack's value (SPEC: sum of the 4 cell values)
		const flying = grab([0, 1, 2, 3].map((row) => cellEl(ev.reel, row).querySelector<HTMLElement>('.mx')));
		S.full.set(ev.reel, ev.value);
		for (let row = 0; row < ROWS; row++) { S.vals.delete(k(ev.reel, row)); cellEl(ev.reel, row).style.visibility = 'hidden'; }
		renderOverlays(ev.reel);
		await combineInto(flying, ovMx(ev.reel));
		await wait(250);
	},
	async mergeGroups(ev) {
		// adjacent stacks MULTIPLY into one number per group (SPEC: product within a group)
		const fresh = ev.groups.filter((g) => !S.groups.find((o) => o.reels.join() === g.reels.join()));
		const flights = fresh.map((g) => ({ g, c: grab(g.reels.map((r) => ovMx(r))) }));
		S.groups = ev.groups.map((g) => ({ reels: [...g.reels], values: [...g.values], product: g.product }));
		renderOverlays(fresh.length > 0);
		await Promise.all(flights.map(({ g, c }) => combineInto(c, ovMx(g.reels[0]))));
		if (fresh.length) await wait(250);
	},
	async winInfo(ev) {
		// one thin line at a time races along each payline; its amount ticks into WIN (winlines.ts)
		await playWins(ev.wins, S.roundBase);
	},
	async updateStepWin(ev) { setWinMeter(S.roundBase + ev.amount / 100); },
	async wildGrow(ev) {
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
		// burst only where a value changed: that full reel's multiplier, or a merged group's total
		new Set(ev.changes.filter((c) => c.kind === 'full').map((c) => ovMx(c.reel))).forEach((mx) => mx && mxBurst(mx));
		await wait(650);
	},
	// Respin: the cells being replaced go straight back to spinning (no marker text) and stop reel by reel.
	async respinStart(ev) {
		hideToast();
		document.querySelectorAll('.cell').forEach((c) => c.classList.remove('win', 'dim')); clearSymWins();
		clearLines();
		ev.locked.singles.forEach((s) => {
			const c = cellEl(s.reel, s.row);
			if (!c.classList.contains('locked')) { c.classList.add('locked'); lockFx(c); }
		});
		showRespin(ev.step, ev.remaining);
		await wait(450);
		spinCells(ev.replace);
	},
	async respinReveal(ev) {
		const T = timing();
		const reels = [...new Set(ev.newSymbols.map((s) => s.reel))].sort((a, b) => a - b);
		ev.newSymbols.forEach((s) => {
			S.sym[s.reel][s.row] = s.name;
			if (s.wild) S.vals.set(k(s.reel, s.row), s.multiplier || 1); else S.vals.delete(k(s.reel, s.row));
		});
		let at = Math.max(T.resp, sinceStart() + 120);
		await Promise.all(reels.map((r, i) => {
			if (i) at += T.gap;
			const rows = ev.newSymbols.filter((s) => s.reel === r).map((s) => s.row);
			const finals = Array.from({ length: ROWS }, (_, row) => symHTML(S.sym[r][row], S.vals.get(k(r, row))));
			return stopReel(r, at, finals, () => rows.forEach((row) => renderCell(r, row, null)));
		}));
		markStopped();
		await sleep(T.land);
	},
	async respinEnd(ev) {
		if (ev.step > 0) endRespin();
		await wait(350);
	},
	async setWin(ev) { const x = ev.amount / 100; if (x >= 10 && x < MAX_WIN_X) await bigWin(x); },
	async setTotalWin(ev) { const x = Math.min(ev.amount / 100, MAX_WIN_X); setWinMeter(x); S.roundBase = x; },
	async freeSpinTrigger(ev) {
		hideToast(); roxy('excited');
		const I = $('#intro');
		(I.querySelector('.tierName') as HTMLElement).textContent = TL(ev.tier) + '!';
		(I.querySelector('.spins') as HTMLElement).textContent = `${ev.totalFs} FREE SPINS`;
		I.dataset.tier = ev.tier; I.classList.remove('hidden');
		await Promise.race([wait(2600), new Promise<void>((res) => ((I.querySelector('.cont') as HTMLElement).onclick = () => res()))]);
		I.classList.add('hidden');
		showFsBar();
		$('#fsTier').textContent = TL(ev.tier); $('#fsCount').textContent = `FREE SPIN 0 / ${ev.totalFs}`;
	},
	async updateFreeSpin(ev) {
		showFsBar();
		if (ev.tier) $('#fsTier').textContent = TL(ev.tier);
		$('#fsCount').textContent = `FREE SPIN ${ev.amount} / ${ev.total}`;
		await wait(250);
	},
	async freeSpinRetrigger(ev) {
		if (ev.addedFs) banner(`+${ev.addedFs} SPINS`, 1300);
		setFsTotal(ev.totalFs); await wait(ev.addedFs ? 900 : 200);
	},
	async bonusUpgrade(ev) {
		hideToast();
		banner(`${TL(ev.to)} +${ev.spinsAdded} SPINS`, 1800);
		$('#fsTier').textContent = TL(ev.to); setFsTotal(ev.totalFs); await wait(1400);
	},
	async freeSpinEnd(ev) {
		banner(`TOTAL WIN ${money(Math.min(ev.amount / 100, MAX_WIN_X) * bet())}`, 2200);
		await wait(1600); endBonusUi();
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
