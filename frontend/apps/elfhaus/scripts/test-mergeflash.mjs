// Stale frame at merge start. A pooled sheet canvas keeps its pixels, and the board uploads a canvas once.
// Repainting that canvas used to leave the previous animation on screen. This checks the pool is cleared and
// drawn before it is inserted, and that a revision change reuploads before the next present.
import { readFileSync } from 'node:fs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const app = fileURLToPath(new URL('..', import.meta.url));
let fail = 0;
const ok = (c, m) => { if (c) console.log('  OK ' + m); else { fail++; console.error('  FAIL ' + m); } };
const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

console.log('\n=== merge flash: source guards ===');
{
	const sp = src('../src/game/sprite.ts');
	const mi = src('../src/game/board/mirror.ts');
	const mf = src('../src/game/mergefx.ts');
	const db = src('../src/game/dbstacks.ts');
	ok(sp.includes('clearRect(0, 0, w, h)'), 'a same-size pooled canvas is cleared');
	ok(sp.indexOf('draw(a, 0)') < sp.indexOf('host.appendChild(cv)'), 'the first frame is drawn before the canvas is inserted');
	ok(sp.includes('export const canvasRev'), 'canvas revisions are visible to the board');
	ok(mi.includes('source.update()') && mi.includes('canvasRev'), 'the board reuploads a canvas when its pixels change');
	ok(mi.includes('t.destroy(true)') && mi.includes('releaseOut(x)'), 'dropping a snapshot still destroys its GPU texture');
	ok(mf.includes("!x.classList.contains('stk_db')"), 'a rig placeholder is never copied as the snapshot');
	ok(mf.includes("o.style.visibility = 'hidden'") && mf.indexOf("o.style.visibility = 'hidden'") < mf.indexOf('host.appendChild(el)'), 'live overlays hide before the snapshot stage is shown');
	ok(mf.includes('performance.now() - t0 > 120'), 'the snapshot stays up until the new body has been drawn, on a time cap');
	ok(db.includes('removeFromParent()'), 'a rig snapshot is taken off the board stage');
	ok(db.includes('resolution: r') || db.includes('snapshotPixels'), 'snapshot cap stays');
	ok(/resolution:\s*'inherit'/.test(src('../src/game/board/glowFilter.ts')), "win glow stays at resolution 'inherit'");
}

console.log('\n=== merge flash: pooled canvas vs upload ===');
let chrome = '';
try { chrome = require('node:child_process').execSync('command -v google-chrome || command -v google-chrome-stable', { encoding: 'utf8' }).trim().split('\n').pop(); } catch { /* none */ }
let esbuild = null;
try { esbuild = await import('esbuild'); } catch { /* optional */ }
if (!chrome || !esbuild) {
	console.log(`  SKIP pixel probe (chrome=${chrome || 'missing'}, esbuild=${esbuild ? 'yes' : 'missing'})`);
} else {
	const dir = await mkdtemp(join(tmpdir(), 'mergeflash-'));
	const entry = join(dir, 'entry.mjs');
	const bundle = join(dir, 'bundle.js');
	const html = join(dir, 'page.html');
	const stub = join(dir, 'tempo.mjs');
	await writeFile(stub, 'export const spriteRate = () => 1;\n');
	await writeFile(entry, `
import { Application, Sprite, Texture } from 'pixi.js';
import { loadSheet, play, stop, canvasRev } from ${JSON.stringify(join(app, 'src/game/sprite.ts'))};

function px(cv) {
	const g = cv.getContext('2d').getImageData(0, 0, 1, 1).data;
	return [g[0], g[1], g[2], g[3]];
}
async function sheet(id, rgb) {
	const c = document.createElement('canvas'); c.width = 8; c.height = 8;
	const g = c.getContext('2d'); g.fillStyle = rgb; g.fillRect(0, 0, 8, 8);
	const blob = await new Promise((res) => c.toBlob(res));
	const url = URL.createObjectURL(blob);
	await loadSheet(id, url, { size: [8, 8], anims: { play: { fps: 8, loop: true, frames: [[0, 0, 8, 8]] } } });
}
async function main() {
	const out = {};
	try {
		await sheet('red', '#ff0000');
		await sheet('blue', '#0000ff');
		const host = document.createElement('div'); document.body.appendChild(host);
		const a = play('red', 'play', host, { cls: 'stk stk_body' });
		out.afterRed = px(a.cv);
		out.revRed = canvasRev(a.cv);
		const app = new Application();
		await app.init({ width: 8, height: 8, backgroundAlpha: 1, preference: 'webgl', hello: false, sharedTicker: false, autoStart: false });
		const tex = Texture.from(a.cv);
		const spr = new Sprite(tex); spr.width = 8; spr.height = 8; app.stage.addChild(spr);
		const read = () => {
			app.render();
			const p = app.renderer.extract.pixels({ target: app.stage });
			const d = p.pixels;
			return [d[0], d[1], d[2], d[3]];
		};
		out.gpuRed = read();
		stop(a);
		const b = play('blue', 'play', host, { cls: 'stk stk_body' });
		out.sameCanvas = a.cv === b.cv;
		out.afterBlue = px(b.cv);
		out.revBlue = canvasRev(b.cv);
		out.gpuStale = read();
		if (canvasRev(b.cv) !== tex._rev) { tex.source.update(); tex._rev = canvasRev(b.cv); }
		out.gpuFresh = read();
		spr.destroy(); tex.destroy(true);
	} catch (e) { out.error = String(e && e.stack || e); }
	document.getElementById('result').textContent = JSON.stringify(out);
}
main();
`);
	await esbuild.build({
		entryPoints: [entry], bundle: true, format: 'iife', outfile: bundle, absWorkingDir: dir, logLevel: 'silent',
		alias: { 'pixi.js': require.resolve('pixi.js') },
		plugins: [{ name: 'tempo', setup(b) { b.onResolve({ filter: /\/tempo$/ }, () => ({ path: stub })); } }],
	});
	await writeFile(html, `<!doctype html><pre id="result">PENDING</pre><script src="./bundle.js"></script>`);
	const userDir = join(dir, 'profile');
	const port = 9600 + (process.pid % 400);
	const child = spawn(chrome, [
		'--headless=new', '--no-sandbox', '--disable-dev-shm-usage', `--user-data-dir=${userDir}`,
		'--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--remote-debugging-port=${port}`, html,
	], { stdio: 'ignore' });
	let raw = '';
	const deadline = Date.now() + 20000;
	while (Date.now() < deadline && !raw) {
		await new Promise((r) => setTimeout(r, 200));
		try {
			const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
			const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
			if (!page) continue;
			const text = await new Promise((resolve, reject) => {
				const ws = new WebSocket(page.webSocketDebuggerUrl);
				const timer = setTimeout(() => { ws.close(); reject(new Error('cdp')); }, 2000);
				ws.addEventListener('open', () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: "document.getElementById('result').textContent", returnByValue: true } })));
				ws.addEventListener('message', (ev) => {
					const msg = JSON.parse(ev.data);
					if (msg.id !== 1) return;
					clearTimeout(timer); ws.close();
					resolve(msg.result && msg.result.result ? msg.result.result.value : '');
				});
				ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('socket')); });
			});
			if (text && text !== 'PENDING') raw = String(text).trim();
		} catch { /* debugger not up yet */ }
	}
	child.kill('SIGKILL');
	await new Promise((r) => { const t = setTimeout(r, 500); child.once('close', () => { clearTimeout(t); r(); }); });
	if (!raw) { fail++; console.error('  FAIL pixel probe produced no result'); }
	else {
		const r = JSON.parse(raw);
		if (r.error) { fail++; console.error('  FAIL probe threw', r.error.slice(0, 800)); }
		else {
			console.log('  pixels', JSON.stringify(r));
			const red = (p) => p && p[0] > 200 && p[2] < 40;
			const blue = (p) => p && p[2] > 200 && p[0] < 40;
			ok(red(r.afterRed), `first play's canvas is red (${r.afterRed})`);
			ok(r.sameCanvas, 'the next play reused the pooled canvas');
			ok(blue(r.afterBlue), `reused canvas is blue before it is shown (${r.afterBlue})`);
			ok(r.revBlue > r.revRed, `revision advanced (${r.revRed} -> ${r.revBlue})`);
			ok(red(r.gpuRed), `first upload is red (${r.gpuRed})`);
			ok(red(r.gpuStale), `without a reupload the board still shows red (${r.gpuStale})`);
			ok(blue(r.gpuFresh), `reupload on the new revision shows blue (${r.gpuFresh})`);
		}
	}
	await rm(dir, { recursive: true, force: true });
}

console.log(fail ? `\nmergeflash tests: ${fail} FAILED` : '\nmergeflash tests: all passed');
process.exit(fail ? 1 : 0);
