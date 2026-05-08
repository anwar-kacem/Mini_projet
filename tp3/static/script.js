let isLoading = false;

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}

function handleKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function sendSuggestion(text) {
  document.getElementById("message-input").value = text;
  sendMessage();
}

function formatMessage(text) {
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");
  text = text.replace(/\n/g, "<br>");
  return text;
}

function escapeHtml(text) {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}

function appendMessage(role, content, isError = false) {
  const container = document.getElementById("chat-container");

  const welcome = document.getElementById("welcome-card");
  if (welcome) welcome.style.display = "none";

  const div = document.createElement("div");
  div.className = `message ${role}`;

  const avatar = role === "bot" ? "🍳" : "👤";

  if (isError) {
    div.innerHTML = `
      <div class="avatar">${avatar}</div>
      <div class="error-bubble">${content}</div>
    `;
  } else {
    div.innerHTML = `
      <div class="avatar">${avatar}</div>
      <div class="bubble">${
        role === "bot" ? formatMessage(content) : escapeHtml(content)
      }</div>
    `;
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function showTyping() {
  const container = document.getElementById("chat-container");
  const div = document.createElement("div");
  div.className = "typing-indicator";
  div.id = "typing";
  div.innerHTML = `
    <div class="avatar" style="background:linear-gradient(135deg,#c0603a,#9e4b2a);box-shadow:0 2px 8px rgba(192,96,58,.25);border-radius:10px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;margin-top:2px;">🍳</div>
    <div class="typing-dots">
      <span></span><span></span><span></span>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function hideTyping() {
  const t = document.getElementById("typing");
  if (t) t.remove();
}

async function sendMessage() {
  if (isLoading) return;

  const input = document.getElementById("message-input");
  const message = input.value.trim();
  if (!message) return;

  input.value = "";
  input.style.height = "auto";

  appendMessage("user", message);

  isLoading = true;
  document.getElementById("send-btn").disabled = true;
  showTyping();

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const data = await response.json();
    hideTyping();

    if (data.error) {
      appendMessage("bot", `⚠️ ${data.error}`, true);
    } else {
      appendMessage("bot", data.response);
    }
  } catch (err) {
    hideTyping();
    appendMessage(
      "bot",
      "⚠️ Connexion impossible. Vérifiez que le serveur Flask est bien lancé.",
      true
    );
  } finally {
    isLoading = false;
    document.getElementById("send-btn").disabled = false;
    input.focus();
  }
}

async function resetChat() {
  await fetch("/reset", { method: "POST" });
  const container = document.getElementById("chat-container");
  container.innerHTML = `
    <div class="welcome-card" id="welcome-card">
      <div class="welcome-icon">👨‍🍳</div>
      <h2>Bonjour, je suis ChefBot !</h2>
      <p>Posez-moi toutes vos questions sur la cuisine — recettes, techniques, ingrédients, conseils… Je suis là pour vous aider à cuisiner avec passion.</p>
      <div class="suggestion-chips">
        <button class="chip" onclick="sendSuggestion('Donne-moi une recette de tajine poulet')">🥘 Tajine poulet</button>
        <button class="chip" onclick="sendSuggestion('Comment faire une sauce béchamel ?')">🥛 Sauce béchamel</button>
        <button class="chip" onclick="sendSuggestion('Recette de makroud maison')">🍯 Makroud</button>
        <button class="chip" onclick="sendSuggestion('Idées de repas rapides en 20 minutes')">⚡ Repas rapide</button>
        <button class="chip" onclick="sendSuggestion('Comment réussir une pâte feuilletée ?')">🥐 Pâte feuilletée</button>
        <button class="chip" onclick="sendSuggestion('Recette de couscous tunisien')">🍲 Couscous</button>
      </div>
    </div>
  `;
}

document.getElementById("message-input").focus();
