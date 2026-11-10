// fix6 #25 LAYER MAP: the one source of truth for draw order (James 2026-11-04 "you're setting x,y but forgetting z").
// The game is a DOM column (#app) over ONE Pixi room canvas (#scene, behind #app), plus the Pixi FX canvas (#fxStage, the
// pop + snow puff) inside #board above the symbols, the DragonBones stack canvases inside each .ov and the intro canvas.
// Every z below is applied from here: DOM ids / classes get a generated <style> (id-weight + !important so no older sheet
// wins), Pixi containers get .zIndex with sortableChildren on their parent. Nothing depends on addChild / DOM order.
// Masks: only #board clips, and only while a reel cell spins (#board:has(.cell.spinning)); at rest nothing clips a symbol's head, a
// badge, a banner or the FX (see /workspace/elfhaus-review/fix6/LAYER_MAP.md).

/** Pixi: the room stage (#scene). */
export const PZ = { room: 0, roxy: 10, roomNear: 20, roomFx: 30 } as const;
/** Pixi: the puff FX container (puff.ts puffLayer; #fxStage in #frame for now, the unified board stage later). */
export const FZ = { swell: 0, powder: 10, flakes: 20, glitter: 30 } as const;
/** DOM: inside #board (one stacking context; #board itself sits in #frame). */
export const BZ = { strips: 0, reelLines: 1, cells: 2, cellWin: 3, overlays: 4, lines: 6, badges: 8 } as const;
/** DOM: inside #frame. */
// fix7: the board stage (fx) sits ABOVE the fire light / glint (frameLit): its front lip and RESPINS pill cover the
// sweep on the bottom rail, so the glint never crosses the pill (it still runs over the top and side timber); the
// garland stays above everything
// fix8: the symbols are drawn by the board stage (fx); the DOM #board above it is only the invisible state model plus
// the merge's DOM flashes (bloom, rings, burst columns), which belong over the symbols
export const FRZ = { frameBack: -1, frameLit: 2, fx: 3, board: 4, garland: 5 } as const;
/** DOM: inside #stage (over the frame). */
export const SZ = { frame: 1, respins: 5, fsBar: 6, toast: 7, banner: 8 } as const;
/** DOM: #app column. */
export const AZ = { stage: 2, hud: 6, top: 7 } as const;
/** DOM: full-screen layers (body / #root level). */
export const TZ = { replayBar: 40, hud: 42, popMenu: 45, modal: 50, confirm: 60, resume: 65, maxwin: 70, msg: 70, introCv: 199, loader: 200 } as const;

const rules: [string, number][] = [
	['#board>#strips', BZ.strips], ['#board>#reelLines', BZ.reelLines], ['#board>#cells', BZ.cells], ['#cells>.cell.win', BZ.cellWin],
	['#board>#overlays', BZ.overlays], ['#frame>#boardStage', FRZ.fx],
	['#frame>#mkFrame', FRZ.frameBack], ['#frame>#board', FRZ.board], ['#frame>#frameLit', FRZ.frameLit], ['#frame>#frameGlint', FRZ.frameLit], ['#frame>#mkGarland', FRZ.garland],
	['#stage>#frame', SZ.frame], ['#stage>#fsBar', SZ.fsBar], ['#stage>#stepToast', SZ.toast], ['#stage>#banner', SZ.banner],
	['#app>#stage', AZ.stage], ['#app>#hud', AZ.hud], ['#app>#top', AZ.top],
	['#uiStage', TZ.hud], ['#replayBar', TZ.replayBar], ['#popMenu', TZ.popMenu], ['#buyMenu', TZ.modal], ['#autoMenu', TZ.modal], ['#settings', TZ.modal], ['#menu', TZ.modal],
	['#intro', TZ.modal], ['#outro', TZ.modal], ['#fsMore', TZ.modal], ['#bigwin', TZ.modal], ['#cardFlip', TZ.modal], ['#bmConfirm', TZ.confirm],
	['#resumeCard', TZ.resume], ['#maxwin', TZ.maxwin], ['#msg', TZ.msg], ['#introCv', TZ.introCv], ['#loader', TZ.loader],
];
/** Inject the map once (the first call wins; safe to call again). */
export function applyLayers() {
	if (document.getElementById('layerMap')) return;
	const css = rules.map(([s, z]) => `html body ${s}{z-index:${z}!important}`).join('\n')
		// the multiplier badge is the top board layer: over its own symbol, the overlays and the lines
		+ `\nhtml body #board .mx{z-index:${BZ.badges}!important}`
		// at rest a symbol's art (a wild's bust, a pop swell) is never cropped by its cell; the board clips only while spinning
		+ `\nhtml body #cells .cell>.sym{overflow:visible!important}`
		// fix8: nothing in the DOM board clips any more (the spinner windows are Pixi masks, only while a cell spins)
		+ `\nhtml body #frame>#board{overflow:visible!important}`
		// fix8: #strips / #cells / #overlays are the state + motion model only; the board stage draws them
		+ `\nhtml body.pixiBoard #board>:is(#strips,#cells,#overlays){opacity:0!important}`
		// fix8: the free-spins bar is drawn in the board stage's banners layer (board/banners.ts); its DOM box only places it
		+ `\nhtml body.pixiBoard #fsBar{visibility:hidden!important}`
		// fix8: the frame back, fire light and glint are drawn in the board stage frameBack layer (filter, not opacity: the mirror reads their own opacity)
		+ `\nhtml body.pixiBoard #frame>:is(#mkFrame,#frameLit,#frameGlint){filter:opacity(0)!important}`;
	const st = document.createElement('style'); st.id = 'layerMap'; st.textContent = css; document.head.appendChild(st);
}
