// Game controller: RGS flow (authenticate / play / end-round / replay / resume), controls, buy menu, rules, layout.
// Carries the Vault Breakers 3afc6d6 release fixes: rgs_url gating + error modal, bet levels from authenticate,
// balance checks, Space-to-spin, Intl/social currency, replay mode, social wording, jurisdiction flags.
import { skipMerge } from './mergefx';
import { requestAuthenticate, requestBet, requestEndRound, requestReplay } from 'rgs-requests';
// The offline mock RGS (fixture books) exists only in dev (vite dev). In the
// production build import.meta.env.DEV is the literal false (written inline at each use so the bundler can fold
// it), so every mock branch and its dynamic import are dropped from the bundle.
import { API_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import {
	ANTE_COST, CONFIRM_ABOVE_X, fmtX, BUY_MODES, GAME_ID, LINES, MAX_WIN_X, MODES, MODE_LABEL, MYSTERY_ODDS, PAYTABLE,
	SPIN_CAP, START_FS, EPIC_STACK_X, SYMBOL_NAMES, VERSION, isProvisional, oneIn, type ModeKey,
} from './config';
import { confirmCopy, resumeCopy, controlsAuto, controlsBonus, controlsTurbo, controlsUi, costHeader, errorText, errorTitle, modeDesc, turboCopy, type CopyCtx, type CopyMode } from './copy';
import { registerPanel, openPanel, closePanel, isOpen, anyOpen, measurePanel } from './panels';
import { money, mult, setCurrency, setLocale, isSocialCurrency, amountStr } from './format';
import { skipCounts, setAmount } from './countup';
import { tapLines } from './winlines';
import { startShimmer, initWfExpand } from './wildfx';
import { setArmedGlow, wireTapFx } from './uifx';
import { featOpen, featClose } from './featfx';
import { BIGWIN_ELVES_MIN_X, preloadBigWinElves, bigWinElvesStart, bigWinElvesEnd } from './bigwinElves';
import { setBigWinFx } from './ui';
import { initSettings, popOpen, closePop } from './settings';
import { initAudio, sfx } from './audio';
import { initVoiceIdle, voice } from './voice';
import { setSocial, isSocial, t } from './strings';
import { $, S, ART, bet, buildCells, renderAll, renderOverlays, setOverlayHook, resetWinMeter, setWinMeter, banner, wait, waitRaw } from './ui';
import { skipHolds, syncTempo } from './tempo';
import { playBookEvents, endBonusUi } from './bookEventHandlerMap';
import { initRoxy, placeRoxy } from './roxy';
import { initStacks, stackIdle } from './stacks';
import { setBg, warmBg } from './bg';
import { placeAlcove } from './alcove';
import { initLoader, preloadArt, track, loaderReady, hideLoader } from './loader';
import { fitStage, toStage, ST } from './stage';
import { fitStrip, initStripFit } from './stripfit';
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
	// dev-only (vite dev, offline fixture books): in the release build this spread is {} so not even the field names
	// reach the bundle, and a missing rgs_url can only end in the ERR_RGS_URL error screen
	...((import.meta.env.DEV ? { mock: q.get('mock') === 'true' || (!q.get('rgs_url') && !q.get('replay')), book: q.get('book') || '' } : {}) as { mock?: boolean; book?: string }),
};
let sessionReady = false;
let replayState: BookEvent[] = [];
let replayCost = 1;
let replayNoAmt = false; // v3.16 (#172): replay URL had no usable amount, amounts are shown for a 1.00 bet

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
/** v3.9: a player's own bet-mode pick (buy card, Ante switch, armTag / card off = back to base). Any change to a
 *  different mode of the 7 (base, ante, dare, double_dare, triple_dare, mystery, egw) gets one elf line or giggle
 *  (voice.ts: no overlap, same mode within 20 s stays quiet). Bet up / down, replay, turbo and autoplay never call this. */
function pickArm(m: ModeKey | null, ante = false) {
	const was = spinMode(); setArm(m, ante); const now = spinMode();
	if (now !== was) voice('mode', { mode: now });
}
/** v3.16 (#174): replay bar shows the base bet, the mode's cost multiplier and the total. */
function replayLabel() {
	const m = url.mode as ModeKey, name = MODE_LABEL[m] || url.mode;
	return `${name} · ${t('betLabel')} ${money(bet())} × ${mult(replayCost)} = ${money(bet() * replayCost)}${replayNoAmt ? ' (sample)' : ''}`;
}
function setStrip() {
	$('#balance').textContent = S.replay ? '—' : money(S.balance);
	$('#bet').textContent = money(bet() * (S.replay ? replayCost : modeCost(spinMode())));
	$('#betLabel').textContent = t('betLabel');
	if (isOpen('#buyMenu')) paintBuy();
}
function message(title: string, body: string, opts: { reload?: boolean } = {}) {
	$('#msgTitle').textContent = title; $('#msgBody').textContent = body;
	const b = $('#msgOk'); b.textContent = opts.reload ? 'RELOAD' : 'OK';
	b.onclick = () => (opts.reload ? location.reload() : closePanel('#msg'));
	openPanel('#msg');
}
const FATAL = new Set(['ERR_RGS_URL', 'ERR_IS', 'ERR_ATE', 'ERR_BET_LEVELS', 'ERR_REPLAY']);
function showError(error: any) {
	console.warn('RGS error', error); sfx('ui_error');
	const code = error?.error || 'ERR_UE';
	// v3.16 (#77): fixed, social-safe text per RGS code; raw server messages only go to the console
	const text = code === 'ERR_IPB' ? t('noFunds') : errorText(code);
	message(errorTitle(code), `${text} (${code})`, { reload: FATAL.has(code) });
}
function setBusy(b: boolean) {
	S.busy = b; $('#spinBtn').classList.toggle('busy', b);
	['#buyBtn', '#betUp', '#betDown', '#armTag', '#bmUp', '#bmDown'].forEach((s) => (($(s) as HTMLButtonElement).disabled = b || !sessionReady || S.replay));
	($('#autoBtn') as HTMLButtonElement).disabled = S.replay || !sessionReady; // v3.16 (#171); stays live mid-round so it can stop autoplay
	($('#menuBtn') as HTMLButtonElement).disabled = b; if (b) closePop();
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
	if (S.replay) return; // v3.16 (#171)
	const f = readStops(); if (!f || S.busy) return;
	Object.assign(stops, f, { feat: featStop, start: S.balance });
	closePanel('#autoMenu', true);
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

/** Tap / Space during a round: finish the count-ups, the current win line, a merge / stack, every board pause
 *  (tempo.ts holds) and, unless a menu was tapped, land the reels now. */
function skipBoard(reels = true, lines = true) { skipCounts(); if (lines) tapLines(); skipMerge(); skipHolds(); if (reels) hurry(); }

// ---------- RGS round ----------
async function finishRound(round: any) {
	if (round?.active) { // v3.16e (#221): end-round only for an open round (the RGS returns wins active, 0x rounds already closed)
		const end: any = import.meta.env.DEV && url.mock ? await (await import('../mock/mockRgs')).mockEndRound({}) : await requestEndRound({ sessionID: url.sessionID, rgsUrl: url.rgsUrl });
		if (end?.error) throw end;
		if (end?.balance) S.balance = end.balance.amount / API_AMOUNT_MULTIPLIER;
	}
	setStrip();
}
async function round(mode: ModeKey) {
	if (S.replay) { stopAuto(); return; } // v3.16 (#171): a replay never leaves autoplay armed on the spin button
	if (S.busy || !sessionReady) return;
	const cost = modeCost(mode) * bet();
	if (S.balance + 1e-9 < cost) { S.auto = 0; setAuto(); sfx('ui_error'); message('INSUFFICIENT BALANCE', t('noFunds')); return; }
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
	if (!rd?.active || !rd?.state?.length) return; // v3.16d (#221): only an open round is resumed; a settled one never gets end-round
	// v3.16b (#187): round.amount is the BASE bet (the amount sent in /wallet/play; the RGS charges amount x the mode's
	// costMultiplier, and payout = payoutMultiplier x amount: rgs-fetcher schema.ts:170, :195). The resumed round is shown
	// and paid at exactly that stake; the bet level is snapped only for the next new spin, after the round ends.
	const amt = rd.amount > 0 ? rd.amount / API_AMOUNT_MULTIPLIER : 0;
	S.roundBet = amt;
	setArm(null, rd.mode === 'ante');
	setStrip(); setBusy(true);
	// v3.16c (James): ask first. The round's final win (book finalWin, x100) at its own stake, when the book has one.
	const fw = (rd.state as any[]).find((e) => e?.type === 'finalWin');
	const X = fw && Number.isFinite(fw.amount) ? Math.min(fw.amount / 100, MAX_WIN_X) : null;
	// v3.16g (#273): the card shows exactly the amount the HUD win shows after SKIP and the RGS credits (money(), sub-unit
	// places kept: $0.975, $0.001, ¥0.075); only a 0x win uses the no-amount line (v3.16d)
	const pick = await askResume(X != null && X > 0 && amt > 0 ? money(X * amt) : null);
	try {
		if (pick === 'resume') { banner('RESUMING YOUR LAST ROUND', 1600); await waitRaw(600); await playBookEvents(rd.state); await finishRound(rd); }
		else { // SKIP: no animation; end-round credits the win, the HUD win shows the final payout at the round's stake
			await finishRound(rd);
			if (X != null) { S.meterX = X; setAmount($('#win'), X * bet()); }
		}
	}
	catch (e) { showError(e); }
	finally {
		S.roundBet = 0;
		setArm(null, false); // v3.16c (James): after any resumed round (Ante or a buy) the game is back to base; Ante needs its confirm card again
		if (amt > 0 && S.levels.length) S.betIdx = S.levels.reduce((bi, l, k) => (Math.abs(l - amt) < Math.abs(S.levels[bi] - amt) ? k : bi), 0);
		setStrip(); setBusy(false);
	}
}
/** v3.16c: the unfinished-round card; resolves on RESUME or SKIP only (registered closable: false, no X). */
function askResume(amount: string | null): Promise<'resume' | 'skip'> {
	const c = resumeCopy(isSocial(), amount);
	$('#rcTitle').textContent = c.title; $('#rcLine').textContent = c.line;
	$('#rcResume').textContent = c.resume; $('#rcSkip').textContent = c.skip;
	openPanel('#resumeCard');
	return new Promise((res) => {
		const done = (v: 'resume' | 'skip') => { $('#rcResume').onclick = $('#rcSkip').onclick = null; sfx('ui_click'); closePanel('#resumeCard', true); res(v); };
		$('#rcResume').onclick = () => done('resume'); $('#rcSkip').onclick = () => done('skip');
	});
}
async function loadReplay() {
	S.replay = true; document.body.classList.add('replay');
	S.currency = url.currency || 'USD'; setCurrency(S.currency);
	// v3.16 (#172): a missing or bad amount never shows $0.00; amounts are then shown for a 1.00 bet
	S.replayBet = url.amount > 0 ? url.amount / API_AMOUNT_MULTIPLIER : 1; replayNoAmt = !(url.amount > 0);
	if (import.meta.env.DEV && (url.mock || !url.rgsUrl)) {
		const d: any = await (await import('../mock/mockRgs')).mockReplay({ mode: url.mode, event: url.event || url.book || '' });
		replayState = d.state; replayCost = Number(d.costMultiplier) || modeCost(url.mode as ModeKey) || 1;
		$('#replayMode').textContent = replayLabel();
		show('#replayBar', true); setStrip();
		return;
	}
	if (!url.rgsUrl) throw { error: 'ERR_RGS_URL', message: 'Missing rgs_url: the replay cannot be loaded.' };
	const d: any = await requestReplay({ rgsUrl: url.rgsUrl, game: url.game, version: url.version, mode: url.mode, event: url.event });
	if (d?.error) throw d;
	if (!d?.state?.length) throw { error: 'ERR_REPLAY', message: 'The replay returned no round data.' };
	replayState = d.state; replayCost = Number(d.costMultiplier) || modeCost(url.mode as ModeKey) || 1;
	$('#replayMode').textContent = replayLabel();
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
// aifix (audit 5): real in-game art on every card: Dare = a single (per-reel) wild, Double / Triple = the merged 2- and
// 3-elf groups, Elves Gone Wild = the 5-wide group; Mystery Spin is a face-down card with an ink "?" (not the studio logo).
// v3.6: Double / Triple / Elves Gone Wild use the approved stacks r8d stills (scripts/gen-stack-stills.py), not the old
// static WM2 / WM3 / WM5 scenes.
const CARD_ART: Partial<Record<ModeKey, string>> = { dare: ART.W_R1_card || ART.W_R1 || '', double_dare: 'assets/stacks/still/WM2_R1-2.webp', triple_dare: 'assets/stacks/still/WM3_R1-3.webp', egw: 'assets/stacks/still/WM5_R1-5.webp' };
const MYSTERY_CARD = `<svg class="bMyst" viewBox="0 0 100 100" aria-hidden="true"><rect x="23" y="12" width="54" height="76" rx="7" fill="#2A1734" stroke="#E7A6CB" stroke-width="2.5"/>` +
	`<rect x="29" y="18" width="42" height="64" rx="4" fill="none" stroke="#E7A6CB" stroke-width="1" opacity=".55"/><text x="50" y="64" text-anchor="middle" font-family="Cinzel" font-weight="800" font-size="40" fill="#FBEAF4">?</text></svg>`;
function buildBuy() {
	const off = !!S.jur.disabledBuyFeature;
	$('#buyTitle').textContent = t('buyTitle');
	$('#buyCards').classList.toggle('hidden', off);
	$('#buyCards').innerHTML = off ? '' : BUY_MODES.map((m) => {
		const a = CARD_ART[m];
		return `<button class="bcard" data-m="${m}" aria-pressed="false"><span class="bArt">${m === 'mystery' ? MYSTERY_CARD : a ? `<img src="${a}" alt="" draggable="false">` : ''}</span>` +
			`<span class="bName">${MODE_LABEL[m].toUpperCase()}</span><span class="bPrice"></span><span class="bX">${mult(modeCost(m))}</span></button>`;
	}).join('');
	$('#buyCards').querySelectorAll<HTMLElement>('.bcard').forEach((b) => (b.onclick = () => {
		const m = b.dataset.m as ModeKey;
		if (b.classList.contains('off')) return;
		if (armed === m) { pickArm(null); sfx('ui_click'); return; } // tap the active card again to turn it off (back to base: no confirm)
		// v3.13 (James + Stake approval: a mode above CONFIRM_ABOVE_X the base bet is confirmed before it activates): the
		// confirm card (feature, art, short description, amount per spin, CONFIRM; tap outside / Esc = back to the menu).
		// Nothing is charged on CONFIRM either: the mode is armed and the spin button is the one tap that spends.
		if (modeCost(m) > CONFIRM_ABOVE_X) openConfirm(m); else activate(m);
	}));
	paintBuy();
}
/** Copy context for copy.ts (social wording, odds and free-spin counts from the math config). */
const copyCtx = (): CopyCtx => ({
	social: isSocial(), anteX: fmtX(ANTE_COST), anteOdds: oneIn('ante', 68), baseOdds: oneIn('base', 190),
	fs: { dare: START_FS.dare, double_dare: START_FS.double_dare, triple_dare: START_FS.triple_dare }, odds: { ...MYSTERY_ODDS },
});
/** What CONFIRM (or a tap on a mode at or under CONFIRM_ABOVE_X) does: the old one-tap selection. Voice fires here
 *  (pickArm), never on the preview. A bonus closes the menu with the banner; Ante switches on in place. */
function activate(m: ModeKey) {
	if (m === 'ante') { pickArm(null, true); paintBuy(); sfx('ui_mode_arm'); return; }
	pickArm(m); sfx('ui_mode_arm'); closePanel('#buyMenu', true);
	banner(`${MODE_LABEL[m].toUpperCase()} ON · ${money(modeCost(m) * bet())} ${isSocial() ? 'PER PLAY' : 'PER SPIN'}`, 1600);
}
let confirming: ModeKey | null = null;
/** CONFIRM on the bonus confirm card (only from the click handler on #bmConfirm, v3.13e). */
function confirmYes() { const m = confirming; closePanel('#bmConfirm', true); confirming = null; if (m) activate(m); }
function openConfirm(m: ModeKey) {
	confirming = m;
	const c = confirmCopy(m as CopyMode, copyCtx(), MODE_LABEL[m], money(modeCost(m) * bet()), mult(modeCost(m)));
	const a = CARD_ART[m], art = $('.cfArt');
	art.innerHTML = m === 'mystery' ? MYSTERY_CARD : a ? `<img src="${a}" alt="" draggable="false">` : '';
	art.dataset.m = m; art.classList.toggle('hidden', !art.innerHTML);
	$('#cfName').textContent = c.title; $('#cfDesc').textContent = c.desc;
	$('#cfAmount').textContent = c.amount; $('#cfPer').textContent = c.per; $('#cfX').textContent = c.x;
	$('#cfNote').textContent = c.note; $('#cfYes').textContent = c.button; $('#cfHint').textContent = c.hint;
	sfx('ui_click'); openPanel('#bmConfirm');
}
/** Live state: prices at the current bet, affordability, armed card, Ante switch. */
function paintBuy() {
	$('#bmBetV').textContent = money(bet()); $('#bmBet small').textContent = isSocial() ? 'PLAY AMOUNT' : t('betLabel');
	$('#anteCost').textContent = `${money(modeCost('ante') * bet())} · ${fmtX(ANTE_COST)}${isSocial() ? ' play' : ' bet'}`; // v3.15b: live price like the cards
	($('#bmDown') as HTMLButtonElement).disabled = S.busy || S.betIdx <= 0;
	($('#bmUp') as HTMLButtonElement).disabled = S.busy || S.betIdx >= S.levels.length - 1;
	const sw = $('#anteSw'); sw.setAttribute('aria-checked', String(S.ante)); sw.classList.toggle('on', S.ante);
	$('#anteRow').classList.toggle('on', S.ante);
	const tc = turboCopy(isSocial()); $('#turboSub').textContent = tc.sub;
	$('#turboRow').classList.toggle('hidden', !!S.jur.disabledTurbo); syncTurbo();
	$('#buyCards').querySelectorAll<HTMLElement>('.bcard').forEach((b) => {
		const m = b.dataset.m as ModeKey, price = modeCost(m) * bet();
		(b.querySelector('.bPrice') as HTMLElement).textContent = money(price);
		b.classList.toggle('off', price > S.balance + 1e-9);
		b.classList.toggle('armed', armed === m); b.setAttribute('aria-pressed', String(armed === m));
	});
}
function syncTurbo() {
	const on = !!S.turbo, sw = $('#turboSw');
	$('#turboBtn').classList.toggle('on', on); $('#turboBtn').setAttribute('aria-pressed', String(on));
	sw.classList.toggle('on', on); sw.setAttribute('aria-checked', String(on));
	syncTempo();
}
function setTurbo(on: boolean) { if (S.jur.disabledTurbo) return; S.turbo = on; syncTurbo(); }
function betStep(d: number) {
	if (S.busy) return; const was = S.betIdx;
	S.betIdx = Math.max(0, Math.min(S.levels.length - 1, S.betIdx + d)); setArm(armed, S.ante);
	sfx(S.betIdx === was ? 'ui_error' : d > 0 ? 'ui_bet_up' : 'ui_bet_down'); // clamped at the min / max = error
}

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
	const win = isSocial() ? 'wins' : 'pays', cc = copyCtx();
	$('#rulesTitle').textContent = 'GAME INFO';
	$('#rulesBody').innerHTML = `
<h3>How to play</h3>
<p>5 reels × 4 rows with 20 fixed lines. Wins ${isSocial() ? 'are awarded' : 'pay'} left to right for 3, 4 or 5 matching symbols on a line, starting on the leftmost reel. Only the highest win per line counts. Line wins are multiplied by the ${isSocial() ? 'play amount' : 'bet'} per line (the total ${isSocial() ? 'play amount' : 'bet'} divided by 20).</p>
<h3>Wilds and respins</h3>
<p>Wilds substitute for every symbol. Each wild carries its own multiplier, starting at x1. A winning line through a wild triggers a respin: wilds lock, the other symbols of the winning lines respin, and everything else stays. Every locked wild that connects again gains +1. Up to 3 respins per spin; every step ${win} as it lands. Dots on locked wilds show the respins left.</p>
<p>Four wilds on one reel become a full-reel wild worth the sum of their multipliers. A stack completed by wilds that all landed on the same spin is an instant stack. Adjacent full-reel wilds merge into one wide wild worth the product of their values; non-adjacent ones add. A line's multiplier is the product of merged groups plus the sum of the other wilds it uses.</p>
<h3>Dare Cards and free spins</h3>
<p>The Dare Card is the scatter: at most one per reel, it never awards a win and can land on any spin or respin. 3 Dare Cards on the final board start Dare (${START_FS.dare} free spins), 4 start Double Dare (${START_FS.double_dare}). 5 flip the Dare Card: Triple Dare (${START_FS.triple_dare}) or Epic (${START_FS.hidden}).</p>
<p>In Dare, wilds clear after each spin. From Double Dare up, the trigger spin's wilds stay in place for the bonus and all wilds stay locked. Triple Dare starts with at least 1 full-reel wild, Epic with at least 2 (guaranteed stacks are added if missing; Epic's start at x${EPIC_STACK_X} or more). During free spins, 2 Dare Cards add +2 spins and 3 or more add +5, up to ${SPIN_CAP} spins in total.</p>
<h3>Modes</h3>
<p>${(['ante', ...BUY_MODES] as ModeKey[]).map((m) => `<b>${MODE_LABEL[m]}</b> (${mult(modeCost(m))}): ${modeDesc(m as CopyMode, cc)}`).join('<br>')}</p>
<table><tr><th>Mode</th><th>${costHeader(isSocial())}</th><th>RTP</th><th>Max win</th></tr>${modeRows}</table>
<p>Max win is ${MAX_WIN_X.toLocaleString('en-US')}${xb} in every mode. When it is reached, the round ends immediately and awards the max win.${isProvisional() ? ' RTP figures are pending final math.' : ''}</p>
<h3>${isSocial() ? 'Win table' : 'Paytable'}</h3>
<table><tr><th>Symbol</th><th>3</th><th>4</th><th>5</th></tr>${pt}</table>
<p>Values shown in ${xb} for a full line.</p>
<h3>${isSocial() || S.replay ? 'Win lines' : 'Paylines'}</h3><div class="plGrid">${lines}</div><p>20 fixed lines, read left to right from the leftmost reel.</p>
<h3>Controls</h3>
<p>Spin with the round button${S.jur.disabledSpacebar ? '' : ' or the Space bar'}. − and + change the ${isSocial() ? 'play amount' : 'bet'}. ${controlsBonus(cc)}${S.jur.disabledTurbo ? '' : controlsTurbo()}${S.jur.disabledAutoplay ? '' : controlsAuto(cc)}${controlsUi()} Replays never change your balance.</p>
<p>All characters are adults. Elfhaus is a Rizzin Games production.</p>
<h3>Disclaimer</h3><p class="disc">${DISCLAIMER}</p>`;
}

// ---------- layout ----------
const HUD_GAP = 11; // screen px between the board frame's bottom and the HUD's top (incl. the mode tag); the armed glow reaches ~3 px higher, so >= 8 px armed
/** Screen px from the board frame's bottom (board, alcove crown / recess) to the top of the HUD or anything drawn above it. */
function hudGap() {
	const vis = (e: Element) => { const c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden'; };
	let bot = $('#board').getBoundingClientRect().bottom;
	for (const id of ['alcoveCrown', 'alcoveRecess', 'alcoveRail']) { const e = document.getElementById(id); if (e && vis(e)) bot = Math.max(bot, e.getBoundingClientRect().bottom); }
	const hud = $('#hud'), tag = $('#armTag'), hid = tag.classList.contains('hidden');
	if (hid) tag.classList.remove('hidden');
	let top = hud.getBoundingClientRect().top;
	hud.querySelectorAll('*').forEach((e) => { if (!vis(e)) return; const r = e.getBoundingClientRect(); if (r.width && r.height) top = Math.min(top, r.top); });
	if (hid) tag.classList.add('hidden');
	return top - bot;
}
export function layout() {
	// one shared scale (stage.ts): lay out in stage design px; the stage is never 'short' any more
	const st = fitStage(), W = st.w, H = st.h, portrait = st.portrait, short = false;
	requestAnimationFrame(fitStrip); // v3.16f (#194): refit the HUD values once this layout has applied
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
	// Portrait: keep room for Roxy (head to waist) between the title and the board; on short phones (Stake in iPhone
	// Safari, ~390x550 visible) the board gives way a little instead of covering her. Tall phones are unaffected.
	if (portrait && document.body.classList.contains('hasRoxy')) cell = Math.min(cell, (H - used - 72) / 4);
	// Landscape: always leave Roxy her gutter left of the board (placeRoxy shows her only at >= 45% of the stage
	// height; sheet aspect ~0.495, left ~11% empty). Near-square windows (1024x1080, 1280x1024, iPad landscape) used to
	// give the board the whole width and hide her; now the board gives way a little and she stays in the room.
	if (!portrait && document.body.classList.contains('hasRoxy')) cell = Math.min(cell, (W - 2 * Math.ceil(H * 0.46 * 0.495 * 0.89 + 24)) / 5);
	cell = Math.max(1, Math.floor(cell)); // no px floor: it broke the board/Roxy/background proportion in small windows
	document.documentElement.style.setProperty('--cell', cell + 'px');
	S.cell = cell; renderAll();
	// Roxy stands in the room as an animated sprite, so the backgrounds are the Roxy-free paintings.
	placeAlcove(); // board frame B2 layers from #board / #hud (alcove.ts); before setBg so the _fs state applies on first paint
	// v3.6: the board's frame (crown + recess) ends at least HUD_GAP screen px above the HUD's top edge, counting the mode
	// tag over the spin button (measured shown even when no mode is armed, so arming never moves the board); the board
	// shrinks a little rather than overlap.
	for (let i = 0; i < 8 && cell > 1; i++) {
		const d = HUD_GAP - hudGap(); if (d <= 0) break;
		cell = Math.max(1, cell - Math.max(1, Math.ceil(d / ST.s / 4)));
		document.documentElement.style.setProperty('--cell', cell + 'px'); S.cell = cell; renderAll(); placeAlcove();
	}
	setBg(S.inBonus); warmBg(); // base or free-spins painting for this orientation (bg.ts: preloaded, crossfaded)
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
	// Ante off = back to base, no confirm; Ante on goes through the confirm card when it costs more than CONFIRM_ABOVE_X
	$('#anteSw').onclick = () => { if (S.ante) { pickArm(null, false); paintBuy(); sfx('ui_click'); } else if (ANTE_COST > CONFIRM_ABOVE_X) openConfirm('ante'); else activate('ante'); };
	$('#armTag').onclick = () => { if (!S.busy) { pickArm(null); sfx('ui_click'); } };
	// v3.13: one turbo state, two switches (HUD lightning button + the bonus menu Turbo row)
	$('#turboBtn').onclick = () => setTurbo(!S.turbo);
	$('#turboSw').onclick = () => setTurbo(!S.turbo);
	syncTurbo();
	$('#autoBtn').onclick = () => { if (S.auto) return stopAuto(); if (S.busy || S.replay) return; buildAuto(); openPanel('#autoMenu'); };
	$('#autoStart').onclick = startAuto;
	$('#advBtn').onclick = () => { const open = $('#adv').classList.toggle('hidden') === false; $('#advBtn').setAttribute('aria-expanded', String(open)); $('#advBtn').classList.toggle('open', open); measurePanel('#autoMenu'); };
	$('#stFeat').onclick = () => { featStop = !featStop; buildAuto(); };
	['#stLoss', '#stWin', '#stUp'].forEach((id) => {
		const el = $(id) as HTMLInputElement; el.oninput = () => readStops();
		// on blur a valid amount is tidied to the money decimals rule (2 places; more only below one unit when significant)
		el.onchange = () => { const v = parseAmt(el.value); if (v > 0) { el.value = amountStr(v); readStops(); } };
	});
	registerPanel('#buyMenu', { onClose: () => { sfx('ui_buy_close'); closePanel('#bmConfirm', true); } });
	registerPanel('#bmConfirm', { onClose: () => { confirming = null; } });
	{ // 'Tap anywhere to cancel': any tap on the confirm overlay or card cancels, except CONFIRM itself (a drag is not a tap).
		// v3.13e (FSD B1/M1): touch target adjustment can retarget a tap near CONFIRM (e.g. on the hint) onto #cfYes and
		// shifts the click's coordinates, so neither the click target nor the click point is trusted. CONFIRM needs a
		// pointerdown that itself started inside #cfYes (pointerdown is not retargeted), and a drag is real pointer travel
		// (pointermove from the down point, same pointer) over 6 px, or a pointercancel. Keyboard clicks (detail 0) confirm.
		const cf = $('#bmConfirm'); let x0 = 0, y0 = 0, pid = -1, moved = false, downYes = false;
		cf.addEventListener('pointerdown', (e) => { pid = e.pointerId; x0 = e.clientX; y0 = e.clientY; moved = false; downYes = !!(e.target as Element)?.closest?.('#cfYes'); });
		cf.addEventListener('pointermove', (e) => { if (e.pointerId === pid && !moved && Math.hypot(e.clientX - x0, e.clientY - y0) > 6) moved = true; });
		cf.addEventListener('pointercancel', (e) => { if (e.pointerId === pid) moved = true; });
		cf.addEventListener('click', (e) => {
			const yes = (e.target as HTMLElement).closest('#cfYes'), kbd = e.detail === 0, wasMoved = moved, wasYes = downYes;
			moved = false; downYes = false; pid = -1;
			if (kbd) { if (yes) confirmYes(); return; }
			if (wasMoved) return;
			if (yes && wasYes) return confirmYes();
			if (e.target === cf) return; // backdrop already handled by panels.ts
			closePanel('#bmConfirm');
		});
	}
	registerPanel('#autoMenu'); registerPanel('#menu', { onClose: () => ($('#menuBtn') as HTMLElement).focus({ preventScroll: true }) }); // v3.15b (F1)
	registerPanel('#msg', { closable: false }); registerPanel('#resumeCard', { closable: false }); // v3.16c
	$('#buyBtn').onclick = () => { sfx('ui_buy_open'); buildBuy(); openPanel('#buyMenu'); };
	initSettings(() => { buildRules(); openPanel('#menu'); });
	$('#replayPlay').onclick = () => playReplay();
	addEventListener('keydown', (e) => {
		if (e.code !== 'Space' || S.jur.disabledSpacebar) return;
		if (anyOpen() || popOpen()) return;
		e.preventDefault();
		if (S.auto) { stopAuto(); return; }
		if (S.busy) { if (!e.repeat) skipBoard(); return; } // Space mid-round = the same skip as a tap on the board
		if (e.repeat) return;
		if (!$('#intro').classList.contains('hidden')) { ($('#intro .cont') as HTMLElement).click(); return; }
		S.replay ? playReplay() : round(spinMode());
	});
	// plain button clicks (the buy menu, bet steps, mode arming and errors play their own sounds above)
	document.addEventListener('click', (e) => {
		const b = (e.target as Element)?.closest?.('#menuBtn,.mX,#turboBtn,#turboSw,#autoBtn,#autoStart,#advBtn,#msgOk,#replayPlay,.chip,#popMenu .pmRow,#stFeat') as HTMLButtonElement | null;
		if (b && !b.disabled) sfx('ui_click');
	});
	addEventListener('resize', layout);
	initStripFit(); // v3.16f (#194): HUD values shrink to fit on landscape phones
	// iOS reports the new size late after a rotation: lay out again once it has settled
	addEventListener('orientationchange', () => { setTimeout(layout, 120); setTimeout(layout, 500); });
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
	initAudio(); initVoiceIdle(); // reads the sound switches; audio itself starts on the first tap
	initLoader(); preloadArt();
	// any tap lands a running count-up on its final value (the big-win banner handles its own taps)
	startShimmer(); wireTapFx();
	// big-win banner moments: burst + confetti on open (no star glints on the tier titles), the character layer from 1000x
	setBigWinFx({
		// backup trigger for the lazy elf sheets (playBookEvents normally started the decode when the book arrived)
		start: (B, x) => { featOpen(B.querySelector('.bwFx')); if (x >= BIGWIN_ELVES_MIN_X) void preloadBigWinElves(); },
		tier: () => {},                                                // round 6: no star glints on the win screens
		// the Vi / Roxy / Coco group (bigwinElves.ts, BIGWIN_ELVES_MIN_X = 1000) rises in as the count crosses 1000x
		chars: (B) => bigWinElvesStart(B, 1000),
		end: (B) => { featClose(B.querySelector('.bwFx')); bigWinElvesEnd(); },
	});
	// v3.15d: taps on a menu / panel / confirm card (or that close one) do not count toward the win lines' 2-tap zip
	document.addEventListener('pointerdown', (e) => { const t = e.target as Element; if (!t?.closest?.('#bigwin,#outro')) { const ui = !!t?.closest?.('#menu,#popMenu,#buyMenu,#bmConfirm,#autoMenu,#msg,#resumeCard'); skipBoard(false, !ui && !t?.closest?.('#menuBtn,#buyBtn,#autoBtn,#turboBtn,#betUp,#betDown') && !anyOpen() && !popOpen()); if (!ui) hurry(); } }, { capture: true, passive: true });
	track(initRoxy(layout));
	loadAllFx(track).then(() => renderAll());
	setOverlayHook(stackIdle); initStacks().then(() => renderOverlays(false)); void initWfExpand(); // optional stack / per-reel expand sheets (placeholders until imported)
	track(document.fonts?.ready ?? Promise.resolve());
	buildCells(); S.sym = IDLE.map((c) => [...c]); S.vals = new Map([[2 * 4 + 2, 1]]);
	wire(); layout(); setBusy(true);
	try {
		// v3.16b (#188): currency first, so XSC / XGC replays are social even without social=true
		if (url.replay) { setCurrency(url.currency || 'USD'); setSocial(url.social || isSocialCurrency()); applyJurisdiction(); await track(loadReplay()); await loaderReady(); }
		else {
			const rd = await track(authenticate());
			setSocial(url.social || !!S.jur.socialCasino || isSocialCurrency());
			applyJurisdiction(); sessionReady = true; setStrip(); resetWinMeter();
			await loaderReady(); layout();
			setBusy(false);
			await resume(rd);
		}
		if (!url.replay) S.ready = true; // voice idle timer waits for this
	} catch (e) { hideLoader(); showError(e); }
	finally { setBusy(false); setStrip(); layout(); document.body.dataset.ready = '1'; }
}
