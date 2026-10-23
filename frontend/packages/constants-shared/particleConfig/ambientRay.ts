export default {
	alpha: {
		start: -0.2,
		end: 3,
	},
	scale: {
		start: 0.4,
		end: 0.01,
		minimumScaleMultiplier: 1,
	},
	color: {
		start: '#fee070',
		end: '#fee070',
	},
	speed: {
		start: -10,
		end: 0,
		minimumSpeedMultiplier: 0.3,
	},
	acceleration: {
		x: 1,
		y: 0,
	},
	maxSpeed: 20,
	startRotation: {
		min: 0,
		max: 270,
	},
	noRotation: true,
	rotationSpeed: {
		min: 20,
		max: 0,
	},
	lifetime: {
		min: 15,
		max: 20,
	},
	blendMode: 'normal',
	frequency: 5,
	emitterLifetime: -1,
	maxParticles: 500,
	pos: {
		x: 0,
		y: 0,
	},
	addAtBack: false,
	spawnType: 'rect',
	spawnRect: {
		x: 0,
		y: 0,
		w: 300,
		h: 0,
	},
};
