from flask import Flask, render_template, request, jsonify, Response, stream_with_context
import requests
import json

app = Flask(__name__)

OLLAMA_URL = "http://localhost:11434"
DEFAULT_MODEL = "llama3.2"

SYSTEM_PROMPT = """Tu es ChefBot, un assistant culinaire expert et passionné.

Tu gères TROIS situations différentes :

== CAS 1 : L'utilisateur demande une recette directement ==
Exemple : "recette de pizza", "comment faire un tajine", "je veux faire des pates"
→ Donne directement la recette complète avec ingrédients et étapes. C'est simple.

== CAS 2 : L'utilisateur donne ses ingrédients et ils SUFFISENT ==
Exemple : "j'ai des oeufs, du fromage et des pates"
→ Réponds : "✅ Oui tu peux faire [recette] avec tes ingrédients !"
→ Donne directement la recette complète.

== CAS 3 : L'utilisateur donne ses ingrédients mais ils sont INSUFFISANTS ==
Exemple : "j'ai seulement du pain"
→ Réponds : "❌ Tes ingrédients sont insuffisants seuls."
→ Propose une recette en ajoutant 2 ou 3 ingrédients simples maximum.
→ Format : "Mais avec [ingredient1] et [ingredient2] tu peux faire [recette] !"
→ Donne la recette complète.

FORMAT RECETTE (toujours pareil) :
## 🍽️ [Nom de la recette]
## 🛒 Ingrédients :
[liste avec quantités]
## 👨‍🍳 Préparation :
[étapes numérotées]
## 💡 Conseil du Chef :
[un conseil utile]

RÈGLES :
- Réponds TOUJOURS en français
- Utilise des emojis
- Sois positif et encourageant
- TOUJOURS donner une recette complète dans le même message
- Ne jamais refuser de proposer une recette"""


RECIPES_BY_COUNTRY = {
    "France": [
        {"emoji": "🥐", "name": "Croissants maison", "query": "Recette des croissants maison francais"},
        {"emoji": "🧅", "name": "Soupe a l'oignon", "query": "Recette soupe a l'oignon gratinee francaise"},
        {"emoji": "🐓", "name": "Coq au vin", "query": "Recette coq au vin traditionnel francais"},
        {"emoji": "🥗", "name": "Salade nicoise", "query": "Recette salade nicoise authentique"},
        {"emoji": "🍮", "name": "Creme brulee", "query": "Recette creme brulee francaise"},
    ],
    "Italie": [
        {"emoji": "🍝", "name": "Pasta Carbonara", "query": "Recette pasta carbonara italienne authentique"},
        {"emoji": "🍕", "name": "Pizza Margherita", "query": "Recette pizza margherita maison"},
        {"emoji": "🫙", "name": "Risotto champignons", "query": "Recette risotto aux champignons italien"},
        {"emoji": "🍨", "name": "Tiramisu", "query": "Recette tiramisu italien authentique"},
        {"emoji": "🥩", "name": "Osso Buco", "query": "Recette osso buco milanaise"},
    ],
    "Maroc": [
        {"emoji": "🥘", "name": "Tajine poulet-olives", "query": "Recette tajine poulet citron olives marocain"},
        {"emoji": "🫕", "name": "Couscous royal", "query": "Recette couscous royal marocain traditionnel"},
        {"emoji": "🧆", "name": "Kefta grillee", "query": "Recette kefta marocaine grillee"},
        {"emoji": "🥧", "name": "Pastilla poulet", "query": "Recette pastilla marocaine au poulet"},
        {"emoji": "🍵", "name": "The a la menthe", "query": "Recette the a la menthe marocain"},
    ],
    "Tunisie": [
        {"emoji": "🌶️", "name": "Harissa maison", "query": "Recette harissa tunisienne maison"},
        {"emoji": "🥚", "name": "Chakchouka", "query": "Recette chakchouka tunisienne"},
        {"emoji": "🐟", "name": "Poisson chermoula", "query": "Recette poisson chermoula tunisien"},
        {"emoji": "🥙", "name": "Fricasse tunisien", "query": "Recette fricasse tunisien sandwich"},
        {"emoji": "🍲", "name": "Lablabi", "query": "Recette lablabi soupe pois chiches tunisienne"},
    ],
    "Japon": [
        {"emoji": "🍣", "name": "Sushi maison", "query": "Recette sushi maki maison japonais"},
        {"emoji": "🍜", "name": "Ramen traditionnel", "query": "Recette ramen japonais traditionnel"},
        {"emoji": "🍱", "name": "Bento equilibre", "query": "Recette bento japonais equilibre"},
        {"emoji": "🥟", "name": "Gyoza", "query": "Recette gyoza japonais poeles"},
        {"emoji": "🍡", "name": "Mochi", "query": "Recette mochi japonais maison"},
    ],
    "Inde": [
        {"emoji": "🍛", "name": "Curry de poulet", "query": "Recette curry poulet indien traditionnel"},
        {"emoji": "🫓", "name": "Naan au beurre", "query": "Recette naan beurre indien maison"},
        {"emoji": "🌿", "name": "Dal de lentilles", "query": "Recette dal lentilles indien vegetarien"},
        {"emoji": "🧆", "name": "Samosas", "query": "Recette samosas indiens maison"},
        {"emoji": "🍚", "name": "Biryani", "query": "Recette biryani indien au poulet"},
    ],
    "Mexique": [
        {"emoji": "🌮", "name": "Tacos al pastor", "query": "Recette tacos al pastor mexicains"},
        {"emoji": "🥑", "name": "Guacamole", "query": "Recette guacamole mexicain authentique"},
        {"emoji": "🫘", "name": "Enchiladas", "query": "Recette enchiladas mexicaines au poulet"},
        {"emoji": "🍲", "name": "Chili con carne", "query": "Recette chili con carne mexicain"},
        {"emoji": "🍮", "name": "Churros", "query": "Recette churros mexicains maison"},
    ],
    "Liban": [
        {"emoji": "🥙", "name": "Shawarma", "query": "Recette shawarma libanais maison"},
        {"emoji": "🧆", "name": "Falafels", "query": "Recette falafels libanais croustillants"},
        {"emoji": "🫙", "name": "Houmous", "query": "Recette houmous libanais maison"},
        {"emoji": "🥗", "name": "Taboule", "query": "Recette taboule libanais traditionnel"},
        {"emoji": "🍆", "name": "Moussaka", "query": "Recette moussaka libanaise aux aubergines"},
    ],
}

SUGGESTIONS = [
    {"emoji": "🍝", "text": "Recette de pasta carbonara"},
    {"emoji": "🥘", "text": "Tajine de poulet aux olives"},
    {"emoji": "🍣", "text": "Rouleaux de printemps"},
    {"emoji": "🥗", "text": "Salade nicoise"},
    {"emoji": "🍕", "text": "Pizza margherita maison"},
    {"emoji": "🍲", "text": "Ramen japonais traditionnel"},
    {"emoji": "🧆", "text": "Falafels croustillants"},
    {"emoji": "🌮", "text": "Tacos mexicains au boeuf"},
    {"emoji": "🍛", "text": "Curry de legumes vegan"},
    {"emoji": "🌶️", "text": "Harissa tunisienne maison"},
    {"emoji": "🥚", "text": "J'ai des oeufs, du fromage et des pates - que faire ?"},
    {"emoji": "🧅", "text": "J'ai des tomates, des oignons et du poulet"},
]


def get_available_models():
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        if response.status_code == 200:
            models = response.json().get("models", [])
            return [m["name"] for m in models]
    except Exception:
        pass
    return [DEFAULT_MODEL]


def check_ollama_status():
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
    return jsonify({"ollama_running": is_running, "models": models, "default_model": DEFAULT_MODEL})


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json
    user_message = data.get("message", "").strip()
    conversation_history = data.get("history", [])
    model = data.get("model", DEFAULT_MODEL)

    if not user_message:
        return jsonify({"error": "Message vide"}), 400
    if not check_ollama_status():
        return jsonify({"error": "Ollama n'est pas lance. Demarrez Ollama avec: ollama serve"}), 503

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in conversation_history[-10:]:
        messages.append(msg)
    messages.append({"role": "user", "content": user_message})

    def generate():
        try:
            payload = {"model": model, "messages": messages, "stream": True,
                       "options": {"temperature": 0.8, "top_p": 0.9}}
            with requests.post(f"{OLLAMA_URL}/api/chat", json=payload, stream=True, timeout=120) as resp:
                if resp.status_code != 200:
                    yield f"data: {json.dumps({'error': 'Erreur Ollama: ' + str(resp.status_code)})}\n\n"
                    return
                for line in resp.iter_lines():
                    if line:
                        try:
                            chunk = json.loads(line.decode("utf-8"))
                            if "message" in chunk and "content" in chunk["message"]:
                                yield f"data: {json.dumps({'content': chunk['message']['content'], 'done': chunk.get('done', False)})}\n\n"
                            if chunk.get("done"):
                                break
                        except json.JSONDecodeError:
                            continue
        except requests.exceptions.ConnectionError:
            yield f"data: {json.dumps({'error': 'Impossible de se connecter a Ollama'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(stream_with_context(generate()), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.route("/api/suggestions")
def suggestions():
    return jsonify(SUGGESTIONS)


@app.route("/api/recipes-by-country")
def recipes_by_country():
    return jsonify(RECIPES_BY_COUNTRY)


@app.route("/api/search")
def search_recipes():
    query = request.args.get("q", "").lower().strip()
    if not query:
        return jsonify([])
    results = []
    for country, recipes in RECIPES_BY_COUNTRY.items():
        for r in recipes:
            if query in r["name"].lower() or query in country.lower():
                results.append({"country": country, "emoji": r["emoji"], "name": r["name"], "query": r["query"]})
    return jsonify(results[:10])


if __name__ == "__main__":
    print("ChefBot demarre!")
    print(f"Modele par defaut: {DEFAULT_MODEL}")
    print("Ouvrez http://localhost:5000")
    app.run(debug=True, host="0.0.0.0", port=5000)
