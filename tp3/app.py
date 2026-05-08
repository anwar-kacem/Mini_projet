from flask import Flask, render_template, request, jsonify, session
import requests
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = "cuisine_chatbot_secret_key_2024"

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
API_URL = "https://api.groq.com/openai/v1/chat/completions"

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


def query_groq(messages):
    if not GROQ_API_KEY:
        raise Exception("GROQ_API_KEY manquante dans le fichier .env")

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    response = requests.post(
        API_URL,
        headers=headers,
        json={
            "model": "llama-3.3-70b-versatile",
            "messages": messages,
            "max_tokens": 1024,
            "temperature": 0.7
        },
        timeout=30
    )

    if response.status_code != 200:
        raise Exception(f"API Error {response.status_code}: {response.text}")

    result = response.json()

    if "error" in result:
        raise Exception(f"Groq Error: {result['error'].get('message', 'Unknown error')}")

    if "choices" not in result or len(result["choices"]) == 0:
        raise Exception(f"Réponse inattendue de l'API: {result}")

    return result["choices"][0]["message"]["content"]


@app.route('/')
def index():
    if 'conversation_history' not in session:
        session['conversation_history'] = []
    return render_template('index.html')


@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_message = data.get('message', '').strip()

    if not user_message:
        return jsonify({'error': 'Message vide'}), 400

    if 'conversation_history' not in session:
        session['conversation_history'] = []

    conversation_history = session['conversation_history']

    conversation_history.append({
        "role": "user",
        "content": user_message
    })

    if len(conversation_history) > 10:
        conversation_history = conversation_history[-10:]

    messages = [{"role": "system", "content": SYSTEM_PROMPT}] + conversation_history

    try:
        assistant_message = query_groq(messages)

        conversation_history.append({
            "role": "assistant",
            "content": assistant_message
        })

        session['conversation_history'] = conversation_history
        session.modified = True

        return jsonify({
            'response': assistant_message,
            'history_length': len(conversation_history)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/reset', methods=['POST'])
def reset():
    session['conversation_history'] = []
    session.modified = True
    return jsonify({'message': 'Conversation réinitialisée'})


@app.route('/history', methods=['GET'])
def get_history():
    history = session.get('conversation_history', [])
    return jsonify({'history': history, 'count': len(history)})


if __name__ == '__main__':
    app.run(debug=True, port=5000)
