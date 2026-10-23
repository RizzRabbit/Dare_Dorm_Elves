export default {
	alpha: {
		start: 1,
		end: 0,
	},
	scale: {
		start: 0.1,
		end: 0.02,
		minimumScaleMultiplier: 2,
	},
	color: {
		start: '#fffb00',
		end: '#fbff00',
	},
	speed: {
		start: -1,
		end: -1,
		minimumSpeedMultiplier: 1,
	},
	acceleration: {
		x: 0,
		y: 0,
	},
	maxSpeed: 1,
	startRotation: {
		min: 0,
		max: 0,
	},
	noRotation: false,
	rotationSpeed: {
		min: 0,
		max: 0,
	},
	lifetime: {
		min: 1.5,
		max: 1.5,
	},
	blendMode: 'add',
	frequency: 0.001,
	emitterLifetime: 0.5,
	maxParticles: 5000,
	pos: {
		x: 0,
		y: 0,
	},
	addAtBack: false,
	spawnType: 'point',
};
