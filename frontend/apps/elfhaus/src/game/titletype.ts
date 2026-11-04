// The game's title lettering as sprite glyphs (cream face, ink line, green rim + darker green extrusion, the look of the
// hand-lettered bonus titles), baked by scripts/gen-modal-sprites.mjs into assets/ui/titletype.webp. Whole words for
// the card words, single glyphs for digits and + $ . , x /. Nothing here draws: it only places atlas parts (CSS .tg).
// The text itself stays in the element (visually hidden .tgA) for screen readers and for anything that reads it.
import T from './chalet/titletype.json';
const J = T as unknown as { size: [number, number]; h: number; frames: Record<string, [number, number, number, number]> };
const WORDS = Object.keys(J.frames).filter((k) => k.length > 1).sort((a, b) => b.length - a.length);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const pc = (v: number) => v.toFixed(4) + '%';
function glyph(k: string) {
	const [x, y, w, h] = J.frames[k], [AW, AH] = J.size;
	return `<i class="tg" style="--w:${(w / h).toFixed(4)};background-size:${pc((AW / w) * 100)} ${pc((AH / h) * 100)};background-position:${pc(AW === w ? 0 : (x / (AW - w)) * 100)} ${pc(AH === h ? 0 : (y / (AH - h)) * 100)}"></i>`;
}
/** Show `text` in the title lettering inside `el` (1em = one glyph row; size it with font-size). */
export function titleType(el: HTMLElement | null, text: string) {
	if (!el || el.dataset.tt === text) return; el.dataset.tt = text;
	let h = '', i = 0;
	while (i < text.length) {
		const w = WORDS.find((k) => text.startsWith(k, i));
		if (w) { h += glyph(w); i += w.length; continue; }
		let c = text[i++];
		if (c === '\u00a0' || c === '\u202f') c = ' ';      // the money formatter joins amount and code with a no-break space
		if (!J.frames[c] && J.frames[c.toUpperCase()]) c = c.toUpperCase();   // 'kr' / 'zł' in the capitals
		h += c === ' ' ? '<i class="tgS"></i>' : J.frames[c] ? glyph(c) : `<b class="tgF">${esc(c)}</b>`;   // a character without a glyph (another currency) stays type
	}
	el.innerHTML = `<span class="tgRow" aria-hidden="true">${h}</span><span class="tgA">${esc(text)}</span>`;
}
/** Mirror a text element that other code writes (e.g. a count-up) into a title-lettering twin right after it. */
export function titleTypeMirror(src: HTMLElement) {
	if (src.dataset.ttm) return; src.dataset.ttm = '1';
	const twin = document.createElement('div'); twin.className = src.className.split(' ')[0] + 'G ttTwin'; twin.setAttribute('aria-hidden', 'true');
	src.after(twin); src.classList.add('ttSrc');
	const sync = () => titleType(twin, src.textContent || '');
	new MutationObserver(sync).observe(src, { childList: true, characterData: true, subtree: true }); sync();
}
