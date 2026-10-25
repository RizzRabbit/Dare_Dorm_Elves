// Game controller: RGS flow (authenticate / play / end-round / replay / resume), controls, buy menu, rules, layout.
// Carries the Vault Breakers 3afc6d6 release fixes: rgs_url gating + error modal, bet levels from authenticate,
// balance checks, Space-to-spin, Intl/social currency, replay mode, social wording, jurisdiction flags.
import { requestAuthenticate, requestBet, requestEndRound, requestReplay } from 'rgs-requests';
import { mockAuthenticate, mockBet, mockEndRound, mockReplay } from '../mock/mockRgs';
import { API_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import {
	ANTE_COST, BUY_MODES, CONFIRM_ABOVE_X, GAME_ID, LINES, MAX_WIN_X, MODES, MODE_DESC, MODE_LABEL, MYSTERY_ODDS, PAYTABLE,
	SPIN_CAP, START_FS, SYMBOL_NAMES, VERSION, isProvisional, type ModeKey,
} from './config';
import { money, mult, setCurrency, setLocale, isSocialCurrency } from './format';
import { setSocial, isSocial, t } from './strings';
import { $, S, ART, bet, buildCells, renderAll, resetWinMeter, setWinMeter, banner, wait } from './ui';
import { playBookEvents, endBonusUi } from './bookEventHandlerMap';
import { initRoxy, placeRoxy } from './roxy';
import { initLoader, preloadArt, track, loaderReady, hideLoader } from './loader';
import { preloadMaxWin } from './maxwin';
import type { BookEvent } from './typesBookEvent';

const DISCLAIMER =
	'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Engine.';

const q = new URLSearchParams(location.search);
const url = {
	sessionID: q.get('sessionID') || '', rgsUrl: q.get('rgs_url') || '', lang: q.get('lang') || 'en',
	currency: q.get('currency') || '', social: q.get('social') === 'true', replay: q.get('replay') === 'true',
	game: q.get('game') || GAME_ID, version: q.get('version') || VERSION, mode: q.get('mode') || 'base',
	event: q.get('event') || '', amount: Number(q.get('amount')) || 0,
	mock: q.get('mock') === 'true' || (!q.get('rgs_url') && !q.get('replay')),
	book: q.get('book') || '',
};
let sessionReady = false;
let replayState: BookEvent[] = [];
let replayCost = 1;

// ---------- small helpers ----------
const show = (sel: string, on: boolean) => $(sel).classList.toggle('hidden', !on);
const modeCost = (m: ModeKey) => (m === 'ante' ? ANTE_COST : MODES[m]?.cost ?? 1);
const spinMode = (): ModeKey => (S.ante ? 'ante' : 'base');
function setStrip() {
	$('#balance').textContent = S.replay ? '—' : money(S.balance);
	$('#bet').textContent = money(bet() * (S.replay ? replayCost : modeCost(spinMode())));
}
function message(title: string, body: string, opts: { reload?: boolean } = {}) {
	$('#msgTitle').textContent = title; $('#msgBody').textContent = body;
	const b = $('#msgOk'); b.textContent = opts.reload ? 'RELOAD' : 'OK';
	b.onclick = () => (opts.reload ? location.reload() : show('#msg', false));
	show('#msg', true);
}
const FATAL = new Set(['ERR_RGS_URL', 'ERR_IS', 'ERR_ATE', 'ERR_BET_LEVELS', 'ERR_REPLAY']);
function showError(error: any) {
	console.warn('RGS error', error);
	const code = error?.error || 'ERR_UE';
	const text = code === 'ERR_IPB' ? t('noFunds') : error?.message || 'Something went wrong.';
	message(code === 'ERR_IPB' ? 'INSUFFICIENT BALANCE' : 'CONNECTION PROBLEM', `${text} (${code})`, { reload: FATAL.has(code) });
}
function setBusy(b: boolean) {
	S.busy = b; $('#spinBtn').classList.toggle('busy', b);
	['#buyBtn', '#betUp', '#betDown', '#anteBtn'].forEach((s) => (($(s) as HTMLButtonElement).disabled = b || !sessionReady));
	($('#menuBtn') as HTMLButtonElement).disabled = b;
}
const setAuto = () => { const b = $('#autoBtn'); b.dataset.n = S.auto ? String(S.auto) : ''; b.classList.toggle('on', S.auto > 0); };

// ---------- RGS round ----------
async function finishRound(round: any) {
	if (round?.active || (round?.payoutMultiplier ?? 0) > 0 || (round?.payout ?? 0) > 0) {
		const end: any = url.mock ? await mockEndRound({}) : await requestEndRound({ sessionID: url.sessionID, rgsUrl: url.rgsUrl });
		if (end?.error) throw end;
		if (end?.balance) S.balance = end.balance.amount / API_AMOUNT_MULTIPLIER;
	}
	setStrip();
}
async function round(mode: ModeKey) {
	if (S.busy || !sessionReady || S.replay) return;
	const cost = modeCost(mode) * bet();
	if (S.balance + 1e-9 < cost) { S.auto = 0; setAuto(); message('INSUFFICIENT BALANCE', t('noFunds')); return; }
	setBusy(true); resetWinMeter(); endBonusUi();
	try {
		const data: any = url.mock
			? await mockBet({ currency: S.currency, amount: bet(), mode, forcedBook: url.book || undefined })
			: await requestBet({ sessionID: url.sessionID, rgsUrl: url.rgsUrl, currency: S.currency, amount: bet(), mode });
		if (data?.error) throw data;
		if (data?.balance) S.balance = data.balance.amount / API_AMOUNT_MULTIPLIER;
		setStrip();
		const rd = data?.round;
		await playBookEvents((rd?.state || []) as BookEvent[]);
		await finishRound(rd);
	} catch (e) {
		S.auto = 0; setAuto(); endBonusUi(); showError(e);
	} finally { setBusy(false); }
	if (S.auto > 0) { S.auto--; setAuto(); if (S.auto) setTimeout(() => round(spinMode()), 300); }
}

// ---------- startup ----------
async function authenticate() {
	if (url.mock) {
		const a = await mockAuthenticate({ language: url.lang, currency: url.currency || undefined });
		if (a.balance) { S.currency = a.balance.currency; setCurrency(S.currency); S.balance = a.balance.amount / API_AMOUNT_MULTIPLIER; }
		const c = a.config || {};
		S.jur = { ...(c.jurisdiction || {}) };
		const minBet = c.minBet ?? 0, maxBet = c.maxBet ?? Number.MAX_SAFE_INTEGER;
		S.levels = (c.betLevels || []).filter((l: number) => l >= minBet && l <= maxBet).sort((x: number, y: number) => x - y).map((l: number) => l / API_AMOUNT_MULTIPLIER);
		const pref = (c.defaultBetLevel ?? 0) / API_AMOUNT_MULTIPLIER;
		S.betIdx = S.levels.reduce((bi, l, i) => (Math.abs(l - pref) < Math.abs(S.levels[bi] - pref) ? i : bi), 0);
		return a.round;
	}
	if (!url.rgsUrl) throw { error: 'ERR_RGS_URL', message: 'Missing rgs_url: the game cannot connect to the game server.' };
	const a: any = await requestAuthenticate({ sessionID: url.sessionID, rgsUrl: url.rgsUrl, language: url.lang });
	if (a?.error) throw a;
	if (a?.balance) { S.currency = a.balance.currency; setCurrency(S.currency); S.balance = a.balance.amount / API_AMOUNT_MULTIPLIER; }
	const c = a?.config || {};
	S.jur = { ...(c.jurisdiction || {}) };
	const minBet = c.minBet ?? 0, maxBet = c.maxBet ?? Number.MAX_SAFE_INTEGER;
	S.levels = (c.betLevels || []).filter((l: number) => l >= minBet && l <= maxBet).sort((x: number, y: number) => x - y).map((l: number) => l / API_AMOUNT_MULTIPLIER);
	if (!S.levels.length) throw { error: 'ERR_BET_LEVELS', message: 'No valid bet levels in authenticate config.' };
	const pref = (c.defaultBetLevel ?? 0) / API_AMOUNT_MULTIPLIER;
	S.betIdx = S.levels.reduce((bi, l, i) => (Math.abs(l - pref) < Math.abs(S.levels[bi] - pref) ? i : bi), 0);
	return a?.round;
}
async function resume(rd: any) {
	if (!rd?.state?.length) return;
	if (rd.amount > 0) {
		const amt = rd.amount / API_AMOUNT_MULTIPLIER;
		const i = S.levels.findIndex((l) => Math.abs(l - amt) < 1e-9);
		if (i >= 0) S.betIdx = i;
	}
	S.ante = rd.mode === 'ante'; $('#anteBtn').classList.toggle('on', S.ante);
	setStrip(); banner('RESUMING YOUR LAST ROUND', 1600);
	setBusy(true);
	try { await wait(600); await playBookEvents(rd.state); await finishRound({ ...rd, active: true }); }
	catch (e) { showError(e); } finally { setBusy(false); }
}
async function loadReplay() {
	S.replay = true; document.body.classList.add('replay');
	S.currency = url.currency || 'USD'; setCurrency(S.currency);
	S.replayBet = url.amount / API_AMOUNT_MULTIPLIER || 0;
	if (url.mock || !url.rgsUrl) {
		const d: any = await mockReplay({ mode: url.mode, event: url.event || url.book });
		replayState = d.state; replayCost = Number(d.costMultiplier) || modeCost(url.mode as ModeKey) || 1;
		$('#replayMode').textContent = MODE_LABEL[url.mode as ModeKey] || url.mode;
		show('#replayBar', true); setStrip();
		return;
	}
	if (!url.rgsUrl) throw { error: 'ERR_RGS_URL', message: 'Missing rgs_url: the replay cannot be loaded.' };
	const d: any = await requestReplay({ rgsUrl: url.rgsUrl, game: url.game, version: url.version, mode: url.mode, event: url.event });
	if (d?.error) throw d;
	if (!d?.state?.length) throw { error: 'ERR_REPLAY', message: 'The replay returned no round data.' };
	replayState = d.state; replayCost = Number(d.costMultiplier) || modeCost(url.mode as ModeKey) || 1;
	$('#replayMode').textContent = MODE_LABEL[url.mode as ModeKey] || url.mode;
	show('#replayBar', true); setStrip();
}
async function playReplay() {
	if (S.busy) return;
	const b = $('#replayPlay') as HTMLButtonElement; b.disabled = true; setBusy(true);
	resetWinMeter(); endBonusUi();
	try { await playBookEvents(replayState); } catch (e) { showError(e); }
	finally { setBusy(false); b.disabled = false; b.textContent = 'PLAY AGAIN'; }
}

// ---------- buy menu (C18/C20/C21) ----------
function buildBuy() {
	const off = !!S.jur.disabledBuyFeature;
	$('#buyTitle').textContent = t('buyTitle');
	$('#buyCards').innerHTML = BUY_MODES.map((m) => {
		const c = modeCost(m), price = c * bet(), poor = price > S.balance + 1e-9;
		const rtp = MODES[m]?.rtp;
		const odds = m === 'mystery'
			? `<ul class="mysteryOdds"><li>No bonus <b>${MYSTERY_ODDS.none}%</b></li><li>Double Dare <b>${MYSTERY_ODDS.double_dare}%</b></li><li>Triple Dare <b>${MYSTERY_ODDS.triple_dare}%</b></li><li>Hidden <b>${MYSTERY_ODDS.hidden}%</b></li></ul>` : '';
		return `<div class="bcard${poor || off ? ' off' : ''}" data-m="${m}"><h3>${MODE_LABEL[m].toUpperCase()}</h3><p>${MODE_DESC[m]}</p>${odds}` +
			`<div class="price">${money(price)}</div><div class="mult">${t('costLine', { x: mult(c) })}</div>` +
			`<div class="rtp">RTP ${rtp != null ? (rtp * (rtp <= 1 ? 100 : 1)).toFixed(2) + '%' : 'pending final math'} · max ${MAX_WIN_X.toLocaleString('en-US')}x</div>` +
			`<button data-m="${m}" ${poor || off ? 'disabled' : ''}>${t('buyBtn')}</button></div>`;
	}).join('');
	$('#buyCards').querySelectorAll('button').forEach((b) => ((b as HTMLElement).onclick = () => {
		const m = (b as HTMLElement).dataset.m as ModeKey;
		const go = () => { show('#buyMenu', false); show('#buyConfirm', false); round(m); };
		if (modeCost(m) <= CONFIRM_ABOVE_X) return go();
		$('#buyConfirmText').textContent = t('confirm', { m: MODE_LABEL[m], p: money(modeCost(m) * bet()) });
		$('#buyConfirmNote').textContent = m === 'mystery' ? 'Every Mystery Spin shows a 3-wild tease; the result was decided before the reveal and the odds are 50/37/10/3.' : '';
		$('#buyYes').onclick = go;
		show('#buyConfirm', true);
	}));
}

// ---------- rules (C14/C32/C33/C34) ----------
function buildRules() {
	const xb = isSocial() ? 'x play' : 'x bet';
	const pct = (r: number | null) => (r == null ? 'pending final math' : (r * (r <= 1 ? 100 : 1)).toFixed(2) + '%');
	const modeRows = (['base', 'ante', ...BUY_MODES] as ModeKey[]).map((m) =>
		`<tr><td>${MODE_LABEL[m]}</td><td>${mult(modeCost(m))}</td><td>${pct(MODES[m]?.rtp ?? null)}</td><td>${(MODES[m]?.maxWinX ?? MAX_WIN_X).toLocaleString('en-US')}x</td></tr>`).join('');
	const pt = Object.entries(PAYTABLE).map(([s, p]) =>
		`<tr><td>${ART[s] ? `<img class="ri" src="${ART[s]}" alt="">` : ''}${SYMBOL_NAMES[s]}</td>${p.map((v) => `<td>${mult(v / 20)}</td>`).join('')}</tr>`).join('');
	const lines = LINES.map((ln, i) => `<span class="ln" title="Line ${i + 1}">${i + 1}: ${ln.map((r) => r + 1).join('-')}</span>`).join(' ');
	const win = isSocial() ? 'wins' : 'pays';
	$('#rulesTitle').textContent = 'GAME RULES';
	$('#rulesBody').innerHTML = `
<h3>How to play</h3>
<p>5 reels × 4 rows with 20 fixed lines. Wins ${isSocial() ? 'are awarded' : 'pay'} left to right for 3, 4 or 5 matching symbols on a line, starting on the leftmost reel. Only the highest win per line counts. Line wins are multiplied by the ${isSocial() ? 'play amount' : 'bet'} per line (the total ${isSocial() ? 'play amount' : 'bet'} divided by 20).</p>
<h3>Wilds and respins</h3>
<p>Wilds substitute for every symbol. Each wild carries its own multiplier, starting at x1. A winning line through a wild triggers a respin: wilds lock, the other symbols of the winning lines respin, and everything else stays. Every locked wild that connects again gains +1. Up to 3 respins per spin; every step ${win} as it lands.</p>
<p>Four wilds on one reel become a full-reel wild worth the sum of their multipliers. Adjacent full-reel wilds merge and multiply each other; non-adjacent ones add. A line's multiplier is the product of merged groups plus the sum of the other wilds it uses.</p>
<h3>Free spins</h3>
<p>Dare ${START_FS.dare} · Double Dare ${START_FS.double_dare} · Triple Dare ${START_FS.triple_dare} · Hidden ${START_FS.hidden} free spins. Every new full-reel wild adds +2 spins, up to ${SPIN_CAP} spins in total. In Dare, wilds clear after each spin and the first completed full-reel wild upgrades the bonus once to Double Dare (+2 spins). In Double Dare, Triple Dare and Hidden all wilds stay locked.</p>
<h3>Modes</h3>
<p>${(['ante', ...BUY_MODES] as ModeKey[]).map((m) => `<b>${MODE_LABEL[m]}</b> (${mult(modeCost(m))}): ${MODE_DESC[m]}`).join('<br>')}</p>
<table><tr><th>Mode</th><th>Cost</th><th>RTP</th><th>Max win</th></tr>${modeRows}</table>
<p>Max win is ${MAX_WIN_X.toLocaleString('en-US')}${xb} in every mode. When it is reached, the round ends immediately and awards the max win.${isProvisional() ? ' RTP figures are pending final math.' : ''}</p>
<h3>${isSocial() ? 'Win table' : 'Paytable'}</h3>
<table><tr><th>Symbol</th><th>3</th><th>4</th><th>5</th></tr>${pt}</table>
<p>Values shown in ${xb} for a full line.</p>
<h3>Lines</h3><p class="lines">${lines}</p><p>Rows numbered 1 (top) to 4 (bottom).</p>
<h3>Controls</h3>
<p>Spin with the round button${S.jur.disabledSpacebar ? '' : ' or the Space bar'}. − and + change the ${isSocial() ? 'play amount' : 'bet'}. Ante (${mult(ANTE_COST)}) roughly doubles the chance of a natural bonus.${S.jur.disabledTurbo ? '' : ' Turbo speeds up animations.'}${S.jur.disabledAutoplay ? '' : ' Autoplay runs 10 spins and stops on any error or low balance; press it again to stop.'} Replays never change your balance.</p>
<p>All characters are adults. Elfhaus is a Rizzin Games production.</p>
<h3>Disclaimer</h3><p class="disc">${DISCLAIMER}</p>`;
}

// ---------- layout ----------
export function layout() {
	const W = innerWidth, H = innerHeight, portrait = H > W * 1.1, short = H < 520;
	document.body.classList.toggle('portrait', portrait);
	document.body.classList.toggle('short', short && !portrait);
	const used = (short ? 0 : ($('#top').offsetHeight || 0)) + ($('#hud').offsetHeight || 0) + (short ? 0 : ($('#fsBar').offsetHeight || 24)) + (short ? 20 : 44) + (short ? 16 : 40);
	let cell = portrait ? Math.min((W - 40) / 5, (H - used) / 4) : Math.min((H - used) / 4, (W - 120) / 5);
	cell = Math.max(short ? 26 : 36, Math.floor(cell));
	document.documentElement.style.setProperty('--cell', cell + 'px');
	S.cell = cell; renderAll();
	// Roxy stands in the room as an animated sprite, so the backgrounds are the Roxy-free paintings.
	const bgArt = (portrait && ART.background_portrait) || ART.background;
	if (bgArt) { $('#bg').classList.add('art'); $('#bg').style.backgroundImage = `url(${bgArt})`; }
	placeRoxy(portrait, $('#frame').getBoundingClientRect());
}

// ---------- wiring ----------
function wire() {
	$('#spinBtn').onclick = () => (S.replay ? playReplay() : round(spinMode()));
	$('#betUp').onclick = () => { S.betIdx = Math.min(S.levels.length - 1, S.betIdx + 1); setStrip(); };
	$('#betDown').onclick = () => { S.betIdx = Math.max(0, S.betIdx - 1); setStrip(); };
	$('#anteBtn').onclick = () => { S.ante = !S.ante; $('#anteBtn').classList.toggle('on', S.ante); $('#anteBtn').setAttribute('aria-pressed', String(S.ante)); setStrip(); };
	$('#turboBtn').onclick = () => { S.turbo = !S.turbo; $('#turboBtn').classList.toggle('on', S.turbo); };
	$('#autoBtn').onclick = () => { if (S.auto) { S.auto = 0; setAuto(); return; } if (S.busy) return; S.auto = 10; setAuto(); round(spinMode()); };
	$('#buyBtn').onclick = () => { buildBuy(); show('#buyConfirm', false); show('#buyMenu', true); };
	$('#buyClose').onclick = $('#buyNo').onclick = () => { show('#buyMenu', false); show('#buyConfirm', false); };
	$('#menuBtn').onclick = () => { buildRules(); show('#menu', true); };
	$('#menuClose').onclick = () => show('#menu', false);
	$('#replayPlay').onclick = () => playReplay();
	addEventListener('keydown', (e) => {
		if (e.code !== 'Space' || S.jur.disabledSpacebar) return;
		const modal = ['#buyMenu', '#menu', '#msg'].some((s) => !$(s).classList.contains('hidden'));
		if (modal) return;
		e.preventDefault();
		if (e.repeat || S.busy) return;
		if (!$('#intro').classList.contains('hidden')) { ($('#intro .cont') as HTMLElement).click(); return; }
		S.replay ? playReplay() : round(spinMode());
	});
	addEventListener('resize', layout);
}
function applyJurisdiction() {
	if (S.jur.disabledBuyFeature) $('#buyBtn').style.display = 'none';
	if (S.jur.disabledAutoplay) $('#autoBtn').style.visibility = 'hidden';
	if (S.jur.disabledTurbo) $('#turboBtn').style.visibility = 'hidden';
	$('#buyBtn').setAttribute('aria-label', t('buyAria')); $('#buyBtn').title = t('buyAria');
	$('#buyTitle').textContent = t('buyTitle');
	$('#betDown').setAttribute('aria-label', t('betDown')); $('#betUp').setAttribute('aria-label', t('betUp'));
	$('#betLabel').textContent = t('betLabel');
}
// Static idle board (no randomness, no win) shown until the first round.
const IDLE = [['H1', 'L2', 'L4', 'H3'], ['L1', 'H2', 'L5', 'L3'], ['H4', 'L3', 'W', 'L1'], ['L5', 'H1', 'L2', 'H2'], ['L4', 'L1', 'H3', 'L5']];

export async function initGame() {
	setLocale(url.lang);
	initLoader(); preloadArt();
	track(initRoxy(layout));
	track(document.fonts?.ready ?? Promise.resolve());
	buildCells(); S.sym = IDLE.map((c) => [...c]); S.vals = new Map([[2 * 4 + 2, 1]]);
	wire(); layout(); setBusy(true);
	try {
		if (url.replay) { setSocial(url.social || isSocialCurrency()); applyJurisdiction(); await track(loadReplay()); await loaderReady(); preloadMaxWin(); }
		else {
			const rd = await track(authenticate());
			setSocial(url.social || !!S.jur.socialCasino || isSocialCurrency());
			applyJurisdiction(); sessionReady = true; setStrip(); resetWinMeter();
			await loaderReady(); layout(); preloadMaxWin();
			setBusy(false);
			await resume(rd);
		}
	} catch (e) { hideLoader(); showError(e); }
	finally { setBusy(false); setStrip(); layout(); document.body.dataset.ready = '1'; }
}
