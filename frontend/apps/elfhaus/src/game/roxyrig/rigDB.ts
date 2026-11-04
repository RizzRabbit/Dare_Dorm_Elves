// Roxy as ONE DragonBones rig (room + intro), played by pixi-dragonbones-runtime 8.0.3 (MIT) on Pixi 8.
// Source: static/assets/rig/roxy_db/roxy_{ske,tex}.json + roxy_tex.webp, built from the approved chalet Roxy (room_roxy_fullbody/roxy_ingame_fullbody_transparent.png)
// with painted face frames (no code-drawn lids). Body animations play on group 'body' with 0.25 s blends; faces on their
// own group 'face' (resetToPose = false) so a blink / wink never resets the pose. Intro: intro_door (painted reaching hand
// on the door_hand bone, read by doorPts for the lever) -> intro_step -> intro_land -> idle.
import { Container, Point, Sprite, type Texture } from 'pixi.js';
import { PixiFactory, type PixiArmatureDisplay } from 'pixi-dragonbones-runtime';
import { loadTex } from '../scene/load';
import { playVoice } from '../audio';
import type { RoxyAdapter, RoxyFace, RoxyGrade } from './types';

const DIR = 'assets/rig/roxy_db/';
// rig canvas (2x px) -> adapter px: the figure keeps the height the room layouts were tuned for (1149 px feet to head)
const CW = 649, CH = 1715, FEET = { x: 323.9, y: 1697.4 }, TOP = 8, K = 1149 / (FEET.y - TOP);
const GROUND_SRC = 'assets/rig/roxy_ground.webp', GROUND_BOX = { x: -330, y: -110 };
const SHADOW_SRC = 'assets/rig/roxy_ground_shadow.webp', SHADOW_BOX = { x: -280, y: -120 };
const FADE = 0.25;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const FACE_OF: Partial<Record<RoxyFace, string>> = { closed: 'blink', wink: 'wink', surprised: 'eager' };
let parsed = false;

export async function createRoxy(): Promise<RoxyAdapter> {
	const [ske, atl, tex, gTex, sTex] = await Promise.all([
		fetch(DIR + 'roxy_ske.json').then((r) => r.json()), fetch(DIR + 'roxy_tex.json').then((r) => r.json()),
		loadTex(DIR + 'roxy_tex.webp'), loadTex(GROUND_SRC), loadTex(SHADOW_SRC)]) as [unknown, unknown, Texture, Texture, Texture];
	PixiFactory.useSharedTicker = false;   // the scene ticker drives update(dt)
	const F = PixiFactory.factory;
	if (!parsed) { F.parseDragonBonesData(ske); F.parseTextureAtlasData(atl, tex); parsed = true; }
	const d = F.buildArmatureDisplay('roxy', 'roxy') as PixiArmatureDisplay;
	const view = new Container(), body = new Container();
	const ground = new Sprite(gTex); ground.position.set(GROUND_BOX.x, GROUND_BOX.y);
	const shadowG = new Container(), shadowS = new Sprite(sTex); shadowS.position.set(SHADOW_BOX.x, SHADOW_BOX.y); shadowG.addChild(shadowS);
	d.scale.set(K); d.position.set(-FEET.x * K, -FEET.y * K);
	body.addChild(d); view.addChild(ground, shadowG, body);
	const A = d.animation, arm = d.armature;
	let still = reduced(), shOn = true, door = false, t = 0, blinkAt = 2.5, back = -1, party = 0, aim = 0;
	let reach = 1;   // fix5 #3: door-reach arm stretch along the uarm bone
	let faceK: Partial<Record<RoxyFace, number>> = {};
	const showGround = () => { shadowG.visible = shOn && !door; ground.visible = shOn && !door; };
	const bodyPlay = (name: string, times = -1) => { const s = A.fadeIn(name, FADE, times, 0, 'body'); return s; };
	const facePlay = (name: string) => { const s = A.fadeIn(name, 0, 1, 1, 'face'); if (s) s.resetToPose = false; return s; };
	const pelvis = arm.getBone('pelvis'), hand = arm.getBone('door_hand'), chest = arm.getBone('chest'), uarm = arm.getBone('uarm');
	bodyPlay('idle', 0);
	// one-shots fall back to idle by themselves (intro_door holds its last frame until the intro moves on)
	d.addDBEventListener('complete', (e: any) => {
		const n = e?.animationState?.name;
		if (n === 'win' || n === 'intro_land') bodyPlay('idle', 0);
		else if (n === 'intro_step') bodyPlay('idle', 0);
	}, null);
	function update(dt: number) {
		t += dt;
		if (!still || door) arm.advanceTime(dt); else arm.advanceTime(0);
		// blinks every 2.4 - 5 s; never while a face one-shot is showing
		if (t > blinkAt) { const busy = A.getStates?.().some?.((s: any) => s.group === 'face' && s.isPlaying && s.name !== 'blink');
			if (!busy) facePlay('blink'); blinkAt = t + (Math.random() < 0.2 ? 0.3 : 2.4 + Math.random() * 2.6); }
		if (back > 0 && (back -= dt) <= 0) { back = -1; bodyPlay('idle', 0); }
		// contact shadow follows the hop (pelvis lift)
		const hop = pelvis ? Math.max(0, -pelvis.animationPose.y) * K : 0;
		shadowG.scale.set(1 - Math.min(0.35, hop / 120)); shadowG.alpha = 1 - Math.min(0.5, hop / 90);
		// fix4: the reach swings the whole arm from the shoulder (uarm) so the painted hand lands on the lever
		// fix5 #3: and stretches it along its length (reach, <= 1.6) so the fingertips land on the lever grip, not short of it
		if (uarm) { uarm.offset.rotation = aim * Math.PI / 180; uarm.offset.scaleY = reach; uarm.invalidUpdate(); }   // the arm chain runs along uarm's local y (farm at y 213)
	}
	const tint = () => { const k = party; view.tint = (Math.round(255 - 40 * k) << 16) | (Math.round(255 - 30 * k) << 8) | 255; };
	try { matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => { still = reduced(); }); } catch { /* old engines */ }
	const tip = (b: any, len: number) => { const m = b.globalTransformMatrix; return new Point(m.a * len + m.tx, m.b * len + m.ty); };
	const R: RoxyAdapter = {
		view, srcW: CW * K, srcH: CH * K, height: 1149, offsetX: 0,
		rows: { headTop: 6, hopTop: 6 - 46, hips: Math.round((828 - TOP) * K) },
		update,
		idle() { if (!door) bodyPlay('idle', 0); },
		win(kind = 'win') {
			if (door) return; bodyPlay('win', 1);
			if (kind === 'bonus') { facePlay('laugh'); playVoice('vo_roxy_laugh_1'); }   // laugh = the excited face, eyes open (wins only)
			else { facePlay('smile'); setTimeout(() => facePlay('wink'), 900); }
		},
		smile() { facePlay('smile'); },
		talk(sec: number) { if (sec > 0) facePlay('laugh'); },
		surprised(on) { if (on) facePlay('eager'); },
		anticipate(on) { if (on) facePlay('eager'); },
		disappointed() { facePlay('disappointed'); },
		doorReach(on, aimDeg = 0, reachK = 1) {
			aim = on ? Math.max(-45, Math.min(45, aimDeg)) : 0;
			reach = on ? Math.max(1, Math.min(1.6, reachK)) : 1;
			if (on && !door) { door = true; bodyPlay('intro_door', 1); }
			else if (!on && door) { door = false; bodyPlay('intro_step', 1); }
			showGround();
		},
		doorPts() {
			if (!hand || !uarm) return null;
			// shoulder = the uarm pivot; hand = the painted fingertips (door_hand tip); r = the reach offset already applied
			const h = d.toGlobal(tip(hand, hand.boneData.length * 0.6)), s = d.toGlobal(new Point(uarm.globalTransformMatrix.tx, uarm.globalTransformMatrix.ty));
			return { sh: s, hand: h, r: aim, k: reach };
		},
		face(name: RoxyFace, k: number) {
			const was = faceK[name] ?? 0; faceK[name] = k;
			if (k >= 0.5 && was < 0.5) { const f = FACE_OF[name]; if (f) facePlay(f); }
		},
		release() { faceK = {}; aim = 0; reach = 1; if (door) door = false; showGround(); bodyPlay('intro_land', 1); },
		setGrade(_g: RoxyGrade) {},
		setParty(k: number) { party = k; tint(); },
		shadow(on) { shOn = on; showGround(); },
		destroy() { view.destroy({ children: true }); },
	};
	update(0);
	return R;
}
