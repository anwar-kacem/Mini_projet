# 🍽️ ChefBot — Assistant Culinaire IA

Chatbot de cuisine intelligent, propulsé par **Flask + Groq API (LLaMA 3.3 70B)**.

---

## 📁 Arborescence du projet

```
TP3/
├── static/
│   ├── style.css        # Styles (thème chaud terracotta)
│   └── script.js        # Logique du chat (envoi, formatage, UI)
├── templates/
│   └── index.html       # Interface principale du chatbot
├── app.py               # Serveur Flask + intégration API Groq
├── requirements.txt     # Dépendances Python
├── .env                 # Clé API Groq (ne pas partager !)
└── README.md
```

---

## ✨ Fonctionnalités

- 🤖 **IA puissante** — Modèle LLaMA 3.3 70B via Groq (rapide et gratuit)
- 📚 **Historique** — Contexte des 10 derniers échanges conservé en session
- 🧑‍🍳 **Assistant spécialisé** — Répond uniquement aux questions culinaires
- 🥗 **Analyse d'ingrédients** — Propose une recette selon ce que vous avez
- 🌍 **Cuisine variée** — Tunisienne, française, italienne, asiatique…
- 📱 **Responsive** — Interface adaptée mobile et desktop
- 🎨 **Markdown rendu** — Recettes formatées avec titres, listes et emojis
- ⚡ **Suggestions rapides** — Boutons de recettes populaires en un clic
- 🔄 **Reset conversation** — Recommencer une nouvelle discussion à tout moment

---

## 🚀 Installation & Lancement

### 1. Cloner ou télécharger le projet

```bash
# Placer tous les fichiers dans un dossier TP3/
```

### 2. Installer les dépendances Python

```bash
pip install -r requirements.txt
```

### 3. Configurer la clé API Groq

Créer un fichier `.env` à la racine du projet :

```
GROQ_API_KEY=votre_clé_api_groq
```

> 💡 Obtenez une clé gratuite sur [https://console.groq.com](https://console.groq.com)

### 4. Lancer ChefBot

```bash
python app.py
```

### 5. Ouvrir dans le navigateur

```
http://localhost:5000
```

---

## ⚙️ Configuration

### Changer le modèle IA

Dans `app.py`, modifier la ligne suivante :

```python
"model": "llama-3.3-70b-versatile"  # → autre modèle Groq disponible
```

**Modèles Groq disponibles :**

| Modèle                    | Taille | Vitesse | Précision           |
| ------------------------- | ------ | ------- | ------------------- |
| `llama-3.3-70b-versatile` | 70B    | ⚡⚡    | ⭐⭐⭐ (recommandé) |
| `llama-3.1-8b-instant`    | 8B     | ⚡⚡⚡  | ⭐⭐                |
| `mixtral-8x7b-32768`      | 8x7B   | ⚡⚡    | ⭐⭐⭐              |

### Changer la taille de l'historique

Par défaut, les **10 derniers messages** sont conservés. Pour modifier :

```python
if len(conversation_history) > 10:   # ← changer cette valeur
    conversation_history = conversation_history[-10:]
```

---

## 🛠️ Stack technique

| Composant   | Technologie                     |
| ----------- | ------------------------------- |
| Backend     | Python · Flask 3.0              |
| IA          | Groq API · LLaMA 3.3 70B        |
| Frontend    | HTML · CSS · JavaScript vanilla |
| Sessions    | Flask session (côté serveur)    |
| HTTP Client | `requests`                      |
| Config      | `python-dotenv`                 |

---

## 📡 Endpoints API Flask

| Route      | Méthode | Description                                   |
| ---------- | ------- | --------------------------------------------- |
| `/`        | GET     | Page principale (interface chat)              |
| `/chat`    | POST    | Envoie un message et reçoit la réponse du bot |
| `/reset`   | POST    | Réinitialise l'historique de conversation     |
| `/history` | GET     | Retourne l'historique complet de la session   |

---

## ⚠️ Sécurité

- Ne **jamais** committer le fichier `.env` sur Git
- Ajouter `.env` dans le `.gitignore` :

```
.env
__pycache__/
*.pyc
```

---

## 🐛 Problèmes fréquents

| Problème                 | Solution                                                                   |
| ------------------------ | -------------------------------------------------------------------------- |
| `GROQ_API_KEY manquante` | Vérifier que le fichier `.env` existe et contient la clé                   |
| `API Error 401`          | Clé API invalide ou expirée → en générer une nouvelle sur console.groq.com |
| `API Error 429`          | Limite de requêtes dépassée → attendre quelques secondes                   |
| Page blanche             | Vérifier que Flask tourne bien sur le port 5000                            |
