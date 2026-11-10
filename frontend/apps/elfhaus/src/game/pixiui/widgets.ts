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

/** Painted volume slider: track + fill + thumb, 5% steps. Layout in CSS px. */
export type UiSlider = Container & { set: (v: number) => void; layout: (w: number, h: number) => void; value: () => number };

export function makeSlider(onChange: (v: number) => void): UiSlider {
	const c = new Container();
	c.eventMode = 'static';
	c.cursor = 'pointer';
	let W = 120, H = 18, val = 0, drag = false, lastPaint = '';
	const trackC = new Container();
	trackC.eventMode = 'none';
	const fillC = new Container();
	fillC.eventMode = 'none';
	const thumb = spr('ui', 'slider_thumb');
	thumb.anchor.set(0.5);
	thumb.eventMode = 'none';
	c.addChild(trackC, fillC, thumb);

	const paint = () => {
		const key = `${Math.round(W)}x${Math.round(H)}:${Math.round(val * 20)}`;
		const th = Math.max(12, H * 1.35);
		const k = th / Math.max(1, thumb.texture.height);
		thumb.scale.set(k);
		const x = Math.min(W, Math.max(0, val * W));
		thumb.position.set(x, H / 2);
		if (lastPaint === key && trackC.children.length) return;
		lastPaint = key;
		trackC.removeChildren();
		fillC.removeChildren();
		trackC.addChild(nineUi('slider_track', Math.max(8, W), Math.max(8, H), 2));
		const fw = Math.max(H * 0.5, W * Math.max(0.02, val));
		fillC.addChild(nineUi('slider_fill', Math.min(W, fw), Math.max(8, H), 2));
	};

	const at = (gx: number) => {
		const p = c.toLocal({ x: gx, y: 0 });
		const v = Math.round(Math.min(1, Math.max(0, p.x / Math.max(1, W))) * 20) / 20;
		if (v === val) return;
		val = v;
		paint();
		onChange(v);
		kickUi();
	};

	c.on('pointerdown', (e) => { drag = true; at(e.global.x); e.stopPropagation(); });
	c.on('pointermove', (e) => { if (drag) { at(e.global.x); e.stopPropagation(); } });
	const end = (e: { stopPropagation: () => void }) => { if (drag) { drag = false; e.stopPropagation(); } };
	c.on('pointerup', end);
	c.on('pointerupoutside', end);
	c.on('pointercancel', end);

	const set = (v: number) => { val = Math.min(1, Math.max(0, v)); paint(); };
	const layout = (w: number, h: number) => {
		W = Math.max(8, w);
		H = Math.max(8, h);
		c.hitArea = new Rectangle(0, -10, W, H + 20);
		paint();
	};
	layout(W, H);
	return Object.assign(c, { set, layout, value: () => val });
}

