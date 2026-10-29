// Asset loading for the Pixi layers: relative URLs (resolved against document.baseURI, like every other static asset),
// decoded off the main thread where possible, then wrapped as Pixi textures.
import { Spritesheet, Texture } from 'pixi.js';
export async function loadTex(url: string): Promise<Texture> {
	try {
		const r = await fetch(url); if (!r.ok) throw new Error(r.status + ' ' + url);
		const bm = await createImageBitmap(await r.blob());
		return Texture.from(bm);
	} catch (e) {
		const img = new Image(); img.src = url; await img.decode(); return Texture.from(img);
	}
}
export async function loadSheet(dir: string, name: string) {
	const json = await (await fetch(`${dir}${name}.json`)).json();
	const tex = await loadTex(dir + json.meta.image);
	const sheet = new Spritesheet(tex, json); await sheet.parse();
	return { sheet, json };
}
