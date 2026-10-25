// Drop-in art import: file copies only, no code changes. Usage (from frontend/apps/elfhaus):
//   node scripts/import-art.mjs symbols <dir>   a symbol set laid out like the repo (e.g. /workspace/elfhaus-frameless/final):
//                                              <dir>/assets/**  -> <repo>/assets/**   (idle/win webp, cut masters, sym_<K> sheets)
//                                              <dir>/src/**     -> app src/**         (src/game/fx/sym_<K>.atlas.json)
//                                              <dir>/static/** is skipped: static/art is regenerated from assets/ by sync-art.
//   node scripts/import-art.mjs splash  <dir>   panel_*.webp, splash_*.webp, sting_*, splash_layout.json -> src/assets/intro/
//   node scripts/import-art.mjs stacks  <dir>   <anim>_<variant>.webp + .atlas.json/.json -> static/assets/stacks/, writes index.json
//                                              (anim: stack_form | merge_join | letters_ignite | merge_idle | merge_win;
//                                               variant: WF | WM2..WM5; see INTEGRATION.md). Unmatched names are reported.
//   node scripts/import-art.mjs roxy    <dir>   roxy_<tag>_<state>_<page>.{json,webp} (roxy_full_ / roxy_p3d_) -> static/assets/atlases/
//                                              as roxy_full_* (old pages removed first, so a new page count drops in cleanly)
// Add --dry to list what would be copied. Then: pnpm test && pnpm build.
import { readdirSync, statSync, mkdirSync, copyFileSync, existsSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, relative, dirname, basename } from 'node:path';
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../../..');
const [kind, src, ...flags] = process.argv.slice(2), dry = flags.includes('--dry');
if (!kind || !src || !existsSync(src)) { console.error('usage: import-art.mjs symbols|splash|stacks|roxy <dir> [--dry]'); process.exit(1); }
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
let n = 0;
const cp = (from, to) => { n++; console.log(`${dry ? '[dry] ' : ''}${relative(src, from)} -> ${relative(repo, to)}`); if (!dry) { mkdirSync(dirname(to), { recursive: true }); copyFileSync(from, to); } };
const IMG = /\.(webp|png|jpg|json)$/i;

if (kind === 'symbols') {
	for (const [sub, dest] of [['assets', join(repo, 'assets')], ['src', join(app, 'src')]]) {
		const d = join(src, sub); if (!existsSync(d)) continue;
		for (const f of walk(d)) if (IMG.test(f)) cp(f, join(dest, relative(d, f)));
	}
	console.log('symbols: optional, regenerate the reel blur strips from the new art: python3 scripts/sprites/gen_reelblur.py');
} else if (kind === 'splash') {
	const dest = join(app, 'src/assets/intro');
	for (const f of walk(src)) { const b = basename(f); if (/^(panel_|splash_|sting_).*\.(webp|json)$/.test(b)) cp(f, join(dest, b)); }
} else if (kind === 'stacks') {
	const dest = join(app, 'static/assets/stacks'), RE = /^(stack_form|merge_join|letters_ignite|merge_idle|merge_win)_(WF|WM[2-5])(?:\.atlas)?\.(webp|json)$/;
	const ids = new Set();
	for (const f of walk(src)) {
		const b = basename(f), m = b.match(RE);
		if (!m) { if (IMG.test(b)) console.log(`skip (name not in the stacks convention): ${b}`); continue; }
		const id = `${m[1]}_${m[2]}`; cp(f, join(dest, m[3] === 'json' ? `${id}.json` : `${id}.webp`)); ids.add(id);
	}
	const have = [...ids].filter((id) => dry || (existsSync(join(dest, id + '.json')) && existsSync(join(dest, id + '.webp')))).sort();
	if (!dry) {
		const prev = existsSync(join(dest, 'index.json')) ? JSON.parse(readFileSync(join(dest, 'index.json'), 'utf8')).sheets || [] : [];
		const all = [...new Set([...prev, ...have])].filter((id) => existsSync(join(dest, id + '.json')) && existsSync(join(dest, id + '.webp'))).sort();
		writeFileSync(join(dest, 'index.json'), JSON.stringify({ sheets: all }, null, 1) + '\n'); console.log('stacks index:', all.join(', ') || '(none)');
	}
} else if (kind === 'roxy') {
	// Accepts roxy_<tag>_<state>_<page> (roxy_full_* or the painted-3D roxy_p3d_* from elfhaus-roxy-p3d/tools/pack.py);
	// the set is renamed to roxy_full_* on the way in (file names, meta.image, related_multi_packs, frame + anim keys).
	const dest = join(app, 'static/assets/atlases'), RE = /^roxy_([a-z0-9]+)_(idle|anticipation|disappointed|excited)_(\d+)\.(json|webp)$/;
	let files = walk(src).filter((f) => RE.test(basename(f)));
	const tags = [...new Set(files.map((f) => basename(f).match(RE)[1]))], want = (flags.find((f) => f.startsWith('--tag=')) || '').slice(6);
	if (tags.length > 1 && !want) { console.error(`roxy: several sets (${tags.join(', ')}) in ${src}; pick one with --tag=<tag>`); process.exit(1); }
	const tag = want || tags[0]; files = files.filter((f) => basename(f).match(RE)[1] === tag);
	if (!files.some((f) => basename(f) === `roxy_${tag}_idle_0.json`)) { console.error(`roxy: roxy_${tag}_idle_0.json missing in ${src}`); process.exit(1); }
	if (!dry && resolve(src) !== dest) for (const f of readdirSync(dest)) if (f.startsWith('roxy_full_')) rmSync(join(dest, f));
	const ren = (x) => x.split(`roxy_${tag}_`).join('roxy_full_');
	for (const f of files) {
		const to = join(dest, ren(basename(f)));
		if (f.endsWith('.json') && tag !== 'full') { n++; console.log(`${dry ? '[dry] ' : ''}${relative(src, f)} -> ${relative(repo, to)} (renamed)`); if (!dry) writeFileSync(to, ren(readFileSync(f, 'utf8'))); }
		else if (resolve(f) !== to) cp(f, to);
	}
} else { console.error('unknown kind ' + kind); process.exit(1); }
console.log(`${n} file(s) ${dry ? 'would be ' : ''}copied`);
