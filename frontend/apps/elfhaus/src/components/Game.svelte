<script lang="ts">
	import { onMount } from 'svelte';
	import { initGame } from '../game/game';
	onMount(() => { initGame(); });
</script>

<div id="bg"></div>
<canvas id="scene" aria-hidden="true"></canvas>
<div id="root">
<div id="app">
	<header id="top" aria-hidden="true"></header>
	<div id="stage"></div>
	<footer id="hud" aria-hidden="true"></footer>
</div>

<div id="loader" role="dialog" aria-label="Loading Elfhaus">
	<div id="sting" aria-hidden="true"></div>
</div>
</div>
<div id="srHud" class="sr-only" aria-live="polite" aria-atomic="true" style="position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;clip-path:inset(50%);pointer-events:none;z-index:-1"></div>
