/* ===========
   ClarkeTJ Portfolio — Script
   =========== */

(function () {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  /* Year */
  $("#year") && ($("#year").textContent = new Date().getFullYear());

  /* Theme toggle with persistence */
  const THEME_KEY = "tc_theme_light";
  const themeToggle = $("#themeToggle");
  const setLight = (isLight) => {
    document.documentElement.classList.toggle("light", !!isLight);
    if (themeToggle) {
      themeToggle.setAttribute("aria-pressed", !!isLight);
      themeToggle.textContent = isLight ? "🌙" : "☀";
    }
    try { localStorage.setItem(THEME_KEY, isLight ? "1" : "0"); } catch {}
  };
  setLight((typeof localStorage !== "undefined" && localStorage.getItem(THEME_KEY) === "1"));
  themeToggle?.addEventListener("click", () => setLight(!document.documentElement.classList.contains("light")));

  /* Sticky header shadow */
  const header = $(".site-header");
  const onScroll = () => { if (!header) return; header.classList.toggle("scrolled", window.scrollY > 8); };
  onScroll(); window.addEventListener("scroll", onScroll, { passive: true });

  /* Mobile nav toggle */
  const navToggle = $(".nav-toggle");
  const navmenu = $("#navmenu");
  navToggle?.addEventListener("click", () => {
    const open = navmenu?.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  navmenu?.addEventListener("click", (e) => {
    if (e.target.tagName === "A" && navmenu.classList.contains("open")) {
      navmenu.classList.remove("open");
      navToggle?.setAttribute("aria-expanded", "false");
    }
  });

  /* Reveal on scroll */
  const revealEls = $$(".reveal");
  const io = ("IntersectionObserver" in window) && new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });
  revealEls.forEach(el => io && io.observe(el));

  /* Looping auto-typing in hero terminal */
  const typingEl = $(".typing code");
  const typingLines = [
"// Hello, I'm Clarke-Efayena Tejiri.",
  "// Web Developer • 400L Computer Science student • Fupre Chess Club Asst. Captain",
  "// Chess.com rating: 2060",
  "const mindset = {",
  "  coding: true, chess: true",
  "};",
  "mindset.coding && mindset.chess",
  "  ? console.log(\"Checkmate the impossible.\")",
  "  : console.log(\"Strategize again...\");"
  ];
  const typingText = typingLines.join("\n");
  const TYPE_SPEED = 28, HOLD_AFTER_TYPE = 1400, HOLD_AFTER_CLEAR = 500;
  function typeLoop() {
    if (!typingEl) return;
    let i = 0; typingEl.textContent = "";
    const tick = () => {
      if (i <= typingText.length) { typingEl.textContent = typingText.slice(0, i++); setTimeout(tick, TYPE_SPEED); }
      else { setTimeout(() => { typingEl.textContent = ""; setTimeout(typeLoop, HOLD_AFTER_CLEAR); }, HOLD_AFTER_TYPE); }
    };
    tick();
  }
  typeLoop();

  /* Subtle hero chessboard animation */
  let heroBoard;
  try {
    if (window.Chessboard) {
      heroBoard = Chessboard("heroBoard", { position: "start", draggable: false });
      let flip = false;
      setInterval(() => { if (!heroBoard) return; heroBoard.orientation(flip ? "white" : "black"); flip = !flip; }, 3000);
    }
  } catch {}

  // If chessboard.js didn't load, mark the boards as static fallbacks
(function ensureBoardFallback() {
  if (!window.Chessboard) {
    ["heroBoard", "gameBoard", "puzzleBoard"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add("fallback");
    });
  }
})();


  /* Projects: load from JSON */
  async function loadProjects() {
    try {
      const res = await fetch("data/projects.json", { cache: "no-store" });
      const items = await res.json();
      const grid = $("#projectsGrid");
      if (!grid) return;
      grid.innerHTML = "";
      items.forEach((p) => {
        const card = document.createElement("article");
        card.className = "card reveal";
        card.setAttribute("role", "listitem");
        card.innerHTML = `
          <div class="card-media">
            <img src="${p.thumbnail}" alt="${p.title} screenshot" loading="lazy" width="640" height="360">
          </div>
          <div class="card-body">
            <h3>${p.title}</h3>
            <p>${p.description}</p>
            <div class="badges">${p.tech.map(t => `<span class="badge">${t}</span>`).join("")}</div>
            <div class="card-actions">
              ${p.live ? `<a class="btn" target="_blank" rel="noopener" href="${p.live}">Live</a>` : ""}
              ${p.github ? `<a class="btn-secondary" target="_blank" rel="noopener" href="${p.github}">GitHub</a>` : ""}
            </div>
          </div>
        `;
        grid.appendChild(card);
        io && io.observe(card);
      });
    } catch (e) {
      console.warn("Projects failed to load.", e);
      const grid = $("#projectsGrid");
      if (grid) grid.innerHTML = `<p>Couldn’t load projects. Check <code>data/projects.json</code>.</p>`;
    }
  }

  /* Chess Data */
  let favPGN = "", puzzle = { fen: "", best: "Nf7+" }, recent = [], ratingSeries = [];

  async function loadChess() {
    try {
      const res = await fetch("data/chess_games.json", { cache: "no-store" });
      const data = await res.json();
      favPGN = data.favorite_pgn || "";
      puzzle = data.puzzle || puzzle;
      recent = data.recent_games || [];
      ratingSeries = data.rating_timeline || [];

      const ratingEl = $("#ratingNum");
      if (ratingEl && ratingSeries.length) {
        ratingEl.textContent = ratingSeries[ratingSeries.length - 1].rating;
      }

      renderRecent(); renderChart(); initViewer(); initPuzzle();
    } catch (e) { console.warn("Chess data failed.", e); }
  }

  function renderRecent() {
    const ul = $("#recentGames"); if (!ul) return;
    ul.innerHTML = "";
    recent.slice(0, 6).forEach(g => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${g.result}</strong> vs ${g.opponent} • <time datetime="${g.date}">${g.date}</time>
        <div class="muted">${g.site} • ${g.time_control || "—"} • Rating ${g.rating || ""}</div>`;
      ul.appendChild(li);
    });
  }

  function renderChart() {
    const ctx = $("#ratingChart");
    if (!ctx || !window.Chart || !ratingSeries.length) return;
    const labels = ratingSeries.map(d => d.date);
    const data = ratingSeries.map(d => d.rating);
    new Chart(ctx, {
      type: "line",
      data: { labels, datasets: [{ label: "Rating", data, tension: 0.25, pointRadius: 2 }] },
      options: { responsive: true, maintainAspectRatio: false,
        scales: { y: { suggestedMin: Math.min(...data) - 20, suggestedMax: Math.max(...data) + 20 } },
        plugins: { legend: { display: false } } }
    });
  }

  /* Game Viewer */
  let gameBoard, game, moves = [], moveIdx = 0;

  function initViewer() {
    if (!window.Chess || !window.Chessboard) return;
    game = new Chess();
    try { game.loadPgn(favPGN); moves = game.history({ verbose: true }); }
    catch { favPGN = "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *"; game = new Chess(); game.loadPgn(favPGN); moves = game.history({ verbose: true }); }
    game.reset();
    gameBoard = Chessboard("gameBoard", { position: "start", draggable: false });
    moveIdx = 0; updatePgnLog();

    $("#firstBtn")?.addEventListener("click", () => { game.reset(); moveIdx = 0; gameBoard.position(game.fen()); updatePgnLog(); });
    $("#prevBtn")?.addEventListener("click", () => { if (moveIdx>0) { game.undo(); moveIdx--; gameBoard.position(game.fen()); updatePgnLog(); }});
    $("#nextBtn")?.addEventListener("click", () => { if (moveIdx<moves.length) { game.move(moves[moveIdx]); moveIdx++; gameBoard.position(game.fen()); updatePgnLog(); }});
    $("#lastBtn")?.addEventListener("click", () => { while (moveIdx<moves.length) { game.move(moves[moveIdx++]); } gameBoard.position(game.fen()); updatePgnLog(); });
  }
  function updatePgnLog() { const log = $("#pgnLog"); if (!log || !game) return; log.textContent = game.pgn(); }

  /* Puzzle */
  let puzzleBoard, puzzleGame;
  function initPuzzle() {
    if (!window.Chess || !window.Chessboard) return;
    puzzleGame = new Chess(puzzle.fen || "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w kq - 0 1");
    puzzleBoard = Chessboard("puzzleBoard", { position: puzzleGame.fen(), draggable: false });

    $("#checkMoveBtn")?.addEventListener("click", () => {
      const input = $("#moveInput"); const feedback = $("#puzzleFeedback");
      if (!input || !feedback) return;
      const guess = input.value.trim(); if (!guess) return;
      const legal = puzzleGame.moves({ verbose: true }).map(m => m.san);
      if (!legal.includes(guess)) { feedback.textContent = "That move isn't legal in this position. Try again."; return; }
      feedback.textContent = (guess === (puzzle.best || "Nf7+")) ? "Correct! Nice calculation." : "Not the best move. Look for forcing moves.";
    });

    $("#resetPuzzleBtn")?.addEventListener("click", () => {
      puzzleGame = new Chess(puzzle.fen);
      puzzleBoard.position(puzzleGame.fen());
      const feedback = $("#puzzleFeedback"); if (feedback) feedback.textContent = "";
      const input = $("#moveInput"); if (input) input.value = "";
    });
  }

  /* Blog lists */
  async function loadPosts() {
    const lists = [$("#blogList"), $("#blogAll")].filter(Boolean);
    if (!lists.length) return;
    try {
      const res = await fetch("data/posts.json", { cache: "no-store" });
      const posts = await res.json();
      lists.forEach(list => {
        list.innerHTML = "";
        posts.forEach(p => {
          const card = document.createElement("article");
          card.className = "card reveal";
          card.innerHTML = `
            <div class="card-body">
              <h3>${p.title}</h3>
              <p class="muted"><time datetime="${p.date}">${p.date}</time> • ${p.category}</p>
              <p>${p.excerpt}</p>
              <div class="card-actions">
                <a class="btn-secondary" href="${p.url}">Read</a>
              </div>
            </div>
          `;
          list.appendChild(card);
          io && io.observe(card);
        });
      });
    } catch (e) { console.warn("Posts failed to load.", e); }
  }

  /* Persona Lightbox (accessible) */
  const lb = $("#lightbox"), lbImg = $("#lb-img"), lbCap = $("#lb-cap");
  const lbClose = $(".lb-close");
  function openLightbox(fig) {
    if (!lb || !lbImg) return;
    const img = $("img", fig);
    const full = fig.getAttribute("data-full");
    lbImg.src = (full && full.trim()) ? full : img.src;
    lbImg.alt = img.alt || "";
    if (lbCap) lbCap.textContent = $(".portrait-cap", fig)?.innerText || "";
    lb.hidden = false;
    lbClose?.focus();
    document.body.style.overflow = "hidden"; // prevent background scroll
  }
  function closeLightbox() {
    if (!lb) return;
    lb.hidden = true;
    document.body.style.overflow = ""; // restore scroll
  }
  lbClose?.addEventListener("click", closeLightbox);
  lb?.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !lb.hidden) closeLightbox(); });

  $$(".portrait").forEach(fig => {
    fig.addEventListener("click", () => openLightbox(fig));
    fig.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openLightbox(fig); }
    });
  });

  /* Init data */
  loadProjects(); loadChess(); loadPosts();
})();
