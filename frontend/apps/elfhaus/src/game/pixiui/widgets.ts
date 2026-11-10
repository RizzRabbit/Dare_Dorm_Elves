// Shared Pixi UI widgets built only from existing atlas / 9-slice sprites.
import { Container, NineSliceSprite, Rectangle, Sprite, Texture } from 'pixi.js';
import { Assets } from 'pixi.js';
import { atlasTex, nine, spr } from '../scene/atlas';
import { kickUi } from './stage';

export let modalBtnTex: Texture | null = null;
export let modalDimTex: Texture | null = null;
export let modalCardTex: Texture | null = null;

export async function loadUiWidgets() {
	modalBtnTex = await Assets.load('assets/ui/modal_btn9.webp') as Texture;
	modalDimTex = await Assets.load('assets/ui/modal_dim.webp') as Texture;
	try { modalCardTex = await Assets.load('assets/ui/modal_card9.webp') as Texture; } catch { modalCardTex = null; }
}

/** 9-slice a texture with [l,t,r,b] in sprite px. k = sprite px per design px of the corners. */
export function nineTex(tex: Texture, slice: [number, number, number, number], w: number, h: number, k = 1) {
	const [l, t, r, b] = slice;
	const s = new NineSliceSprite({ texture: tex, leftWidth: l, topHeight: t, rightWidth: r, bottomHeight: b });
	s.scale.set(1 / k);
	s.width = w * k;
	s.height = h * k;
	s.eventMode = 'none';
	return s;
}

export function nineUi(name: string, w: number, h: number, k = 2) {
	const s = nine('ui', name, w, h, k);
	s.eventMode = 'none';
	return s;
}

/** Make a design-space hit target at least 44 px on each side. */
export function hit(c: Container, w: number, h: number) {
	const hw = Math.max(44, w), hh = Math.max(44, h);
	c.hitArea = new Rectangle((w - hw) / 2, (h - hh) / 2, hw, hh);
	c.eventMode = 'static';
	c.cursor = 'pointer';
	return c;
}

export function icoBtn(frame: string, size: number, onTap: () => void) {
	const c = new Container();
	const s = spr('ui', frame);
	s.anchor.set(0.5);
	const k = size / Math.max(s.texture.width, s.texture.height);
	s.scale.set(k);
	s.position.set(size / 2, size / 2);
	s.eventMode = 'none';
	c.addChild(s);
	hit(c, size, size);
	c.on('pointertap', (e) => { e.stopPropagation(); onTap(); });
	return Object.assign(c, { icon: s, size }) as Container & { icon: Sprite; size: number };
}

/** Painted switch: sw_on / sw_off track + sliding sw_knob. */
export function makeSwitch(onTap: () => void) {
	const c = new Container();
	c.label = 'switch';
	const W = 64, H = 36;
	const track = new Sprite();
	track.eventMode = 'none';
	const knob = spr('ui', 'sw_knob');
	knob.anchor.set(0.5);
	knob.eventMode = 'none';
	const kh = H * 0.86;
	knob.scale.set(kh / Math.max(1, knob.texture.height));
	c.addChild(track, knob);
	hit(c, W, H);
	c.on('pointertap', (e) => { e.stopPropagation(); onTap(); });

	const set = (on: boolean) => {
		try { track.texture = atlasTex('ui', on ? 'sw_on' : 'sw_off'); } catch { /* */ }
		track.width = W;
		track.height = H;
		track.position.set(0, 0);
		const pad = 4 + (knob.width / 2);
		knob.position.set(on ? W - pad : pad, H / 2);
		kickUi();
	};
	set(false);
	return Object.assign(c, { set, W, H });
}

export function goBtn(w: number, h: number, onTap: () => void) {
	const c = new Container();
	c.addChild(nineUi('btn_go', w, h, 2));
	hit(c, w, h);
	c.on('pointertap', (e) => { e.stopPropagation(); onTap(); });
	return c;
}

/** Intro START plate: the bonus-card 9-slice button (modal_btn9). */
export function startBtn(w: number, h: number, onTap: () => void) {
	const c = new Container();
	if (modalBtnTex) c.addChild(nineTex(modalBtnTex, [60, 60, 60, 60], w, h, 2));
	else c.addChild(nineUi('btn_go', w, h, 2));
	hit(c, w, h);
	c.on('pointertap', (e) => { e.stopPropagation(); onTap(); });
	return c;
}
