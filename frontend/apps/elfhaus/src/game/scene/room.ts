// Room depth (James 2026-10-31: "our game looks like a simple 2D cartoon. It needs to have depth and pieces that feel like
// they move independently"). The approved room painting cut into planes (elfhaus-chalet/room/build_room.py, nothing
// redrawn): the view outside the windows, the far room plate (walls, ceiling, floor, windows' timber), the fireplace
// block, the tree, and out-of-focus pine swags framing the edges. The board / HUD / Roxy plane is the focus plane and
// never moves; every other plane is offset by ONE camera (slow breathing drift + pointer / tilt) times its depth, so far
// things slide one way, near things the other, and props slide against the wall behind them. The far plate is a mesh
// whose rows take the depth of what they show (ceiling and floor come toward the viewer), so the props' feet stay on
// the floor. Lighting: one warm key from the fire (left in both orientations): a falloff ramp darkens / cools the room
// away from it, the fire's flicker spills onto the room and the frame, cast shadows fall to the right.
// prefers-reduced-motion: the camera holds still (planes stay registered), no dust, no frame glint.
import { loadAtlas } from './atlas';
import { Container, MeshPlane, NineSliceSprite, Sprite, type Texture } from 'pixi.js';
import { loadSheet, loadTex } from './load';
import ROOM from '../chalet/room.json';

export type Key = 'land' | 'port';
type RoomTex = { wall: Texture; party: Texture | null; parts: Record<string, Texture> };
const cache: Partial<Record<Key, Promise<RoomTex | null>>> = {};
export const tex: { room: Partial<Record<Key, RoomTex>>; fx: Record<string, Texture> | null } = { room: {}, fx: null };
/** Fetch one orientation's planes (wall plate + trimmed parts atlas). Resolves null on failure (the #bg painting stays). */
export function loadRoom(k: Key) {
	return (cache[k] ||= Promise.all([loadTex(`assets/room/room_${k}_wall.webp`), loadSheet('assets/room/', `room_${k}`), loadTex(`assets/room/room_${k}_wall_party.webp`).catch(() => null)])
		.then(([wall, s, party]) => (tex.room[k] = { wall, party, parts: s.sheet.textures as Record<string, Texture> }))
		.catch((e) => { console.warn('room planes off', e); return null; }));
}
export async function loadFx() {
	if (!tex.fx) tex.fx = await loadSheet('assets/room/', 'roomfx').then((r) => r.sheet.textures as Record<string, Texture>).catch(() => null);
	// + the painted run-1 fx frames (fire_glow / fire_core / fire_spill / bulb_glow / ember / flake_far ...), same names as the fx atlas
	if (tex.fx && !tex.fx.fire_glow) { const A = await loadAtlas('fx').catch(() => null); if (A) for (const [k, f] of Object.entries(A)) tex.fx[k] = f.tex; }
	return tex.fx;
}

// depth per plane (0 = the board / Roxy focus plane; < 0 behind it, > 0 in front). The far plate's rows run from ceil
// (top edge) to wall (vc .. vf) to floor (bottom edge); chim / tree match the floor depth where they stand.
export const DEPTH = {
	land: { out: -1, glass: -0.68, wall: -0.6, ceil: -0.42, floor: -0.2, vc: 0.17, vf: 0.74, chim: -0.48, tree: -0.4, room: -0.5, near: 0.55 },
	port: { out: -1, glass: -0.68, wall: -0.6, ceil: -0.45, floor: -0.2, vc: 0.11, vf: 0.78, chim: -0.52, tree: -0.48, room: -0.55, near: 0.55 },
} as const;
export const dAt = (k: Key, v: number) => {
	const D = DEPTH[k];
	if (v < D.vc) return D.ceil + (D.wall - D.ceil) * (v / D.vc);
	if (v > D.vf) return D.wall + (D.floor - D.wall) * Math.min(1, (v - D.vf) / (1 - D.vf));
	return D.wall;
};
export const ROOMS = ROOM as unknown as Record<Key, { size: [number, number]; at: Record<string, [number, number]>; lights: string }>;

// ---------------------------------------------------------------- camera
const reducedQ = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
export const reduced = () => !!reducedQ?.matches;
export const cam = { x: 0, y: 0, px: 0, py: 0, tx: 0, ty: 0 };
let tilt0: [number, number] | null = null, listening = false;
export function listenCam() {
	if (listening || typeof window === 'undefined') return; listening = true;
	window.addEventListener('pointermove', (e) => {
		if (e.pointerType === 'touch') return;
		cam.tx = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth) * 2 - 1)); cam.ty = Math.max(-1, Math.min(1, (e.clientY / window.innerHeight) * 2 - 1));
	}, { passive: true });
	// tilt where the browser gives it freely (no permission prompt): relative to the first reading
	window.addEventListener('deviceorientation', (e) => {
		if (e.gamma == null || e.beta == null) return;
		tilt0 ||= [e.gamma, e.beta];
		cam.tx = Math.max(-1, Math.min(1, (e.gamma - tilt0[0]) / 18)); cam.ty = Math.max(-1, Math.min(1, (e.beta - tilt0[1]) / 18));
	}, { passive: true });
}
/** Advance the camera. A = px per unit at this fit (1 at a 1920-wide painting on 1920 px). */
export function camTick(dt: number, now: number, A: number) {
	if (reduced()) { cam.x = cam.y = 0; return; }
	const k = 1 - Math.exp(-2.4 * dt); cam.px += (cam.tx - cam.px) * k; cam.py += (cam.ty - cam.py) * k;
	const T = Math.PI * 2;
	cam.x = (4.5 * Math.sin((now * T) / 17) + 1.4 * Math.sin((now * T) / 7.3 + 1.1) - cam.px * 8) * A;
	cam.y = (2.2 * Math.sin((now * T) / 21 + 0.6) + 0.6 * Math.sin((now * T) / 9.1 + 2.3) - cam.py * 4) * A;
}

// ---------------------------------------------------------------- planes
export const P = {
	out: new Container(), glass: new Container(), wall: new Container(), chim: new Container(), tree: new Container(),
	grade: new Container(), chimFx: new Container(), shadow: new Container(), near: new Container(),
};
let mesh: MeshPlane | null = null, meshBase: Float32Array | null = null, meshKey: Key | null = null;
let partyMesh: MeshPlane | null = null;
type Item = { o: Container; x: number; y: number; d: number };
let wallItems: Item[] = [];
const owned: Container[] = [];   // sprites buildRoom created (the only ones it may destroy on a rebuild)
const tinted: Container[] = [];
let shadows: { board: NineSliceSprite; hud: NineSliceSprite; buy: NineSliceSprite } | null = null;
export const roomOn = () => !!mesh;

/** (Re)build the planes for this fit. Returns false when the planes aren't loaded (caller keeps the #bg fallback). */
export function buildRoom(k: Key, fit: { c: number; ox: number; oy: number }, W: number, H: number) {
	// rotate fix: clear the previous fit FIRST (even when this orientation's planes aren't loaded yet), and destroy only
	// what buildRoom made itself. The old code returned early with stale wallItems (scene.build() then destroyed them ->
	// tickRoom threw every frame and the room / Roxy froze until reload) and destroyed scene-owned layers (twC / twT).
	for (const o of owned.splice(0)) { o.parent?.removeChild(o); o.destroy(); }
	if (mesh) mesh.parent?.removeChild(mesh); if (partyMesh) partyMesh.parent?.removeChild(partyMesh);
	P.wall.removeChildren(); wallItems = []; tinted.length = 0; lastNight = -1;
	const T = tex.room[k], F = tex.fx; if (!T || !F) return false;
	const R = ROOMS[k], [iw, ih] = R.size;
	const at = (n: string) => { const s = new Sprite(T.parts[n]); owned.push(s); const [x, y] = R.at[n]; s.position.set(fit.ox + x * fit.c, fit.oy + y * fit.c); s.scale.set(fit.c); return s; };
	for (const n of Object.keys(R.at)) if (n.startsWith('out')) { const s = at(n); P.out.addChild(s); tinted.push(s); }
	if (!mesh || meshKey !== k) {
		mesh?.destroy(); mesh = new MeshPlane({ texture: T.wall, verticesX: 2, verticesY: 15 }); meshKey = k;
		// free spins party plate: the painted festive version of the same far plate (same layout), crossfaded in by tickRoom
		partyMesh?.destroy(); partyMesh = T.party ? new MeshPlane({ texture: T.party, verticesX: 2, verticesY: 15 }) : null;
		meshBase = Float32Array.from(mesh.geometry.positions as Float32Array);
	}
	mesh.position.set(fit.ox, fit.oy); mesh.scale.set(fit.c); P.wall.addChild(mesh); tinted.push(mesh);
	if (partyMesh) { partyMesh.position.set(fit.ox, fit.oy); partyMesh.scale.set(fit.c); partyMesh.alpha = 0; P.wall.addChild(partyMesh); }
	// moonlight: a cool glow over each window (wall depth)
	for (const [u0, v0, u1, v1] of (k === 'land' ? [[0.235, 0.205, 0.33, 0.56], [0.722, 0.18, 0.852, 0.56]] : [[0.31, 0.105, 0.9, 0.645]])) {
		const g = new NineSliceSprite({ texture: F.glow9, leftWidth: 40, rightWidth: 40, topHeight: 40, bottomHeight: 40 }); owned.push(g);
		const m = 40 * fit.c, x = fit.ox + u0 * iw * fit.c - m, y = fit.oy + v0 * ih * fit.c - m;
		g.width = (u1 - u0) * iw * fit.c + 2 * m; g.height = (v1 - v0) * ih * fit.c + 2 * m; g.tint = 0x9ec2ff; g.blendMode = 'add'; g.alpha = 0.13;
		P.wall.addChild(g); wallItems.push({ o: g, x, y, d: dAt(k, (v0 + v1) / 2) }); g.position.set(x, y);
	}
	const ch = at('chim'); P.chim.addChild(ch); tinted.push(ch);
	const tr = at('tree'); P.tree.addChild(tr); tinted.push(tr);
	// key light falloff: white on the fire side, darker / cooler away from it (multiply, screen space)
	const gr = new Sprite(F.ramp); owned.push(gr); gr.blendMode = 'multiply'; gr.width = W; gr.height = H; P.grade.addChild(gr);
	for (const n of Object.keys(R.at)) if (n.startsWith('near')) { const s = at(n); P.near.addChild(s); tinted.push(s); }
	if (!shadows) {
		const mk = () => { const s = new NineSliceSprite({ texture: F.shadow9, leftWidth: 56, rightWidth: 56, topHeight: 56, bottomHeight: 56 }); s.tint = 0x0a0302; P.shadow.addChild(s); return s; };
		shadows = { board: mk(), hud: mk(), buy: mk() };
	}
	return true;
}
/** Wall items that sit on the far plate at painting v (their depth follows the plate's row depth). */
export function wallItem(k: Key, o: Container, x: number, y: number, v: number) { wallItems.push({ o, x, y, d: dAt(k, v) }); o.position.set(x, y); }

/** Cast shadows onto the room, offset away from the fire (right / down). Rects in stage px; null hides one. */
export function placeShadows(board: DOMRect | null, hud: { x: number; y: number; w: number; h: number } | null, buy: DOMRect | null, s: number) {
	if (!shadows) return;
	const put = (o: NineSliceSprite, r: { x: number; y: number; w: number; h: number } | null, dx: number, dy: number, grow: number, a: number) => {
		o.visible = !!r; if (!r) return;
		const m = 56 * s * 0.7;
		o.position.set(r.x + dx * s - m - grow * s, r.y + dy * s - m - grow * s * 0.4); o.width = r.w + 2 * m + 2 * grow * s; o.height = r.h + 2 * m + grow * s * 0.8; o.alpha = a;
	};
	put(shadows.board, board && { x: board.left, y: board.top, w: board.width, h: board.height }, 22, 26, 10, 0.55);
	put(shadows.hud, hud, 14, 4, 4, 0.45);
	put(shadows.buy, buy && { x: buy.left, y: buy.top, w: buy.width, h: buy.height }, 12, 14, 2, 0.4);
}

let lastNight = -1;
/** Per frame: plane offsets from the camera, the far plate's row depths, the night grade (bonus) as a tint. */
export function tickRoom(k: Key, fit: { c: number }, night: number) {
	const D = DEPTH[k], cx = cam.x, cy = cam.y;
	P.out.position.set(cx * D.out, cy * D.out); P.glass.position.set(cx * D.glass, cy * D.glass);
	P.chim.position.set(cx * D.chim, cy * D.chim); P.chimFx.position.copyFrom(P.chim.position);
	P.tree.position.set(cx * D.tree, cy * D.tree); P.shadow.position.set(cx * D.room, cy * D.room);
	P.near.position.set(cx * D.near, cy * D.near);
	for (const it of wallItems) if (!it.o.destroyed) it.o.position.set(it.x + cx * it.d, it.y + cy * it.d);
	if (mesh && meshBase) {
		const pos = mesh.geometry.positions as Float32Array, ih = ROOMS[k].size[1], ix = cx / fit.c, iy = cy / fit.c;
		for (let i = 0; i < pos.length; i += 2) { const d = dAt(k, meshBase[i + 1] / ih); pos[i] = meshBase[i] + ix * d; pos[i + 1] = meshBase[i + 1] + iy * d; }
		mesh.geometry.getBuffer('aPosition').update();
		if (partyMesh) { (partyMesh.geometry.positions as Float32Array).set(pos); partyMesh.geometry.getBuffer('aPosition').update(); }
	}
	// free spins = party mode: the festive far plate fades in and the room warms (amber), no night darkening
	if (Math.abs(night - lastNight) > 0.002) {
		lastNight = night; if (partyMesh) partyMesh.alpha = night;
		const r = 255, g = Math.round(255 * (1 - 0.07 * night)), b = Math.round(255 * (1 - 0.18 * night));
		const t = (r << 16) | (g << 8) | b; for (const o of tinted) (o as Sprite).tint = t;
	}
}
