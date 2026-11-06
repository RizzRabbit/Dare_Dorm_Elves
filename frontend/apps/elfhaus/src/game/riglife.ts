// Pure helpers for the board DragonBones lifecycle (dbstacks.ts). No Pixi imports: the node regression
// test imports this file directly.
//
// buildArmatureDisplay() puts every armature on the DragonBones world clock, and dispose() only *buffers*
// it. The buffer is flushed by DragonBones.advanceTime, which this game never calls (useSharedTicker is
// false; Roxy and the stacks advance their own armatures). Without an explicit advanceTime(0) flush, every
// stack / merge / bonus re-render keeps the previous armature (bones, slots, meshes) for the rest of the
// session. That growth, plus the atlas textures that were never released, is what exhausts mobile Safari.

export type ArmLike = { armature?: { dispose(): void } | null };

/** Dispose every armature and flush the factory buffer. `flush` must be PixiFactory.advanceTime; the dt is 0 so Roxy (also on the clock) is not ticked. */
export function releaseArmatures(arms: readonly ArmLike[], flush: (dt: number) => void) {
	for (const d of arms) {
		try { d.armature?.dispose(); } catch { /* one broken rig must not pin the others on the clock */ }
	}
	try { flush(0); } catch { /* caller records a flush failure; the round math is untouched */ }
}

/**
 * Device pixels for a one-shot extract (merge lean snapshot, intro card still).
 * The old merge snapshot capped only the height (`min(2, 1024 / H)`), so a wide group AABB rendered
 * past the WebGL max texture size (iOS often 4096) and lost the context. Height stays on that 1024px
 * budget; width is capped at 2048 as well. Never raises the resolution of a snapshot that was already small.
 */
export function snapshotPixels(w: number, h: number, capH = 1024, capW = 2048) {
	const W = Math.max(1, w), H = Math.max(1, h);
	const r = Math.min(2, capH / H, capW / W);
	return { r, w: Math.max(1, Math.floor(W * r)), h: Math.max(1, Math.floor(H * r)) };
}

/** Intro / card stills were already capped at resolution 1 and 900px tall. Same width guard. */
export function stillResolution(w: number, h: number) {
	const W = Math.max(1, w), H = Math.max(1, h);
	return Math.min(1, 900 / H, 2048 / W);
}

export type RigCache = {
	begin(name: string): void;
	/** Load finished. True = nobody is holding it and the caller should evict. */
	end(name: string): boolean;
	pin(name: string): void;
	/** Last pin dropped and no load is in flight. True = evict. */
	unpin(name: string): boolean;
	pinned(name: string): number;
	busy(name: string): boolean;
};

/** Refcount of rigs on screen plus in-flight loads. Evict only when both are clear, so a re-render that pins the replacement before the old one stops does not unload a texture it is about to reuse. */
export function createRigCache(): RigCache {
	const pins = new Map<string, number>();
	const pending = new Set<string>();
	return {
		begin(name) { pending.add(name); },
		end(name) { pending.delete(name); return !pins.has(name); },
		pin(name) { pins.set(name, (pins.get(name) || 0) + 1); },
		unpin(name) {
			const n = (pins.get(name) || 1) - 1;
			if (n > 0) { pins.set(name, n); return false; }
			pins.delete(name);
			return !pending.has(name);
		},
		pinned: (name) => pins.get(name) || 0,
		busy: (name) => pins.has(name) || pending.has(name),
	};
}
