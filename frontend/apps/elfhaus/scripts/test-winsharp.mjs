// Win-animation sharpness. The glow filter is applied only while an overlay has .win, and its shader
// outputs the rig itself (src + glow). Pixi Filter's default resolution is 1; the board canvas is up to 3.
// This checks the filter is 'inherit', that a resolution-1 filter drops a 1px stripe pattern the static
// sprite keeps, and that 'inherit' keeps those stripes while the sprite scales the way the win bounce does.
// The halo stays the same size in layout px (uInputSize is logical). No phone, no rig art: a synthetic sprite.
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

console.log('\n=== win sharpness: resolution math ===');
{
	// GlProgram construction needs a browser canvas, so the live Filter object is checked in the pixel probe.
	const boardRes = (sc, dpr) => Math.min(3, Math.max(1, sc * dpr));
	ok(boardRes(1, 3) === 3 && boardRes(1, 2) === 2 && boardRes(1, 1) === 1, 'board resolution cap is still min(3, max(1, cssScale * dpr))');
	const px = (w, h, r) => [Math.ceil(w * r - 1e-6), Math.ceil(h * r - 1e-6)];
	const reel = px(110, 420, 3), soft = px(110, 420, 1);
	ok(reel[0] === 330 && reel[1] === 1260 && soft[0] * 3 === reel[0], `phone reel filter is ${reel.join('x')} at inherit, ${soft.join('x')} at resolution 1`);
	ok(reel[0] <= 2048 && reel[1] <= 2048, 'one full-reel win texture stays under the 2048 snapshot cap');
	ok(boardRes(1, 1) === 1, 'at 1x the old resolution-1 filter matches the canvas, so a desktop screen hides the bug');
}

console.log('\n=== win sharpness: source guards ===');
{
	const glow = src('../src/game/board/glowFilter.ts');
	const db = src('../src/game/dbstacks.ts');
	const stage = src('../src/game/board/stage.ts');
	ok(/resolution:\s*'inherit'/.test(glow), "glowFilter sets resolution: 'inherit'");
	ok(!/resolution:\s*1\b/.test(glow), 'glowFilter does not pin resolution 1');
	ok(db.includes('L.root.filters = [L.gf]') && db.includes('L.gf.destroy()'), 'the filter still exists only while the wild is winning, then is destroyed');
	ok(db.includes('releaseArmatures') && db.includes('snapshotPixels'), 'armature flush and snapshot cap from the reload patch stay');
	ok(/Math\.min\(3,\s*Math\.max\(1,\s*sc \* \(window\.devicePixelRatio/.test(stage), 'board canvas resolution formula unchanged');
}

console.log('\n=== win sharpness: static vs animated pixels ===');
let chrome = '';
try { chrome = require('node:child_process').execSync('command -v google-chrome || command -v google-chrome-stable', { encoding: 'utf8' }).trim().split('\n').pop(); } catch { /* none */ }
let esbuild = null;
try { esbuild = await import('esbuild'); } catch { /* optional */ }
if (!chrome || !esbuild) {
	console.log(`  SKIP pixel probe (chrome=${chrome || 'missing'}, esbuild=${esbuild ? 'yes' : 'missing'})`);
} else {
	const dir = await mkdtemp(join(tmpdir(), 'winsharp-'));
	const entry = join(dir, 'entry.mjs');
	const bundle = join(dir, 'bundle.js');
	const html = join(dir, 'page.html');
	await writeFile(entry, `
import { Application, Sprite, Texture, Filter, GlProgram, defaultFilterVert } from 'pixi.js';
import { glowFilter } from ${JSON.stringify(join(app, 'src/game/board/glowFilter.ts'))};

const WORLD = 64, RES = 2;
function stripes() {
	const c = document.createElement('canvas'); c.width = WORLD * RES; c.height = 32;
	const g = c.getContext('2d');
	for (let x = 0; x < c.width; x++) { g.fillStyle = (x & 1) ? '#000' : '#fff'; g.fillRect(x, 0, 1, c.height); }
	const t = Texture.from(c); t.source.style.scaleMode = 'nearest'; t.source.autoGenerateMipmaps = false; return t;
}
function disc() {
	const c = document.createElement('canvas'); c.width = 64; c.height = 64;
	const g = c.getContext('2d'); g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 12, 0, Math.PI * 2); g.fill();
	const t = Texture.from(c); t.source.style.scaleMode = 'linear'; return t;
}
function transitions(px, w, h) {
	const y = (h / 2) | 0; let n = 0, last = -1;
	for (let x = 4; x < w - 4; x++) {
		const i = (y * w + x) * 4; const on = px[i] > 160 ? 1 : 0;
		if (last >= 0 && on !== last) n++; last = on;
	}
	return n;
}
function haloLogical(px, w, h, res) {
	const cx = (w / 2) | 0, cy = (h / 2) | 0;
	let reach = 0;
	for (let x = cx; x < w; x++) {
		const i = (cy * w + x) * 4;
		if (px[i] + px[i + 1] + px[i + 2] > 30) reach = x - cx;
	}
	return reach / res;
}
async function main() {
try {
const plain = new Filter({ glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment: 'void main(){}', name: 'plain' }), resources: {} });
const glowObj = glowFilter();
const app = new Application();
await app.init({ width: WORLD, height: 48, resolution: RES, antialias: false, preference: 'webgl', background: 0x000000, hello: false, autoDensity: false });
document.body.appendChild(app.canvas);
const spr = new Sprite(stripes()); spr.width = WORLD; spr.height = 32; app.stage.addChild(spr);
const read = () => { app.render(); const p = app.renderer.extract.pixels({ target: app.stage, resolution: RES }); return transitions(p.pixels, p.width, p.height); };
const staticN = read();
const soft = glowFilter(); soft.resolution = 1; spr.filters = [soft];
const softN = read();
const sharp = glowFilter(); spr.filters = [sharp];
const inheritN = read();
const anim = [];
const bx = spr.scale.x, by = spr.scale.y;
for (let i = 0; i < 8; i++) { const s = 1 + 0.03 * Math.sin(i); spr.scale.set(bx * s, by * s); anim.push(read()); }
spr.scale.set(bx, by); spr.filters = [];
const blob = new Sprite(disc()); blob.position.set(0, 0); blob.width = 64; blob.height = 64;
app.stage.removeChildren(); app.stage.addChild(blob);
const glow1 = glowFilter(); glow1.resolution = 1; blob.filters = [glow1];
app.renderer.resize(64, 64); app.render();
let p = app.renderer.extract.pixels({ target: app.stage, resolution: RES });
const halo1 = haloLogical(p.pixels, p.width, p.height, RES);
const glowI = glowFilter(); blob.filters = [glowI]; app.render();
p = app.renderer.extract.pixels({ target: app.stage, resolution: RES });
const haloI = haloLogical(p.pixels, p.width, p.height, RES);
document.getElementById('result').textContent = JSON.stringify({
	plainRes: plain.resolution, glowRes: glowObj.resolution, pad: glowObj.padding, dist: glowObj.resources.u.uniforms.uDist, aa: glowObj.antialias,
	res: app.renderer.resolution, staticN, softN, inheritN, animMin: Math.min(...anim), animMax: Math.max(...anim), halo1, haloI, w: p.width });
} catch (e) {
	document.getElementById('result').textContent = JSON.stringify({ error: String(e && e.stack || e) });
}
}
main();
`);
	await esbuild.build({
		entryPoints: [entry], bundle: true, format: 'iife', outfile: bundle, absWorkingDir: dir, logLevel: 'silent',
		alias: { 'pixi.js': require.resolve('pixi.js') },
	});
	await writeFile(html, `<!doctype html><pre id="result">PENDING</pre><script src="./bundle.js"></script>`);
	const userDir = join(dir, 'profile');
	const port = 9300 + (process.pid % 500);
	const child = spawn(chrome, [
		'--headless=new', '--no-sandbox', '--disable-dev-shm-usage', `--user-data-dir=${userDir}`,
		'--use-angle=swiftshader', '--enable-unsafe-swiftshader',
		`--remote-debugging-port=${port}`, html,
	], { stdio: 'ignore' });
	let raw = '';
	const deadline = Date.now() + 25000;
	while (Date.now() < deadline && !raw) {
		await new Promise((r) => setTimeout(r, 200));
		try {
			const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
			const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
			if (!page) continue;
			const text = await new Promise((resolve, reject) => {
				const ws = new WebSocket(page.webSocketDebuggerUrl);
				const timer = setTimeout(() => { ws.close(); reject(new Error('cdp timeout')); }, 2000);
				ws.addEventListener('open', () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: "document.getElementById('result').textContent", returnByValue: true } })));
				ws.addEventListener('message', (ev) => {
					const msg = JSON.parse(ev.data);
					if (msg.id !== 1) return;
					clearTimeout(timer); ws.close();
					resolve(msg.result && msg.result.result ? msg.result.result.value : '');
				});
				ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('cdp socket')); });
			});
			if (text && text !== 'PENDING') raw = String(text).trim();
		} catch { /* debugger not up yet */ }
	}
	child.kill('SIGKILL');
	await new Promise((r) => child.on('close', r));
	if (!raw || raw === 'PENDING') {
		fail++;
		console.error('  FAIL pixel probe produced no result');
	} else {
		const r = JSON.parse(raw);
		if (r.error) { fail++; console.error('  FAIL probe threw', r.error.slice(0, 800)); }
		else {
		console.log('  pixels', JSON.stringify(r));
		ok(r.plainRes === 1, `Pixi default filter resolution is 1 (got ${r.plainRes})`);
		ok(r.glowRes === 'inherit', `win glow follows the canvas (got ${r.glowRes})`);
		ok(r.pad === 16 && r.dist === 14 && r.aa === 'off', `padding ${r.pad}, distance ${r.dist}, antialias ${r.aa}`);
		ok(r.res === 2, `probe renderer resolution ${r.res}`);
		ok(r.staticN >= 40, `static sprite keeps the stripes (${r.staticN} transitions)`);
		ok(r.softN < r.staticN * 0.55, `resolution 1 drops them (${r.softN} vs static ${r.staticN})`);
		ok(r.inheritN >= r.staticN * 0.85, `inherit keeps them (${r.inheritN} vs static ${r.staticN})`);
		ok(r.animMin >= r.staticN * 0.7, `scaled win-bounce frames stay sharp (min ${r.animMin})`);
		ok(Math.abs(r.haloI - r.halo1) <= 3, `halo logical radius stays ${r.halo1} at res 1 and ${r.haloI} at inherit`);
		}
	}
	await rm(dir, { recursive: true, force: true });
}

console.log(fail ? `\nwinsharp tests: ${fail} FAILED` : '\nwinsharp tests: all passed');
process.exit(fail ? 1 : 0);
