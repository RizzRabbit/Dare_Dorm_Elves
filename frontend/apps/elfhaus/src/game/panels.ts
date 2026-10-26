// v3.13 (James 2026-10-26): shared panel behaviour for the menu (settings + rules), bonus menu, autoplay, the bonus
// confirm card and the message box.
//  - Calm open / close: opacity on the backdrop, opacity + a small translate3d/scale on the card (about 2x slower than
//    the usual 0.25 s UI fade). Reduced motion keeps the fade and drops the movement.
//  - Close: the corner X (.mX), Esc, or a tap / click that starts AND ends on the backdrop outside the card.
//  - Scrolling: no scroll boxes or scrollbars. The card's .mView clips, its .mTrack moves with translate3d: drag with
//    mouse or finger (6 px threshold; a drag never fires the button under it), momentum, a soft rubber band at both
//    ends, mouse wheel, arrow keys, PgUp / PgDn, Home / End. touch-action:none on the view keeps the Stake iframe's
//    page from scrolling under it.
const OPEN_MS = 520, CLOSE_MS = 460, DRAG_PX = 6;
const reduced = () => matchMedia?.('(prefers-reduced-motion: reduce)').matches;

class Scroller {
	y = 0; max = 0; vel = 0; target: number | null = null;
	private raf = 0; private last = 0;
	private pid: number | null = null; private startY = 0; private startOff = 0; private dragging = false;
	private samples: { t: number; y: number }[] = []; private suppress = false;
	private edge = '';
	constructor(public view: HTMLElement, public track: HTMLElement) {
		view.addEventListener('pointerdown', (e) => this.down(e));
		view.addEventListener('pointermove', (e) => this.move(e));
		view.addEventListener('pointerup', (e) => this.up(e));
		view.addEventListener('pointercancel', (e) => this.up(e));
		// target check: taking capture from a touch's implicit capture fires lostpointercapture on the inner element, and it
		// bubbles here; only the view's own loss ends the drag (v3.15b: touch drags were cut off at the 6 px threshold)
		view.addEventListener('lostpointercapture', (e) => { if (e.target === view && this.dragging && e.pointerId === this.pid) this.up(e); });
		// a drag past the threshold swallows the click that follows it (capture: before any button's own handler)
		view.addEventListener('click', (e) => { if (this.suppress) { this.suppress = false; e.stopPropagation(); e.preventDefault(); } }, true);
		view.addEventListener('wheel', (e) => {
			e.preventDefault(); e.stopPropagation();
			const k = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? view.clientHeight : 1;
			this.by(e.deltaY * k);
		}, { passive: false });
		// keyboard focus (Tab) into a clipped row: browsers scroll overflow:hidden boxes natively; undo that and bring
		// the row into view with the transform instead
		view.addEventListener('scroll', () => { view.scrollTop = 0; });
		view.addEventListener('focusin', (e) => this.reveal(e.target as HTMLElement));
		if ('ResizeObserver' in window) { const ro = new ResizeObserver(() => this.measure()); ro.observe(view); ro.observe(track); }
		view.addEventListener('dragstart', (e) => e.preventDefault());
	}
	/** screen px per local px (the stage transform, plus the modal zoom on small landscape screens) */
	private scale() { const h = this.view.offsetHeight; return h ? this.view.getBoundingClientRect().height / h || 1 : 1; }
	measure() {
		this.max = Math.max(0, this.track.offsetHeight - this.view.clientHeight);
		this.view.classList.toggle('scrolls', this.max > 0.5);
		if (!this.raf && !this.dragging && (this.y > this.max || this.y < 0)) this.anim();
		this.paint();
	}
	reset() { this.stop(); this.y = 0; this.vel = 0; this.target = null; this.measure(); }
	private paint() {
		this.track.style.transform = `translate3d(0,${(-this.y).toFixed(2)}px,0)`;
		const e = (this.y > 1 ? 'u' : '') + (this.y < this.max - 1 ? 'd' : '');
		if (e !== this.edge) { this.edge = e; this.view.classList.toggle('atTop', !e.includes('u')); this.view.classList.toggle('atEnd', !e.includes('d')); }
	}
	private rubber(raw: number) {
		const d = Math.max(120, this.view.clientHeight * 0.5), over = (x: number) => (1 - 1 / ((x * 0.55) / d + 1)) * d;
		return raw < 0 ? -over(-raw) : raw > this.max ? this.max + over(raw - this.max) : raw;
	}
	private down(e: PointerEvent) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		if ((e.target as Element).closest('input,textarea,select')) return;
		this.stop(); this.target = null; this.vel = 0;
		this.pid = e.pointerId; this.startY = e.clientY; this.startOff = this.y; this.dragging = false;
		this.samples = [{ t: performance.now(), y: this.y }];
	}
	private move(e: PointerEvent) {
		if (e.pointerId !== this.pid) return;
		const s = this.scale(), dy = (e.clientY - this.startY) / s;
		if (!this.dragging) {
			if (Math.abs(dy) < DRAG_PX) return;
			this.dragging = true; this.startY = e.clientY; this.startOff = this.y; // rebase: no 6 px jump
			try { this.view.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
			this.view.classList.add('dragging');
			return;
		}
		e.preventDefault();
		this.y = this.rubber(this.startOff - dy); this.paint();
		const t = performance.now(); this.samples.push({ t, y: this.y });
		while (this.samples.length > 2 && t - this.samples[0].t > 100) this.samples.shift();
	}
	private up(e: PointerEvent) {
		if (e.pointerId !== this.pid) return;
		this.pid = null;
		if (!this.dragging) return;
		this.dragging = false; this.view.classList.remove('dragging');
		this.suppress = true; setTimeout(() => (this.suppress = false), 0);
		const a = this.samples[0], b = this.samples[this.samples.length - 1], dt = b.t - a.t;
		this.vel = dt > 8 && performance.now() - b.t < 80 ? Math.max(-3.5, Math.min(3.5, (b.y - a.y) / dt)) : 0;
		if (this.y < 0 || this.y > this.max) this.vel *= 0.3;
		this.anim();
	}
	/** wheel / keys: glide toward a clamped target */
	by(d: number) { this.vel = 0; this.target = Math.max(0, Math.min(this.max, (this.target ?? this.y) + d)); this.anim(); }
	to(y: number) { this.vel = 0; this.target = Math.max(0, Math.min(this.max, y)); this.anim(); }
	page(dir: number) { this.by(dir * this.view.clientHeight * 0.85); }
	reveal(el: HTMLElement) {
		if (!el || el === this.view || !this.track.contains(el)) return;
		const s = this.scale(), v = this.view.getBoundingClientRect(), r = el.getBoundingClientRect();
		const top = (r.top - v.top) / s, bot = (r.bottom - v.top) / s, h = this.view.clientHeight, pad = 16;
		if (top < pad) this.to(this.y + top - pad); else if (bot > h - pad) this.to(this.y + bot - h + pad);
	}
	private stop() { cancelAnimationFrame(this.raf); this.raf = 0; }
	private anim() {
		if (this.raf) return;
		this.last = performance.now();
		const step = (now: number) => {
			const dt = Math.min(34, now - this.last); this.last = now;
			let done = false;
			if (this.target !== null) {
				// calm glide: time constant 110 ms (wheel / keys)
				this.y += (this.target - this.y) * (1 - Math.exp(-dt / 110));
				if (Math.abs(this.target - this.y) < 0.3) { this.y = this.target; this.target = null; done = true; }
			} else {
				const out = this.y < 0 ? 0 : this.y > this.max ? this.max : null;
				if (out === null) {
					this.y += this.vel * dt; this.vel *= Math.exp(-dt / 360); // momentum, gentle decay
					if (this.y < 0 || this.y > this.max) this.vel *= 0.5;      // ran into an end: lose most of it
					if (Math.abs(this.vel) < 0.01) { this.vel = 0; done = this.y >= 0 && this.y <= this.max; }
				} else {
					this.y += this.vel * dt; this.vel *= Math.exp(-dt / 40);
					this.y += (out - this.y) * (1 - Math.exp(-dt / 130));     // soft rubber band back (~0.5 s)
					if (Math.abs(out - this.y) < 0.3 && Math.abs(this.vel) < 0.02) { this.y = out; this.vel = 0; done = true; }
				}
			}
			this.paint();
			this.raf = done ? 0 : requestAnimationFrame(step);
		};
		this.raf = requestAnimationFrame(step);
	}
}

type Panel = { el: HTMLElement; scroller: Scroller | null; onClose?: () => void; timer?: ReturnType<typeof setTimeout>; downOut: boolean; closable: boolean };
const panels = new Map<string, Panel>();
const order: string[] = []; // open panels, oldest first (Esc / keys go to the last)

export function registerPanel(sel: string, opts: { onClose?: () => void; closable?: boolean } = {}) {
	const el = document.querySelector(sel) as HTMLElement;
	const view = el.querySelector<HTMLElement>('.mView'), track = view?.querySelector<HTMLElement>('.mTrack');
	const p: Panel = { el, scroller: view && track ? new Scroller(view, track) : null, onClose: opts.onClose, downOut: false, closable: opts.closable !== false };
	panels.set(sel, p);
	el.querySelectorAll<HTMLElement>('.mX').forEach((b) => b.addEventListener('click', () => closePanel(sel)));
	// backdrop: only a tap that started on the backdrop closes (a drag that ends outside the card does not)
	// v3.13e (FSD M2): a closing panel stays hit-testable and swallows every click until it is hidden, so a quick
	// second tap neither falls through to the menu underneath nor reaches the panel's own controls
	el.addEventListener('click', (e) => { if (el.classList.contains('pOut')) { e.stopImmediatePropagation(); e.stopPropagation(); e.preventDefault(); } }, true);
	el.addEventListener('pointerdown', (e) => { p.downOut = e.target === el; });
	el.addEventListener('click', (e) => { if (p.closable && e.target === el && p.downOut) closePanel(sel); p.downOut = false; });
	el.addEventListener('wheel', (e) => e.preventDefault(), { passive: false }); // no page scroll bleed in the iframe
	el.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
}
export const isOpen = (sel: string) => { const p = panels.get(sel); return !!p && !p.el.classList.contains('hidden') && !p.el.classList.contains('pOut'); };
export const anyOpen = () => order.length > 0;
export function openPanel(sel: string) {
	const p = panels.get(sel); if (!p) return;
	clearTimeout(p.timer);
	const was = isOpen(sel);
	p.el.classList.remove('hidden', 'pOut');
	if (!was) { void p.el.offsetWidth; p.el.classList.add('pIn'); p.scroller?.reset(); }
	const i = order.indexOf(sel); if (i >= 0) order.splice(i, 1); order.push(sel);
	requestAnimationFrame(() => p.scroller?.measure());
}
/** silent: skip the panel's onClose hook (a programmatic close, e.g. after a confirm). */
export function closePanel(sel: string, silent = false) {
	const p = panels.get(sel); if (!p || !isOpen(sel)) return;
	const i = order.indexOf(sel); if (i >= 0) order.splice(i, 1);
	p.el.classList.remove('pIn'); p.el.classList.add('pOut');
	if (!silent) p.onClose?.();
	p.timer = setTimeout(() => { p.el.classList.add('hidden'); p.el.classList.remove('pOut'); }, reduced() ? CLOSE_MS * 0.6 : CLOSE_MS);
}
export function measurePanel(sel: string) { panels.get(sel)?.scroller?.measure(); }

addEventListener('keydown', (e) => {
	const sel = order[order.length - 1]; if (!sel) return;
	const p = panels.get(sel)!;
	if (e.key === 'Escape') { if (p.closable) { e.preventDefault(); closePanel(sel); } return; }
	if ((e.target as Element)?.closest?.('input,textarea,select')) return;
	const s = p.scroller; if (!s) return;
	const k = e.key;
	if (k === 'ArrowDown') s.by(60); else if (k === 'ArrowUp') s.by(-60);
	else if (k === 'PageDown') s.page(1); else if (k === 'PageUp') s.page(-1);
	else if (k === 'Home') s.to(0); else if (k === 'End') s.to(s.max);
	else return;
	e.preventDefault();
});
// taps on the letterbox bars around the scaled stage count as outside the top panel too
const bare = (t: EventTarget | null) => t === document.body || t === document.documentElement;
let bareDown = false;
addEventListener('pointerdown', (e) => { bareDown = bare(e.target); });
addEventListener('click', (e) => {
	const sel = order[order.length - 1];
	if (sel && bareDown && bare(e.target) && panels.get(sel)!.closable) closePanel(sel);
	bareDown = false;
});
export const PANEL_MS = { open: OPEN_MS, close: CLOSE_MS };
