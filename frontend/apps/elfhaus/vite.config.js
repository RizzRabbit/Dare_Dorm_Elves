import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// PORT lets a second checkout / worktree run next to the main one (PORT=3012 pnpm dev); default 3001
export default defineConfig({ plugins: [sveltekit()], build: { sourcemap: false }, server: { port: Number(/** @type {any} */ (globalThis).process?.env?.PORT) || 3001 } });
