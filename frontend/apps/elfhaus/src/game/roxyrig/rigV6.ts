// Roxy v6 cutout rig (PLACEHOLDER until v7). Port of /workspace/elfhaus-mockup/main.js (rig section), wrapped in the
// RoxyAdapter contract (types.ts). The approved v6 still cut into 9 painted layers + painted face variants + the intro
// door-reach arm, in ONE 2x WebP atlas (static/assets/rig/roxy_rig.webp + .json). Rigid layers turn about painted joints
// (no mesh warps -> no morphing); face changes are hard swaps of painted patches. Idle = layered slow sines (contrapposto,
// breath, head lead), hop = additive curves (anticipation crouch, ballistic arc, landing squash), springs for follow-through
// and the ponytail. Cast shadow = the same rig tinted near-black, flattened + skewed onto the floor, one blur + one alpha.
import { AlphaFilter, BlurFilter, Container, Filter, GlProgram, Matrix, Point, Sprite, UniformGroup, type Texture } from 'pixi.js';
import type { RoxyAdapter, RoxyFace, RoxyGrade, Pt } from './types';
import { loadSheet } from '../scene/load';
import { ctex, SS } from '../scene/util';

const DIR = 'assets/rig/';
const FACES: RoxyFace[] = ['half', 'closed', 'wink', 'surprised', 'lookL', 'lookR'];
const JORD = ['root', 'hips', 'chest', 'neck', 'tail', 'legL', 'legR', 'kneeL', 'kneeR', 'farArm'] as const;
type J = (typeof JORD)[number];
const LJ: Record<string, J> = { shinR: 'kneeR', shinL: 'kneeL', legR: 'legR', legL: 'legL', pelvis: 'hips', farArm: 'farArm', farArmDoor: 'farArm', hairBack: 'neck', ponytail: 'tail', torso: 'chest', head: 'neck', nearArm: 'chest' };
const HOP = { D: 1.22, up: 0.19, down: 0.74, H: 50 };   // seconds; lift peak in source px
const BLINK: RoxyFace[] = ['half', 'half', 'closed', 'closed', 'closed', 'half', 'half'];   // 30 fps steps
const SH = { sy: -0.24, kx: -0.5 };
const D2R = Math.PI / 180;
const smooth = (a: number, b: number, t: number) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
const bump = (t: number, a: number, b: number) => (t <= a || t >= b ? 0 : Math.sin((Math.PI * (t - a)) / (b - a)));
const S2 = (t: number, p: number, ph = 0) => Math.sin((2 * Math.PI * t) / p + ph);

// ---- scene lighting grade (GLSL, WebGL): rolls flat highlights into the room's range, warm key from the nearest sconce,
// warm back-rim from the arch, faint cool floor bounce; saturated mid-tones (eyes, lips) are left alone. Same shader as the mockup.
const GRADE_VS = `in vec2 aPosition; out vec2 vTextureCoord; out vec2 vPos;
uniform vec4 uInputSize; uniform vec4 uOutputFrame; uniform vec4 uOutputTexture;
void main(void){ vec2 p = aPosition * uOutputFrame.zw + uOutputFrame.xy; vPos = p;
  p.x = p.x * (2.0 / uOutputTexture.x) - 1.0; p.y = p.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(p, 0.0, 1.0); vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw); }`;
const GRADE_FS = `in vec2 vTextureCoord; in highp vec2 vPos; out vec4 finalColor;
uniform sampler2D uTexture; uniform highp vec4 uInputSize;
uniform highp vec4 uBox; uniform vec4 uRig; uniform vec4 uNeon;
void main(void){
  vec4 c = texture(uTexture, vTextureCoord);
  if (c.a < 0.003 || uRig.w <= 0.0) { finalColor = c; return; }
  vec3 col = c.rgb / c.a; vec3 src = col;
  vec2 uv = (vPos - uBox.xy) / uBox.zw;
  float L = dot(col, vec3(0.299, 0.587, 0.114));
  float mx = max(col.r, max(col.g, col.b)), mn = min(col.r, min(col.g, col.b)), sat = (mx - mn) / max(mx, 1e-4);
  float hi = smoothstep(0.66, 0.92, L) * (1.0 - smoothstep(0.10, 0.26, sat));
  col = mix(col, vec3(0.96, 0.87, 0.85) * (0.78 + 0.20 * L), hi * 0.70);
  col = col * (1.0 - 0.09 * smoothstep(0.70, 1.0, col));
  col *= vec3(0.97, 0.94, 0.97);
  col = max(vec3(0.0), mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 1.07)) * mix(0.90, 1.0, smoothstep(0.08, 0.40, L));
  float wx = uRig.x < 0.0 ? 1.0 - uv.x : uv.x; float key = smoothstep(0.25, 1.0, wx) * mix(0.7, 1.0, 1.0 - uv.y), away = smoothstep(0.30, 1.0, 1.0 - wx);
  col *= 1.0 + vec3(0.06, 0.035, -0.04) * key;
  col *= mix(vec3(1.0), vec3(0.92, 0.90, 0.97), away);
  col += vec3(0.70, 0.68, 0.80) * 0.045 * smoothstep(0.62, 1.0, uv.y) * (0.3 + 0.7 * L);
  vec2 o = vec2(uRig.z * uInputSize.z, -0.35 * uRig.z * uInputSize.w);
  float core = smoothstep(0.55, 0.95, c.a);
  float eA = core * (1.0 - 0.5 * (texture(uTexture, vTextureCoord + vec2(o.x * uRig.y, o.y)).a + texture(uTexture, vTextureCoord + 2.0 * vec2(o.x * uRig.y, o.y)).a));
  float eK = core * (1.0 - 0.5 * (texture(uTexture, vTextureCoord + vec2(o.x * uRig.x, o.y)).a + texture(uTexture, vTextureCoord + 2.0 * vec2(o.x * uRig.x, o.y)).a));
  eA = eA * (1.0 - eK * 0.6); eK = eK * (1.0 - eA);
  col += vec3(1.0, 0.80, 0.46) * eA * 0.15 * (0.5 + 0.5 * L);
  col += vec3(1.0, 0.88, 0.66) * eK * 0.07;
  vec2 dn = (uv - uNeon.xy) * vec2(uBox.z / uBox.w, 1.0); float nb = exp(-dot(dn, dn) / (uNeon.z * uNeon.z));
  float cb = uNeon.w > 0.0 ? smoothstep(uNeon.w - 0.16, uNeon.w, uv.y) : 0.0;
  col += vec3(1.0, 0.70, 0.32) * (0.05 * nb + 0.06 * cb) * (0.4 + 0.6 * L);
  col = mix(src, clamp(col, 0.0, 0.97), uRig.w);
  finalColor = vec4(col * c.a, c.a); }`;

type Pose = { r: number; sx: number; sy: number; x: number; y: number };
type Rig = { c: Container; H: Record<string, Container & { j?: J }> };

export async function createRoxy(): Promise<RoxyAdapter> {
	const { sheet, json } = await loadSheet(DIR, 'roxy_rig');
	const RG = json.meta.rig, RTX = sheet.textures as Record<string, Texture>;
	const SRC_W: number = RG.frame[0], SRC_H: number = RG.frame[1];
	const FX = (p: number[]): [number, number] => [p[0] - SRC_W / 2, p[1] - SRC_H];
	const JT: Record<J, { p: J | null; at: [number, number] }> = {
		root: { p: null, at: FX(RG.joints.root) }, hips: { p: 'root', at: FX(RG.joints.hips) }, chest: { p: 'hips', at: FX(RG.joints.chest) },
		neck: { p: 'chest', at: FX(RG.joints.neck) }, tail: { p: 'neck', at: FX(RG.layers.ponytail.pivot) },
		legL: { p: 'root', at: FX(RG.layers.legL.pivot) }, legR: { p: 'root', at: FX(RG.layers.legR.pivot) },
		kneeL: { p: 'legL', at: FX(RG.layers.shinL.pivot) }, kneeR: { p: 'legR', at: FX(RG.layers.shinR.pivot) },
		farArm: { p: 'chest', at: FX(RG.layers.farArm.pivot) } };
	const LEGK: Record<string, number> = {};
	for (const sd of ['L', 'R']) { const hp = JT[('leg' + sd) as J].at, kn = JT[('knee' + sd) as J].at; LEGK[sd] = 1 + (kn[1] - hp[1]) / (0 - kn[1]); }
	const pose = {} as Record<J, Pose>; for (const j of JORD) pose[j] = { r: 0, sx: 1, sy: 1, x: 0, y: 0 };
	const legBend = (sd: 'L' | 'R', a: number) => { pose[('leg' + sd) as J].r += a; pose[('knee' + sd) as J].r -= a * LEGK[sd]; };
	const ORDER: string[] = []; for (const k of RG.draw as string[]) { ORDER.push(k); if (k === 'farArm') ORDER.push('farArmDoor'); if (k === 'head') ORDER.push(...FACES.map((f) => 'face_' + f)); }
	function buildRig(tint: number | null): Rig {
		const c = new Container(), H: Rig['H'] = {};
		for (const k of ORDER) { const L = RG.layers[k], h = new Container() as Container & { j?: J }, s = new Sprite(RTX[k]);
			s.position.set(L.x - SRC_W / 2, L.y - SRC_H); s.scale.set(1 / RG.res); if (tint != null) s.tint = tint;
			h.addChild(s); c.addChild(h); H[k] = h; h.j = LJ[k] || 'neck'; }
		H.farArmDoor.visible = false; for (const f of FACES) H['face_' + f].visible = false;
		return { c, H };
	}
	const view = new Container(); view.label = 'roxy';
	const rigB = buildRig(null), rigS = buildRig(0x12041a);
	const castSh = new Container(); castSh.addChild(rigS.c);
	const castC = new Container(); castC.addChild(castSh); const castA = new AlphaFilter({ alpha: 0.5 });
	castC.filters = [new BlurFilter({ strength: 1.6, quality: 2 }), castA]; view.addChild(castC);
	const contactTex = ctex(220, 40, (g) => { g.save(); g.scale(1, 40 / 220); const gr = g.createRadialGradient(110, 110, 4, 110, 110, 110);
		gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 220, 220); g.restore(); });
	const contactL = new Sprite(contactTex), contactR = new Sprite(contactTex);
	for (const s of [contactL, contactR]) s.anchor.set(0.5);
	contactL.position.set(-86, -6); contactL.scale.set(0.42 / SS, 0.7 / SS); contactR.position.set(40, -12); contactR.scale.set(0.4 / SS, 0.7 / SS);
	view.addChild(contactL, contactR);
	const body = new Container(); view.addChild(body); body.addChild(rigB.c);
	// grade
	const gradeU = new UniformGroup({ uBox: { value: new Float32Array([0, 0, 1, 1]), type: 'vec4<f32>' }, uRig: { value: new Float32Array([-1, 1, 3, 1]), type: 'vec4<f32>' },
		uNeon: { value: new Float32Array([-1, 0, 0.6, -1]), type: 'vec4<f32>' } });
	let gradeF: Filter | null = null;
	try { gradeF = new Filter({ glProgram: GlProgram.from({ vertex: GRADE_VS, fragment: GRADE_FS, name: 'roxy-grade' }), resources: { gradeU }, padding: 4, resolution: 'inherit' as any, antialias: 'inherit' as any }); }
	catch (e) { console.warn('roxy grade off', e); }
	const GR: Required<RoxyGrade> = { on: !/[?&]nograde=1/.test(location.search), k: 1, keys: [], cool: null, cut: -1, res: 1 };
	const applyGradeOn = () => { body.filters = GR.on && gradeF ? [gradeF] : []; };
	applyGradeOn();
	const RIG_BOX = { x0: 1e9, x1: -1e9, y0: 1e9 };
	for (const k of RG.draw as string[]) { const L = RG.layers[k], t = RTX[k]; RIG_BOX.x0 = Math.min(RIG_BOX.x0, L.x); RIG_BOX.x1 = Math.max(RIG_BOX.x1, L.x + t.width / RG.res); RIG_BOX.y0 = Math.min(RIG_BOX.y0, L.y); }
	const RX = { jumpT: -1, t: 0, lift: 0, tail: { a: 0, v: 0 }, popT: -1, lookT: -1, look: null as RoxyFace | null, nextLook: 3.1, settleT: -1, nextSettle: 4.6,
		sp: { head: { a: 0, v: 0 }, chest: { a: 0, v: 0 }, arm: { a: 0, v: 0 } }, np: null as number | null, nvl: 0, load: 0, tp: null as number[] | null, tvl: [0, 0],
		blinkT: -1, nextBlink: 2.4, seed: 7, base: 'open' as RoxyFace | 'open', door: false, doorR: 0, ant: 0, antOn: false, sighT: -1 };
	const rnd = () => (RX.seed = (RX.seed * 16807) % 2147483647) / 2147483647;
	const _m = {} as Record<J, Matrix>; for (const j of JORD) _m[j] = new Matrix();
	function idlePose(t: number) {
		for (const j of JORD) { const q = pose[j]; q.r = 0; q.sx = 1; q.sy = 1; q.x = 0; q.y = 0; }
		const br = S2(t, 4.1), brU = 0.5 + 0.5 * br;
		const wt = (u: number) => 0.72 * S2(u, 7.7) + 0.28 * S2(u, 12.9, 2.1);
		const sw = wt(t), swH = wt(t + 0.6);
		pose.hips.r = 1.35 * sw;
		pose.chest.r = -0.95 * sw + 0.18 * br;
		pose.chest.sy = 1 + 0.010 * brU; pose.chest.sx = 1 + 0.003 * br;
		legBend(sw > 0 ? 'R' : 'L', (sw > 0 ? -1 : 1) * 0.9 * Math.abs(sw));
		pose.neck.r = 1.25 * swH + 0.55 * S2(t, 5.3, 1.1) + 0.25 * S2(t, 2.9, 0.4);
		pose.neck.sy = 1 - 0.006 * (0.5 + 0.5 * S2(t, 3.3, 2.5));
		pose.farArm.r = 0.9 * S2(t, 4.1, -0.7) - 0.5 * sw;
		pose.farArm.y = -0.5 * brU;
		if (RX.settleT >= 0) { const u = RX.settleT; pose.farArm.r += u < 0.9 ? -2.6 * bump(u, 0, 0.42) + 1.1 * bump(u, 0.34, 0.9) : 0; }
		// anticipation (game: scatter tease): small forward lean toward the board + knees soften, eased in/out by RX.ant
		if (RX.ant > 0) { const a = RX.ant; pose.chest.r += -1.4 * a; pose.neck.r += -1.0 * a; legBend('L', 0.8 * a); legBend('R', -0.8 * a); }
		// disappointed: one slow sigh (shoulders drop, head dips) over 1.4 s
		if (RX.sighT >= 0) { const s = bump(RX.sighT, 0, 1.4); pose.chest.sy *= 1 - 0.02 * s; pose.neck.r += 1.6 * s; pose.farArm.r += 1.2 * s; }
		if (RX.door) { pose.farArm.r = RX.doorR || 0; pose.farArm.y = 0; pose.chest.r += -0.6; }
	}
	function hopPose(h: number) {
		const { up, down, D } = HOP, H = HOP.H, p = pose;
		const ant = h < up ? Math.sin((Math.PI / 2) * Math.min(1, h / 0.13)) * (1 - smooth(0.13, up + 0.02, h)) : 0;
		const air = bump(h, up, down);
		const u = (h - up) / (down - up); RX.lift = h > up && h < down ? H * 4 * u * (1 - u) : 0;
		const st = bump(h, up - 0.03, up + 0.2), fall = bump(h, down - 0.14, down + 0.01);
		const lt = h - down, fade = 1 - smooth(D - 0.22, D, h);
		const land = lt > 0 ? Math.exp(-lt * 7.0) * Math.cos(lt * 16) * fade : 0;
		const absorb = lt > 0 ? Math.exp(-lt * 9) * Math.min(1, lt / 0.05) * fade : 0;
		const sy = 1 - 0.065 * ant + 0.05 * st + 0.02 * fall - 0.08 * land;
		p.root.sy *= sy; p.root.sx *= 1 / Math.sqrt(sy); p.root.y -= RX.lift;
		p.chest.sy *= 1 - 0.025 * ant + 0.02 * st - 0.03 * land; p.chest.sx *= 1 + 0.012 * ant - 0.008 * st + 0.014 * land;
		p.hips.r += 0.7 * ant - 0.5 * air; p.chest.r += 1.0 * ant - 0.8 * st + 0.9 * land; p.neck.r += 0.8 * ant - 0.9 * st + 0.9 * land;
		legBend('L', 3.0 * ant + 3.4 * absorb); legBend('R', -3.0 * ant - 3.4 * absorb);
		p.legL.r += -1.6 * air; p.legR.r += 1.9 * air; p.kneeL.r += -2.6 * air; p.kneeR.r += 2.8 * air;
		p.farArm.r += 1.4 * ant - 2.4 * air + 1.2 * land;
	}
	function spr(s: { a: number; v: number }, target: number, K: number, C: number, dt: number) { const n = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / n;
		for (let i = 0; i < n; i++) { s.v += (K * (target - s.a) - C * s.v) * h; s.a += s.v * h; } return s.a; }
	function follow(dt: number) {
		const m = _m.neck, at = JT.neck.at, py = m.b * at[0] + m.d * at[1] + m.ty;
		if (RX.np == null || dt <= 0) { RX.np = py; RX.nvl = 0; return; }
		const vy = (py - RX.np) / dt, ay = (vy - RX.nvl) / dt; RX.np = py; RX.nvl = vy;
		const g = (8 * HOP.H) / Math.pow(HOP.down - HOP.up, 2), ld = Math.max(-2, Math.min(4, 1 - ay / g - 1));
		RX.load = RX.jumpT >= 0 ? ld : 0;
		const S = RX.sp, e = RX.load;
		const hd = spr(S.head, e, 150, 10.5, dt), ch = spr(S.chest, e, 210, 13, dt), ar = spr(S.arm, e, 62, 5.6, dt);
		const pp = RX.popT >= 0 ? Math.sin(Math.PI * Math.min(1, RX.popT / 0.3)) * Math.exp(-RX.popT * 4) : 0;
		const q = pose;
		q.neck.sy *= 1 - 0.011 * hd + 0.05 * pp; q.neck.sx *= 1 + 0.004 * hd + 0.045 * pp; q.neck.r += 0.9 * hd;
		q.chest.sy *= 1 - 0.008 * ch; q.chest.sx *= 1 + 0.004 * ch;
		if (!RX.door) q.farArm.r += 3.2 * ar;
	}
	function solve(liftOn: boolean) {
		for (const j of JORD) { const Jt = JT[j], q = pose[j], m = _m[j]; m.identity();
			const y = q.y + (j === 'root' && !liftOn ? RX.lift : 0);
			m.translate(-Jt.at[0], -Jt.at[1]); m.scale(q.sx, q.sy); m.rotate(q.r * D2R); m.translate(Jt.at[0] + q.x, Jt.at[1] + y);
			if (Jt.p) m.prepend(_m[Jt.p]); }
	}
	const applyRig = (R: Rig) => { for (const k of ORDER) R.H[k].setFromMatrix(_m[R.H[k].j!]); };
	function tailStep(dt: number) {
		const m = _m.neck, at = JT.tail.at, px = m.a * at[0] + m.c * at[1] + m.tx, py = m.b * at[0] + m.d * at[1] + m.ty;
		if (!RX.tp) { RX.tp = [px, py]; RX.tvl = [0, 0]; return; }
		const vx = (px - RX.tp[0]) / dt, vy = (py - RX.tp[1]) / dt, ax = (vx - RX.tvl[0]) / dt, ay = (vy - RX.tvl[1]) / dt;
		RX.tp = [px, py]; RX.tvl = [vx, vy];
		const g = 1220, dX = 0.29, dY = 0.96, u = -(dX * ay - dY * ax) / g, K = 95, Cd = 5.2, G = 11;
		const n = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / n, T = RX.tail;
		for (let i = 0; i < n; i++) { const acc = -K * T.a - Cd * T.v + K * G * Math.max(-1.5, Math.min(4, u)); T.v += acc * h; T.a += T.v * h; }
	}
	const faceShow = (R: Rig, name: RoxyFace | null) => { for (const f of FACES) R.H['face_' + f].visible = f === name; };
	function curFace(): RoxyFace | null {
		if (RX.blinkT >= 0) { const i = Math.floor(RX.blinkT * 30); if (i < BLINK.length) return BLINK[i]; RX.blinkT = -1; }
		return RX.base === 'open' ? null : RX.base;
	}
	const blink = () => { if (RX.blinkT < 0) RX.blinkT = 0; };
	const jump = () => { if (RX.jumpT < 0) RX.jumpT = 0; };
	const _p0 = new Point(), _p1 = new Point();
	function updGrade() {
		if (!GR.on || !gradeF) return; const u = gradeU.uniforms as any;
		view.toGlobal({ x: -SRC_W / 2, y: -SRC_H }, _p0); view.toGlobal({ x: SRC_W / 2, y: 0 }, _p1);
		const bw = _p1.x - _p0.x, bh = _p1.y - _p0.y; if (!(bw > 0 && bh > 0)) return;
		u.uBox[0] = _p0.x; u.uBox[1] = _p0.y; u.uBox[2] = bw; u.uBox[3] = bh;
		const cx = (_p0.x + _p1.x) / 2;
		let wg: Pt | null = null; for (const g of GR.keys) if (!wg || Math.abs(g.x - cx) < Math.abs(wg.x - cx)) wg = g;
		const warm = wg ? (wg.x < cx ? -1 : 1) : -1, cool = GR.cool ? (GR.cool.x < cx ? -1 : 1) : 1, ng = wg || { x: -9999, y: 0 };
		u.uRig[0] = warm; u.uRig[1] = cool; u.uRig[2] = Math.max(1.2, 1.6 * (bh / SRC_H) * GR.res); u.uRig[3] = GR.k;
		u.uNeon[0] = (ng.x - _p0.x) / bw; u.uNeon[1] = (ng.y - _p0.y) / bh; u.uNeon[2] = 0.55; u.uNeon[3] = GR.cut;
	}
	const DOOR_SH = FX(RG.layers.farArmDoor.pivot), DOOR_HAND = [-131, -470];
	let shadowOn = true;
	function update(dt: number) {
		if (!(dt > 0)) dt = 1 / 60;
		RX.t += dt;
		RX.ant += ((RX.antOn ? 1 : 0) - RX.ant) * Math.min(1, dt * 6);
		if (RX.sighT >= 0) { RX.sighT += dt; if (RX.sighT > 1.6) { RX.sighT = -1; if (RX.base === 'half') { RX.base = 'open'; blink(); } } }
		idlePose(RX.t);
		let lift = 0; RX.lift = 0;
		if (RX.jumpT >= 0) { RX.jumpT += dt; if (RX.jumpT >= HOP.D) RX.jumpT = -1; else { const was = RX.jumpT - dt < HOP.down; hopPose(RX.jumpT); lift = RX.lift; if (was && RX.jumpT >= HOP.down + 0.02) blink(); } }
		if (RX.popT >= 0) { RX.popT += dt; if (RX.popT > 0.8) RX.popT = -1; }
		if (RX.settleT >= 0) { RX.settleT += dt; if (RX.settleT > 0.9) RX.settleT = -1; }
		else if (!RX.door && RX.jumpT < 0 && RX.t > RX.nextSettle) { RX.settleT = 0; RX.nextSettle = RX.t + 5.5 + 5 * rnd(); }
		solve(true); follow(Math.max(dt, 1e-3)); solve(true); tailStep(Math.max(dt, 1e-3));
		pose.tail.r = 8 * Math.tanh(RX.tail.a / 8) + 0.9 * Math.sin((2 * Math.PI * RX.t) / 4.6 + 0.8);
		solve(true); applyRig(rigB);
		if (shadowOn) { solve(false); applyRig(rigS); }
		if (RX.blinkT >= 0) RX.blinkT += dt; else if (RX.base === 'open' && RX.t > RX.nextBlink) { blink(); RX.nextBlink = RX.t + 2.6 + 3.0 * rnd(); }
		if (RX.lookT >= 0) { RX.lookT -= dt; if (RX.lookT < 0) { RX.look = null; if (rnd() < 0.35) blink(); } }
		else if (RX.base === 'open' && RX.blinkT < 0 && !RX.antOn && RX.t > RX.nextLook) { RX.look = rnd() < 0.55 ? 'lookL' : 'lookR'; RX.lookT = 0.6 + 0.7 * rnd(); RX.nextLook = RX.t + 3 + 4 * rnd(); }
		let f = curFace(); if (f == null && RX.antOn) f = antLook; if (f == null && RX.look && RX.jumpT < 0) f = RX.look;
		faceShow(rigB, f); faceShow(rigS, null);
		rigB.H.farArm.visible = rigS.H.farArm.visible = !RX.door; rigB.H.farArmDoor.visible = rigS.H.farArmDoor.visible = RX.door;
		const ks = 1 - Math.min(0.35, lift / 420); castSh.scale.set(ks, SH.sy * ks); castSh.skew.set(SH.kx, 0);
		castA.alpha = 0.5 * (1 - Math.min(0.7, lift / 220));
		const ko = 1 - Math.min(1, lift / 40); contactL.alpha = contactR.alpha = 0.9 * ko;
		updGrade();
	}
	let antLook: RoxyFace = 'lookL';
	const face = (name: RoxyFace, k: number) => {
		if (k >= 0.5) { if (RX.base !== name) { RX.blinkT = -1; if (name === 'surprised') RX.popT = 0; } RX.base = name; RX.look = null; RX.lookT = -1; }
		else if (RX.base === name) { if (name === 'surprised') blink(); RX.base = 'open'; }
	};
	update(1 / 60);
	const A: RoxyAdapter & { hop(): void } = {
		view, srcW: SRC_W, srcH: SRC_H, height: SRC_H - RIG_BOX.y0, offsetX: (RIG_BOX.x0 + RIG_BOX.x1) / 2 - SRC_W / 2,
		rows: { headTop: 151, hopTop: 95, hips: 470 },
		update,
		idle() { RX.antOn = false; if (RX.base === 'half' || RX.base === 'surprised') face(RX.base, 0); },
		hop: jump,
		win() { RX.antOn = false; RX.sighT = -1; if (RX.base === 'half') RX.base = 'open'; jump(); },
		surprised(on) { face('surprised', on ? 1 : 0); },
		anticipate(on) { RX.antOn = on; },
		disappointed() { RX.antOn = false; RX.sighT = 0; if (RX.base === 'open') { RX.base = 'half'; RX.blinkT = -1; } },
		doorReach(on, aim = 0) { RX.door = on; RX.doorR = aim; if (on) RX.jumpT = -1; },
		doorPts() { const H = rigB.H.farArmDoor; return { sh: H.toGlobal({ x: DOOR_SH[0], y: DOOR_SH[1] }), hand: H.toGlobal({ x: DOOR_HAND[0], y: DOOR_HAND[1] }), r: RX.doorR || 0 }; },
		face,
		release() { RX.door = false; RX.doorR = 0; RX.base = 'open'; RX.jumpT = -1; RX.nextBlink = RX.t + 2.2; },
		setGrade(g) { const was = GR.on; Object.assign(GR, Object.fromEntries(Object.entries(g).filter(([, v]) => v !== undefined))); if (GR.on !== was) applyGradeOn(); },
		shadow(on) { shadowOn = on; castC.visible = contactL.visible = contactR.visible = on; },
		destroy() { view.destroy({ children: true }); },
	};
	// eyes toward the board while anticipating: the board sits on her left on screen in the landscape gutter layout
	Object.defineProperty(A, 'antLook', { set(v: RoxyFace) { antLook = v; } });
	return A;
}
