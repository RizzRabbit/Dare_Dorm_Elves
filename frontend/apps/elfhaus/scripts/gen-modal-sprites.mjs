// Bonus modal sprites (James 2026-10-31: the bonus cards' look is sprite parts, not CSS-drawn borders / gradients /
// shadows; the spin count is the hero line in the game's title type). Baked once at 2x, placed by CSS / ui code:
//   static/assets/ui/modal_card9.webp    the cream sign: ink rim, gold inlay, ink line, a hard drop shadow     (border-image, fill)
//   static/assets/ui/modal_window9.webp  the picture window's frame: ink rim, gold inlay, soft shadow onto the art (border-image)
//   static/assets/ui/modal_btn9.webp     the START button: gold, lit top toward the fire, dark underside, ink lip (border-image, fill)
//   static/assets/ui/modal_dim.webp      the room dimming behind a bonus card (a soft vignette, stretched over the stage)
//   static/assets/ui/titletype.webp + src/game/chalet/titletype.json   the title lettering (cream face, ink line, green rim and a
//       darker green extrusion, as on the hand-lettered bonus titles) for digits, + $ . , x / and the card words
// Run from frontend/apps/elfhaus:  node scripts/gen-modal-sprites.mjs
import { writeFileSync, readFileSync } from 'node:fs';
const PW = process.env.PW || '/usr/local/lib/pnpm/5/.pnpm/playwright@1.63.0-alpha-2026-08-31/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
const p = await b.newPage();
const font = 'data:font/woff2;base64,' + readFileSync('static/fonts/LilitaOne.woff2').toString('base64');
const out = await p.evaluate(async ({ font }) => {
	const S = 2, INK = '#26140f', CREAM = '#fbf3e4', GOLD = '#f2b935', GOLD_HI = '#ffe08a', GOLD_LO = '#b97c16';
	const rra = (g, x, y, w, h, r) => { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
	const rr = (g, ...a) => { g.beginPath(); rra(g, ...a); };
	const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w * S; c.height = h * S; const g = c.getContext('2d'); g.scale(S, S); return { c, g }; };
	const res = {};
	{ // card: 160 x 172 (12 px hard shadow under it); slices 30 / 30 / 42 / 30
		const W = 160, H = 160, { c, g } = cv(W, H + 12);
		rr(g, 0, 12, W, H, 26); g.fillStyle = 'rgba(20,8,4,.7)'; g.fill();
		rr(g, 0, 0, W, H, 26); g.fillStyle = INK; g.fill();
		rr(g, 6, 6, W - 12, H - 12, 21); g.fillStyle = GOLD; g.fill();
		g.save(); rr(g, 6, 6, W - 12, H - 12, 21); g.clip(); rr(g, 4, 4, W - 12, H - 12, 21); g.lineWidth = 2; g.strokeStyle = GOLD_HI; g.stroke(); g.restore();   // lit top-left of the inlay
		rr(g, 12, 12, W - 24, H - 24, 16); g.fillStyle = INK; g.fill();
		rr(g, 15, 15, W - 30, H - 30, 13); g.fillStyle = CREAM; g.fill();
		g.save(); rr(g, 15, 15, W - 30, H - 30, 13); g.clip(); g.shadowColor = 'rgba(80,40,10,.32)'; g.shadowBlur = 6 * S; g.shadowOffsetY = 2 * S;
		g.beginPath(); g.rect(-40, -40, W + 80, H + 80); rra(g, 15, 15, W - 30, H - 30, 13); g.fillStyle = '#000'; g.fill('evenodd'); g.restore();   // the sign's face sits under its rim
		res.card = c.toDataURL('image/webp', 0.95);
	}
	{ // picture window frame: 90 x 90, slices 24; transparent centre
		const W = 90, { c, g } = cv(W, W);
		g.save(); rr(g, 8, 8, W - 16, W - 16, 12); g.clip(); g.shadowColor = 'rgba(20,8,4,.6)'; g.shadowBlur = 8 * S; g.shadowOffsetX = 2 * S; g.shadowOffsetY = 3 * S;
		g.beginPath(); g.rect(-40, -40, W + 80, W + 80); rra(g, 8, 8, W - 16, W - 16, 12); g.fillStyle = '#000'; g.fill('evenodd'); g.restore();
		g.beginPath(); rra(g, 0, 0, W, W, 18); rra(g, 8, 8, W - 16, W - 16, 12); g.fillStyle = INK; g.fill('evenodd');
		g.beginPath(); rra(g, 2.5, 2.5, W - 5, W - 5, 16); rra(g, 5.5, 5.5, W - 11, W - 11, 14); g.fillStyle = GOLD; g.fill('evenodd');
		res.window = c.toDataURL('image/webp', 0.95);
	}
	{ // button: 120 x 72 (6 px ink lip under it); slices 30
		const W = 120, H = 66, { c, g } = cv(W, H + 6);
		rr(g, 0, 6, W, H, 22); g.fillStyle = INK; g.fill();
		rr(g, 0, 0, W, H, 22); g.fillStyle = INK; g.fill();
		rr(g, 3.5, 3.5, W - 7, H - 7, 18.5); g.fillStyle = GOLD_LO; g.fill();
		rr(g, 3.5, 3.5, W - 7, H - 13, 18.5); g.fillStyle = GOLD; g.fill();
		g.save(); rr(g, 3.5, 3.5, W - 7, H - 13, 18.5); g.clip(); rr(g, 6, 6.5, W - 12, 13, 8); g.fillStyle = GOLD_HI; g.fill(); g.restore();
		res.btn = c.toDataURL('image/webp', 0.95);
	}
	{ // dimming behind the cards: 320 x 180, stretched to the overlay (soft, so stretching never shows)
		const W = 320, H = 180, { c, g } = cv(W, H);
		g.save(); g.translate(W * 0.5, H * 0.46); g.scale(1, (0.62 * H) / (0.7 * W));
		const r = g.createRadialGradient(0, 0, 0, 0, 0, 0.7 * W); r.addColorStop(0, 'rgba(26,15,34,.72)'); r.addColorStop(0.8, 'rgba(7,4,11,.91)'); r.addColorStop(1, 'rgba(7,4,11,.91)');
		g.fillStyle = r; g.fillRect(-W * 2, -W * 2, W * 4, W * 4); g.restore();
		res.dim = c.toDataURL('image/webp', 0.9);
	}
	{ // title lettering
		const ff = new FontFace('Lilita One', `url(${font})`); await ff.load(); document.fonts.add(ff);
		const FS = 120, E = 10, PAD = 16, H = Math.round(FS * 1.08) + E + 2 * PAD;   // cell: cap height area + extrusion + room for the strokes
		const toks = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '$', '.', ',', 'x', '/', 'FREE SPINS', 'START', 'MAX', 'TOTAL WIN', 'TAP TO CONTINUE'];
		const m = document.createElement('canvas').getContext('2d'); m.font = `${FS}px "Lilita One"`;
		const cells = toks.map((t) => { const w = Math.ceil(m.measureText(t).width + 2 * PAD + 8); return { t, w }; });
		const AW = 2048; let x = 0, y = 0; for (const c of cells) { if (x + c.w > AW) { x = 0; y += H + 2; } c.x = x; c.y = y; x += c.w + 2; }
		const A = document.createElement('canvas'); A.width = AW; A.height = y + H; const g = A.getContext('2d');
		g.font = `${FS}px "Lilita One"`; g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.miterLimit = 2;
		const base = PAD + Math.round(FS * 0.86);
		for (const c of cells) {
			const tx = c.x + PAD + 4, ty = c.y + base, txt = c.t;
			g.fillStyle = INK; g.strokeStyle = INK; g.lineWidth = 26;                      // outer ink silhouette, face to extrusion
			for (let d = 0; d <= E; d += 2) { g.strokeText(txt, tx, ty + d); }
			g.strokeText(txt, tx, ty + E);
			g.strokeStyle = '#0a5a12'; g.lineWidth = 16; for (let d = E; d >= 1; d--) g.strokeText(txt, tx, ty + d);   // darker green extrusion (the letter's depth)
			g.strokeStyle = '#2c9024'; g.lineWidth = 16; g.strokeText(txt, tx, ty);      // green rim
			g.strokeStyle = '#4fb63a'; g.lineWidth = 6; g.strokeText(txt, tx - 1, ty - 1.5); // rim catching the light (upper left)
			g.strokeStyle = INK; g.lineWidth = 5; g.strokeText(txt, tx, ty);             // ink line round the face
			g.fillStyle = CREAM; g.fillText(txt, tx, ty);
		}
		const frames = Object.fromEntries(cells.map((c) => [c.t, [c.x, c.y, c.w, H]]));
		res.title = A.toDataURL('image/webp', 0.94); res.titleJson = { size: [AW, A.height], h: H, frames };
	}
	return res;
}, { font });
const save = (path, url) => writeFileSync(path, Buffer.from(url.split(',')[1], 'base64'));
save('static/assets/ui/modal_card9.webp', out.card); save('static/assets/ui/modal_window9.webp', out.window); save('static/assets/ui/modal_btn9.webp', out.btn); save('static/assets/ui/modal_dim.webp', out.dim);
save('static/assets/ui/titletype.webp', out.title); writeFileSync('src/game/chalet/titletype.json', JSON.stringify(out.titleJson));
console.log(out.titleJson.size, out.titleJson.h);
await b.close();
