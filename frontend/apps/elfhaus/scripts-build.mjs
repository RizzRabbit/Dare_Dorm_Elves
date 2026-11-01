// Runs `vite build` and exits once the static adapter reports it has written the site.
// Works around the build process staying alive afterwards (a sass-embedded child process
// keeps Node's event loop open in this toolchain), which made `pnpm build` hang.
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { join, basename } from 'node:path';

// bundleStrategy 'inline' inlines all CSS into index.html, but Vite/SvelteKit still write the
// client stylesheet and a copy of the SSR stylesheet into build/_app/immutable/assets.
// Nothing loads them, so delete any .css there whose filename no built file references.
function pruneUnreferencedCss(dir = 'build') {
	const files = [];
	const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p); });
	walk(dir);
	const texts = files.filter((f) => /\.(html|js|css)$/.test(f)).map((f) => [f, readFileSync(f, 'utf8')]);
	for (const css of files.filter((f) => f.endsWith('.css'))) {
		const name = basename(css);
		if (!texts.some(([f, t]) => f !== css && t.includes(name))) { unlinkSync(css); console.log(`  pruned unreferenced ${css}`); }
	}
}

// With bundleStrategy 'inline' the whole app JS is inlined into index.html, yet Vite also writes the same code to
// build/_app/immutable/bundle.<hash>.js (~0.9 MB). index.html only names it as the base URL for the preload helper
// (new URL("_app/immutable/bundle.<hash>.js", document.baseURI)), never loads it, so drop the duplicate file.
function pruneDuplicateBundle(dir = 'build') {
	const html = readFileSync(join(dir, 'index.html'), 'utf8'), imm = join(dir, '_app/immutable');
	for (const f of readdirSync(imm).filter((n) => /^bundle\.[\w-]+\.js$/.test(n))) {
		const loads = new RegExp(`(src=|href=|import\\(|from)\\s*["'][^"']*${f.replace(/\./g, '\\.')}`).test(html);
		if (!loads && html.includes('<script')) { unlinkSync(join(imm, f)); console.log(`  pruned duplicate inlined ${join(imm, f)}`); }
	}
}
const prune = () => { pruneUnreferencedCss(); pruneDuplicateBundle(); };

const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { stdio: ['ignore', 'pipe', 'inherit'] });
let wrote = false;
child.stdout.on('data', (buf) => {
	const text = buf.toString();
	process.stdout.write(text);
	if (text.includes('Wrote site to')) wrote = true;
	if (wrote && /\bdone\b/.test(text)) {
		setTimeout(() => { child.kill('SIGTERM'); prune(); process.exit(0); }, 500);
	}
});
child.on('exit', (code) => { if (wrote) prune(); process.exit(wrote ? 0 : code ?? 1); });
