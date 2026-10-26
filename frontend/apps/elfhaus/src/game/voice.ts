// v3.9 elf voice lines + giggles: WHO says WHAT and WHEN. Owner rule (overrides INTEGRATION_PLAN.md section 6 frequency):
// voices are a once-in-a-while treat, not chatter. Playback, the strict one-clip-at-a-time rule (no overlap, ever), the
// 400 ms gap, the single pending high-priority slot and the music duck live in audio.ts.
//   ALWAYS (still never over another clip): bonus trigger / mystery hit (Roxy / Coco), free spins start (Jade / Delilah;
//     Delilah alone for the hidden / Epic tier), max win (Vi / Delilah), and the player picking a different bet mode (any
//     of the 7: base, ante, dare, double_dare, triple_dare, mystery, egw; game.ts pickArm): that mode's elf says her
//     mode line (v3.15c; Base / Ante: a giggle); the same mode again within VOICE.modeRearmMs stays quiet; bet up / down, turbo and autoplay never speak
//   RARE (one shared budget): big win (Roxy / Delilah), medium win 2x..<10x (Jade / Vi), first wild of a spin (that reel's
//     elf: W_R1 Roxy .. W_R5 Delilah, line or giggle), full-reel stack reaction (giggle), near miss (Jade / Vi / Coco
//     tease) -> at most one per VOICE.rareMinMs, and then only with VOICE.rareChance
//   IDLE (Roxy / Coco): after VOICE.idleMs without input in the base game, at most once per VOICE.idleEveryMs
//   Turbo or autoplay: ALWAYS triggers only. Never the same file twice in a row.
import { playVoice, voiceReady, cancelPendingVoice, VOICE_LINES, type Elf } from './audio';
import { S } from './ui';

/** Every tuning number for the voices, in one place. */
export const VOICE = {
	rareMinMs: 60_000,     // RARE moments: at most one every 60 s ...
	rareChance: 0.15,      // ... and then only ~15% of the time
	idleMs: 180_000,       // idle line after 3 min without input (base game, not turbo / autoplay / bonus)
	idleEveryMs: 180_000,  // and at most once per 3 min
	modeRearmMs: 20_000,   // the same bet mode re-armed within 20 s stays quiet
	bigWinDelayMs: 400,    // big / max win line starts this long after the sting
	// audio.ts: one clip at a time, 400 ms gap after each clip, one pending high-priority line kept <= 1 s past the
	// current clip's end, music duck -8 dB under a line / -4 dB under a giggle
};

export type Moment = 'wild' | 'stack' | 'win' | 'bigwin' | 'tease' | 'bonus' | 'fsstart' | 'maxwin' | 'mode' | 'idle';
const REEL_ELF: Elf[] = ['roxy', 'jade', 'vi', 'coco', 'delilah'];
// bet mode -> elf: Dare's card is Roxy (W_R1), Double Dare adds Jade, Triple Dare adds Vi, Elves Gone Wild is the
// whole crew (Coco, the queen, speaks for it), Mystery is Delilah (soft, mysterious). Base / Ante: any elf.
const MODE_ELF: Record<string, Elf> = { dare: 'roxy', double_dare: 'jade', triple_dare: 'vi', egw: 'coco', mystery: 'delilah' };
const POOL: Partial<Record<Moment, Elf[]>> = {
	win: ['jade', 'vi'], bigwin: ['roxy', 'delilah'], bonus: ['roxy', 'coco'], fsstart: ['jade', 'delilah'],
	tease: ['jade', 'vi', 'coco'], maxwin: ['vi', 'delilah'], idle: ['roxy', 'coco'],
};
const ALWAYS = new Set<Moment>(['bonus', 'fsstart', 'maxwin', 'mode']);
const RARE = new Set<Moment>(['bigwin', 'win', 'wild', 'stack', 'tease']);
const HIGH = new Set<Moment>(['bonus', 'maxwin']); // may wait in audio.ts's single pending slot

let spin = 0, wildSpin = -1, lastFile = '', lastRare = -1e9, lastIdle = -1e9, lastInput = performance.now();
const lastMode = new Map<string, number>();
let rnd = Math.random;
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length) % a.length];
const gig = (e: Elf) => [1, 2, 3].map((n) => `gig_${e}_${n}`);
const line = (e: Elf, m: string) => (VOICE_LINES[e].includes(m) ? [`vo_${e}_${m}_1`] : []);

/** v3.15b: the near-miss tease bucket is for a real near miss only: no win and no bonus of any kind in the round
 *  (no bought trigger, Mystery, EGW or free spins: buy rounds and bought bonus spins never tease). */
export function teaseOk(events: { type: string }[], win: number) {
	return !(win > 0) && !events.some((e) => /^(freeSpin|updateFreeSpin|buyTrigger|mystery|egw)/.test(e.type));
}

/** Call once per round: ends the wild-once-per-spin window and drops a stale pending line. */
export function voiceSpin() { spin++; cancelPendingVoice(); }

/** Ask for a voice moment. `reel` (0-based) picks the elf for wild / stack; `tier` steers free spins start; `mode` = bet mode. */
export function voice(m: Moment, o: { reel?: number; tier?: string; mode?: string } = {}): boolean {
	try {
		const quick = S.turbo || !!S.auto;
		if (quick && !ALWAYS.has(m)) return false;
		if (S.replay && m === 'idle') return false;
		const t = performance.now();
		if (m === 'wild') { if (wildSpin === spin) return false; wildSpin = spin; } // first wild of the spin only
		if (m === 'mode' && t - (lastMode.get(o.mode || '?') ?? -1e9) < VOICE.modeRearmMs) return false; // re-arm only counts from a line that played
		if (RARE.has(m)) { if (t - lastRare < VOICE.rareMinMs || rnd() >= VOICE.rareChance) return false; }
		let files: string[];
		if (m === 'wild' || m === 'stack') {
			const e = REEL_ELF[o.reel ?? -1] ?? pick(REEL_ELF);
			files = m === 'stack' ? gig(e) : rnd() < 0.5 ? line(e, 'wild') : gig(e);
		} else if (m === 'mode') {
			// v3.15c (James): a bonus pick (CONFIRM of Dare / Double Dare / Triple Dare / EGW / Mystery) is that elf's own mode
			// line only ("Mmmm... I choose dare!"), replacing the giggles; Base / Ante keep a random elf's giggle. Never a tease or win line.
			const e = MODE_ELF[o.mode || ''];
			files = e ? line(e, 'mode') : gig(pick(REEL_ELF));
		} else {
			let elves = POOL[m] ?? [];
			if (m === 'fsstart' && o.tier && /hidden|myst/i.test(o.tier)) elves = ['delilah'];
			files = elves.flatMap((e) => line(e, m));
		}
		files = files.filter((f) => voiceReady(f));
		if (files.length > 1) files = files.filter((f) => f !== lastFile);
		if (!files.length) return false;
		const f = pick(files);
		if (!playVoice(f, HIGH.has(m) ? 'high' : 'normal')) return false;
		lastFile = f; if (RARE.has(m)) lastRare = t; if (m === 'idle') lastIdle = t; if (m === 'mode') lastMode.set(o.mode || '?', t);
		return true;
	} catch { return false; }
}

/** Idle line: VOICE.idleMs without input in the base game (not spinning, no bonus, no turbo / autoplay). */
export function initVoiceIdle() {
	const poke = () => { lastInput = performance.now(); };
	['pointerdown', 'keydown'].forEach((e) => document.addEventListener(e, poke, { capture: true, passive: true }));
	setInterval(() => {
		const t = performance.now();
		if (!S.ready || S.busy || S.inBonus || S.auto || S.turbo || document.visibilityState === 'hidden') { if (S.busy) lastInput = t; return; }
		if (t - lastInput < VOICE.idleMs || t - lastIdle < VOICE.idleEveryMs) return;
		if (voice('idle')) lastInput = t;
	}, 5000);
}
