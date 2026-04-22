from flask import Flask, render_template, request, jsonify, Response, stream_with_context
import requests
import json
import re

app = Flask(__name__)

OLLAMA_URL = "http://localhost:11434"
DEFAULT_MODEL = "llama3.2"  # Change to your preferred model (llama3.2, mistral, etc.)

SYSTEM_PROMPT = """Tu es ChefBot, un assistant culinaire passionné et expert en cuisine du monde entier.
Tu connais des milliers de recettes variées : française, italienne, marocaine, asiatique, mexicaine, végétarienne, vegan, et bien plus encore.

Tes spécialités :
- Proposer des recettes détaillées avec ingrédients et étapes claires
- Adapter les recettes selon les allergies ou restrictions alimentaires
- Suggérer des substitutions d'ingrédients
- Expliquer des techniques culinaires
- Donner des conseils de chef pour améliorer les plats
- Proposer des recettes selon les ingrédients disponibles
- Calculer les portions selon le nombre de personnes

Style de réponse :
- Utilise des emojis pour rendre les réponses vivantes 🍽️
- Structure tes recettes avec des sections claires (Ingrédients, Préparation, Conseils)
- Sois chaleureux, enthousiaste et encourageant
- Réponds TOUJOURS en français sauf si l'utilisateur parle une autre langue

Si la question n'est pas liée à la cuisine, redirige poliment vers ton domaine d'expertise."""


def get_available_models():
    """Fetch available models from Ollama"""
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        if response.status_code == 200:
            models = response.json().get("models", [])
            return [m["name"] for m in models]
    except Exception:
        pass
    return [DEFAULT_MODEL]


def check_ollama_status():
    """Check if Ollama is running"""
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=3)
        return response.status_code == 200
    except Exception:
        return False


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/status")
def status():
    is_running = check_ollama_status()
    models = get_available_models() if is_running else []
    return jsonify({
        "ollama_running": is_running,
        "models": models,
        "default_model": DEFAULT_MODEL
    })


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json
    user_message = data.get("message", "").strip()
    conversation_history = data.get("history", [])
    model = data.get("model", DEFAULT_MODEL)

    if not user_message:
        return jsonify({"error": "Message vide"}), 400

    if not check_ollama_status():
        return jsonify({
            "error": "Ollama n'est pas lancé. Veuillez démarrer Ollama avec: ollama serve"
        }), 503

    # Build messages array
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    
    # Add conversation history (last 10 exchanges to avoid token overflow)
    for msg in conversation_history[-10:]:
        messages.append(msg)
    
    messages.append({"role": "user", "content": user_message})

    def generate():
        try:
            payload = {
                "model": model,
                "messages": messages,
                "stream": True,
                "options": {
                    "temperature": 0.8,
                    "top_p": 0.9,
                }
            }

            with requests.post(
                f"{OLLAMA_URL}/api/chat",
                json=payload,
                stream=True,
                timeout=120
            ) as resp:
                if resp.status_code != 200:
                    yield f"data: {json.dumps({'error': 'Erreur Ollama: ' + str(resp.status_code)})}\n\n"
                    return

                for line in resp.iter_lines():
                    if line:
                        try:
                            chunk = json.loads(line.decode("utf-8"))
                            if "message" in chunk and "content" in chunk["message"]:
                                content = chunk["message"]["content"]
                                yield f"data: {json.dumps({'content': content, 'done': chunk.get('done', False)})}\n\n"
                            if chunk.get("done"):
                                break
                        except json.JSONDecodeError:
                            continue

        except requests.exceptions.ConnectionError:
            yield f"data: {json.dumps({'error': 'Impossible de se connecter à Ollama'})}\n\n"
        except requests.exceptions.Timeout:
            yield f"data: {json.dumps({'error': 'Timeout - Le modèle met trop de temps à répondre'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )


@app.route("/api/suggestions")
def suggestions():
    """Return recipe suggestions for quick access"""
    suggestions_list = [
        {"emoji": "🍝", "text": "Recette de pasta carbonara"},
        {"emoji": "🥘", "text": "Tajine de poulet aux olives"},
        {"emoji": "🍣", "text": "Rouleaux de printemps"},
        {"emoji": "🥗", "text": "Salade niçoise"},
        {"emoji": "🍕", "text": "Pizza margherita maison"},
        {"emoji": "🍲", "text": "Ramen japonais traditionnel"},
        {"emoji": "🧆", "text": "Falafels croustillants"},
        {"emoji": "🥧", "text": "Tarte tatin aux pommes"},
        {"emoji": "🌮", "text": "Tacos mexicains au bœuf"},
        {"emoji": "🍛", "text": "Curry de légumes vegan"},
    ]
    return jsonify(suggestions_list)


if __name__ == "__main__":
    print("🍽️  ChefBot démarré!")
    print(f"🤖 Modèle par défaut: {DEFAULT_MODEL}")
    print(f"🔗 Ollama URL: {OLLAMA_URL}")
    print("🌐 Ouvrez http://localhost:5000")
    app.run(debug=True, host="0.0.0.0", port=5000)