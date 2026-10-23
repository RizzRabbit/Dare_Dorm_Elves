// Copies the art listed in art-manifest.json into static/art/ and writes src/game/art.generated.json
// ({key: "art/<key>.<ext>" | null}). Missing keys stay null and render as marked placeholders.
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, rmSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../../..');
const manifest = JSON.parse(readFileSync(join(app, 'art-manifest.json'), 'utf8'));
const outDir = join(app, 'static/art');
rmSync(outDir, { recursive: true, force: true }); mkdirSync(outDir, { recursive: true });
const out = {}, missing = [];
for (const [key, paths] of Object.entries(manifest)) {
	if (key.startsWith('_')) continue;
	const hit = paths.find((p) => existsSync(join(repo, p)));
	if (hit) { const f = `${key}${extname(hit).toLowerCase()}`; copyFileSync(join(repo, hit), join(outDir, f)); out[key] = `art/${f}`; }
	else { out[key] = null; missing.push(key); }
}
writeFileSync(join(app, 'src/game/art.generated.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`art: ${Object.keys(out).length - missing.length} found, placeholders: ${missing.join(', ') || 'none'}`);
