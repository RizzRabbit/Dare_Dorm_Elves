<script lang="ts">
	import { onMount } from 'svelte';
	import { initGame } from '../game/game';
	import ART from '../game/art.generated.json';
	import { LOADER_CARDS } from '../game/loader';
	const art = ART as Record<string, string | null>;
	onMount(() => { initGame(); });
</script>

<div id="bg"></div>
<canvas id="roxy" aria-hidden="true"></canvas>
<div id="app">
	<header id="top">
		{#if art.logo}
			<div id="logo" class="art" role="img" aria-label="Elfhaus"><img src={art.logo} alt="" /></div>
		{:else}
			<div id="logo" role="img" aria-label="Elfhaus">
				<svg class="crest" viewBox="0 0 200 200" aria-hidden="true"><polygon points="100,4 114,40 150,18 142,58 186,52 160,86 196,100 160,114 186,148 142,142 150,182 114,160 100,196 86,160 50,182 58,142 14,148 40,114 4,100 40,86 14,52 58,58 50,18 86,40" fill="#8A7FA3" stroke="#1E1A26" stroke-width="4" stroke-linejoin="round" /><circle cx="100" cy="100" r="62" fill="#4E4660" stroke="#1E1A26" stroke-width="4" /><circle cx="100" cy="100" r="52" fill="none" stroke="#B9A2E0" stroke-width="2" stroke-dasharray="3 5" opacity=".7" /></svg>
				<span class="l1">ELF</span><span class="l2">HAUS</span><span class="ph">logo placeholder</span>
			</div>
		{/if}
	</header>
	<div id="stage">
		<div id="fsBar" class="hidden"><span id="fsTier">DARE</span><span id="fsCount">FREE SPIN 0 / 8</span><span id="fsCap">max 18</span></div>
		<div id="banner" class="hidden"></div>
		<div id="frame" class:art={!!art.frame} style={art.frame ? `border-image: url(${art.frame}) 30 fill / 30px stretch` : ''}>
			<div id="board">
				<div id="cells"></div>
				<div id="overlays"></div>
				<svg id="lines"></svg>
			</div>
		</div>
		<div id="respinCtr" class="hidden" role="status" aria-live="polite"><div class="rcLbl">RESPIN</div><div class="rcRow"><span class="rcNum">1</span><span class="rcOf">/ 3</span></div><div class="rcPips"><i></i><i></i><i></i></div><div class="rcLeft">2 LEFT</div></div>
		<div id="stepToast" class="hidden" aria-live="polite"></div>
	</div>
	<footer id="hud">
		<div id="ctrlTop">
			<div class="side">
				<button id="turboBtn" class="ico toggle" aria-label="Turbo" title="Turbo"><svg viewBox="0 0 24 24"><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" /></svg></button>
				<button id="anteBtn" class="ico toggle" aria-pressed="false" aria-label="Ante (higher bonus chance)" title="Ante"><svg viewBox="0 0 24 24"><path d="M6 13l6-6 6 6M6 19l6-6 6 6" /></svg></button>
			</div>
			<button id="buyBtn" class="ico emblem" aria-label="Get bonus" title="Get bonus">
				{#if art.buy_icon}<img src={art.buy_icon} srcset={art.buy_icon_128 ? `${art.buy_icon_128} 128w, ${art.buy_icon} 256w` : undefined} sizes="42px" alt="" />{:else}<svg viewBox="0 0 40 40"><path class="g" d="M9 31C9 19 18 9 31 6c-2 11-8 20-18 26Z" /><path class="g" d="M13.5 26.5C17 20 22 15 27.5 11" /><path class="gf" d="M30 22l1.3 3.2 3.2 1.3-3.2 1.3L30 31l-1.3-3.2-3.2-1.3 3.2-1.3Z" /></svg>{/if}
			</button>
		</div>
		<div id="bar">
			<button id="menuBtn" class="ico flat" aria-label="Menu" title="Menu"><svg viewBox="0 0 24 24"><path d="M4 6.5h16M4 12h16M4 17.5h16" /></svg></button>
			<button id="betDown" class="ico flat" aria-label="Decrease"><svg viewBox="0 0 24 24"><path d="M5 12h14" /></svg></button>
			<button id="spinBtn" aria-label="Spin"><svg viewBox="0 0 48 48"><path d="M38 24a14 14 0 1 1-4.1-9.9" /><path class="fill" d="M41 8.5 40 21l-11.5-4.7Z" /></svg></button>
			<button id="betUp" class="ico flat" aria-label="Increase"><svg viewBox="0 0 24 24"><path d="M5 12h14M12 5v14" /></svg></button>
			<button id="autoBtn" class="ico flat" aria-label="Autoplay" title="Autoplay"><svg viewBox="0 0 24 24"><path d="M19 9.5A7.5 7.5 0 0 0 5.6 8M5 14.5A7.5 7.5 0 0 0 18.4 16" /><path class="fill" d="M4.2 4.6 5 9.4l4.6-1.6ZM19.8 19.4 19 14.6l-4.6 1.6Z" /><text x="12" y="15.3" text-anchor="middle">A</text></svg></button>
		</div>
		<div id="strip">
			<div class="m"><label for="balance">BALANCE</label><span id="balance">—</span></div>
			<div class="m c"><label id="betLabel" for="bet">PLAY</label><span id="bet">—</span></div>
			<div class="m r"><label for="win">WIN</label><span id="win">—</span></div>
		</div>
	</footer>
</div>

<div id="replayBar" class="hidden"><span>REPLAY · <b id="replayMode"></b></span><button id="replayPlay">PLAY</button></div>
<div id="intro" class="overlay hidden"><div class="card"><div class="tierName"></div><div class="spins"></div><div class="carried"></div><div class="note">+2 spins per new full-reel wild · max 18 spins</div><button class="cont">PRESS TO CONTINUE</button><span class="ph">intro art placeholder</span></div></div>
<div id="maxwin" class="hidden" role="dialog" aria-label="Max win"><div class="mwStage"><div class="mwBg" style={art.background_fs ? `background-image:url(${art.background_fs})` : ''}></div><div class="mwShade"></div></div><canvas class="mwConf"></canvas><div class="mwText"><div class="mwTier">MAX WIN</div><div class="mwX">0x</div><div class="mwAmt"></div><div class="mwHint">CLICK TO CONTINUE</div></div></div>
<div id="bigwin" class="overlay hidden"><div class="bw"><div class="bwTier">BIG WIN</div><div class="bwAmt"></div><div class="bwX"></div></div></div>
<div id="buyMenu" class="overlay hidden" role="dialog" aria-modal="true"><div class="modal">
	<h2 id="buyTitle">GET BONUS</h2>
	<div id="buyCards"></div>
	<div id="buyConfirm" class="hidden"><p id="buyConfirmText"></p><p id="buyConfirmNote" class="note"></p><button id="buyYes">CONFIRM</button><button id="buyNo" class="ghost">CANCEL</button></div>
	<button id="buyClose" class="ghost">CLOSE</button>
</div></div>
<div id="menu" class="overlay hidden" role="dialog" aria-modal="true"><div class="modal rules">
	<h2 id="rulesTitle">GAME RULES</h2><div id="rulesBody"></div><button id="menuClose" class="ghost">CLOSE</button>
</div></div>
<div id="msg" class="overlay hidden" role="alertdialog" aria-modal="true"><div class="modal"><h2 id="msgTitle">MESSAGE</h2><p id="msgBody"></p><button id="msgOk">OK</button></div></div>

<div id="loader" role="dialog" aria-label="Loading Elfhaus">
	<div class="lbg" style={art.background_fs ? `background-image:url(${art.background_fs})` : ''}></div>
	{#if art.logo_full}<img id="lLogo" src={art.logo_full} alt="Elfhaus" draggable="false" />{:else}<div id="lLogo" class="txt">ELFHAUS</div>{/if}
	<div class="lSide">
		<div id="lCards" aria-roledescription="carousel">
			<div id="lTrack">
				<div class="lCard">
					<div class="lArt wild">{#if art.W}<img src={art.W} alt="" draggable="false" />{/if}<span class="lLock">LOCKED</span><span class="lBadge">x8</span></div>
					<h3>{LOADER_CARDS[0]}</h3>
				</div>
				<div class="lCard">
					<div class="lArt">{#if art.WM3}<img src={art.WM3} alt="" draggable="false" />{/if}</div>
					<h3>{LOADER_CARDS[1]}</h3>
				</div>
				<div class="lCard">
					<div class="lArt max">{#if art.WM5}<img src={art.WM5} alt="" draggable="false" />{/if}<span class="lBig">50,000x</span></div>
					<h3>{LOADER_CARDS[2]}</h3>
				</div>
			</div>
		</div>
		<div id="lDots">{#each LOADER_CARDS as c, i}<button aria-label={`Feature ${i + 1}`}></button>{/each}</div>
		<div id="lBar" role="progressbar" aria-label="Loading"><i></i></div>
		<button id="lGo">CLICK TO CONTINUE</button>
	</div>
	<div class="lCredit">Rizzin Games</div>
</div>
