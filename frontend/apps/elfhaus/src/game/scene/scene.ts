// The room layer: ONE Pixi app on canvas#scene inside #root, behind #app. The painted chalet room itself is the DOM #bg
// (bg_land / bg_port, cover-fit); this layer adds its calm ambient life on top, registered to the same cover fit:
// snow falling past the windows, the fire's flicker glow + rising embers, and the twinkle lights (positions measured from
// the painting, chalet/bglights.json). Plus Roxy (the swappable rig adapter, ../roxyrig) beside the board.
// Free spins: the room drops to a night grade (CSS on #bg) and the snow thickens. Everything runs on real elapsed time.
// No WebGL -> the app never starts and the game runs on the #bg painting with no Roxy (nothing else depends on this layer).
import { Application, Container, Graphics, Sprite } from 'pixi.js';
import { ST } from '../stage';
import { G as MKG, FW, FT, BW, BH } from '../mkboard';
import { glowDot, softBlob } from './util';
import { createRoxy, type RoxyAdapter } from '../roxyrig';
import LIGHTS from '../chalet/bglights.json';

export let app: Application | null = null;
export let rig: RoxyAdapter | null = null;
const amb = new Container(), snowL = new Container(), snowMask = new Graphics(), fireL = new Container(), twL = new Container(), roxyL = new Container(), fx = new Container();
const roxyMask = new Graphics();
let now = 0, bonus = false, nightK = 0, snap = false, roxyOn = true, hold = false, free = false, last: [boolean, DOMRect] | null = null;
const WAIST = 60;
export const roxyAt = { x: 0, y: 0, s: 1, portrait: false };

// painting geometry (normalized to the image): windows (snow), fire (glow + embers)
const PAINT = {
	land: { iw: 1920, ih: 1080, wins: [[0.248, 0.215, 0.345, 0.575], [0.727, 0.19, 0.862, 0.575]], fire: [0.108, 0.66, 0.075] },
	port: { iw: 1080, ih: 1920, wins: [[0.33, 0.125, 0.89, 0.645]], fire: [0.06, 0.69, 0.11] },
} as const;
let fit = { c: 1, ox: 0, oy: 0, key: 'land' as 'land' | 'port' };
const toS = (u: number, v: number) => ({ x: fit.ox + u * PAINT[fit.key].iw * fit.c, y: fit.oy + v * PAINT[fit.key].ih * fit.c });

type Flake = { g: Sprite; x: number; y: number; vy: number; ph: number; s: number; win: number; heavy: boolean };
let flakes: Flake[] = [];
type Tw = { g: Sprite; ph: number; sp: number; base: number };
let tws: Tw[] = [];
type Ember = { g: Sprite; t: number; life: number; x: number; y: number; vx: number; vy: number };
let embers: Ember[] = [], fireGlow: Sprite | null = null, fireCore: Sprite | null = null, emberAt = 0;

function build() {
	const P = PAINT[fit.key];
	// snow: drawn only inside the window panes (mask), base count + an extra "heavy" set that fades in for free spins
	snowL.removeChildren().forEach((o) => o.destroy()); flakes = [];
	snowMask.clear();
	P.wins.forEach(([u0, v0, u1, v1], wi) => {
		const a = toS(u0, v0), b = toS(u1, v1); snowMask.rect(a.x, a.y, b.x - a.x, b.y - a.y).fill(0xffffff);
		const area = (b.x - a.x) * (b.y - a.y), n = Math.round(Math.min(70, area / 2600));
		for (let i = 0; i < n * 2; i++) {
			const g = new Sprite(glowDot()); g.anchor.set(0.5); g.tint = 0xffffff; snowL.addChild(g);
			const heavy = i >= n;
			flakes.push({ g, x: a.x + Math.random() * (b.x - a.x), y: a.y + Math.random() * (b.y - a.y), vy: 14 + Math.random() * 22, ph: Math.random() * 6.3,
				s: (heavy ? 0.1 : 0.08) + Math.random() * 0.12, win: wi, heavy });
		}
	});
	snowL.mask = snowMask;
	// twinkle lights: a warm additive dot over each painted bulb, each on its own slow phase
	twL.removeChildren().forEach((o) => o.destroy()); tws = [];
	for (const [u, v, r] of (LIGHTS as Record<string, number[][]>)[fit.key === 'land' ? 'bg_land' : 'bg_port']) {
		const p = toS(u, v), g = new Sprite(glowDot()); g.anchor.set(0.5); g.blendMode = 'add'; g.tint = 0xffd27a; g.position.set(p.x, p.y);
		const sz = Math.max(10, r * P.iw * fit.c * 5.5); g.scale.set(sz / 64); twL.addChild(g);
		tws.push({ g, ph: Math.random() * 6.3, sp: 0.6 + Math.random() * 1.1, base: 0.25 + Math.random() * 0.2 });
	}
	// fire: a warm glow pool that flickers + embers rising from the logs
	fireL.removeChildren().forEach((o) => o.destroy()); embers = [];
	const [fu, fv, fr] = P.fire, fp = toS(fu, fv), R = fr * P.iw * fit.c;
	fireGlow = new Sprite(softBlob()); fireGlow.anchor.set(0.5); fireGlow.blendMode = 'add'; fireGlow.tint = 0xff8a2a; fireGlow.position.set(fp.x, fp.y - R * 0.2);
	fireGlow.scale.set((R * 3.2) / 256); fireL.addChild(fireGlow);
	fireCore = new Sprite(softBlob()); fireCore.anchor.set(0.5); fireCore.blendMode = 'add'; fireCore.tint = 0xffd060; fireCore.position.set(fp.x, fp.y - R * 0.1);
	fireCore.scale.set((R * 1.5) / 256); fireL.addChild(fireCore);
}
function tick(dt: number) {
	const P = PAINT[fit.key];
	// snow
	const wb = P.wins.map(([u0, v0, u1, v1]) => [toS(u0, v0), toS(u1, v1)] as const), k = fit.c * (fit.key === 'land' ? 1.8 : 1.5);
	for (const f of flakes) {
		const [a, b] = wb[f.win];
		f.y += f.vy * dt * k * (1 + nightK * 0.6); f.x += Math.sin(now * 0.8 + f.ph) * 10 * dt * k + nightK * 14 * dt * k;
		if (f.y > b.y + 6) { f.y = a.y - 6; f.x = a.x + Math.random() * (b.x - a.x); }
		if (f.x > b.x + 6) f.x = a.x - 6;
		f.g.position.set(f.x, f.y); f.g.scale.set(f.s * k);
		f.g.alpha = f.heavy ? nightK * 0.85 : 0.8;
	}
	// twinkle: each bulb breathes; now and then one sparkles brighter
	for (const t of tws) { const s = 0.5 + 0.5 * Math.sin(now * t.sp * 2.4 + t.ph); t.g.alpha = t.base + 0.55 * s * s * s; }
	// fire flicker: two incommensurate sines + a little noise, eased (no strobe)
	if (fireGlow && fireCore) {
		const fl = 0.5 + 0.22 * Math.sin(now * 7.3) + 0.14 * Math.sin(now * 11.7 + 1.3) + 0.1 * Math.sin(now * 3.1);
		fireGlow.alpha = 0.32 + 0.16 * fl; fireCore.alpha = 0.35 + 0.25 * fl;
		emberAt -= dt;
		if (emberAt <= 0 && embers.length < 14) {
			emberAt = 0.18 + Math.random() * 0.3;
			const [fu, fv, fr] = P.fire, fp = toS(fu, fv), R = fr * P.iw * fit.c, g = new Sprite(glowDot());
			g.anchor.set(0.5); g.blendMode = 'add'; g.tint = 0xffb347; fireL.addChild(g);
			embers.push({ g, t: 0, life: 1 + Math.random() * 0.8, x: fp.x + (Math.random() - 0.5) * R * 0.9, y: fp.y, vx: (Math.random() - 0.5) * 18, vy: -(40 + Math.random() * 40) });
		}
		embers = embers.filter((e) => {
			e.t += dt; if (e.t >= e.life) { e.g.destroy(); return false; }
			const u = e.t / e.life; e.x += (e.vx + Math.sin(now * 5 + e.life * 9) * 14) * dt * fit.c; e.y += e.vy * dt * fit.c;
			e.g.position.set(e.x, e.y); e.g.scale.set(0.12 * fit.c * 1.6 * (1 - u * 0.6)); e.g.alpha = Math.sin(u * Math.PI) * 0.9; return true;
		});
	}
}

/** Start the room + Roxy. Resolves false when WebGL / assets are unavailable (the game then runs on the #bg painting). */
export async function initScene(): Promise<boolean> {
	const cv = document.getElementById('scene') as HTMLCanvasElement | null; if (!cv) return false;
	try {
		const a = new Application();
		await a.init({ canvas: cv, width: ST.w, height: ST.h, resolution: res(), autoDensity: false, backgroundAlpha: 0, antialias: true,
			preference: 'webgl', autoStart: true, sharedTicker: false, hello: false, powerPreference: 'high-performance' });
		const r = await createRoxy();
		rig = r; app = a;
		roxyL.addChild(r.view, roxyMask); clipRoxy(null);
		amb.addChild(snowL, snowMask, fireL, twL);
		a.stage.addChild(amb, roxyL, fx);
		a.ticker.add((t) => {
			const dt = Math.min(0.05, t.deltaMS / 1000); now += dt;
			const tk = bonus ? 1 : 0;
			if (snap) { nightK = tk; snap = false; } else if (nightK !== tk) nightK += Math.sign(tk - nightK) * Math.min(Math.abs(tk - nightK), dt / 0.9);
			const e = nightK * nightK * (3 - 2 * nightK); r.setParty?.(e);
			tick(dt); if (roxyOn) r.update(dt);
		});
		document.body.classList.add('hasScene');
		(window as any).__scene = { app: a, rig: r, roxyAt, roxyL };
		return true;
	} catch (e) { console.warn('scene off (no WebGL?)', e); cv.style.display = 'none'; return false; }
}
function clipRoxy(y: number | null) {
	if (y === null || y >= ST.h) { roxyL.mask = null; roxyMask.visible = false; return; }
	roxyMask.visible = true; roxyMask.clear().rect(-50, -400, ST.w + 100, y + 400).fill(0xffffff); roxyL.mask = roxyMask;
}
const res = () => Math.min(2, Math.max(0.5, ST.s * (window.devicePixelRatio || 1)));
/** Fit the ambient layer to the #bg cover fit and place Roxy beside the board (stage design px). Called from layout(). */
export function placeScene(portrait: boolean, fr: DOMRect) {
	if (!app || !rig) return;
	last = [portrait, fr];
	const W = ST.w, H = ST.h, cv = app.canvas as HTMLCanvasElement;
	app.renderer.resize(W, H, res()); cv.style.width = W + 'px'; cv.style.height = H + 'px';
	// #bg: background-size cover, centred, over the whole stage
	const key = portrait ? 'port' : 'land', P = PAINT[key], c = Math.max(W / P.iw, H / P.ih);
	fit = { c, ox: (W - P.iw * c) / 2, oy: (H - P.ih * c) / 2, key };
	build();
	const R = rig, cutRow = R.rows.hips, hopTop = R.rows.hopTop;
	const g = MKG, u = fr.width / FW;
	const f = (794 / R.srcH) * 0.86;   // her figure height matched to the layout's character slot
	if (!portrait && g && g.mode !== 'port') {
		const k = g.k, X = (x: number) => g.ox + x * k, Y = (y: number) => g.oy + y * k;
		let x: number, feet: number, s: number;
		if (g.mode === 'cmp') { x = X(g.cmp.x); feet = Y(g.cmp.y); s = g.cmp.s * f * k; }
		else { x = X(1530); feet = Y(852); s = 1.26 * f * k; }   // boots on her log round (rig ground), raised so its bark side shows above the HUD bar; head still clear of the top
		if (!hold) { R.view.position.set(x, feet); R.view.scale.set(s); }
		roxyL.visible = true; clipRoxy(null); R.shadow(true);
		Object.assign(roxyAt, { x, y: feet, s, portrait });
	} else if (portrait && g && g.mode === 'port') {
		// she peeks over the board: chest up above the frame top, clipped at the reel window's foot
		const k = g.k, T = (fr.top - g.oy) / k;
		const T0 = g.T0 ?? T, bs0 = g.bs0 ?? g.bs;
		const rs0 = g.loose ? 2.4 * f : Math.min(2.4 * f, Math.max(0.6 * f, (T0 - 46) / (cutRow - hopTop)));
		const rx0 = Math.max(770 + Math.max(0, rs0 / f - 1.85) * 70, 1080 + 8 - (R.srcW / 2) * rs0) - 47;
		const F = g.bs / bs0, rs = rs0 * F, R0 = 540 + FW * bs0 / 2, R1 = 540 + FW * g.bs / 2;
		const rx = R1 + (rx0 - R0) * F, hip = Math.max(T + WAIST * rs, 14 + (cutRow - R.rows.headTop) * rs), feet = hip + (R.srcH - cutRow) * rs;
		if (!hold) { R.view.position.set(g.ox + rx * k, g.oy + feet * k); R.view.scale.set(rs * k); }
		clipRoxy(hold && free ? null : fr.top + (FT + BH) * u); roxyL.visible = true; R.shadow(false);
		Object.assign(roxyAt, { x: g.ox + rx * k, y: g.oy + feet * k, s: rs * k, portrait });
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
	void BW;
}
/** Bonus: night grade + heavier snow (the #bg grade is CSS, body.inBonus). instant = no fade (reload into a bonus). */
export function sceneBonus(on: boolean, instant = false) { if (instant && on !== bonus) snap = true; bonus = on; }
/** Intro: hold Roxy (the intro positions her; no portrait clip) / hand her back to the layout. */
export function sceneHold(on: boolean, noClip = on) {
	if (hold === on && free === noClip) return; hold = on; free = noClip;
	if (last) placeScene(...last);
	else if (on) { clipRoxy(null); roxyL.visible = true; }
}
