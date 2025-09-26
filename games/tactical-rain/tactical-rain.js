/*
  File: tactical-rain.js
  Author: ChatGPT (GPT-5 Thinking)
  Date: 2025-09-25
  Purpose: Game logic for Tactical Rain. requestAnimationFrame-driven, touch + keyboard controls.
*/
(() => {
  'use strict';
  console.info('[game] tactical-rain started');

  // ===== Helpers =====
  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const choice = (arr) => arr[Math.floor(Math.random()*arr.length)];

  // ===== Audio =====
  const AudioEngine = (() => {
    const ctx = window.AudioContext ? new AudioContext() : null;
    let enabled = true;
    const beep = (type='ok') => {
      if (!ctx || !enabled) return;
      const now = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = type === 'ok' ? 740 : 180; // high for drop, low for error
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      o.connect(g); g.connect(ctx.destination);
      o.start(now); o.stop(now + 0.2);
    };
    return {
      setEnabled(v){ enabled = v; },
      resume(){ ctx && ctx.resume && ctx.resume(); },
      ok(){ beep('ok'); },
      err(){ beep('err'); },
    };
  })();

  // ===== State =====
  const PIECES = ['pawn','knight','bishop','rook'];
  const state = {
    running: false,
    paused: false,
    score: 0,
    wave: 1,
    lives: 3,
    best: Number(localStorage.getItem('tr_highscore') || 0),
    pieces: [], // {id, type, lane, y, speed}
    spawnTimer: 0,
    spawnInterval: 1100, // ms
    baseSpeed: 90, // px/s (scaled per wave)
    combo: 0,
    selectedId: null,
    lastTime: 0,
  };

  // ===== DOM =====
  const DOM = {
    lanes: $$('.tr-lane'),
    bins: $$('.tr-bin'),
    score: $('#tr-score'),
    wave: $('#tr-wave'),
    lives: $('#tr-lives'),
    best: $('#tr-best'),
    start: $('#tr-start'),
    pause: $('#tr-pause'),
    restart: $('#tr-restart'),
    sound: $('#tr-sound'),
    theme: $('#tr-theme'),
    overlay: $('#tr-overlay'),
    overScore: $('#tr-over-score'),
    overBest: $('#tr-over-best'),
    overRestart: $('#tr-over-restart'),
    overClose: $('#tr-over-close'),           // NEW: close (×) button if present
  };
  DOM.best.textContent = String(state.best);

  // ===== Theme toggle =====
  const htmlEl = document.documentElement;
  function toggleTheme(){
    const curr = htmlEl.getAttribute('data-theme') || 'auto';
    const next = curr === 'dark' ? 'light' : curr === 'light' ? 'auto' : 'dark';
    htmlEl.setAttribute('data-theme', next);
  }
  DOM.theme.addEventListener('click', toggleTheme);

  // ===== Sound toggle =====
  DOM.sound.addEventListener('change', (e)=>{
    AudioEngine.setEnabled(e.target.checked);
    if (e.target.checked) { AudioEngine.resume(); AudioEngine.ok(); }
  });

  // ===== UI helpers =====
  function updateHUD(){
    DOM.score.textContent = String(state.score);
    DOM.wave.textContent = String(state.wave);
    DOM.lives.textContent = String(state.lives);
    DOM.best.textContent = String(state.best);
  }

  function pieceSvg(type){
    const commonAccent = '<rect x="18" y="48" width="28" height="8" class="tr-svg-accent"></rect>';
    if (type==='pawn') return '<circle cx="32" cy="22" r="10" class="tr-svg-core"></circle>' + commonAccent;
    if (type==='knight') return '<path d="M38 14l-8 6-4 8 2 10h14l-2-10 4-6-6-8z" class="tr-svg-core"></path>'+commonAccent;
    if (type==='bishop') return '<path d="M32 10c8 6 10 14 0 22-10-8-8-16 0-22z" class="tr-svg-core"></path>'+commonAccent;
    return '<rect x="20" y="12" width="24" height="12" class="tr-svg-core"></rect><rect x="18" y="24" width="28" height="22" class="tr-svg-core"></rect>'+commonAccent;
  }

  let idSeq = 1;
  function spawnPiece(){
    const lane = Math.floor(Math.random()*4);
    const type = choice(PIECES);
    const el = document.createElement('div');
    el.className = 'tr-piece';
    el.setAttribute('role','button');
    el.setAttribute('tabindex','0');
    el.setAttribute('aria-label', `Falling ${type}`);
    el.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true">${pieceSvg(type)}</svg>`;
    const id = idSeq++;
    el.dataset.id = String(id);
    el.dataset.type = type;
    el.dataset.lane = String(lane);
    // tap to select
    el.addEventListener('click', ()=>selectPiece(id));
    el.addEventListener('keydown', (e)=>{
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectPiece(id); }
    });
    DOM.lanes[lane].appendChild(el);
    state.pieces.push({ id, type, lane, y: -64, speed: state.baseSpeed + (state.wave-1)*30 });
  }

  function selectPiece(id){
    state.selectedId = id;
    $$('.tr-piece').forEach(p=>p.classList.toggle('tr-selected', Number(p.dataset.id)===id));
  }

  // bins click/tap
  DOM.bins.forEach(bin => {
    bin.addEventListener('click', () => trySortToBin(bin.dataset.bin));
  });

  function trySortToBin(binType){
    // If a piece is selected, use that; else pick the lowest piece
    let target = state.selectedId ? state.pieces.find(p=>p.id===state.selectedId) : lowestPiece();
    if (!target) return;
    const correct = target.type === binType;
    const binEl = DOM.bins.find(b => b.dataset.bin === binType);
    flashBin(binEl, correct ? 'success' : 'fail');
    if (correct) {
      scoreHit(target);
      removePiece(target.id);
      AudioEngine.ok();
    } else {
      missHit();
      removePiece(target.id);
      AudioEngine.err();
    }
    state.selectedId = null;
    $$('.tr-piece').forEach(p=>p.classList.remove('tr-selected'));
  }

  function lowestPiece(){
    let best = null;
    for (const p of state.pieces) {
      if (!best || p.y > best.y) best = p;
    }
    return best;
  }

  function flashBin(binEl, cls){
    binEl.classList.add(cls);
    setTimeout(()=>binEl.classList.remove(cls), 220);
  }

  function scoreHit(p){
    state.combo += 1;
    const mult = 1 + Math.floor(state.combo / 3); // every 3 corrects increases multiplier
    state.score += 10 * mult;
    updateHUD();
    // Wave up every 10 corrects
    if (state.combo % 10 === 0) nextWave();
  }

  function missHit(){
    state.combo = 0;
    state.lives = clamp(state.lives - 1, 0, 3);
    updateHUD();
    if (state.lives <= 0) endGame();
  }

  function removePiece(id){
    const idx = state.pieces.findIndex(p=>p.id===id);
    if (idx >= 0) {
      const p = state.pieces[idx];
      const laneEl = DOM.lanes[p.lane];
      const el = laneEl.querySelector(`.tr-piece[data-id="${id}"]`);
      if (el) el.remove();
      state.pieces.splice(idx,1);
    }
  }

  function nextWave(){
    state.wave += 1;
    // make it harder
    state.spawnInterval = Math.max(450, state.spawnInterval - 90);
    state.baseSpeed += 25;
    updateHUD();
  }

  // ===== Game flow =====
  function reset(hard=true){
    state.running = false;
    state.paused = false;
    state.score = 0;
    state.wave = 1;
    state.lives = 3;
    state.combo = 0;
    state.spawnInterval = 1100;
    state.baseSpeed = 90;
    state.pieces.splice(0);
    state.selectedId = null;
    state.lastTime = performance.now();
    // clear DOM
    $$('.tr-piece').forEach(el=>el.remove());
    updateHUD();
    hideOverlay(); // ensure modal never blocks play
  }

  function start(){
    if (state.running) return;
    reset(false);
    state.running = true;
    state.paused = false;
    state.lastTime = performance.now();
    loop(state.lastTime);
  }

  function pause(){
    state.paused = !state.paused;
    if (!state.paused) {
      state.lastTime = performance.now();
      loop(state.lastTime);
    }
  }

  function endGame(){
    state.running = false;
    state.paused = false;
    state.best = Math.max(state.best, state.score);
    localStorage.setItem('tr_highscore', String(state.best));
    showOverlay();
  }

  // ===== Modal show/hide (robust) =====
  function showOverlay(){
    DOM.overScore.textContent = String(state.score);
    DOM.overBest.textContent = String(state.best);
    DOM.overlay.hidden = false;
    // Extra guard in case any CSS overrides [hidden]
    DOM.overlay.style.display = 'grid';
    // Focus a close control for accessibility
    (DOM.overClose || DOM.overRestart)?.focus?.();
  }
  function hideOverlay(){
    DOM.overlay.hidden = true;
    // Extra guard
    DOM.overlay.style.display = 'none';
  }

  // ===== Loop =====
  function loop(ts){
    if (!state.running || state.paused) return;
    const dt = Math.min(50, ts - state.lastTime); // ms (cap to avoid jumps)
    state.lastTime = ts;

    // spawn
    state.spawnTimer += dt;
    if (state.spawnTimer >= state.spawnInterval) {
      state.spawnTimer = 0;
      spawnPiece();
    }

    // advance pieces
    for (const p of state.pieces) {
      p.y += (p.speed * (dt / 1000));
      const laneEl = DOM.lanes[p.lane];
      const el = laneEl.querySelector(`.tr-piece[data-id="${p.id}"]`);
      if (el) el.style.transform = `translate(-50%, ${p.y}px)`;
    }

    // check misses
    for (const p of [...state.pieces]) {
      const laneEl = DOM.lanes[p.lane];
      const laneHeight = laneEl.clientHeight;
      if (p.y + 56 >= laneHeight) { // piece reached bottom
        missHit();
        removePiece(p.id);
        AudioEngine.err();
      }
    }

    // schedule next frame
    requestAnimationFrame(loop);
  }

  // ===== Controls =====
  DOM.start.addEventListener('click', start);
  DOM.pause.addEventListener('click', pause);
  DOM.restart.addEventListener('click', () => { reset(true); start(); });
  DOM.overRestart.addEventListener('click', () => { hideOverlay(); reset(true); start(); });

  // NEW: ways to close the modal so it never blocks play
  if (DOM.overClose) {
    DOM.overClose.addEventListener('click', (e)=>{ e.stopPropagation(); hideOverlay(); });
  }
  // Click outside the modal (on the backdrop) closes it
  DOM.overlay.addEventListener('click', (e) => {
    if (e.target === DOM.overlay) hideOverlay();
  });
  // Press Esc to close the modal
  window.addEventListener('keydown', (e) => {
    if (!DOM.overlay.hidden && e.key === 'Escape') hideOverlay();
  });

  // Keyboard: numbers to bins + P/S for pause/start
  window.addEventListener('keydown', (e) => {
    if (e.key === '1') trySortToBin('pawn');
    else if (e.key === '2') trySortToBin('knight');
    else if (e.key === '3') trySortToBin('bishop');
    else if (e.key === '4') trySortToBin('rook');
    else if (e.key.toLowerCase() === 'p') pause();
    else if (e.key.toLowerCase() === 's') start();
  });

  // Init UI
  reset(true);
})();
