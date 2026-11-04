// Roxy adapter contract. The game, the foyer scene and the intro only talk to Roxy through this interface, so a new rig
// drops in by swapping ONE module: src/game/roxyrig/index.ts re-exports `createRoxy` from the current rig file.
// Everything is code tweens / hard face swaps on whole painted generations (no video).
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
	win(kind?: 'bonus' | 'win'): void; // win reaction: 'bonus' = excited face, 'win' = smile + wink (v7: both with a small hip shake)
	surprised(on: boolean): void;       // wide-eyed face pop (eases back through a blink)
	anticipate(on: boolean): void;      // tense lean + eyes toward the board
	disappointed(): void;               // tease that missed (v7: ease straight back to idle, no face)
	doorReach(on: boolean, aimDeg?: number, reachK?: number): void;   // intro: door-reach arm on the handle (+ lean)
	doorPts(): { sh: Point; hand: Point; r: number; k?: number } | null;
	face(name: RoxyFace, k: number): void;           // painted face variant on (k >= 0.5) / off
	release(): void;                    // hand back to idle after the intro
	setGrade(g: RoxyGrade): void;
	/** free-spins party light, 0 = base look (untouched) .. 1 = full; side = which way the party light comes from (-1 left, 1 right) */
	setParty?(k: number, side?: number): void;
	shadow(on: boolean): void;          // cast + contact shadow (landscape floor); off in the portrait peek
	/** v8 mouth variants (optional per rig): a wider smile held for `sec`, a talking mouth for `sec` (0 = stop) */
	smile?(sec?: number): void;
	talk?(sec: number): void;
	destroy(): void;
}
export type RoxyFactory = () => Promise<RoxyAdapter>;
