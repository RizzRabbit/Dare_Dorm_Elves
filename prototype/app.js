/* Elfhaus prototype renderer. It ONLY replays EVENTS.md book events produced by engine.js. */
(function(){
'use strict';
const E = window.DDE, $ = s => document.querySelector(s);
const NAMES = {H1:'ROXY',H2:'JADE',H3:'VI',H4:'COCO',L1:'DARE',L2:'LIPS',L3:'GOOD VIBES',L4:'RED CUP',L5:'LEAF',W:'WILD'};
const LINE_COLORS = ['#C8435F','#4E6A8C','#B79BE0','#7E9C6B','#9A6FB0','#8B7FA8','#5E8F95','#6E6880']; // painted UI palette
const BETS = [0.2,0.5,1,2,5,10,20,50,100];
const S = {balance:1000, betIdx:2, ante:false, turbo:false, busy:false, auto:0, sym:[], vals:new Map(), full:new Map(), groups:[], lastBook:null, inBonus:false, speed:1};
const qs = new URLSearchParams(location.search);
const FRAME = qs.get('frame');
const fmt = v => '$' + v.toLocaleString('en-US',{minimumFractionDigits:2, maximumFractionDigits:2});
const bet = () => BETS[S.betIdx];
const k = (r,row) => r*4+row;
let wait = ms => new Promise(res => setTimeout(res, ms * S.speed * (S.turbo?0.35:1) * ($('#slowMo')&&$('#slowMo').checked?2.5:1)));

// ---------- layout ----------
function layout(){
  const W = innerWidth, H = innerHeight, portrait = H > W*1.1;
  document.body.classList.toggle('portrait', portrait);
  let cell;
  if (portrait){ cell = Math.min((W-14-12-24)/5, (H-380)/4.2); }
  else { cell = Math.min((H-440)/4, (W-560)/5); }
  cell = Math.max(48, Math.floor(cell));
  document.documentElement.style.setProperty('--cell', cell+'px');
  document.documentElement.style.setProperty('--gap', '0px'); // gapless grid (Lilith's Curse look)
  S.cell = cell; S.gap = 0;
  renderAll();
}
const pos = (r,row) => ({x: r*(S.cell+S.gap), y: row*(S.cell+S.gap)});

// ---------- board rendering ----------
function symHTML(name, v){
  if (name==='W') return `<div class="sym W"><img src="assets/wild_single.png" alt=""><span class="plate">WILD</span></div><div class="badge">x${v||1}</div><div class="lock">LOCKED</div>`;
  if (name==='H1') return `<div class="sym H H1"><img src="assets/premium_H1_elf.png" alt=""><span class="nameTag">H1 ROXY</span></div>`;
  if (name==='H2') return `<div class="sym H H2"><img src="assets/premium_H2_elf.png" alt=""><span class="nameTag">H2 JADE</span></div>`;
  const t = name[0];
  return `<div class="sym ${t} ${name}"><span class="id">${name}</span><span class="nm">${NAMES[name]}</span>${t==='H'?'<span class="id">elf placeholder</span>':''}</div>`;
}
function buildCells(){
  const c = $('#cells'); c.innerHTML = '';
  for (let r=0;r<5;r++) for (let row=0;row<4;row++){
    const d = document.createElement('div'); d.className='cell'; d.id=`c${r}${row}`; c.appendChild(d);
  }
}
function cellEl(r,row){ return document.getElementById(`c${r}${row}`); }
function renderCell(r,row, cls){
  const d = cellEl(r,row), p = pos(r,row);
  d.style.left = p.x+'px'; d.style.top = p.y+'px';
  const name = S.sym[r] ? S.sym[r][row] : 'L5';
  d.innerHTML = symHTML(name, S.vals.get(k(r,row)));
  d.style.visibility = S.full.has(r) ? 'hidden' : 'visible';
  if (cls) { d.classList.remove(cls); void d.offsetWidth; d.classList.add(cls); }
}
function renderOverlays(anim){
  const o = $('#overlays'); o.innerHTML = '';
  const inGroup = new Set(); S.groups.forEach(g => g.reels.forEach(r => inGroup.add(r)));
  const w = n => n*S.cell + (n-1)*S.gap;
  S.groups.forEach(g => {
    const d = document.createElement('div'); d.className='ov merge';
    d.style.left = pos(g.reels[0],0).x+'px'; d.style.width = w(g.reels.length)+'px';
    const n = g.reels.length;
    d.innerHTML = g.reels.map((r,i)=>`<div class="wfph" style="left:${i*(S.cell+S.gap)}px;width:${S.cell}px"><span>ELF ${i+1}</span></div>`).join('') +
      `<div class="mlabel">${n} ELVES – merged ${n}-wide scene (placeholder art)</div>` +
      `<div class="badge">${g.values.map(v=>'x'+v).join(' × ')} = x${g.product}</div><div class="plate">WILD × ${n}</div>`;
    if (!anim) d.style.animation='none';
    o.appendChild(d);
  });
  [...S.full].forEach(([r,v]) => {
    if (inGroup.has(r)) return;
    const d = document.createElement('div'); d.className='ov full'; d.id='ov'+r;
    d.style.left = pos(r,0).x+'px'; d.style.width = S.cell+'px';
    d.innerHTML = `<div class="wfph" style="left:0;width:100%"><span>ONE ELF<br><small>covering pose<br>(WF art TBD)</small></span></div><div class="tag">FULL-REEL WILD (placeholder)</div><div class="badge">x${v}</div><div class="plate">WILD</div>`;
    if (!(anim===r)) d.style.animation='none';
    o.appendChild(d);
  });
}
function renderAll(){ for (let r=0;r<5;r++) for (let row=0;row<4;row++) renderCell(r,row); renderOverlays(false); clearLines(); }
function clearLines(){ $('#lines').innerHTML=''; document.querySelectorAll('.cell').forEach(c=>c.classList.remove('win','dim','replace','out')); }
function drawWins(wins){
  const svg = $('#lines'); svg.innerHTML='';
  document.querySelectorAll('.cell').forEach(c=>c.classList.add('dim'));
  wins.forEach((w,i) => {
    const ln = E.LINES[w.lineIndex-1];
    const pts = ln.map((row,r)=>{ const p=pos(r,row); return `${p.x+S.cell/2},${p.y+S.cell/2}`; }).slice(0, Math.max(w.count,5)).join(' ');
    const pl = document.createElementNS('http://www.w3.org/2000/svg','polyline');
    pl.setAttribute('points', pts); pl.setAttribute('stroke', LINE_COLORS[i%LINE_COLORS.length]); pl.setAttribute('opacity', '.85');
    svg.appendChild(pl);
    w.positions.forEach(p => { const c=cellEl(p.reel,p.row); c.classList.remove('dim'); c.classList.add('win'); });
  });
  // full-reel overlays never dim
}
function toast(html, ms){ const t=$('#stepToast'); t.innerHTML=html; t.classList.remove('hidden'); if (ms) setTimeout(()=>t.classList.add('hidden'), ms); }
let bannerT;
function banner(txt, ms=1400){ const b=$('#banner'); b.textContent=txt; b.classList.remove('hidden'); clearTimeout(bannerT); if (ms && !FRAME) bannerT=setTimeout(()=>b.classList.add('hidden'), ms*(S.turbo?.5:1)); }
function setWinMeter(x){ $('#win').textContent = fmt(x*bet()); }
function setBalance(){ $('#balance').textContent = fmt(S.balance); $('#bet').textContent = fmt(bet()*(S.ante?1.25:1)); }

// ---------- event handlers (EVENTS.md) ----------
const H = {
  async reveal(ev){
    clearLines(); $('#stepToast').classList.add('hidden');
    S.sym = ev.board.map(col => col.slice(1,5).map(s=>s.name));
    S.vals = new Map(); S.full = new Map(); S.groups = [];
    ev.locked.fullReels.forEach(f => S.full.set(f.reel, f.value));
    ev.board.forEach((col,r) => col.slice(1,5).forEach((s,row) => { if (s.wild && !S.full.has(r)) S.vals.set(k(r,row), s.multiplier||1); }));
    const lockedSingles = new Set(ev.locked.singles.map(s=>k(s.reel,s.row)));
    for (let r=0;r<5;r++) for (let row=0;row<4;row++){
      renderCell(r,row, lockedSingles.has(k(r,row)) ? null : 'drop');
      if (lockedSingles.has(k(r,row))) cellEl(r,row).classList.add('locked');
      const d=cellEl(r,row).querySelector('.sym'); if (d && !lockedSingles.has(k(r,row))) d.style.animationDelay = (r*0.07)+'s';
    }
    renderOverlays(false);
    if (ev.anticipation.some(a=>a>0)) banner('3 WILDS… THE RESPINS ARE THE REVEAL', 1600);
    await wait(650);
  },
  async stackComplete(ev){
    S.full.set(ev.reel, ev.value); for (let row=0;row<4;row++){ S.vals.delete(k(ev.reel,row)); cellEl(ev.reel,row).style.visibility='hidden'; }
    renderOverlays(ev.reel);
    banner(ev.instant ? `INSTANT STACK! REEL ${ev.reel+1} = x4` : `STACK BUILT! REEL ${ev.reel+1} = ${ev.parts.join(' + ')} = x${ev.value}`, 1800);
    await wait(900);
  },
  async mergeGroups(ev){
    const grew = ev.groups.some(g => !S.groups.find(o => o.reels.join()===g.reels.join()));
    S.groups = ev.groups; renderOverlays(false);
    if (grew && ev.groups.length){ const g=ev.groups[ev.groups.length-1]; banner(`MERGE! ${g.reels.length} ELVES · ${g.values.map(v=>'x'+v).join(' × ')} = x${g.product}`, 1800); await wait(900); }
  },
  async winInfo(ev){
    drawWins(ev.wins);
    const top = ev.wins.slice().sort((a,b)=>b.win-a.win)[0];
    toast(`+${fmt(ev.totalWin/100*bet())}<small>step ${ev.step} · ${ev.wins.length} line${ev.wins.length>1?'s':''} · best L${top.lineIndex} ${top.count}×${top.symbol} ×${top.meta.lineMult}</small>`);
    await wait(1100);
  },
  async updateStepWin(ev){ setWinMeter(S.roundBase + ev.amount/100); },
  async wildGrow(ev){
    ev.changes.forEach(c => {
      let badge;
      if (c.kind==='full'){ S.full.set(c.reel, c.to); S.groups.forEach(g=>{ const i=g.reels.indexOf(c.reel); if (i>=0){ g.values[i]=c.to; g.product=g.values.reduce((a,b)=>a*b,1);} }); }
      else S.vals.set(k(c.reel,c.row), c.to);
    });
    renderOverlays(false);
    ev.changes.forEach(c => {
      if (c.kind==='single'){ const el=cellEl(c.reel,c.row); const b=el.querySelector('.badge'); if (b){ b.textContent='x'+c.to; b.classList.add('grow'); }
        const p=document.createElement('div'); p.className='plus'; p.textContent='+1'; el.appendChild(p); }
    });
    document.querySelectorAll('.ov .badge').forEach(b=>b.classList.add('grow'));
    await wait(650);
  },
  async respinStart(ev){
    $('#stepToast').classList.add('hidden');
    document.querySelectorAll('.cell').forEach(c=>c.classList.remove('win','dim'));
    $('#lines').innerHTML='';
    ev.locked.singles.forEach(s => cellEl(s.reel,s.row).classList.add('locked'));
    ev.replace.forEach(p => cellEl(p.reel,p.row).classList.add('replace'));
    banner(`RESPIN ${ev.step} / 3 · wilds lock · ${ev.replace.length} cells respin`, 1300);
    await wait(700);
    ev.replace.forEach(p => cellEl(p.reel,p.row).classList.add('out'));
    await wait(250);
  },
  async respinReveal(ev){
    ev.newSymbols.forEach(s => { S.sym[s.reel][s.row] = s.name; if (s.wild) S.vals.set(k(s.reel,s.row), s.multiplier); else S.vals.delete(k(s.reel,s.row));
      const el=cellEl(s.reel,s.row); el.classList.remove('out','replace'); renderCell(s.reel,s.row,'drop'); });
    if (ev.newSymbols.some(s=>s.wild)) banner('NEW WILD LANDS!', 1000);
    await wait(500);
  },
  async respinEnd(ev){
    const why = {noConnection:'no new connection', maxRespins:'max 3 respins', wincap:'50,000x reached'}[ev.reason]||ev.reason;
    banner(`RESPINS END · ${why}`, 1000); await wait(450);
  },
  async setWin(ev){
    const x = ev.amount/100;
    if (x >= 10){ await bigWin(x); }
  },
  async setTotalWin(ev){ setWinMeter(ev.amount/100); S.roundBase = ev.amount/100; },
  async freeSpinTrigger(ev){
    $('#stepToast').classList.add('hidden');
    const I=$('#intro'); I.querySelector('.tierName').textContent = E.TIER_LABEL[ev.tier].toUpperCase()+'!';
    I.querySelector('.spins').textContent = `${ev.totalFs} FREE SPINS`;
    const c=ev.carried; I.querySelector('.carried').textContent = 'Carried in: ' + [...c.fullReels.map(f=>`Reel ${f.reel+1} full-reel x${f.value}`), ...c.singles.map(s=>`wild R${s.reel+1}r${s.row} x${s.value}`)].join(' · ') + `  (${ev.source})`;
    I.classList.remove('hidden');
    if (FRAME) return;
    await Promise.race([wait(2600), new Promise(res=>I.querySelector('.cont').onclick=res)]);
    I.classList.add('hidden');
    S.inBonus = true; document.body.classList.add('inBonus'); $('#fsBar').classList.remove('hidden');
    $('#fsTier').textContent = E.TIER_LABEL[ev.tier].toUpperCase(); $('#fsCount').textContent = `FREE SPIN 0 / ${ev.totalFs}`;
  },
  async updateFreeSpin(ev){
    S.inBonus = true; document.body.classList.add('inBonus'); $('#fsBar').classList.remove('hidden');
    if (ev.tier) $('#fsTier').textContent = E.TIER_LABEL[ev.tier].toUpperCase();
    $('#fsCount').textContent = `FREE SPIN ${ev.amount} / ${ev.total}`;
    await wait(250);
  },
  async freeSpinRetrigger(ev){ banner(ev.addedFs ? `+${ev.addedFs} SPINS! (${ev.newStacks.length} new stack${ev.newStacks.length>1?'s':''})` : 'NEW STACK – spin cap 18 reached', 1500);
    $('#fsCount').textContent = $('#fsCount').textContent.replace(/\/ \d+/, '/ '+ev.totalFs); await wait(900); },
  async bonusUpgrade(ev){ $('#stepToast').classList.add('hidden'); // SPEC §6 LOCKED: Dare's first stack upgrades once to Double Dare (+2); wilds lock from now on
    banner(`${E.TIER_LABEL[ev.from].toUpperCase()} → ${E.TIER_LABEL[ev.to].toUpperCase()} +${ev.spinsAdded}`, 2200);
    $('#fsTier').textContent = E.TIER_LABEL[ev.to].toUpperCase();
    $('#fsCount').textContent = $('#fsCount').textContent.replace(/\/ \d+/, '/ '+ev.totalFs); await wait(1400); },
  async freeSpinEnd(ev){
    banner(`BONUS COMPLETE · ${fmt(ev.amount/100*bet())}`, 2200); await wait(1600);
    document.body.classList.remove('inBonus'); $('#fsBar').classList.add('hidden'); S.inBonus=false;
  },
  async mysteryStart(ev){ banner(`MYSTERY SPIN · no bonus ${ev.odds.none}% · Double ${ev.odds.double_dare}% · Triple ${ev.odds.triple_dare}% · Hidden ${ev.odds.hidden}%`, 2000); await wait(900); },
  async mysteryResult(ev){ banner(ev.outcome==='none' ? 'MYSTERY RESULT: NO BONUS' : `MYSTERY RESULT: ${E.TIER_LABEL[ev.outcome].toUpperCase()}!`, 1800); await wait(1100); },
  async egwStart(ev){ banner(`ELVES GONE WILD · stacks on reels ${ev.reels.map(r=>r+1).join(', ')} (x4 each)`, 1800); await wait(700); },
  async buyTriggerStart(ev){ banner(`BOUGHT ${E.TIER_LABEL[ev.tier].toUpperCase()} · real trigger spin`, 1600); await wait(700); },
  async wincap(ev){ await bigWin(50000, 'MAX WIN'); },
  async finalWin(ev){ S.balance += ev.amount/100*bet(); setBalance(); setWinMeter(ev.amount/100); },
};
async function bigWin(x, label){
  const tier = label || (x>=1000?'LEGENDARY WIN':x>=100?'EPIC WIN':x>=50?'SUPER WIN':x>=25?'MEGA WIN':'BIG WIN');
  const B=$('#bigwin'); B.querySelector('.bwTier').textContent = tier; B.querySelector('.bwX').textContent = `${x.toLocaleString('en-US')}x bet`;
  B.classList.remove('hidden');
  const amt = B.querySelector('.bwAmt'), steps = FRAME ? 1 : 30;
  for (let i=1;i<=steps;i++){ amt.textContent = fmt(x*bet()*i/steps); if (!FRAME) await wait(45); }
  if (FRAME) return;
  await wait(1500); B.classList.add('hidden');
}

// ---------- player ----------
async function playBook(bk, stopAt){
  S.lastBook = bk; S.roundBase = 0;
  for (const ev of bk.events){
    if (stopAt && stopAt(ev)) return ev;
    if (FRAME && ev.type!=='setWin' && ev.type!=='wincap') $('#bigwin').classList.add('hidden');
    const h = H[ev.type]; if (h) await h(ev);
    if (stopAt && stopAt.after && stopAt.after(ev)) return ev;
  }
}
function setBusy(b){ S.busy=b; $('#spinBtn').classList.toggle('busy',b); ['#buyBtn','#betUp','#betDown','#anteBtn','#menuBtn'].forEach(s=>$(s).disabled=b); }
async function round(mode){
  if (S.busy) return;
  const cost = E.MODES[mode].cost * bet();
  if (S.balance < cost){ banner('INSUFFICIENT FUNDS', 1500); S.auto=0; return; }
  setBusy(true); S.balance -= cost; setBalance(); setWinMeter(0);
  const bk = E.book(mode);
  try { await playBook(bk); } finally { setBusy(false); }
  if (S.auto>0){ S.auto--; setAuto(); if (S.auto) setTimeout(()=>round(S.ante?'ante':'base'), 300); }
}

// ---------- UI ----------
function setAuto(){ const b=$('#autoBtn'); b.dataset.n = S.auto||''; b.classList.toggle('on', S.auto>0); }
function buildBuy(){
  const desc = {dare:'Real trigger spin → 8 free spins; wilds clear each spin; first stack upgrades to Double Dare +2.', double_dare:'Trigger spin → 10 free spins with 1 locked full-reel wild.',
    triple_dare:'Trigger spin → 12 free spins: full-reel wild + ≥2 sticky wilds.', mystery:'One paid spin with respins; the respins are the reveal. No bonus 50% · Double 37% · Triple 10% · Hidden 3%. Decided before the reveal.',
    egw:'One supercharged spin: 2–5 full-reel wilds (x4) placed first. No bonus.'};
  $('#buyCards').innerHTML = ['dare','double_dare','triple_dare','mystery','egw'].map(m =>
    `<div class="bcard"><h3>${E.MODES[m].label.toUpperCase()}</h3><p>${desc[m]}</p><div class="price">${fmt(E.MODES[m].cost*bet())}</div><div class="mult">${E.MODES[m].cost}x bet (toy)</div><button data-m="${m}">BUY</button></div>`).join('');
  $('#buyCards').querySelectorAll('button').forEach(b => b.onclick = () => {
    const m=b.dataset.m; $('#buyConfirm').classList.remove('hidden');
    $('#buyConfirmText').textContent = `Buy ${E.MODES[m].label} for ${fmt(E.MODES[m].cost*bet())}?`;
    $('#buyYes').onclick = () => { $('#buyMenu').classList.add('hidden'); $('#buyConfirm').classList.add('hidden'); round(m); };
  });
}
function buildRules(){
  const pt = Object.entries(E.PAY).map(([s,p])=>`<tr><td>${s}</td><td>${NAMES[s]}</td><td>${(p[0]/20).toFixed(2)}x</td><td>${(p[1]/20).toFixed(2)}x</td><td>${(p[2]/20).toFixed(2)}x</td></tr>`).join('');
  $('#rulesBody').innerHTML = `<p>5 reels × 4 rows, 20 fixed lines, left to right, 3+ of a kind. Every wild has its own multiplier: it starts at x1 and gains +1 on every respin step it connects. A win through a wild triggers a respin: the non-wild symbols of every winning line respin, wilds lock, everything else stays. Up to 3 respins; every step pays. 4 wilds on a reel become a full-reel wild worth the sum of the 4. Adjacent full-reel wilds multiply; others add.</p>
  <p>Bonuses: Dare 8 · Double Dare 10 · Triple Dare 12 · Hidden 14 free spins, +2 per new stack, max 18 spins. Max win 50,000x bet.</p>
  <table><tr><th>id</th><th>symbol</th><th>3</th><th>4</th><th>5</th></tr>${pt}</table><p>Line pays shown in x total bet.</p>
  <p><b>PROTOTYPE – untuned math. RTP not representative.</b></p>
  <p style="opacity:.75">Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Engine.</p>`;
}
function buildDev(){
  $('#devScen').innerHTML = Object.keys(E.EX).concat(['E11']).map(id=>`<button data-id="${id}">${id}</button>`).join('');
  $('#devScen').querySelectorAll('button').forEach(b => b.onclick = async () => {
    const id=b.dataset.id, out=$('#devResult');
    if (id==='E11'){ let s=8; s=E.addSpins(s,1); const a=s; s=E.addSpins(s,2); let h=E.addSpins(14,2); const h3=E.addSpins(h,1);
      const ok = a===10&&s===14&&h===18&&h3===18; out.innerHTML=`E11 spin counts: Dare 8→${a}→${s}; Hidden 14+2 stacks→${h}, +1 more→${h3}  <span class="${ok?'ok':'bad'}">${ok?'MATCH':'MISMATCH'}</span>`; return; }
    if (S.busy) return; const bk=E.exampleBook(id), ex=E.EX[id];
    const ok = Math.abs(bk.spinX-ex.expected)<1e-9;
    out.innerHTML = `${id}: ${ex.title}\nexpected ${ex.expected}x · actual ${bk.spinX}x${ex.expectedRound?` · round paid ${bk.payoutMultiplier/100}x (cap ${ex.expectedRound})`:''}  <span class="${ok?'ok':'bad'}">${ok?'MATCH':'MISMATCH'}</span>`;
    setBusy(true); setWinMeter(0); try { await playBook(bk); } finally { setBusy(false); document.body.classList.remove('inBonus'); $('#fsBar').classList.add('hidden'); $('#intro').classList.add('hidden'); }
  });
  $('#apMode').innerHTML = Object.keys(E.MODES).map(m=>`<option value="${m}">${m}</option>`).join('');
  $('#apGo').onclick = () => { const m=$('#apMode').value; const n=Math.min(+$('#apN').value||1000, 200000);
    $('#apOut').textContent='running…'; setTimeout(()=>{ const t=performance.now(); const a=E.autoplay(m,n);
      $('#apOut').textContent = `${m} × ${n} (cost ${a.cost}x)\nhit rate ${(a.hitRate*100).toFixed(2)}%\nobserved RTP ${(a.rtp*100).toFixed(2)}%\nmean ${a.meanX.toFixed(2)}x · max ${a.maxX}x\nP(≥5,000x) ${(a.p5k*100).toFixed(3)}%\ntriggers ${JSON.stringify(a.triggers)}\n${(performance.now()-t).toFixed(0)} ms — sanity only, NOT tuning`; }, 30); };
  $('#dumpBook').onclick = () => console.log(JSON.stringify(S.lastBook, null, 1));
}
function wire(){
  $('#spinBtn').onclick = () => round(S.ante?'ante':'base');
  $('#betUp').onclick = () => { S.betIdx=Math.min(BETS.length-1,S.betIdx+1); setBalance(); buildBuy(); };
  $('#betDown').onclick = () => { S.betIdx=Math.max(0,S.betIdx-1); setBalance(); buildBuy(); };
  $('#anteBtn').onclick = () => { S.ante=!S.ante; $('#anteBtn').classList.toggle('on',S.ante); setBalance(); };
  $('#turboBtn').onclick = () => { S.turbo=!S.turbo; $('#turboBtn').classList.toggle('on',S.turbo); };
  $('#autoBtn').onclick = () => { if (S.auto){ S.auto=0; setAuto(); return; } S.auto=10; setAuto(); round(S.ante?'ante':'base'); };
  $('#buyBtn').onclick = () => { buildBuy(); $('#buyMenu').classList.remove('hidden'); };
  $('#buyClose').onclick = $('#buyNo').onclick = () => { $('#buyMenu').classList.add('hidden'); $('#buyConfirm').classList.add('hidden'); };
  $('#menuBtn').onclick = () => $('#menu').classList.remove('hidden');
  $('#menuClose').onclick = () => $('#menu').classList.add('hidden');
  $('#devBtn').onclick = () => $('#dev').classList.toggle('hidden');
  $('#devClose').onclick = () => $('#dev').classList.add('hidden');
  addEventListener('keydown', e => { if (e.code==='Space' && !e.repeat && $('#buyMenu').classList.contains('hidden') && $('#menu').classList.contains('hidden')){ e.preventDefault(); round(S.ante?'ante':'base'); } });
  addEventListener('resize', layout);
}
function idleBoard(){ E.seed(7); const bk=E.book('base'); const rv=bk.events.find(e=>e.type==='reveal');
  S.sym = rv.board.map(c=>c.slice(1,5).map(s=>s.name)); S.vals=new Map(); rv.board.forEach((c,r)=>c.slice(1,5).forEach((s,row)=>{ if(s.wild) S.vals.set(k(r,row),1); })); E.seed(null); }

// ---------- reference-frame states (?frame=...) ----------
async function frame(name){
  S.speed = 0; wait = () => Promise.resolve();
  const at = (id, pred, after) => { const f = pred; f.after = after; return playBook(E.exampleBook(id), f); };
  let n = 0;
  switch(name){
    case 'base': break;
    case 'respin': // E3: after step-2 growth, showing locked growing wilds + replace markers for respin 3
      await at('E3', ev => ev.type==='respinReveal' && ev.step===3); break;
    case 'fullreel': await at('E3', ()=>false, ev => ev.type==='wildGrow' && ev.step===3); clearLines(); banner('STACK BUILT! REEL 3 = 4 + 4 + 3 + 1 = x12 → grew to x13'); break;
    case 'merged': await at('E5', ()=>false, ev => ev.type==='winInfo'); break;
    case 'intro': await at('E3', ()=>false, ev => ev.type==='freeSpinTrigger'); break;
    case 'bonus': await at('E10', ()=>false, ev => ev.type==='winInfo' && ev.step===1); break;
    case 'mystery': await at('E8', ()=>false, ev => ev.type==='stackComplete'); break;
    case 'buy': buildBuy(); $('#buyMenu').classList.remove('hidden'); break;
    case 'bigwin': await at('E4', ()=>false, ev => ev.type==='setWin'); break;
    case 'upgrade': await at('E13', ()=>false, ev => ev.type==='bonusUpgrade'); break;
    case 'wincap': await at('E12', ()=>false, ev => ev.type==='wincap'); break;
    case 'dev': { $('#dev').classList.remove('hidden'); const bk=E.exampleBook('E5');
      $('#devResult').innerHTML = `E5: ${E.EX.E5.title}\nexpected ${E.EX.E5.expected}x · actual ${bk.spinX}x  <span class="ok">MATCH</span>`;
      E.seed(3); $('#apN').value=5000; $('#apGo').click(); await new Promise(r=>setTimeout(r,2500)); break; }
  }
  document.title = 'READY';
}

buildCells(); buildRules(); buildDev(); wire(); idleBoard(); layout(); setBalance();
if (FRAME) frame(FRAME);
})();
