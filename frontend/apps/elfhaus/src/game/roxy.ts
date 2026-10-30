// Roxy facade for the game flow (bookEventHandlerMap / game.ts). The figure itself is the swappable rig adapter in ./roxyrig
// (v7 lightweight rig: swap the one export in roxyrig/index.ts), drawn by the Pixi room layer (scene/scene.ts).
// Game states map onto adapter calls: idle -> idle(), anticipation -> anticipate(true) ("ooh" face + lean),
// excited (bonus / feature hit) -> win('bonus') (excited face + hip shake), win (big win) -> win('win') (smile + wink + hip shake),
// disappointed (tease that missed) -> disappointed() (v7: just eases back to idle). One-shots fall back to idle by themselves.
// The old keyed roxy_full_* frame sheets (static/assets/atlases) are no longer loaded.
import { initScene, placeScene, rig } from './scene/scene';
export type RoxyState = 'idle' | 'anticipation' | 'disappointed' | 'excited' | 'win';
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
	// react first, then drop the anticipation hold, so the rig can tell a tease that hit from a cold win
	if (s === 'excited' || s === 'win') { r.win(s === 'excited' ? 'bonus' : 'win'); back = setTimeout(() => { if (want === s) want = 'idle'; }, 1250); }
	r.anticipate(s === 'anticipation');
	if (s === 'disappointed') { r.disappointed(); back = setTimeout(() => { if (want === 'disappointed') want = 'idle'; }, 1600); }
	else if (s === 'idle') r.idle();
}
export const roxyState = () => want;
