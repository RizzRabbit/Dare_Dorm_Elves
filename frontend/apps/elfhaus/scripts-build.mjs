// Runs `vite build` and exits once the static adapter reports it has written the site.
// Works around the build process staying alive afterwards (a sass-embedded child process
// keeps Node's event loop open in this toolchain), which made `pnpm build` hang.
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

// bundleStrategy 'inline' inlines all CSS into index.html, but Vite/SvelteKit still write the
// client stylesheet and a copy of the SSR stylesheet into build/_app/immutable/assets.
// Nothing loads them, so delete any .css there whose filename no built file references.
function pruneUnreferencedCss(dir = 'build') {
	const files = [];
	const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p); });
	walk(dir);
	const texts = files.filter((f) => /\.(html|js|css)$/.test(f)).map((f) => [f, readFileSync(f, 'utf8')]);
	for (const css of files.filter((f) => f.endsWith('.css'))) {
		const name = css.split('/').pop();
		if (!texts.some(([f, t]) => f !== css && t.includes(name))) { unlinkSync(css); console.log(`  pruned unreferenced ${css}`); }
	}
}

const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { stdio: ['ignore', 'pipe', 'inherit'] });
let wrote = false;
child.stdout.on('data', (buf) => {
	const text = buf.toString();
	process.stdout.write(text);
	if (text.includes('Wrote site to')) wrote = true;
	if (wrote && /\bdone\b/.test(text)) {
		setTimeout(() => { child.kill('SIGTERM'); pruneUnreferencedCss(); process.exit(0); }, 500);
	}
});
child.on('exit', (code) => { if (wrote) pruneUnreferencedCss(); process.exit(wrote ? 0 : code ?? 1); });
