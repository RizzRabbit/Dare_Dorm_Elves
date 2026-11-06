// Regression for the mobile reload: DragonBones armatures left on the world clock, atlas refcount,
// merge-snapshot size past the WebGL max texture, and breadcrumbs that survive the reload.
// Pure modules only (no Pixi). Source guards pin the call sites that free the GPU / clock.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
let fail = 0;
const ok = (c, m) => { if (c) console.log('  OK ' + m); else { fail++; console.error('  FAIL ' + m); } };

const store = new Map();
globalThis.sessionStorage = {
	getItem: (k) => (store.has(k) ? store.get(k) : null),
	setItem: (k, v) => { store.set(k, String(v)); },
	removeItem: (k) => { store.delete(k); },
};
store.set('eh.diag.v1', JSON.stringify([{ t: 1, k: 'pagehide', d: { phase: 'merge', live: 12 } }]));
const heard = [];
const origInfo = console.info.bind(console);
console.info = (...a) => { heard.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); origInfo(...a); };
const listeners = new Map();
globalThis.addEventListener = (type, fn) => {
	if (!listeners.has(type)) listeners.set(type, []);
	listeners.get(type).push(fn);
};

const { snapshotPixels, stillResolution, releaseArmatures, createRigCache } = await import('../src/game/riglife.ts');
const diag = await import('../src/game/diag.ts');

console.log('\n=== reload: snapshot size ===');
{
	const wide = snapshotPixels(8000, 1800);
	const oldR = Math.min(1, 512 / 1800) * 2;
	const oldW = Math.floor(8000 * oldR);
	ok(oldW > 4096, `old wide snapshot was ${oldW}px (past a 4096 max texture)`);
	ok(wide.w <= 2048 && wide.h <= 1024, `wide snapshot is ${wide.w}x${wide.h}`);
	const tall = snapshotPixels(600, 2000);
	const oldTall = Math.min(1, 512 / 2000) * 2;
	ok(Math.abs(tall.r - oldTall) < 1e-9, `tall rig keeps the old height budget (${tall.r} vs ${oldTall})`);
	ok(tall.h <= 1024 && tall.w <= oldTall * 600 + 1, 'tall snapshot does not get larger');
	const still = stillResolution(3000, 400);
	ok(still === Math.min(1, 900 / 400, 2048 / 3000) && still <= 2048 / 3000, `still resolution capped (${still})`);
	ok(snapshotPixels(100, 100).w === 200 && snapshotPixels(100, 100).h === 200, 'small rig stays at resolution 2');
}

console.log('\n=== reload: armature clock ===');
{
	const clock = [];
	const arm = () => {
		const a = { buffered: false, armature: { dispose() { a.buffered = true; } } };
		clock.push(a);
		return a;
	};
	const flush = (dt) => {
		if (dt !== 0) throw new Error('flush dt ' + dt);
		for (let i = clock.length - 1; i >= 0; i--) if (clock[i].buffered) clock.splice(i, 1);
	};
	for (let m = 0; m < 40; m++) for (let i = 0; i < 5; i++) arm();
	flush(0);
	ok(clock.length === 200, `without dispose, 40 merges leave ${clock.length} armatures on the clock`);
	clock.length = 0;
	let flushes = 0;
	for (let m = 0; m < 40; m++) {
		const batch = Array.from({ length: 5 }, arm);
		releaseArmatures(batch, (dt) => { flushes++; flush(dt); });
	}
	ok(flushes === 40 && clock.length === 0, `dispose + advanceTime(0) clears the clock (${clock.length} left, ${flushes} flushes)`);
}

console.log('\n=== reload: atlas refcount ===');
{
	const c = createRigCache();
	const resident = new Set();
	const pin = (n) => { c.pin(n); resident.add(n); };
	const unpin = (n) => { if (c.unpin(n)) resident.delete(n); };
	pin('WF_R1'); pin('WF_R2');
	pin('WF_R1'); unpin('WF_R1');
	ok(c.pinned('WF_R1') === 1 && resident.has('WF_R1'), 'sticky re-render pins the replacement before the old one stops');
	unpin('WF_R1'); unpin('WF_R2');
	ok(!resident.has('WF_R1') && !resident.has('WF_R2'), 'merge unpin drops the singles');
	pin('WM2_R1-2');
	ok(resident.size === 1 && resident.has('WM2_R1-2'), 'group atlas is the only resident after the merge');

	const bonus = createRigCache();
	const held = new Set();
	let built = 0;
	const names = ['WF_R1', 'WF_R2', 'WF_R3', 'WF_R4', 'WF_R5'];
	for (const n of names) { bonus.pin(n); held.add(n); built++; }
	for (let spin = 0; spin < 18; spin++) {
		for (let rebuild = 0; rebuild < 4; rebuild++) {
			for (const n of names) { bonus.pin(n); held.add(n); built++; }
			for (const n of names) if (bonus.unpin(n)) held.delete(n);
		}
	}
	ok(built === names.length * (1 + 18 * 4), `bonus rebuilt ${built} rig displays`);
	ok(held.size === names.length && names.every((n) => bonus.pinned(n) === 1), `resident stays the ${held.size} on-screen rigs, not the cumulative rebuilds`);

	const p = createRigCache();
	p.begin('WF_R1'); p.pin('WF_R1');
	ok(p.unpin('WF_R1') === false && p.busy('WF_R1'), 'unpin while a load is in flight does not evict');
	ok(p.end('WF_R1') === true && !p.busy('WF_R1'), 'the load finishing after the last pin is the evict');
	p.begin('WF_R2'); p.pin('WF_R2');
	ok(p.end('WF_R2') === false && p.unpin('WF_R2') === true, 'a load that finishes while pinned waits for the last unpin');
}

console.log('\n=== reload: breadcrumbs ===');
{
	diag.installDiag(() => ({ live: 4, atlases: 2 }));
	ok(heard.some((s) => s.includes('last session') && s.includes('merge')), 'next boot prints the previous pagehide');
	ok(diag.diagLog().some((c) => c.k === 'pagehide' && c.d?.phase === 'merge'), 'previous merge crumb is still in the ring');
	ok(diag.diagLog().some((c) => c.k === 'boot'), 'boot crumb appended on install');
	listeners.get('pagehide').forEach((fn) => fn());
	const hide = diag.diagLog().at(-1);
	ok(hide?.k === 'pagehide' && hide.d?.phase === 'boot' && hide.d?.live === 4 && hide.d?.atlases === 2, 'pagehide records phase and rig stats');
	diag.diagReset();
	diag.crumb('x', { sessionID: 'abc', token: 'sekrit', bet: 5, balance: 9, msg: 'player@mail.com token=sekrit rgs_url=https://x.test/play?sessionID=sekrit' });
	const row = JSON.stringify(diag.diagLog().at(-1));
	ok(!/sekrit|mail\.com|sessionID|\?|"bet"|"balance"|"token"|"abc"/.test(row), 'secrets, bet and balance are not stored: ' + row);
	ok(row.includes('[redacted]') && row.includes('[email]'), 'a message that mentioned them keeps only the redaction');
	diag.diagReset();
	diag.setPhase('merge', { live: 5 });
	diag.setPhase('merge');
	ok(diag.diagLog().filter((c) => c.k === 'phase').length === 1, 'same phase without extra counts is one crumb');
	diag.setPhase('merge', { live: 1 });
	ok(diag.diagLog().filter((c) => c.k === 'phase').length === 2, 'a merge before/after count is kept');
	diag.diagReset();
	for (let i = 0; i < 40; i++) diag.crumb('n', { i });
	const log = diag.diagLog();
	ok(log.length === 32 && log.at(-1)?.d?.i === 39 && log[0]?.d?.i === 8, `ring keeps the newest 32 (len ${log.length})`);
	const cv = { addEventListener(t, fn) { this[t] = fn; } };
	let prevented = false;
	diag.watchCanvas(cv, 'board');
	cv.webglcontextlost({ preventDefault() { prevented = true; } });
	ok(prevented && diag.diagLog().some((c) => c.k === 'webgl-lost' && c.d?.canvas === 'board'), 'context loss is recorded and not a reload');
	let resized = null;
	diag.releaseIntroGpu({ renderer: { resize: (w, h, r) => { resized = [w, h, r]; } } });
	ok(resized?.[0] === 1 && resized?.[1] === 1 && resized?.[2] === 1, 'intro renderer shrinks to 1x1');
}

console.log('\n=== reload: source guards ===');
{
	const db = src('../src/game/dbstacks.ts');
	const stop = db.slice(db.indexOf('export function dbStop'), db.indexOf('export async function dbStill'));
	const still = db.slice(db.indexOf('export async function dbStill'));
	ok(stop.includes('releaseArmatures') && still.includes('releaseArmatures'), 'dbStop and dbStill flush disposed armatures');
	ok(/unpin\(name\)\) evictRig/.test(db) || /unpin\(name\)\) evictRig/.test(db.replace(/\s+/g, ' ')), 'a dropped pin evicts the atlas');
	ok(db.includes('snapshotPixels') && db.includes('stillResolution'), 'snapshots use the capped resolution');
	ok(db.includes('rigs.pin(name)') && db.indexOf('rigs.pin(name)') < db.indexOf('await initDbStacks'), 'dbPlay pins before its first await');
	const intro = src('../src/game/introPixi.ts');
	const finish = intro.slice(intro.indexOf('function finish()'), intro.indexOf('function onKey'));
	ok(finish.includes('releaseIntroGpu(app)') && !finish.includes('app.destroy'), 'intro finish frees the framebuffer without destroying the shared renderer');
	ok(intro.includes("watchCanvas(cv, 'intro')"), 'intro canvas watches context loss');
	const game = src('../src/game/game.ts');
	const reloads = [...game.matchAll(/location\.reload\(\)/g)];
	ok(reloads.length === 1, `one explicit reload (${reloads.length})`);
	const line = game.split('\n').find((l) => l.includes('location.reload()')) || '';
	ok(line.includes("crumb('explicit-reload'"), 'that reload writes a breadcrumb first');
	const round = game.slice(game.indexOf('async function round('), game.indexOf('// ---------- startup'));
	ok(/setPhase\('spin'\)/.test(round) && /setPhase\('idle'\)/.test(round), 'a round records spin and idle');
	ok(!/setArm\(|pickArm\(|armed\s*=/.test(round), 'round() still never disarms');
	const fe = src('../src/game/bookEventHandlerMap.ts');
	const feFn = fe.slice(fe.indexOf('export function feError'));
	ok(feFn.includes("crumb('fe'"), 'feError persists a scrubbed crumb');
	ok(fe.includes("setPhase('bonus')") && fe.includes("setPhase('base')"), 'bonus start and end change phase');
	const merge = src('../src/game/mergefx.ts');
	ok(merge.includes("setPhase('merge', dbStats())") && merge.includes("setPhase(S.inBonus ? 'bonus' : 'board', dbStats())"), 'merge records before and after');
	const mirror = src('../src/game/board/mirror.ts');
	ok(mirror.includes('t.destroy(true)') && mirror.includes('releaseOut(x)'), 'a dropped lean snapshot destroys its GPU texture');
	const stage = src('../src/game/board/stage.ts');
	const scene = src('../src/game/scene/scene.ts');
	ok(stage.includes("watchCanvas(cv, 'board')") && scene.includes("watchCanvas(cv, 'scene')"), 'board and room canvases watch context loss');
	const all = src('../src/game/game.ts') + fe + merge + db;
	ok((all.match(/location\.reload\(\)/g) || []).length === 1, 'merge and bonus paths do not reload');
	ok(root.endsWith('/'), 'app root resolved');
}

console.log(fail ? `\nreload tests: ${fail} FAILED` : '\nreload tests: all passed');
process.exit(fail ? 1 : 0);
