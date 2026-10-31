// Winter Chalet Roxy: a cut-out / skeletal rig on ONE painted full-body cutout (assets/rig/elf_roxy.webp).
// The cutout is a MeshPlane (10 x 36 vertices) whose vertices are re-posed every frame by a small bone chain with smooth
// weights: feet (fixed) -> hips (sway / shake) -> torso (breath, counter-lean) -> neck -> head (tilt, nod) plus a hair
// chain (ponytail lag) and an arm-side follow. Eyelids are code-drawn skin lids with an ink lash line, posed with the
// head bone (blink, wink). Nothing is a frame sequence: no shimmer. All motion runs on real elapsed time (dt seconds).
import { Container, Graphics, MeshPlane, Sprite, type Texture } from 'pixi.js';
import { loadTex } from '../scene/load';
import type { RoxyAdapter, RoxyFace, RoxyGrade } from './types';

const SRC = 'assets/rig/elf_roxy.webp';
// her footing (built by elfhaus-chalet/build_roxy_ground.py, same rig px / origin as the cutout): a sawn log round she
// stands on (top face through both boot soles, bark side dropping toward the room floor) and a baked shadow layer
// (a tight dark core hugging each sole + a soft ambient pool). The round is fixed; only the shadow reacts to her hop.
const GROUND_SRC = 'assets/rig/roxy_ground.webp', GROUND_BOX = { x: -330, y: -110 };
const SHADOW_SRC = 'assets/rig/roxy_ground_shadow.webp', SHADOW_BOX = { x: -280, y: -120 };
const W = 443, H = 1166, GROUND = 1155, CX = 220;          // cutout px; origin between the feet on the ground row
const NECK = { x: 232, y: 292 }, HIPS = 560, CHEST = [310, 450] as const;
const HAIR = { x1: 140, y1: 360 };                           // ponytail box (screen left of her head)
// eye openings (cutout px): x, y (lid top), w, h; R = her left (screen right), winks
const EYES = [{ x: 170, y: 163, w: 54, h: 38 }, { x: 253, y: 170, w: 42, h: 34 }];
const SKIN = 0xe9874a, INK = 0x26140f, LASH = 0x1a0d0a;
const VX = 10, VY = 36;

const sm = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const bump = (a: number, b: number, v: number) => (v <= a || v >= b ? 0 : Math.sin(((v - a) / (b - a)) * Math.PI));
const damp = (cur: number, to: number, k: number, dt: number) => cur + (to - cur) * (1 - Math.exp(-k * dt));
const outBack = (t: number) => { const s = 1.9; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };

type Shot = { t: number; dur: number; kind: 'win' | 'bonus' | 'sad' | 'surp' };

export async function createRoxy(): Promise<RoxyAdapter> {
	const tex: Texture = await loadTex(SRC);
	const view = new Container(), body = new Container();
	const [gTex, sTex] = await Promise.all([loadTex(GROUND_SRC), loadTex(SHADOW_SRC)]);
	const ground = new Sprite(gTex); ground.position.set(GROUND_BOX.x, GROUND_BOX.y);
	let shOn = true, door = false;
	const showGround = () => { shadowG.visible = shOn && !door; ground.visible = shOn && !door; };
	const shadowG = new Container(), shadowS = new Sprite(sTex);
	shadowS.position.set(SHADOW_BOX.x, SHADOW_BOX.y); shadowG.addChild(shadowS);
	const mesh = new MeshPlane({ texture: tex, verticesX: VX, verticesY: VY });
	mesh.position.set(-CX, -GROUND);
	body.addChild(mesh);
	const lids = EYES.map((e) => {
		const g = new Graphics();
		// a skin lid with a heavy lash line at its lower edge, drawn closed; scale.y = how far down it is
		g.roundRect(-e.w * 0.58, -2, e.w * 1.16, e.h + 4, e.h * 0.45).fill(SKIN);
		g.moveTo(-e.w * 0.6, e.h - 1).quadraticCurveTo(0, e.h + 7, e.w * 0.6, e.h - 5).stroke({ color: LASH, width: 6, cap: 'round' });
		g.scale.y = 0; g.visible = false; body.addChild(g); return g;
	});
	view.addChild(ground, shadowG, body);
	const geo = mesh.geometry, base = Float32Array.from(geo.positions as Float32Array), pos = geo.positions as Float32Array;

	// pose state (springs / tweens toward targets)
	let t = 0, blinkAt = 2.2, blinkT = -1, winkK = 0, winkHold = 0, surpK = 0;
	let antK = 0, antTo = 0, party = 0, shots: Shot[] = [], faceK: Partial<Record<RoxyFace, number>> = {};
	const P = { lean: 0, hip: 0, head: 0, nod: 0, breath: 0, hair: 0, hop: 0, sq: 1 };

	function deform() {
		for (let i = 0; i < pos.length; i += 2) {
			let x = base[i], y = base[i + 1];
			// hair chain: the ponytail trails the head with a lag (P.hair) and swings more toward its tip
			const wh = sm(HAIR.x1, HAIR.x1 - 150, x) * sm(HAIR.y1, 120, y);
			x += P.hair * 26 * wh; y += Math.abs(P.hair) * 4 * wh;
			// breath: the chest band widens and lifts a touch
			const wb = bump(CHEST[0], CHEST[1], y);
			x = CX + (x - CX) * (1 + P.breath * 0.014 * wb); y -= P.breath * 3 * wb;
			// head + neck: rotate about the neck pivot, blended in over the neck
			const wn = sm(NECK.y + 60, NECK.y - 30, y);
			if (wn > 0) {
				const a = P.head * wn, c = Math.cos(a), s = Math.sin(a), dx = x - NECK.x, dy = y - NECK.y;
				x = NECK.x + dx * c - dy * s; y = NECK.y + dx * s + dy * c + P.nod * 10 * wn;
			}
			// hips: everything above the knees follows the hip sway, the torso counter-leans a little
			const wHip = sm(GROUND - 120, HIPS, y);
			x += P.hip * 18 * wHip - P.hip * 6 * sm(HIPS, NECK.y, y);
			// whole-body lean about the feet (more at the top) + squash / stretch about the ground
			const up = (GROUND - y) / (GROUND - 0);
			x += P.lean * 90 * up * up;
			y = GROUND - (GROUND - y) * P.sq; x = CX + (x - CX) * (1 + (1 - P.sq) * 0.6 * (1 - up));
			pos[i] = x; pos[i + 1] = y;
		}
		geo.getBuffer('aPosition').update();
		// lids ride the same head bone
		EYES.forEach((e, j) => {
			const g = lids[j]; let x = e.x + e.w / 2, y = e.y;
			const a = P.head, dx = x - NECK.x, dy = y - NECK.y, c = Math.cos(a), s = Math.sin(a);
			x = NECK.x + dx * c - dy * s; y = NECK.y + dx * s + dy * c + P.nod * 10;
			const up = (GROUND - y) / GROUND; x += P.hip * 18 - P.hip * 6 + P.lean * 90 * up * up;
			y = GROUND - (GROUND - y) * P.sq;
			g.position.set(x - CX, y - GROUND); g.rotation = a;
			const blink = blinkT >= 0 ? Math.sin(Math.min(1, blinkT / 0.15) * Math.PI) : 0;
			const k = Math.max(blink, j === 1 ? winkK : 0, faceK.closed ?? 0, (faceK.half ?? 0) * 0.45) * (1 - surpK * 0.6);
			g.scale.y = k; g.visible = k > 0.02;
		});
	}

	function update(dt: number) {
		dt = Math.min(dt, 0.05); t += dt;
		// idle loop: breath 3.6 s, hip sway 5.2 s, head drift 4.4 s, hair lags the sway
		const breath = Math.sin(t * (Math.PI * 2) / 3.6);
		let hip = Math.sin(t * (Math.PI * 2) / 5.2) * 0.35, head = Math.sin(t * (Math.PI * 2) / 4.4 + 0.6) * 0.035, nod = 0, lean = 0, hop = 0, sq = 1;
		// anticipation: lean toward the board, head tilts in, the sway calms
		antK = damp(antK, antTo, 8, dt);
		hip *= 1 - antK * 0.7; lean += -0.05 * antK; head += -0.07 * antK; nod += 0.4 * antK;
		// one-shots (win hop + hip shake, bonus double hop, sad nod, surprise stretch)
		shots = shots.filter((s) => (s.t += dt) < s.dur);
		for (const s of shots) {
			const u = s.t / s.dur;
			if (s.kind === 'win' || s.kind === 'bonus') {
				const hops = s.kind === 'bonus' ? 2 : 1, hu = Math.min(1, u * (s.kind === 'bonus' ? 1.4 : 1.8));
				const ph = (hu * hops) % 1, n = Math.floor(hu * hops);
				if (hu < 1 && n < hops) {
					if (ph < 0.18) sq = 1 - 0.08 * Math.sin((ph / 0.18) * Math.PI / 2);                       // crouch
					else if (ph < 0.75) { const q = (ph - 0.18) / 0.57; hop = Math.sin(q * Math.PI) * 46; sq = 1 + 0.06 * Math.sin(q * Math.PI); } // air
					else sq = 1 - 0.07 * Math.sin(((ph - 0.75) / 0.25) * Math.PI);                              // land
				}
				// hip shake after landing
				if (hu >= 1) hip += Math.sin((u - 0.55) * 34) * 1.1 * Math.max(0, 1 - (u - 0.55) / 0.45);
				// a quick glance / lean toward the reels (screen left), then back to the camera
				head += -Math.sin(Math.min(1, u * 1.6) * Math.PI) * 0.08; lean += -Math.sin(Math.min(1, u * 1.6) * Math.PI) * 0.025;
			} else if (s.kind === 'sad') { const e = Math.sin(u * Math.PI); nod += 1.2 * e; head += 0.05 * e; hip *= 1 - e; }
			else if (s.kind === 'surp') { const e = outBack(Math.min(1, u * 3)) * (1 - sm(0.6, 1, u)); sq = 1 + 0.04 * e; }
		}
		P.breath = breath; P.hop = damp(P.hop, hop, 30, dt); P.sq = damp(P.sq, sq, 26, dt);
		P.hip = damp(P.hip, hip, 10, dt); P.head = damp(P.head, head, 7, dt); P.nod = damp(P.nod, nod, 7, dt); P.lean = damp(P.lean, lean, 7, dt);
		P.hair = damp(P.hair, P.hip * 0.8 + P.head * 6 - P.hop * 0.012, 3.2, dt);
		body.position.y = -P.hop;
		shadowG.scale.set(1 - Math.min(0.35, P.hop / 120)); shadowG.alpha = 1 - Math.min(0.5, P.hop / 90);
		// blinks every 2.4 - 5 s (a double blink now and then); wink holds
		if (blinkT >= 0) { blinkT += dt; if (blinkT > 0.15) blinkT = -1; }
		else if (t > blinkAt) { blinkT = 0; blinkAt = t + (Math.random() < 0.2 ? 0.28 : 2.4 + Math.random() * 2.6); }
		if (winkHold > 0) { winkHold -= dt; winkK = damp(winkK, 1, 30, dt); } else winkK = damp(winkK, faceK.wink ?? 0, 22, dt);
		surpK = damp(surpK, faceK.surprised ?? 0, 14, dt);
		deform();
	}

	const tint = () => { const k = party; const r = Math.round(255 - 40 * k), g = Math.round(255 - 30 * k), b = 255; mesh.tint = (r << 16) | (g << 8) | b; };
	const R: RoxyAdapter = {
		view, srcW: W, srcH: H, height: GROUND - 6, offsetX: 0,
		rows: { headTop: 6, hopTop: 6 - 46, hips: HIPS },
		update,
		idle() { antTo = 0; },
		win(kind = 'win') { antTo = 0; shots.push({ t: 0, dur: kind === 'bonus' ? 1.5 : 1.25, kind: kind === 'bonus' ? 'bonus' : 'win' }); winkHold = kind === 'win' ? 0.55 : 0; },
		surprised(on) { faceK.surprised = on ? 1 : 0; if (on) shots.push({ t: 0, dur: 0.6, kind: 'surp' }); },
		anticipate(on) { antTo = on ? 1 : 0; },
		disappointed() { antTo = 0; shots.push({ t: 0, dur: 1.1, kind: 'sad' }); },
		doorReach(on) { door = on; showGround(); },   // intro doorway: she stands on the painted door sill, not the log
		doorPts() { return null; },
		face(name: RoxyFace, k: number) { faceK[name] = k; },
		release() { faceK = {}; },
		setGrade(_g: RoxyGrade) {},
		setParty(k: number) { party = k; tint(); },
		shadow(on) { shOn = on; showGround(); },
		destroy() { view.destroy({ children: true }); },
	};
	update(0);
	return R;
}
