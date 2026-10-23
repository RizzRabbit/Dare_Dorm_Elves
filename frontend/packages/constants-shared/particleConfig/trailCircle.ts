export default {
	alpha: {
		start: 1,
		end: 0,
	},
	scale: {
		start: 0.2,
		end: 1,
		minimumScaleMultiplier: 1,
	},
	color: {
		start: '#fff3ad',
		end: '#ffb13d',
	},
	speed: {
		start: 30,
		end: 1,
		minimumSpeedMultiplier: 1.03,
	},
	acceleration: {
		x: 0,
		y: 0,
	},
	maxSpeed: 0,
	startRotation: {
		min: 0,
		max: 360,
	},
	noRotation: false,
	rotationSpeed: {
		min: 0,
		max: 0,
	},
	lifetime: {
		min: 1,
		max: 5,
	},
	blendMode: 'add',
	frequency: 0.01,
	emitterLifetime: -1,
	maxParticles: 5000,
	pos: {
		x: 0,
		y: 0,
	},
	addAtBack: false,
	spawnType: 'circle',
	spawnCircle: {
		x: 0,
		y: 0,
		r: 0,
	},
};
