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
			<div id="logo" role="img" aria-label="Elfhaus">
				<svg class="crest" viewBox="0 0 200 200" aria-hidden="true"><polygon points="100,4 114,40 150,18 142,58 186,52 160,86 196,100 160,114 186,148 142,142 150,182 114,160 100,196 86,160 50,182 58,142 14,148 40,114 4,100 40,86 14,52 58,58 50,18 86,40" fill="#8A7FA3" stroke="#1E1A26" stroke-width="4" stroke-linejoin="round" /><circle cx="100" cy="100" r="62" fill="#4E4660" stroke="#1E1A26" stroke-width="4" /><circle cx="100" cy="100" r="52" fill="none" stroke="#B9A2E0" stroke-width="2" stroke-dasharray="3 5" opacity=".7" /></svg>
				<span class="l1">ELF</span><span class="l2">HAUS</span>
			</div>
		{/if}
	</header>
	<div id="stage">
		<div id="fsBar" class="hidden"><span id="fsTier">BUNNY SLOPE</span><span id="fsCount">FREE SPIN 0 / 8</span></div>
		<div id="banner" class="hidden"></div>
		<div id="frame" class:art={!!art.frame} style={art.frame ? `border-image: url(${art.frame}) 30 fill / 30px stretch` : ''}>
			<div id="board">
				<div id="strips"></div>
				<div id="reelLines" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
				<div id="cells"></div>
				<div id="overlays"></div>
				<canvas id="lines"></canvas>
			</div>
		</div>
		<div id="stepToast" class="hidden" aria-live="polite"></div>
	</div>
	<footer id="hud">
		<div id="ctrlTop">
			<div class="side">
				<button id="turboBtn" class="ico toggle" aria-label="Turbo" title="Turbo"><svg viewBox="-50 -50 100 100" class="mkI" aria-hidden="true"><path style="fill:#ffd25a;stroke:none" d="M3 -16 -9 3 0 3 -3 16 9 -3 0 -3Z" /></svg></button>
			</div>
			<button id="buyBtn" class="ico emblem plate" aria-label="Get bonus" title="Get bonus">
				<span class="disc" aria-hidden="true">{#if art.buy_icon}<img src={art.buy_icon} srcset={art.buy_icon_128 ? `${art.buy_icon_128} 128w, ${art.buy_icon} 256w` : undefined} sizes="96px" alt="" />{:else}<svg viewBox="0 0 40 40"><path class="g" d="M9 31C9 19 18 9 31 6c-2 11-8 20-18 26Z" /><path class="g" d="M13.5 26.5C17 20 22 15 27.5 11" /><path class="gf" d="M30 22l1.3 3.2 3.2 1.3-3.2 1.3L30 31l-1.3-3.2-3.2-1.3 3.2-1.3Z" /></svg>{/if}</span>
				<span id="buyLbl" class="lbl" aria-hidden="true"></span>
			</button>
		</div>
		<div id="bar">
			<button id="menuBtn" class="ico flat" aria-label="Menu" title="Menu" aria-haspopup="menu" aria-expanded="false" aria-controls="popMenu"><svg viewBox="-50 -50 100 100" class="mkI" aria-hidden="true"><rect x="-12" y="-10" width="24" height="4.5" rx="2" style="fill:#fff;stroke:none" /><rect x="-12" y="-2.25" width="24" height="4.5" rx="2" style="fill:#fff;stroke:none" /><rect x="-12" y="5.5" width="24" height="4.5" rx="2" style="fill:#fff;stroke:none" /></svg></button>
			<button id="betDown" class="ico flat" aria-label="Decrease"><svg viewBox="-50 -50 100 100" class="mkI" aria-hidden="true"><rect x="-10" y="-2.5" width="20" height="5" style="fill:#fff;stroke:none" /></svg></button>
			<button id="spinBtn" aria-label="Spin"><svg viewBox="-50 -50 100 100" class="mkI" aria-hidden="true"><path style="fill:none;stroke:#fff;stroke-width:6px;stroke-linecap:round;vector-effect:none" d="M-18.97 -11.38A22 22 0 0 1 19.31 10.55" /><path style="fill:none;stroke:#fff;stroke-opacity:.55;stroke-width:6px;stroke-linecap:round;vector-effect:none" d="M18.73 11.54A22 22 0 0 1 -19.08 -10.95" /><path style="fill:#fff;stroke:none" d="M28.31 2.55 8.31 8.55 24.31 22.55Z" /></svg><span id="autoN" aria-hidden="true"></span></button>
			<button id="armTag" class="hidden" aria-label=""><span class="t"></span><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" /></svg></button>
			<button id="betUp" class="ico flat" aria-label="Increase"><svg viewBox="-50 -50 100 100" class="mkI" aria-hidden="true"><rect x="-10" y="-2.5" width="20" height="5" style="fill:#fff;stroke:none" /><rect x="-2.5" y="-10" width="5" height="20" style="fill:#fff;stroke:none" /></svg></button>
			<button id="autoBtn" class="ico flat" aria-label="Autoplay" title="Autoplay"><svg viewBox="-50 -50 100 100" class="mkI" aria-hidden="true"><!-- v20: autoplay = repeat arrow + play, stop square while running --><g class="aPlay"><path style="fill:none;stroke:#fff;stroke-width:5px;stroke-linecap:round;vector-effect:none" d="M14.6 -12.2A19 19 0 1 1 -6.5 -17.9" /><path style="fill:#fff;stroke:none" d="M3 -21.5 -9 -25.5 -4 -11.5Z" /><path style="fill:#fff;stroke:none" d="M-4.5 -7.5 7.5 0 -4.5 7.5Z" /></g><rect class="aStop fill" x="-10" y="-10" width="20" height="20" rx="3" fill="#fff" style="stroke:none" /></svg></button>
		</div>
		<div id="strip">
			<div class="m"><label for="balance">BALANCE</label><span id="balance">—</span></div>
			<div class="m c"><label id="betLabel" for="bet">PLAY</label><span id="bet">—</span></div>
			<div class="m r"><label for="win">WIN</label><span id="win">—</span></div>
		</div>
	</footer>
</div>

<div id="replayBar" class="hidden"><span><i class="rpPre">REPLAY ·&nbsp;</i><b id="replayMode"></b></span><button id="replayPlay">PLAY</button></div>
<div id="intro" class="overlay hidden"><div class="bwFx" aria-hidden="true"></div><div class="card"><div class="tierName"></div><div class="spins"></div><button class="cont">START</button></div></div>
<div id="fsMore" class="overlay hidden" role="status" aria-live="polite"><div class="card"><div class="fmBig"></div><div class="fmSub">FREE SPINS</div></div></div>
<div id="maxwin" class="hidden" role="dialog" aria-label="Max win"><div class="mwStage"><div class="mwBg"></div><div class="mwShade"></div></div><div class="mwText"><div class="mwTier">MAX WIN</div><div class="mwX">0x</div><div class="mwAmt"></div><div class="mwHint">CLICK TO CONTINUE</div></div></div>
<div id="cardFlip" class="overlay hidden" aria-live="polite"><div class="cfStage"><div class="cfCard"></div><div class="cfName"></div></div></div>
<div id="outro" class="overlay hidden"><div class="bwFx" aria-hidden="true"></div><div class="card"><div class="tierName">TOTAL WIN</div><div class="otAmt"></div><div class="otHint">TAP TO CONTINUE</div></div></div>
<div id="bigwin" class="overlay hidden"><div class="bwFx" aria-hidden="true"></div><div class="bw"><div class="bwTier">BIG WIN</div><div class="bwAmt"></div><div class="bwX"></div></div></div>
<div id="buyMenu" class="overlay hidden" role="dialog" aria-modal="true" aria-labelledby="buyTitle"><div class="modal bm hasX">
	<button class="mX" aria-label="Close" title="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="xb" d="M5 5 12.9 11.1 19 19 11.1 12.9ZM19 5 12.9 12.9 5 19 11.1 11.1Z" /></svg></button>
	<div class="mView"><div class="mTrack">
	<div class="mHead"><h2 id="buyTitle">BONUS</h2></div>
	<div id="bmBet" class="row"><!-- v3.15b (James): bet steps at the top of the bonus menu; HUD steps, limits and sync --><button id="bmDown" class="ico flat" aria-label="Decrease"><svg viewBox="0 0 24 24"><path d="M5 12h14" /></svg></button><span class="v"><small></small><b id="bmBetV">—</b></span><button id="bmUp" class="ico flat" aria-label="Increase"><svg viewBox="0 0 24 24"><path d="M5 12h14M12 5v14" /></svg></button></div>
	<div id="anteRow" class="row"><span class="lbl">ANTE <small id="anteCost">3x</small></span><button id="anteSw" class="sw" role="switch" aria-checked="false" aria-label="Ante"><i></i></button></div>
	<div id="turboRow" class="row"><span class="lbl">TURBO</span><!-- v3.17 (James): no description line under the turbo label --><button id="turboSw" class="sw" role="switch" aria-checked="false" aria-label="Turbo"><i></i></button></div>
	<div id="buyCards"></div>
	</div></div>
</div></div>
<div id="bmConfirm" class="overlay hidden" role="dialog" aria-modal="true" aria-labelledby="cfName"><div class="modal cf">
	<div class="mView"><div class="mTrack">
	<div class="cfArt" aria-hidden="true"></div>
	<h2 id="cfName"></h2>
	<p id="cfDesc"></p>
	<div class="cfAmt"><b id="cfAmount"></b> <span id="cfPer"></span><small id="cfX"></small></div>
	<p id="cfNote"></p>
	<button id="cfYes" class="go">CONFIRM</button>
	<p id="cfHint" class="cfHint"></p>
	</div></div>
</div></div>
<div id="autoMenu" class="overlay hidden" role="dialog" aria-modal="true" aria-labelledby="autoTitle"><div class="modal am hasX">
	<button class="mX" aria-label="Close" title="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="xb" d="M5 5 12.9 11.1 19 19 11.1 12.9ZM19 5 12.9 12.9 5 19 11.1 11.1Z" /></svg></button>
	<div class="mView"><div class="mTrack">
	<div class="mHead"><h2 id="autoTitle">AUTOPLAY</h2></div>
	<div id="autoCounts" role="radiogroup" aria-label="Number of spins"></div>
	<div id="abRow" class="row"><span class="lbl">AUTO-PLAY BONUS</span><button id="stBonus" class="sw" role="switch" aria-checked="false" aria-label="Auto-play bonus"><i></i></button></div>
	<button id="advBtn" class="advBtn" aria-expanded="false">ADVANCED <svg viewBox="0 0 12 12"><path d="M3 4.5 6 7.5 9 4.5" /></svg></button>
	<div id="adv" class="hidden">
		<label class="row"><span class="lbl">Stop on loss</span><input id="stLoss" inputmode="decimal" placeholder="Off" autocomplete="off" /></label>
		<label class="row"><span class="lbl">Stop on single win ≥</span><input id="stWin" inputmode="decimal" placeholder="Off" autocomplete="off" /></label>
		<label class="row"><span class="lbl">Stop on balance +</span><input id="stUp" inputmode="decimal" placeholder="Off" autocomplete="off" /></label>
		<div class="row"><span class="lbl">Stop on feature</span><button id="stFeat" class="sw" role="switch" aria-checked="false" aria-label="Stop on feature"><i></i></button></div>
	</div>
	<p id="autoErr" class="err" aria-live="polite"></p>
	<button id="autoStart" class="go">START</button>
	</div></div>
</div></div>
<div id="popMenu" role="menu" aria-label="Menu" aria-hidden="true"><button id="pmInfo" class="pmRow" role="menuitem"><svg class="pmI" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.6v.2" /></svg><span>Info</span></button><div class="pmItem" data-k="mus"><button id="pmMusic" class="pmRow" role="menuitem" aria-expanded="false" aria-controls="pmMusicS"><svg class="pmI" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17.5V6l10-2v11.5" /><circle cx="6.5" cy="17.5" r="2.5" /><circle cx="16.5" cy="15.5" r="2.5" /></svg><svg class="pmX" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg><span>Music</span></button><div id="pmMusicS" class="pmSlide"><input type="range" min="0" max="100" step="5" aria-label="Music volume" /></div></div><div class="pmItem" data-k="sfx"><button id="pmSound" class="pmRow" role="menuitem" aria-expanded="false" aria-controls="pmSoundS"><svg class="pmI" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></svg><svg class="pmX" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg><span>Sound</span></button><div id="pmSoundS" class="pmSlide"><input type="range" min="0" max="100" step="5" aria-label="Sound volume" /></div></div><button id="pmMute" class="pmRow" role="menuitemcheckbox" aria-checked="false"><svg class="pmI" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" /><path class="mOn" d="M16 9.5l5 5M21 9.5l-5 5" /></svg><span>Mute all</span></button></div>
<div id="menu" class="overlay hidden" role="dialog" aria-modal="true" aria-label="Game info"><div class="modal rules hasX">
	<button class="mX" aria-label="Close" title="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="xb" d="M5 5 12.9 11.1 19 19 11.1 12.9ZM19 5 12.9 12.9 5 19 11.1 11.1Z" /></svg></button>
	<div class="mView"><div class="mTrack">
	<h2 id="rulesTitle">GAME INFO</h2><div id="rulesBody"></div>
	</div></div>
</div></div>
<div id="msg" class="overlay hidden" role="alertdialog" aria-modal="true"><div class="modal"><div class="mView"><div class="mTrack"><h2 id="msgTitle">MESSAGE</h2><p id="msgBody"></p><button id="msgOk">OK</button></div></div></div></div>

<!-- v3.16c: unfinished-round card (no X, no outside tap; only RESUME / SKIP) -->
<div id="resumeCard" class="overlay hidden" role="alertdialog" aria-modal="true" aria-labelledby="rcTitle"><div class="modal cf"><div class="mView"><div class="mTrack">
	<h2 id="rcTitle"></h2><p id="rcLine"></p>
	<div class="rcBtns"><button id="rcResume" class="go"></button><button id="rcSkip" class="go"></button></div>
</div></div></div></div>
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
