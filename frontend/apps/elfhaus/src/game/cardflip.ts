// Ski Pass flip (cardFlip event: 5 scatters on a base / ante / Secret Santa board). The pass lifts with a squash,
// turns over in 3D and shows the outcome on the Pixi UI stage. Tap skips the hold. Timing matches the previous
// presentation (360 ms lift, 260/80 wait, 320 ms wobble, 560 ms flip, name pop, 1700/900 hold, 250 ms out; turbo 0.45×).
import { $, S, wait } from './ui';
import { uiPixiOn, playCardFlip } from './pixiui';

export async function cardFlip(result: 'triple_dare' | 'hidden') {
	if (uiPixiOn()) {
		await playCardFlip(result);
		return;
	}
	const O = $('#cardFlip');
	O.dataset.tier = result;
	O.classList.remove('hidden');
	await wait(S.turbo ? 900 : 2200);
	O.classList.add('hidden');
}
