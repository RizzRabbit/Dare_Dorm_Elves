// Pulls the math-owned game values out of the math repo into math-snapshot/ (the frontend never types them itself):
//   node scripts/sync-math.mjs <math game dir> [publish_files dir]
//   e.g. node scripts/sync-math.mjs /workspace/elfhaus-math-retune/math/games/elfhaus
// Writes math-snapshot/game_config.json from game_calculations.py (paytable PAY, LINES, CAP_C, SPIN_CAP, MAX_RESPINS,
// START_FS, GUARANTEE, GUAR_MIN_VAL, GROW_STEP, MYSTERY_ODDS, retrigger_spins, EGW stack value, win_level edges) and reel_params.json
// (costs), and copies index.json + stats_summary.json from the publish files (default <game dir>/library/publish_files,
// stats from next to it, its ../summary, or <game dir>/library). Then run `node scripts/sync-config.mjs` (pnpm test / pnpm build do) to regenerate
// src/game/modes.generated.json. Fails loudly when a value can't be read, so a stale value never ships silently.
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const app = resolve(import.meta.dirname, '..'), snap = join(app, 'math-snapshot');
const dir = process.argv[2] && resolve(process.argv[2]);
if (!dir || !existsSync(join(dir, 'game_calculations.py'))) {
	console.error('usage: node scripts/sync-math.mjs <math games/elfhaus dir> [publish_files dir]'); process.exit(1);
}
const py = readFileSync(join(dir, 'game_calculations.py'), 'utf8');
/** A top-level python literal `NAME = {...}` / `[...]` / number, converted to JSON (tuples -> arrays, int keys -> strings). */
function lit(name) {
	const m = py.match(new RegExp(`^${name}\\s*=\\s*`, 'm'));
	if (!m) throw new Error(`math: ${name} not found in game_calculations.py`);
	let i = m.index + m[0].length, depth = 0, s = '';
	for (; i < py.length; i++) {
		const c = py[i];
		if (depth === 0 && (c === '\n' || c === '#')) break;
		if ('{[('.includes(c)) depth++;
		if ('}])'.includes(c)) depth--;
		s += c;
		if (depth === 0 && '}])'.includes(c)) break;
	}
	s = s.replace(/#[^\n]*/g, '').replace(/\(/g, '[').replace(/\)/g, ']').replace(/(\d)_(?=\d)/g, '$1').replace(/([{,]\s*)(\d+)\s*:/g, '$1"$2":').replace(/,\s*([}\]])/g, '$1').trim();
	try { return JSON.parse(s); } catch { throw new Error(`math: could not parse ${name} = ${s.slice(0, 80)}`); }
}
const need = (v, what) => { if (v === undefined || v === null || Number.isNaN(v)) throw new Error(`math: ${what} missing`); return v; };
const retrig = py.match(/def retrigger_spins\(n\):[\s\S]*?return (\d+) if n >= (\d+) else (\d+) if n == (\d+) else 0/);
// Stake Engine standard win levels: win_level(c, key) edges in x bet; level = 1 + index of the first edge above the win
// math 8e2a048: WIN_LEVEL_EDGES {standard, endFeature} + WIN_LEVEL_EDGES_BY_MODE {mode: standard edges} (bonus buys x10)
const wlE = /^WIN_LEVEL_EDGES\s*=/m.test(py) ? lit('WIN_LEVEL_EDGES') : null, wlM = /^WIN_LEVEL_EDGES_BY_MODE\s*=/m.test(py) ? lit('WIN_LEVEL_EDGES_BY_MODE') : {};
const wl = wlE ? [null, JSON.stringify(wlE.standard), JSON.stringify(wlE.endFeature)] : py.match(/def win_level\(c, key\):[\s\S]*?if key == "standard":\s*edges = (\[[^\]]*\])\s*else:\s*edges = (\[[^\]]*\])/);
const egwVal = py.match(/emit\("egwStart",[^\n]*value=(\d+)\)/);
const params = JSON.parse(readFileSync(join(dir, 'reel_params.json'), 'utf8'));
let commit = 'unknown';
try { commit = execSync('git rev-parse --short HEAD', { cwd: dir }).toString().trim(); } catch {}
const grow = lit('GROW_STEP'), guarMin = lit('GUAR_MIN_VAL');
const cfg = {
	source: `math ${commit} game_calculations.py + reel_params.json`,
	maxWinX: need(lit('CAP_C'), 'CAP_C') / 100,
	spinCap: need(lit('SPIN_CAP'), 'SPIN_CAP'),
	maxRespins: need(lit('MAX_RESPINS'), 'MAX_RESPINS'),
	lines: lit('LINES'),
	paytable: lit('PAY'),
	costs: need(params.costs, 'reel_params costs'),
	startFs: lit('START_FS'),
	mysteryOdds: lit('MYSTERY_ODDS'),
	flipOdds: lit('FLIP_ODDS'),   // 5-scatter card flip: Double Black (triple_dare) / Powder Day (hidden) weights
	guarantee: lit('GUARANTEE'),
	guarMinVal: guarMin,
	growStep: { default: 1, ...grow },
	epic: { stackX: need(guarMin.hidden, 'GUAR_MIN_VAL.hidden'), step: need(grow.hidden, 'GROW_STEP.hidden') },
	retrigger: { two: retrig ? Number(retrig[3]) : need(null, 'retrigger_spins'), threePlus: Number(retrig[1]) },
	egwStackX: egwVal ? Number(egwVal[1]) : need(null, 'egwStart value'),
	winLevels: wl ? { standard: JSON.parse(wl[1]), endFeature: JSON.parse(wl[2]), byMode: wlM } : need(null, 'win_level edges'),
};
writeFileSync(join(snap, 'game_config.json'), '{\n' + Object.entries(cfg).map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v).replace(/,/g, ', ').replace(/":/g, '": ')}`).join(',\n') + '\n}\n');
const pub = process.argv[3] ? resolve(process.argv[3]) : join(dir, 'library/publish_files');
if (existsSync(join(pub, 'index.json'))) {
	copyFileSync(join(pub, 'index.json'), join(snap, 'index.json'));
	for (const f of [join(pub, 'stats_summary.json'), join(pub, '../stats_summary.json'), join(pub, '../summary/stats_summary.json'), join(dir, 'library/stats_summary.json')]) if (existsSync(f)) { copyFileSync(f, join(snap, 'stats_summary.json')); break; }
	const idx = JSON.parse(readFileSync(join(snap, 'index.json'), 'utf8'));
	for (const m of idx.modes) if (Number(m.cost) !== Number(cfg.costs[m.name])) throw new Error(`math: index cost ${m.name} ${m.cost} != reel_params ${cfg.costs[m.name]}`);
	console.log('math-snapshot: index.json + stats_summary.json from', pub);
} else console.warn('math-snapshot: no index.json at', pub, '(kept the old one)');
writeFileSync(join(snap, 'README.md'), `Snapshot of the Elfhaus math (${cfg.source}). Written by scripts/sync-math.mjs; do not edit by hand.
- game_config.json: paytable, lines, max win, spin cap, respins, free-spin counts, guarantees, Epic stack start / step,
  wild grow steps, Mystery odds, 5-scatter flip odds, retrigger spins, EGW stack value, win-level edges (standard / endFeature), mode costs.
- index.json, stats_summary.json: the publish files' index and the run's stats (RTP, max win, bonus odds).
Re-sync: node scripts/sync-math.mjs <math games/elfhaus dir> [publish_files dir] && node scripts/sync-config.mjs
`);
console.log('math-snapshot/game_config.json:', cfg.source);
