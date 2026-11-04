// GSAP timelines for the sign entrances (bonus intro card, more-spins card, total-win card, big-win title): one timeline
// per show, transform / opacity only on painted sprites, cleared at the end so the CSS states take over again.
// Reduced motion: no timeline (the sign just shows).
import { gsap } from 'gsap';
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const live = new WeakMap<HTMLElement, gsap.core.Timeline>();
function enter(ov: HTMLElement) {
	if (reduced()) return;
	const card = ov.querySelector<HTMLElement>('.card, .bw'), fx = ov.querySelector<HTMLElement>('.bwFx');
	if (!card) return;
	live.get(ov)?.kill();
	const tl = gsap.timeline({ onComplete: () => gsap.set([card, fx].filter(Boolean), { clearProps: 'transform,opacity' }) });
	if (fx) tl.fromTo(fx, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out' }, 0);
	tl.fromTo(card, { opacity: 0, scale: 0.82, y: 40 }, { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'back.out(1.9)' }, 0.05);
	const kids = card.querySelectorAll<HTMLElement>('.tierName, .spins, .otAmt, .fmBig, .bwTier, .bwAmt, .cont');
	if (kids.length) tl.from(kids, { opacity: 0, y: 14, duration: 0.3, stagger: 0.07, ease: 'power2.out', clearProps: 'transform,opacity' }, 0.25);
	live.set(ov, tl);
}
/** watch the sign overlays: a timeline plays each time one goes from hidden to shown */
export function initTimelines() {
	for (const id of ['intro', 'fsMore', 'outro', 'bigwin']) {
		const ov = document.getElementById(id); if (!ov) continue;
		let was = ov.classList.contains('hidden');
		new MutationObserver(() => { const h = ov.classList.contains('hidden'); if (was && !h) enter(ov); was = h; }).observe(ov, { attributes: true, attributeFilter: ['class'] });
	}
}
