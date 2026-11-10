// Big-win / max-win elf rigs and the max-win title sheet, drawn on the UI stage.
import { Container, Sprite, Texture } from 'pixi.js';
import { uiInteractive, uiScreen, viewH, viewW } from './stage';
import { setBwElfPixi } from '../bigwinElves';

export const elfFxLayer = new Container();
elfFxLayer.label = 'uiElfFx';
elfFxLayer.eventMode = 'none';
elfFxLayer.sortableChildren = true;
elfFxLayer.zIndex = 2;

let bw: Container | null = null;
let mw: Container | null = null;
let mwBg: Sprite | null = null;
let catcher: Sprite | null = null;

export function ensureElfFx() {
	if (!elfFxLayer.parent && uiScreen) uiScreen.addChild(elfFxLayer);
	setBwElfPixi({
		layer: () => bwElfLayer(),
		clear: () => clearBwElves(),
		size: () => { const l = bwElfLayer(); return { w: (l as any)._W || viewW, h: (l as any)._H || viewH * 0.72 }; },
	});
	return elfFxLayer;
}

export function bwElfLayer() {
	ensureElfFx();
	if (!bw) {
		bw = new Container();
		bw.label = 'bwElves';
		bw.eventMode = 'none';
		elfFxLayer.addChild(bw);
	}
	sizeLayer(bw, 0, viewH * 0.12, viewW, viewH * 0.72);
	return bw;
}

export function mwElfLayer() {
	ensureElfFx();
	if (!mw) {
		mw = new Container();
		mw.label = 'mwElves';
		mw.eventMode = 'none';
		elfFxLayer.addChild(mw);
	}
	sizeLayer(mw, 0, viewH * 0.08, viewW, viewH * 0.78);
	return mw;
}

function sizeLayer(c: Container, x: number, y: number, w: number, h: number) {
	c.position.set(x, y);
	(c as any)._W = w;
	(c as any)._H = h;
}

export function setMwBackground(url: string | null) {
	ensureElfFx();
	if (!url) {
		if (mwBg) mwBg.visible = false;
		return;
	}
	if (!mwBg) {
		mwBg = new Sprite(Texture.EMPTY);
		mwBg.eventMode = 'none';
		mwBg.zIndex = 0;
		elfFxLayer.addChildAt(mwBg, 0);
	}
	try { mwBg.texture = Texture.from(url); } catch { /* */ }
	mwBg.visible = true;
	mwBg.width = viewW;
	mwBg.height = viewH;
	mwBg.alpha = 1;
}

export function setMwCatcher(on: boolean, handler?: (e: { clientX: number; clientY: number }) => void) {
	ensureElfFx();
	if (!on) { if (catcher) { catcher.visible = false; catcher.eventMode = 'none'; } return; }
	if (!catcher) {
		catcher = new Sprite(Texture.EMPTY);
		catcher.zIndex = 50;
		elfFxLayer.addChild(catcher);
	}
	catcher.visible = true;
	catcher.eventMode = 'static';
	catcher.width = viewW;
	catcher.height = viewH;
	catcher.alpha = 0.001;
	catcher.removeAllListeners();
	if (handler) catcher.on('pointertap', (e) => handler({ clientX: e.global.x, clientY: e.global.y }));
	uiInteractive(true);
}

export function clearBwElves() { if (bw) { bw.removeChildren(); } }
export function clearMwElves() { if (mw) { mw.removeChildren(); } setMwBackground(null); setMwCatcher(false); }
