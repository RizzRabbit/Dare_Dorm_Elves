// DOM renderer (ported from prototype/app.js). It only displays what book events say.
import ART_JSON from './art.generated.json';
import { LINES, MAX_WIN_X, ROWS, REELS, SYMBOL_NAMES } from './config';
import { money } from './format';
import type { Group, LineWin } from './typesBookEvent';

export const ART = ART_JSON as Record<string, string | null>;
export const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const LINE_COLORS = ['#C8435F', '#4E6A8C', '#B79BE0', '#7E9C6B', '#9A6FB0', '#8B7FA8', '#5E8F95', '#6E6880'];

export const S = {
	currency: 'USD', balance: 0, levels: [] as number[], betIdx: 0, ante: false, turbo: false, busy: false, auto: 0,
	sym: [] as string[][], vals: new Map<number, number>(), full: new Map<number, number>(), groups: [] as Group[],
	roundBase: 0, meterX: 0, inBonus: false, cell: 100, ready: false, replay: false, replayBet: 0,
	jur: {} as Record<string, any>,
};
export const k = (r: number, row: number) => r * ROWS + row;
export const bet = () => (S.replay ? S.replayBet : S.levels[S.betIdx] ?? 0);
export const wait = (ms: number) => new Promise<void>((res) => setTimeout(res, ms * (S.turbo ? 0.35 : 1)));
const pos = (r: number, row: number) => ({ x: r * S.cell, y: row * S.cell });

const ph = (key: string) => `<span class="ph">${key} placeholder</span>`;
const img = (key: string) => (ART[key] ? `<img src="${ART[key]}" alt="" draggable="false">` : '');
const badgeCls = (v: number) => (v >= 100 ? 'badge b100' : v >= 10 ? 'badge b10' : 'badge');
export function symHTML(name: string, v?: number) {
	if (name === 'W') {
		const val = v || 1;
		return `<div class="sym W">${ART.W ? img('W') : `<span class="nm">WILD</span>${ph('W')}`}<span class="plate">WILD</span></div><div class="${badgeCls(val)}">x${val}</div><div class="lock">LOCKED</div>`;
	}
	const t = name[0];
	if (ART[name]) return `<div class="sym ${t} ${name}">${img(name)}</div>`;
	return `<div class="sym ${t} ${name}"><span class="id">${name}</span><span class="nm">${(SYMBOL_NAMES[name] || name).toUpperCase()}</span>${ph(name)}</div>`;
}
export function buildCells() {
	const c = $('#cells'); c.innerHTML = '';
	for (let r = 0; r < REELS; r++) for (let row = 0; row < ROWS; row++) {
		const d = document.createElement('div'); d.className = 'cell'; d.id = `c${r}${row}`; c.appendChild(d);
	}
}
export const cellEl = (r: number, row: number) => document.getElementById(`c${r}${row}`) as HTMLElement;
export function renderCell(r: number, row: number, cls?: string | null) {
	const d = cellEl(r, row), p = pos(r, row);
	d.style.left = p.x + 'px'; d.style.top = p.y + 'px';
	d.innerHTML = symHTML(S.sym[r]?.[row] ?? 'L5', S.vals.get(k(r, row)));
	d.style.visibility = S.full.has(r) ? 'hidden' : 'visible';
	if (cls) { d.classList.remove(cls); void d.offsetWidth; d.classList.add(cls); }
}
export function renderOverlays(anim: boolean | number = false) {
	const o = $('#overlays'); o.innerHTML = '';
	const inGroup = new Set<number>(); S.groups.forEach((g) => g.reels.forEach((r) => inGroup.add(r)));
	S.groups.forEach((g) => {
		const n = g.reels.length, key = `WM${n}`;
		const d = document.createElement('div'); d.className = 'ov merge';
		d.style.left = pos(g.reels[0], 0).x + 'px'; d.style.width = n * S.cell + 'px';
		d.innerHTML = (ART[key] ? `<div class="wfph" style="left:0;width:100%;animation:none">${img(key)}</div>`
			: g.reels.map((_, i) => `<div class="wfph" style="left:${i * S.cell}px;width:${S.cell}px"><span>ELF ${i + 1}</span></div>`).join('') + `<div class="mlabel">${key} placeholder · ${n} elves</div>`) +
			`<div class="${badgeCls(g.product)}">${g.values.map((v) => 'x' + v).join(' × ')} = x${g.product}</div><div class="plate">WILD</div>`;
		if (!anim) d.style.animation = 'none';
		o.appendChild(d);
	});
	[...S.full].forEach(([r, v]) => {
		if (inGroup.has(r)) return;
		const d = document.createElement('div'); d.className = 'ov full';
		d.style.left = pos(r, 0).x + 'px'; d.style.width = S.cell + 'px';
		d.innerHTML = (ART.WF ? `<div class="wfph" style="left:0;width:100%">${img('WF')}</div>` : `<div class="wfph" style="left:0;width:100%"><span>FULL-REEL<br>WILD</span></div><div class="tag">WF placeholder</div>`) +
			`<div class="${badgeCls(v)}">x${v}</div><div class="plate">WILD</div>`;
		if (anim !== r) d.style.animation = 'none';
		o.appendChild(d);
	});
}
export function renderAll() {
	for (let r = 0; r < REELS; r++) for (let row = 0; row < ROWS; row++) renderCell(r, row);
	renderOverlays(false);
}
export function clearLines() {
	$('#lines').innerHTML = '';
	document.querySelectorAll('.cell').forEach((c) => c.classList.remove('win', 'dim', 'replace', 'out'));
}
export function drawWins(wins: LineWin[]) {
	const svg = $('#lines'); svg.innerHTML = '';
	document.querySelectorAll('.cell').forEach((c) => c.classList.add('dim'));
	wins.forEach((w, i) => {
		const ln = LINES[w.lineIndex - 1]; if (!ln) return;
		const pts = ln.map((row, r) => { const p = pos(r, row); return `${p.x + S.cell / 2},${p.y + S.cell / 2}`; }).join(' ');
		const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
		pl.setAttribute('points', pts); pl.setAttribute('stroke', LINE_COLORS[i % LINE_COLORS.length]); pl.setAttribute('opacity', '.85');
		svg.appendChild(pl);
		w.positions.forEach((p) => { const c = cellEl(p.reel, p.row); c.classList.remove('dim'); c.classList.add('win'); });
	});
}
export function toast(html: string) { const t = $('#stepToast'); t.innerHTML = html; t.classList.remove('hidden'); }
export const hideToast = () => $('#stepToast').classList.add('hidden');
let bannerT: any;
export function banner(txt: string, ms = 1400) {
	const b = $('#banner'); b.textContent = txt; b.classList.remove('hidden'); clearTimeout(bannerT);
	if (ms) bannerT = setTimeout(() => b.classList.add('hidden'), ms * (S.turbo ? 0.5 : 1));
}
// C17: the round's win meter only counts up and never exceeds the 50,000x cap.
export function setWinMeter(x: number) {
	S.meterX = Math.min(MAX_WIN_X, Math.max(S.meterX, x));
	$('#win').textContent = money(S.meterX * bet());
}
export function resetWinMeter() { S.meterX = 0; $('#win').textContent = money(0); }
export async function bigWin(x: number, label?: string) {
	const tier = label || (x >= 1000 ? 'LEGENDARY WIN' : x >= 100 ? 'EPIC WIN' : x >= 50 ? 'SUPER WIN' : x >= 25 ? 'MEGA WIN' : 'BIG WIN');
	const B = $('#bigwin'); (B.querySelector('.bwTier') as HTMLElement).textContent = tier;
	(B.querySelector('.bwX') as HTMLElement).textContent = `${x.toLocaleString('en-US')}x`;
	B.classList.remove('hidden');
	const amt = B.querySelector('.bwAmt') as HTMLElement, steps = S.turbo ? 10 : 30;
	for (let i = 1; i <= steps; i++) { amt.textContent = money((x * bet() * i) / steps); await wait(45); }
	await wait(1500); B.classList.add('hidden');
}
