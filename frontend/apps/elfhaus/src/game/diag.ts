// Bounded diagnostic breadcrumbs that survive a mobile process kill / reload.
// sessionStorage only. No bet, balance, session, player, account, or URL query.
// In-memory window.__elfErr is wiped when Safari jetsam-reloads the tab; this ring is how the next
// boot shows the last phase (merge / bonus), resource counts, and whether the WebGL context died first.

const KEY = 'eh.diag.v1';
const MAX = 32;
type Crumb = { t: number; k: string; d?: Record<string, string | number> };

let phase = 'boot';
let stats: (() => Record<string, number>) | null = null;
let installed = false;
const mem: Crumb[] = [];

const SECRET = /session|rgs_url|token|auth|bearer|email|player|account|password|cookie|balance|bet|amount|currency|wallet/i;

/** Drop query strings, emails, and anything that looks like a credential. */
export function scrub(s: string) {
	return String(s || '')
		.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, '[email]')
		.replace(/[?#][^\s)]*/g, '')
		.replace(/\b(sessionID|sessionId|rgs_url|token|access_token)=\S+/gi, '$1=[redacted]')
		.replace(/\s+/g, ' ')
		.slice(0, 240);
}

function safeData(d?: Record<string, string | number>) {
	if (!d) return undefined;
	const out: Record<string, string | number> = {};
	for (const [k, v] of Object.entries(d)) {
		if (SECRET.test(k)) continue;
		if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
		else if (typeof v === 'string') { const s = scrub(v); if (s) out[k] = s; }
	}
	return out;
}

function read(): Crumb[] {
	try {
		const raw = globalThis.sessionStorage?.getItem(KEY);
		const arr = raw ? JSON.parse(raw) : mem;
		return Array.isArray(arr) ? arr.filter((c) => c && typeof c.t === 'number' && typeof c.k === 'string').slice(-MAX) : [];
	} catch { return mem.slice(); }
}

function write(list: Crumb[]) {
	const cut = list.slice(-MAX);
	mem.length = 0; mem.push(...cut);
	try { globalThis.sessionStorage?.setItem(KEY, JSON.stringify(cut)); } catch { /* private mode / quota: keep the in-memory ring */ }
}

/** Append one breadcrumb. Numbers and short scrubbed strings only. */
export function crumb(k: string, d?: Record<string, string | number>) {
	const list = read();
	list.push({ t: Date.now(), k: scrub(k).slice(0, 40), d: safeData(d) });
	write(list);
}

export const diagPhase = () => phase;

/** Remember what the player is in the middle of. A reload's pagehide crumb carries this. Repeated calls with the same phase are kept only when `extra` is set (a merge's before/after counts). */
export function setPhase(next: string, extra?: Record<string, number>) {
	const same = next === phase;
	phase = next;
	if (same && !extra) return;
	crumb('phase', { phase: next, ...(extra || {}) });
}

export function watchCanvas(cv: HTMLCanvasElement | null | undefined, name: string) {
	if (!cv || (cv as HTMLCanvasElement & { __ehWatch?: boolean }).__ehWatch) return;
	(cv as HTMLCanvasElement & { __ehWatch?: boolean }).__ehWatch = true;
	cv.addEventListener('webglcontextlost', (e) => {
		e.preventDefault(); // the context is allowed to restore; this handler never reloads the page
		crumb('webgl-lost', { canvas: name, phase });
	});
	cv.addEventListener('webglcontextrestored', () => crumb('webgl-restored', { canvas: name, phase }));
}

/** Shrink an intro renderer to a 1×1 framebuffer without Application.destroy (that clears Pixi 8's shared batch pool while the room / board renderers are alive). */
export function releaseIntroGpu(app: { renderer?: { resize?: (w: number, h: number, r: number) => void } } | null) {
	try { app?.renderer?.resize?.(1, 1, 1); crumb('intro-gpu', { w: 1 }); } catch (e) { crumb('intro-gpu-fail', { msg: scrub((e as Error)?.message || String(e)) }); }
}

export function installDiag(getStats?: () => Record<string, number>) {
	if (getStats) stats = getStats;
	if (installed) return;
	installed = true;
	const prev = read();
	const last = prev[prev.length - 1];
	if (last && (last.k === 'pagehide' || last.k === 'webgl-lost' || last.k === 'error')) {
		try { console.info('[elfhaus] last session', prev.slice(-8)); } catch { /* no console */ }
	}
	crumb('boot', { phase });
	if (typeof addEventListener !== 'function') return;
	addEventListener('error', (e) => crumb('error', { msg: scrub(e.message || ''), line: e.lineno || 0 }));
	addEventListener('unhandledrejection', (e) => {
		const r = (e as PromiseRejectionEvent).reason as { message?: string } | undefined;
		crumb('rejection', { msg: scrub(r?.message || String(r || '')) });
	});
	addEventListener('pagehide', () => crumb('pagehide', { phase, ...(stats ? stats() : {}) }));
	addEventListener('pageshow', (e) => crumb('pageshow', { persisted: (e as PageTransitionEvent).persisted ? 1 : 0, phase }));
}

/** Test hook: the persisted ring (newest last). */
export function diagLog() { return read(); }
export function diagReset() { phase = 'boot'; write([]); }
