// Roxy adapter contract. The game, the foyer scene and the intro only talk to Roxy through this interface, so a new rig
// (v7) drops in by swapping ONE module: src/game/roxy/index.ts re-exports `createRoxy` from the current rig file.
// Everything is transforms / opacity / hard face swaps on painted layers (no video, no mesh warps).
import type { Container, Point } from 'pixi.js';

export type RoxyFace = 'half' | 'closed' | 'wink' | 'surprised' | 'lookL' | 'lookR';
export type Pt = { x: number; y: number };
/** Scene lighting for the grade filter, in the Pixi stage's global units (design px). */
export type RoxyGrade = {
	on?: boolean;
	k?: number;            // strength 0..1
	keys?: Pt[];           // wall sconces: the one nearest her on screen is the key light
	cool?: Pt | null;      // back rim source (lit arch behind her)
	cut?: number;          // portrait: board-cut row as a fraction of her source frame height (-1 = none)
	res?: number;          // renderer resolution (rim width in texels)
};
export interface RoxyAdapter {
	/** placed by the scene: origin between her feet, on the floor line; scale 1 = source px */
	readonly view: Container;
	/** source frame (px at scale 1) */
	readonly srcW: number;
	readonly srcH: number;
	/** visible figure height and figure-centre offset at scale 1 (px) */
	readonly height: number;
	readonly offsetX: number;
	/** source rows used by layouts: idle head top, hop peak, hips (portrait board cut) */
	readonly rows: { headTop: number; hopTop: number; hips: number };
	update(dt: number): void;
	idle(): void;                       // back to the calm idle loop
	hop(): void;                        // one snappy win hop
	win(): void;                        // win reaction (hop + happy face)
	surprised(on: boolean): void;       // wide-eyed face pop (eases back through a blink)
	anticipate(on: boolean): void;      // tense lean + eyes toward the board
	disappointed(): void;               // short sigh, half-lidded, then idle
	doorReach(on: boolean, aimDeg?: number): void;   // intro: door-reach arm on the handle (+ lean)
	doorPts(): { sh: Point; hand: Point; r: number } | null;
	face(name: RoxyFace, k: number): void;           // painted face variant on (k >= 0.5) / off
	release(): void;                    // hand back to idle after the intro
	setGrade(g: RoxyGrade): void;
	shadow(on: boolean): void;          // cast + contact shadow (landscape floor); off in the portrait peek
	destroy(): void;
}
export type RoxyFactory = () => Promise<RoxyAdapter>;
