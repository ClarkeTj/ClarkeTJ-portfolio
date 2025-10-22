
(function () {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  /* Year */
  $("#year") && ($("#year").textContent = new Date().getFullYear());

/* Theme toggle with persistence (Font Awesome Icons) */
const THEME_KEY = "tc_theme_light";
const themeToggle = $("#themeToggle");

const setLight = (isLight) => {
  document.documentElement.classList.toggle("light", !!isLight);

  if (themeToggle) {
    themeToggle.setAttribute("aria-pressed", !!isLight);

    // use Font Awesome icons instead of emojis
    themeToggle.innerHTML = isLight
      ? '<i class="fa-solid fa-moon"></i>'
      : '<i class="fa-solid fa-sun"></i>';
  }

  try {
    localStorage.setItem(THEME_KEY, isLight ? "1" : "0");
  } catch {}
};

// initialize based on saved preference
setLight(
  typeof localStorage !== "undefined" &&
    localStorage.getItem(THEME_KEY) === "1"
);

// toggle on click
themeToggle?.addEventListener("click", () =>
  setLight(!document.documentElement.classList.contains("light"))
);

/* Sticky header shadow */
const header = $(".site-header");
const onScroll = () => {
  if (!header) return;
  header.classList.toggle("scrolled", window.scrollY > 8);
};
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

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

  /* ==========================
   HERO AUTO-TYPING 
   ========================== */
(() => {
  const typingEl = document.querySelector(".typing");
  if (!typingEl) return;

  const codeEl = typingEl.querySelector("code");

  // Your lines (edit freely)
  const typingLines = [
    "// Hello, I'm Clarke-Efayena Tejiri.",
    "// Web Developer • 400L Computer Science student • Fupre Chess Club Asst. Captain",
    "// Chess.com rating: 2076",
    "// Lichess rating: 2000",
    " " ,
    "const mindset = {",
    "  coding: true, chess: true",
    "};",
    " ",
    "mindset.coding && mindset.chess",
    '  ? console.log("Checkmate the impossible.")',
    '  : console.log("Strategize again...");'
  ];

  // Typing speeds
  const TYPE_MS = 20;       // per character
  const LINE_PAUSE = 500;   // gap between lines
  const LOOP_PAUSE = 900;   // gap at the end before restarting

  let li = 0;  // line index
  let ci = 0;  // char index

  function scrollToBottom() {
    // Run after the DOM paints, so the scrollHeight is accurate
    requestAnimationFrame(() => {
      typingEl.scrollTop = typingEl.scrollHeight;
    });
  }

  function typeNext() {
    if (li >= typingLines.length) {
      // loop
      return setTimeout(() => {
        li = 0; ci = 0;
        codeEl.textContent = "";
        scrollToBottom();
        typeNext();
      }, LOOP_PAUSE);
    }

    const line = typingLines[li];

    if (ci < line.length) {
      // type char-by-char
      codeEl.textContent += line.charAt(ci++);
      // add newline if we just finished a line
      if (ci === line.length) codeEl.textContent += "\n";
      scrollToBottom();
      return setTimeout(typeNext, TYPE_MS);
    }

    // next line
    ci = 0; li++;
    setTimeout(typeNext, LINE_PAUSE);
  }

  // init
  codeEl.textContent = "";
  typeNext();
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
  let  recent = [], ratingSeries = [];

  async function loadChess() {
    try {
      const res = await fetch("data/chess_games.json", { cache: "no-store" });
      const data = await res.json();
      recent = data.recent_games || [];
      ratingSeries = data.rating_timeline || [];

      const ratingEl = $("#ratingNum");
      if (ratingEl && ratingSeries.length) {
        ratingEl.textContent = ratingSeries[ratingSeries.length - 1].rating;
      }

      renderRecent(); renderChart(); 
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


// Utility: get correct base path for JSON depending on folder depth
function getBasePath() {
  if (window.location.pathname.includes("/posts/")) {
    return "../data/"; // if inside /posts/
  }
  return "data/"; // root
}

// Only run projects fetch if #projectsGrid exists
const projectsGrid = document.getElementById("projectsGrid");
if (projectsGrid) {
  fetch(getBasePath() + "projects.json")
    .then(res => res.json())
    .then(data => {
      console.log("Projects loaded:", data);
      // renderProjects(data);
    })
    .catch(err => console.error("Projects failed to load:", err));
}

// Only run chess fetch if #recentGames or #ratingChart exists
const chessSection = document.getElementById("recentGames") || document.getElementById("ratingChart");
if (chessSection) {
  fetch(getBasePath() + "chess_games.json")
    .then(res => res.json())
    .then(data => {
      console.log("Chess data loaded:", data);
      // renderChess(data);
    })
    .catch(err => console.error("Chess data failed:", err));
}
