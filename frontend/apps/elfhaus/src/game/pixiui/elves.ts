// Masked, consistently posed art window for buy / confirm / feature-intro cards.
// Existing transparent maxwin_elf_* cutouts only. Single-feature cards show one elf;
// groups only on Wild Winter Spins / Powder Day. Secret Santa is the gift + ? badge.
// Crop is a texture frame (head to mid-thigh) so nothing is clipped with a Pixi mask.
import { Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { ELF_CUTOUT, type ElfId } from '../cardelves';
import { spr } from '../scene/atlas';
import SHEET_JSON from '../chalet/symbols.sheet.json';

type Fr = { frame: { x: number; y: number; w: number; h: number } };
const FRAMES = (SHEET_JSON as unknown as { frames: Record<string, Fr> }).frames;

const HEAD: Record<ElfId, [number, number]> = {
	roxy: [0.398, 0.22],
	jade: [0.4616, 0.22],
	vi: [0.47, 0.22],
	coco: [0.4553, 0.22],
	delilah: [0.4169, 0.22],
};
const Z: Record<ElfId, number> = { coco: 1, vi: 1, jade: 2, roxy: 3, delilah: 4 };
const CROP = 0.64;
const REF_H = 650;

export const CARD_ELVES: Record<string, ElfId[]> = {
	dare: ['roxy'],
	double_dare: ['jade'],
	triple_dare: ['vi'],
	egw: ['coco', 'roxy', 'jade', 'vi', 'delilah'],
	hidden: ['coco', 'roxy', 'jade', 'vi', 'delilah'],
};

let elfTex: Partial<Record<ElfId, Texture>> = {};
let shadowTex: Texture | null = null;
let giftTex: Texture | null = null;
const cropped = new Map<ElfId, Texture>();

export async function loadElfArt() {
	const ids = Object.keys(ELF_CUTOUT) as ElfId[];
	const loaded = await Promise.all(ids.map((id) => Assets.load(ELF_CUTOUT[id]) as Promise<Texture>));
	ids.forEach((id, i) => { elfTex[id] = loaded[i]; });
	cropped.clear();
	for (const id of ids) {
		const t = elfTex[id]!;
		const h = Math.max(1, Math.round((t.height || t.orig?.height || 1) * CROP));
		const w = t.width || t.orig?.width || 1;
		const src = t.source, fr = t.frame;
		cropped.set(id, new Texture({ source: src, frame: new Rectangle(fr?.x ?? 0, fr?.y ?? 0, w, Math.min(h, fr?.height ?? h)) }));
	}
	try { shadowTex = await Assets.load('assets/rig/roxy_ground_shadow.webp') as Texture; } catch { shadowTex = null; }
	try {
		const sheet = await Assets.load('sheets/symbols.webp') as Texture;
		const f = FRAMES.L3?.frame;
		giftTex = f ? new Texture({ source: sheet.source, frame: new Rectangle(f.x, f.y, f.w, f.h) }) : sheet;
	} catch { giftTex = null; }
}

function poseElf(id: ElfId, winW: number, winH: number, group: boolean, index: number, n: number) {
	const tex = cropped.get(id) || elfTex[id]; if (!tex) return null;
	const s = new Sprite(tex);
	s.eventMode = 'none';
	const scale = (winH / (CROP * REF_H)) * (group ? 0.78 : 1);
	// Head x is still the original fraction of the full (uncropped) width
	s.anchor.set(HEAD[id][0], 0);
	const spread = group && n > 1 ? (index - (n - 1) / 2) * (winW * 0.18) : 0;
	s.position.set(winW / 2 + spread, 0);
	s.scale.set(scale);
	if (s.height > winH) s.scale.set(scale * (winH / s.height));
	if (s.y + s.height > winH) s.y = Math.max(0, winH - s.height);
	s.zIndex = Z[id] ?? index;
	s.label = 'elf:' + id;
	return s;
}

/** A window `w` x `h` in design px, with the mode's posed, mid-thigh-cropped art inside. */
export function artWindow(mode: string, w: number, h: number) {
	const root = new Container();
	root.label = 'uiArt';
	root.eventMode = 'none';
	// Clip any group-spread overflow without a Pixi mask (a mask + filter pass overflowed the renderer).
	root.boundsArea = new Rectangle(0, 0, w, h);
	const inner = new Container();
	inner.sortableChildren = true;
	inner.eventMode = 'none';
	root.addChild(inner);

	if (mode === 'mystery' || mode === 'ante') {
		if (mode === 'mystery' && giftTex) {
			const g = new Sprite(giftTex);
			g.anchor.set(0.5, 0.55);
			const k = Math.min((w * 0.82) / Math.max(1, g.texture.width), (h * 0.86) / Math.max(1, g.texture.height));
			g.scale.set(k);
			g.position.set(w / 2, h * 0.54);
			g.eventMode = 'none';
			inner.addChild(g);
			try {
				const q = spr('ui', 'badge_q');
				q.anchor.set(0.5);
				q.scale.set((h * 0.28) / Math.max(1, q.texture.height));
				q.position.set(w * 0.74, h * 0.26);
				q.eventMode = 'none';
				inner.addChild(q);
			} catch { /* no badge */ }
		}
		return root;
	}

	const ids = CARD_ELVES[mode] || [];
	const group = ids.length > 1;
	if (shadowTex && ids.length) {
		const sh = new Sprite(shadowTex);
		sh.anchor.set(0.5, 1);
		const sk = Math.min((w * (group ? 0.8 : 0.6)) / Math.max(1, sh.texture.width), (h * 0.22) / Math.max(1, sh.texture.height));
		sh.scale.set(sk, sk * 0.5);
		sh.position.set(w / 2, h - 2);
		sh.alpha = 0.45;
		sh.eventMode = 'none';
		inner.addChild(sh);
	}
	ids.forEach((id, i) => {
		const s = poseElf(id, w, h, group, i, ids.length);
		if (s) inner.addChild(s);
	});
	const clip = new Graphics();
	clip.rect(0, 0, w, h).fill(0xffffff);
	clip.eventMode = 'none';
	root.addChild(clip);
	root.mask = clip;
	return root;
}
