// ============================================================
// ÉTAT GLOBAL DE L'APPLICATION
// ============================================================
// Variable qui indique si une requête est en cours d'envoi.
// Empêche l'utilisateur d'envoyer plusieurs messages en même temps.
let isLoading = false;

// ============================================================
// FONCTION : REDIMENSIONNEMENT AUTOMATIQUE DU CHAMP DE SAISIE
// ============================================================
// S'adapte à la hauteur du texte tapé par l'utilisateur.
// La hauteur max est limitée à 120px pour ne pas envahir l'écran.
function autoResize(el) {
  el.style.height = "auto"; // Remet la hauteur à zéro d'abord
  el.style.height = Math.min(el.scrollHeight, 120) + "px"; // Ajuste selon le contenu (max 120px)
}

// ============================================================
// FONCTION : GESTION DE LA TOUCHE ENTRÉE
// ============================================================
// Permet d'envoyer le message en appuyant sur Entrée.
// Si l'utilisateur appuie sur Shift+Entrée, il fait un retour à la ligne (comportement normal).
function handleKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault(); // Empêche le saut de ligne par défaut
    sendMessage(); // Lance l'envoi du message
  }
}

// ============================================================
// FONCTION : ENVOI D'UNE SUGGESTION RAPIDE
// ============================================================
// Appelée quand l'utilisateur clique sur un des boutons de suggestion (chips).
// Remplit automatiquement le champ de saisie avec le texte suggéré et envoie le message.
function sendSuggestion(text) {
  document.getElementById("message-input").value = text;
  sendMessage();
}

// ============================================================
// FONCTION : FORMATAGE DU TEXTE MARKDOWN → HTML
// ============================================================
// Convertit les balises Markdown simples en HTML pour un meilleur rendu visuel.
// Utilisée uniquement pour les messages du bot (pas pour l'utilisateur).
function formatMessage(text) {
  // **texte** → <strong>texte</strong> (texte en gras)
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // *texte* → <em>texte</em> (texte en italique)
  text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Retours à la ligne (\n) → balise <br> pour l'affichage HTML
  text = text.replace(/\n/g, "<br>");

  return text;
}

// ============================================================
// FONCTION : ÉCHAPPEMENT DES CARACTÈRES HTML DANGEREUX
// ============================================================
// Sécurise le texte de l'utilisateur avant de l'injecter dans le DOM.
// Empêche les attaques XSS (injection de code HTML/JS malveillant).
// Ex : si l'utilisateur tape "<script>", ça devient "&lt;script&gt;"
function escapeHtml(text) {
  const d = document.createElement("div"); // Crée un élément temporaire
  d.textContent = text; // Insère le texte brut (automatiquement sécurisé)
  return d.innerHTML; // Retourne la version HTML échappée
}

// ============================================================
// FONCTION : AFFICHAGE D'UN MESSAGE DANS LE CHAT
// ============================================================
// Crée et ajoute un nouveau message (bulle) dans la zone de conversation.
// Paramètres :
//   role    : "user" (utilisateur) ou "bot" (assistant)
//   content : le texte du message
//   isError : true si c'est un message d'erreur (style différent)
function appendMessage(role, content, isError = false) {
  const container = document.getElementById("chat-container");

  // Cache la carte de bienvenue dès qu'un premier message apparaît
  const welcome = document.getElementById("welcome-card");
  if (welcome) welcome.style.display = "none";

  // Crée le conteneur du message avec la classe CSS correspondante (user ou bot)
  const div = document.createElement("div");
  div.className = `message ${role}`;

  // Choisit l'avatar selon l'expéditeur
  const avatar = role === "bot" ? "🍳" : "👤";

  if (isError) {
    // Message d'erreur : utilise la classe CSS "error-bubble" (fond rouge/orange)
    div.innerHTML = `
      <div class="avatar">${avatar}</div>
      <div class="error-bubble">${content}</div>
    `;
  } else {
    // Message normal : bulle standard
    // - Si c'est le bot  → applique le formatage Markdown (gras, italique, sauts de ligne)
    // - Si c'est l'user  → échappe le HTML pour éviter les injections XSS
    div.innerHTML = `
      <div class="avatar">${avatar}</div>
      <div class="bubble">${
        role === "bot" ? formatMessage(content) : escapeHtml(content)
      }</div>
    `;
  }

  // Ajoute le message dans le conteneur de chat
  container.appendChild(div);

  // Fait défiler automatiquement vers le bas pour voir le nouveau message
  container.scrollTop = container.scrollHeight;

  return div;
}

// ============================================================
// FONCTION : AFFICHAGE DE L'INDICATEUR DE FRAPPE (TYPING)
// ============================================================
// Affiche une animation "..." pendant que le bot génère sa réponse.
// Donne l'impression que le bot est en train d'écrire.
function showTyping() {
  const container = document.getElementById("chat-container");
  const div = document.createElement("div");
  div.className = "typing-indicator";
  div.id = "typing"; // ID unique pour pouvoir le supprimer facilement après

  // Affiche l'avatar du bot + les trois points animés
  div.innerHTML = `
    <div class="avatar" style="background:linear-gradient(135deg,#c0603a,#9e4b2a);box-shadow:0 2px 8px rgba(192,96,58,.25);border-radius:10px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;margin-top:2px;">🍳</div>
    <div class="typing-dots">
      <span></span><span></span><span></span>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight; // Scroll vers le bas pour voir l'animation
}

// ============================================================
// FONCTION : SUPPRESSION DE L'INDICATEUR DE FRAPPE
// ============================================================
// Retire l'animation "..." une fois que la réponse du bot est arrivée.
function hideTyping() {
  const t = document.getElementById("typing");
  if (t) t.remove(); // Supprime l'élément s'il existe
}

// ============================================================
// FONCTION PRINCIPALE : ENVOI D'UN MESSAGE AU SERVEUR
// ============================================================
// Gère tout le flux d'envoi :
//   1. Lit le message saisi par l'utilisateur
//   2. L'affiche dans le chat
//   3. L'envoie au serveur Flask via une requête HTTP POST
//   4. Attend la réponse et l'affiche
async function sendMessage() {
  // Bloque l'envoi si une requête est déjà en cours
  if (isLoading) return;

  const input = document.getElementById("message-input");
  const message = input.value.trim(); // Récupère et nettoie le texte saisi

  // Ne rien faire si le champ est vide
  if (!message) return;

  // Vide le champ de saisie et remet sa hauteur à la normale
  input.value = "";
  input.style.height = "auto";

  // Affiche immédiatement le message de l'utilisateur dans le chat
  appendMessage("user", message);

  // Active l'état de chargement : désactive le bouton d'envoi et montre l'animation
  isLoading = true;
  document.getElementById("send-btn").disabled = true;
  showTyping();

  try {
    // Envoie le message au serveur Flask via l'endpoint /chat (POST)
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }), // Convertit en JSON : { "message": "..." }
    });

    // Parse la réponse JSON reçue du serveur
    const data = await response.json();

    // Cache l'animation de frappe maintenant que la réponse est reçue
    hideTyping();

    if (data.error) {
      // Si le serveur a retourné une erreur, l'affiche en bulle d'erreur
      appendMessage("bot", `⚠️ ${data.error}`, true);
    } else {
      // Sinon, affiche la réponse du bot normalement
      appendMessage("bot", data.response);
    }
  } catch (err) {
    // En cas d'erreur réseau (serveur Flask éteint, problème de connexion...)
    hideTyping();
    appendMessage(
      "bot",
      "⚠️ Connexion impossible. Vérifiez que le serveur Flask est bien lancé.",
      true
    );
  } finally {
    // Dans tous les cas (succès ou erreur) : réinitialise l'état de chargement
    isLoading = false;
    document.getElementById("send-btn").disabled = false;
    input.focus(); // Remet le curseur dans le champ de saisie
  }
}

// ============================================================
// FONCTION : RÉINITIALISATION DU CHAT
// ============================================================
// Efface toute la conversation côté serveur ET côté interface.
// Remet la carte de bienvenue avec les suggestions rapides.
async function resetChat() {
  // Appelle l'endpoint /reset du serveur Flask pour vider l'historique de session
  await fetch("/reset", { method: "POST" });

  // Réinitialise le contenu HTML de la zone de chat
  const container = document.getElementById("chat-container");
  container.innerHTML = `
    <div class="welcome-card" id="welcome-card">
      <div class="welcome-icon">👨‍🍳</div>
      <h2>Bonjour, je suis ChefBot !</h2>
      <p>Posez-moi toutes vos questions sur la cuisine — recettes, techniques, ingrédients, conseils… Je suis là pour vous aider à cuisiner avec passion.</p>
      
      <!-- Boutons de suggestions rapides : l'utilisateur clique dessus pour envoyer une question prédéfinie -->
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

// ============================================================
// INITIALISATION AU CHARGEMENT DE LA PAGE
// ============================================================
// Met automatiquement le curseur dans le champ de saisie dès que la page est prête.
// L'utilisateur peut commencer à taper directement sans cliquer.
document.getElementById("message-input").focus();
