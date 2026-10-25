// Game controller: RGS flow (authenticate / play / end-round / replay / resume), controls, buy menu, rules, layout.
// Carries the Vault Breakers 3afc6d6 release fixes: rgs_url gating + error modal, bet levels from authenticate,
// balance checks, Space-to-spin, Intl/social currency, replay mode, social wording, jurisdiction flags.
import { requestAuthenticate, requestBet, requestEndRound, requestReplay } from 'rgs-requests';
// The offline mock RGS (fixture books) exists only in dev (vite dev). In the
// production build import.meta.env.DEV is the literal false (written inline at each use so the bundler can fold
// it), so every mock branch and its dynamic import are dropped from the bundle.
import { API_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import {
	ANTE_COST, fmtX, BUY_MODES, CONFIRM_ABOVE_X, GAME_ID, LINES, MAX_WIN_X, MODES, MODE_DESC, MODE_LABEL, MYSTERY_ODDS, PAYTABLE,
	SPIN_CAP, START_FS, SYMBOL_NAMES, VERSION, isProvisional, type ModeKey,
} from './config';
import { money, mult, setCurrency, setLocale, isSocialCurrency, amountStr } from './format';
import { skipCounts } from './countup';
import { tapLines } from './winlines';
import { startShimmer } from './wildfx';
import { setArmedGlow, wireTapFx } from './uifx';
import { featOpen, featPop, featClose } from './featfx';
import { preloadBigWinElves, bigWinElvesStart, bigWinElvesEnd } from './bigwinElves';
import { setBigWinFx } from './ui';
import { setSocial, isSocial, t } from './strings';
import { $, S, ART, bet, buildCells, renderAll, renderOverlays, resetWinMeter, setWinMeter, banner, wait } from './ui';
import { playBookEvents, endBonusUi } from './bookEventHandlerMap';
import { initRoxy, placeRoxy } from './roxy';
import { initLoader, preloadArt, track, loaderReady, hideLoader } from './loader';
import { preloadMaxWin } from './maxwin';
import { fitStage, toStage } from './stage';
import { placeRespin } from './respin';
import { loadAllFx } from './fx';
import { startSpin, abortSpin, hurry } from './reels';
import { hideRespin } from './respin';
import type { BookEvent } from './typesBookEvent';

const DISCLAIMER =
	'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Engine.';

const q = new URLSearchParams(location.search);
const url = {
	sessionID: q.get('sessionID') || '', rgsUrl: q.get('rgs_url') || '', lang: q.get('lang') || 'en',
	currency: q.get('currency') || '', social: q.get('social') === 'true', replay: q.get('replay') === 'true',
	game: q.get('game') || GAME_ID, version: q.get('version') || VERSION, mode: q.get('mode') || 'base',
	event: q.get('event') || '', amount: Number(q.get('amount')) || 0,
	mock: import.meta.env.DEV && (q.get('mock') === 'true' || (!q.get('rgs_url') && !q.get('replay'))),
	book: q.get('book') || '',
};
let sessionReady = false;
let replayState: BookEvent[] = [];
let replayCost = 1;

// ---------- small helpers ----------
const show = (sel: string, on: boolean) => $(sel).classList.toggle('hidden', !on);
const modeCost = (m: ModeKey) => (m === 'ante' ? ANTE_COST : MODES[m]?.cost ?? 1);
// Activated mode (Stake-style): a bonus armed in the bonus menu, or Ante. It stays armed for every spin press
// (and autoplay) until the player turns it off or picks another; buys and Ante are mutually exclusive.
let armed: ModeKey | null = null;
const spinMode = (): ModeKey => armed ?? (S.ante ? 'ante' : 'base');
const SHORT: Partial<Record<ModeKey, string>> = { ante: 'ANTE', dare: 'DARE', double_dare: 'DOUBLE', triple_dare: 'TRIPLE', mystery: 'MYSTERY', egw: 'EGW' };
function setArm(m: ModeKey | null, ante = false) {
	armed = m; S.ante = !m && ante;
	const mode = spinMode(), on = mode !== 'base';
	$('#spinBtn').classList.toggle('armed', on); setArmedGlow($('#spinBtn'), on);
	const tag = $('#armTag'); tag.classList.toggle('hidden', !on);
	($('#armTag .t') as HTMLElement).textContent = SHORT[mode] ?? '';
	tag.setAttribute('aria-label', on ? `${MODE_LABEL[mode]} active, tap to turn off` : '');
	$('#spinBtn').setAttribute('aria-label', on ? `Spin: ${MODE_LABEL[mode]} at ${money(bet() * modeCost(mode))}` : 'Spin');
	setStrip();
}
function setStrip() {
	$('#balance').textContent = S.replay ? '—' : money(S.balance);
	$('#bet').textContent = money(bet() * (S.replay ? replayCost : modeCost(spinMode())));
	$('#betLabel').textContent = t('betLabel');
	if (!$('#buyMenu').classList.contains('hidden')) paintBuy();
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
	['#buyBtn', '#betUp', '#betDown', '#armTag', '#bmUp', '#bmDown'].forEach((s) => (($(s) as HTMLButtonElement).disabled = b || !sessionReady));
	($('#menuBtn') as HTMLButtonElement).disabled = b;
}
// ---------- autoplay (Stake-style panel) ----------
// Counts only (no infinite: the RGS jurisdiction config has no flag that allows it). Optional stops, in currency:
// net loss reached, a single round win at least X, balance up by X (net = balance now - balance at start, so the
// cost of an armed bonus / Ante is included), and any feature trigger (natural or Mystery; with a bought bonus armed
// the bought trigger itself doesn't count, or every buy would stop it). The spin button shows the spins left;
// pressing spin (or the autoplay button, or Space) stops it.
const AUTO_COUNTS = [10, 25, 50, 100, 250, 500, 1000];
let autoPick = 10, featStop = false;
const stops = { loss: 0, win: 0, up: 0, feat: false, start: 0 };
let featHit = false;
const setAuto = () => {
	$('#autoBtn').classList.toggle('on', S.auto > 0); $('#spinBtn').classList.toggle('auto', S.auto > 0);
	$('#autoN').textContent = S.auto > 0 ? String(S.auto) : '';
	$('#spinBtn').setAttribute('aria-label', S.auto > 0 ? `Stop autoplay (${S.auto} left)` : 'Spin');
};
const stopAuto = () => { S.auto = 0; setAuto(); };
const parseAmt = (v: string) => { const x = v.trim().replace(',', '.'); if (!x) return 0; return /^\d*\.?\d+$|^\d+\.$/.test(x) ? Number(x) : NaN; };
function readStops() {
	const f = { loss: parseAmt(($('#stLoss') as HTMLInputElement).value), win: parseAmt(($('#stWin') as HTMLInputElement).value), up: parseAmt(($('#stUp') as HTMLInputElement).value) };
	let err = '';
	(['loss', 'win', 'up'] as const).forEach((k) => {
		const bad = !Number.isFinite(f[k]) || f[k] < 0 || f[k] > 1e9;
		$({ loss: '#stLoss', win: '#stWin', up: '#stUp' }[k]).classList.toggle('bad', bad);
		if (bad) err = 'Enter an amount, or leave it empty for off.';
	});
	if (!err && f.loss > 0 && f.loss < modeCost(spinMode()) * bet()) err = `Loss limit is below one spin (${money(modeCost(spinMode()) * bet())}).`;
	$('#autoErr').textContent = err; ($('#autoStart') as HTMLButtonElement).disabled = !!err;
	return err ? null : f;
}
function buildAuto() {
	$('#autoCounts').innerHTML = AUTO_COUNTS.map((n) => `<button role="radio" aria-checked="${n === autoPick}" class="chip${n === autoPick ? ' on' : ''}" data-n="${n}">${n}</button>`).join('');
	$('#autoCounts').querySelectorAll<HTMLElement>('.chip').forEach((c) => (c.onclick = () => { autoPick = Number(c.dataset.n); buildAuto(); }));
	const sw = $('#stFeat'); sw.classList.toggle('on', featStop); sw.setAttribute('aria-checked', String(featStop));
	['#stLoss', '#stWin', '#stUp'].forEach((id) => (($(id) as HTMLInputElement).placeholder = `Off · ${S.currency}`));
	readStops();
}
function startAuto() {
	const f = readStops(); if (!f || S.busy) return;
	Object.assign(stops, f, { feat: featStop, start: S.balance });
	show('#autoMenu', false);
	S.auto = autoPick; setAuto(); round(spinMode());
}
/** After each autoplay round: the reason to stop, or '' to go on. */
function autoStopReason(roundWin: number) {
	const net = S.balance - stops.start;
	if (stops.loss > 0 && -net >= stops.loss - 1e-9) return 'loss';
	if (stops.win > 0 && roundWin >= stops.win - 1e-9) return 'win';
	if (stops.up > 0 && net >= stops.up - 1e-9) return 'up';
	if (stops.feat && featHit) return 'feature';
	return '';
}

// ---------- RGS round ----------
async function finishRound(round: any) {
	if (round?.active || (round?.payoutMultiplier ?? 0) > 0 || (round?.payout ?? 0) > 0) {
		const end: any = import.meta.env.DEV && url.mock ? await (await import('../mock/mockRgs')).mockEndRound({}) : await requestEndRound({ sessionID: url.sessionID, rgsUrl: url.rgsUrl });
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
	// base-game state never carries: clear last spin's stacks, then the reels start turning at the press
	S.full.clear(); S.groups = []; S.vals.clear(); renderOverlays(false); hideRespin();
	// cells hidden under last round's full-reel wilds must spin again (a hidden cell is skipped by startSpin,
	// so its reel would "land" instantly at reveal: the bonus-buy reel-5-first bug)
	document.querySelectorAll<HTMLElement>('#cells .cell').forEach((c) => { c.classList.remove('locked'); c.style.visibility = ''; });
	startSpin();
	try {
		const data: any = import.meta.env.DEV && url.mock
			? await (await import('../mock/mockRgs')).mockBet({ currency: S.currency, amount: bet(), mode, forcedBook: url.book || undefined })
			: await requestBet({ sessionID: url.sessionID, rgsUrl: url.rgsUrl, currency: S.currency, amount: bet(), mode });
		if (data?.error) throw data;
		if (data?.balance) S.balance = data.balance.amount / API_AMOUNT_MULTIPLIER;
		setStrip();
		const rd = data?.round;
		const evs = (rd?.state || []) as BookEvent[];
		featHit = evs.some((e: any) => e.type === 'freeSpinTrigger' && e.source !== 'buy') || evs.some((e: any) => e.type === 'mysteryResult' && e.outcome !== 'none');
		await playBookEvents(evs);
		await finishRound(rd);
		if (S.auto > 0 && autoStopReason(S.meterX * bet())) stopAuto();
	} catch (e) {
		stopAuto(); endBonusUi(); abortSpin(); renderAll(); showError(e);
	} finally { setBusy(false); }
	if (S.auto > 0) { S.auto--; setAuto(); if (S.auto) setTimeout(() => { if (S.auto) round(spinMode()); }, 300); }
}

// ---------- startup ----------
async function authenticate() {
	if (import.meta.env.DEV && url.mock) {
		const a = await (await import('../mock/mockRgs')).mockAuthenticate({ language: url.lang, currency: url.currency || undefined });
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
	setArm(null, rd.mode === 'ante');
	setStrip(); banner('RESUMING YOUR LAST ROUND', 1600);
	setBusy(true);
	try { await wait(600); await playBookEvents(rd.state); await finishRound({ ...rd, active: true }); }
	catch (e) { showError(e); } finally { setBusy(false); }
}
async function loadReplay() {
	S.replay = true; document.body.classList.add('replay');
	S.currency = url.currency || 'USD'; setCurrency(S.currency);
	S.replayBet = url.amount / API_AMOUNT_MULTIPLIER || 0;
	if (import.meta.env.DEV && (url.mock || !url.rgsUrl)) {
		const d: any = await (await import('../mock/mockRgs')).mockReplay({ mode: url.mode, event: url.event || url.book });
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

// ---------- bonus menu: Ante toggle, activate a bonus, bet -/+ with live prices ----------
const CARD_ART: Partial<Record<ModeKey, string>> = { dare: 'W', double_dare: 'WM2', triple_dare: 'WM3', mystery: 'buy_icon', egw: 'WF' };
function buildBuy() {
	const off = !!S.jur.disabledBuyFeature;
	$('#buyTitle').textContent = t('buyTitle');
	$('#anteCost').textContent = fmtX(ANTE_COST);
	$('#buyCards').classList.toggle('hidden', off);
	$('#buyCards').innerHTML = off ? '' : BUY_MODES.map((m) => {
		const a = CARD_ART[m] && ART[CARD_ART[m]!];
		return `<button class="bcard" data-m="${m}" aria-pressed="false"><span class="bArt${m === 'egw' ? ' tall' : ''}">${a ? `<img src="${a}" alt="" draggable="false">` : ''}</span>` +
			`<span class="bName">${MODE_LABEL[m].toUpperCase()}</span><span class="bPrice"></span><span class="bX">${mult(modeCost(m))}</span></button>`;
	}).join('');
	$('#buyCards').querySelectorAll<HTMLElement>('.bcard').forEach((b) => (b.onclick = () => {
		const m = b.dataset.m as ModeKey;
		if (b.classList.contains('off')) return;
		if (armed === m) { setArm(null); return; } // tap the active card again to turn it off
		const go = () => { show('#buyConfirm', false); setArm(m); show('#buyMenu', false); };
		if (modeCost(m) <= CONFIRM_ABOVE_X) return go();
		$('#buyConfirmText').textContent = `${MODE_LABEL[m]} · ${money(modeCost(m) * bet())} ${isSocial() ? 'per play' : 'per spin'}`;
		$('#buyConfirmNote').textContent = m === 'mystery' ? `Every Mystery Spin shows a 3-wild tease; the result is decided before the reveal. Odds: No bonus ${MYSTERY_ODDS.none}% · Double Dare ${MYSTERY_ODDS.double_dare}% · Triple Dare ${MYSTERY_ODDS.triple_dare}% · Hidden ${MYSTERY_ODDS.hidden}%.` : '';
		$('#buyYes').onclick = go;
		show('#buyConfirm', true);
	}));
	paintBuy();
}
/** Live state: prices at the current bet, affordability, armed card, Ante switch. */
function paintBuy() {
	$('#bmBetV').textContent = money(bet()); $('#bmBet small').textContent = t('betLabel');
	($('#bmDown') as HTMLButtonElement).disabled = S.busy || S.betIdx <= 0;
	($('#bmUp') as HTMLButtonElement).disabled = S.busy || S.betIdx >= S.levels.length - 1;
	const sw = $('#anteSw'); sw.setAttribute('aria-checked', String(S.ante)); sw.classList.toggle('on', S.ante);
	$('#anteRow').classList.toggle('on', S.ante);
	$('#buyCards').querySelectorAll<HTMLElement>('.bcard').forEach((b) => {
		const m = b.dataset.m as ModeKey, price = modeCost(m) * bet();
		(b.querySelector('.bPrice') as HTMLElement).textContent = money(price);
		b.classList.toggle('off', price > S.balance + 1e-9);
		b.classList.toggle('armed', armed === m); b.setAttribute('aria-pressed', String(armed === m));
	});
}
function betStep(d: number) { if (S.busy) return; S.betIdx = Math.max(0, Math.min(S.levels.length - 1, S.betIdx + d)); setArm(armed, S.ante); }

// ---------- rules (C14/C32/C33/C34) ----------
function buildRules() {
	const xb = isSocial() ? 'x play' : 'x bet';
	const pct = (r: number | null) => (r == null ? 'pending final math' : (r * (r <= 1 ? 100 : 1)).toFixed(2) + '%');
	const modeRows = (['base', 'ante', ...BUY_MODES] as ModeKey[]).map((m) =>
		`<tr><td>${MODE_LABEL[m]}</td><td>${mult(modeCost(m))}</td><td>${pct(MODES[m]?.rtp ?? null)}</td><td>${(MODES[m]?.maxWinX ?? MAX_WIN_X).toLocaleString('en-US')}x</td></tr>`).join('');
	const pt = Object.entries(PAYTABLE).map(([s, p]) =>
		`<tr><td>${ART[s] ? `<img class="ri" src="${ART[s]}" alt="">` : ''}${SYMBOL_NAMES[s]}</td>${p.map((v) => `<td>${mult(v / 20)}</td>`).join('')}</tr>`).join('');
	// Paylines: one 5x4 mini-grid per line, drawn from LINES (the math config's line table), path cells filled + a line through them.
	const C = 12, G = 2, W5 = 5 * C + 4 * G, H4 = 4 * C + 3 * G, ctr = (i: number) => i * (C + G) + C / 2;
	const lines = LINES.map((ln, i) => {
		const cells = Array.from({ length: 20 }, (_, j) => { const r = j % 5, row = Math.floor(j / 5), on = ln[r] === row;
			return `<rect x="${r * (C + G)}" y="${row * (C + G)}" width="${C}" height="${C}" rx="2.5" class="${on ? 'on' : ''}"/>`; }).join('');
		const path = ln.map((row, r) => `${ctr(r)},${ctr(row)}`).join(' ');
		return `<figure class="pl" aria-label="Line ${i + 1}: rows ${ln.map((r) => r + 1).join('-')}"><figcaption>${i + 1}</figcaption>` +
			`<svg viewBox="-1 -1 ${W5 + 2} ${H4 + 2}" aria-hidden="true">${cells}<polyline points="${path}"/></svg></figure>`;
	}).join('');
	const win = isSocial() ? 'wins' : 'pays';
	$('#rulesTitle').textContent = 'GAME RULES';
	$('#rulesBody').innerHTML = `
<h3>How to play</h3>
<p>5 reels × 4 rows with 20 fixed lines. Wins ${isSocial() ? 'are awarded' : 'pay'} left to right for 3, 4 or 5 matching symbols on a line, starting on the leftmost reel. Only the highest win per line counts. Line wins are multiplied by the ${isSocial() ? 'play amount' : 'bet'} per line (the total ${isSocial() ? 'play amount' : 'bet'} divided by 20).</p>
<h3>Wilds and respins</h3>
<p>Wilds substitute for every symbol. Each wild carries its own multiplier, starting at x1. A winning line through a wild triggers a respin: wilds lock, the other symbols of the winning lines respin, and everything else stays. Every locked wild that connects again gains +1. Up to 3 respins per spin; every step ${win} as it lands. While respins run, the three small dots on each locked wild and stack show the respins left in this spin. When a feature is close, the next reels hold a little longer before they stop.</p>
<p>Four wilds on one reel become a full-reel wild worth the sum of their multipliers (they fly together into one number). A stack completed by wilds that all landed on the same spin is an instant stack. Adjacent full-reel wilds merge into one wide wild worth the product of their values, shown as one number; non-adjacent ones add. A line's multiplier is the product of merged groups plus the sum of the other wilds it uses.</p>
<h3>Dare Cards and free spins</h3>
<p>The Dare Card is the scatter: at most one per reel, it never pays and can land on any spin or respin. 3 Dare Cards on the final board start Dare (${START_FS.dare} free spins), 4 start Double Dare (${START_FS.double_dare}). 5 flip the Dare Card: Triple Dare (${START_FS.triple_dare}) or Epic (${START_FS.hidden}).</p>
<p>In Dare, wilds clear after each spin. From Double Dare up, the trigger spin's wilds stay in place for the bonus and all wilds stay locked. Triple Dare starts with at least 1 full-reel wild, Epic with at least 2 (guaranteed stacks are added if missing). During free spins, 2 Dare Cards add +2 spins and 3 or more add +5, up to ${SPIN_CAP} spins in total.</p>
<h3>Modes</h3>
<p>${(['ante', ...BUY_MODES] as ModeKey[]).map((m) => `<b>${MODE_LABEL[m]}</b> (${mult(modeCost(m))}): ${MODE_DESC[m]}`).join('<br>')}</p>
<table><tr><th>Mode</th><th>Cost</th><th>RTP</th><th>Max win</th></tr>${modeRows}</table>
<p>Max win is ${MAX_WIN_X.toLocaleString('en-US')}${xb} in every mode. When it is reached, the round ends immediately and awards the max win.${isProvisional() ? ' RTP figures are pending final math.' : ''}</p>
<h3>${isSocial() ? 'Win table' : 'Paytable'}</h3>
<table><tr><th>Symbol</th><th>3</th><th>4</th><th>5</th></tr>${pt}</table>
<p>Values shown in ${xb} for a full line.</p>
<h3>Paylines</h3><div class="plGrid">${lines}</div><p>20 fixed lines, read left to right from the leftmost reel.</p>
<h3>Controls</h3>
<p>Spin with the round button${S.jur.disabledSpacebar ? '' : ' or the Space bar'}. − and + change the ${isSocial() ? 'play amount' : 'bet'}. The bonus button opens the bonus menu: switch Ante (${mult(ANTE_COST)}, raises the chance of a natural bonus) on or off, or tap a bonus to activate it; the menu shows each price at the current ${isSocial() ? 'play amount' : 'bet'} and has its own − and +. An active mode shows a small tag above the spin button and stays on for every spin (and autoplay) until you tap the tag, tap the bonus again, or pick another; each spin then costs that mode's price.${S.jur.disabledTurbo ? '' : ' Turbo speeds up animations.'}${S.jur.disabledAutoplay ? '' : ' Autoplay opens a panel: pick 10 to 1,000 spins and, under Advanced, optional stops on a net loss, a single win of at least an amount, a balance increase, or any feature trigger. Net loss and gain count every spin\'s full cost, including an active bonus or Ante. Autoplay also stops on any error or low balance; the spin button shows the spins left, and pressing it stops autoplay.'} Replays never change your balance.</p>
<p>All characters are adults. Elfhaus is a Rizzin Games production.</p>
<h3>Disclaimer</h3><p class="disc">${DISCLAIMER}</p>`;
}

// ---------- layout ----------
export function layout() {
	// one shared scale (stage.ts): lay out in stage design px; the stage is never 'short' any more
	const st = fitStage(), W = st.w, H = st.h, portrait = st.portrait, short = false;
	document.body.classList.toggle('portrait', portrait);
	document.body.classList.toggle('short', short && !portrait);
	// Vertical budget: title + control panel + the fsBar/step-message rows that sit in the stage grid above and
	// below the board (the grid is symmetric, so reserve the larger of the two on both sides).
	const top = short ? 0 : ($('#top').offsetHeight || 0), hud = $('#hud').offsetHeight || 0;
	// fsBar is hidden (0 high) outside bonuses, so size its lane from the CSS font clamp (14-20px, 2.6vh) instead.
	const fsH = Math.round(Math.min(20, Math.max(14, H * 0.026)) * 1.4 + 10) + 6;
	// The landscape fsBar tucks 10px into the board's bezel; FRAME = bezel + padding around the 4 rows.
	const lane = short ? 16 : portrait ? 42 : Math.max(fsH - 14, 26), FRAME = short || portrait ? 0 : 34;
	const used = top + hud + 2 * lane + FRAME + (short ? 14 : portrait ? 30 : 12);
	let cell = portrait ? Math.min((W - 40) / 5, (H - used) / 4) : Math.min((H - used) / 4, (W - 120) / 5);
	cell = Math.max(1, Math.floor(cell)); // no px floor: it broke the board/Roxy/background proportion in small windows
	document.documentElement.style.setProperty('--cell', cell + 'px');
	S.cell = cell; renderAll();
	// Roxy stands in the room as an animated sprite, so the backgrounds are the Roxy-free paintings.
	const bgArt = (portrait && ART.background_portrait) || ART.background;
	if (bgArt) { $('#bg').classList.add('art'); $('#bg').style.backgroundImage = `url(${bgArt})`; }
	const fr = toStage($('#frame').getBoundingClientRect());
	document.documentElement.style.setProperty('--gutR', Math.max(0, W - fr.right) + 'px');
	document.documentElement.style.setProperty('--frB', Math.round(fr.bottom) + 'px');
	placeRoxy(portrait, fr);
	placeRespin();
}

// ---------- wiring ----------
function wire() {
	$('#spinBtn').onclick = () => { if (S.auto) return stopAuto(); S.replay ? playReplay() : round(spinMode()); };
	$('#betUp').onclick = () => betStep(1);
	$('#betDown').onclick = () => betStep(-1);
	$('#bmUp').onclick = () => betStep(1);
	$('#bmDown').onclick = () => betStep(-1);
	$('#anteSw').onclick = () => { setArm(null, !S.ante); paintBuy(); };
	$('#armTag').onclick = () => { if (!S.busy) setArm(null); };
	$('#turboBtn').onclick = () => { S.turbo = !S.turbo; $('#turboBtn').classList.toggle('on', S.turbo); };
	$('#autoBtn').onclick = () => { if (S.auto) return stopAuto(); if (S.busy) return; buildAuto(); show('#autoMenu', true); };
	$('#autoClose').onclick = () => show('#autoMenu', false);
	$('#autoStart').onclick = startAuto;
	$('#advBtn').onclick = () => { const open = $('#adv').classList.toggle('hidden') === false; $('#advBtn').setAttribute('aria-expanded', String(open)); $('#advBtn').classList.toggle('open', open); };
	$('#stFeat').onclick = () => { featStop = !featStop; buildAuto(); };
	['#stLoss', '#stWin', '#stUp'].forEach((id) => {
		const el = $(id) as HTMLInputElement; el.oninput = () => readStops();
		// on blur a valid amount is tidied to the money decimals rule (2 places; more only below one unit when significant)
		el.onchange = () => { const v = parseAmt(el.value); if (v > 0) { el.value = amountStr(v); readStops(); } };
	});
	$('#buyBtn').onclick = () => { buildBuy(); show('#buyConfirm', false); show('#buyMenu', true); };
	$('#buyClose').onclick = () => { show('#buyMenu', false); show('#buyConfirm', false); };
	$('#buyNo').onclick = () => show('#buyConfirm', false);
	$('#menuBtn').onclick = () => { buildRules(); show('#menu', true); };
	$('#menuClose').onclick = () => show('#menu', false);
	$('#replayPlay').onclick = () => playReplay();
	addEventListener('keydown', (e) => {
		if (e.code !== 'Space' || S.jur.disabledSpacebar) return;
		const modal = ['#buyMenu', '#autoMenu', '#menu', '#msg'].some((s) => !$(s).classList.contains('hidden'));
		if (modal) return;
		e.preventDefault();
		if (S.auto) { stopAuto(); return; }
		if (e.repeat || S.busy) return;
		if (!$('#intro').classList.contains('hidden')) { ($('#intro .cont') as HTMLElement).click(); return; }
		S.replay ? playReplay() : round(spinMode());
	});
	addEventListener('resize', layout);
	addEventListener('orientationchange', () => setTimeout(layout, 120));
	visualViewport?.addEventListener('resize', layout);
}
function applyJurisdiction() {
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
	// any tap lands a running count-up on its final value (the big-win banner handles its own taps)
	startShimmer(); wireTapFx();
	// big-win banner moments: burst + confetti on open, a star pop on each tier title, the character layer from 1000x
	setBigWinFx({
		start: (B) => featOpen(B.querySelector('.bwFx')),
		tier: (B) => featPop(B.querySelector('.bwTier')),
		// the Vi / Roxy / Coco group (bigwinElves.ts, BIGWIN_ELVES_MIN_X = 1000) rises in as the count crosses 1000x
		chars: (B) => bigWinElvesStart(B, 1000),
		end: (B) => { featClose(B.querySelector('.bwFx')); bigWinElvesEnd(); },
	});
	const ric = (window as any).requestIdleCallback as ((f: () => void, o?: object) => void) | undefined;
	setTimeout(() => (ric ? ric(() => preloadBigWinElves(), { timeout: 5000 }) : preloadBigWinElves()), 2500);
	document.addEventListener('pointerdown', (e) => { if (!(e.target as Element)?.closest?.('#bigwin,#outro')) { skipCounts(); tapLines(); if (!(e.target as Element)?.closest?.('#menu,#buyMenu,#autoMenu,#msg')) hurry(); } }, { capture: true, passive: true });
	track(initRoxy(layout));
	loadAllFx(track).then(() => renderAll());
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
