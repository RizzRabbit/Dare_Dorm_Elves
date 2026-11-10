// The room layer: ONE Pixi app on canvas#scene inside #root, behind #app. The painted chalet room itself is the DOM #bg
// (bg_land / bg_port, cover-fit); this layer adds its calm ambient life on top, registered to the same cover fit:
// snow falling past the windows, the fire's flicker glow + rising embers, and the twinkle lights (positions measured from
// the painting, chalet/bglights.json). Plus Roxy (the swappable rig adapter, ../roxyrig) beside the board.
// Free spins: the room drops to a night grade (CSS on #bg) and the snow thickens. Everything runs on real elapsed time.
// No WebGL -> the app never starts and the game runs on the #bg painting with no Roxy (nothing else depends on this layer).
// Depth pass (room.ts / depth.ts): once the room planes load, this layer paints the room itself as separate planes under
// one camera (#bg hides, body.hasRoom), and everything here rides the plane it belongs to: snow outside the glass in two
// depths (far: small, slow; near the glass: larger, soft, sparse), the fire / embers / dust / fire light with the
// fireplace, the bulbs with the wall / fireplace / tree they hang on. Cast shadows of the board, HUD bar and BUY plate.
import { Application, Container, Graphics, Sprite } from 'pixi.js';
import { ST, capResolution, viewSize } from '../stage';
import { PZ } from '../layers';
import { G as MKG, FW, FT, BW, BH } from '../mkboard';
import { createRoxy, type RoxyAdapter } from '../roxyrig';
import LIGHTS from '../chalet/bglights.json';
import { P as PL, ROOMS, buildRoom, camTick, dAt, listenCam, loadFx, loadRoom, placeShadows, reduced, roomOn, tex, tickRoom, wallItem, type Key } from './room';
import { frameFire, frameGlint, placeDepth } from './depth';
import { watchCanvas } from '../diag';

export let app: Application | null = null;
export let rig: RoxyAdapter | null = null;
const amb = new Container(), snowL = new Container(), glassL = new Container(), snowMask = new Graphics(), fireL = new Container(), twL = new Container(), twC = new Container(), twT = new Container(), roxyL = new Container(), fx = new Container();
const roxyMask = new Graphics();
const world = new Container();
let now = 0, bonus = false, nightK = 0, snap = false, roxyOn = true, hold = false, free = false, last: [boolean, DOMRect] | null = null;
const WAIST = 60;
export const roxyAt = { x: 0, y: 0, s: 1, portrait: false };

// painting geometry (normalized to the image): windows (snow), fire (glow + embers)
const PAINT = {
	land: { iw: 1920, ih: 1080, wins: [[0.248, 0.215, 0.345, 0.575], [0.727, 0.19, 0.862, 0.575]], fire: [0.108, 0.66, 0.075] },
	port: { iw: 1080, ih: 1920, wins: [[0.33, 0.125, 0.89, 0.645]], fire: [0.06, 0.69, 0.11] },
} as const;
let fit = { c: 1, ox: 0, oy: 0, key: 'land' as Key, A: 1 };
const toS = (u: number, v: number) => ({ x: fit.ox + u * PAINT[fit.key].iw * fit.c, y: fit.oy + v * PAINT[fit.key].ih * fit.c });

type Flake = { g: Sprite; x: number; y: number; vy: number; ph: number; s: number; win: number; heavy: boolean; near: boolean };
let flakes: Flake[] = [];
type Tw = { g: Sprite; ph: number; sp: number; base: number };
let tws: Tw[] = [];
type Ember = { g: Sprite; t: number; life: number; x: number; y: number; vx: number; vy: number };
let embers: Ember[] = [], fireGlow: Sprite | null = null, fireCore: Sprite | null = null, fireSpill: Sprite | null = null, emberAt = 0;
type Mote = { g: Sprite; t: number; life: number; x: number; y: number; vx: number; vy: number; s: number };
let motes: Mote[] = [], moteAt = 0, flare = 0, flareAt = 6, fl = 0.5;
const MOTES = 16, EMBERS = 14;

function build() {
	if (!tex.fx) return;   // every light / snow sprite is a part of the room fx atlas (no code-drawn textures)
	const P = PAINT[fit.key], room = roomOn();
	// snow outside the glass. With the room planes it falls in the view plane (far: small, slow) and just outside the
	// glass (near: larger, soft, sparse), both behind the wall plate whose panes are cut out. Without them it is masked
	// to the window rects over the #bg painting (the old layer).
	snowL.removeChildren().forEach((o) => o.destroy()); glassL.removeChildren().forEach((o) => o.destroy()); flakes = [];
	snowMask.clear();
	P.wins.forEach(([u0, v0, u1, v1], wi) => {
		const a = toS(u0, v0), b = toS(u1, v1); snowMask.rect(a.x, a.y, b.x - a.x, b.y - a.y).fill(0xffffff);
		const area = (b.x - a.x) * (b.y - a.y), n = Math.round(Math.min(70, area / 2600)), nn = room ? Math.round(Math.min(9, area / 26000)) : 0;
		for (let i = 0; i < n * 2 + nn * 2; i++) {
			const near = i >= n * 2, heavy = near ? i >= n * 2 + nn : i >= n;
			const g = new Sprite(near && tex.fx ? tex.fx.flake : tex.fx!.flake_far || tex.fx!.dot); g.anchor.set(0.5); g.tint = near ? 0xe8f0ff : 0xffffff; (near ? glassL : snowL).addChild(g);
			flakes.push({ g, x: a.x + Math.random() * (b.x - a.x), y: a.y + Math.random() * (b.y - a.y), vy: near ? 46 + Math.random() * 26 : 14 + Math.random() * 22, ph: Math.random() * 6.3,
				s: near ? (0.3 + Math.random() * 0.18) : (heavy ? 0.1 : 0.08) + Math.random() * 0.12, win: wi, heavy, near });
		}
	});
	snowL.mask = room ? null : snowMask; snowMask.visible = !room;
	// twinkle lights: a warm additive dot over each painted bulb, each on its own slow phase, on the plane it hangs on
	for (const l of [twL, twC, twT]) l.removeChildren().forEach((o) => o.destroy());
	tws = [];
	const lay = room ? ROOMS[fit.key].lights : '';
	(LIGHTS as Record<string, number[][]>)[fit.key === 'land' ? 'bg_land' : 'bg_port'].forEach(([u, v, r], i) => {
		const p = toS(u, v), g = new Sprite(tex.fx!.dot); g.anchor.set(0.5); g.blendMode = 'add'; g.tint = 0xffd27a;
		const sz = Math.max(10, r * P.iw * fit.c * 5.5); g.scale.set(sz / 64);
		const L = lay[i] || 'w';
		if (L === 'c') { twC.addChild(g); g.position.set(p.x, p.y); } else if (L === 't') { twT.addChild(g); g.position.set(p.x, p.y); }
		else { twL.addChild(g); if (room) wallItem(fit.key, g, p.x, p.y, v); else g.position.set(p.x, p.y); }
		tws.push({ g, ph: Math.random() * 6.3, sp: 0.6 + Math.random() * 1.1, base: 0.25 + Math.random() * 0.2 });
	});
	// fire: a warm glow pool that flickers + embers rising from the logs + the firelight spilling onto the room
	fireL.removeChildren().forEach((o) => o.destroy()); embers = []; motes = [];
	const [fu, fv, fr] = P.fire, fp = toS(fu, fv), R = fr * P.iw * fit.c;
	fireSpill = room ? new Sprite(tex.fx!.fire_spill || tex.fx!.blob) : null;
	if (fireSpill) { fireSpill.anchor.set(0.5); fireSpill.blendMode = 'add'; fireSpill.tint = 0xff7a26; fireSpill.position.set(fp.x + R * 0.6, fp.y - R * 0.2); fireSpill.scale.set((R * 11) / 128); fireL.addChild(fireSpill); }
	fireGlow = new Sprite(tex.fx!.fire_glow || tex.fx!.blob); fireGlow.anchor.set(0.5); fireGlow.blendMode = 'add'; fireGlow.tint = 0xff8a2a; fireGlow.position.set(fp.x, fp.y - R * 0.2);
	fireGlow.scale.set((R * 3.2) / 128); fireL.addChild(fireGlow);
	fireCore = new Sprite(tex.fx!.fire_core || tex.fx!.blob); fireCore.anchor.set(0.5); fireCore.blendMode = 'add'; fireCore.tint = 0xffd060; fireCore.position.set(fp.x, fp.y - R * 0.1);
	fireCore.scale.set((R * 1.5) / 128); fireL.addChild(fireCore);
}
function tick(dt: number) {
	const P = PAINT[fit.key], room = roomOn();
	if (room) { camTick(dt, now, fit.A); tickRoom(fit.key, fit, nightK * nightK * (3 - 2 * nightK)); }
	// snow (the near-glass flakes fall faster: closer to the eye)
	const wb = P.wins.map(([u0, v0, u1, v1]) => [toS(u0, v0), toS(u1, v1)] as const), k = fit.c * (fit.key === 'land' ? 1.8 : 1.5);
	for (const f of flakes) {
		const [a, b] = wb[f.win];
		f.y += f.vy * dt * k * (1 + nightK * 0.6); f.x += Math.sin(now * 0.8 + f.ph) * (f.near ? 16 : 10) * dt * k + nightK * (f.near ? 22 : 14) * dt * k;
		if (f.y > b.y + 12) { f.y = a.y - 12; f.x = a.x + Math.random() * (b.x - a.x); }
		if (f.x > b.x + 12) f.x = a.x - 12;
		f.g.position.set(f.x, f.y); f.g.scale.set(f.s * (f.near ? fit.c : k));
		f.g.alpha = f.near ? (f.heavy ? nightK * 0.5 : 0.42) : f.heavy ? nightK * 0.85 : 0.8;
	}
	// twinkle: each bulb breathes; now and then one sparkles brighter
	for (const t of tws) { const s = 0.5 + 0.5 * Math.sin(now * t.sp * 2.4 + t.ph); t.g.alpha = t.base + 0.55 * s * s * s; }
	// fire flicker: incommensurate sines + a little noise, eased (no strobe); every 6-12 s a log flares (a brighter pulse,
	// a puff of embers) and the frame catches it
	if (fireGlow && fireCore) {
		const calm = reduced();
		flareAt -= dt; if (flareAt <= 0) { flareAt = 6 + Math.random() * 6; if (!calm) { flare = 1; frameGlint(); emberAt = 0; } }
		flare = Math.max(0, flare - dt / 0.9);
		fl = calm ? 0.5 : 0.5 + 0.22 * Math.sin(now * 7.3) + 0.14 * Math.sin(now * 11.7 + 1.3) + 0.1 * Math.sin(now * 3.1) + 0.35 * flare * flare;
		fireGlow.alpha = 0.32 + 0.16 * fl; fireCore.alpha = 0.35 + 0.25 * fl;
		if (fireSpill) fireSpill.alpha = 0.075 + 0.06 * fl;
		frameFire(Math.min(1, fl));
		const [fu, fv, fr] = P.fire, fp = toS(fu, fv), R = fr * P.iw * fit.c;
		emberAt -= dt;
		if (emberAt <= 0 && embers.length < EMBERS) {
			emberAt = flare > 0.5 ? 0.05 : 0.18 + Math.random() * 0.3;
			const g = new Sprite(tex.fx!.bulb_glow || tex.fx!.dot);
			g.anchor.set(0.5); g.blendMode = 'add'; g.tint = 0xffb347; fireL.addChild(g);
			embers.push({ g, t: 0, life: 1 + Math.random() * 0.8, x: fp.x + (Math.random() - 0.5) * R * 0.9, y: fp.y, vx: (Math.random() - 0.5) * 18, vy: -(40 + Math.random() * 40) });
		}
		embers = embers.filter((e) => {
			e.t += dt; if (e.t >= e.life) { e.g.destroy(); return false; }
			const u = e.t / e.life; e.x += (e.vx + Math.sin(now * 5 + e.life * 9) * 14) * dt * fit.c; e.y += e.vy * dt * fit.c;
			e.g.position.set(e.x, e.y); e.g.scale.set(0.12 * fit.c * 1.6 * (1 - u * 0.6)); e.g.alpha = Math.sin(u * Math.PI) * 0.9; return true;
		});
		// dust motes drifting up in the fire's warm air, lit by it (brighter nearer the fire)
		if (room && !calm && tex.fx) {
			moteAt -= dt;
			if (moteAt <= 0 && motes.length < MOTES) {
				moteAt = 0.35 + Math.random() * 0.5;
				const g = new Sprite(tex.fx.ember || tex.fx.mote); g.anchor.set(0.5); g.blendMode = 'add'; g.tint = 0xffc890; fireL.addChild(g);
				motes.push({ g, t: 0, life: 6 + Math.random() * 5, x: fp.x + (Math.random() * 3.2 - 0.6) * R, y: fp.y + (Math.random() * 1.6 - 1.3) * R, vx: (Math.random() - 0.3) * 7, vy: -(4 + Math.random() * 7), s: 0.18 + Math.random() * 0.16 });
			}
			motes = motes.filter((m) => {
				m.t += dt; if (m.t >= m.life) { m.g.destroy(); return false; }
				const u = m.t / m.life; m.x += (m.vx + Math.sin(now * 0.7 + m.life) * 5) * dt * fit.c; m.y += m.vy * dt * fit.c;
				const near = Math.max(0, 1 - Math.hypot(m.x - fp.x, m.y - fp.y) / (R * 4.5));
				m.g.position.set(m.x, m.y); m.g.scale.set(m.s * fit.c); m.g.alpha = Math.sin(u * Math.PI) * (0.25 + 0.55 * near) * (0.75 + 0.35 * fl); return true;
			});
		} else if (motes.length) { motes.forEach((m) => m.g.destroy()); motes = []; }
	}
}

/** Start the room + Roxy. Resolves false when WebGL / assets are unavailable (the game then runs on the #bg painting). */
export async function initScene(): Promise<boolean> {
	const cv = (document.getElementById('scene') || document.querySelector('canvas#scene')) as HTMLCanvasElement | null;
	if (!cv) { console.warn('scene off: no #scene canvas'); return false; }
	try {
		const a = new Application();
		const { vw, vh } = viewSize();
		await a.init({ canvas: cv, width: vw, height: vh, resolution: capResolution(), autoDensity: false, backgroundAlpha: 0, antialias: true,
			preference: 'webgl', autoStart: true, sharedTicker: false, hello: false, powerPreference: 'high-performance' });
		watchCanvas(cv, 'scene');
		// #scene must live outside #root: that node is contain-scaled, and a viewport-covering
		// room canvas parented there would be scaled again (or clipped to the design rect).
		const root = document.getElementById('root');
		if (root && cv.parentElement !== root.parentElement) {
			root.parentElement ? root.parentElement.insertBefore(cv, root) : document.body.appendChild(cv);
		}
		const [r] = await Promise.all([createRoxy(), loadFx(), loadRoom(ST.portrait ? 'port' : 'land')]);
		rig = r; app = a;
		roxyL.addChild(r.view, roxyMask); clipRoxy(null);
		// Roxy's cast shadow: the key light is the fire (left), so a soft oval stretches right of her boots across the
		// log round's top, inside the rig's own shadow group (it follows her hop and hides with it in the portrait peek)
		const shG = r.view.children[1] as Container | undefined;
		if (tex.fx && shG) { const c = new Sprite(tex.fx.oval); c.anchor.set(0.08, 0.5); c.position.set(-34, -4); c.scale.set(300 / 160, 52 / 64); c.alpha = 0.32; c.tint = 0x1a0804; shG.addChild(c); }
		twC.zIndex = 1; twT.zIndex = 1;
		PL.chim.addChild(twC); PL.tree.addChild(twT); PL.out.sortableChildren = false;
		PL.chimFx.addChild(fireL);
		amb.addChild(PL.out, snowL, snowMask, PL.glass, PL.wall, twL, PL.chim, PL.tree, PL.grade, PL.chimFx, PL.shadow);
		PL.glass.addChild(glassL);
		// fix6 #25: explicit z from the layer map (layers.ts PZ), not addChild order
		a.stage.sortableChildren = true; amb.zIndex = PZ.room; world.zIndex = PZ.roxy; PL.near.zIndex = PZ.roomNear; fx.zIndex = PZ.roomFx;
		world.addChild(roxyL);
		a.stage.addChild(amb, world, PL.near, fx);
		listenCam();
		a.ticker.add((t) => {
			const dt = Math.min(0.05, t.deltaMS / 1000); now += dt;
			const tk = bonus ? 1 : 0;
			if (snap) { nightK = tk; snap = false; } else if (nightK !== tk) nightK += Math.sign(tk - nightK) * Math.min(Math.abs(tk - nightK), dt / 0.9);
			const e = nightK * nightK * (3 - 2 * nightK); r.setParty?.(e);
			tick(dt); if (roxyOn) r.update(dt);
		});
		document.body.classList.add('hasScene');
		(window as any).__scene = { app: a, rig: r, roxyAt, roxyL, planes: PL };
		return true;
	} catch (e) { console.warn('scene off (no WebGL?)', e); try { cv.style.display = 'none'; } catch {} return false; }
}
function clipRoxy(y: number | null) {
	if (y === null || y >= ST.h) { roxyL.mask = null; roxyMask.visible = false; return; }
	roxyMask.visible = true; roxyMask.clear().rect(-50, -400, ST.w + 100, y + 400).fill(0xffffff); roxyL.mask = roxyMask;
}
/** Fit the ambient layer to the #bg cover fit and place Roxy beside the board (stage design px). Called from layout(). */
export function placeScene(portrait: boolean, fr: DOMRect) {
	if (!app || !rig) return;
	last = [portrait, fr];
	const { vw, vh } = viewSize(), cv = app.canvas as HTMLCanvasElement;
	const dpr = capResolution();
	if (app.renderer.resolution !== dpr) app.renderer.resolution = dpr;
	app.renderer.resize(vw, vh);
	cv.style.cssText = `position:fixed;left:0;top:0;width:${vw}px;height:${vh}px;pointer-events:none;display:block`;
	// Design-space objects (Roxy) ride the same contain transform as #root.
	world.position.set(ST.ox, ST.oy);
	world.scale.set(ST.s);
	// Room art cover-fits the WINDOW so letterbox margins are the room, not empty bars.
	const key: Key = portrait ? 'port' : 'land', P = PAINT[key], c0 = Math.max(vw / P.iw, vh / P.ih);
	if (!tex.room[key]) void loadRoom(key).then((ok) => { if (ok && last && last[0] === portrait) placeScene(...last); });
	const m = tex.room[key] && tex.fx ? 16 * c0 : 0, c = Math.max((vw + 2 * m) / P.iw, (vh + 2 * m) / P.ih);
	fit = { c, ox: (vw - P.iw * c) / 2, oy: (vh - P.ih * c) / 2, key, A: c0 * (P.iw === 1920 ? 1 : 1920 / 1080) * 0.95 };
	const room = buildRoom(key, fit, vw, vh);
	document.body.classList.toggle('hasRoom', room);
	if (!room) for (const o of Object.values(PL)) o.position.set(0, 0);
	build();
	const R = rig, cutRow = R.rows.hips, hopTop = R.rows.hopTop;
	const g = MKG, u = fr.width / FW;
	const f = (794 / R.srcH) * 0.86;   // her figure height matched to the layout's character slot
	if (!portrait && g && g.mode !== 'port') {
		const k = g.k, X = (x: number) => g.ox + x * k, Y = (y: number) => g.oy + y * k;
		let x: number, feet: number, s: number;
		if (g.mode === 'cmp') { x = X(g.cmp.x); feet = Y(g.cmp.y); s = g.cmp.s * f * k; }
		else {
			// Right-stack landscape (square + desktop): Roxy stands in the right column, same approved 1280x800 placement.
			const Dw = g.D?.w ?? 1920, Dh = g.D?.h ?? 1080;
			x = X(Dw * 0.89); feet = Y(Dh - 150); s = 1.25 * f * k;
		}   // review #13 / v28i
		if (!hold) { R.view.position.set(x, feet); R.view.scale.set(s); }
		roxyL.visible = true; clipRoxy(null); R.shadow(true);
		Object.assign(roxyAt, { x, y: feet, s, portrait });
	} else if (portrait && g && g.mode === 'port') {
		// v28j: tablet portrait — hide Roxy (peek always overlapped logo/frame). Phones keep the peek.
		if (false) {   // v28m: tablet portrait uses the phone peek again
			roxyL.visible = false; clipRoxy(null); R.shadow(false);
			Object.assign(roxyAt, { x: 0, y: 0, s: 0, portrait });
		} else {
			const k = g.k, T = (fr.top - g.oy) / k;
			const T0 = g.T0 ?? T, bs0 = g.bs0 ?? g.bs;
			const rs0 = g.loose ? 2.4 * f : Math.min(2.4 * f, Math.max(0.6 * f, (T0 - 46) / (cutRow - hopTop)));
			const rx0 = Math.max(770 + Math.max(0, rs0 / f - 1.85) * 70, 1080 + 8 - (R.srcW / 2) * rs0) - 47;
			const F = g.bs / bs0, rs = rs0 * F * (ST.tablet ? 1.4 : 1);   // v28m: bigger tabP peek
			const R0 = 540 + FW * bs0 / 2;
			const R1 = g.bx + BW * g.bs + FT * g.bs;
			const rx = ST.tablet ? g.bx + BW * g.bs * 0.62 : R1 + (rx0 - R0) * F,   /* v28m: tabP peek centred behind the logo */
			hip = Math.max(T + WAIST * rs, 14 + (cutRow - R.rows.headTop) * rs), feet = hip + (R.srcH - cutRow) * rs;
			if (!hold) { R.view.position.set(g.ox + rx * k, g.oy + feet * k); R.view.scale.set(rs * k); }
			clipRoxy(hold && free ? null : fr.top + (ST.tablet ? FT * 2 : FT + BH) * u); roxyL.visible = true; R.shadow(false);
			Object.assign(roxyAt, { x: g.ox + rx * k, y: g.oy + feet * k, s: rs * k, portrait });
		}
	} else if (!portrait) {
		const k = fr.height / 726, gut = W - fr.right - ST.railR, feet = Math.min(H - 6, fr.bottom + 34 * k);
		const s = Math.min(1.3 * k * f, (gut - 24) / (R.srcW * 0.86), (feet - 4) / (R.srcH - hopTop));
		const x = Math.min(fr.right + 272 * k, fr.right + gut / 2 + 12);
		if (!hold) { R.view.position.set(x, feet); R.view.scale.set(s); }
		roxyL.visible = hold || s * R.srcH >= H * 0.42; clipRoxy(null); R.shadow(true);
		Object.assign(roxyAt, { x, y: feet, s, portrait });
	} else {
		const kp = W / 1080, T = fr.top / kp;
		const rs = Math.min(2.4 * f, Math.max(0.6 * f, (T - 46) / (cutRow - hopTop)));
		const feet = T + (R.srcH - cutRow) * rs, rx = Math.max(770, 1080 + 8 - (R.srcW / 2) * rs);
		if (!hold) { R.view.position.set(rx * kp, feet * kp); R.view.scale.set(rs * kp); }
		clipRoxy(hold && free ? null : fr.top + 14); roxyL.visible = true; R.shadow(false);
		Object.assign(roxyAt, { x: rx * kp, y: feet * kp, s: rs * kp, portrait });
	}
	// cast shadows (stage px) + the frame's share of the light (DOM)
	// Shadows live on the room (screen space). Use viewport rects, not stage design px.
	const buy = document.getElementById('buyBtn');
	const buyR = buy ? buy.getBoundingClientRect() : null;
	const hudEl = document.getElementById('hud');
	const hudR = hudEl ? hudEl.getBoundingClientRect() : (g ? {
		x: ST.ox + (g.ox + g.hud.x * g.k) * ST.s,
		y: ST.oy + (g.oy + g.hud.y * g.k) * ST.s,
		w: g.hud.w * g.k * ST.s,
		h: g.hud.h * g.k * ST.s,
	} : null);
	const hud = hudR && 'width' in hudR ? { x: hudR.x, y: hudR.y, w: hudR.width, h: hudR.height } : hudR;
	const frScreen = document.getElementById('frame')?.getBoundingClientRect() ?? null;
	placeShadows(frScreen, hud, buyR && buyR.width > 4 ? buyR : null, u * ST.s);
	placeDepth(fr);
	void BW; void dAt;
}
/** Bonus: night grade + heavier snow (the #bg grade is CSS, body.inBonus). instant = no fade (reload into a bonus). */
export function sceneBonus(on: boolean, instant = false) { if (instant && on !== bonus) snap = true; bonus = on; }
/** Intro: hold Roxy (the intro positions her; no portrait clip) / hand her back to the layout. */
export function sceneHold(on: boolean, noClip = on) {
	if (hold === on && free === noClip) return; hold = on; free = noClip;
	if (last) placeScene(...last);
	else if (on) { clipRoxy(null); roxyL.visible = true; }
}
