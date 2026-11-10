// Draw-order constants for the Pixi room, board stage, puff FX and in-document canvas hosts.
// Game chrome (board, HUD, overlays) is drawn in Pixi; the live document only holds layout shells and canvases.
export const PZ = { room: 0, roxy: 10, roomNear: 20, roomFx: 30 } as const;
export const FZ = { swell: 0, powder: 10, flakes: 20, glitter: 30 } as const;
export const BZ = { strips: 0, reelLines: 1, cells: 2, cellWin: 3, overlays: 4, lines: 6, badges: 8 } as const;
export const FRZ = { frameBack: -1, frameLit: 2, fx: 3, board: 4, garland: 5 } as const;
export const SZ = { frame: 1, respins: 5, fsBar: 6, toast: 7, banner: 8 } as const;
export const AZ = { stage: 2, hud: 6, top: 7 } as const;
export const TZ = { replayBar: 40, hud: 42, popMenu: 45, modal: 50, confirm: 60, resume: 65, maxwin: 70, msg: 70, introCv: 199, loader: 200 } as const;

const rules: [string, number][] = [
	['#scene', 0],
	['#app>#stage', AZ.stage], ['#app>#hud', AZ.hud], ['#app>#top', AZ.top],
	['#stage>#boardStage', FRZ.fx],
	['#uiStage', TZ.hud],
	['#introCv', TZ.introCv], ['#loader', TZ.loader],
];
/** Inject the map once (the first call wins; safe to call again). */
export function applyLayers() {
	if (document.getElementById('layerMap')) return;
	const css = rules.map(([s, z]) => `html body ${s}{z-index:${z}!important}`).join('\n');
	const st = document.createElement('style'); st.id = 'layerMap'; st.textContent = css; document.head.appendChild(st);
}
