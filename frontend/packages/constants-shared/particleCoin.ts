export const LEVEL_PARTICLE_COIN_MAP = {
	zero: null,
	standard: null,
	small: null,
	nice: null,
	substantial: {
		speedOption: {
			list: [
				{ value: 300, time: 0 },
				{ value: 400, time: 0 },
			],
		},
		frequency: 0.2,
		emitterLifetime: -1,
		spawnOption: { type: 'rect', spawnRect: { x: -150, y: 0, w: 300, h: 0 } },
	},
	big: {
		speedOption: {
			list: [
				{ value: 650, time: 0 },
				{ value: 700, time: 0 },
			],
		},
		frequency: 0.18,
		emitterLifetime: -1,
		spawnOption: { type: 'rect', spawnRect: { x: -150, y: 0, w: 300, h: 0 } },
	},
	superwin: {
		speedOption: {
			list: [
				{ value: 750, time: 0 },
				{ value: 800, time: 0 },
			],
		},
		frequency: 0.15,
		emitterLifetime: -1,
		spawnOption: { type: 'rect', spawnRect: { x: -200, y: 0, w: 400, h: 0 } },
	},
	mega: {
		speedOption: {
			list: [
				{ value: 850, time: 0 },
				{ value: 900, time: 0 },
			],
		},
		frequency: 0.12,
		emitterLifetime: -1,
		spawnOption: { type: 'rect', spawnRect: { x: -200, y: 0, w: 400, h: 0 } },
	},
	epic: {
		speedOption: {
			list: [
				{ value: 950, time: 0 },
				{ value: 1050, time: 0 },
			],
		},
		frequency: 0.11,
		emitterLifetime: -1,
		spawnOption: { type: 'rect', spawnRect: { x: -250, y: 0, w: 500, h: 0 } },
	},
	max: {
		speedOption: {
			list: [
				{ value: 1100, time: 0 },
				{ value: 1200, time: 0 },
			],
		},
		frequency: 0.1,
		emitterLifetime: -1,
		spawnOption: { type: 'rect', spawnRect: { x: -250, y: 0, w: 500, h: 0 } },
	},
} as const;

export const LEVEL_PARTICLE_COIN_MAP_BURST = {
	standard: null,
	small: null,
	nice: null,
	substantial: {
		speedOption: {
			list: [
				{ value: 450, time: 0 },
				{ value: 550, time: 0 },
			],
		},
		frequency: 0.0625,
		emitterLifetime: 1,
		scaleOption: { list: [{ value: 0.35 }, { value: 0.35 }] },
		spawnOption: { type: 'rect', spawnRect: { x: -150, y: 0, w: 300, h: 0 } },
	},
	big: {
		speedOption: {
			list: [
				{ value: 700, time: 0 },
				{ value: 750, time: 0 },
			],
		},
		frequency: 0.045,
		emitterLifetime: 1,
		scaleOption: { list: [{ value: 0.35 }, { value: 0.35 }] },
		spawnOption: { type: 'rect', spawnRect: { x: -150, y: 0, w: 300, h: 0 } },
	},
	superwin: {
		speedOption: {
			list: [
				{ value: 800, time: 0 },
				{ value: 850, time: 0 },
			],
		},
		frequency: 0.0375,
		emitterLifetime: 1,
		scaleOption: { list: [{ value: 0.35 }, { value: 0.35 }] },
		spawnOption: { type: 'rect', spawnRect: { x: -150, y: 0, w: 300, h: 0 } },
	},
	mega: {
		speedOption: {
			list: [
				{ value: 900, time: 0 },
				{ value: 950, time: 0 },
			],
		},
		frequency: 0.03,
		emitterLifetime: 1,
		scaleOption: { list: [{ value: 0.35 }, { value: 0.35 }] },
		spawnOption: { type: 'rect', spawnRect: { x: -200, y: 0, w: 400, h: 0 } },
	},
	epic: {
		speedOption: {
			list: [
				{ value: 1000, time: 0 },
				{ value: 1100, time: 0 },
			],
		},
		frequency: 0.0275,
		emitterLifetime: 1,
		scaleOption: { list: [{ value: 0.35 }, { value: 0.35 }] },
		spawnOption: { type: 'rect', spawnRect: { x: -200, y: 0, w: 400, h: 0 } },
	},
	max: {
		speedOption: {
			list: [
				{ value: 1150, time: 0 },
				{ value: 1250, time: 0 },
			],
		},
		frequency: 0.02,
		emitterLifetime: 1,
		scaleOption: { list: [{ value: 0.35 }, { value: 0.35 }] },
		spawnOption: { type: 'rect', spawnRect: { x: -225, y: 0, w: 450, h: 0 } },
	},
} as const;
