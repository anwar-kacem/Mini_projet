# 🍽️ ChefBot — Assistant Culinaire avec Ollama

Chatbot de recettes de cuisine variées, 100% local avec **Flask + Ollama**.

## 📁 Arborescence

```
TP3/
├── static/
│   ├── style.css        # Styles (thème chaud terracotta)
│   └── script.js        # Logique chat (streaming, markdown, UI)
├── templates/
│   └── index.html       # Interface principale
├── app.py               # Serveur Flask + API Ollama
├── requirements.txt     # Dépendances Python
└── README.md
```

## 🚀 Installation & Lancement

### 1. Installer Ollama

```bash
# Linux / macOS
curl -fsSL https://ollama.ai/install.sh | sh

# Windows : télécharger sur https://ollama.ai
```

### 2. Télécharger un modèle

```bash
ollama pull llama3.2          # Recommandé (3B - rapide)
# ou
ollama pull mistral           # Alternative (7B - plus précis)
# ou
ollama pull phi3              # Léger (3.8B)
```

### 3. Lancer Ollama

```bash
ollama serve
```

### 4. Installer les dépendances Python

```bash
pip install -r requirements.txt
```

### 5. Lancer ChefBot

```bash
python app.py
```

### 6. Ouvrir dans le navigateur

```
http://localhost:5000
```

## ✨ Fonctionnalités

- 🤖 **Streaming** — Réponses en temps réel mot par mot
- 📚 **Historique** — Contexte des 10 derniers échanges
- 🌍 **Cuisine variée** — Française, italienne, marocaine, asiatique...
- 📱 **Responsive** — Interface mobile et desktop
- 🎨 **Markdown** — Recettes formatées avec titres et listes
- ⚡ **Suggestions rapides** — Idées de recettes en un clic
- 🔄 **Multi-modèle** — Sélecteur de modèle Ollama

## ⚙️ Changer le modèle par défaut

Dans `app.py`, modifier la ligne :

```python
DEFAULT_MODEL = "llama3.2"  # → votre modèle préféré
```

## 🛠️ Stack technique

| Composant | Technologie              |
| --------- | ------------------------ |
| Backend   | Python · Flask           |
| IA        | Ollama (local)           |
| Frontend  | HTML · CSS · JS vanilla  |
| Streaming | Server-Sent Events (SSE) |
