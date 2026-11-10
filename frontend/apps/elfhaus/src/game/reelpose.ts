// Spin-slot poses written by reels.ts (closed-form motion) and read by the board Pixi mirror.
// No CSS transform / translate3d is used for the visual: the mirror moves Pixi containers from these numbers.
export type SlotPose = { y: number; sy?: number };
const poses = new WeakMap<Element, SlotPose>();
let moving = 0;

export function setSlotPose(el: Element, y: number, sy = 1) {
	poses.set(el, { y, sy });
}
export function slotPose(el: Element): SlotPose | undefined {
	return poses.get(el);
}
export function clearSlotPose(el: Element) {
	if (poses.has(el)) poses.delete(el);
}
export function setReelMoving(on: boolean) {
	moving = on ? 1 : 0;
}
export const reelMoving = () => moving > 0;
