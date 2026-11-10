// Badge lifecycle, glow removal, and merge lean staying inside the cell.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mergeAmp, mergeLean, MERGE_MAX_DROP, leanWithinCell, translateYs } from '../src/game/mergeclock.ts';

const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
let fail = 0;
const ok = (c, m) => { if (c) console.log('  OK ' + m); else { fail++; console.error('  FAIL ' + m); } };

console.log('\n=== merge lean stays inside the cell ===');
{
	ok(MERGE_MAX_DROP === 8, 'max drop is 8 px');
	for (const amp of [1, 0.5]) {
		for (const n of [2, 3, 4, 5]) {
			for (const d of [-220, -110, 110, 220]) {
				const p = mergeLean(d, n, amp);
				const ys = [...translateYs(p.crouch), ...translateYs(p.over), ...translateYs(p.pull)];
				ok(leanWithinCell(p.crouch) && leanWithinCell(p.over) && leanWithinCell(p.pull),
					`n=${n} d=${d} amp=${amp} ys=${ys.join(',')}`);
				ok(!/translateY\(-/.test(p.crouch + p.over + p.pull), 'no upward jump out of the mask');
			}
		}
	}
	ok(mergeLean(110, 2, 1).pull.includes('translateX'), 'pull travels horizontally');
	const half = mergeLean(110, 2, mergeAmp(true));
	const full = mergeLean(110, 2, 1);
	ok(translateYs(half.crouch)[0] < translateYs(full.crouch)[0] || translateYs(full.crouch)[0] === 0,
		'reduced motion shortens the crouch drop');
}

console.log('\n=== source: glow leaves with the rig, badges are hidden at grab ===');
{
	const mf = src('../src/game/mergefx.ts');
	const cb = src('../src/game/combine.ts');
	const db = src('../src/game/dbstacks.ts');
	ok(cb.includes('export function hideGem') && cb.includes("m.style.visibility = 'hidden'"), 'hideGem uses visibility so the board mirror drops the glyph');
	ok(cb.includes('src.forEach(hideGem)') || cb.includes('src.forEach((m) => hideGem'), 'grab hides the original badges in the same turn');
	ok(cb.includes('export function clearCoveredGems'), 'covered cell badges have a lifecycle cleanup');
	ok(mf.includes('hideMergeGlows') && mf.includes('stk_glow'), 'merge strips the outline glow before the lean');
	ok(mf.indexOf('hideMergeGlows(olds)') < mf.indexOf("dbPlay(o, 'win'"), 'glow is removed before the live win clip');
	ok(mf.indexOf("dbPlay(o, 'win'") < mf.indexOf('await beat(MERGE_BEAT)'), 'live rigs play a win clip during the lean');
	ok(mf.indexOf('await beat(MERGE_BEAT)') < mf.indexOf('stackRelease(olds)'), 'live rigs are released at the hit, not before the lean');
	ok(db.includes("ov.querySelector(':scope > img.stk_glow')?.remove()"), 'dbStop still removes the glow with the rig');
	ok(!/dbAct\(/.test(mf), 'live bone lift is not used (it walked the elf out of its glow)');
	ok(!/translateY\(\$\{Math\.round\(26/.test(mf) && !/translateY\(\$\{Math\.round\(16/.test(mf),
		'no large downward CSS drop');
	ok(mf.includes('flyGems') && src('../src/game/bookEventHandlerMap.ts').includes("flyGems(") &&
		src('../src/game/bookEventHandlerMap.ts').includes("'add'"),
		'single-reel stacks use the same gem flight, adding the cell values');
	ok(mf.includes("play('fx_wild'") && mf.includes("play('fx_feat', 'burst'"), 'impact uses existing fx sprites');
	ok(!/createLinearGradient|box-shadow|linear-gradient|radial-gradient/.test(mf), 'no drawn gradients or shadows in the merge');
}

console.log(fail ? `\nmergebadge tests: ${fail} FAILED` : '\nmergebadge tests: all passed');
process.exit(fail ? 1 : 0);
