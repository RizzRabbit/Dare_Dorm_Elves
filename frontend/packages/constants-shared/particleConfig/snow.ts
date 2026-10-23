export default {
	alpha: {
		start: 1,
		end: 0.34,
	},
	scale: {
		start: 0.1,
		end: 0.35,
		minimumScaleMultiplier: 0.1,
	},
	color: {
		start: '#ffffff',
		end: '#ffffff',
	},
	speed: {
		start: 0,
		end: 1,
		minimumSpeedMultiplier: 1,
	},
	acceleration: {
		x: 0,
		y: 3,
	},
	maxSpeed: 0,
	startRotation: {
		min: 0,
		max: 0,
	},
	noRotation: false,
	rotationSpeed: {
		min: 50,
		max: 100,
	},
	lifetime: {
		min: 21,
		max: 40,
	},
	blendMode: 'screen',
	frequency: 0.4,
	emitterLifetime: -1,
	maxParticles: 50,
	pos: {
		x: 0,
		y: 0,
	},
	addAtBack: false,
	spawnType: 'rect',
	spawnRect: {
		x: -500,
		y: 0,
		w: 1000,
		h: 0,
	},
};
