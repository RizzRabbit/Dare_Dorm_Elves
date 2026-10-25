// One handler per design/EVENTS.md event (ported from prototype/app.js H). Handlers only display.
import { MAX_WIN_X, ROWS, REELS, TIER_LABEL, type Tier } from './config';
import { money } from './format';
import type { BookEvent, BookEventOf, BookEventType } from './typesBookEvent';
import { roxy, roxyState } from './roxy';
import { maxWinCelebration } from './maxwin';
import { showRespin, endRespin, hideRespin } from './respin';
import { mxBurst, lockFx, clearSymWins } from './fx';
import { $, S, k, bet, wait, banner, toast, hideToast, bigWin, setWinMeter, clearLines, drawWins, renderCell, renderOverlays, cellEl, setGem } from './ui';

const TL = (t: Tier) => TIER_LABEL[t].toUpperCase();
const lockedText = (c: BookEventOf<'freeSpinTrigger'>['carried']) =>
	[...c.fullReels.map((f) => `Reel ${f.reel + 1} full-reel wild x${f.value}`), ...c.singles.map((s) => `wild on reel ${s.reel + 1} x${s.value}`)].join(' · ');
const setFsTotal = (n: number) => { const el = $('#fsCount'); el.textContent = el.textContent!.replace(/\/ \d+/, '/ ' + n); };
const showFsBar = () => { S.inBonus = true; document.body.classList.add('inBonus'); $('#fsBar').classList.remove('hidden'); };
export const endBonusUi = () => { document.body.classList.remove('inBonus'); $('#fsBar').classList.add('hidden'); $('#intro').classList.add('hidden'); S.inBonus = false; };

type Handlers = { [T in BookEventType]: (ev: BookEventOf<T>) => Promise<void> };
export const bookEventHandlerMap: Handlers = {
	async reveal(ev) {
		clearLines(); hideToast(); hideRespin();
		S.sym = ev.board.map((col) => col.slice(1, 1 + ROWS).map((s) => s.name));
		S.vals = new Map(); S.full = new Map(); S.groups = [];
		ev.locked.fullReels.forEach((f) => S.full.set(f.reel, f.value));
		ev.board.forEach((col, r) => col.slice(1, 1 + ROWS).forEach((s, row) => { if (s.wild && !S.full.has(r)) S.vals.set(k(r, row), s.multiplier || 1); }));
		const lockedSingles = new Set(ev.locked.singles.map((s) => k(s.reel, s.row)));
		for (let r = 0; r < REELS; r++) for (let row = 0; row < ROWS; row++) {
			const locked = lockedSingles.has(k(r, row));
			renderCell(r, row, locked ? null : 'drop', r * 70);
			cellEl(r, row).classList.toggle('locked', locked);
		}
		renderOverlays(false);
		if (ev.anticipation.some((a) => a > 0)) { banner('3 WILDS… THE RESPINS ARE THE REVEAL', 1600); if (ev.gameType === 'basegame') roxy('anticipation'); }
		await wait(650);
	},
	async stackComplete(ev) {
		S.full.set(ev.reel, ev.value);
		for (let row = 0; row < ROWS; row++) { S.vals.delete(k(ev.reel, row)); cellEl(ev.reel, row).style.visibility = 'hidden'; }
		renderOverlays(ev.reel);
		banner(ev.instant ? `INSTANT STACK! REEL ${ev.reel + 1} = x${ev.value}` : `STACK BUILT! REEL ${ev.reel + 1} = ${ev.parts.join(' + ')} = x${ev.value}`, 1800);
		await wait(900);
	},
	async mergeGroups(ev) {
		const grew = ev.groups.some((g) => !S.groups.find((o) => o.reels.join() === g.reels.join()));
		S.groups = ev.groups.map((g) => ({ reels: [...g.reels], values: [...g.values], product: g.product }));
		renderOverlays(grew);
		if (grew && ev.groups.length) {
			const g = ev.groups[ev.groups.length - 1];
			banner(`MERGE! ${g.reels.length} ELVES · ${g.values.map((v) => 'x' + v).join(' × ')} = x${g.product}`, 1800);
			await wait(900);
		}
	},
	async winInfo(ev) {
		drawWins(ev.wins);
		const top = ev.wins.slice().sort((a, b) => b.win - a.win)[0];
		const amt = Math.min(ev.totalWin / 100, MAX_WIN_X) * bet();
		toast(`+${money(amt)}<small>${ev.wins.length} line${ev.wins.length > 1 ? 's' : ''}${top ? ` · best: line ${top.lineIndex}, ${top.count} × ${top.symbol}${top.meta?.lineMult > 1 ? ` ×${top.meta.lineMult}` : ''}` : ''}</small>`);
		await wait(1100);
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
			const p = document.createElement('div'); p.className = 'plus'; p.textContent = '+1'; el.appendChild(p);
		});
		if (ev.changes.some((c) => c.kind !== 'single')) document.querySelectorAll<HTMLElement>('.ov .mx:not(.total)').forEach((b) => mxBurst(b));
		await wait(650);
	},
	async respinStart(ev) {
		hideToast();
		document.querySelectorAll('.cell').forEach((c) => c.classList.remove('win', 'dim')); clearSymWins();
		$('#lines').innerHTML = '';
		ev.locked.singles.forEach((s) => {
			const c = cellEl(s.reel, s.row);
			if (!c.classList.contains('locked')) { c.classList.add('locked'); lockFx(c); }
		});
		ev.replace.forEach((p) => cellEl(p.reel, p.row).classList.add('replace'));
		showRespin(ev.step, ev.remaining);
		await wait(700);
		ev.replace.forEach((p) => cellEl(p.reel, p.row).classList.add('out'));
		await wait(250);
	},
	async respinReveal(ev) {
		ev.newSymbols.forEach((s) => {
			S.sym[s.reel][s.row] = s.name;
			if (s.wild) S.vals.set(k(s.reel, s.row), s.multiplier || 1); else S.vals.delete(k(s.reel, s.row));
			cellEl(s.reel, s.row).classList.remove('out', 'replace');
			renderCell(s.reel, s.row, 'drop');
		});
		if (ev.newSymbols.some((s) => s.wild)) banner('NEW WILD LANDS!', 1000);
		await wait(500);
	},
	async respinEnd(ev) {
		const why = { noConnection: 'no new connection', maxRespins: 'max 3 respins', wincap: 'max win reached' }[ev.reason] || ev.reason;
		if (ev.step > 0) { banner(`RESPINS END · ${why}`, 1000); endRespin(); }
		await wait(450);
	},
	async setWin(ev) { const x = ev.amount / 100; if (x >= 10 && x < MAX_WIN_X) await bigWin(x); },
	async setTotalWin(ev) { const x = Math.min(ev.amount / 100, MAX_WIN_X); setWinMeter(x); S.roundBase = x; },
	async freeSpinTrigger(ev) {
		hideToast(); roxy('excited');
		const I = $('#intro');
		(I.querySelector('.tierName') as HTMLElement).textContent = TL(ev.tier) + '!';
		(I.querySelector('.spins') as HTMLElement).textContent = `${ev.totalFs} FREE SPINS`;
		const carried = lockedText(ev.carried);
		(I.querySelector('.carried') as HTMLElement).textContent = carried ? 'Carried in: ' + carried : '';
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
		banner(ev.addedFs ? `+${ev.addedFs} SPINS!` : 'NEW STACK · max 18 spins reached', 1500);
		setFsTotal(ev.totalFs); await wait(900);
	},
	async bonusUpgrade(ev) {
		hideToast();
		banner(`${TL(ev.from)} → ${TL(ev.to)} · +${ev.spinsAdded} SPINS`, 2200);
		$('#fsTier').textContent = TL(ev.to); setFsTotal(ev.totalFs); await wait(1400);
	},
	async freeSpinEnd(ev) {
		banner(`BONUS COMPLETE · ${money(Math.min(ev.amount / 100, MAX_WIN_X) * bet())}`, 2200);
		await wait(1600); endBonusUi();
	},
	async mysteryStart(ev) {
		const o = ev.odds;
		banner(`MYSTERY SPIN · No bonus ${o.none}% · Double Dare ${o.double_dare}% · Triple Dare ${o.triple_dare}% · Hidden ${o.hidden}%`, 2000);
		await wait(900);
	},
	async mysteryResult(ev) {
		roxy(ev.outcome === 'none' ? 'disappointed' : 'excited');
		banner(ev.outcome === 'none' ? 'MYSTERY RESULT: NO BONUS' : `MYSTERY RESULT: ${TL(ev.outcome)}!`, 1800);
		await wait(1100);
	},
	async egwStart(ev) {
		banner(`ELVES GONE WILD · full-reel wilds on reels ${ev.reels.map((r) => r + 1).join(', ')} (x${ev.value} each)`, 1800);
		await wait(700);
	},
	async buyTriggerStart(ev) { banner(`${TL(ev.tier)} · TRIGGER SPIN`, 1600); await wait(700); },
	async wincap() { setWinMeter(MAX_WIN_X); await maxWinCelebration(); },
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
