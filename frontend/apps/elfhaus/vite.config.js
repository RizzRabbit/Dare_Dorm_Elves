import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// PORT lets a second checkout / worktree run next to the main one (PORT=3012 pnpm dev); default 3001
// renderBuiltUrl: the app bundle is inlined into index.html (bundleStrategy 'inline'), so Vite's default chunk-relative
// asset URLs (new URL('assets/x.webp', document.currentScript.src || document.baseURI)) resolved against the PAGE
// (-> <game>/assets/x.webp, 404) instead of <game>/_app/immutable/assets/x.webp. Every JS-imported asset (splash /
// loader / sting art, big-win and max-win sheets) now resolves from the page's directory, so it works under any
// sub-path (Stake Engine serves the game from a nested path with index.html at the root of the upload).
// The game talks only to the real RGS; the offline test tools (fixture books, fake RGS) live outside the app.
export default defineConfig(() => {
	return {
	plugins: [sveltekit()],
	build: { sourcemap: false },
	// each checkout / worktree keeps its own dep cache (node_modules is a shared symlink: two dev servers on one
	// node_modules/.vite double-loaded pixi.js, 'Extension type application already has a handler')
	cacheDir: '.vite-cache',
	experimental: {
		renderBuiltUrl(filename, { hostType }) {
			if (hostType === 'js') return { runtime: `new URL(${JSON.stringify(filename)}, document.baseURI).href` };
			return { relative: true };
		},
	},
	server: { port: Number(/** @type {any} */ (globalThis).process?.env?.PORT) || 3001 },
	};
});
