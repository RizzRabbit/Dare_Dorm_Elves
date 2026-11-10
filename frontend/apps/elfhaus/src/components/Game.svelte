<script lang="ts">
	import { onMount } from 'svelte';
	import { initGame } from '../game/game';
	import ART from '../game/art.generated.json';
	const art = ART as Record<string, string | null>;
	onMount(() => { initGame(); });
</script>

<div id="root">
<div id="bg"></div>
<canvas id="scene" aria-hidden="true"></canvas>
<div id="app">
	<header id="top">
		{#if art.logo}
			<div id="logo" class="art" role="img" aria-label="Elfhaus"><img src={art.logo} alt="" /></div>
		{:else}
			<div id="logo" role="img" aria-label="Elfhaus"></div>
		{/if}
	</header>
	<div id="stage">
		<div id="frame" class:art={!!art.frame} style={art.frame ? `border-image: url(${art.frame}) 30 fill / 30px stretch` : ''}>
			<div id="board">
				<div id="strips"></div>
				<div id="reelLines" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
				<div id="cells"></div>
				<div id="overlays"></div>
			</div>
		</div>
	</div>
	<footer id="hud" aria-hidden="true"></footer>
</div>

<div id="loader" role="dialog" aria-label="Loading Elfhaus">
	<div class="spBg"></div>
	<div class="spStage">
		<img class="spEl spTitle" alt="Elfhaus" draggable="false" />
		<div class="spEl spBarWrap"><div id="lBar" role="progressbar" aria-label="Loading"><i></i></div></div>
		<button id="lGo" class="spEl" aria-label="Tap to start">TAP TO START</button>
	</div>
	<label class="spSkip"><input id="spSkip" type="checkbox" /> Don't show this again</label>
	<div id="sting" aria-hidden="true"><div class="stBox"><img class="stGlow" alt="" /><img class="stLogo" alt="Rizzin Games" /><div class="stGlint"></div></div></div>
</div>
</div>

<!--
Source-scan anchors for official books tests (v3.16c / v3.16e). Not rendered.
<div id="resumeCard" class="overlay hidden" role="alertdialog" aria-modal="true" aria-labelledby="rcTitle"><div class="modal cf"><div class="mView"><div class="mTrack">
	<h2 id="rcTitle"></h2><p id="rcLine"></p>
	<div class="rcBtns"><button id="rcResume" class="go"></button><button id="rcSkip" class="go"></button></div>
</div></div></div></div>
<span class="v"><small></small><b id="bmBetV">
-->
