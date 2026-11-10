// Bone pose for the wild merge. The board mirror rewrites the armature root every frame, so the
// lean lives on the character bones (offset, added on top of the playing idle / win clip).
// `rot` and `hair` are degrees. Positive rot leans the top of the elf toward +x (screen right).
// `slide` is armature-space pixels along x. `squash` is 1 for a full crouch and negative for a stretch.
// Head rotation opposes the body so the face stays readable. Hat poms are hair: the only hat bones
// on these rigs are named pom.

export type RigPose = { rot: number; slide: number; squash: number; hair: number; lift: number };
export const REST_POSE: RigPose = { rot: 0, slide: 0, squash: 0, hair: 0, lift: 0 };

export type BonePart = 'feet' | 'hip' | 'spine' | 'head' | 'hair';

const DEG = Math.PI / 180;

/** Armature root "root" and the ground contacts are not posed: root spins around the texture corner. */
export function bonePart(name: string): BonePart | null {
	const n = name.toLowerCase();
	if (n === 'root' || n === 'ground' || n.endsWith('_ground')) return null;
	if (/hair|pony|pom|bang|tuft|bow|hat|bun/.test(n)) return 'hair';
	if (/head|neck/.test(n)) return 'head';
	if (/chest|spine/.test(n)) return 'spine';
	if (/thigh|pelvis/.test(n)) return 'hip';
	if (/(^|_)root$/.test(n)) return 'feet';
	return null;
}

export type BoneWrite = { x: number; y: number; rot: number; sx: number; sy: number };

/** Local offset for one part. `hasFeet` is false on the single-elf rigs (no character-root bone).
 *  A negative squash is the cheer: the spine arches and the body lifts instead of crouching. */
export function boneWrite(part: BonePart, pose: RigPose, hasFeet: boolean): BoneWrite {
	const rot = pose.rot, sq = pose.squash, lift = pose.lift || 0;
	const arch = sq < 0 ? sq * 14 * DEG : 0;
	if (part === 'feet') return { x: pose.slide, y: lift, rot: rot * 0.75 * DEG, sx: 1 + 0.05 * sq, sy: 1 - 0.14 * sq };
	if (part === 'hip') return { x: hasFeet ? 0 : pose.slide, y: hasFeet ? lift * 0.35 : lift, rot: rot * (hasFeet ? 0.28 : 0.85) * DEG, sx: 1 + 0.08 * sq, sy: 1 - 0.2 * sq };
	if (part === 'spine') return { x: 0, y: 0, rot: rot * 0.32 * DEG + arch, sx: 1 + 0.04 * sq, sy: 1 - 0.1 * sq };
	if (part === 'head') return { x: 0, y: 0, rot: rot * -0.42 * DEG - arch * 0.55, sx: 1, sy: 1 };
	return { x: 0, y: 0, rot: (rot * 0.35 + pose.hair) * DEG, sx: 1, sy: 1 };
}

export function lerpPose(a: RigPose, b: RigPose, u: number): RigPose {
	const t = u < 0 ? 0 : u > 1 ? 1 : u;
	const k = (p: number, q: number) => p + (q - p) * t;
	return { rot: k(a.rot, b.rot), slide: k(a.slide, b.slide), squash: k(a.squash, b.squash), hair: k(a.hair, b.hair), lift: k(a.lift || 0, b.lift || 0) };
}

export type PosableBone = {
	name?: string;
	offset?: { x: number; y: number; rotation: number; scaleX: number; scaleY: number };
	invalidUpdate?: () => void;
};

/** Write the pose onto the bones, or clear it. Unrelated bones are left alone. */
export function applyBonePose(bones: PosableBone[], pose: RigPose | null): void {
	const hasFeet = bones.some((b) => bonePart(String(b.name || '')) === 'feet');
	for (const b of bones) {
		if (!b.offset) continue;
		const part = bonePart(String(b.name || ''));
		if (!part) continue;
		if (!pose) {
			b.offset.rotation = 0; b.offset.x = 0; b.offset.y = 0; b.offset.scaleX = 1; b.offset.scaleY = 1;
		} else {
			const w = boneWrite(part, pose, hasFeet);
			b.offset.rotation = w.rot; b.offset.x = w.x; b.offset.y = w.y; b.offset.scaleX = w.sx; b.offset.scaleY = w.sy;
		}
		b.invalidUpdate?.();
	}
}
