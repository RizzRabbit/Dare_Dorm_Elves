import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// PORT lets a second checkout / worktree run next to the main one (PORT=3012 pnpm dev); default 3001
// renderBuiltUrl: the app bundle is inlined into index.html (bundleStrategy 'inline'), so Vite's default chunk-relative
// asset URLs (new URL('assets/x.webp', document.currentScript.src || document.baseURI)) resolved against the PAGE
// (-> <game>/assets/x.webp, 404) instead of <game>/_app/immutable/assets/x.webp. Every JS-imported asset (splash /
// loader / sting art, big-win and max-win sheets) now resolves from the page's directory, so it works under any
// sub-path (Stake Engine serves the game from a nested path with index.html at the root of the upload).
export default defineConfig({
	plugins: [sveltekit()],
	build: { sourcemap: false },
	experimental: {
		renderBuiltUrl(filename, { hostType }) {
			if (hostType === 'js') return { runtime: `new URL(${JSON.stringify(filename)}, document.baseURI).href` };
			return { relative: true };
		},
	},
	server: { port: Number(/** @type {any} */ (globalThis).process?.env?.PORT) || 3001 },
});
