// Roxy v7 (approved turnaround -> A3 game pose), LIGHTWEIGHT in-game build. One WebP atlas (static/assets/rig/roxy_v7.*):
// the whole A3 figure (cup arm + body, alpha-over of the two whole-generation layers), 7 whole-head generations
// (base / blink half / blink closed / wink / smile / "ooh" / excited) and the finger-at-lips piece. No hop, no talk, no wave.
// Motion = code tweens only:
//  - idle: calm breathing + weight sway on ONE coarse body mesh (3 smooth bands: chest / hips / planted feet, ~500 verts),
//    ponytail secondary motion on ONE coarse head mesh (3-bone spring chain), blinks at a natural rate;
//  - cosmetic idle beats on a NON-seeded RNG (Math.random; never touches game logic): a smile, a wink or smile-then-wink
//    every 20-45 s (jittered, no choice more than twice in a row, varied holds) and a small hip shake every 45-90 s;
//  - events: anticipate(on) = "ooh" face + slight tense lean toward the board; win() = hip shake + smile + wink, or the
//    excited face + hip shake when it lands out of a 2-scatter anticipation (bonus hit); a miss eases straight back to idle.
// Face changes are hard swaps of whole heads (never patched). ?roxyfast=1 shortens the cosmetic intervals (review only).
import { BlurFilter, AlphaFilter, Container, Matrix, Mesh, MeshSimple, Sprite, Texture } from 'pixi.js';
import type { RoxyAdapter, RoxyFace, RoxyGrade } from './types';
import { loadSheet } from '../scene/load';
import { ctex } from '../scene/util';

const DIR = 'assets/rig/';
type Head = 'base' | 'blink_half' | 'blink_closed' | 'wink' | 'm_smile' | 'm_oo' | 'excited';
type M = [number, number, number, number, number, number];   // a b c d tx ty
const I: M = [1, 0, 0, 1, 0, 0];
const mul = (m: M, n: M): M => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
/** rotate by r about (px,py), then translate (dx,dy) */
const rotAt = (r: number, px: number, py: number, dx = 0, dy = 0): M => { const c = Math.cos(r), s = Math.sin(r); return [c, s, -s, c, px - c * px + s * py + dx, py - s * px - c * py + dy]; };
const sm = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const rand = (a: number, b: number) => a + (b - a) * Math.random();   // cosmetic only: deliberately not the game's RNG

// master space = game_A3 px (864 x 1152, ground row 1127). Bones / bands below are in master px.
const OX = 428.5, GROUND = 1127;           // origin between her feet on the floor line (figure-box centre)
const HEAD_ROOM = 88;                        // extra rows above the head so the layouts keep the v6 framing (v6 kept hop room)
const CHEST_PIV = { x: 430, y: 560 }, HIP_PIV = { x: 440, y: 600 };
const PT = [{ x: 480, y: 75 }, { x: 545, y: 120 }, { x: 570, y: 200 }, { x: 575, y: 262 }];   // ponytail chain (rig.js)
// body bands: chest (and both arms, cup, crop top) above 470, waist blend 470-520, hips/seat 520-690, legs fade to planted feet by 1010
const bodyW = (_x: number, y: number): [number, number, number] => { const c = sm(520, 470, y), h = (1 - c) * sm(1010, 690, y); return [c, h, 1 - c - h]; };
// head mesh: rigid head + ponytail (hair right of the face/ear and the loop above the scrunchie), as rig.js ponyW
function ponyW(X: number, Y: number): [number, number, number, number] {
	const lx = Y < 110 ? 470 : Y < 190 ? 470 + ((Y - 110) / 80) * 75 : 545;
	let r = sm(lx - 12, lx + 12, X); const d = Math.hypot((X - 515) / 30, (Y - 160) / 32); if (d < 1.4) r *= sm(1.0, 1.4, d);
	r *= sm(55, 75, Y + (X - 480) * 0.3) * (Y < 110 ? sm(440, 470, X) : 1);
	let best = 1e9, sB = 0, acc = 0; const segL: number[] = [];
	for (let i = 0; i < PT.length - 1; i++) { const a = PT[i], b = PT[i + 1], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
		const t = Math.min(1, Math.max(0, ((X - a.x) * dx + (Y - a.y) * dy) / (L * L))), dd = Math.hypot(a.x + dx * t - X, a.y + dy * t - Y);
		if (dd < best) { best = dd; sB = acc + t * L; } segL.push(acc); acc += L; }
	const a = sm(0, 40, sB) * r, b = sm(segL[1] - 30, segL[1] + 30, sB), c = sm(segL[2] - 30, segL[2] + 30, sB);
	return [1 - a, a * (1 - b), a * b * (1 - c), a * b * c];
}
type Grid = { mesh: MeshSimple; rest: Float32Array; w: Float32Array; nb: number };
function grid(tex: Texture, x0: number, y0: number, w: number, h: number, step: number, nb: number, wf: (x: number, y: number) => number[]): Grid {
	const nx = Math.ceil(w / step) + 1, ny = Math.ceil(h / step) + 1, n = nx * ny;
	const pos = new Float32Array(n * 2), uv = new Float32Array(n * 2), rest = new Float32Array(n * 2), W = new Float32Array(n * nb), idx: number[] = [];
	for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i, u = Math.min(1, (i * step) / w), v = Math.min(1, (j * step) / h);
		const X = x0 + u * w, Y = y0 + v * h; uv[2 * k] = u; uv[2 * k + 1] = v; rest[2 * k] = X; rest[2 * k + 1] = Y;
		pos[2 * k] = X - OX; pos[2 * k + 1] = Y - GROUND; const ws = wf(X, Y); for (let b = 0; b < nb; b++) W[k * nb + b] = ws[b]; }
	for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i; idx.push(a, a + 1, a + nx, a + 1, a + nx + 1, a + nx); }
	const mesh = new MeshSimple({ texture: tex, vertices: pos, uvs: uv, indices: new Uint32Array(idx) });
	return { mesh, rest, w: W, nb };
}
function skin(g: Grid, Ms: M[]) {
	const v = g.mesh.vertices, { rest, w, nb } = g;
	for (let k = 0, n = rest.length / 2; k < n; k++) { const X = rest[2 * k], Y = rest[2 * k + 1]; let x = 0, y = 0;
		for (let b = 0; b < nb; b++) { const wt = w[k * nb + b]; if (wt < 1e-4) continue; const m = Ms[b]; x += wt * (m[0] * X + m[2] * Y + m[4]); y += wt * (m[1] * X + m[3] * Y + m[5]); }
		v[2 * k] = x - OX; v[2 * k + 1] = y - GROUND; }
	g.mesh.vertices = v;
}

export async function createRoxy(): Promise<RoxyAdapter> {
	const { sheet, json } = await loadSheet(DIR, 'roxy_v7');
	const RG = json.meta.rig, TX = sheet.textures as Record<string, Texture>;
	const [bx, by] = RG.origin.body as [number, number], [hx, hy] = RG.origin.head_base as [number, number], [fx, fy] = RG.origin.finger as [number, number];
	const F: number = RG.res, bw = TX.body.width / F, bh = TX.body.height / F, hw = TX.head_base.width / F, hh = TX.head_base.height / F;
	const SRC_W = 584, SRC_H = GROUND + HEAD_ROOM;                       // frame: 0.525 w/h and headroom like v6, so both layouts fit her the same way
	const view = new Container(); view.label = 'roxy';
	// shadows: contact blobs under the shoes + a static cast shadow (tinted figure, flattened + skewed, blurred once, cached)
	const castSh = new Container(), castC = new Container(); castC.addChild(castSh);
	for (const [n, x, y] of [['body', bx, by], ['head_base', hx, hy]] as const) { const s = new Sprite(TX[n]); s.scale.set(1 / F); s.position.set(x - OX, y - GROUND); s.tint = 0x12041a; castSh.addChild(s); }
	castSh.scale.set(1, -0.24); castSh.skew.set(-0.5, 0); castC.filters = [new BlurFilter({ strength: 3, quality: 2 }), new AlphaFilter({ alpha: 0.42 })];
	const contactTex = ctex(220, 40, (g) => { g.save(); g.scale(1, 40 / 220); const gr = g.createRadialGradient(110, 110, 4, 110, 110, 110);
		gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 220, 220); g.restore(); });
	const shadows = new Container(); shadows.addChild(castC);
	for (const [x, y, w] of [[-95, -10, 170], [132, -12, 165]]) { const s = new Sprite(contactTex); s.anchor.set(0.5); s.position.set(x, y); s.width = w; s.height = 30; s.alpha = 0.9; shadows.addChild(s); }
	view.addChild(shadows);
	let cached = false; const cacheShadow = () => { if (cached) return; cached = true; try { (castC as any).cacheAsTexture?.(true); } catch { /* fine uncached */ } };
	// figure: body mesh, head mesh (+ ponytail), finger at her lips (rides the chest)
	const body = grid(TX.body, bx, by, bw, bh, 30, 3, bodyW);
	const head = grid(TX.head_base, hx, hy, hw, hh, 14, 4, ponyW);
	const fig = new Container(); fig.addChild(body.mesh, head.mesh);
	const finger = new Sprite(TX.finger); finger.scale.set(1 / F); const fingerC = new Container(); finger.position.set(fx - OX, fy - GROUND); fingerC.addChild(finger); fig.addChild(fingerC); const fingerM = new Matrix();
	// free-spins party light (setParty): a night key = a mild pink-lilac vertex tint on the figure (k = 0 leaves the tint white,
	// so her base look and approved skin are exactly as before), and a flat magenta rim = the same meshes (shared geometry, so
	// they follow every tween) drawn as a silhouette just behind her, nudged toward the party light. No filter / no extra pass:
	// 3 extra draws, and only while k > 0. The silhouette atlas is made once, on the first bonus.
	const rim = new Container(); rim.visible = false; view.addChild(rim, fig);
	let rimBody: Mesh | null = null, rimHead: Mesh | null = null, rimFingerC: Container | null = null, silHeads: Record<string, Texture> = {}, rimSide = -1;
	function buildRim() {
		const src = TX.body.source, res: any = src.resource, cv = document.createElement('canvas'); cv.width = src.pixelWidth; cv.height = src.pixelHeight;
		const g = cv.getContext('2d')!; g.drawImage(res, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
		const sil = Texture.from(cv).source, sub = (t: Texture) => new Texture({ source: sil, frame: t.frame.clone(), orig: t.orig.clone(), trim: t.trim?.clone() });
		rimBody = new Mesh({ geometry: body.mesh.geometry, texture: sub(TX.body) });
		for (const h of Object.keys(heads)) silHeads[h] = sub(heads[h as Head]);
		rimHead = new Mesh({ geometry: head.mesh.geometry, texture: silHeads.base });
		const rf = new Sprite(sub(TX.finger)); rf.scale.set(1 / F); rf.position.set(fx - OX, fy - GROUND); rimFingerC = new Container(); rimFingerC.addChild(rf);
		rim.addChild(rimBody, rimHead, rimFingerC); rim.tint = 0xff3fae;
	}
	const lerpC = (a: number, b: number, k: number) => { let o = 0; for (const sh of [16, 8, 0]) o |= Math.round(((a >> sh) & 255) + ((((b >> sh) & 255) - ((a >> sh) & 255)) * k)) << sh; return o; };
	function setParty(k: number, side?: number) {
		if (side) rimSide = side;
		fig.tint = k > 0 ? lerpC(0xffffff, 0xd9c0e2, k) : 0xffffff;   // dimmer night key with a slight pink cast
		if (k > 0 && !rimBody) { try { buildRim(); } catch (e) { console.warn('roxy party rim off', e); } }
		rim.visible = k > 0 && !!rimBody; rim.alpha = 0.9 * k; rim.position.set(5.5 * rimSide, -3);
	}
	const heads = {} as Record<Head, Texture>; for (const h of ['base', 'blink_half', 'blink_closed', 'wink', 'm_smile', 'm_oo', 'excited'] as Head[]) heads[h] = TX['head_' + h];

	// ---- state ----
	const fast = /[?&]roxyfast=1/.test(location.search), calmOnly = matchMedia?.('(prefers-reduced-motion: reduce)').matches;
	const IV = fast ? { cos: [3, 6], shake: [7, 10] } : { cos: [20, 45], shake: [45, 90] };
	const X = { t: 0, ant: 0, antOn: false, lean: 0, forced: null as Head | null, door: false,
		blinkT: -1, nextBlink: rand(2, 4), seq: [] as { f: Head; d: number }[], seqT: 0, seqKind: '' as string,
		nextCos: rand(IV.cos[0], IV.cos[1]), lastCos: [] as string[], shakeT: -1, shakeD: 0.85, nextShake: rand(IV.shake[0], IV.shake[1]),
		sp: [{ y: 0, v: 0 }, { y: 0, v: 0 }, { y: 0, v: 0 }], eventUntil: 0 };
	const playSeq = (kind: string, s: { f: Head; d: number }[]) => { X.seq = s; X.seqT = 0; X.seqKind = kind; X.blinkT = -1; };
	const shake = () => { if (calmOnly) return; X.shakeT = 0; X.shakeD = rand(0.7, 0.95); };
	function cosmetic() {   // smile / wink / smile+wink, never the same pick 3x running
		const opts = ['smile', 'wink', 'smileWink'].filter((o) => !(X.lastCos.length >= 2 && X.lastCos[0] === o && X.lastCos[1] === o));
		const k = opts[Math.floor(Math.random() * opts.length)]; X.lastCos = [k, ...X.lastCos].slice(0, 2);
		if (k === 'smile') playSeq(k, [{ f: 'm_smile', d: rand(1.1, 1.9) }]);
		else if (k === 'wink') playSeq(k, [{ f: 'wink', d: rand(0.32, 0.5) }]);
		else playSeq(k, [{ f: 'm_smile', d: rand(0.7, 1.2) }, { f: 'wink', d: rand(0.32, 0.48) }, { f: 'm_smile', d: rand(0.3, 0.6) }]);
	}
	const busy = () => X.antOn || X.forced != null || X.door || X.t < X.eventUntil;
	const spring = (s: { y: number; v: number }, x: number, dt: number, f: number, z: number) => { const w = 2 * Math.PI * f;
		for (let i = 0; i < 4; i++) { const h = dt / 4, a = w * w * (x - s.y) - 2 * z * w * s.v; s.v += a * h; s.y += s.v * h; } return s.y; };
	let perfAcc = 0, perfN = 0;
	function update(dt: number) {
		const t0 = performance.now();
		if (!(dt > 0)) dt = 1 / 60; dt = Math.min(dt, 0.05); X.t += dt; const t = X.t;
		// schedulers (cosmetic only)
		if (t > X.nextCos) { if (!busy() && X.seq.length === 0) cosmetic(); X.nextCos = t + rand(IV.cos[0], IV.cos[1]); }
		if (t > X.nextShake) { if (!busy() && X.shakeT < 0) shake(); X.nextShake = t + rand(IV.shake[0], IV.shake[1]); }
		// anticipation lean: snappy in (0.18 s), calm out (0.45 s)
		X.ant += ((X.antOn ? 1 : 0) - X.ant) * Math.min(1, dt * (X.antOn ? 12 : 5));
		const calm = 1 - 0.7 * X.ant;
		const sway = Math.sin((2 * Math.PI * t) / 5.2), breathe = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 3.4);
		let hdx = 2.6 * sway * calm, hdy = 0, hr = 0.004 * sway * calm;
		if (X.shakeT >= 0) { X.shakeT += dt; const u = X.shakeT / X.shakeD; if (u >= 1) X.shakeT = -1; else {
			const env = Math.sin(Math.PI * u) ** 0.8, ph = 2 * Math.PI * 3.3 * X.shakeT;
			hdx += 6.5 * env * Math.sin(ph); hr += 0.022 * env * Math.sin(ph + 0.6); hdy += -1.4 * env * Math.abs(Math.sin(ph)); } }
		const cdx = -1.0 * sway * calm - 5 * X.ant, cdy = -1.3 * breathe, cr = -0.002 * sway * calm - 0.012 * X.ant;
		const MC = rotAt(cr, CHEST_PIV.x, CHEST_PIV.y, cdx, cdy), MH = rotAt(hr, HIP_PIV.x, HIP_PIV.y, hdx, hdy);
		skin(body, [MC, MH, I]);
		// ponytail: spring chain driven by the chest + hip motion, plus a slow drift
		const drive = cr + 0.004 * cdx + 0.0025 * hdx;
		const y1 = spring(X.sp[0], drive, dt, 2.2, 0.32), y2 = spring(X.sp[1], y1, dt, 2.6, 0.3), y3 = spring(X.sp[2], y2, dt, 3.0, 0.28);
		const drift = 0.012 * Math.sin((2 * Math.PI * t) / 4.6 + 0.8);
		const P1 = mul(MC, rotAt(0.9 * (y1 - drive) + drift, PT[0].x, PT[0].y)), P2 = mul(P1, rotAt(1.2 * (y2 - y1) + 0.5 * drift, PT[1].x, PT[1].y)), P3 = mul(P2, rotAt(1.4 * (y3 - y2), PT[2].x, PT[2].y));
		skin(head, [MC, P1, P2, P3]);
		fingerM.set(MC[0], MC[1], MC[2], MC[3], MC[4] + MC[0] * OX + MC[2] * GROUND - OX, MC[5] + MC[1] * OX + MC[3] * GROUND - GROUND); fingerC.setFromMatrix(fingerM);
		// face
		let f: Head = 'base';
		if (X.seq.length) { X.seqT += dt; while (X.seq.length && X.seqT >= X.seq[0].d) { X.seqT -= X.seq[0].d; X.seq.shift(); } if (X.seq.length) f = X.seq[0].f; }
		if (X.antOn) f = 'm_oo';
		if (X.forced) f = X.forced;
		if (f === 'base' || f === 'm_smile') {   // natural blinks (not during a wink / ooh / excited)
			if (X.blinkT >= 0) { X.blinkT += dt; const i = Math.floor(X.blinkT * 30); if (i < 6) f = i < 1 || i >= 4 ? 'blink_half' : 'blink_closed'; else X.blinkT = -1; }
			else if (t > X.nextBlink) { X.blinkT = 0; X.nextBlink = t + rand(2.4, 5.6); }
		}
		if (head.mesh.texture !== heads[f]) head.mesh.texture = heads[f];
		if (rim.visible && rimHead) { if (rimHead.texture !== silHeads[f]) rimHead.texture = silHeads[f]; rimFingerC!.setFromMatrix(fingerM); }
		perfAcc += performance.now() - t0; perfN++;
		if (perfN >= 120) { (window as any).__roxyPerf = { msPerFrame: perfAcc / perfN, verts: (body.rest.length + head.rest.length) / 2 }; perfAcc = 0; perfN = 0; }
	}
	update(1 / 60);
	const A: RoxyAdapter = {
		view, srcW: SRC_W, srcH: SRC_H, height: GROUND - hy, offsetX: 0,
		rows: { headTop: Math.round(hy + HEAD_ROOM), hopTop: 0, hips: 560 + HEAD_ROOM },
		update,
		idle() { X.antOn = false; },
		win(kind) {   // bonus / feature hit (incl. a 2-scatter tease that landed): excited face; big win: smile + wink. Both + hip shake.
			const hit = kind ? kind === 'bonus' : X.antOn; X.antOn = false; shake(); X.eventUntil = X.t + 2.2;
			if (hit) playSeq('excited', [{ f: 'excited', d: rand(1.6, 1.9) }, { f: 'm_smile', d: rand(0.4, 0.6) }]);
			else playSeq('win', [{ f: 'm_smile', d: rand(0.8, 1.0) }, { f: 'wink', d: rand(0.38, 0.48) }, { f: 'm_smile', d: rand(0.5, 0.8) }]);
		},
		surprised(on) { X.forced = on ? 'excited' : X.forced === 'excited' ? null : X.forced; },
		anticipate(on) {
			if (on && !X.antOn) { X.seq = []; X.blinkT = -1; }
			if (!on && X.antOn) X.nextBlink = X.t + rand(1.6, 3.2);   // no catch-up blink on the way out: a miss just settles back
			X.antOn = on;
		},
		disappointed() { X.antOn = false; },   // James: a miss just eases back to idle (no sigh / sad face)
		doorReach(on) { X.door = on; },        // v7 has no door-reach arm: she stands in the doorway in her game pose
		doorPts() { return null; },
		face(name: RoxyFace, k: number) {
			const map: Record<RoxyFace, Head | null> = { half: 'blink_half', closed: 'blink_closed', wink: 'wink', surprised: 'excited', lookL: null, lookR: null };
			const h = map[name]; if (!h) return;
			if (k >= 0.5) X.forced = h; else if (X.forced === h) X.forced = null;
		},
		release() { X.door = false; X.forced = null; X.nextBlink = X.t + 1.5; cacheShadow(); },
		setParty,
		setGrade(_g: RoxyGrade) { /* v7: no per-frame grade pass (keeps her skin from warming toward orange, and saves a filter pass) */ },
		shadow(on) { shadows.visible = on; if (on) cacheShadow(); },
		destroy() { view.destroy({ children: true }); },
	};
	// review hooks only (clips / QA): fire a beat now, or park the random scheduler. Nothing in the game calls these.
	(window as any).__roxyDev = {
		play(k: string) {
			if (k === 'shake') shake(); else if (k === 'smile') playSeq(k, [{ f: 'm_smile', d: 1.4 }]); else if (k === 'wink') playSeq(k, [{ f: 'wink', d: 0.42 }]);
			else if (k === 'smileWink') playSeq(k, [{ f: 'm_smile', d: 0.9 }, { f: 'wink', d: 0.42 }, { f: 'm_smile', d: 0.45 }]); else if (k === 'blink') X.blinkT = 0;
			else if (k === 'win' || k === 'bonus') A.win(k); else if (k === 'antOn') A.anticipate(true); else if (k === 'antOff') A.anticipate(false);
		},
		hold(on = true) { if (on) X.nextCos = X.nextShake = 1e9; else { X.nextCos = X.t + rand(IV.cos[0], IV.cos[1]); X.nextShake = X.t + rand(IV.shake[0], IV.shake[1]); } },
		get state() { return { t: X.t, ant: X.ant, antOn: X.antOn, seq: X.seqKind, seqLeft: X.seq.length, shaking: X.shakeT >= 0, nextCos: X.nextCos, nextShake: X.nextShake, last: X.lastCos, face: (Object.keys(heads) as Head[]).find((h) => heads[h] === head.mesh.texture) }; },
	};
	return A;
}
