
/*
  File: chess-adventure.js
  Author: ChatGPT (GPT-5 Thinking)
  Date: 2025-09-25
  Purpose: Core logic for Interactive Chess Adventure. Knight path puzzle, 6 preset levels.
*/
(() => {
  'use strict';
  console.info('[game] chess-adventure started');

  // ==== Helpers ====
  const $ = (s, ctx=document) => ctx.querySelector(s);
  const $$ = (s, ctx=document) => Array.from(ctx.querySelectorAll(s));
  const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));
  const key = (r,c) => `${r},${c}`;

  // ==== Audio (Web Audio API) ====
  const AudioEngine = (() => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = Ctx ? new Ctx() : null;
    let enabled = true;
    function ping(freq=660, dur=0.15){
      if (!ctx || !enabled) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t+0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t+dur+0.02);
    }
    return {
      ok(){ ping(720, .12); },
      err(){ ping(180, .18); },
      setEnabled(v){ enabled = v; },
      resume(){ ctx && ctx.resume && ctx.resume(); }
    };
  })();

  // ==== Levels ====
  // Coordinates are [row, col], 0-indexed
  const LEVELS = [
    { size:5, start:[0,0], target:[4,4], blocks:[[2,2]], limit:8 },
    { size:5, start:[0,1], target:[4,3], blocks:[[1,3],[3,1]], limit:8 },
    { size:5, start:[4,0], target:[0,4], blocks:[[2,1],[2,3],[1,2]], limit:9 },
    { size:7, start:[1,1], target:[5,5], blocks:[[2,3],[3,2],[4,4]], limit:10 },
    { size:7, start:[0,6], target:[6,0], blocks:[[2,5],[3,3],[4,1],[1,2]], limit:12 },
    { size:7, start:[6,1], target:[0,5], blocks:[[3,0],[3,2],[3,4],[2,3],[4,3]], limit:13 },
  ];

  // ==== State ====
  const state = {
    levelIndex: 0,
    rows: 5, cols: 5,
    knight: [0,0],
    target: [4,4],
    blocks: new Set(),
    moves: 0,
    par: 0,
    limit: 0,
    selected: false,
    history: [], // stack of previous knight positions
    hintsLeft: 2,
    bestStore: loadBest(), // { bestLevel, records: { [level]: bestMoves } }
    focusIdx: 0, // for keyboard focus
  };

  function loadBest(){
    try {
      const raw = localStorage.getItem('ida_best');
      if (!raw) return { bestLevel: 0, records: {} };
      const obj = JSON.parse(raw);
      return { bestLevel: obj.bestLevel||0, records: obj.records||{} };
    } catch(e){ return { bestLevel: 0, records: {} }; }
  }
  function saveBest(){
    localStorage.setItem('ida_best', JSON.stringify(state.bestStore));
  }

  // ==== DOM ====
  const DOM = {
    board: $('#ida-board'),
    level: $('#ida-level'),
    moves: $('#ida-moves'),
    par: $('#ida-par'),
    limit: $('#ida-limit'),
    best: $('#ida-best'),
    restart: $('#ida-restart'),
    undo: $('#ida-undo'),
    next: $('#ida-next'),
    hint: $('#ida-hint'),
    overlay: $('#ida-overlay'),
    overClose: $('#ida-over-close'),
    overTitle: $('#ida-over-title'),
    overMoves: $('#ida-over-moves'),
    overPar: $('#ida-over-par'),
    overBest: $('#ida-over-best'),
    overNext: $('#ida-over-next'),
    overRetry: $('#ida-over-retry'),
    sound: $('#ida-sound'),
    theme: $('#ida-theme'),
  };

  // Theme toggle
  const htmlEl = document.documentElement;
  function toggleTheme(){
    const curr = htmlEl.getAttribute('data-theme') || 'auto';
    const next = curr === 'dark' ? 'light' : curr === 'light' ? 'auto' : 'dark';
    htmlEl.setAttribute('data-theme', next);
  }
  DOM.theme.addEventListener('click', toggleTheme);

  // Sound toggle
  DOM.sound.addEventListener('change', (e)=>{
    AudioEngine.setEnabled(e.target.checked);
    if (e.target.checked) { AudioEngine.resume(); AudioEngine.ok(); }
  });

  // ==== Board / Rendering ====
  function inBounds(r,c){ return r>=0 && c>=0 && r<state.rows && c<state.cols; }
  const KN_MOVES = [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]];

  function legalMoves(from){
    const res=[];
    for(const [dr,dc] of KN_MOVES){
      const r=from[0]+dr, c=from[1]+dc;
      if(inBounds(r,c) && !state.blocks.has(key(r,c))) res.push([r,c]);
    }
    return res;
  }

  function svgKnight(){ return '<svg viewBox="0 0 64 64" aria-hidden="true"><path class="ida-svg-core" d="M44 20l-8 6-4 8 2 10h14l-2-10 4-6-6-8z"></path><rect x="20" y="48" width="24" height="8" class="ida-svg-accent"></rect></svg>'; }
  function svgTarget(){ return '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="12" class="ida-svg-core"></circle></svg>'; }

  function buildBoard(){
    DOM.board.innerHTML = '';
    DOM.board.style.setProperty('--rows', String(state.rows));
    DOM.board.style.setProperty('--cols', String(state.cols));
    DOM.board.setAttribute('aria-rowcount', String(state.rows));
    DOM.board.setAttribute('aria-colcount', String(state.cols));
    const highlights = state.selected ? legalMoves(state.knight).map(p=>key(p[0],p[1])) : [];
    let tabIndexSet = false;
    for(let r=0; r<state.rows; r++){
      for(let c=0; c<state.cols; c++){
        const cell = document.createElement('button');
        cell.className = 'ida-cell';
        cell.setAttribute('role','gridcell');
        cell.setAttribute('aria-label', `Cell ${r+1},${c+1}`);
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        cell.tabIndex = -1;
        // blocked
        if(state.blocks.has(key(r,c))){
          cell.classList.add('ida-block');
          cell.setAttribute('aria-disabled', 'true');
        }
        // content
        if(r===state.target[0] && c===state.target[1]){
          cell.classList.add('ida-target');
          cell.innerHTML = svgTarget();
        }
        if(r===state.knight[0] && c===state.knight[1]){
          cell.classList.add('ida-knight');
          cell.innerHTML = svgKnight();
          if(!tabIndexSet){ cell.tabIndex = 0; tabIndexSet = true; state.focusIdx = r*state.cols + c; }
        }
        // highlight legal
        if(highlights.includes(key(r,c))) cell.classList.add('ida-highlight');

        cell.addEventListener('click', ()=>onCellClick(r,c));
        cell.addEventListener('keydown', onCellKeydown);
        DOM.board.appendChild(cell);
      }
    }
  }

  function onCellClick(r,c){
    if(state.blocks.has(key(r,c))) return;
    // Toggle selection when clicking on knight cell
    if(r===state.knight[0] && c===state.knight[1]){
      state.selected = !state.selected;
      buildBoard();
      return;
    }
    if(!state.selected){
      // not in move mode; ignore
      return;
    }
    // move attempt
    const legal = legalMoves(state.knight).some(p => p[0]===r && p[1]===c);
    if(!legal){ AudioEngine.err(); return; }
    doMove([r,c]);
  }

  function onCellKeydown(e){
    const idx = Array.prototype.indexOf.call(DOM.board.children, e.currentTarget);
    const r = Math.floor(idx / state.cols);
    const c = idx % state.cols;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
      e.preventDefault();
      let nr=r, nc=c;
      if(e.key==='ArrowUp') nr = clamp(r-1,0,state.rows-1);
      if(e.key==='ArrowDown') nr = clamp(r+1,0,state.rows-1);
      if(e.key==='ArrowLeft') nc = clamp(c-1,0,state.cols-1);
      if(e.key==='ArrowRight') nc = clamp(c+1,0,state.cols-1);
      focusCell(nr,nc);
    } else if(e.key==='Enter'){
      // If current cell is knight, toggle selection; else try move
      if(r===state.knight[0] && c===state.knight[1]){
        state.selected = !state.selected;
        buildBoard();
        focusCell(r,c);
      } else {
        const legal = legalMoves(state.knight).some(p => p[0]===r && p[1]===c);
        if(legal) doMove([r,c]); else AudioEngine.err();
      }
    } else if(e.key.toLowerCase()==='r'){ restartLevel(); }
      else if(e.key.toLowerCase()==='u'){ undoMove(); }
  }

  function focusCell(r,c){
    const idx = r*state.cols + c;
    const btn = DOM.board.children[idx];
    if(btn){ btn.tabIndex = 0; btn.focus({preventScroll:true}); }
  }

  function doMove([r,c]){
    state.history.push([...state.knight]);
    state.knight = [r,c];
    state.moves += 1;
    state.selected = false;
    AudioEngine.ok();
    updateHUD();
    buildBoard();
    checkWinOrFail();
  }

  function undoMove(){
    const prev = state.history.pop();
    if(!prev){ AudioEngine.err(); return; }
    state.knight = prev;
    state.moves = Math.max(0, state.moves-1);
    state.selected = false;
    buildBoard(); updateHUD();
  }

  function restartLevel(){
    loadLevel(state.levelIndex);
  }

  // ==== BFS for par + hints ====
  function bfs(start, goal){
    const q = [start];
    const seen = new Set([key(start[0],start[1])]);
    const parent = new Map();
    while(q.length){
      const cur = q.shift();
      if(cur[0]===goal[0] && cur[1]===goal[1]){
        // rebuild path
        const path = [cur];
        let k = key(cur[0],cur[1]);
        while(parent.has(k)){
          const p = parent.get(k);
          path.push(p);
          k = key(p[0],p[1]);
        }
        return path.reverse(); // start..goal
      }
      for(const [dr,dc] of KN_MOVES){
        const nr = cur[0]+dr, nc = cur[1]+dc;
        const k2 = key(nr,nc);
        if(inBounds(nr,nc) && !state.blocks.has(k2) && !seen.has(k2)){
          seen.add(k2);
          parent.set(k2, cur);
          q.push([nr,nc]);
        }
      }
    }
    return null;
  }

  function showHint(){
    if(state.hintsLeft <= 0){ AudioEngine.err(); return; }
    const path = bfs(state.knight, state.target);
    if(!path || path.length<2){ AudioEngine.err(); return; }
    const next = path[1]; // next square
    state.hintsLeft -= 1;
    DOM.hint.textContent = `Hint (${state.hintsLeft})`;
    // flash the hinted cell
    const idx = next[0]*state.cols + next[1];
    const cell = DOM.board.children[idx];
    if(cell){
      cell.classList.add('ida-highlight');
      setTimeout(()=>cell.classList.remove('ida-highlight'), 1000);
    }
  }

  // ==== Win / Fail ====
  function checkWinOrFail(){
    // win
    if(state.knight[0]===state.target[0] && state.knight[1]===state.target[1]){
      onWin();
      return;
    }
    // fail if exceeded limit
    if(state.moves >= state.limit){
      // Not strictly game over modal; just nudge to restart
      DOM.overTitle.textContent = 'Out of moves!';
      DOM.overMoves.textContent = String(state.moves);
      DOM.overPar.textContent = String(state.par);
      const prevBest = state.bestStore.records[state.levelIndex] ?? '—';
      DOM.overBest.textContent = String(prevBest);
      showOverlay();
    }
  }

  function onWin(){
    // update bests
    const prevBest = state.bestStore.records[state.levelIndex];
    if(prevBest == null || state.moves < prevBest){
      state.bestStore.records[state.levelIndex] = state.moves;
    }
    state.bestStore.bestLevel = Math.max(state.bestStore.bestLevel, state.levelIndex+1);
    saveBest();

    DOM.overTitle.textContent = 'Level Complete!';
    DOM.overMoves.textContent = String(state.moves);
    DOM.overPar.textContent = String(state.par);
    DOM.overBest.textContent = String(state.bestStore.records[state.levelIndex]);
    showOverlay();
  }

  function showOverlay(){
    DOM.overlay.hidden = false;
    $('#ida-over-close').focus();
  }
  function hideOverlay(){ DOM.overlay.hidden = true; }

  // ==== HUD ====
  function updateHUD(){
    DOM.level.textContent = String(state.levelIndex+1);
    DOM.moves.textContent = String(state.moves);
    DOM.par.textContent = String(state.par);
    DOM.limit.textContent = String(state.limit);
    const bestLevel = state.bestStore.bestLevel || 0;
    const bestMoves = state.bestStore.records[state.levelIndex];
    DOM.best.textContent = bestMoves!=null ? `L${bestLevel} • ${bestMoves} moves` : `L${bestLevel} • —`;
    DOM.hint.textContent = `Hint (${state.hintsLeft})`;
  }

  // ==== Level loading ====
  function loadLevel(idx){
    state.levelIndex = clamp(idx, 0, LEVELS.length-1);
    const L = LEVELS[state.levelIndex];
    state.rows = L.size; state.cols = L.size;
    state.knight = [...L.start];
    state.target = [...L.target];
    state.blocks = new Set(L.blocks.map(b => key(b[0],b[1])));
    state.moves = 0;
    state.history = [];
    state.hintsLeft = 2;
    state.selected = false;
    // compute par via BFS
    const path = bfs(state.knight, state.target);
    state.par = path ? path.length-1 : 0;
    state.limit = L.limit != null ? L.limit : (state.par + 2);
    updateHUD();
    buildBoard();
  }

  // ==== Buttons & Events ====
  DOM.restart.addEventListener('click', restartLevel);
  DOM.undo.addEventListener('click', undoMove);
  DOM.next.addEventListener('click', () => { loadLevel(state.levelIndex+1); hideOverlay(); });
  DOM.hint.addEventListener('click', showHint);

  DOM.overNext.addEventListener('click', () => { loadLevel(state.levelIndex+1); hideOverlay(); });
  DOM.overRetry.addEventListener('click', () => { restartLevel(); hideOverlay(); });
  DOM.overClose.addEventListener('click', (e)=>{ e.stopPropagation(); hideOverlay(); });
  DOM.overlay.addEventListener('click', (e)=>{ if(e.target===DOM.overlay) hideOverlay(); });
  window.addEventListener('keydown', (e)=>{
    if(!DOM.overlay.hidden && e.key==='Escape'){ hideOverlay(); }
  });

  // Keyboard globals
  window.addEventListener('keydown', (e)=>{
    if(e.key.toLowerCase()==='r'){ restartLevel(); }
    else if(e.key.toLowerCase()==='u'){ undoMove(); }
  });

  // ==== Init ====
  loadLevel(0);
})();
