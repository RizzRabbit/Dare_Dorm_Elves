// Symbol depth sprites (James 2026-10-31: visuals are sprite parts, never CSS / canvas shadows at runtime).
// Every board symbol's depth (the dark raised edge, the top-left rim light toward the fire, a bust's dark separation
// halo, and its soft drop shadow down-right onto the tile) is baked ONCE here from the symbol's own alpha into
// static/sheets/symdepth.webp, two frames per symbol:
//   <K>_e  edge: raised edge + rim light (+ halo), crisp, with the symbol itself cut out (it sits under the symbol)
//   <K>_d  drop: the soft drop shadow at rest; at runtime only its translate / scale follow --lift (land / win)
// Bust wilds get them for the bust (fig) only; the raised WILD lettering gets `lets_e` / `lets_d`.
// + src/game/chalet/symdepth.json (frames, pad, source boxes). Frame classes live in board/symframes.ts; the old static/symdepth.css is archived under archive/legacy-dom-ui/.
// The live cells (symrig.ts rigHTML / wildLetsHTML) place them as siblings under the body; the spinner bakes draw them.
// Run from frontend/apps/elfhaus:  node scripts/gen-symdepth-sprites.mjs
import { writeFileSync, readFileSync } from 'node:fs';
const PW = process.env.PW || '/usr/local/lib/pnpm/5/.pnpm/playwright@1.63.0-alpha-2026-08-31/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
const p = await b.newPage();
const sheet = 'data:image/webp;base64,' + readFileSync('static/sheets/symbols.webp').toString('base64');
const SJ = JSON.parse(readFileSync('src/game/chalet/symbols.sheet.json', 'utf8')).frames;
const RIG = JSON.parse(readFileSync('src/game/chalet/symrig.json', 'utf8'));
const P = 64, SE = 0.75, SD = 0.5;   // pad around the source box (src px), edge / drop frame scale
const out = await p.evaluate(async ({ sheet, SJ, RIG, P, SE, SD }) => {
	const im = new Image(); im.src = sheet; await im.decode();
	const cv = (w, h) => { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return { c, g: c.getContext('2d') }; };
	// the layer (frames at their rest pose) in its source box, padded, at scale s
	const layer = (names, W, H, s) => { const { c, g } = cv((W + 2 * P) * s, (H + 2 * P) * s);
		for (const n of names) { const f = SJ[n]; if (!f) continue; g.drawImage(im, f.frame.x, f.frame.y, f.frame.w, f.frame.h, (P + f.spriteSourceSize.x) * s, (P + f.spriteSourceSize.y) * s, f.spriteSourceSize.w * s, f.spriteSourceSize.h * s); }
		return c; };
	// = one CSS drop-shadow() on what is there so far (offset / blur in cell units, as the old filters had them)
	const shadowOf = (src, col, dx, dy, bl, cell, s) => { const { c, g } = cv(src.width, src.height); g.shadowColor = col; g.shadowOffsetX = dx * cell * s + 10000; g.shadowOffsetY = dy * cell * s; g.shadowBlur = bl * cell * s; g.drawImage(src, -10000, 0); return c; };
	const chain = (src, col, dx, dy, bl, cell, s) => { const c = shadowOf(src, col, dx, dy, bl, cell, s); c.getContext('2d').drawImage(src, 0, 0); return c; };
	const bake = (names, W, cell, spec) => {
		let r = layer(names, W, W, SE);
		const body = layer(names, W, W, SE);
		for (const [col, dx, dy, bl] of spec.edge) r = chain(r, col, dx, dy, bl, cell, SE);
		const e = r.getContext('2d'); e.globalCompositeOperation = 'destination-out'; e.drawImage(body, 0, 0);
		let rd = layer(names, W, W, SD);
		for (const [col, dx, dy, bl] of spec.edge) rd = chain(rd, col, dx, dy, bl, cell, SD);
		const [col, dx, dy, bl] = spec.drop, d = shadowOf(rd, col, dx, dy, bl, cell, SD);
		return { e: r, d };
	};
	const TIER = { edge: [['rgba(58,22,10,.92)', .005, .008, 0], ['rgba(255,242,210,.78)', -.006, -.008, 0]], drop: ['rgba(18,2,8,.56)', .038, .052, .032] };
	const FIG = (h) => ({ edge: [['rgba(58,22,10,.8)', .004, .006, 0], ['rgba(255,240,205,.72)', -.005, -.007, 0], [`rgba(16,2,8,${h})`, 0, 0, .014]], drop: ['rgba(18,2,8,.55)', .03, .042, .026] });
	const LETS = { edge: [['rgba(58,22,10,.9)', .004, .007, 0]], drop: ['rgba(20,4,8,.6)', .02, .03, .016] };
	const parts = {}, box = {};
	for (const [k, r] of Object.entries(RIG)) {
		const W = r.src[0];
		if (k.startsWith('W_')) {
			const fig = r.parts.filter((q) => q.cls === 'fig').map((q) => q.f), o = bake(fig, W, W / 0.925, FIG(k === 'W_R1' ? .85 : .55));
			parts[k + '_e'] = o.e; parts[k + '_d'] = o.d; box[k] = W;
			if (!parts.lets_e) { const lo = bake(r.parts.filter((q) => q.cls === 'lets').map((q) => q.f), W, W / 0.925, LETS); parts.lets_e = lo.e; parts.lets_d = lo.d; box.lets = W; }
		} else {
			const fi = k === 'S' ? 0.033 : 0.06, names = [k, ...r.parts.filter((q) => !q.hide).map((q) => q.f)], o = bake(names, W, W / (1 - 2 * fi), TIER);
			parts[k + '_e'] = o.e; parts[k + '_d'] = o.d; box[k] = W;
		}
	}
	const AW = 2048, pos = {}; let x = 0, y = 0, sh = 0;
	for (const [k, c] of Object.entries(parts)) { if (x + c.width > AW) { x = 0; y += sh + 2; sh = 0; } pos[k] = [x, y]; x += c.width + 2; sh = Math.max(sh, c.height); }
	const A = cv(AW, y + sh), frames = {};
	for (const [k, c] of Object.entries(parts)) { const [px, py] = pos[k]; A.g.drawImage(c, px, py); frames[k] = { frame: { x: px, y: py, w: c.width, h: c.height } }; }
	return { atlas: A.c.toDataURL('image/webp', 0.92), frames, box, size: { w: AW, h: A.c.height } };
}, { sheet, SJ, RIG, P, SE, SD });
writeFileSync('static/sheets/symdepth.webp', Buffer.from(out.atlas.split(',')[1], 'base64'));
writeFileSync('src/game/chalet/symdepth.json', JSON.stringify({ frames: out.frames, meta: { image: 'symdepth.webp', size: out.size, pad: P, box: out.box } }));
console.log(out.size, Object.keys(out.frames).length);
await b.close();
