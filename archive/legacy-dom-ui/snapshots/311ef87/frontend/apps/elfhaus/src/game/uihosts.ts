/*
 * ARCHIVED snapshot.
 * Source commit: 311ef87 (tag pre-layout-rebuild is 311ef87).
 * Original path: frontend/apps/elfhaus/src/game/uihosts.ts
 * See archive/legacy-dom-ui/README.md. Not imported by the game.
 * Replaced by: Plain TS HUD / board / overlay state. Geometry from layout.ts. #uiHostTree is retired once that state exists.
 */
// TypeScript UI host tree for chrome that used to live as Game.svelte markup.
// The nodes are never attached to the document (so they never paint); game.ts
// still reads/writes classes, text, values and listeners through the usual
// querySelector / getElementById / $ paths. Layout boxes come from mkPlace
// styles plus the in-document #hud / #stage / #app origins.
import { ST } from './stage';
import { hostSize, hostOffset, hostStyle, standIn } from './uilayout';
import { layoutBox } from './board/hostlayout';

const TEMPLATE = `
<div id="frame">
	<div id="board">
		<div id="strips"></div>
		<div id="reelLines" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
		<div id="cells"></div>
		<div id="overlays"></div>
	</div>
</div>
<div id="flyLayer" aria-hidden="true"></div>
<div id="ctrlTop">
	<div class="side"><button id="turboBtn" class="ico toggle" aria-label="Turbo" title="Turbo"></button></div>
	<button id="buyBtn" class="ico emblem plate" aria-label="Get bonus" title="Get bonus">
		<span class="disc" aria-hidden="true"></span>
		<span id="buyLbl" class="lbl" aria-hidden="true"></span>
	</button>
</div>
<div id="bar">
	<button id="menuBtn" class="ico flat" aria-label="Menu" title="Menu" aria-haspopup="menu" aria-expanded="false" aria-controls="popMenu"></button>
	<button id="betDown" class="ico flat" aria-label="Decrease"></button>
	<button id="spinBtn" aria-label="Spin"><span id="autoN" aria-hidden="true"></span></button>
	<button id="armTag" class="hidden" aria-label=""><span class="t"></span></button>
	<button id="betUp" class="ico flat" aria-label="Increase"></button>
	<button id="autoBtn" class="ico flat" aria-label="Autoplay" title="Autoplay"></button>
</div>
<div id="strip">
	<div class="m"><label for="balance">BALANCE</label><span id="balance">—</span></div>
	<div class="m c"><label id="betLabel" for="bet">PLAY</label><span id="bet">—</span></div>
	<div class="m r"><label for="win">WIN</label><span id="win">—</span></div>
</div>
<div id="fsBar" class="hidden"><span id="fsTier">BUNNY SLOPE</span><span id="fsCount">FREE SPIN 0 / 8</span></div>
<div id="banner" class="hidden"></div>
<div id="stepToast" class="hidden" aria-live="polite"></div>
<div id="replayBar" class="hidden"><span><i class="rpPre">REPLAY ·&nbsp;</i><b id="replayMode"></b></span><button id="replayPlay">PLAY</button></div>
<div id="intro" class="overlay hidden"><div class="bwFx" aria-hidden="true"></div><div class="card"><div class="tierName"></div><div class="spins"></div><button class="cont">START</button></div></div>
<div id="fsMore" class="overlay hidden" role="status" aria-live="polite"><div class="card"><div class="fmBig"></div><div class="fmSub">FREE SPINS</div></div></div>
<div id="maxwin" class="hidden" role="dialog" aria-label="Max win"><div class="mwStage"><div class="mwBg"></div><div class="mwShade"></div></div><div class="mwText"><div class="mwTier">MAX WIN</div><div class="mwX">0x</div><div class="mwAmt"></div><div class="mwHint">CLICK TO CONTINUE</div></div></div>
<div id="cardFlip" class="overlay hidden" aria-live="polite"><div class="cfStage"><div class="cfCard"></div><div class="cfName"></div></div></div>
<div id="outro" class="overlay hidden"><div class="bwFx" aria-hidden="true"></div><div class="card"><div class="tierName">TOTAL WIN</div><div class="otAmt"></div><div class="otHint">TAP TO CONTINUE</div></div></div>
<div id="bigwin" class="overlay hidden"><div class="bwFx" aria-hidden="true"></div><div class="bw"><div class="bwTier">BIG WIN</div><div class="bwAmt"></div><div class="bwX"></div></div></div>
<div id="buyMenu" class="overlay hidden" role="dialog" aria-modal="true" aria-labelledby="buyTitle"><div class="modal bm hasX">
	<button class="mX" aria-label="Close" title="Close"></button>
	<div class="mView"><div class="mTrack">
	<div class="mHead"><h2 id="buyTitle">BONUS</h2></div>
	<div id="bmBet" class="row"><button id="bmDown" class="ico flat" aria-label="Decrease"></button><span class="v"><small></small><b id="bmBetV">—</b></span><button id="bmUp" class="ico flat" aria-label="Increase"></button></div>
	<div id="anteRow" class="row"><span class="lbl">ANTE <small id="anteCost">3x</small></span><button id="anteSw" class="sw" role="switch" aria-checked="false" aria-label="Ante"><i></i></button></div>
	<div id="turboRow" class="row"><span class="lbl">TURBO</span><button id="turboSw" class="sw" role="switch" aria-checked="false" aria-label="Turbo"><i></i></button></div>
	<div id="buyCards"></div>
	</div></div>
</div></div>
<div id="bmConfirm" class="overlay hidden" role="dialog" aria-modal="true" aria-labelledby="cfName"><div class="modal cf">
	<div class="mView"><div class="mTrack">
	<div class="cfArt" aria-hidden="true"></div>
	<h2 id="cfName"></h2>
	<p id="cfDesc"></p>
	<div class="cfAmt"><b id="cfAmount"></b> <span id="cfPer"></span><small id="cfX"></small></div>
	<p id="cfNote"></p>
	<button id="cfYes" class="go">CONFIRM</button>
	<p id="cfHint" class="cfHint"></p>
	</div></div>
</div></div>
<div id="autoMenu" class="overlay hidden" role="dialog" aria-modal="true" aria-labelledby="autoTitle"><div class="modal am hasX">
	<button class="mX" aria-label="Close" title="Close"></button>
	<div class="mView"><div class="mTrack">
	<div class="mHead"><h2 id="autoTitle">AUTOPLAY</h2></div>
	<div id="autoCounts" role="radiogroup" aria-label="Number of spins"></div>
	<div id="abRow" class="row"><span class="lbl">AUTO-PLAY BONUS</span><button id="stBonus" class="sw" role="switch" aria-checked="false" aria-label="Auto-play bonus"><i></i></button></div>
	<button id="advBtn" class="advBtn" aria-expanded="false">ADVANCED</button>
	<div id="adv" class="hidden">
		<label class="row"><span class="lbl">Stop on loss</span><input id="stLoss" inputmode="decimal" placeholder="Off" autocomplete="off" /></label>
		<label class="row"><span class="lbl">Stop on single win ≥</span><input id="stWin" inputmode="decimal" placeholder="Off" autocomplete="off" /></label>
		<label class="row"><span class="lbl">Stop on balance +</span><input id="stUp" inputmode="decimal" placeholder="Off" autocomplete="off" /></label>
		<div class="row"><span class="lbl">Stop on feature</span><button id="stFeat" class="sw" role="switch" aria-checked="false" aria-label="Stop on feature"><i></i></button></div>
	</div>
	<p id="autoErr" class="err" aria-live="polite"></p>
	<button id="autoStart" class="go">START</button>
	</div></div>
</div></div>
<div id="popMenu" role="menu" aria-label="Menu" aria-hidden="true">
	<button id="pmInfo" class="pmRow" role="menuitem"><svg class="pmI" viewBox="0 0 24 24"></svg><span>Info</span></button>
	<div class="pmItem" data-k="mus"><button id="pmMusic" class="pmRow" role="menuitem" aria-expanded="false" aria-controls="pmMusicS"><svg class="pmI" viewBox="0 0 24 24"></svg><span>Music</span></button><div id="pmMusicS" class="pmSlide"><span class="pmTr"><i class="slF"></i><i class="slT"></i><input type="range" min="0" max="100" step="5" aria-label="Music volume" /></span></div></div>
	<div class="pmItem" data-k="sfx"><button id="pmSound" class="pmRow" role="menuitem" aria-expanded="false" aria-controls="pmSoundS"><svg class="pmI" viewBox="0 0 24 24"></svg><span>Sound</span></button><div id="pmSoundS" class="pmSlide"><span class="pmTr"><i class="slF"></i><i class="slT"></i><input type="range" min="0" max="100" step="5" aria-label="Sound volume" /></span></div></div>
	<button id="pmMute" class="pmRow" role="menuitemcheckbox" aria-checked="false"><svg class="pmI" viewBox="0 0 24 24"></svg><span>Mute all</span></button>
	<button id="pmSettings" class="pmRow" role="menuitem"><svg class="pmI" viewBox="0 0 24 24"></svg><span>Settings</span></button>
</div>
<div id="settings" class="overlay hidden" role="dialog" aria-modal="true" aria-labelledby="setTitle"><div class="modal stg hasX">
	<button class="mX" aria-label="Close" title="Close"></button>
	<div class="mView"><div class="mTrack">
	<div class="mHead"><h2 id="setTitle">SETTINGS</h2></div>
	<div id="stSndRow" class="row stRow"><span class="lbl">SOUND</span><button id="stSnd" class="sw" role="switch" aria-checked="true" aria-label="Sound"><i></i></button></div>
	<div id="stMusRow" class="row stRow"><span class="lbl">MUSIC</span><div class="stSl" data-k="mus" role="slider" tabindex="0" aria-label="Music volume" aria-valuemin="0" aria-valuemax="100"><i class="slF"></i><i class="slT"></i></div></div>
	<div id="stSfxRow" class="row stRow"><span class="lbl">EFFECTS</span><div class="stSl" data-k="sfx" role="slider" tabindex="0" aria-label="Effects volume" aria-valuemin="0" aria-valuemax="100"><i class="slF"></i><i class="slT"></i></div></div>
	<div id="stTurboRow" class="row stRow"><span class="lbl">TURBO</span><button id="stTurbo" class="sw" role="switch" aria-checked="false" aria-label="Turbo"><i></i></button></div>
	</div></div>
</div></div>
<div id="menu" class="overlay hidden" role="dialog" aria-modal="true" aria-label="Game info"><div class="modal rules hasX">
	<button class="mX" aria-label="Close" title="Close"></button>
	<div class="mView"><div class="mTrack">
	<h2 id="rulesTitle">GAME INFO</h2><div id="rulesBody"></div>
	</div></div>
</div></div>
<div id="msg" class="overlay hidden" role="alertdialog" aria-modal="true"><div class="modal"><div class="mView"><div class="mTrack"><h2 id="msgTitle">MESSAGE</h2><p id="msgBody"></p><button id="msgOk">OK</button></div></div></div></div>
<div id="resumeCard" class="overlay hidden" role="alertdialog" aria-modal="true" aria-labelledby="rcTitle"><div class="modal cf"><div class="mView"><div class="mTrack">
	<h2 id="rcTitle"></h2><p id="rcLine"></p>
	<div class="rcBtns"><button id="rcResume" class="go"></button><button id="rcSkip" class="go"></button></div>
</div></div></div></div>
`;

export type HostOrigin = 'hud' | 'stage' | 'app' | 'view';

let tree: HTMLElement | null = null;
const byId = new Map<string, HTMLElement>();
const ORIGIN = new WeakMap<HTMLElement, HostOrigin>();
let patched = false;

export function uiHostTree() { return tree; }

export function isUiHost(el: Element | null): boolean {
	return !!el && !!tree && tree.contains(el);
}

function mark(id: string, origin: HostOrigin) {
	const el = tree?.querySelector<HTMLElement>('#' + id);
	if (!el) return;
	ORIGIN.set(el, origin);
	for (const k of el.querySelectorAll<HTMLElement>('*')) if (!ORIGIN.has(k)) ORIGIN.set(k, origin);
}

function findOrigin(el: HTMLElement): HostOrigin {
	let n: HTMLElement | null = el;
	while (n && n !== tree) {
		const o = ORIGIN.get(n);
		if (o) return o;
		n = n.parentElement;
	}
	return 'view';
}

function parsePx(v: string): number {
	if (!v) return 0;
	const n = parseFloat(v);
	return Number.isFinite(n) ? n : 0;
}

function parentBox(el: HTMLElement): { w: number; h: number } {
	const p = el.parentElement;
	if (!p || p === tree) return { w: 0, h: 0 };
	return { w: measure(p, 'w'), h: measure(p, 'h') };
}

function measure(el: HTMLElement, dim: 'w' | 'h'): number {
	const st = dim === 'w' ? el.style.width : el.style.height;
	const n = parsePx(st);
	if (n > 0) return n;
	const sz = standIn(el);
	if (sz) return dim === 'w' ? sz[0] : sz[1];
	const pb = parentBox(el);
	const lay = layoutBox(el, pb.w, pb.h);
	if (lay) return dim === 'w' ? lay.w : lay.h;
	return hostSize(el, dim, pb.w, pb.h) || 0;
}

function parseTranslate(el: HTMLElement, w: number, h: number): [number, number] {
	const t = el.style.translate || '';
	if (!t) return [0, 0];
	const parts = t.trim().split(/\s+/);
	const one = (s: string, base: number) => s.endsWith('%') ? (parsePx(s) / 100) * base : parsePx(s);
	return [one(parts[0] || '0', w), one(parts[1] || '0', h)];
}

function offsetInTree(el: HTMLElement): { x: number; y: number; w: number; h: number } {
	let x = 0, y = 0;
	const w = measure(el, 'w'), h = measure(el, 'h');
	let n: HTMLElement | null = el;
	while (n && n !== tree) {
		const nw = measure(n, 'w'), nh = measure(n, 'h');
		const [tx, ty] = parseTranslate(n, nw, nh);
		const pb = n.parentElement && n.parentElement !== tree ? { w: measure(n.parentElement, 'w'), h: measure(n.parentElement, 'h') } : { w: 0, h: 0 };
		const lay = layoutBox(n, pb.w, pb.h);
		x += (n.style.left ? parsePx(n.style.left) : (lay ? lay.x : hostOffset(n, 'x', pb.w, pb.h))) + tx;
		y += (n.style.top ? parsePx(n.style.top) : (lay ? lay.y : hostOffset(n, 'y', pb.w, pb.h))) + ty;
		n = n.parentElement;
	}
	return { x, y, w, h };
}

function computedTransform(el: HTMLElement): [number, number, number, number] {
	try {
		const xf = getComputedStyle(el).transform;
		if (!xf || xf === 'none') return [0, 0, 1, 1];
		if (xf.startsWith('matrix3d(')) {
			const m = xf.slice(9, -1).split(',').map(Number);
			return [m[12] || 0, m[13] || 0, m[0] || 1, m[5] || 1];
		}
		if (xf.startsWith('matrix(')) {
			const m = xf.slice(7, -1).split(',').map(Number);
			return [m[4] || 0, m[5] || 0, m[0] || 1, m[3] || 1];
		}
	} catch { /* detached */ }
	return [0, 0, 1, 1];
}

export function hostRect(el: HTMLElement): DOMRect {
	const origin = findOrigin(el);
	const { x, y, w, h } = offsetInTree(el);
	const [tx, ty, sx, sy] = computedTransform(el);
	const s = ST.s || 1;
	if (origin === 'hud' || origin === 'stage' || origin === 'app') {
		const id = origin === 'hud' ? 'hud' : origin === 'stage' ? 'stage' : 'app';
		// Use the in-document layout shell, never the host tree.
		const raw = Document.prototype.getElementById.call(document, id) as HTMLElement | null;
		if (raw) {
			const b = HTMLElement.prototype.getBoundingClientRect.call(raw);
			return new DOMRect(b.x + (x + tx) * s, b.y + (y + ty) * s, w * sx * s, h * sy * s);
		}
	}
	return new DOMRect(ST.ox + (x + tx) * s, ST.oy + (y + ty) * s, w * sx * s, h * sy * s);
}

function hookBox(el: HTMLElement) {
	el.getBoundingClientRect = function () { return hostRect(this); };
	try {
		Object.defineProperty(el, 'offsetWidth', { configurable: true, get() { return measure(this, 'w'); } });
		Object.defineProperty(el, 'offsetHeight', { configurable: true, get() { return measure(this, 'h'); } });
		Object.defineProperty(el, 'offsetLeft', { configurable: true, get() {
			if (this.style.left) return parsePx(this.style.left);
			const pb = parentBox(this);
			const lay = layoutBox(this, pb.w, pb.h);
			if (lay) return lay.x;
			return hostOffset(this, 'x', pb.w, pb.h);
		} });
		Object.defineProperty(el, 'offsetTop', { configurable: true, get() {
			if (this.style.top) return parsePx(this.style.top);
			const pb = parentBox(this);
			const lay = layoutBox(this, pb.w, pb.h);
			if (lay) return lay.y;
			return hostOffset(this, 'y', pb.w, pb.h);
		} });
		Object.defineProperty(el, 'clientWidth', { configurable: true, get() { return measure(this, 'w'); } });
		Object.defineProperty(el, 'clientHeight', { configurable: true, get() { return measure(this, 'h'); } });
		Object.defineProperty(el, 'isConnected', { configurable: true, get() { return true; } });
		Object.defineProperty(el, 'offsetParent', { configurable: true, get() { return this.parentElement; } });
	} catch { /* some browsers may lock isConnected */ }
	for (const c of el.children) hookBox(c as HTMLElement);
}

function mergeLists(a: NodeListOf<Element>, b: NodeListOf<Element>): NodeListOf<Element> {
	if (!b.length) return a;
	if (!a.length) return b;
	const arr = [...a, ...b];
	const out = {
		length: arr.length,
		item: (i: number) => arr[i] ?? null,
		forEach: arr.forEach.bind(arr),
		entries: arr.entries.bind(arr),
		keys: arr.keys.bind(arr),
		values: arr.values.bind(arr),
		[Symbol.iterator]: arr[Symbol.iterator].bind(arr),
	} as any;
	arr.forEach((el, i) => { out[i] = el; });
	return out;
}

export function installUiHosts() {
	if (tree) return tree;
	tree = document.createElement('div');
	tree.id = 'uiHostTree';
	tree.setAttribute('aria-hidden', 'true');
	tree.setAttribute('inert', '');
	tree.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;clip-path:inset(50%);z-index:-1';
	tree.innerHTML = TEMPLATE;
	hookBox(tree);
	byId.clear();
	for (const el of tree.querySelectorAll<HTMLElement>('[id]')) byId.set(el.id, el);


	const hudIds = ['ctrlTop', 'bar', 'strip', 'turboBtn', 'buyBtn', 'buyLbl', 'menuBtn', 'betDown', 'spinBtn', 'autoN', 'armTag', 'betUp', 'autoBtn', 'balance', 'bet', 'betLabel', 'win'];
	for (const id of hudIds) mark(id, 'hud');
	// strip fields and the buy disc are sized by syncHostLayout; toasts / bars use uilayout STANDIN
	for (const id of ['fsBar', 'banner', 'stepToast']) mark(id, 'stage');
	mark('replayBar', 'app');
	for (const id of ['frame', 'board', 'strips', 'cells', 'overlays', 'reelLines']) mark(id, 'stage');
	mark('flyLayer', 'view');
	new MutationObserver((ms) => {
		for (const m of ms) for (const n of m.addedNodes) if (n instanceof HTMLElement) hookBox(n);
	}).observe(tree, { childList: true, subtree: true });

	if (!patched) {
		patched = true;
		const rawGet = Document.prototype.getElementById;
		Document.prototype.getElementById = function (id: string) {
			return rawGet.call(this, id) || byId.get(id) || tree!.querySelector('#' + CSS.escape(id));
		};
		const rawQS = Document.prototype.querySelector;
		Document.prototype.querySelector = function (sel: string) {
			return rawQS.call(this, sel) || tree!.querySelector(sel);
		};
		const rawQSA = Document.prototype.querySelectorAll;
		Document.prototype.querySelectorAll = function (sel: string) {
			return mergeLists(rawQSA.call(this, sel), tree!.querySelectorAll(sel));
		};
		const rawCS = window.getComputedStyle.bind(window);
		window.getComputedStyle = ((elt: Element, pseudo?: string | null) => {
			const cs = rawCS(elt, pseudo);
			if (elt instanceof HTMLElement && isUiHost(elt)) return hostStyle(elt, cs);
			return cs;
		}) as typeof getComputedStyle;
	}

	const top = Document.prototype.getElementById.call(document, 'top') as HTMLElement | null;
	if (top) {
		top.style.setProperty('opacity', '0', 'important');
		top.style.setProperty('pointer-events', 'none', 'important');
		top.setAttribute('aria-hidden', 'true');
	}
	const hud = Document.prototype.getElementById.call(document, 'hud') as HTMLElement | null;
	if (hud) {
		hud.setAttribute('aria-hidden', 'true');
		hud.style.setProperty('pointer-events', 'none', 'important');
	}
	return tree;
}

/** Apply CSS-equivalent boxes for children that only had rules when they lived under #hud. */
export function syncHostLayout() {
	if (!tree) return;
	const px = (v: string) => parsePx(v);
	const buy = byId.get('buyBtn');
	if (buy) {
		const ps = px(buy.style.getPropertyValue('--ps')) || 1;
		const pl = px(buy.style.getPropertyValue('--pl')) || 0;
		const pf = px(buy.style.getPropertyValue('--pf')) || 12;
		const mkP = buy.classList.contains('mkP');
		const disc = buy.querySelector('.disc') as HTMLElement | null;
		if (disc) {
			const s = (mkP ? 126 : 118.8) * ps;
			disc.style.position = 'absolute';
			disc.style.left = ((mkP ? 33 : 48.6) * ps - 5 * ps).toFixed(2) + 'px';
			disc.style.top = ((mkP ? 25 : 34.6) * ps - 5 * ps).toFixed(2) + 'px';
			disc.style.width = s.toFixed(2) + 'px';
			disc.style.height = s.toFixed(2) + 'px';
		}
		const lbl = byId.get('buyLbl');
		if (lbl) {
			const bw = measure(buy, 'w');
			const left = mkP ? (367 * ps - 5 * ps + pl / 2) : (bw / 2 + pl / 2);
			const top = mkP ? (91 * ps - 5 * ps) : (200 * ps - 5 * ps);
			const lw = mkP ? Math.max(80, bw - left) : Math.max(40, bw * 0.9);
			lbl.style.position = 'absolute';
			lbl.style.left = left.toFixed(2) + 'px';
			lbl.style.top = top.toFixed(2) + 'px';
			lbl.style.width = lw.toFixed(2) + 'px';
			lbl.style.height = Math.max(pf, 14).toFixed(2) + 'px';
			lbl.style.translate = '-50% -50%';
		}
	}
	for (const box of tree.querySelectorAll<HTMLElement>('#strip .m')) {
		const ls = px(box.style.getPropertyValue('--ls')) || 12;
		const vs = px(box.style.getPropertyValue('--vs')) || 16;
		const lw = measure(box, 'w') || 96;
		const lh = ls * 1.3, vh = vs * 1.22;
		if (!box.style.height) box.style.height = (lh + vh).toFixed(2) + 'px';
		const lab = box.querySelector('label') as HTMLElement | null;
		const span = box.querySelector('span') as HTMLElement | null;
		if (lab) {
			lab.style.position = 'absolute';
			lab.style.left = '0px';
			lab.style.top = '0px';
			lab.style.width = lw.toFixed(2) + 'px';
			lab.style.height = lh.toFixed(2) + 'px';
		}
		if (span) {
			span.style.position = 'absolute';
			span.style.left = '0px';
			span.style.top = lh.toFixed(2) + 'px';
			span.style.width = lw.toFixed(2) + 'px';
			span.style.height = vh.toFixed(2) + 'px';
		}
	}
}

export function findHost(sel: string): HTMLElement | null {
	if (!tree) return null;
	if (sel.startsWith('#') && !/[.[:\s>[+]/.test(sel.slice(1))) return byId.get(sel.slice(1)) || tree.querySelector(sel);
	return tree.querySelector(sel);
}
