/* Dare Dorm – Elves: PROTOTYPE engine (untuned math).
 * Port of design/prototypes/reference_rules.py (SPEC §3–§4) + toy book generators (SPEC §5–§9) that emit
 * EVENTS.md-shaped book events. Math produces books; the renderer (app.js) only replays them.
 * Board convention: sym[reel][row], reel 0-4, row 0-3 (top→bottom). Pays in line-bet units (lb); 20 lb = 1x bet.
 * Event amounts = x bet × 100 (lb × 5). */
(function (root) {
'use strict';
const ROWS = 4, REELS = 5, CAP_X = 50000, SPIN_CAP = 18;
const LINES = [[0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],[3,3,3,3,3],[0,1,2,1,0],[3,2,1,2,3],[1,0,0,0,1],[2,3,3,3,2],
 [0,1,0,1,0],[3,2,3,2,3],[1,2,1,2,1],[2,1,2,1,2],[0,0,1,0,0],[3,3,2,3,3],[1,1,0,1,1],[2,2,3,2,2],
 [0,1,1,1,0],[3,2,2,2,3],[1,2,3,2,1],[2,1,0,1,2]];
const PAY = {W:[25,100,500],H1:[25,100,500],H2:[20,75,300],H3:[15,50,200],H4:[10,40,150],
  L1:[5,20,80],L2:[5,15,60],L3:[4,10,40],L4:[3,8,30],L5:[3,8,30]};
const SYMS = ['H1','H2','H3','H4','L1','L2','L3','L4','L5'];
const WT = [2,3,4,5,8,9,10,11,11];
const START_FS = {dare:8, double_dare:10, triple_dare:12, hidden:14};
const MYSTERY_ODDS = {none:50, double_dare:37, triple_dare:10, hidden:3};
// PROTOTYPE – untuned toy parameters (from design/prototypes/toy_sim4.py P0) and toy buy prices (SPEC §10 toy ranges).
const P = {
  // Toy weights v2 (user tuning rule 2026-10-23): wilds/stacks weighed down HEAVILY; rarity order REEL 2 < REEL 3 < REEL 1 < reels 4–5.
  q:[0.00015,0.00004,0.00008,0.0006,0.0006], w:[0.005,0.002,0.003,0.022,0.026],
  qa:[0.0003,0.00008,0.00016,0.0012,0.0012], wa:[0.007,0.003,0.004,0.027,0.032],
  qb:{dare:null,double_dare:null,triple_dare:null,hidden:null}, wb:{dare:null,double_dare:null,triple_dare:null,hidden:null},
  qt:[0.03,0.004,0.01,0.05,0.05], wt:{dare:0.10,double_dare:0.03,triple_dare:0.06,hidden:0.03},
  egw:[[[1,3],30],[[1,4],15],[[2,4],15],[[1,5],10],[[2,5],10],[[1,3,5],12],[[1,2],4],[[4,5],4],[[1,2,4],1.5],[[2,3],1],[[3,4],1],
       [[2,3,4],0.12],[[1,2,3],0.08],[[1,2,4,5],0.04],[[2,3,4,5],0.005],[[1,2,3,4],0.003],[[1,2,3,4,5],0.002]],
  wegw:0.004,
  // (bonus odds identical across tiers per A3 in this toy)
  wMystery:{double_dare:0.30, triple_dare:0.30, hidden:0.45}, // respin wild density on the Mystery reveal (toy)
};
for (const t of ['dare','double_dare','triple_dare','hidden']){ P.qb[t]=[0.0003,0.00008,0.00015,0.002,0.002]; P.wb[t]=[0.0015,0.0005,0.001,0.006,0.008]; }
const MODES = {
  base:{label:'Spin', cost:1}, ante:{label:'Ante', cost:1.25},
  dare:{label:'Dare', cost:40}, double_dare:{label:'Double Dare', cost:210}, triple_dare:{label:'Triple Dare', cost:1000},
  mystery:{label:'Mystery Spin', cost:245}, egw:{label:'Elves Gone Wild', cost:200},
};
const TIER_LABEL = {dare:'Dare', double_dare:'Double Dare', triple_dare:'Triple Dare', hidden:'Hidden'};

// ---------- RNG ----------
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
let rnd = Math.random;
function seed(s){ rnd = s == null ? Math.random : mulberry32(s); }
function pickW(items, weights){ let t=0; for (const w of weights) t+=w; let x=rnd()*t; for (let i=0;i<items.length;i++){ x-=weights[i]; if (x<0) return items[i]; } return items[items.length-1]; }
function drawSym(w){ return rnd() < w ? 'W' : pickW(SYMS, WT); }
const wl = w => Array.isArray(w) ? w : [w,w,w,w,w];

// ---------- reference rules (exact port) ----------
const key = (r,row) => r*ROWS+row;
const cr = k => [Math.floor(k/ROWS), k%ROWS];
function parse(txt){ const rows = txt.trim().split('\n').map(l => l.trim().split(/\s+/));
  const s=[]; for (let r=0;r<REELS;r++){ s.push([]); for (let row=0;row<ROWS;row++) s[r].push(rows[row][r]); } return s; }

function lineMult(run, sym, sv, full){ // A1/A2
  let m=0, i=0; const groups=[];
  while (i<run.length){ const [r,row]=run[i];
    if (full.has(r)){ let p=1; const reels=[], values=[];
      while (i<run.length && full.has(run[i][0])){ p*=full.get(run[i][0]); reels.push(run[i][0]); values.push(full.get(run[i][0])); i++; }
      m+=p; groups.push(reels.length>1 ? {type:'merge',reels,values,product:p} : {type:'full',reel:reels[0],value:values[0]});
    } else { if (sym[r][row]==='W'){ const v=sv.get(key(r,row)); m+=v; groups.push({type:'single',reel:r,row,value:v}); } i++; }
  }
  return {m: Math.max(1,m), groups};
}
function evaluate(sym, sv, full){
  let lb=0; const conw=new Set(), resp=new Set(), wins=[];
  LINES.forEach((ln,i)=>{
    const cells = ln.map((row,r)=>sym[r][row]);
    const base = cells.find(s=>s!=='W') || 'W';
    let n=0; for (const s of cells){ if (s===base||s==='W') n++; else break; }
    let wn=0; for (const s of cells){ if (s==='W') wn++; else break; }
    if (n<3 && wn<3) return;
    const ps = n>=3 ? PAY[base][n-3] : 0, pw = wn>=3 ? PAY.W[wn-3] : 0;
    const [k, s_] = ps>=pw ? [n, base] : [wn, 'W'];
    const run = []; for (let r=0;r<k;r++) run.push([r, ln[r]]);
    const {m, groups} = lineMult(run, sym, sv, full); const p = Math.max(ps,pw);
    lb += p*m;
    const wc = run.filter(([r,row])=>sym[r][row]==='W');
    run.forEach(([r,row])=>{ if (sym[r][row]!=='W') resp.add(key(r,row)); });       // R3: every winning line
    wc.forEach(([r,row])=>conw.add(full.has(r) ? 'F'+r : key(r,row)));               // trigger: wild connection only
    wins.push({lineIndex:i+1, symbol:s_, count:k, win:p*m*5, positions:run.map(([reel,row])=>({reel,row})),
      meta:{basePay:p, lineMult:m, connected:wc.length>0, groups}});
  });
  return {lb, conw, resp, wins};
}
function mergeGroupsOf(full){ const g=[]; let cur=[];
  for (let r=0;r<=REELS;r++){ if (r<REELS && full.has(r)) cur.push(r); else { if (cur.length>1) g.push({reels:cur, values:cur.map(x=>full.get(x)), product:cur.reduce((a,x)=>a*full.get(x),1)}); cur=[]; } }
  return g; }
const lockedOf = (full, sv) => ({fullReels:[...full].map(([reel,value])=>({reel,value})).sort((a,b)=>a.reel-b.reel),
  singles:[...sv].map(([k,value])=>{const [reel,row]=cr(k); return {reel,row,value};})});
function symObj(s, v){ return s==='W' ? {name:'W', wild:true, multiplier:v||1} : {name:s}; }

/* One spin sequence (step 0 + ≤3 respins). sym is mutated. opts:
 *  rep(step, respCells[]) -> {cellKey: sym} replacements (scripted) | null = stop; landed: Set of cell keys landed at step 0
 *  maxSteps, priorX (round total before, x), emit(ev) */
function sequence(sym, sv, full, opts){
  const emit = opts.emit || (()=>{}); const maxSteps = opts.maxSteps==null ? 3 : opts.maxSteps;
  let total=0, step=0, landed=opts.landed || new Set(), capped=false, reason='noConnection', prevGroups=JSON.stringify(mergeGroupsOf(full));
  const newStacks=[];
  while (true){
    for (let r=0;r<REELS;r++){
      if (!full.has(r) && sym[r].every(s=>s==='W')){
        const parts=[0,1,2,3].map(row=>sv.get(key(r,row))); const instant=[0,1,2,3].every(row=>landed.has(key(r,row)));
        const v=parts.reduce((a,b)=>a+b,0); [0,1,2,3].forEach(row=>sv.delete(key(r,row))); full.set(r,v); newStacks.push(r);
        emit({type:'stackComplete', step, reel:r, parts, value:v, instant});
      }
    }
    let g=JSON.stringify(mergeGroupsOf(full)); if (g!==prevGroups){ emit({type:'mergeGroups', step, groups:JSON.parse(g)}); prevGroups=g; }
    const ev = evaluate(sym, sv, full);
    total += ev.lb;
    if (ev.lb>0){ emit({type:'winInfo', step, totalWin:ev.lb*5, wins:ev.wins}); emit({type:'updateStepWin', amount:total*5}); }
    if (opts.priorX!=null && opts.priorX + total/20 >= CAP_X){ capped=true; reason='wincap'; if (step>0||ev.conw.size) emit({type:'respinEnd', step, reason}); break; }
    if (ev.conw.size){ const changes=[];
      for (const c of ev.conw){ if (typeof c==='string'){ const r=+c.slice(1); changes.push({kind:'full',reel:r,from:full.get(r),to:full.get(r)+1}); full.set(r,full.get(r)+1); }
        else { const [reel,row]=cr(c); changes.push({kind:'single',reel,row,from:sv.get(c),to:sv.get(c)+1}); sv.set(c,sv.get(c)+1); } }
      changes.sort((a,b)=>a.reel-b.reel||(a.row||0)-(b.row||0));
      emit({type:'wildGrow', step, changes});
      g=JSON.stringify(mergeGroupsOf(full)); if (g!==prevGroups){ emit({type:'mergeGroups', step, groups:JSON.parse(g)}); prevGroups=g; }
    }
    if (!ev.conw.size){ reason='noConnection'; if (step>0) emit({type:'respinEnd', step, reason}); break; }
    if (step===Math.min(3,maxSteps)){ reason='maxRespins'; if (maxSteps===3) emit({type:'respinEnd', step, reason}); break; }
    const respCells=[...ev.resp].sort((a,b)=>a-b);
    const rep = opts.rep(step+1, respCells);
    if (rep==null){ reason='scriptEnd'; break; }
    step++;
    emit({type:'respinStart', step, replace:respCells.map(k=>{const [reel,row]=cr(k); return {reel,row};}), locked:lockedOf(full,sv), remaining:3-step});
    const newSymbols=[]; landed=new Set();
    for (const k of respCells){ const s=rep[k]; const [r,row]=cr(k); sym[r][row]=s; landed.add(k); if (s==='W') sv.set(k,1);
      newSymbols.push(Object.assign({reel:r,row,name:s}, s==='W'?{wild:true,multiplier:1}:{})); }
    emit({type:'respinReveal', step, newSymbols});
  }
  return {lb:total, x: capped ? CAP_X-(opts.priorX||0) : total/20, rawX: total/20, capped, newStacks, steps:step, reason};
}

// ---------- scripted play (worked examples), mirrors reference_rules.play ----------
const FILL = ['L5','L3','H4','L1'];
function play(board, {steps=[], full:fullIn=null, sticky=null, maxSteps=3, priorX=null, emit=null}={}){
  const sym=parse(board); const full=new Map(Object.entries(fullIn||{}).map(([k,v])=>[+k,v])); const sv=new Map();
  for (let r=0;r<REELS;r++) for (let row=0;row<ROWS;row++) if (sym[r][row]==='W') sv.set(key(r,row), (sticky&&sticky[`${r},${row}`])||1);
  for (const r of full.keys()) for (let row=0;row<ROWS;row++){ sym[r][row]='W'; sv.delete(key(r,row)); }
  const initSym = sym.map(c=>c.slice()), initSv=new Map(sv), initFull=new Map(full);
  const landed=new Set(); for (let r=0;r<REELS;r++) if (!full.has(r)) for (let row=0;row<ROWS;row++) if (!(sticky&&sticky[`${r},${row}`])) landed.add(key(r,row));
  const rep=(step, resp)=>{ let s = step-1<steps.length ? steps[step-1] : undefined;
    if (s===undefined) return null;
    const out={}; for (const k of resp){ const [r,row]=cr(k); const v = s==='AUTO' ? undefined : s[`${r},${row}`]; out[k] = v || FILL[(r+row)%4]; }
    if (s!=='AUTO') for (const kk of Object.keys(s)){ const [r,row]=kk.split(',').map(Number); if (!resp.includes(key(r,row))) throw new Error(`step${step}: replacement for non-respun cell ${kk}`); }
    return out; };
  const res = sequence(sym, sv, full, {rep, landed, maxSteps, priorX, emit});
  return Object.assign(res, {full, sv, initSym, initSv, initFull, finalSym:sym});
}

// Worked examples (SPEC §12), identical inputs to design/prototypes/worked_examples.py
const EX = {
 E1:{title:'Base line win, no wild', expected:1.25, board:`H1 H1 H1 L2 L3
L4 H2 L1 H3 L5
L1 L3 H4 L4 L2
H3 L5 L2 L1 H4`},
 E2:{title:'Base respin: replaced cells, wild locks & grows', expected:1.5, board:`H2 H2 W  L1 L3
L4 H3 L5 H3 L5
L1 L3 H4 L4 L2
H3 L5 L2 L1 H4`, steps:[{'0,0':'L2','1,0':'L2'},{'0,0':'H4','1,0':'L1'}]},
 E2b:{title:'A win without a wild is also replaced (R3)', expected:2.75, board:`H2 H2 W  L1 L3
L4 H3 L5 H3 L5
L1 L3 H4 L4 L2
H1 H1 H1 L1 H4`, steps:[{'0,0':'L2','1,0':'L2','0,3':'H4','1,3':'L5','2,3':'L3'},{'0,0':'H4','1,0':'L1'}]},
 E3:{title:'Respins build a stack (4+4+3+1 = x12) → Triple Dare', expected:179.1, tier:'triple_dare', board:`H2 H2 W  L1 L3
L4 W  W  L2 L5
L2 L3 L2 L4 L2
H3 L5 L3 L1 H4`, steps:[{'0,0':'L3','0,1':'H4','0,2':'H1','1,0':'L5','2,2':'W','3,1':'H3','4,2':'L4'},
 {'0,0':'L4','0,1':'L1','0,2':'W'},{'0,0':'L2','0,1':'L5','1,2':'H1','2,3':'W','3,1':'L4'}]},
 E4:{title:'Instant stacks R1+R3 (x4 each) add → Hidden', expected:350.1, tier:'hidden', board:`W L2 W L4 H2
W H3 W L1 L3
W L4 W H3 L5
W L1 W L2 L4`, steps:[{'1,0':'L3','1,1':'L5','1,2':'L4','1,3':'L5'},{'1,0':'H4','1,1':'L1','1,2':'L2','1,3':'H1'},'AUTO']},
 E5:{title:'Mixed groups: (x6 × x5) + x7 = x37 (first eval)', expected:2440.15, board:`W W H2 W L3
W W L1 W H2
W W L4 W L4
W W H3 W L1`, full:{0:6,1:5,3:7}, maxSteps:0},
 E6:{title:'3 adjacent multiply: 2×3×4 = x24 (+single x2)', expected:1262, board:`W W W W  L3
W W W L1 H2
W W W L4 L4
W W W H3 L1`, full:{0:2,1:3,2:4}, sticky:{'3,0':2}, maxSteps:0},
 E7:{title:'Mystery – bucket “no bonus”', expected:3.4, mystery:'none', board:`L2 H4 W  L3 L1
H4 H4 W  L1 L5
L1 L3 W  H2 L4
L3 L5 L2 L4 H1`, steps:[{'0,1':'L5','0,3':'H1','1,0':'L1','1,1':'L2','1,2':'H3'},{'0,0':'H3','1,1':'L4'}]},
 E8:{title:'Mystery – bucket “Double Dare”', expected:92.4, mystery:'double_dare', tier:'double_dare', board:`L2 H4 W  L3 L1
H4 H4 W  L1 L5
H2 H2 W  H2 L4
L3 L5 L3 L4 H1`, steps:[{'0,1':'L5','0,2':'H3','1,0':'L1','1,1':'H1','1,2':'W','3,2':'L4'},{'0,1':'L4','0,2':'L1','0,3':'H2','2,3':'W'},'AUTO']},
 E9:{title:'EGW pattern R1/R3/R5 (x4 each)', expected:374.5, egw:[0,2,4], board:`W L2 W H4 W
W H1 W L2 W
W L4 W H1 W
W L3 W L5 W`, full:{0:4,2:4,4:4}, steps:['AUTO','AUTO','AUTO']},
 E10:{title:'Double Dare free spin, R3 locked x13 grows', expected:72.3, freegame:{tier:'double_dare', spin:3, total:10}, board:`H3 H3 W  H1 L1
L1 L2 W  L5 L4
H2 L4 W  L3 L3
L4 H3 W  H3 L2`, full:{2:13}, steps:['AUTO','AUTO','AUTO']},
 E13:{title:'Dare FS 3/8: respins complete R3 → UPGRADE to Double Dare +2', expected:92.4, upgradeFrom:'dare', freegame:{tier:'dare', spin:3, total:8}, board:`L2 H4 W  L3 L1
H4 H4 W  L1 L5
H2 H2 W  H2 L4
L3 L5 L3 L4 H1`, steps:[{'0,1':'L5','0,2':'H3','1,0':'L1','1,1':'H1','1,2':'W','3,2':'L4'},{'0,1':'L4','0,2':'L1','0,3':'H2','2,3':'W'},'AUTO']},
 E12:{title:'50,000x wincap in Hidden (x8 × x7 × x9 = x504)', expected:16758, expectedRound:50000, priorX:36000, freegame:{tier:'hidden', spin:9, total:14}, board:`L5 W W W L2
H1 W W W L3
L3 W W W H1
L2 W W W L4`, full:{1:8,2:7,3:9}, maxSteps:0},
};
function exOpts(e){ return {steps:e.steps||[], full:e.full, sticky:e.sticky, maxSteps:e.maxSteps==null?3:e.maxSteps}; }
function runExample(id){ const e=EX[id]; return play(e.board, exOpts(e)); }

// spin-count rule (SPEC §6 / E11)
function addSpins(budget, newStacks){ return Math.min(budget + 2*newStacks, SPIN_CAP); }
// SPEC §6 (LOCKED 2026-10-23): Dare wilds clear after each spin; Dare's first stack upgrades once to Double Dare (+2).
// Double/Triple/Hidden: all wilds stay locked with values, never upgrade. Every new stack +2, cap 18. Mirrors reference_rules.bonus_after_spin.
function bonusAfterSpin(tier, budget, newStacks, full, sv){
  let upgrade=null, retrig={stacks:0, added:0};
  if (tier==='dare' && newStacks>0){ const nb=Math.min(budget+2,SPIN_CAP); upgrade={from:'dare', to:'double_dare', spinsAdded:nb-budget}; tier='double_dare'; budget=nb; newStacks--; }
  if (newStacks>0){ const nb=addSpins(budget,newStacks); retrig={stacks:newStacks, added:nb-budget}; budget=nb; }
  return {tier, budget, full: tier==='dare'?new Map():new Map(full||[]), sv: tier==='dare'?new Map():new Map(sv||[]), upgrade, retrig};
}

function tierOf(full, sv){ const nf=full.size, ns=sv.size;
  if (nf>=2) return 'hidden'; if (nf===1) return ns>=2 ? 'triple_dare' : 'double_dare'; return ns>=4 ? 'dare' : null; }
function winLevel(x){ const t=[0,1,2,5,10,25,50,100,500,5000]; let l=1; t.forEach((v,i)=>{ if (x>=v) l=i+1; }); return x>0?l:0; }
function paddedBoard(sym, sv, full){ return sym.map((col,r)=>[{name:pickW(SYMS,WT)}, ...col.map((s,row)=>symObj(s, full.has(r)?full.get(r):sv.get(key(r,row)))), {name:pickW(SYMS,WT)}]); }

// Scripted example → full book (for dev panel + reference frames)
function exampleBook(id){
  const e=EX[id]; const events=[]; const emit=ev=>events.push(ev);
  const pre = parse(e.board); const fullIn=new Map(Object.entries(e.full||{}).map(([k,v])=>[+k,v]));
  const svIn=new Map(); for (let r=0;r<REELS;r++) for (let row=0;row<ROWS;row++) if (pre[r][row]==='W' && !fullIn.has(r)) svIn.set(key(r,row),(e.sticky&&e.sticky[`${r},${row}`])||1);
  const fs=e.freegame;
  if (e.mystery) emit({type:'mysteryStart', odds:MYSTERY_ODDS});
  if (e.egw) emit({type:'egwStart', reels:e.egw, value:4});
  if (fs) emit({type:'updateFreeSpin', amount:fs.spin, total:fs.total, cap:SPIN_CAP, tier:fs.tier});
  const for0 = pre.map(c=>c.slice()); for (const r of fullIn.keys()) for0[r]=['W','W','W','W'];
  emit({type:'reveal', board:paddedBoard(for0, svIn, fullIn), paddingPositions:[0,0,0,0,0], gameType: fs?'freegame':'basegame', anticipation:[0,0,0,0,0], locked:lockedOf(fullIn, e.sticky?new Map([...svIn].filter(([k])=>{const [r,row]=cr(k);return e.sticky[`${r},${row}`];})):new Map())});
  if (fullIn.size && mergeGroupsOf(fullIn).length) emit({type:'mergeGroups', step:0, groups:mergeGroupsOf(fullIn)});
  const res = play(e.board, Object.assign(exOpts(e), {emit, priorX: e.priorX!=null ? e.priorX : null}));
  // mergeGroups at step0 for preset full reels is emitted above; drop duplicate from sequence if identical
  let x = res.x; const prior = e.priorX||0;
  if (res.capped){ emit({type:'wincap', amount:CAP_X*100}); }
  if (x>0) emit({type:'setWin', amount:Math.round(x*100), winLevel:winLevel(x)});
  emit({type:'setTotalWin', amount:Math.round((prior+x)*100)});
  if (e.mystery) emit({type:'mysteryResult', outcome:e.mystery});
  const t = (!e.egw && !fs) ? tierOf(res.full,res.sv) : null;
  if (t && !res.capped) emit({type:'freeSpinTrigger', tier:t, totalFs:START_FS[t], cap:SPIN_CAP, carried:lockedOf(res.full,res.sv), source:e.mystery?'mystery':'natural'});
  if (fs && !res.capped){ const nNew=[...res.full.keys()].filter(r=>!fullIn.has(r));
    const st=bonusAfterSpin(fs.tier, fs.total, nNew.length, res.full, res.sv);
    if (st.upgrade) emit(Object.assign({type:'bonusUpgrade'}, st.upgrade, {totalFs:st.budget, stackReel:nNew[0], locked:lockedOf(st.full, st.sv)}));
    if (st.retrig.stacks) emit({type:'freeSpinRetrigger', newStacks:nNew.slice(st.upgrade?1:0), addedFs:st.retrig.added, totalFs:st.budget, capped:st.budget>=SPIN_CAP}); }
  if (res.capped && fs) emit({type:'freeSpinEnd', amount:Math.round((prior+x)*100), winLevel:10});
  emit({type:'finalWin', amount:Math.round((prior+x)*100)});
  // dedupe consecutive identical mergeGroups
  const out=[]; for (const ev of events){ const last=out[out.length-1]; if (last && ev.type==='mergeGroups' && last.type==='mergeGroups' && JSON.stringify(last.groups)===JSON.stringify(ev.groups)) continue; out.push(ev); }
  out.forEach((ev,i)=>ev.index=i);
  return {id, mode: e.mystery?'mystery':e.egw?'egw':'base', events:out, payoutMultiplier:Math.round((prior+x)*100), spinX:res.rawX, expected:e.expected};
}

// ---------- random books (toy strips) ----------
function landBoard(q, w, preFull, sticky){ // returns sym, sv, full, landed
  const sym=[], sv=new Map(), full=new Map(preFull||[]), landed=new Set(); w=wl(w);
  for (let r=0;r<REELS;r++){
    if (full.has(r)){ sym.push(['W','W','W','W']); continue; }
    const hasSticky = sticky && [0,1,2,3].some(row=>sticky.has(key(r,row)));
    if (!hasSticky && q && rnd()<q[r]){ sym.push(['W','W','W','W']); for (let row=0;row<ROWS;row++){ sv.set(key(r,row),1); landed.add(key(r,row)); } continue; }
    const col=[]; for (let row=0;row<ROWS;row++){ const k=key(r,row);
      if (sticky && sticky.has(k)){ col.push('W'); sv.set(k, sticky.get(k)); }
      else { const s=drawSym(w[r]); col.push(s); landed.add(k); if (s==='W') sv.set(k,1); } }
    sym.push(col);
  }
  return {sym, sv, full, landed};
}
const randRep = w => (step, resp) => { const out={}; const ww=wl(w); for (const k of resp) out[k]=drawSym(ww[cr(k)[0]]); return out; };

function spinBlock(emit, b, w, gameType, priorX, extra){
  const locked = lockedOf(new Map([...b.full].filter(([r])=>!(extra&&extra.instantReels||[]).includes(r))), extra&&extra.stickyIn ? new Map([...b.sv].filter(([k])=>extra.stickyIn.has(k))) : new Map());
  emit({type:'reveal', board:paddedBoard(b.sym,b.sv,b.full), paddingPositions:[0,0,0,0,0].map(()=>Math.floor(rnd()*40)), gameType,
    anticipation:(extra&&extra.anticipation)||[0,0,0,0,0], locked});
  if (b.full.size && mergeGroupsOf(b.full).length) emit({type:'mergeGroups', step:0, groups:mergeGroupsOf(b.full)});
  const res = sequence(b.sym, b.sv, b.full, {rep: (extra&&extra.rep) || randRep(w), landed:b.landed, priorX, emit});
  return res;
}
function bonus(emit, tier, full, sv, source, priorX){
  emit({type:'freeSpinTrigger', tier, totalFs:START_FS[tier], cap:SPIN_CAP, carried:lockedOf(full,sv), source});
  // carry-in (A5): the trigger board's wilds are on free spin 1 in every tier; Dare clears them after that spin
  let budget=START_FS[tier], played=0, tot=0, sticky=new Map(sv), capped=false; full=new Map(full);
  while (played<budget){
    played++;
    emit({type:'updateFreeSpin', amount:played, total:budget, cap:SPIN_CAP, tier});
    const b=landBoard(P.qb[tier], P.wb[tier], full, sticky);
    const res=spinBlock(emit, b, P.wb[tier], 'freegame', priorX+tot, {stickyIn:sticky});
    tot+=res.x;
    if (res.x>0) emit({type:'setWin', amount:Math.round(res.x*100), winLevel:winLevel(res.x)});
    if (res.capped){ capped=true; emit({type:'wincap', amount:CAP_X*100}); emit({type:'setTotalWin', amount:Math.round((priorX+tot)*100)}); break; }
    emit({type:'setTotalWin', amount:Math.round((priorX+tot)*100)});
    const st=bonusAfterSpin(tier, budget, res.newStacks.length, b.full, b.sv);
    if (st.upgrade) emit(Object.assign({type:'bonusUpgrade'}, st.upgrade, {totalFs:st.budget, stackReel:res.newStacks[0], locked:lockedOf(st.full, st.sv)}));
    if (st.retrig.stacks) emit({type:'freeSpinRetrigger', newStacks:res.newStacks.slice(st.upgrade?1:0), addedFs:st.retrig.added, totalFs:st.budget, capped:st.budget>=SPIN_CAP});
    tier=st.tier; budget=st.budget; full=st.full; sticky=st.sv;
  }
  emit({type:'freeSpinEnd', amount:Math.round(tot*100), winLevel:winLevel(tot)});
  return {x:tot, capped, played, tier};
}
function finish(events, totalX, extra){ const out=events; out.push({type:'finalWin', amount:Math.round(totalX*100)}); out.forEach((e,i)=>e.index=i);
  return Object.assign({events:out, payoutMultiplier:Math.round(totalX*100)}, extra); }

function bookBaseLike(mode){
  const ev=[]; const emit=e=>ev.push(e);
  const q = mode==='ante'?P.qa:P.q, w = mode==='ante'?P.wa:P.w;
  const b=landBoard(q,w); const res=spinBlock(emit,b,w,'basegame',0);
  if (res.capped) emit({type:'wincap', amount:CAP_X*100});
  if (res.x>0) emit({type:'setWin', amount:Math.round(res.x*100), winLevel:winLevel(res.x)});
  emit({type:'setTotalWin', amount:Math.round(res.x*100)});
  let tot=res.x, tier=null;
  if (!res.capped){ tier=tierOf(b.full,b.sv); if (tier){ const bo=bonus(emit,tier,b.full,b.sv,'natural',tot); tot+=bo.x; } }
  return finish(ev, Math.min(tot,CAP_X), {mode, tier});
}
function bookBuy(tier){
  for (let tries=0; tries<200000; tries++){
    const ev=[{type:'buyTriggerStart', tier}]; const emit=e=>ev.push(e);
    const b=landBoard(P.qt, P.wt[tier]); const res=spinBlock(emit,b,P.wt[tier],'basegame',0);
    if (res.capped || tierOf(b.full,b.sv)!==tier) continue;
    if (res.x>0) emit({type:'setWin', amount:Math.round(res.x*100), winLevel:winLevel(res.x)});
    emit({type:'setTotalWin', amount:Math.round(res.x*100)});
    const bo=bonus(emit,tier,b.full,b.sv,'buy',res.x);
    return finish(ev, Math.min(res.x+bo.x,CAP_X), {mode:tier, tier, tries:tries+1});
  }
  throw new Error('buy rejection failed '+tier);
}
function bookMystery(forceBucket){
  const bucket = forceBucket || pickW(['none','double_dare','triple_dare','hidden'],[50,37,10,3]);
  for (let tries=0; tries<500000; tries++){
    const ev=[{type:'mysteryStart', odds:MYSTERY_ODDS}]; const emit=e=>ev.push(e);
    // reveal: exactly 3 wilds as a 3-high partial stack on one reel (tease), at least one connected win
    const r=Math.floor(rnd()*REELS), top=Math.floor(rnd()*2);
    const b=landBoard(null, 0); for (let i=0;i<3;i++){ const k=key(r,top+i); b.sym[r][top+i]='W'; b.sv.set(k,1); }
    const pre=evaluate(b.sym,b.sv,b.full); if (!pre.conw.size) continue;
    const wr = bucket==='none' ? 0 : P.wMystery[bucket];
    const ant=[0,0,0,0,0]; ant[r]=1;
    const res=spinBlock(emit,b,wr,'basegame',0,{anticipation:ant});
    const t=tierOf(b.full,b.sv);
    if (res.capped) continue;
    if (bucket==='none' ? (t!==null || b.sv.size!==3) : t!==bucket) continue;
    if (res.x>0) emit({type:'setWin', amount:Math.round(res.x*100), winLevel:winLevel(res.x)});
    emit({type:'setTotalWin', amount:Math.round(res.x*100)});
    emit({type:'mysteryResult', outcome:bucket});
    let tot=res.x;
    if (bucket!=='none'){ const bo=bonus(emit,bucket,b.full,b.sv,'mystery',tot); tot+=bo.x; }
    return finish(ev, Math.min(tot,CAP_X), {mode:'mystery', tier:bucket==='none'?null:bucket, bucket, tries:tries+1});
  }
  throw new Error('mystery rejection failed '+bucket);
}
function bookEGW(){
  const ev=[]; const emit=e=>ev.push(e);
  const pat = pickW(P.egw.map(p=>p[0]), P.egw.map(p=>p[1])).map(x=>x-1);
  emit({type:'egwStart', reels:pat, value:4});
  const b=landBoard(null, P.wegw, pat.map(r=>[r,4]));
  const res=spinBlock(emit,b,P.wegw,'basegame',0);
  if (res.capped) emit({type:'wincap', amount:CAP_X*100});
  if (res.x>0) emit({type:'setWin', amount:Math.round(res.x*100), winLevel:winLevel(res.x)});
  emit({type:'setTotalWin', amount:Math.round(res.x*100)});
  return finish(ev, Math.min(res.x,CAP_X), {mode:'egw', pattern:pat});
}
function book(mode){
  if (mode==='base'||mode==='ante') return bookBaseLike(mode);
  if (mode==='mystery') return bookMystery();
  if (mode==='egw') return bookEGW();
  return bookBuy(mode);
}
function autoplay(mode, n){
  const cost=MODES[mode].cost; let sum=0, hits=0, max=0, trig={}, p5k=0;
  for (let i=0;i<n;i++){ const bk=book(mode); const x=bk.payoutMultiplier/100; sum+=x; if (x>0) hits++; if (x>max) max=x; if (x>=5000) p5k++; if (bk.tier) trig[bk.tier]=(trig[bk.tier]||0)+1; }
  return {mode, n, cost, hitRate:hits/n, rtp:sum/n/cost, meanX:sum/n, maxX:max, p5k:p5k/n, triggers:trig};
}

const API = {ROWS, REELS, CAP_X, SPIN_CAP, LINES, PAY, SYMS, START_FS, MYSTERY_ODDS, MODES, TIER_LABEL, P, EX,
  seed, parse, evaluate, lineMult, play, runExample, exampleBook, addSpins, bonusAfterSpin, tierOf, winLevel, book, autoplay, mergeGroupsOf};
if (typeof module!=='undefined' && module.exports) module.exports = API; else root.DDE = API;
})(typeof globalThis!=='undefined'?globalThis:this);
