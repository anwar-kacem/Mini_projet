/**
 * ChefBot · script.js
 * Chat logic: streaming, markdown, sidebar, suggestions
 */

"use strict";

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  history: [],
  isLoading: false,
  currentModel: "",
};

// ── DOM Refs ───────────────────────────────────────────────────────────────
const $messages = document.getElementById("messages");
const $input = document.getElementById("user-input");
const $sendBtn = document.getElementById("send-btn");
const $typingInd = document.getElementById("typing");
const $clearBtn = document.getElementById("clear-btn");
const $modelSelect = document.getElementById("model-select");
const $modelLabel = document.getElementById("model-label");
const $ollamaPill = document.getElementById("ollama-status");
const $pillText = $ollamaPill.querySelector(".pill-text");
const $charCount = document.getElementById("char-count");
const $suggList = document.getElementById("suggestions-list");
const $sidebarToggle = document.getElementById("sidebar-toggle");
const $sidebar = document.querySelector(".sidebar");
const $welcomeCard = document.getElementById("welcome-card");

async function init() {
  await checkStatus();
  await loadSuggestions();
  bindEvents();
}

async function checkStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    if (data.ollama_running) {
      $ollamaPill.className = "ollama-pill online";
      $pillText.textContent = "En ligne";
      populateModels(data.models, data.default_model);
    } else {
      $ollamaPill.className = "ollama-pill offline";
      $pillText.textContent = "Hors ligne";
      showStatusBar("⚠️", "Ollama n'est pas démarré. Lancez: ollama serve");
    }
  } catch {
    showStatusBar("⚠️", "Impossible de contacter le serveur Flask");
  }
}

function populateModels(models, defaultModel) {
  $modelSelect.innerHTML = "";
  if (!models.length) {
    $modelSelect.appendChild(new Option("Aucun modèle trouvé", ""));
    return;
  }
  models.forEach((m) => {
    const opt = new Option(m, m);
    if (m === defaultModel || m.startsWith(defaultModel)) opt.selected = true;
    $modelSelect.appendChild(opt);
  });
  state.currentModel = $modelSelect.value;
  $modelLabel.textContent = state.currentModel;
}

async function loadSuggestions() {
  try {
    const res = await fetch("/api/suggestions");
    const items = await res.json();
    $suggList.innerHTML = "";
    items.forEach((s) => {
      const div = document.createElement("div");
      div.className = "suggestion-item";
      div.innerHTML = `<span class="suggestion-emoji">${s.emoji}</span><span>${s.text}</span>`;
      div.addEventListener("click", () => sendMessage(s.text));
      $suggList.appendChild(div);
    });
  } catch {}
}

function bindEvents() {
  $sendBtn.addEventListener("click", () => {
    const msg = $input.value.trim();
    if (msg) sendMessage(msg);
  });
  $input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const msg = $input.value.trim();
      if (msg) sendMessage(msg);
    }
  });
  $input.addEventListener("input", () => {
    autoResize();
    updateCharCount();
  });
  $clearBtn.addEventListener("click", clearConversation);
  $modelSelect.addEventListener("change", () => {
    state.currentModel = $modelSelect.value;
    $modelLabel.textContent = state.currentModel;
  });
  $sidebarToggle.addEventListener("click", () =>
    $sidebar.classList.toggle("open")
  );
  document.addEventListener("click", (e) => {
    if (
      window.innerWidth <= 768 &&
      !$sidebar.contains(e.target) &&
      !$sidebarToggle.contains(e.target)
    )
      $sidebar.classList.remove("open");
  });
}

function autoResize() {
  $input.style.height = "auto";
  $input.style.height = Math.min($input.scrollHeight, 160) + "px";
}
function updateCharCount() {
  const len = $input.value.length;
  $charCount.textContent = `${len}/2000`;
  $charCount.style.color = len > 1800 ? "#ef4444" : "";
}

async function sendMessage(text) {
  if (state.isLoading) return;
  const msg = (text || $input.value).trim();
  if (!msg) return;
  hideWelcome();
  appendUserMessage(msg);
  state.history.push({ role: "user", content: msg });
  $input.value = "";
  autoResize();
  updateCharCount();
  setLoading(true);
  showTyping(true);
  scrollToBottom();
  try {
    await streamResponse(msg);
  } catch (err) {
    appendErrorMessage("Erreur: " + err.message);
  } finally {
    setLoading(false);
    showTyping(false);
    scrollToBottom();
    $input.focus();
  }
}

async function streamResponse(userMsg) {
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
  const { bubble, bodyEl } = appendAssistantMessage();
  let fullText = "";
  const cursor = createCursor();
  bubble.appendChild(cursor);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const jsonStr = line.slice(5).trim();
      if (!jsonStr) continue;
      try {
        const chunk = JSON.parse(jsonStr);
        if (chunk.error) {
          bubble.removeChild(cursor);
          bubble.innerHTML = `<span style="color:#b91c1c">⚠️ ${escapeHtml(
            chunk.error
          )}</span>`;
          bubble.classList.add("message-error");
          return;
        }
        if (chunk.content) {
          fullText += chunk.content;
          bubble.removeChild(cursor);
          bubble.innerHTML = renderMarkdown(fullText);
          bubble.appendChild(cursor);
          scrollToBottom();
        }
      } catch {}
    }
  }
  bubble.removeChild(cursor);
  bubble.innerHTML = renderMarkdown(fullText);
  if (bodyEl) {
    const t = bodyEl.querySelector(".message-time");
    if (t) t.textContent = getTime();
  }
  state.history.push({ role: "assistant", content: fullText });
}

function appendUserMessage(text) {
  const div = document.createElement("div");
  div.className = "message user";
  div.innerHTML = `<div class="message-avatar">👤</div><div class="message-body"><div class="message-bubble">${escapeHtml(
    text
  )}</div><div class="message-time">${getTime()}</div></div>`;
  $messages.appendChild(div);
  scrollToBottom();
}

function appendAssistantMessage() {
  const div = document.createElement("div");
  div.className = "message assistant";
  div.innerHTML = `<div class="message-avatar">👨‍🍳</div><div class="message-body"><div class="message-bubble"></div><div class="message-time">...</div></div>`;
  $messages.appendChild(div);
  scrollToBottom();
  return {
    bubble: div.querySelector(".message-bubble"),
    bodyEl: div.querySelector(".message-body"),
  };
}

function appendErrorMessage(text) {
  const div = document.createElement("div");
  div.className = "message assistant";
  div.innerHTML = `<div class="message-avatar">👨‍🍳</div><div class="message-body"><div class="message-bubble message-error">⚠️ ${escapeHtml(
    text
  )}</div><div class="message-time">${getTime()}</div></div>`;
  $messages.appendChild(div);
  scrollToBottom();
}

function createCursor() {
  const s = document.createElement("span");
  s.className = "streaming-cursor";
  return s;
}

function renderMarkdown(text) {
  let html = escapeHtml(text);
  html = html
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
  html = html.replace(
    /(<li>.*?<\/li>)(\s*<li>.*?<\/li>)*/gs,
    (m) => `<ul>${m}</ul>`
  );
  return `<p>${html}</p>`;
}

function escapeHtml(str) {
  return String(str)
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
function scrollToBottom() {
  $messages.scrollTop = $messages.scrollHeight;
}
function setLoading(val) {
  state.isLoading = val;
  $sendBtn.disabled = val;
  $input.disabled = val;
}
function showTyping(val) {
  $typingInd.classList.toggle("hidden", !val);
}
function hideWelcome() {
  if ($welcomeCard) {
    $welcomeCard.style.transition = "opacity 0.3s ease";
    $welcomeCard.style.opacity = "0";
    setTimeout(() => $welcomeCard.remove(), 300);
  }
}
function showStatusBar(icon, text) {
  const bar = document.getElementById("status-bar");
  document.getElementById("status-icon").textContent = icon;
  document.getElementById("status-text").textContent = text;
  bar.classList.remove("hidden");
  setTimeout(() => bar.classList.add("hidden"), 7000);
}
function clearConversation() {
  if (!state.history.length && !$messages.querySelector(".message")) return;
  if (!confirm("Effacer toute la conversation ?")) return;
  state.history = [];
  $messages.innerHTML = "";
  const card = document.createElement("div");
  card.className = "welcome-card";
  card.id = "welcome-card";
  card.innerHTML = `<div class="welcome-emoji">🍽️</div><h2 class="welcome-title">Bonjour, je suis ChefBot!</h2><p class="welcome-sub">Votre chef personnel disponible 24h/24.</p><div class="welcome-chips"><span class="chip" onclick="sendQuick('Propose-moi une recette facile pour ce soir')">🌙 Recette du soir</span><span class="chip" onclick="sendQuick('Recette végétarienne rapide')">🥦 Végétarien</span></div>`;
  $messages.appendChild(card);
}

window.sendQuick = (text) => sendMessage(text);
init();
