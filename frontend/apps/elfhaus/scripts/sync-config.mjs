// Writes src/game/modes.generated.json from the math: per-mode costs / RTP / max win / bonus odds from the publish
// files' index.json + stats_summary.json, and every other math-owned game value (paytable, lines, max win cap, spin cap,
// respins, free-spin counts, guarantees, Epic stack start and grow step, Mystery odds, retriggers, EGW stack value)
// from game_config.json. Sources, first found wins: the live math folder in the repo
// (math/games/elfhaus/library/publish_files), else the vendored math-snapshot/ (refreshed by scripts/sync-math.mjs).
// Only if neither exists: src/game/math.fallback.json (a safety net; scripts/test-books.mjs fails if it drifts).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../../..');
const lib = join(repo, 'math/games/elfhaus/library');
const snap = join(app, 'math-snapshot');
const fallback = JSON.parse(readFileSync(join(app, 'src/game/math.fallback.json'), 'utf8'));
const modes = Object.fromEntries(Object.entries(fallback.costs).map(([k, cost]) => [k, { cost, rtp: null, maxWinX: fallback.maxWinX, pBonus: null }]));
let source = 'PROVISIONAL (no math publish files yet)';
const sets = [
	{ name: 'math publish_files/index.json', idx: join(lib, 'publish_files/index.json'), stats: [join(lib, 'stats_summary.json'), join(lib, 'publish_files/stats_summary.json')] },
	{ name: 'math-snapshot/index.json', idx: join(snap, 'index.json'), stats: [join(snap, 'stats_summary.json')] },
];
const set = sets.find((s) => existsSync(s.idx));
if (set) {
	const j = JSON.parse(readFileSync(set.idx, 'utf8'));
	for (const m of j.modes || []) if (modes[m.name]) modes[m.name].cost = Number(m.cost);
	source = set.name;
	for (const f of set.stats) {
		if (!existsSync(f)) continue;
		const s = JSON.parse(readFileSync(f, 'utf8'));
		for (const k of Object.keys(modes)) {
			const v = s[k] || (s.modes || {})[k];
			if (!v) continue;
			if (typeof v.rtp === 'number') modes[k].rtp = v.rtp > 1.5 ? v.rtp / 100 : v.rtp;
			if (typeof (v.max_win ?? v.maxWin) === 'number') modes[k].maxWinX = v.max_win ?? v.maxWin;
			if (typeof v.p_bonus === 'number') modes[k].pBonus = v.p_bonus;
		}
		source += ' + stats_summary.json';
		break;
	}
}
let math = { source: 'FALLBACK src/game/math.fallback.json', ...fallback };
const gc = [join(snap, 'game_config.json')].find((f) => existsSync(f));
if (gc) {
	const g = JSON.parse(readFileSync(gc, 'utf8'));
	const missing = Object.keys(fallback).filter((k) => g[k] === undefined);
	if (missing.length) { console.error('game_config.json is missing', missing.join(', '), '- re-run scripts/sync-math.mjs'); process.exit(1); }
	math = g;
	for (const [k, c] of Object.entries(g.costs)) if (modes[k] && modes[k].cost !== Number(c)) { console.error(`cost ${k}: index ${modes[k].cost} vs game_config ${c}`); process.exit(1); }
}
writeFileSync(join(app, 'src/game/modes.generated.json'), JSON.stringify({ source, modes, math }, null, 1) + '\n');
console.log('modes:', source, '| math:', math.source);
