// Writes src/game/modes.generated.json from the math publish files: the live math folder
// (math/games/elfhaus/library/publish_files/index.json + stats_summary.json) when it exists in the repo,
// otherwise the vendored math-snapshot/ copy; only if neither exists, the PROVISIONAL defaults.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../../..');
const lib = join(repo, 'math/games/elfhaus/library');
const snap = join(app, 'math-snapshot');
const defaults = { base: 1, ante: 3, dare: 50, double_dare: 225, triple_dare: 700, mystery: 600, egw: 450 };
const modes = Object.fromEntries(Object.entries(defaults).map(([k, cost]) => [k, { cost, rtp: null, maxWinX: 50000, pBonus: null }]));
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
writeFileSync(join(app, 'src/game/modes.generated.json'), JSON.stringify({ source, modes }, null, 1) + '\n');
console.log('modes:', source);
