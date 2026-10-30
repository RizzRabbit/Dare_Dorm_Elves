// The room layer (approved PixiJS mockup, ported): ONE Pixi app on canvas#scene inside #root, behind #app.
// Draws the grand foyer (painted split stair + sconces from assets/foyer, wall / floor / arch / gallery in code), slow motes,
// and Roxy (the swappable rig adapter, ../roxyrig). The DOM board / HUD stay on top; the room is fitted to the DOM frame rect.
// Bonus: the room fades out so the free-spins painting on #bg shows (Roxy stays). No WebGL -> the app never starts and the
// game falls back to the #bg painting with no Roxy (nothing else depends on this layer).
import { Application, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { ST } from '../stage';
import { G as MKG, FW, FT, BW, BH } from '../mkboard';
import { loadSheet } from './load';
import { glowDot, softBlob } from './util';
import { foyerRoot, initFoyer, buildFoyerLand, buildFoyerPort, updFoyer, bakeFoyer } from './foyer';
import { createRoxy, type RoxyAdapter } from '../roxyrig';

export let app: Application | null = null;
export let rig: RoxyAdapter | null = null;
const room = new Container(), moteL = new Container(), roxyL = new Container(), fx = new Container();
const roxyMask = new Graphics();
let calm: Sprite | null = null;
let now = 0, bonus = false, roomA = 1, roxyOn = true, hold = false, free = false, last: [boolean, DOMRect] | null = null;
/** where Roxy stands (stage design px) + scale; read by the intro */
export const roxyAt = { x: 0, y: 0, s: 1, portrait: false };
export const sceneNow = () => now;
type Mote = { sp: Sprite; x: number; y: number; vx: number; vy: number; s: number; ph: number; a: number };
let motes: Mote[] = [], mW = 0, mH = 0;
function setMotes(W: number, H: number, n: number) {
	moteL.removeChildren().forEach((o) => o.destroy()); motes = [];
	for (let i = 0; i < n; i++) { const far = i % 3 !== 0, sp = new Sprite(glowDot()); sp.anchor.set(0.5); sp.blendMode = 'add';
		sp.tint = [0xffe2a8, 0xe9dcf5, 0xffd27a][i % 3]; moteL.addChild(sp);
		motes.push({ sp, x: ((i * 0.618) % 1) * W, y: ((i * 0.377 + 0.13) % 1) * H, vx: (far ? 4 : 7) * (((i * 0.53) % 1) - 0.5), vy: -(far ? 3 : 6) - (i % 4),
			s: (far ? 0.09 : 0.15) + ((i * 0.29) % 1) * (far ? 0.05 : 0.08), ph: i * 1.7, a: far ? 0.35 : 0.22 }); }
}
function updMotes(dt: number) {
	const k = Math.max(0.5, Math.min(1.6, Math.min(mW, mH) / 700)) * (ST.portrait ? 0.45 : 1);
	for (const m of motes) { m.x += m.vx * dt * k; m.y += m.vy * dt * k + Math.sin(now * 0.4 + m.ph) * 3 * dt * k;
		if (m.y < -20) m.y = mH + 20; if (m.x < -20) m.x = mW + 20; if (m.x > mW + 20) m.x = -20;
		const t = 0.5 + 0.5 * Math.sin(now * 0.9 + m.ph); m.sp.position.set(m.x, m.y); m.sp.scale.set(m.s * k * 2); m.sp.alpha = m.a * (0.35 + 0.65 * t * t); }
}
/** Start the room + Roxy. Resolves false when WebGL / assets are unavailable (the game then runs on the #bg painting). */
export async function initScene(): Promise<boolean> {
	const cv = document.getElementById('scene') as HTMLCanvasElement | null; if (!cv) return false;
	try {
		const a = new Application();
		await a.init({ canvas: cv, width: ST.w, height: ST.h, resolution: res(), autoDensity: false, backgroundAlpha: 0, antialias: true,
			preference: 'webgl', autoStart: true, sharedTicker: false, hello: false, powerPreference: 'high-performance' });
		const [{ sheet }, r] = await Promise.all([loadSheet('assets/foyer/', 'foyer'), createRoxy()]);
		initFoyer(sheet.textures as Record<string, Texture>);
		rig = r; app = a;
		roxyL.addChild(r.view, roxyMask); clipRoxy(null);
		calm = new Sprite(softBlob()); calm.anchor.set(0.5); calm.tint = 0x10051a; calm.alpha = 0.5;
		a.stage.addChild(room, calm, moteL, roxyL, fx); room.addChild(foyerRoot);
		a.ticker.add((t) => { const dt = Math.min(0.05, t.deltaMS / 1000); now += dt;
			roomA += ((bonus ? 0 : 1) - roomA) * Math.min(1, dt * 5); room.alpha = roomA; if (calm) calm.alpha = 0.5 * roomA; moteL.alpha = 0.6 + 0.4 * roomA;
			updFoyer(now); updMotes(dt); if (roxyOn) r.update(dt); });
		document.body.classList.add('hasScene');
		(window as any).__scene = { app: a, rig: r, roxyAt, roxyL, room };
		return true;
	} catch (e) { console.warn('scene off (no WebGL?)', e); cv.style.display = 'none'; return false; }
}
/** Clip Roxy at stage y (portrait: the frame top; the reel plate is see-through). null = no clip: the stencil mask is dropped
 *  entirely (PERF: a full-screen stencil rect every frame cost ~25% of the frame on low-end GPUs and clipped nothing). */
function clipRoxy(y: number | null) {
	if (y === null || y >= ST.h) { roxyL.mask = null; roxyMask.visible = false; return; }
	roxyMask.visible = true; roxyMask.clear().rect(-50, -400, ST.w + 100, y + 400).fill(0xffffff); roxyL.mask = roxyMask;
}
const res = () => Math.min(2, Math.max(0.5, ST.s * (window.devicePixelRatio || 1)));
/** Fit the room + Roxy to the DOM board frame (stage design px). Called from layout(). */
export function placeScene(portrait: boolean, fr: DOMRect) {
	if (!app || !rig) return;
	last = [portrait, fr];
	const W = ST.w, H = ST.h, cv = app.canvas as HTMLCanvasElement;
	app.renderer.resize(W, H, res()); cv.style.width = W + 'px'; cv.style.height = H + 'px';
	const R = rig, cutRow = R.rows.hips, hopTop = R.rows.hopTop;
	let keys: Container[], cool: Container;
	const g = MKG, u = fr.width / FW;   // approved board (mkboard.ts): the mockup's own world fit
	// mockup Roxy scales are for its 336 x 794 source box; the v7 rig's box is taller, and her figure fills it a little more:
	// 0.91 matches her head-to-feet height to the mockup's at the same placement (measured on the 1920x1080 / 844x390 shots)
	const f = 794 / R.srcH * 0.91;
	if (!portrait && g && g.mode !== 'port') {
		const k = g.k, X = (x: number) => g.ox + x * k, Y = (y: number) => g.oy + y * k;
		let x: number, feet: number, s: number;
		if (g.mode === 'cmp') {
			// mockup compact: the room at c = 0.64 / 1.3, slid so its centre line (arch + split stair) sits behind the board
			const c = g.cmp.s / 1.3, bcx = fr.left + fr.width / 2;
			room.scale.set(k * c); room.position.set(bcx - 830 * c * k, Y(g.cmp.y - 896 * c));
			({ keys, cool } = buildFoyerLand(-200));
			x = X(g.cmp.x); feet = Y(g.cmp.y); s = g.cmp.s * f * k;
		} else {
			const kf = fr.height / 726; room.scale.set(kf); room.position.set(fr.left + fr.width / 2 - 830 * kf, fr.top - 136 * kf);
			({ keys, cool } = buildFoyerLand());
			x = X(1536); feet = Y(896); s = 1.3 * f * k;
		}
		if (!hold) { R.view.position.set(x, feet); R.view.scale.set(s); }
		roxyL.visible = true; clipRoxy(null);
		R.shadow(true); R.setGrade({ cut: -1, res: ST.s * (window.devicePixelRatio || 1) });
		Object.assign(roxyAt, { x, y: feet, s, portrait });
	} else if (portrait && g && g.mode === 'port') {
		// mockup portrait: she peeks over the board, hips at the frame's top edge, behind the board
		const k = g.k, T = (fr.top - g.oy) / k, DH = g.D.h;
		room.scale.set(k); room.position.set(g.ox, g.oy);
		({ keys, cool } = buildFoyerPort(T, DH));
		const rs = g.loose ? 2.4 * f : Math.min(2.4 * f, Math.max(0.6 * f, (T - 46) / (cutRow - hopTop)));
		const feet = T + (R.srcH - cutRow) * rs, rx = Math.max(770 + Math.max(0, rs / f - 1.85) * 70, 1080 + 8 - (R.srcW / 2) * rs) - 47;   // -47: the v7 figure sits right of the mockup's in its box
		if (!hold) { R.view.position.set(g.ox + rx * k, g.oy + feet * k); R.view.scale.set(rs * k); }
		clipRoxy(hold && free ? null : fr.top + 14); roxyL.visible = true;
		R.shadow(false); R.setGrade({ cut: cutRow / R.srcH, res: ST.s * (window.devicePixelRatio || 1) });
		Object.assign(roxyAt, { x: g.ox + rx * k, y: g.oy + feet * k, s: rs * k, portrait });
	} else if (!portrait) {
		// mockup landscape: frame spans y 136..862 (726 tall), centre x 830; Roxy right of the board at (1536, 896) s 1.3
		const k = fr.height / 726; room.scale.set(k); room.position.set(fr.left + fr.width / 2 - 830 * k, fr.top - 136 * k);
		({ keys, cool } = buildFoyerLand());
		const gut = W - fr.right - ST.railR, feet = Math.min(H - 6, fr.bottom + 34 * k);
		let s = Math.min(1.3 * k, (gut - 24) / (R.srcW * 0.86), (feet - 4) / (R.srcH - hopTop));
		const x = Math.min(fr.right + 272 * k, fr.right + gut / 2 + 12);
		if (!hold) { R.view.position.set(x, feet); R.view.scale.set(s); }
		roxyL.visible = hold || s * R.srcH >= H * 0.42; clipRoxy(null);
		R.shadow(true); R.setGrade({ cut: -1, res: ST.s * (window.devicePixelRatio || 1) });
		Object.assign(roxyAt, { x, y: feet, s, portrait });
	} else {
		// mockup portrait (1080-wide design): she peeks over the board, hips at the frame's top edge, behind the board
		const kp = W / 1080, T = fr.top / kp, DH = H / kp;
		room.scale.set(kp); room.position.set(0, 0);
		({ keys, cool } = buildFoyerPort(T, DH));
		const rs = Math.min(2.4, Math.max(0.6, (T - 46) / (cutRow - hopTop)));
		const feet = T + (R.srcH - cutRow) * rs, rx = Math.max(770 + Math.max(0, rs - 1.85) * 70, 1080 + 8 - (R.srcW / 2) * rs);
		if (!hold) { R.view.position.set(rx * kp, feet * kp); R.view.scale.set(rs * kp); }
		// the reel plate is see-through in this game: clip her at the frame top (the frame's bezel hides the edge)
		// (the intro holds her: no clip while she stands in the doorway / drops in)
		clipRoxy(hold && free ? null : fr.top + 14); roxyL.visible = true;
		R.shadow(false); R.setGrade({ cut: cutRow / R.srcH, res: ST.s * (window.devicePixelRatio || 1) });
		Object.assign(roxyAt, { x: rx * kp, y: feet * kp, s: rs * kp, portrait });
	}
	if (calm && g) { calm.position.set(fr.left + fr.width / 2, fr.top + (FT + BH / 2) * u); calm.scale.set(BW * u / 150, (g.mode === 'cmp' ? BW : BH * 150 / 165) * u / 150); calm.visible = !portrait; }
	else if (calm) { calm.position.set(fr.left + fr.width / 2, fr.top + fr.height / 2); calm.scale.set(fr.width / 150, fr.height / 165); calm.visible = !portrait; }
	const gp = (c: Container) => { const p = c.getGlobalPosition(); return { x: p.x, y: p.y }; };
	R.setGrade({ keys: keys.map(gp), cool: gp(cool) });
	bakeFoyer(app.renderer, room, W, H, app.renderer.resolution);   // static room -> 2 textures (PERF)
	if (mW !== W || mH !== H) { mW = W; mH = H; setMotes(W, H, portrait ? 12 : g && g.mode === 'cmp' ? 7 : 18); }
}
/** Bonus: fade the room out (the free-spins painting on #bg shows through); Roxy stays. */
export function sceneBonus(on: boolean) { bonus = on; }
/** Top-level overlay container for transient fx drawn over the room (unused by the base game). */
export const sceneFx = fx;
export const showRoxy = (on: boolean) => { roxyOn = on; roxyL.visible = on; };
/** Intro: hold Roxy (the intro positions her; no portrait clip) / hand her back to the layout. */
export function sceneHold(on: boolean, noClip = on) {
	if (hold === on && free === noClip) return; hold = on; free = noClip;
	if (last) placeScene(...last);
	else if (on) { clipRoxy(null); roxyL.visible = true; }
}
