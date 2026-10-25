// Packages build/ into an upload-ready Stake Engine front-end folder (index.html at the root, relative paths).
// Usage: pnpm build && node scripts/package-release.mjs <outDir>
// Drops files the game never loads (pre-built symbol/background atlases kept in static/ for later use) after
// checking the bundle really doesn't reference them, then sanity-checks the result and prints a size report.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

const SRC = 'build', OUT = process.argv[2] || 'release/elfhaus-frontend';
const UNUSED = [/^assets\/atlases\/H\d_idle\.(webp|json)$/, /^assets\/atlases\/symbols_\d\.(webp|json)$/, /^assets\/atlases\/bg_[^/]+\.(webp|json)$/, /^assets\/atlases\/README\.md$/];
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const fail = (m) => { console.error('package-release: ' + m); process.exit(1); };

if (!existsSync(join(SRC, 'index.html'))) fail('build/index.html missing - run pnpm build first');
const code = walk(SRC).filter((f) => /\.(html|js|css)$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n');
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const dropped = [];
cpSync(SRC, OUT, {
	recursive: true,
	filter: (p) => {
		const rel = relative(SRC, p).replaceAll('\\', '/');
		if (!UNUSED.some((r) => r.test(rel))) return true;
		if (code.includes(basename(rel).replace(/\.\w+$/, ''))) fail(`${rel} is listed as unused but the bundle references it`);
		dropped.push(rel); return false;
	},
});

const html = readFileSync(join(OUT, 'index.html'), 'utf8');
if (/\s(src|href)="\/(?!\/)/.test(html)) fail('index.html has root-absolute paths');
if (/mock_round|forcedBook|mockBet/.test(code)) fail('mock RGS code found in the production bundle');
if (!existsSync(join(OUT, 'favicon.png'))) fail('favicon.png missing');

// Every asset the game references must be in the package (live v3 loader showed broken images: the inlined bundle
// resolved Vite-imported assets against the page, <game>/assets/x.webp, instead of <game>/_app/immutable/assets/).
// 1) no chunk-relative Vite asset URLs (they break when the bundle is inlined into index.html; see vite.config.js)
if (/new URL\(\s*["']assets\//.test(code)) fail('bundle has chunk-relative asset URLs (new URL("assets/...")): fix vite.config.js renderBuiltUrl');
// 2) every literal asset path in index.html / JS / CSS exists in OUT (paths are relative to index.html)
const outCode = walk(OUT).filter((f) => /\.(html|js|css)$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n');
const EXT = 'webp|png|jpe?g|gif|svg|json|ttf|woff2?|mp3|ogg|m4a|wav|webm|mp4';
const refs = new Set([...outCode.matchAll(new RegExp(`(?:^|[\\s"'\`(=,])\\.?/?((?:_app|assets|art|fonts|ui)/[A-Za-z0-9_./@-]+\\.(?:${EXT}))(?=[\\s"'\`)?#,])`, 'gm'))].map((m) => m[1]));
// 3) atlas JSONs: their page images and related multi-packs (loaded by computed names, e.g. roxy_full_<state>_N)
for (const j of walk(OUT).filter((f) => f.endsWith('.json') && f.includes('/assets/'))) {
	let d; try { d = JSON.parse(readFileSync(j, 'utf8')); } catch { continue; }
	const dir = relative(OUT, join(j, '..')).replaceAll('\\', '/');
	for (const r of [d?.meta?.image, ...(d?.meta?.related_multi_packs || [])]) if (typeof r === 'string') refs.add(`${dir}/${r}`);
}
const missing = [...refs].filter((r) => !existsSync(join(OUT, r)));
if (missing.length) fail(`${missing.length} referenced asset(s) missing from the package:\n  ` + missing.join('\n  '));
console.log(`asset check: ${refs.size} referenced asset paths, all present`);

const files = walk(OUT).map((f) => ({ f: relative(OUT, f), s: statSync(f).size })).sort((a, b) => b.s - a.s);
const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
console.log(`${OUT}: ${files.length} files, ${mb(files.reduce((a, x) => a + x.s, 0))}` + (dropped.length ? ` (dropped ${dropped.length} unused: ${dropped.join(', ')})` : ''));
files.slice(0, 10).forEach((x) => console.log(`  ${mb(x.s).padStart(9)}  ${x.f}`));
