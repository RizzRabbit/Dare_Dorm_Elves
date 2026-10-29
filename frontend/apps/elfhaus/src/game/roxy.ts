// Roxy facade for the game flow (bookEventHandlerMap / game.ts). The figure itself is the swappable rig adapter in ./roxyrig
// (v6 cutout rig now, v7 later: swap the one export in roxyrig/index.ts), drawn by the Pixi room layer (scene/scene.ts).
// Game states map onto adapter calls: idle -> idle(), anticipation -> anticipate(true), excited -> win() (hop),
// disappointed -> disappointed() (one sigh). One-shots fall back to idle by themselves, as before.
// The old keyed roxy_full_* frame sheets (static/assets/atlases) are no longer loaded.
import { initScene, placeScene, rig } from './scene/scene';
export type RoxyState = 'idle' | 'anticipation' | 'disappointed' | 'excited';
let want: RoxyState = 'idle', back: ReturnType<typeof setTimeout> | null = null;
/** rig source box (kept for callers that size against it) */
export let roxySize = { w: 0, h: 0 };
export function roxyMem() { return { MB: 0, by: {} as Record<string, number> }; }
(window as any).__roxyMem = roxyMem;
export function placeRoxy(portrait: boolean, frameRect: DOMRect) { placeScene(portrait, frameRect); }
/** Starts the room + Roxy; onReady once she can show (layout reserves her space from then on). */
export async function initRoxy(onReady: () => void) {
	const ok = await initScene();
	if (!ok || !rig) return;
	roxySize = { w: rig.srcW, h: rig.srcH };
	document.body.classList.add('hasRoxy'); onReady();
}
export function roxy(s: RoxyState) {
	const r = rig; want = s; if (back) { clearTimeout(back); back = null; }
	if (!r) return;
	r.anticipate(s === 'anticipation');
	if (s === 'excited') { r.win(); back = setTimeout(() => { if (want === 'excited') want = 'idle'; }, 1250); }
	else if (s === 'disappointed') { r.disappointed(); back = setTimeout(() => { if (want === 'disappointed') want = 'idle'; }, 1600); }
	else if (s === 'idle') r.idle();
}
export const roxyState = () => want;
