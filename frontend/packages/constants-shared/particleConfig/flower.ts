export default {
	alpha: {
		list: [
			{ value: 0, time: 0 },
			{ value: 1, time: 0.25 },
			{ value: 0, time: 1 },
		],
		isStepped: false,
	},
	color: {
		list: [
			{ value: 'ffffff', time: 0 },
			{ value: '9b77f4', time: 0.5 },
			{ value: 'ffffff', time: 1 },
		],
		isStepped: false,
	},
	scale: {
		start: 0.1,
		end: 0.09,
		minimumScaleMultiplier: 1,
	},
	speed: {
		start: 5,
		end: 1,
		minimumSpeedMultiplier: 1,
	},
	acceleration: {
		x: 0,
		y: -5,
	},
	maxSpeed: 0,
	startRotation: {
		min: 260,
		max: 280,
	},
	noRotation: true,
	rotationSpeed: {
		min: 0,
		max: 0,
	},
	lifetime: {
		min: 5,
		max: 10,
	},
	blendMode: 'normal',
	frequency: 0.65,
	emitterLifetime: -1,
	maxParticles: 50,
	pos: {
		x: 0,
		y: 0,
	},
	addAtBack: false,
	spawnType: 'rect',
	spawnRect: {
		x: 0,
		y: -300,
		w: 300,
		h: 500,
	},
};
