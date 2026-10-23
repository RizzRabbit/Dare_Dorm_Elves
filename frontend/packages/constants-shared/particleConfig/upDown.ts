export default {
	alpha: {
		start: 1,
		end: 1,
	},
	scale: {
		start: 0.4,
		end: 0.4,
		minimumScaleMultiplier: 1,
	},
	color: {
		start: '#e6e6e6',
		end: '#ffffff',
	},
	speed: {
		start: 10,
		end: 10,
		minimumSpeedMultiplier: 1,
	},
	acceleration: {
		x: 0,
		y: 60,
	},
	maxSpeed: 0,
	startRotation: {
		min: 230,
		max: 310,
	},
	noRotation: false,
	rotationSpeed: {
		min: 75,
		max: 150,
	},
	lifetime: {
		min: 1,
		max: 4,
	},
	blendMode: 'normal',
	frequency: 0.1,
	emitterLifetime: -1,
	maxParticles: 100,
	pos: {
		x: 0,
		y: 0,
	},
	addAtBack: false,
	spawnType: 'rect',
	spawnRect: {
		x: -250,
		y: -100,
		w: 500,
		h: 0,
	},
};
