// Unit test for the v3.9 voice rules in src/game/audio.ts (fake Web Audio, real timers): exactly one voice clip at a
// time across all elves, the 400 ms gap, the single pending high-priority slot, the AudioContext create-retry cap and
// the cleared decode timer; v3.11: voice.ts bet-mode re-arm only counts lines that played. Run by `pnpm test` (node scripts/test-voice.mjs).
import { readFileSync } from 'node:fs';
import { transformWithEsbuild } from 'vite';
const src = readFileSync(new URL('../src/game/audio.ts', import.meta.url), 'utf8');
const { code } = await transformWithEsbuild(src, 'audio.ts', { loader: 'ts', format: 'esm' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const ok = (c, m) => { if (c) console.log('  OK ' + m); else { fail++; console.error('  FAIL ' + m); } };

// ---- fake browser + Web Audio ----
const DUR = 0.3; // every fake clip lasts 300 ms
const W = { live: 0, maxLive: 0, starts: [], decodeTimers: 0, ctor: 0, throwCtor: false };
const listeners = {};
const realSet = setTimeout, realClear = clearTimeout;
globalThis.window = globalThis;
globalThis.localStorage = { m: {}, getItem(k) { return this.m[k] ?? null; }, setItem(k, v) { this.m[k] = String(v); } };
globalThis.location = { search: '' };
globalThis.document = {
	visibilityState: 'visible', body: { classList: { contains: () => false } },
	addEventListener: (e, f) => ((listeners[e] ||= new Set()).add(f)), removeEventListener: (e, f) => listeners[e]?.delete(f),
};
globalThis.addEventListener = () => {};
globalThis.fetch = async (u) => ({ ok: true, arrayBuffer: async () => ({ u }) });
// count 15 s decode timers still pending after decodes settle
globalThis.setTimeout = (f, ms, ...a) => { if (ms === 15000) { W.decodeTimers++; const t = realSet(() => { W.decodeTimers--; f(...a); }, ms); t.unref?.(); return t; } return realSet(f, ms, ...a); };
globalThis.clearTimeout = (t) => { if (t && t._idleTimeout === 15000 && !t._destroyed) W.decodeTimers--; realClear(t); };
class Param { constructor(v) { this.value = v; } cancelScheduledValues() {} setValueAtTime() {} linearRampToValueAtTime(v) { this.value = v; } }
class Node { connect() {} disconnect() {} }
class FakeCtx {
	constructor() { W.ctor++; if (W.throwCtor) throw new Error('blocked'); this.state = 'running'; this.t0 = performance.now(); this.destination = new Node(); }
	get currentTime() { return (performance.now() - this.t0) / 1000; }
	resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); }
	createGain() { const g = new Node(); g.gain = new Param(1); return g; }
	createBuffer() { return { duration: 0 }; }
	createBufferSource() {
		const s = new Node(); s.playbackRate = new Param(1); let on = false, t;
		s.start = () => { if (!s.buffer?.name) return; on = true; W.live++; W.maxLive = Math.max(W.maxLive, W.live); W.starts.push(s.buffer.name);
			t = realSet(() => { if (on) { on = false; W.live--; s.onended?.(); } }, s.buffer.duration * 1000); };
		s.stop = () => { realClear(t); if (on) { on = false; W.live--; realSet(() => s.onended?.(), 0); } };
		return s;
	}
	decodeAudioData(ab, res) { const n = ab.u.split('/').pop().replace('.mp3', ''); const b = { duration: DUR, name: n.startsWith('vo_') || n.startsWith('gig_') ? n : '' }; realSet(() => res(b), 1); return undefined; }
}
const tap = () => [...(listeners.pointerdown || [])].forEach((f) => f());

console.log('\n=== Voice: one clip at a time ===');
{
	globalThis.AudioContext = FakeCtx;
	const A = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
	A.initAudio(); tap();
	for (let i = 0; i < 100 && !A.voiceReady('gig_delilah_3'); i++) await sleep(20);
	ok(A.voiceReady('vo_roxy_bonus_1') && A.voiceReady('gig_delilah_3') && ['roxy','jade','vi','coco','delilah'].every((e) => A.voiceReady(`vo_${e}_mode_1`)), 'all voice (incl. 5 mode lines) buffers loaded after the tap');
	ok(W.decodeTimers === 0, `15 s decode timers cleared on success (pending: ${W.decodeTimers})`);
	// two triggers in the same moment -> one clip
	const a = A.playVoice('vo_roxy_wild_1'), b = A.playVoice('gig_jade_1');
	ok(a === true && b === false && A.voiceStats().started === 1, 'two triggers in the same tick start exactly one clip');
	ok(A.playVoice('gig_roxy_1') === false, 'a giggle never plays over a line');
	ok(A.playVoice('vo_coco_bonus_1', 'high') === false && A.voiceStats().pending === 'vo_coco_bonus_1', 'a high-priority line waits in the single pending slot');
	ok(A.playVoice('vo_vi_maxwin_1', 'high') === false && A.voiceStats().pending === 'vo_coco_bonus_1', 'only ONE pending line (no pile-up)');
	await sleep(DUR * 1000 + 100);
	ok(A.voiceStats().busy && A.playVoice('gig_vi_1') === false, 'nothing starts in the 400 ms gap after a clip');
	await sleep(450);
	ok(W.starts.join() === 'vo_roxy_wild_1,vo_coco_bonus_1', `pending line played after the gap (${W.starts.join()})`);
	await sleep(DUR * 1000 + 450);
	ok(A.playVoice('gig_jade_2') === true, 'free again after clip + gap');
	// burst: 20 requests from every elf at once
	await sleep(DUR * 1000 + 450);
	const names = ['vo_roxy_bonus_1', 'vo_jade_win_1', 'vo_vi_win_1', 'vo_coco_tease_1', 'vo_delilah_maxwin_1', 'gig_roxy_2', 'gig_jade_3', 'gig_vi_2', 'gig_coco_1', 'gig_delilah_1'];
	const before = A.voiceStats().started; let n = 0;
	for (const x of [...names, ...names]) if (A.playVoice(x, 'normal')) n++;
	ok(n === 1 && A.voiceStats().started === before + 1, `20 simultaneous requests -> ${n} clip`);
	await sleep(DUR * 1000 + 600);
	ok(W.maxLive === 1, `never more than one voice source live (max ${W.maxLive})`);
	A.setAudioPref('vox', false);
	ok(A.playVoice('gig_roxy_3') === false, 'Voice switch off: silent');
	ok(localStorage.m['elfhaus.vox'] === '0', 'Voice switch stored as elfhaus.vox');
	A.setAudioPref('vox', true);
}
console.log('\n=== AudioContext create-retry cap ===');
{
	W.throwCtor = true; W.ctor = 0; for (const k in listeners) listeners[k].clear();
	const A = await import('data:text/javascript;base64,' + Buffer.from(code + '\n//2').toString('base64'));
	A.initAudio(); for (let i = 0; i < 10; i++) tap();
	ok(W.ctor === 3, `constructor tried 3 times over 10 taps (got ${W.ctor})`);
	ok(A.playVoice('vo_roxy_bonus_1') === false, 'no context: voice stays silent, no throw');
}
console.log('\n=== v3.11 bet-mode re-arm (src/game/voice.ts) ===');
{
	// voice.ts with its audio / ui imports stubbed: playVoice answers like audio.ts (false while another voice is busy)
	const vsrc = readFileSync(new URL('../src/game/voice.ts', import.meta.url), 'utf8');
	let { code: vc } = await transformWithEsbuild(vsrc, 'voice.ts', { loader: 'ts', format: 'esm' });
	vc = vc.replace(/import\s*\{([^}]*)\}\s*from\s*["']\.\/(?:audio|ui)["'];?/g, (_, n) => `const {${n.replace(/\btype\s+\w+\s*,?/g, '')}} = globalThis.__vstub;`);
	ok(!/^\s*import\s/m.test(vc), 'voice.ts imports stubbed');
	const ELVES = ['roxy', 'jade', 'vi', 'coco', 'delilah'];
	const VS = globalThis.__vstub = { busy: false, played: [], S: { turbo: false, auto: 0, replay: false },
		playVoice: (f) => { if (VS.busy) return false; VS.played.push(f); return true; }, voiceReady: () => true, cancelPendingVoice: () => {},
		VOICE_LINES: Object.fromEntries(ELVES.map((e) => [e, ['wild', 'tease', 'win', 'bonus', 'mode']])) };
	let now = 1e6; const realPerf = globalThis.performance;
	Object.defineProperty(globalThis, 'performance', { value: { now: () => now }, configurable: true, writable: true });
	const V = await import('data:text/javascript;base64,' + Buffer.from(vc).toString('base64'));
	VS.busy = true;
	ok(V.voice('mode', { mode: 'dare' }) === false, 'mode line dropped while another voice is busy');
	VS.busy = false; now += 1000;
	ok(V.voice('mode', { mode: 'dare' }) === true, 'same mode 1 s later plays: the dropped line did NOT start the 20 s re-arm');
	now += 5000;
	ok(V.voice('mode', { mode: 'dare' }) === false, 'same mode 5 s after a line that played stays quiet');
	ok(V.voice('mode', { mode: 'ante' }) === true, 'a different mode still speaks');
	VS.busy = true; now += 16000; // 21 s after the dare line that played
	ok(V.voice('mode', { mode: 'dare' }) === false, 'dropped again (busy) at 21 s');
	VS.busy = false; now += 500;
	ok(V.voice('mode', { mode: 'dare' }) === true, 'and plays at 21.5 s: only played lines arm the guard');
	ok(VS.played.length === 3, `3 mode lines played (${VS.played.join()})`);
	// v3.15b (James): each moment draws only from its own bucket: mode = that elf's giggles, never a tease / win line
	const modes = ['base', 'ante', 'dare', 'double_dare', 'triple_dare', 'egw', 'mystery'];
	VS.played.length = 0;
	for (let i = 0; i < 400; i++) { now += 30000; V.voice('mode', { mode: modes[i % modes.length] }); }
	ok(VS.played.length > 300 && VS.played.every((f) => /^(gig_|vo_\w+_mode_1$)/.test(f)), `mode only plays gig_* / mode lines (${VS.played.length} lines, none vo_*_tease / win)`);
	// v3.15c (James): each bonus pick plays ONLY its own elf's mode line (never a giggle, tease or another elf); Base / Ante giggle
	const ME = { dare: 'roxy', double_dare: 'jade', triple_dare: 'vi', egw: 'coco', mystery: 'delilah' };
	for (const [m, e] of Object.entries(ME)) {
		VS.played.length = 0;
		for (let i = 0; i < 40; i++) { now += 30000; V.voice('mode', { mode: m }); }
		ok(VS.played.length === 40 && VS.played.every((f) => f === `vo_${e}_mode_1`), `${m} pick -> only vo_${e}_mode_1 (${[...new Set(VS.played)].join()})`);
	}
	for (const m of ['base', 'ante']) {
		VS.played.length = 0;
		for (let i = 0; i < 40; i++) { now += 30000; V.voice('mode', { mode: m }); }
		ok(VS.played.length === 40 && VS.played.every((f) => /^gig_/.test(f)), `${m} pick -> giggles only, no mode line / tease`);
	}
	now += 30000; VS.played.length = 0;
	ok(V.voice('mode', { mode: 'dare' }) === true && V.voice('mode', { mode: 'dare' }) === false && VS.played.length === 1, 'same pick twice in a row plays the line once');
	VS.busy = true; ok(V.voice('mode', { mode: 'egw' }) === false, 'mode line never starts over another voice clip'); VS.busy = false;
	ok(V.teaseOk([{ type: 'reveal' }], 0) === true, 'tease allowed: base near miss, no win, no bonus');
	ok(V.teaseOk([{ type: 'reveal' }], 2) === false, 'no tease on a winning round');
	for (const ty of ['buyTriggerStart', 'freeSpinTrigger', 'updateFreeSpin', 'mysteryStart', 'egwStart'])
		ok(V.teaseOk([{ type: ty }, { type: 'reveal' }], 0) === false, `no tease on a buy / bonus round (${ty})`);
	Object.defineProperty(globalThis, 'performance', { value: realPerf, configurable: true, writable: true });
}
console.log(fail ? `\nvoice tests: ${fail} FAILED` : '\nvoice tests: all passed');
process.exit(fail ? 1 : 0);
