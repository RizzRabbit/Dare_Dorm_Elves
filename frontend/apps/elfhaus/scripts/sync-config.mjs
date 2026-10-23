// Writes src/game/modes.generated.json from the math publish files when they exist
// (math/games/elfhaus/library/publish_files/index.json + optional stats_summary.json); otherwise keeps
// the PROVISIONAL defaults (SPEC §10 toy prices, RTP unknown) and says so.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../../..');
const lib = join(repo, 'math/games/elfhaus/library');
const idx = join(lib, 'publish_files/index.json');
const defaults = { base: 1, ante: 1.25, dare: 40, double_dare: 210, triple_dare: 1000, mystery: 245, egw: 200 };
const modes = Object.fromEntries(Object.entries(defaults).map(([k, cost]) => [k, { cost, rtp: null, maxWinX: 50000 }]));
let source = 'PROVISIONAL (no math publish files yet)';
if (existsSync(idx)) {
	const j = JSON.parse(readFileSync(idx, 'utf8'));
	for (const m of j.modes || []) if (modes[m.name]) modes[m.name].cost = Number(m.cost);
	source = 'math publish_files/index.json';
	for (const f of ['stats_summary.json', 'publish_files/stats_summary.json']) {
		if (!existsSync(join(lib, f))) continue;
		const s = JSON.parse(readFileSync(join(lib, f), 'utf8'));
		for (const k of Object.keys(modes)) {
			const v = s[k] || (s.modes || {})[k];
			if (v && typeof v.rtp === 'number') modes[k].rtp = v.rtp > 1.5 ? v.rtp / 100 : v.rtp;
			if (v && typeof (v.max_win ?? v.maxWin) === 'number') modes[k].maxWinX = v.max_win ?? v.maxWin;
		}
		source += ' + ' + f;
	}
}
writeFileSync(join(app, 'src/game/modes.generated.json'), JSON.stringify({ source, modes }, null, 1) + '\n');
console.log('modes:', source);
