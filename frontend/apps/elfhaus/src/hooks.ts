import type { Reroute } from '@sveltejs/kit';

// Stake Engine (and most CDNs) may open the game as .../index.html?sessionID=... The app has a single
// route, so map any ".../index.html" path to its directory instead of SvelteKit's 404.
export const reroute: Reroute = ({ url }) => (url.pathname.endsWith('/index.html') ? url.pathname.slice(0, -'index.html'.length) : undefined);
