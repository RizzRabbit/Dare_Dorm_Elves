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
		y: -7,
	},
	maxSpeed: 0,
	startRotation: {
		min: 0,
		max: 0,
	},
	noRotation: false,
	rotationSpeed: {
		min: 0,
		max: 10,
	},
	lifetime: {
		min: 21,
		max: 20,
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
		x: -250,
		y: 1,
		w: 500,
		h: 0,
	},
};
