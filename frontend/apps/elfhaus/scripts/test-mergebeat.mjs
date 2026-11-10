// Merge clock and choreography. Durations are real milliseconds (turbo × 0.6). A tap advances one stage.
// Joining rigs are snapshotted at rest and released before the lean; the snapshots crouch and lean in-cell.
import { readFileSync } from 'node:fs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mergeAmp, mergeLean, mergeMs, leanWithinCell, MERGE_BEAT, MERGE_HIT, MERGE_MAX_DROP } from '../src/game/mergeclock.ts';

const require = createRequire(import.meta.url);
const app = fileURLToPath(new URL('..', import.meta.url));
let fail = 0;
const ok = (c, m) => { if (c) console.log('  OK ' + m); else { fail++; console.error('  FAIL ' + m); } };
const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

console.log('\n=== merge clock (same ms at any refresh rate) ===');
ok(MERGE_BEAT === 400 && MERGE_HIT === 50, 'beat is 400 ms and the hit pause is 50 ms');
ok(mergeMs(400, false) === 400 && mergeMs(50, false) === 50, 'normal pace keeps the written milliseconds');
ok(mergeMs(400, true) === 240 && mergeMs(50, true) === 30, 'turbo is 60% (240 ms and 30 ms)');
ok(mergeMs(0, false) === 0 && mergeMs(0, true) === 0, 'a zero delay stays zero');
ok(mergeAmp(false) === 1 && mergeAmp(true) === 0.5, 'reduced motion halves amplitude and does not change the clock');

console.log('\n=== merge source guards ===');
{
	const mf = src('../src/game/mergefx.ts');
	const db = src('../src/game/dbstacks.ts');
	const body = mf.slice(mf.indexOf('export async function mergeIn'));
	const rel = body.indexOf('stackRelease(olds)');
	const prep = body.indexOf('stackPrepare(reels)');
	const beat = body.indexOf('await beat(MERGE_BEAT)');
	ok(prep > 0 && rel > beat, 'group prepares during the lean; singles release at the hit');
	ok(body.indexOf("dbPlay(o, 'win'") > 0 && body.indexOf("dbPlay(o, 'win'") < beat, 'live rigs play a win clip before the first beat');
	ok(body.includes('skipping = false'), 'turbo does not snap the merge');
	ok(body.includes('cut()') && body.includes("crumb('merge'"), 'an animation error still applies the merge and does not reject');
	ok(!/createLinearGradient|box-shadow|linear-gradient|radial-gradient/.test(mf), 'no drawn gradients or shadows');
	ok(mf.includes("play('fx_wild'") && mf.includes("play('fx_feat', 'burst'"), 'flash and snow reuse the existing fx sheets');
	ok(mf.includes('trailBetween'), 'gem flights reuse the snowflake trail');
	ok(db.includes('offset.rotation') && db.includes('dbNudge'), 'the settle nudges hat and hair bones');
	ok(db.includes('resolution: r') && /resolution:\s*'inherit'/.test(src('../src/game/board/glowFilter.ts')), 'snapshot cap and win-glow inherit stay');
	ok(src('../src/game/wintrail.ts').includes('export function trailBetween'), 'trail helper is exported');
	const pose = mergeLean(110, 2, 1);
	ok(leanWithinCell(pose.crouch) && leanWithinCell(pose.over) && leanWithinCell(pose.pull),
		`lean poses stay inside the cell (max ${MERGE_MAX_DROP} px)`);
	ok(mergeAmp(true) === 0.5, 'reduced motion is an amplitude');
}

console.log('\n=== merge play (groups, turbo, skip, bonus) ===');
let chrome = '';
try { chrome = require('node:child_process').execSync('command -v google-chrome || command -v google-chrome-stable', { encoding: 'utf8' }).trim().split('\n').pop(); } catch { /* none */ }
let esbuild = null;
try { esbuild = await import('esbuild'); } catch { /* optional */ }
if (!chrome || !esbuild) {
	console.log(`  SKIP play probe (chrome=${chrome || 'missing'}, esbuild=${esbuild ? 'yes' : 'missing'})`);
} else {
	const dir = await mkdtemp(join(tmpdir(), 'mergebeat-'));
	const stub = join(dir, 'stub.mjs');
	const entry = join(dir, 'entry.mjs');
	const bundle = join(dir, 'bundle.js');
	const html = join(dir, 'page.html');
	await writeFile(stub, `
export const S = globalThis.__S;
export const $ = (s) => document.querySelector(s);
export function setGem(el, v) { el.dataset.v = String(v); el.textContent = 'x' + v; }
export function gemHTML() { return '<b class="mx"></b>'; }
export function ovMx(r) { return document.querySelector('[data-gem="' + r + '"]'); }
export function cellEl() { return document.createElement('div'); }
export function pos(r) { return { x: 20 + r * 100, y: 0 }; }
export function ovArt(ov) { return [...ov.children]; }
export function preloadStacks() { return Promise.resolve(); }
export const T = (ms) => ms * 2;
export function hideGem(m) { if (m) { m.style.visibility = 'hidden'; m.style.opacity = '0'; } }
export function clearCoveredGems() {
  document.querySelectorAll('.cell').forEach((el) => {
    if (el.style.visibility === 'hidden') el.querySelectorAll('.mx').forEach(hideGem);
  });
}
export function grab(mxs) {
  const src = mxs.filter(Boolean);
  const clones = src.map((m) => {
    const c = m.cloneNode(true); c.className += ' fly'; c.style.cssText = 'position:absolute;left:0;top:0;width:40px;height:20px';
    document.getElementById('flyLayer').appendChild(c); return c;
  });
  src.forEach(hideGem);
  return clones;
}
export function toStage(r) { return r; }
export function wfExpand() {}
export function hasStack() { return false; }
export function stackOnce() { return Promise.resolve(); }
export function stackLetters() { return true; }
export function stackWin() {}
export function stackWinOff() {}
export function stackPrepare(reels) { globalThis.__log.push('prepare:' + reels.join(',')); return Promise.resolve(); }
export function stackRelease(olds) { globalThis.__log.push('release:' + olds.length); }
export function stackWarm() { return Promise.resolve(); }
export function stackReact() {}
export function stackReactSkip() {}
export function dbDisplay(cv) { return cv.dataset.live === '1' ? {} : null; }
export function dbKnown() { return false; }
export function dbNudge() { globalThis.__nudges++; }
export function dbPlay() { return Promise.resolve(false); }
export function dbSnapshot() { return null; }
export function dbStats() { return { live: 0 }; }
export function canvasRev(cv) { return Number(cv.dataset.rev || 0); }
export function hasSheet() { return false; }
export function play() { return null; }
export function boardShake(px) { globalThis.__shake = px; }
export function boardWin(k) { globalThis.__cam = k; }
export function trailBetween() { globalThis.__trails++; }
export function crumb(k) { globalThis.__crumbs.push(k); }
export function scrub(s) { return String(s || ''); }
export function setPhase(p) { globalThis.__phase = p; }
export function playMotion(el, kfs, opts = {}) {
  const anim = el.animate(kfs, opts);
  return { finished: anim.finished.catch(() => {}), cancel() { anim.cancel(); }, finish() { try { anim.finish(); } catch {} }, get playState() { return anim.playState; } };
}
export function cancelMotion(el) { el?.getAnimations?.().forEach((a) => a.cancel()); }
`);
	await writeFile(entry, `
import { mergeIn, skipMerge } from ${JSON.stringify(join(app, 'src/game/mergefx.ts'))};
import { mergeMs } from ${JSON.stringify(join(app, 'src/game/mergeclock.ts'))};
const S = globalThis.__S;
function layout(n) {
  let stage = document.getElementById('stage');
  if (!stage) { stage = document.createElement('div'); stage.id = 'stage'; document.body.appendChild(stage); }
  stage.innerHTML = '<div id="board" style="position:relative;width:640px;height:520px"><div id="cells" style="position:absolute;inset:0"></div><div id="overlays"></div></div><div id="flyLayer"></div>';
  const host = document.getElementById('overlays');
  host.style.cssText = 'position:absolute;left:0;top:40px;width:640px;height:440px';
  const reels = [];
  for (let i = 0; i < n; i++) {
    reels.push(i);
    const o = document.createElement('div');
    o.className = 'ov full'; o.dataset.reel = String(i);
    o.style.cssText = 'position:absolute;top:0;width:90px;height:400px;left:' + (20 + i * 100) + 'px';
    const img = document.createElement('img'); img.className = 'wart'; o.appendChild(img);
    const g = document.createElement('b'); g.className = 'mx'; g.dataset.gem = String(i); g.textContent = 'x2'; g.style.cssText = 'position:absolute;left:4px;top:4px;width:36px;height:16px';
    o.appendChild(g); host.appendChild(o);
  }
  return reels;
}
function applyMerged(reels) {
  const host = document.getElementById('overlays');
  const o = document.createElement('div');
  o.className = 'ov merge'; o.dataset.reels = reels.join(',');
  o.style.cssText = 'position:absolute;top:0;left:' + (20 + reels[0] * 100) + 'px;width:' + (90 + (reels.length - 1) * 100) + 'px;height:400px';
  const cv = document.createElement('canvas'); cv.className = 'stk stk_body'; cv.width = 8; cv.height = 8; cv.dataset.rev = '1';
  cv.getContext('2d').fillRect(0, 0, 8, 8);
  const mx = document.createElement('b'); mx.className = 'mx'; mx.textContent = 'x'; mx.style.cssText = 'position:absolute;right:4px;top:4px;width:36px;height:16px';
  o.appendChild(cv); o.appendChild(mx); host.replaceChildren(o);
}
async function play(n, opts) {
  globalThis.__log = []; globalThis.__trails = 0; globalThis.__nudges = 0; globalThis.__shake = 0; globalThis.__cam = ''; globalThis.__crumbs = [];
  S.turbo = !!opts.turbo; S.inBonus = !!opts.bonus; S.cell = 96;
  window.matchMedia = (q) => ({ matches: !!opts.reduced && String(q).includes('reduce'), media: String(q), addEventListener() {}, removeEventListener() {} });
  const reels = layout(n);
  const values = reels.map(() => 2);
  const t0 = performance.now();
  let applied = 0, applyAt = 0, crouch = '';
  const live = [];
  const timer = setInterval(() => {
    const ov = document.querySelector('.ov.full');
    if (ov && !crouch && ov.getAnimations()[0] && ov.getAnimations()[0].effect) {
      const kfs = ov.getAnimations()[0].effect.getKeyframes();
      crouch = String((kfs[kfs.length - 1] && kfs[kfs.length - 1].transform) || '');
    }
    live.push({ t: Math.round(performance.now() - t0), up: !!ov && ov.style.visibility !== 'hidden', anim: ov ? ov.getAnimations().length : 0, stage: !!document.querySelector('.mStage') });
  }, 80);
  mark('play ' + n + (opts.turbo ? ' turbo' : '') + (opts.bonus ? ' bonus' : '') + (opts.skipAt != null ? ' skip' : '') + (opts.explode ? ' boom' : ''));
  if (opts.skipAt != null) setTimeout(() => skipMerge(), opts.skipAt);
  let threw = false;
  try {
    await mergeIn(reels, values, 2 ** n, () => {
      if (opts.explode) { opts.explode = false; throw new Error('apply failed'); }
      applied++; applyAt = performance.now() - t0; applyMerged(reels);
    });
  } catch (e) { threw = true; }
  clearInterval(timer);
  const rel = globalThis.__log.findIndex((s) => s.startsWith('release'));
  const prep = globalThis.__log.findIndex((s) => s.startsWith('prepare'));
  const leftover = document.querySelectorAll('.ov.full .mx, .cell .mx').length;
  const groupGem = document.querySelector('.ov.merge .mx');
  const flies = document.querySelectorAll('#flyLayer .fly').length;
  return { ms: Math.round(performance.now() - t0), applied, applyAt: Math.round(applyAt), threw, phase: globalThis.__phase, log: globalThis.__log, rel, prep, shake: globalThis.__shake, cam: globalThis.__cam, trails: globalThis.__trails, nudges: globalThis.__nudges, crumbs: globalThis.__crumbs, live, crouch, leftover, groupV: groupGem && groupGem.dataset.v, flies };
}
async function wait(ms) {
  mark('wait ' + ms);
  const t0 = performance.now();
  await new Promise((r) => setTimeout(() => { mark('fired ' + ms); r(); }, ms));
  return { ms: Math.round(performance.now() - t0), frames: 0 };
}
const out = {};
function mark(s) { const el = document.getElementById('result'); if (el && el.textContent.indexOf('{') !== 0) el.textContent = 'MARK ' + s; }
async function main() {
mark('start');
try {
  out.hit = await wait(mergeMs(50, false));
  out.beat = await wait(mergeMs(400, false));
  out.g2 = await play(2, {});
  out.half = await play(2, { reduced: true });
  out.g3 = await play(3, {});
  out.g4 = await play(4, {});
  out.g5 = await play(5, {});
  out.turbo = await play(2, { turbo: true });
  out.bonus = await play(2, { bonus: true });
  out.again = await play(5, {});
  out.skip = await play(2, { skipAt: 80 });
  out.boom = await play(2, { explode: true });
} catch (e) { out.error = String(e && e.stack || e); }
document.getElementById('result').textContent = JSON.stringify(out);
}
main();
`);
	await esbuild.build({
		entryPoints: [entry], bundle: true, format: 'iife', outfile: bundle, absWorkingDir: dir, logLevel: 'silent',
		plugins: [{
			name: 'stub',
			setup(b) {
				b.onResolve({ filter: /^\./ }, (args) => {
					if (args.path.includes('mergeclock') || args.path.includes('mergefx')) return null;
					if (args.importer.endsWith('mergefx.ts') || args.importer.endsWith('mergeclock.ts')) return { path: stub };
					return null;
				});
			},
		}],
	});
	await writeFile(html, `<!doctype html><script>globalThis.__S={turbo:false,cell:96,inBonus:false,full:new Set()};window.onerror=function(m){document.getElementById('result').textContent='ERR '+m}</script><pre id="result">PENDING</pre><script src="./bundle.js"></script>`);
	const userDir = join(dir, 'profile');
	const port = 9700 + (process.pid % 300);
	const child = spawn(chrome, [
		'--headless=new', '--no-sandbox', '--disable-dev-shm-usage', `--user-data-dir=${userDir}`,
		'--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--remote-debugging-port=${port}`, html,
	], { stdio: 'ignore' });
	let raw = '';
	let last = '';
	const deadline = Date.now() + 40000;
	while (Date.now() < deadline && !raw) {
		await new Promise((r) => setTimeout(r, 250));
		try {
			const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
			const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
			if (!page) continue;
			const text = await new Promise((resolve, reject) => {
				const ws = new WebSocket(page.webSocketDebuggerUrl);
				const timer = setTimeout(() => { ws.close(); reject(new Error('cdp')); }, 2500);
				ws.addEventListener('open', () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: "document.getElementById('result').textContent", returnByValue: true } })));
				ws.addEventListener('message', (ev) => {
					const msg = JSON.parse(ev.data);
					if (msg.id !== 1) return;
					clearTimeout(timer); ws.close();
					resolve(msg.result && msg.result.result ? msg.result.result.value : '');
				});
				ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('socket')); });
			});
			if (text && text !== 'PENDING' && text !== last) { last = String(text).trim(); console.log('  page', last.slice(0, 240)); }
			if (text && text.startsWith('{')) raw = String(text).trim();
		} catch { /* debugger not up yet */ }
	}
	child.kill('SIGKILL');
	await new Promise((r) => { const t = setTimeout(r, 400); child.once('close', () => { clearTimeout(t); r(); }); });
	if (!raw) { fail++; console.error('  FAIL play probe produced no result'); }
	else {
		const r = JSON.parse(raw);
		if (r.error) { fail++; console.error('  FAIL play threw', r.error.slice(0, 900)); }
		else {
			const early = (p) => (p.live || []).find((s) => s.t >= 80 && s.t <= 320);
			ok(r.hit.ms >= 45 && r.hit.ms < 150, `50 ms wait measured ${r.hit.ms} ms (${r.hit.frames} rafs)`);
			ok(r.beat.ms >= 380 && r.beat.ms < 600, `400 ms wait measured ${r.beat.ms} ms (${r.beat.frames} rafs)`);
			for (const [k, n] of [['g2', 2], ['g3', 3], ['g4', 4], ['g5', 5]]) {
				const p = r[k];
				ok(p && !p.threw && p.applied === 1 && p.prep >= 0 && p.rel > p.prep, `${n}-reel applied once, prepare during the lean, release at the hit (${p && p.ms} ms, shake ${p && p.shake})`);
				const e = early(p);
				ok(!!e && e.up && e.anim > 0, `${n}-reel live overlays lean at ${e && e.t} ms (anim ${e && e.anim})`);
				ok(p && p.leftover === 0 && p.flies === 0, `${n}-reel leftover badges ${p && p.leftover} flies ${p && p.flies}`);
				ok(p && String(p.groupV) === String(2 ** n), `${n}-reel group gem is x${p && p.groupV}`);
			}
			ok(r.g2.applyAt > 700 && r.g2.applyAt < 1200, `2-reel cut at ${r.g2.applyAt} ms (after the wind-up and pull, not at frame 0)`);
			ok(/translateY\(6(\.0)?px\)/.test(r.g2.crouch) || /translateY\(6px\)/.test(r.g2.crouch), `full wind-up crouch is ${r.g2.crouch}`);
			ok(r.half && r.half.applied === 1 && /translateY\(3(\.0)?px\)/.test(r.half.crouch), `reduced motion crouch is half (${r.half && r.half.crouch})`);
			ok(r.half && r.half.ms > r.g2.ms * 0.8 && r.half.ms < r.g2.ms * 1.25, `reduced motion keeps the duration (${r.half && r.half.ms} vs ${r.g2.ms})`);
			ok(r.g5.shake === 8 && r.g2.shake === 5, `camera scales with the group (${r.g2.shake} vs ${r.g5.shake})`);
			ok(r.g5.cam === 'big' && r.g2.cam === 'small', `push-in is ${r.g2.cam} for 2 and ${r.g5.cam} for 5`);
			ok(r.turbo.applied === 1 && r.turbo.ms < r.g2.ms * 0.8 && r.turbo.ms > r.g2.ms * 0.45, `turbo ${r.turbo.ms} ms vs normal ${r.g2.ms} ms`);
			ok(r.bonus.phase === 'bonus' && r.g2.phase === 'board', `phase returns to ${r.g2.phase} and to ${r.bonus.phase} in the bonus`);
			ok(r.again.applied === 1 && r.again.rel > r.again.prep, `a second 5-reel merge also prepared before release`);
			ok(r.skip.applied === 1 && r.skip.ms < r.g2.ms - 150, `one tap shortens the merge (${r.skip.ms} vs ${r.g2.ms})`);
			ok(r.boom && !r.boom.threw && r.boom.applied === 0 && r.boom.crumbs.includes('merge-apply'), 'a throwing apply is contained');
			console.log('  times', JSON.stringify({ g2: r.g2.ms, g3: r.g3.ms, g4: r.g4.ms, g5: r.g5.ms, turbo: r.turbo.ms, skip: r.skip.ms, bonus: r.bonus.ms, again: r.again.ms, hit: r.hit, beat: r.beat }));
		}
	}
	await rm(dir, { recursive: true, force: true });
}

console.log(fail ? `\nmergebeat tests: ${fail} FAILED` : '\nmergebeat tests: all passed');
process.exit(fail ? 1 : 0);
