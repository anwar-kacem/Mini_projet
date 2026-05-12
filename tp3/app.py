# ============================================================
# IMPORTATION DES BIBLIOTHÈQUES
# ============================================================
# Flask       : le framework web qui gère les routes et les réponses HTTP
# render_template : pour afficher les pages HTML (templates)
# request     : pour lire les données envoyées par le navigateur (JSON, formulaires...)
# jsonify     : pour retourner des réponses au format JSON
# session     : pour stocker des données propres à chaque utilisateur (côté serveur)
from flask import Flask, render_template, request, jsonify, session

# requests : bibliothèque pour faire des appels HTTP vers des APIs externes (ici Groq)
import requests

# os : pour accéder aux variables d'environnement du système
import os

# dotenv : pour charger les variables depuis le fichier .env (ex: clé API)
from dotenv import load_dotenv


# ============================================================
# CHARGEMENT DES VARIABLES D'ENVIRONNEMENT
# ============================================================
# Lit le fichier .env et charge ses variables dans l'environnement
# Ça permet de garder les infos sensibles (comme la clé API) hors du code
load_dotenv()


# ============================================================
# INITIALISATION DE L'APPLICATION FLASK
# ============================================================
app = Flask(__name__)

# Clé secrète utilisée pour sécuriser et chiffrer les sessions utilisateurs
# Chaque utilisateur aura ses propres données de session grâce à cette clé
app.secret_key = "cuisine_chatbot_secret_key_2024"


# ============================================================
# CONFIGURATION DE L'API GROQ
# ============================================================
# Récupère la clé API Groq depuis les variables d'environnement (.env)
# Ne jamais écrire la clé directement dans le code !
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# URL de l'endpoint de Groq (compatible avec le format OpenAI)
API_URL = "https://api.groq.com/openai/v1/chat/completions"


# ============================================================
# SYSTEM PROMPT — PERSONNALITÉ ET COMPORTEMENT DU CHATBOT
# ============================================================
# C'est l'instruction principale donnée au modèle IA avant chaque conversation.
# Elle définit :
#   - Le rôle du bot : ChefBot, assistant culinaire
#   - Les limites : répondre UNIQUEMENT aux questions de cuisine
#   - Le format des réponses selon 3 cas :
#       CAS 1 : ingrédients suffisants → donner la recette directement
#       CAS 2 : ingrédients insuffisants → suggérer les manques + recette possible
#       Autres questions : répondre avec la recette demandée
SYSTEM_PROMPT = """Tu es ChefBot, un assistant culinaire expert et passionné.
Tu réponds UNIQUEMENT aux questions liées à la cuisine, recettes, ingrédients, techniques culinaires.
Si la question n'est pas liée à la cuisine, réponds poliment que tu ne peux aider que pour la cuisine.

---

QUAND L'UTILISATEUR PROPOSE UNE LISTE D'INGRÉDIENTS :

Analyse si on peut faire UNE recette correcte et complète avec ces ingrédients.

CAS 1 — On PEUT faire une recette avec ces ingrédients :
Réponds exactement avec ce format :

✅ **Oui, on peut faire : [Nom du plat] !**

🍽️ **[Nom du plat]**
⏱️ **Temps :** X minutes
📋 **Ingrédients utilisés :**
- ingrédient 1
- ingrédient 2

👨‍🍳 **Étapes de préparation :**
1. Étape 1
2. Étape 2

💡 **Conseil du chef :** conseil utile

---

CAS 2 — Les ingrédients NE SUFFISENT PAS pour une bonne recette :
Réponds exactement avec ce format :

❌ **Avec seulement ces ingrédients, difficile de faire un plat complet.**

Mais si tu ajoutes :
- 🛒 ingrédient manquant 1
- 🛒 ingrédient manquant 2

On peut préparer :

🍽️ **[Nom du plat suggéré]**
⏱️ **Temps :** X minutes
📋 **Ingrédients :**
- ingrédient 1
- ingrédient 2

👨‍🍳 **Étapes de préparation :**
1. Étape 1
2. Étape 2

💡 **Conseil du chef :** conseil utile

---

POUR TOUTE AUTRE QUESTION CULINAIRE (recette directe, technique, conseil) :

🍽️ **Nom du plat**
⏱️ **Temps :** X minutes
📋 **Ingrédients :**
- ingrédient 1
- ingrédient 2

👨‍🍳 **Étapes :**
1. Étape 1
2. Étape 2

💡 **Conseil du chef :** conseil utile
"""


# ============================================================
# FONCTION : APPEL À L'API GROQ
# ============================================================
def query_groq(messages):
    """
    Envoie une liste de messages au modèle LLaMA via l'API Groq
    et retourne la réponse textuelle du modèle.

    Paramètre:
        messages (list) : historique de la conversation sous forme de liste
                          de dicts {"role": "user"/"assistant"/"system", "content": "..."}

    Retourne:
        str : le texte de la réponse générée par le modèle
    """

    # Vérifie que la clé API est bien chargée depuis le .env
    # Si elle est absente, on lève une erreur claire
    if not GROQ_API_KEY:
        raise Exception("GROQ_API_KEY manquante dans le fichier .env")

    # En-têtes HTTP de la requête :
    # - Authorization : authentification avec la clé API (format Bearer token)
    # - Content-Type  : indique qu'on envoie du JSON
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    # Envoi de la requête POST à l'API Groq avec les paramètres du modèle
    response = requests.post(
        API_URL,
        headers=headers,
        json={
            "model": "llama-3.3-70b-versatile",  # Modèle LLaMA 3.3 (70 milliards de paramètres)
            "messages": messages,                  # Tout l'historique de la conversation
            "max_tokens": 1024,                   # Limite la longueur de la réponse générée
            "temperature": 0.7                    # Contrôle la créativité : 0=très précis, 1=très créatif
        },
        timeout=30  # Si l'API ne répond pas en 30 secondes, on abandonne la requête
    )

    # Vérifie que la requête a réussi (code HTTP 200 = OK)
    # Si non, on lève une exception avec le détail de l'erreur
    if response.status_code != 200:
        raise Exception(f"API Error {response.status_code}: {response.text}")

    # Convertit la réponse JSON brute en dictionnaire Python
    result = response.json()

    # Vérifie si l'API a retourné un message d'erreur dans le corps JSON
    if "error" in result:
        raise Exception(f"Groq Error: {result['error'].get('message', 'Unknown error')}")

    # Vérifie que la réponse contient bien des choix (réponses du modèle)
    if "choices" not in result or len(result["choices"]) == 0:
        raise Exception(f"Réponse inattendue de l'API: {result}")

    # Retourne uniquement le texte du premier choix (la réponse du bot)
    return result["choices"][0]["message"]["content"]


# ============================================================
# ROUTE : PAGE D'ACCUEIL
# ============================================================
@app.route('/')
def index():
    """
    Affiche la page principale de l'application (interface du chat).
    Initialise aussi l'historique de conversation si c'est la première visite.
    """
    # Si l'utilisateur n'a pas encore d'historique dans sa session, on en crée un vide
    if 'conversation_history' not in session:
        session['conversation_history'] = []

    # Retourne la page HTML index.html depuis le dossier templates/
    return render_template('index.html')


# ============================================================
# ROUTE : ENVOI D'UN MESSAGE AU CHATBOT
# ============================================================
@app.route('/chat', methods=['POST'])
def chat():
    """
    Reçoit le message de l'utilisateur, l'envoie à Groq avec l'historique,
    et retourne la réponse du bot au format JSON.
    """

    # Récupère les données JSON envoyées par le navigateur
    data = request.json
    # Extrait le message de l'utilisateur et supprime les espaces au début/fin
    user_message = data.get('message', '').strip()

    # Si le message est vide, on retourne une erreur 400 (Bad Request)
    if not user_message:
        return jsonify({'error': 'Message vide'}), 400

    # S'assure que la session contient un historique (au cas où il aurait été perdu)
    if 'conversation_history' not in session:
        session['conversation_history'] = []

    # Récupère l'historique de conversation de la session actuelle
    conversation_history = session['conversation_history']

    # Ajoute le nouveau message de l'utilisateur à l'historique
    conversation_history.append({
        "role": "user",
        "content": user_message
    })

    # Limite l'historique aux 10 derniers messages pour éviter de dépasser
    # la limite de tokens du modèle (et garder les réponses pertinentes)
    if len(conversation_history) > 10:
        conversation_history = conversation_history[-10:]

    # Construit la liste complète des messages à envoyer à l'API :
    # le system prompt en premier, puis tout l'historique de la conversation
    messages = [{"role": "system", "content": SYSTEM_PROMPT}] + conversation_history

    try:
        # Appelle l'API Groq et récupère la réponse du bot
        assistant_message = query_groq(messages)

        # Ajoute la réponse du bot à l'historique pour les prochains tours
        conversation_history.append({
            "role": "assistant",
            "content": assistant_message
        })

        # Sauvegarde l'historique mis à jour dans la session
        session['conversation_history'] = conversation_history
        # Indique à Flask que la session a été modifiée (nécessaire pour la persistence)
        session.modified = True

        # Retourne la réponse du bot et la taille actuelle de l'historique
        return jsonify({
            'response': assistant_message,
            'history_length': len(conversation_history)
        })

    except Exception as e:
        # En cas d'erreur (API indisponible, clé invalide...), on retourne une erreur 500
        return jsonify({'error': str(e)}), 500


# ============================================================
# ROUTE : RÉINITIALISATION DE LA CONVERSATION
# ============================================================
@app.route('/reset', methods=['POST'])
def reset():
    """
    Efface tout l'historique de la conversation de l'utilisateur.
    Utile pour recommencer une nouvelle discussion depuis zéro.
    """
    session['conversation_history'] = []  # Vide l'historique
    session.modified = True               # Marque la session comme modifiée
    return jsonify({'message': 'Conversation réinitialisée'})


# ============================================================
# ROUTE : RÉCUPÉRATION DE L'HISTORIQUE
# ============================================================
@app.route('/history', methods=['GET'])
def get_history():
    """
    Retourne l'historique complet de la conversation en cours.
    Pratique pour le débogage ou pour afficher les messages précédents.
    """
    # Récupère l'historique depuis la session (liste vide par défaut si absent)
    history = session.get('conversation_history', [])
    # Retourne l'historique et le nombre de messages
    return jsonify({'history': history, 'count': len(history)})


# ============================================================
# LANCEMENT DU SERVEUR
# ============================================================
if __name__ == '__main__':
    # Lance l'application Flask en mode développement sur le port 5000
    # debug=True : recharge automatiquement le serveur à chaque modification du code
    #              et affiche les erreurs détaillées dans le navigateur
    app.run(debug=True, port=5000)