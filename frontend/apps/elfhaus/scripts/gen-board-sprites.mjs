// Board layer sprites (James 2026-10-31: the board reads as layers, back to front: green board < timber frame < gold trim
// < tile < symbol, each casting depth on the one behind it; and visuals are sprite parts, never drawn by code at runtime).
// Bakes every board part once, at 2x design px (mkboard.ts: CELL 160, FT 34, FB 52, BW 800, BH 640), into ONE WebP atlas:
//   board9  pine board (opaque; the game sets its see-through alpha)                       9-slice
//   shade9  the frame + trim's soft shadow cast inward onto the board (deeper on the fire-away side)  9-slice
//   slot    one tile's drop shadow + contact AO on the board (reused for all 20 slots)
//   frame_shadow9  the frame's drop shadow onto the room (its own part, under the board)   9-slice
//   tshade  each tile's soft inner shade ring (CSS sprite on .tile::after)
//   frame   timber band, plank seams, chamfered inner lip (lit right / bottom, shaded left / top), sill, rivets, snow caps
//   trim9   the raised gold rail: lit crown, dark underside, contact shadow onto frame and board   9-slice
//   rim     the raised tile's lit rim (top-left) and shaded edge (bottom-right), over every tile (CSS)
//   lit     the fire's warm spill on the frame's left side (CSS, opacity only at runtime)
//   glint   the flare highlight band that runs across the frame (CSS, transform / opacity only)
// and appends `dot` (128 px) + `blob` (256 px) soft light sprites to assets/room/roomfx.{webp,json} (re-runnable: it
// replaces them).
// One key light: the fire, upper left. Run from frontend/apps/elfhaus:  node scripts/gen-board-sprites.mjs
import { writeFileSync, readFileSync } from 'node:fs';
const PW = process.env.PW || '/usr/local/lib/pnpm/5/.pnpm/playwright@1.63.0-alpha-2026-08-31/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
const p = await b.newPage();
const roomfx = 'data:image/webp;base64,' + readFileSync('static/assets/room/roomfx.webp').toString('base64');
const roomJ = JSON.parse(readFileSync('static/assets/room/roomfx.json', 'utf8'));
const out = await p.evaluate(async ({ roomfx, roomJ }) => {
	const S = 2, CELL = 160, FT = 34, FB = 52, BW = 800, BH = 640, FW = BW + 2 * FT, FH = BH + FT + FB;
	const INK = '#26140f', WOOD = '#7a4526', WOOD_HI = '#9c5d33', SEAM = '#56301a', GOLD = '#f2b935', GOLD_HI = '#ffe08a', CRAN = '#a61c34', PINE = '#163a2b', SNOW = '#fbf5ea';
	// ring geometry (design px from the frame's top-left; the window is BWx x BHx at (FT, FT))
	const TO = FT - 15, TI = FT - 4, LIP0 = FT - 25, WIN = FT - 15;   // trim outer / inner, lip outer, window punched in the frame
	const rra = (g, x, y, w, h, r) => { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
	const rr = (g, ...a) => { g.beginPath(); rra(g, ...a); };
	const cv = (w, h, ox = 0, oy = 0) => { const c = document.createElement('canvas'); c.width = Math.ceil(w * S); c.height = Math.ceil(h * S); const g = c.getContext('2d'); g.setTransform(S, 0, 0, S, ox * S, oy * S); return { c, g }; };
	// a window-shaped geometry helper for an inner board of bw x bh
	const geo = (bw, bh) => {
		const fw = bw + 2 * FT, fh = bh + 2 * FT;
		const box = (o) => [o, o, fw - 2 * o, fh - 2 * o];
		return { fw, fh, box, ring: (g, o, ro, i, ri, dx = 0, dy = 0) => { g.beginPath(); const a = box(o), c = box(i); rra(g, a[0] + dx, a[1] + dy, a[2], a[3], ro); rra(g, c[0] + dx, c[1] + dy, c[2], c[3], ri); } };
	};
	const parts = {};
	// ---- 9-slice sources: a small window (120 x 120) with the same edges / corners as the real one
	const NB = 120, G9 = geo(NB, NB);
	{ const { c, g } = cv(G9.fw, G9.fh); rr(g, ...G9.box(WIN), 24); g.fillStyle = PINE; g.fill(); parts.board9 = c; }
	{ // shade9: shadows cast onto the board by the frame + raised trim (clipped to the visible board, inside the trim)
		const { c, g } = cv(G9.fw, G9.fh); g.save(); rr(g, ...G9.box(TI), 14); g.clip();
		const inner = (col, dx, dy, bl) => { g.shadowColor = col; g.shadowOffsetX = dx * S; g.shadowOffsetY = dy * S; g.shadowBlur = bl * S;
			g.beginPath(); g.rect(-200, -200, G9.fw + 400, G9.fh + 400); rra(g, ...G9.box(TI), 14); g.fillStyle = '#000'; g.fill('evenodd'); };
		inner('rgba(6,10,6,.7)', 10, 12, 24); inner('rgba(6,10,6,.42)', 0, 0, 10); inner('rgba(4,8,4,.55)', 2.2, 3, 3.5);
		g.restore(); parts.shade9 = c;
	}
	{ // trim9: contact shadow on frame + board, ink edges, half-round rail (lit crown toward the fire, dark underside), specular run
		const { c, g } = cv(G9.fw, G9.fh), R = G9.ring;
		g.save(); g.shadowColor = 'rgba(14,5,2,.7)'; g.shadowOffsetX = 2.6 * S; g.shadowOffsetY = 3.6 * S; g.shadowBlur = 5 * S;
		R(g, TO - 2, 26, TI + 1.5, 13); g.fillStyle = INK; g.fill('evenodd');
		g.shadowColor = 'rgba(14,5,2,.45)'; g.shadowOffsetX = 0; g.shadowOffsetY = 0; g.shadowBlur = 3 * S; g.fill('evenodd'); g.restore();
		g.save(); R(g, TO, 24, TI, 14.5); g.clip('evenodd');
		g.fillStyle = '#8f5810'; g.fillRect(0, 0, G9.fw, G9.fh);                           // underside, away from the fire
		R(g, TO, 24, TI, 14.5, -3.2, -3.2); g.clip('evenodd'); g.fillStyle = GOLD_HI; g.fillRect(0, 0, G9.fw, G9.fh);   // lit edge
		R(g, TO, 24, TI, 14.5, 2.4, 2.4); g.clip('evenodd'); g.fillStyle = GOLD; g.fillRect(0, 0, G9.fw, G9.fh);
		g.restore();
		g.save(); R(g, TO, 24, TI, 14.5); g.clip('evenodd'); R(g, TO + 2.6, 21, TO + 5, 18.5); g.fillStyle = 'rgba(255,250,222,.55)'; g.fill('evenodd'); g.restore();
		parts.trim9 = c;
	}
	{ // slot: one raised tile's soft drop shadow + tight contact shade on the board (tile = the cell inset 3.75%)
		const P = 24, ti = CELL * 0.0375, tw = CELL - 2 * ti, tr = CELL * 0.135, { c, g } = cv(tw + 2 * P, tw + 2 * P);
		const sh = (col, dx, dy, bl, grow = 0) => { g.shadowColor = col; g.shadowOffsetX = (dx + 4000) * S; g.shadowOffsetY = dy * S; g.shadowBlur = bl * S;
			rr(g, P - grow - 4000, P - grow, tw + 2 * grow, tw + 2 * grow, tr + grow); g.fillStyle = '#000'; g.fill(); };
		sh('rgba(4,12,8,.62)', 5, 8, 15); sh('rgba(4,10,6,.55)', 1.2, 2, 3.6, 0.8);
		parts.slot = c;
	}
	{ // tshade: the tile's soft inner shade ring (was a CSS inset box-shadow): the tile's inner area (cell 160: tile 148, ring
		// inset 6.5% = 128 x 128, radius 11%), shade falling from the top edge (light from above)
		const T = 128, { c, g } = cv(T, T), r = T * 0.11;
		g.save(); rr(g, 0, 0, T, T, r); g.clip(); g.shadowColor = 'rgba(20,4,8,.28)'; g.shadowOffsetY = 1.9 * S; g.shadowBlur = 3.5 * S;
		g.beginPath(); g.rect(-40, -40, T + 80, T + 80); rra(g, 0, 0, T, T, r); g.fillStyle = '#000'; g.fill('evenodd'); g.restore();
		parts.tshade = c;
	}
	{ // rim over each tile: lit inner edge toward the fire (top-left), shaded inner edge away (bottom-right)
		const T = 148, { c, g } = cv(T, T), r = T * 0.146;
		const edge = (dx, dy, col) => { g.save(); rr(g, 0, 0, T, T, r); g.clip(); g.beginPath(); g.rect(-20, -20, T + 40, T + 40); rra(g, dx, dy, T, T, r); g.fillStyle = col; g.fill('evenodd'); g.restore(); };
		edge(1.6, 1.9, 'rgba(255,236,188,.42)'); edge(-1.2, -1.7, 'rgba(36,10,4,.4)');
		parts.rim = c;
	}
	{ // frame_shadow9: the frame's hard drop shadow onto the room, its own part under everything (9-slice of a 120 x 120 rounded block)
		const { c, g } = cv(120, 120); rr(g, 0, 0, 120, 120, 30); g.fillStyle = 'rgba(20,8,4,0.55)'; g.fill(); parts.frame_shadow9 = c;
	}
	{ // frame: the timber band around a window punched at WIN (the board shows through it), lip, sill, rivets, snow caps
		const top = 24, bot = 12, { c, g } = cv(FW, FH + top + bot, 0, top), fr = geo(BW, BH);
		rr(g, 0, 0, FW, FH, 30); g.fillStyle = INK; g.fill();   // ink silhouette (its drop shadow is the separate frame_shadow9 part)
		rr(g, 5, 5, FW - 10, FH - 10, 26); g.fillStyle = WOOD; g.fill();
		g.save(); rr(g, 5, 5, FW - 10, FH - 10, 26); g.clip();
		g.fillStyle = WOOD_HI; g.fillRect(5, 5, FW - 10, 7); g.fillRect(5, 5, 7, FH - 10);
		g.strokeStyle = SEAM; g.lineWidth = 2.5; g.lineCap = 'round';
		for (const x of [FW * 0.18, FW * 0.47, FW * 0.79]) { g.beginPath(); g.moveTo(x, 7); g.lineTo(x, LIP0 - 1.5); g.stroke(); }
		for (const y of [FH * 0.3, FH * 0.66]) { g.beginPath(); g.moveTo(8, y); g.lineTo(LIP0 - 1.5, y); g.stroke(); g.beginPath(); g.moveTo(FW - LIP0 + 1.5, y); g.lineTo(FW - 8, y); g.stroke(); }
		g.restore();
		// chamfered inner lip stepping down to the trim, each face shaded by which way it faces the fire
		const x0 = LIP0, y0 = LIP0, x1 = FW - LIP0, y1 = FT + BH + (FT - LIP0), d = 44;
		const side = (pts, col) => { g.save(); fr.ring(g, LIP0, 31, WIN, 24); g.clip('evenodd'); g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = col; g.fill(); g.restore(); };
		side([[x0 - 4, y0 - 4], [x1 + 4, y0 - 4], [x1 - d, y0 + d], [x0 + d, y0 + d]], '#42230f');
		side([[x0 - 4, y0 - 4], [x0 + d, y0 + d], [x0 + d, y1 - d], [x0 - 4, y1 + 4]], '#4d2913');
		side([[x1 + 4, y0 - 4], [x1 + 4, y1 + 4], [x1 - d, y1 - d], [x1 - d, y0 + d]], '#bf7a46');
		side([[x0 - 4, y1 + 4], [x1 + 4, y1 + 4], [x1 - d, y1 - d], [x0 + d, y1 - d]], '#ad6a3c');
		g.save(); fr.ring(g, LIP0, 31, LIP0 + 1.8, 29.5); g.fillStyle = 'rgba(255,214,160,.42)'; g.fill('evenodd'); g.restore();   // crest catching the light
		g.save(); fr.ring(g, LIP0 - 1.6, 32, LIP0, 31); g.fillStyle = 'rgba(30,12,4,.5)'; g.fill('evenodd'); g.restore();         // groove at the crest
		const sy = FT + BH + 14;
		rr(g, 16, sy, FW - 32, FB - 24, 10); g.fillStyle = INK; g.fill();
		rr(g, 19, sy + 3, FW - 38, FB - 30, 8); g.fillStyle = CRAN; g.fill();
		g.fillStyle = '#c7344c'; g.fillRect(25, sy + 5, FW - 50, 4);
		g.save(); g.globalCompositeOperation = 'destination-out'; rr(g, ...fr.box(WIN), 24); g.fill(); g.restore();
		const rivet = (x, y) => { g.beginPath(); g.arc(x, y, 6.5, 0, 7); g.fillStyle = INK; g.fill(); g.beginPath(); g.arc(x, y, 4.2, 0, 7); g.fillStyle = GOLD; g.fill();
			g.beginPath(); g.arc(x - 1.3, y - 1.4, 1.5, 0, 7); g.fillStyle = GOLD_HI; g.fill(); };
		const ry = sy + (FB - 24) / 2;
		[40, FW - 40, FW / 2 - 150, FW / 2 + 150].forEach((x) => rivet(x, ry));
		[[17, 17], [FW - 17, 17], [17, FH - 17], [FW - 17, FH - 17]].forEach(([x, y]) => rivet(x, y));
		g.lineJoin = 'round';
		for (const [x0, w, h] of [[26, 70, 15], [118, 120, 17], [262, 64, 13], [FW - 266, 74, 14], [FW - 160, 112, 18], [FW - 40, 60, 14]]) {
			g.beginPath(); g.moveTo(x0, 4); g.bezierCurveTo(x0 + w * 0.08, -h * 0.9, x0 + w * 0.42, -h * 1.15, x0 + w * 0.55, -h * 0.55);
			g.bezierCurveTo(x0 + w * 0.7, -h * 1.05, x0 + w * 0.98, -h * 0.7, x0 + w, 4);
			g.bezierCurveTo(x0 + w * 0.9, 12, x0 + w * 0.82, 15, x0 + w * 0.74, 9); g.bezierCurveTo(x0 + w * 0.66, 18, x0 + w * 0.56, 19, x0 + w * 0.5, 10);
			g.bezierCurveTo(x0 + w * 0.36, 14, x0 + w * 0.16, 13, x0, 4); g.closePath();
			g.fillStyle = SNOW; g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke();
			g.beginPath(); g.moveTo(x0 + w * 0.2, 2); g.quadraticCurveTo(x0 + w * 0.5, 7, x0 + w * 0.8, 2); g.lineWidth = 2.2; g.strokeStyle = '#b9cfe0'; g.stroke();
		}
		parts.frame = c;
	}
	{ // lit: warm fire spill over the frame box (stretched to it): ellipse 62% x 80% centred at (-4%, 62%)
		const W = 128, H = 128, { c, g } = cv(W, H); g.setTransform(S * W * 0.62, 0, 0, S * H * 0.8, S * W * -0.04, S * H * 0.62);
		const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, 'rgba(255,146,54,.24)'); gr.addColorStop(0.46, 'rgba(255,138,48,.08)'); gr.addColorStop(0.74, 'rgba(255,138,48,0)');
		g.fillStyle = gr; g.fillRect(-1, -1, 3, 3); parts.lit = c;
	}
	{ const { c, g } = cv(64, 32); const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(255,236,190,0)'); gr.addColorStop(0.5, 'rgba(255,246,220,.6)'); gr.addColorStop(1, 'rgba(255,236,190,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 32); parts.glint = c; }
	// pack: frame on top, the rest on shelves under it
	const order = ['frame', 'frame_shadow9', 'trim9', 'shade9', 'board9', 'slot', 'rim', 'tshade', 'lit', 'glint'], AW = parts.frame.width, pos = {};
	let x = 0, y = parts.frame.height + 2, sh = 0;
	for (const k of order) { const c = parts[k]; if (k === 'frame') { pos[k] = [0, 0]; continue; } if (x + c.width > AW) { x = 0; y += sh + 2; sh = 0; } pos[k] = [x, y]; x += c.width + 2; sh = Math.max(sh, c.height); }
	const A = document.createElement('canvas'); A.width = AW; A.height = y + sh; const ag = A.getContext('2d');
	const frames = {};
	for (const k of order) { const [px, py] = pos[k], c = parts[k]; ag.drawImage(c, px, py); frames[k] = { frame: { x: px, y: py, w: c.width, h: c.height }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: c.width, h: c.height }, sourceSize: { w: c.width, h: c.height } }; }
	const meta = { image: 'boardfx.webp', size: { w: A.width, h: A.height }, scale: String(S), format: 'RGBA8888',
		board: { nb: NB, win: WIN, trimOuter: TO, trimInner: TI, slotPad: 24, frameTop: 24, frameBot: 12, slice9: { frame_shadow9: 40, board9: FT + 10, shade9: FT + 50, trim9: FT + 18 } } };
	// room fx: + dot (bright core glow) + blob (soft pool of light), white, tinted at runtime
	const im = new Image(); im.src = roomfx; await im.decode();
	const dot = cv(64, 64); { const gr = dot.g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,240,225,0.7)'); gr.addColorStop(0.5, 'rgba(255,200,170,0.14)'); gr.addColorStop(1, 'rgba(255,200,170,0)'); dot.g.fillStyle = gr; dot.g.fillRect(0, 0, 64, 64); }
	const blob = cv(128, 128); { const gr = blob.g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); blob.g.fillStyle = gr; blob.g.fillRect(0, 0, 128, 128); }
	const rf = { ...roomJ.frames }; delete rf.dot; delete rf.blob;
	let rw = 0; for (const f of Object.values(rf)) rw = Math.max(rw, f.frame.x + f.frame.w);
	const R = document.createElement('canvas'); R.width = rw + 2 + 128 + 2 + 256; R.height = Math.max(im.height, 256); const rg = R.getContext('2d');
	rg.drawImage(im, 0, 0, rw, im.height, 0, 0, rw, im.height);
	rg.drawImage(dot.c, rw + 2, 0); rg.drawImage(blob.c, rw + 2 + 128 + 2, 0);
	const fr2 = (x, y, w, h) => ({ frame: { x, y, w, h }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w, h }, sourceSize: { w, h } });
	rf.dot = fr2(rw + 2, 0, 128, 128); rf.blob = fr2(rw + 2 + 130, 0, 256, 256);
	return { atlas: A.toDataURL('image/webp', 0.94), json: { frames, meta }, room: R.toDataURL('image/webp', 0.94), roomJson: { frames: rf, meta: { ...roomJ.meta, size: { w: R.width, h: R.height } } } };
}, { roomfx, roomJ });
const save = (path, url) => writeFileSync(path, Buffer.from(url.split(',')[1], 'base64'));
save('static/assets/board/boardfx.webp', out.atlas); writeFileSync('static/assets/board/boardfx.json', JSON.stringify(out.json));
save('static/assets/room/roomfx.webp', out.room); writeFileSync('static/assets/room/roomfx.json', JSON.stringify(out.roomJson));
console.log(out.json.meta.size, Object.fromEntries(Object.entries(out.json.frames).map(([k, v]) => [k, v.frame])), out.roomJson.meta.size);
await b.close();
