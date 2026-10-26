// Sound engine (v3.8): plain Web Audio, no dependency. One AudioContext, master gain -> music bus (with a duck gain)
// and sfx bus. Nothing happens at boot: the context is created / resumed on the first tap (iOS autoplay rule) and only
// then are the mp3s fetched (relative URLs, so the Stake sub-path works) and decoded, UI + reels first, then the base
// music, then the rest. A sound asked for before its buffer is ready is skipped. Every call is fire-and-forget and
// wrapped so a failure (no Web Audio, blocked fetch, bad decode) leaves the game playing silently; nothing awaits audio.
// Settings: Sound (master) / Music / Sound effects, persisted in localStorage elfhaus.snd / .mus / .sfx (default on).
// A launch URL param (sound=0|off|false or mute=1|true) starts the game muted for that session without changing storage.
// v3.9: a third bus for the elf voice lines + giggles (pack/voice, 35 files, loaded last). Voice switch elfhaus.vox
// (default on; master Sound off / URL mute silence it too). STRICT one-at-a-time across every elf: while a clip plays,
// and for VGAP ms after it ends, every new voice request is dropped (never queued), except that ONE high-priority line
// (bonus trigger / max win) may wait in a single pending slot and plays after the gap if it is still within VPEND ms of
// the current clip's end; otherwise it is dropped too. Nothing ever stops a clip early to start another, so two voice
// clips can never sound together. The music bus ducks -8 dB under a line, -4 dB under a giggle (80 ms in, 300 ms out).
// Which elf says what, cooldowns and turbo / autoplay rules live in voice.ts.
const FILES = {
	ui_click: 'assets/audio/ui_click.mp3', ui_bet_up: 'assets/audio/ui_bet_up.mp3', ui_bet_down: 'assets/audio/ui_bet_down.mp3',
	ui_buy_open: 'assets/audio/ui_buy_open.mp3', ui_buy_close: 'assets/audio/ui_buy_close.mp3', ui_mode_arm: 'assets/audio/ui_mode_arm.mp3',
	ui_error: 'assets/audio/ui_error.mp3', reel_spin_start: 'assets/audio/reel_spin_start.mp3', reel_spin_loop: 'assets/audio/reel_spin_loop.mp3',
	reel_stop_1: 'assets/audio/reel_stop_1.mp3', reel_stop_2: 'assets/audio/reel_stop_2.mp3', reel_stop_3: 'assets/audio/reel_stop_3.mp3',
	reel_stop_4: 'assets/audio/reel_stop_4.mp3', reel_stop_5: 'assets/audio/reel_stop_5.mp3',
	music_base_loop: 'assets/audio/music_base_loop.mp3', music_bonus_loop: 'assets/audio/music_bonus_loop.mp3',
	anticipation_riser: 'assets/audio/anticipation_riser.mp3', winline_highlight: 'assets/audio/winline_highlight.mp3',
	win_small: 'assets/audio/win_small.mp3', win_medium: 'assets/audio/win_medium.mp3', win_big: 'assets/audio/win_big.mp3',
	bigwin_sting: 'assets/audio/bigwin_sting.mp3', bigwin_countup_loop: 'assets/audio/bigwin_countup_loop.mp3',
	wild_land: 'assets/audio/wild_land.mp3', wild_sticky_lock: 'assets/audio/wild_sticky_lock.mp3', wild_stack_merge: 'assets/audio/wild_stack_merge.mp3',
	bonus_trigger: 'assets/audio/bonus_trigger.mp3', fs_intro: 'assets/audio/fs_intro.mp3', fs_outro: 'assets/audio/fs_outro.mp3',
} as const;
export type Snd = keyof typeof FILES;
const ORDER: Snd[][] = [
	['ui_click', 'ui_bet_up', 'ui_bet_down', 'ui_buy_open', 'ui_buy_close', 'ui_mode_arm', 'ui_error', 'reel_spin_start', 'reel_spin_loop', 'reel_stop_1', 'reel_stop_2', 'reel_stop_3', 'reel_stop_4', 'reel_stop_5'],
	['music_base_loop'],
	['wild_land', 'winline_highlight', 'win_small', 'win_medium', 'win_big', 'anticipation_riser', 'wild_sticky_lock', 'wild_stack_merge', 'bigwin_sting', 'bigwin_countup_loop', 'bonus_trigger', 'fs_intro', 'fs_outro', 'music_bonus_loop'],
];
// true loop lengths in samples at 44.1 kHz (the encoder adds ~1105 samples of delay + end padding; see loopPoints)
const LOOP_LEN: Partial<Record<Snd, number>> = { music_base_loop: 2454261, music_bonus_loop: 1366214, reel_spin_loop: 44099, bigwin_countup_loop: 88199 };
const SR = 44100, LAME_DELAY = 1105;
const MUSIC: Record<'base' | 'bonus', Snd> = { base: 'music_base_loop', bonus: 'music_bonus_loop' };
const XFADE = 0.8, DUCK = 0.5; // 800 ms music crossfade; ~-6 dB duck
const ELVES = ['roxy', 'jade', 'vi', 'coco', 'delilah'] as const;
export type Elf = (typeof ELVES)[number];
// vo_<elf>_<moment>_1 lines (INTEGRATION_PLAN.md section 6) + gig_<elf>_1..3
export const VOICE_LINES: Record<Elf, string[]> = {
	roxy: ['wild', 'bigwin', 'bonus', 'idle'], jade: ['wild', 'win', 'fsstart', 'tease'], vi: ['wild', 'win', 'tease', 'maxwin'],
	coco: ['wild', 'bonus', 'tease', 'idle'], delilah: ['wild', 'fsstart', 'bigwin', 'maxwin'],
};
const VFILES: string[] = ELVES.flatMap((e) => [...VOICE_LINES[e].map((m) => `vo_${e}_${m}_1`), ...[1, 2, 3].map((n) => `gig_${e}_${n}`)]);
const VGAP = 400, VPEND = 1000; // ms of silence between two clips; how long a pending high-priority line stays relevant
const VDUCK_LINE = 0.398, VDUCK_GIG = 0.631; // -8 dB / -4 dB
const CREATE_TRIES = 3; // AudioContext constructor attempts (one per tap) before giving up for the session

type Pref = 'snd' | 'mus' | 'sfx' | 'vox';
const prefs: Record<Pref, boolean> = { snd: true, mus: true, sfx: true, vox: true };
let urlMute = false;
let ctx: AudioContext | null = null, master: GainNode | null = null, musicBus: GainNode | null = null, duckG: GainNode | null = null, sfxBus: GainNode | null = null;
let vduckG: GainNode | null = null, voxBus: GainNode | null = null;
const buf = new Map<Snd, AudioBuffer>(), vbuf = new Map<string, AudioBuffer>();
let loading = false, hidden = false, createFails = 0, gaveUp = false;
let want: 'base' | 'bonus' | null = null;
let cur: { name: 'base' | 'bonus'; s: AudioBufferSourceNode; g: GainNode } | null = null;
let ducks = 0;

const safe = <T>(f: () => T): T | undefined => { try { return f(); } catch { return undefined; } };
const on = () => prefs.snd && !urlMute;
const now = () => ctx!.currentTime;
const ramp = (p: AudioParam, v: number, s = 0.08) => safe(() => { const t = now(); p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(v, t + s); });

export const audioPrefs = () => ({ ...prefs, muted: urlMute });
export function setAudioPref(k: Pref, v: boolean) {
	prefs[k] = v; if (k === 'snd' && v) urlMute = false;
	safe(() => localStorage.setItem('elfhaus.' + k, v ? '1' : '0'));
	if (on() && !ctx) unlock(); // a tap on the switch is a user gesture
	apply();
}
function apply() {
	if (!ctx) return;
	ramp(master!.gain, on() ? 1 : 0); ramp(musicBus!.gain, prefs.mus ? 1 : 0); ramp(sfxBus!.gain, prefs.sfx ? 1 : 0); ramp(voxBus!.gain, prefs.vox ? 1 : 0);
	if (!on() || !prefs.vox) stopVoice();
	if (on()) load();
	if (on() && prefs.mus) syncMusic(); else stopMusic(0.3);
}

/** Read the stored switches and the launch param; arm the first-tap unlock. Call once at boot (no audio work here). */
export function initAudio() {
	for (const k of ['snd', 'mus', 'sfx', 'vox'] as Pref[]) safe(() => { const v = localStorage.getItem('elfhaus.' + k); if (v != null) prefs[k] = v !== '0'; });
	safe(() => {
		const q = new URLSearchParams(location.search), s = (q.get('sound') ?? q.get('audio') ?? '').toLowerCase(), m = (q.get('mute') ?? '').toLowerCase();
		if (['0', 'off', 'false', 'no'].includes(s) || ['1', 'true', 'on', 'yes'].includes(m)) urlMute = true;
	});
	const evs = ['pointerdown', 'touchend', 'click', 'keydown'];
	const tap = () => { unlock(); if (ctx?.state === 'running' || gaveUp) evs.forEach((e) => document.removeEventListener(e, tap, true)); };
	evs.forEach((e) => document.addEventListener(e, tap, { capture: true, passive: true }));
	document.addEventListener('visibilitychange', () => { hidden = document.visibilityState === 'hidden'; hidden ? suspend() : resume(); });
	addEventListener('pagehide', () => { hidden = true; suspend(); });
	addEventListener('pageshow', () => { hidden = document.visibilityState === 'hidden'; if (!hidden) resume(); });
}
// a voice clip is stopped (not paused) on hide: its end timer keeps running, so a resumed clip could overlap the next one
const suspend = () => safe(() => { stopVoice(); if (ctx && ctx.state === 'running') void ctx.suspend().catch(() => {}); });
const resume = () => safe(() => { if (ctx && ctx.state !== 'running' && !hidden) void ctx.resume().catch(() => {}); });

function unlock() {
	if (!on() || gaveUp) return;
	safe(() => {
		if (!ctx) {
			// v3.9: no Web Audio = give up at once; a throwing constructor is retried on at most CREATE_TRIES taps in total
			const C: typeof AudioContext | undefined = (window as any).AudioContext || (window as any).webkitAudioContext; if (!C) { gaveUp = true; return; }
			try { ctx = new C(); } catch (e) { if (++createFails >= CREATE_TRIES) gaveUp = true; throw e; }
			master = ctx.createGain(); musicBus = ctx.createGain(); duckG = ctx.createGain(); sfxBus = ctx.createGain();
			vduckG = ctx.createGain(); voxBus = ctx.createGain();
			musicBus.connect(duckG); duckG.connect(vduckG); vduckG.connect(master); sfxBus.connect(master); voxBus.connect(master); master.connect(ctx.destination);
			master.gain.value = 1; musicBus.gain.value = prefs.mus ? 1 : 0; sfxBus.gain.value = prefs.sfx ? 1 : 0; voxBus.gain.value = prefs.vox ? 1 : 0;
			// old iOS: a silent one-sample buffer started inside the gesture unlocks output
			const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0);
			if (!want) want = document.body.classList.contains('inBonus') ? 'bonus' : 'base';
		}
		resume(); apply();
	});
}
function load() {
	if (loading || !ctx) return; loading = true;
	const get = (url: string) => fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
		// a decode that never settles (seen in headless Linux WebKit) must not hold up the next group: give up after 15 s
		// (v3.9: the timer is cleared as soon as the decode settles)
		.then((ab) => new Promise<AudioBuffer>((res, rej) => {
			const t = setTimeout(() => rej('timeout'), 15000);
			const ok = (b: AudioBuffer) => { clearTimeout(t); res(b); }, no = (e: unknown) => { clearTimeout(t); rej(e); };
			const p = ctx!.decodeAudioData(ab, ok, no); if (p && (p as any).catch) (p as Promise<AudioBuffer>).catch(no);
		}));
	const one = (n: Snd) => get(FILES[n])
		.then((b) => { buf.set(n, b); if (n === MUSIC.base || n === MUSIC.bonus) syncMusic(); })
		.catch(() => { /* this sound stays silent */ });
	const vone = (n: string) => get(`assets/audio/voice/${n}.mp3`).then((b) => { vbuf.set(n, b); }).catch(() => { /* this line is skipped */ });
	(async () => { for (const grp of ORDER) await Promise.all(grp.map(one)); await Promise.all(VFILES.map(vone)); })().catch(() => {});
}
/** loopStart / loopEnd in seconds: if the decoder kept the mp3 encoder delay (buffer > true length + 20 ms), skip it. */
function loopPoints(n: Snd, b: AudioBuffer) {
	const L = LOOP_LEN[n]; if (!L) return { a: 0, e: b.duration };
	const len = L / SR, a = b.duration > len + 0.02 ? LAME_DELAY / SR : 0;
	return { a, e: Math.min(b.duration, a + len) };
}
function src(n: Snd, bus: GainNode, gain = 1, rate = 1, loop = false) {
	const b = buf.get(n); if (!b || !ctx) return null;
	const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; s.playbackRate.value = rate; g.gain.value = gain;
	let off = 0;
	if (loop) { const p = loopPoints(n, b); s.loop = true; s.loopStart = p.a; s.loopEnd = p.e; off = p.a; }
	s.connect(g); g.connect(bus); s.start(0, off);
	s.onended = () => safe(() => g.disconnect());
	return { s, g };
}
const live = () => !!ctx && on() && prefs.sfx && !hidden && ctx.state === 'running';

export type Handle = { stop: (fadeMs?: number) => void };
const NOOP: Handle = { stop: () => {} };
function handle(x: { s: AudioBufferSourceNode; g: GainNode } | null): Handle {
	if (!x) return NOOP; let done = false;
	return { stop: (ms = 120) => { if (done) return; done = true; safe(() => { ramp(x.g.gain, 0, ms / 1000); x.s.stop(now() + ms / 1000 + 0.02); }); } };
}
const last = new Map<Snd, number>();
/** One-shot sound effect. `throttle` (ms): skip if the same sound started less than that long ago. */
export function sfx(n: Snd, o: { gain?: number; rate?: number; throttle?: number } = {}): Handle {
	return safe(() => {
		if (!live()) return NOOP;
		const t = performance.now();
		if (o.throttle && t - (last.get(n) ?? -1e9) < o.throttle) return NOOP;
		last.set(n, t);
		return handle(src(n, sfxBus!, o.gain ?? 1, o.rate ?? 1));
	}) ?? NOOP;
}
/** Looping sound effect; returns its stop handle. */
export function loop(n: Snd, gain = 1): Handle { return safe(() => (live() ? handle(src(n, sfxBus!, gain, 1, true)) : NOOP)) ?? NOOP; }

/** Switch the music (800 ms crossfade). Safe to call any time; it starts once unlocked and loaded. */
export function music(m: 'base' | 'bonus') { want = m; safe(syncMusic); }
function syncMusic() {
	if (!ctx || !on() || !prefs.mus || !want) return;
	if (cur?.name === want) return;
	const n = MUSIC[want]; if (!buf.has(n)) return; // the old track keeps playing until the new one has decoded
	const x = src(n, musicBus!, 0, 1, true); if (!x) return;
	ramp(x.g.gain, 1, XFADE);
	stopMusic(XFADE);
	cur = { name: want, ...x };
}
function stopMusic(s: number) {
	if (!cur) return; const c = cur; cur = null;
	safe(() => { ramp(c.g.gain, 0, s); c.s.stop(now() + s + 0.05); });
}
/** Music dips ~6 dB while held (counted, so overlapping big moments nest). */
export function duck(hold: boolean) {
	ducks = Math.max(0, ducks + (hold ? 1 : -1));
	if (duckG && ctx) ramp(duckG.gain, ducks ? DUCK : 1, ducks ? 0.15 : 0.6);
}
/** Dip the music for `ms` (one-shot stingers). */
export function duckFor(ms: number) { duck(true); setTimeout(() => duck(false), ms); }

// ---------------------------------------------------------------- voice (v3.9) ----------------------------------------------------------------
export type VoicePri = 'high' | 'normal';
let vcur: { s: AudioBufferSourceNode; g: GainNode } | null = null;
let vBusyUntil = 0;   // performance.now() ms when the current clip ends (0 = none); new clips also wait VGAP after it
let vPending: { name: string; until: number } | null = null, vPendT = 0;
let vStarted = 0;     // clips started this session (smoke tests / debugging)
const vlive = () => !!ctx && on() && prefs.vox && !hidden && ctx.state === 'running';
/** true while a clip plays or within the 400 ms gap after it. */
export const voiceBusy = () => vBusyUntil > 0 && performance.now() < vBusyUntil + VGAP;
export const voiceReady = (name: string) => vbuf.has(name);
export const voiceStats = () => ({ started: vStarted, busy: voiceBusy(), pending: vPending?.name ?? null });
/**
 * Play one voice clip (file stem, e.g. 'vo_roxy_bonus_1'). Returns true if it started now. While another clip plays (or
 * in the gap after it) the request is dropped; a 'high' one instead takes the single pending slot (if empty) and
 * plays after the gap only while still relevant (<= VPEND ms after the current clip ends).
 */
export function playVoice(name: string, pri: VoicePri = 'normal'): boolean {
	return safe(() => {
		if (!vlive() || !vbuf.has(name)) return false;
		if (voiceBusy()) {
			if (pri === 'high' && !vPending && vBusyUntil > 0) {
				vPending = { name, until: vBusyUntil + VGAP + VPEND };
				clearTimeout(vPendT); vPendT = window.setTimeout(firePending, Math.max(0, vBusyUntil + VGAP - performance.now()));
			}
			return false;
		}
		return startVoice(name);
	}) ?? false;
}
function firePending() {
	const p = vPending; vPending = null; if (!p) return;
	if (performance.now() > p.until) return;
	if (voiceBusy()) return; // something else got in (can't happen: every start goes through the busy check)
	safe(() => { if (vlive()) startVoice(p.name); });
}
function startVoice(name: string): boolean {
	const b = vbuf.get(name); if (!b || !ctx) return false;
	const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; g.gain.value = 1;
	s.connect(g); g.connect(voxBus!); s.start(0);
	const x = { s, g }; vcur = x; vStarted++;
	vBusyUntil = performance.now() + b.duration * 1000 + 30;
	if (vduckG) ramp(vduckG.gain, name.startsWith('gig_') ? VDUCK_GIG : VDUCK_LINE, 0.08);
	const end = () => {
		if (vcur !== x) return; vcur = null;
		vBusyUntil = Math.min(vBusyUntil, performance.now());
		if (vduckG) ramp(vduckG.gain, 1, 0.3);
		safe(() => g.disconnect());
	};
	s.onended = end;
	window.setTimeout(end, b.duration * 1000 + 60); // onended can stall while the context is suspended
	return true;
}
/** Hard stop (switch off / mute / hidden): fade 60 ms, drop the pending line. The gap still applies afterwards. */
export function stopVoice() {
	vPending = null; clearTimeout(vPendT);
	const x = vcur; if (!x) return; vcur = null; vBusyUntil = performance.now();
	safe(() => { ramp(x.g.gain, 0, 0.06); x.s.stop(now() + 0.08); if (vduckG) ramp(vduckG.gain, 1, 0.3); });
}
/** Drop a waiting high-priority line (the moment it belonged to is over). */
export function cancelPendingVoice() { vPending = null; clearTimeout(vPendT); }
