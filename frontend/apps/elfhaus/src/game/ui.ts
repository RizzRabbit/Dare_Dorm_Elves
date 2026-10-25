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
// Pink gem multiplier badge (matte SVG, no glow). Text sits inside the SVG so its dark stroke renders the
// same everywhere; the size steps down for 4-character labels ("x100") so 3 digits always fit.
const GEM_FACETS =
	'<polygon points="25,3 75,3 63,22 37,22" fill="#F7A6CB"/>' + // crown top
	'<polygon points="75,3 97,43 77,43 63,22" fill="#E86BA8"/>' + // upper right
	'<polygon points="25,3 37,22 23,43 3,43" fill="#F28CBE"/>' + // upper left
	'<polygon points="3,43 23,43 37,64 25,83" fill="#B83279"/>' + // lower left
	'<polygon points="97,43 75,83 63,64 77,43" fill="#9E2467"/>' + // lower right
	'<polygon points="25,83 37,64 63,64 75,83" fill="#7D1A52"/>' + // pavilion bottom
	'<polygon points="37,22 63,22 77,43 63,64 37,64 23,43" fill="#D9458F"/>' + // table
	'<polygon points="37,22 63,22 50,43" fill="#E2579C" opacity=".9"/><polygon points="37,64 63,64 50,43" fill="#C23A82" opacity=".9"/>' +
	'<polygon points="30,7 46,7 38,17 31,17" fill="#fff" opacity=".8"/>' + // small white highlight
	'<polygon points="25,3 75,3 97,43 75,83 25,83 3,43" fill="none" stroke="#2A1022" stroke-width="3.2" stroke-linejoin="round"/>';
export function gemHTML(v: number, extra = '', style = '') {
	const t = 'x' + v, fs = t.length >= 5 ? 23 : t.length === 4 ? 28 : 34;
	return `<div class="gem${extra ? ' ' + extra : ''}"${style ? ` style="${style}"` : ''} data-v="${v}"><svg viewBox="0 0 100 86" aria-hidden="true">${GEM_FACETS}` +
		`<text x="50" y="44" font-size="${fs}">${t}</text></svg><i class="sw"></i></div>`;
}
/** Update a gem in place and play the gentle pop + facet sweep. */
export function setGem(el: Element | null, v: number) {
	if (!el) return;
	const g = el as HTMLElement, t = 'x' + v, tx = g.querySelector('text');
	if (tx) { tx.textContent = t; tx.setAttribute('font-size', String(t.length >= 5 ? 23 : t.length === 4 ? 28 : 34)); }
	g.dataset.v = String(v); g.classList.remove('grow'); void g.offsetWidth; g.classList.add('grow');
}
export function symHTML(name: string, v?: number) {
	if (name === 'W') {
		const val = v || 1;
		return `<div class="sym W">${ART.W ? img('W') : `<span class="nm">WILD</span>${ph('W')}`}<span class="plate">WILD</span></div>${gemHTML(val)}<div class="lock">LOCKED</div>`;
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
		// Final art (n reels x 4 rows, same aspect as the merged area) fills the overlay edge to edge; the
		// dashed columns, labels and WILD plate are only for the no-art fallback.
		if (ART[key]) d.classList.add('art');
		d.innerHTML = (ART[key] ? `<div class="wart">${img(key)}</div>`
			: g.reels.map((_, i) => `<div class="wfph" style="left:${i * S.cell}px;width:${S.cell}px"><span>ELF ${i + 1}</span></div>`).join('') + `<div class="mlabel">${key} placeholder · ${n} elves</div><div class="plate">WILD</div>`) +
			g.values.map((v, i) => gemHTML(v, '', `right:calc(${(n - 1 - i) * S.cell}px + 4px)`)).join('') +
			`<div class="formula">${g.values.map((v) => 'x' + v).join(' × ')} = x${g.product}</div>`;
		if (!anim) d.style.animation = 'none';
		o.appendChild(d);
	});
	[...S.full].forEach(([r, v]) => {
		if (inGroup.has(r)) return;
		const d = document.createElement('div'); d.className = 'ov full';
		d.style.left = pos(r, 0).x + 'px'; d.style.width = S.cell + 'px';
		if (ART.WF) d.classList.add('art');
		d.innerHTML = (ART.WF ? `<div class="wart">${img('WF')}</div>` : `<div class="wfph" style="left:0;width:100%"><span>FULL-REEL<br>WILD</span></div><div class="tag">WF placeholder</div><div class="plate">WILD</div>`) +
			gemHTML(v);
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
