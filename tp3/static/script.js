/**
 * ChefBot v2 · script.js
 * Features: streaming, markdown, favorites, search, print, countries
 */
"use strict";

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  history: [],
  isLoading: false,
  currentModel: "",
  favorites: JSON.parse(localStorage.getItem("chefbot_favorites") || "[]"),
};

// ── DOM ────────────────────────────────────────────────────────────────────
const $messages = document.getElementById("messages");
const $input = document.getElementById("user-input");
const $sendBtn = document.getElementById("send-btn");
const $typing = document.getElementById("typing");
const $clearBtn = document.getElementById("clear-btn");
const $modelSelect = document.getElementById("model-select");
const $modelLabel = document.getElementById("model-label");
const $ollamaPill = document.getElementById("ollama-status");
const $statusText = document.getElementById("status-text");
const $charCount = document.getElementById("char-count");
const $suggList = document.getElementById("suggestions-list");
const $countriesList = document.getElementById("countries-list");
const $favList = document.getElementById("favorites-list");
const $menuBtn = document.getElementById("menu-btn");
const $sidebar = document.getElementById("sidebar");
const $printBtn = document.getElementById("print-btn");
const $searchInput = document.getElementById("recipe-search");
const $searchResults = document.getElementById("search-results");
const $welcome = document.getElementById("welcome-card");

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  await checkStatus();
  await loadSuggestions();
  await loadCountries();
  renderFavorites();
  bindEvents();
}

// ── Status ─────────────────────────────────────────────────────────────────
async function checkStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    if (data.ollama_running) {
      $ollamaPill.className = "status-pill online";
      $statusText.textContent = "En ligne";
      populateModels(data.models, data.default_model);
    } else {
      $ollamaPill.className = "status-pill offline";
      $statusText.textContent = "Hors ligne";
      showToast("⚠️ Ollama non démarré — lancez: ollama serve");
    }
  } catch {
    showToast("⚠️ Impossible de contacter Flask");
  }
}

function populateModels(models, def) {
  $modelSelect.innerHTML = "";
  if (!models.length) {
    $modelSelect.appendChild(new Option("Aucun modèle", ""));
    return;
  }
  models.forEach((m) => {
    const o = new Option(m, m);
    if (m === def || m.startsWith(def)) o.selected = true;
    $modelSelect.appendChild(o);
  });
  state.currentModel = $modelSelect.value;
  $modelLabel.textContent = state.currentModel;
}

// ── Suggestions ────────────────────────────────────────────────────────────
async function loadSuggestions() {
  try {
    const items = await fetch("/api/suggestions").then((r) => r.json());
    $suggList.innerHTML = "";
    items.forEach((s) => {
      const d = document.createElement("div");
      d.className = "suggestion-item";
      d.innerHTML = `<span class="suggestion-emoji">${s.emoji}</span><span>${s.text}</span>`;
      d.onclick = () => sendMessage(s.text);
      $suggList.appendChild(d);
    });
  } catch {}
}

// ── Countries ──────────────────────────────────────────────────────────────
async function loadCountries() {
  try {
    const data = await fetch("/api/recipes-by-country").then((r) => r.json());
    $countriesList.innerHTML = "";
    Object.entries(data).forEach(([country, recipes]) => {
      const group = document.createElement("div");
      group.className = "country-group";
      group.innerHTML = `
                 <div class="country-header">
                     <span>${country}</span>
                     <span class="country-arrow">›</span>
                 </div>
                 <div class="country-recipes">
                     ${recipes
                       .map(
                         (r) => `
                         <div class="recipe-item" data-query="${escHtml(
                           r.query
                         )}">
                             <span>${r.emoji}</span><span>${r.name}</span>
                         </div>
                     `
                       )
                       .join("")}
                 </div>
             `;
      group.querySelector(".country-header").onclick = () => {
        group.classList.toggle("open");
      };
      group.querySelectorAll(".recipe-item").forEach((item) => {
        item.onclick = () => sendMessage(item.dataset.query);
      });
      $countriesList.appendChild(group);
    });
  } catch {}
}

// ── Search ─────────────────────────────────────────────────────────────────
let searchTimer;
function handleSearch(e) {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  if (!q) {
    $searchResults.classList.add("hidden");
    return;
  }
  searchTimer = setTimeout(async () => {
    try {
      const results = await fetch(
        `/api/search?q=${encodeURIComponent(q)}`
      ).then((r) => r.json());
      if (!results.length) {
        $searchResults.classList.add("hidden");
        return;
      }
      $searchResults.innerHTML = results
        .map(
          (r) => `
                 <div class="search-result-item" data-query="${escHtml(
                   r.query
                 )}">
                     <span>${r.emoji}</span>
                     <span>${r.name}</span>
                     <span class="search-country-tag">${r.country}</span>
                 </div>
             `
        )
        .join("");
      $searchResults.querySelectorAll(".search-result-item").forEach((el) => {
        el.onclick = () => {
          sendMessage(el.dataset.query);
          $searchInput.value = "";
          $searchResults.classList.add("hidden");
        };
      });
      $searchResults.classList.remove("hidden");
    } catch {}
  }, 300);
}

// ── Favorites ──────────────────────────────────────────────────────────────
function saveFavorites() {
  localStorage.setItem("chefbot_favorites", JSON.stringify(state.favorites));
}

function addFavorite(text) {
  const short = text.slice(0, 200);
  if (state.favorites.find((f) => f.text === short)) {
    showToast("Déjà dans vos favoris !");
    return;
  }
  state.favorites.unshift({ id: Date.now(), text: short });
  saveFavorites();
  renderFavorites();
  showToast("⭐ Ajouté aux favoris !");
  // Switch to favorites tab
  document.querySelector('[data-tab="favorites"]').click();
}

function removeFavorite(id) {
  state.favorites = state.favorites.filter((f) => f.id !== id);
  saveFavorites();
  renderFavorites();
}

function renderFavorites() {
  if (!state.favorites.length) {
    $favList.innerHTML =
      '<div class="empty-state">⭐ Aucun favori.<br>Cliquez ★ sur un message pour sauvegarder.</div>';
    return;
  }
  $favList.innerHTML = "";
  state.favorites.forEach((fav) => {
    const d = document.createElement("div");
    d.className = "fav-item";
    d.innerHTML = `
             <span class="fav-text">${escHtml(fav.text.slice(0, 120))}${
      fav.text.length > 120 ? "..." : ""
    }</span>
             <button class="fav-del" title="Supprimer">✕</button>
         `;
    d.querySelector(".fav-text").onclick = () => sendMessage(fav.text);
    d.querySelector(".fav-del").onclick = (e) => {
      e.stopPropagation();
      removeFavorite(fav.id);
    };
    $favList.appendChild(d);
  });
}

// ── Print ──────────────────────────────────────────────────────────────────
function printConversation() {
  window.print();
}

// ── Events ─────────────────────────────────────────────────────────────────
function bindEvents() {
  $sendBtn.addEventListener("click", () => {
    const m = $input.value.trim();
    if (m) sendMessage(m);
  });
  $input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const m = $input.value.trim();
      if (m) sendMessage(m);
    }
  });
  $input.addEventListener("input", () => {
    autoResize();
    updateCount();
  });
  $clearBtn.addEventListener("click", clearConv);
  $modelSelect.addEventListener("change", () => {
    state.currentModel = $modelSelect.value;
    $modelLabel.textContent = state.currentModel;
  });
  $menuBtn.addEventListener("click", () => $sidebar.classList.toggle("open"));
  document.addEventListener("click", (e) => {
    if (
      window.innerWidth <= 768 &&
      !$sidebar.contains(e.target) &&
      !$menuBtn.contains(e.target)
    )
      $sidebar.classList.remove("open");
    if (!$searchInput.contains(e.target) && !$searchResults.contains(e.target))
      $searchResults.classList.add("hidden");
  });
  $printBtn.addEventListener("click", printConversation);
  $searchInput.addEventListener("input", handleSearch);

  // Tabs
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".tab-btn")
        .forEach((b) => b.classList.remove("active"));
      document
        .querySelectorAll(".tab-content")
        .forEach((c) => c.classList.add("hidden"));
      btn.classList.add("active");
      document
        .getElementById("tab-" + btn.dataset.tab)
        .classList.remove("hidden");
    });
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────
function autoResize() {
  $input.style.height = "auto";
  $input.style.height = Math.min($input.scrollHeight, 160) + "px";
}
function updateCount() {
  const l = $input.value.length;
  $charCount.textContent = `${l} / 2000`;
  $charCount.style.color = l > 1800 ? "#ef4444" : "";
}
function scrollBottom() {
  $messages.scrollTop = $messages.scrollHeight;
}
function setLoading(v) {
  state.isLoading = v;
  $sendBtn.disabled = v;
  $input.disabled = v;
}
function showTyping(v) {
  $typing.classList.toggle("hidden", !v);
}
function hideWelcome() {
  if ($welcome) {
    $welcome.style.opacity = "0";
    $welcome.style.transition = "opacity 0.3s";
    setTimeout(() => $welcome?.remove(), 300);
  }
}
function showToast(msg, duration = 3000) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("hidden"), duration);
}
function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function getTime() {
  return new Date().toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Send ───────────────────────────────────────────────────────────────────
async function sendMessage(text) {
  if (state.isLoading) return;
  const msg = (text || $input.value).trim();
  if (!msg) return;

  hideWelcome();
  appendUser(msg);
  state.history.push({ role: "user", content: msg });
  $input.value = "";
  autoResize();
  updateCount();
  setLoading(true);
  showTyping(true);
  scrollBottom();

  try {
    await streamResp(msg);
  } catch (err) {
    appendError("Erreur: " + err.message);
  } finally {
    setLoading(false);
    showTyping(false);
    scrollBottom();
    $input.focus();
  }
}

// ── Streaming ──────────────────────────────────────────────────────────────
async function streamResp(userMsg) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: userMsg,
      history: state.history.slice(-20),
      model: state.currentModel,
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || "Erreur " + res.status);
  }

  showTyping(false);
  const { bubble, bodyEl, fullText: ft } = appendAssistant();
  let fullText = "";
  const cursor = mkCursor();
  bubble.appendChild(cursor);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const js = line.slice(5).trim();
      if (!js) continue;
      try {
        const chunk = JSON.parse(js);
        if (chunk.error) {
          bubble.removeChild(cursor);
          bubble.innerHTML = `<span style="color:#ef6060">⚠️ ${escHtml(
            chunk.error
          )}</span>`;
          bubble.classList.add("msg-error");
          return;
        }
        if (chunk.content) {
          fullText += chunk.content;
          bubble.removeChild(cursor);
          bubble.innerHTML = renderMd(fullText);
          bubble.appendChild(cursor);
          scrollBottom();
        }
      } catch {}
    }
  }

  bubble.removeChild(cursor);
  bubble.innerHTML = renderMd(fullText);
  if (bodyEl) {
    const t = bodyEl.querySelector(".msg-time");
    if (t) t.textContent = getTime();
    // Add action buttons
    const acts = bodyEl.querySelector(".msg-actions");
    if (acts) {
      acts.innerHTML = `
                 <button class="msg-action-btn" onclick="copyText(this)" data-text="${escHtml(
                   fullText
                 )}">📋 Copier</button>
                 <button class="msg-action-btn" onclick="favText(this)" data-text="${escHtml(
                   fullText
                 )}">⭐ Favori</button>
             `;
    }
  }
  state.history.push({ role: "assistant", content: fullText });
}

// ── Message builders ───────────────────────────────────────────────────────
function appendUser(text) {
  const d = document.createElement("div");
  d.className = "message user";
  d.innerHTML = `
         <div class="msg-avatar">👤</div>
         <div class="msg-body">
             <div class="msg-bubble">${escHtml(text)}</div>
             <div class="msg-time">${getTime()}</div>
         </div>`;
  $messages.appendChild(d);
  scrollBottom();
}

function appendAssistant() {
  const d = document.createElement("div");
  d.className = "message assistant";
  d.innerHTML = `
         <div class="msg-avatar">👨‍🍳</div>
         <div class="msg-body">
             <div class="msg-bubble"></div>
             <div class="msg-actions"></div>
             <div class="msg-time">...</div>
         </div>`;
  $messages.appendChild(d);
  scrollBottom();
  return {
    bubble: d.querySelector(".msg-bubble"),
    bodyEl: d.querySelector(".msg-body"),
  };
}

function appendError(text) {
  const d = document.createElement("div");
  d.className = "message assistant";
  d.innerHTML = `
         <div class="msg-avatar">👨‍🍳</div>
         <div class="msg-body">
             <div class="msg-bubble msg-error">⚠️ ${escHtml(text)}</div>
             <div class="msg-time">${getTime()}</div>
         </div>`;
  $messages.appendChild(d);
  scrollBottom();
}

function mkCursor() {
  const s = document.createElement("span");
  s.className = "cursor";
  return s;
}

// ── Markdown ───────────────────────────────────────────────────────────────
function renderMd(text) {
  let h = escHtml(text);
  h = h
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^---$/gm, "<hr>")
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^[•\-\*] (.+)$/gm, "<li>$1</li>")
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");
  h = h.replace(/(<li>.*?<\/li>)(\s*<li>.*?<\/li>)*/gs, (m) => `<ul>${m}</ul>`);
  return `<p>${h}</p>`;
}

// ── Actions ────────────────────────────────────────────────────────────────
window.copyText = (btn) => {
  const text = btn.dataset.text;
  navigator.clipboard
    .writeText(text)
    .then(() => showToast("📋 Copié !"))
    .catch(() => showToast("Erreur copie"));
};
window.favText = (btn) => {
  addFavorite(btn.dataset.text);
};
window.sendQuick = (text) => sendMessage(text);

// ── Clear ──────────────────────────────────────────────────────────────────
function clearConv() {
  if (!confirm("Effacer toute la conversation ?")) return;
  state.history = [];
  $messages.innerHTML = "";
  const w = document.createElement("div");
  w.className = "welcome";
  w.id = "welcome-card";
  w.innerHTML = `
         <div class="welcome-icon">🍽️</div>
         <h2 class="welcome-title">Bonjour, je suis ChefBot !</h2>
         <p class="welcome-desc">Votre chef personnel disponible 24h/24.</p>
         <div class="quick-chips">
             <span class="qchip" onclick="sendQuick('Propose-moi une recette facile pour ce soir')">🌙 Recette du soir</span>
             <span class="qchip" onclick="sendQuick('Recette végétarienne rapide')">🥦 Végétarien</span>
             <span class="qchip" onclick="sendQuick('Un dessert spectaculaire')">🍰 Dessert</span>
         </div>`;
  $messages.appendChild(w);
}

// ── Start ──────────────────────────────────────────────────────────────────
init();

// ── Ingredient Mode ────────────────────────────────────────────────────────
window.openIngredientMode = function () {
  document.getElementById("ingredient-panel").classList.remove("hidden");
  setTimeout(() => document.getElementById("ingredient-input").focus(), 100);
};

window.closeIngredientMode = function () {
  document.getElementById("ingredient-panel").classList.add("hidden");
  document.getElementById("ingredient-input").value = "";
};

window.sendIngredients = function () {
  const ingredients = document.getElementById("ingredient-input").value.trim();
  if (!ingredients) {
    showToast("⚠️ Ecrivez vos ingredients d'abord !");
    return;
  }
  const msg = `J'ai ces ingredients disponibles : ${ingredients}. 
 Peux-tu me dire :
 1. Si je peux faire une recette complete avec ces ingredients
 2. Si non, quels ingredients il manque et quelle recette je peux faire si je les ajoute ?`;
  closeIngredientMode();
  sendMessage(msg);
};

// Close panel on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeIngredientMode();
});
