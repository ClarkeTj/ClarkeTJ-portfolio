/*
MIT License
Game: Escape the Code — Logic
Author: ChatGPT (GPT-5 Thinking) • Date: 2025-09-25 • File: script.js
Integration: Plain JS, no deps. Critical features check logged at start. See inline testing steps.
*/

// ===== Feature checks & startup analytics =====
(function featureCheck(){
  const okCanvas = !!document.createElement('canvas').getContext;
  const okStorage = (()=>{ try{ localStorage.setItem('_ec_t','1'); localStorage.removeItem('_ec_t'); return true; }catch(e){ return false; }})();
  const okTouch = 'ontouchstart' in window || navigator.maxTouchPoints>0;
  console.info('[game] escape-code started');
  console.table({ canvas: okCanvas, localStorage: okStorage, touch: okTouch });
})();

/* Testing steps (manual):
1) Open index.html on mobile and desktop. 2) Toggle theme + sound. 3) Complete Stage 1 (3 rounds),
Stage 2 (3 bugs), Stage 3 (reach exit). 4) Copy result and verify ec_highscore saved in localStorage.
*/

// ===== Utilities =====
const $ = (sel, root=document)=>root.querySelector(sel);
const $$ = (sel, root=document)=>Array.from(root.querySelectorAll(sel));

const EC_KEYS = {
  BEST: 'ec_highscore',
  SOUND: 'ec_sound',
  THEME: 'ec_theme'
};

const state = {
  step: 1,
  mistakes: 0,
  timeStart: 0,
  timerId: 0,
  hints: 2,
  soundOn: (localStorage.getItem(EC_KEYS.SOUND)||'1')==='1',
  ctxAudio: null,
  osc: null
};

function nowSec(){ return (performance.now() / 1000); }
function beep(freq=660, dur=120){
  if(!state.soundOn) return;
  try{
    const ctx = state.ctxAudio || (state.ctxAudio = new (window.AudioContext||window.webkitAudioContext)());
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = freq; o.type='sine';
    g.gain.value = 0.07;
    o.start();
    setTimeout(()=>{ o.stop(); }, dur);
  }catch(e){}
}

// ===== Theme & HUD =====
const root = document.documentElement;
const hudTime = $('#ec-time');
const hudMistakes = $('#ec-mistakes');
const hudBest = $('#ec-best');
const dots = $$('.ec-dot');

function setTheme(mode){ root.setAttribute('data-theme', mode); localStorage.setItem(EC_KEYS.THEME, mode); }
(function initTheme(){
  const saved = localStorage.getItem(EC_KEYS.THEME);
  if(saved==='dark'||saved==='light') setTheme(saved);
})();
$('#ec-theme').addEventListener('click', ()=>{
  const cur = root.getAttribute('data-theme');
  setTheme(cur==='dark' ? 'light' : 'dark');
});

$('#ec-sound').addEventListener('click', ()=>{
  state.soundOn = !state.soundOn;
  localStorage.setItem(EC_KEYS.SOUND, state.soundOn ? '1':'0');
  $('#ec-sound').textContent = state.soundOn ? '🔊 Sound' : '🔈 Muted';
});

// ===== Timer =====
function startTimer(){
  state.timeStart = performance.now();
  if(state.timerId) cancelAnimationFrame(state.timerId);
  const tick = ()=>{
    const t = Math.max(0, (performance.now()-state.timeStart)/1000);
    hudTime.textContent = t.toFixed(1);
    state.timerId = requestAnimationFrame(tick);
  };
  state.timerId = requestAnimationFrame(tick);
}
function stopTimer(){ if(state.timerId) cancelAnimationFrame(state.timerId); state.timerId=0; }

// ===== Progress dots =====
function indicateStep(){
  dots.forEach(d=>d.classList.toggle('ec-active', Number(d.dataset.step)===state.step));
}

// ===== Stage switching =====
function showStage(n){
  state.step = n;
  indicateStep();
  $('#ec-stage1').hidden = n!==1;
  $('#ec-stage2').hidden = n!==2;
  $('#ec-stage3').hidden = n!==3;
  $('#ec-complete').hidden = true;
}

// ===== Stage 1: Simon pattern =====
const s1 = {
  round: 1,
  targetRounds: 3,
  seq: [],
  userIdx: 0,
  flashing: false
};
const padEls = $$('.ec-pad');
$('#ec-s1-start').addEventListener('click', startRoundS1);
padEls.forEach(btn=>{
  btn.addEventListener('pointerdown', e=>{
    if(s1.flashing || $('#ec-stage1').hidden) return;
    const pad = Number(btn.dataset.pad);
    flashPad(btn, 100);
    checkS1Input(pad);
  });
});

function randInt(n){ return Math.floor(Math.random()*n); }
function flashPad(el, dur=250){ el.classList.add('ec-flash'); beep(440+120*Number(el.dataset.pad), dur); setTimeout(()=>el.classList.remove('ec-flash'), dur); }

function startRoundS1(){
  s1.userIdx = 0;
  s1.seq = Array.from({length: 2 + s1.round}, ()=>randInt(4));
  $('#ec-s1-round').textContent = `Round ${s1.round} / ${s1.targetRounds}`;
  playSeq();
}

async function playSeq(){
  s1.flashing = true;
  await new Promise(res=>setTimeout(res, 400));
  for(const idx of s1.seq){
    flashPad(padEls[idx], 250);
    await new Promise(res=>setTimeout(res, 320));
  }
  s1.flashing = false;
}

function checkS1Input(pad){
  if(s1.seq[s1.userIdx]===pad){
    s1.userIdx++;
    if(s1.userIdx===s1.seq.length){
      // success this round
      s1.round++;
      if(s1.round> s1.targetRounds){
        showStage(2);
        prepStage2();
      } else {
        startRoundS1();
      }
    }
  } else {
    // mistake
    state.mistakes++; hudMistakes.textContent = state.mistakes;
    beep(180, 180);
    // restart same round
    s1.userIdx = 0;
    playSeq();
  }
}

// ===== Stage 2: Find the Bug =====
const BUGS = [
  { code:`let a = 5;\nif (a = 3) {\n  console.log("ok");\n}`, opts:['===','==','='], bad:2 },
  { code:`for (let i = 0; i < 3; i++) {\n  prinf(i);\n}`, opts:['print','printf','prinf'], bad:2 },
  { code:`const arr = [1,2,3]\narr.push(4);\n`, opts:[';','}',']'], bad:0 },
  { code:`function sum(a,b){\n return a + b;\n}\n sum(1,2,3)`, opts:['sum(1,2)','sum(1,2,3)','sum(1)'], bad:1 },
  { code:`if (user && user.isAdmin) {\n doThing()\n}`, opts:['{',';','}'], bad:1 },
  { code:`const obj = { x:1 y:2 }`, opts:[',',':',';'], bad:0 },
];

let s2Left = 3, s2Cur = null, s2Answered=false;
function prepStage2(){
  s2Left = 3; $('#ec-s2-left').textContent = `Puzzles left: ${s2Left}`;
  nextS2();
}
function nextS2(){
  s2Answered=false;
  const q = BUGS[randInt(BUGS.length)];
  s2Cur = q;
  $('#ec-codeblock').textContent = q.code;
  $$('.ec-opt').forEach((b,i)=>{ b.textContent = `${i+1}) ${q.opts[i]}`; b.classList.remove('ec-wrong','ec-correct'); b.disabled=false; });
  $('#ec-s2-next').disabled = true;
}

$$('.ec-opt').forEach((b,i)=>{
  b.addEventListener('click', ()=>chooseBug(i));
});
document.addEventListener('keydown', (e)=>{
  if($('#ec-stage2').hidden) return;
  if(['1','2','3'].includes(e.key)) chooseBug(Number(e.key)-1);
});

function chooseBug(i){
  if(s2Answered) return;
  s2Answered = true;
  const correct = (i === s2Cur.bad);
  if(!correct){
    state.mistakes++; hudMistakes.textContent = state.mistakes;
    beep(160, 160);
  } else {
    beep(720, 140);
  }
  $$('.ec-opt').forEach((b,idx)=>{
    b.disabled = true;
    b.classList.toggle('ec-correct', idx===s2Cur.bad);
    b.classList.toggle('ec-wrong', idx!==s2Cur.bad);
  });
  $('#ec-s2-next').disabled = false;
}

$('#ec-s2-next').addEventListener('click', ()=>{
  s2Left--;
  if(s2Left>0){
    $('#ec-s2-left').textContent = `Puzzles left: ${s2Left}`;
    nextS2();
  } else {
    showStage(3);
    setupMaze(mazeIndex);
  }
});

// ===== Stage 3: Knight Maze =====
const layouts = [
  { name:'Easy', walls:[[1,1],[1,3],[3,1],[3,3]], start:[0,0], exit:[4,4], moves:8 },
  { name:'Medium', walls:[[1,2],[2,1],[2,3],[3,2],[1,4]], start:[0,2], exit:[4,0], moves:9 },
  { name:'Hard', walls:[[0,3],[1,1],[1,4],[2,2],[3,0],[3,3],[4,1]], start:[4,4], exit:[0,0], moves:10 }
];
let mazeIndex = 0;
const mazeEl = $('#ec-maze');
let hero=[0,0], exitCell=[4,4], cap=8;

function setupMaze(idx){
  const lay = layouts[idx];
  $('#ec-layout').textContent = lay.name;
  $('#ec-movecap').textContent = String(lay.moves);
  cap = lay.moves;
  hero = [...lay.start];
  exitCell = [...lay.exit];
  mazeEl.innerHTML = '';
  for(let r=0;r<5;r++){
    for(let c=0;c<5;c++){
      const cell = document.createElement('button');
      cell.className = 'ec-cell';
      cell.setAttribute('role','gridcell');
      cell.dataset.r=r; cell.dataset.c=c;
      // walls
      if(lay.walls.some(([wr,wc])=>wr===r && wc===c)){ cell.classList.add('ec-wall'); cell.disabled=true; }
      if(r===lay.start[0] && c===lay.start[1]) cell.classList.add('ec-start');
      if(r===lay.exit[0] && c===lay.exit[1]) cell.classList.add('ec-exit');
      if(r===hero[0] && c===hero[1]) cell.classList.add('ec-hero'), cell.textContent='♞';
      cell.addEventListener('click', ()=>tryMove(r,c));
      mazeEl.appendChild(cell);
    }
  }
  updateMoves(0);
  highlightLegal();
}

function inBounds(r,c){ return r>=0&&c>=0&&r<5&&c<5; }
function legalKnight(from,to){
  const dr = Math.abs(from[0]-to[0]);
  const dc = Math.abs(from[1]-to[1]);
  return dr*dc===2;
}
function isWall(r,c){
  const lay=layouts[mazeIndex];
  return lay.walls.some(([wr,wc])=>wr===r && wc===c);
}
let usedMoves = 0;
function updateMoves(x){ usedMoves = x; $('#ec-moves').textContent = String(usedMoves); }

function drawHero(){
  $$('.ec-cell').forEach(el=>{ el.classList.remove('ec-hero'); el.textContent=''; });
  const idx = hero[0]*5+hero[1];
  const el = $$('.ec-cell')[idx];
  el.classList.add('ec-hero'); el.textContent='♞';
}

function highlightLegal(){
  $$('.ec-cell').forEach(el=>el.style.outline='none');
  for(const [dr,dc] of [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]]){
    const r=hero[0]+dr, c=hero[1]+dc;
    if(inBounds(r,c) && !isWall(r,c)){
      const el = $$('.ec-cell')[r*5+c];
      el.style.outline='2px dashed var(--ec-accent)';
    }
  }
}

function tryMove(r,c){
  if(!legalKnight(hero,[r,c]) || isWall(r,c)) { beep(220,140); return; }
  updateMoves(usedMoves+1);
  hero=[r,c];
  drawHero();
  highlightLegal();
  if(hero[0]===exitCell[0] && hero[1]===exitCell[1]){
    finishGame();
    return;
  }
  if(usedMoves>cap){
    // Fail current layout only
    state.mistakes++; hudMistakes.textContent = state.mistakes;
    beep(200,200);
    setupMaze(mazeIndex);
  }
}

document.addEventListener('keydown',(e)=>{
  if($('#ec-stage3').hidden) return;
  // arrow keys select the nearest legal by direction preference
  const dirs = {
    ArrowUp:   [[-2,-1],[-2,1]],
    ArrowDown: [[2,-1],[2,1]],
    ArrowLeft: [[-1,-2],[1,-2]],
    ArrowRight:[[ -1,2],[1,2]],
  };
  if(dirs[e.key]){
    for(const [dr,dc] of dirs[e.key]){
      const r=hero[0]+dr, c=hero[1]+dc;
      if(inBounds(r,c) && !isWall(r,c)){ tryMove(r,c); break; }
    }
  }
});

$('#ec-maze-prev').addEventListener('click', ()=>{ mazeIndex=(mazeIndex+layouts.length-1)%layouts.length; setupMaze(mazeIndex); });
$('#ec-maze-next').addEventListener('click', ()=>{ mazeIndex=(mazeIndex+1)%layouts.length; setupMaze(mazeIndex); });
$('#ec-maze-restart').addEventListener('click', ()=>setupMaze(mazeIndex));

// ===== Hints (2 per game) =====
$('#ec-hint').addEventListener('click', ()=>{
  if(state.hints<=0) return;
  if(!$('#ec-stage1').hidden){
    // Reveal next item in sequence (flash current index)
    const idx = s1.seq[Math.min(s1.userIdx, s1.seq.length-1)];
    flashPad(padEls[idx], 400);
  } else if(!$('#ec-stage2').hidden){
    // Highlight correct button briefly
    const i = s2Cur.bad;
    const btn = $$('.ec-opt')[i];
    btn.classList.add('ec-correct');
    setTimeout(()=>btn.classList.remove('ec-correct'), 600);
  } else if(!$('#ec-stage3').hidden){
    // Highlight one legal move closer to exit
    let best=null, bestDist=1e9;
    for(const [dr,dc] of [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]]){
      const r=hero[0]+dr, c=hero[1]+dc;
      if(inBounds(r,c) && !isWall(r,c)){
        const d = Math.hypot(exitCell[0]-r, exitCell[1]-c);
        if(d<bestDist){ bestDist=d; best=[r,c]; }
      }
    }
    if(best){
      const el = $$('.ec-cell')[best[0]*5+best[1]];
      el.style.outline='3px solid var(--ec-good)';
      setTimeout(()=>highlightLegal(), 700);
    }
  }
  state.hints--;
  $('#ec-hint').textContent = `💡 Hint (${state.hints})`;
  state.mistakes++; hudMistakes.textContent = state.mistakes; // using hint reduces score
});

// ===== Finish & Score =====
function finishGame(){
  stopTimer();
  const secs = Number(hudTime.textContent);
  // Simple score: lower is better -> convert to higher-better score
  const raw = Math.max(1, Math.floor(10000 / (secs + 1 + state.mistakes*2)));
  const prev = Number(localStorage.getItem(EC_KEYS.BEST)||0);
  if(raw>prev){ localStorage.setItem(EC_KEYS.BEST, String(raw)); }
  const msg = `You escaped in ${secs.toFixed(1)}s with ${state.mistakes} mistakes. Score: ${raw}.`;
  $('.ec-scoreline').textContent = msg;
  $('#ec-complete').hidden = false;
  $('#ec-stage1').hidden = $('#ec-stage2').hidden = $('#ec-stage3').hidden = true;
  $('#ec-copy').onclick = async ()=>{
    try{ await navigator.clipboard.writeText(msg); $('#ec-copy').textContent='Copied!'; }catch(e){}
  };
  $('#ec-retry').onclick = ()=>window.location.reload();
  hudBest.textContent = localStorage.getItem(EC_KEYS.BEST) || '—';
}

// ===== Init =====
function init(){
  hudMistakes.textContent = '0';
  hudBest.textContent = localStorage.getItem(EC_KEYS.BEST) || '—';
  indicateStep();
  showStage(1);
  startTimer();
}
init();
