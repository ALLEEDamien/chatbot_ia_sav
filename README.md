# Assistant Service Client

Chatbot de support client propulsé par l'API Groq (modèle configurable, `llama-3.3-70b-versatile` par défaut), avec une base de connaissances (RAG) : les réponses peuvent s'appuyer sur des documents (PDF, CSV, TXT) indexés via une page d'administration.

- **Backend** : FastAPI (Python)
- **Frontend** : React + Vite + Tailwind CSS + React Router

## Backend

1. Se placer dans le dossier `backend` :

   ```bash
   cd backend
   ```

2. Créer un environnement virtuel et l'activer :

   ```bash
   python -m venv venv
   # Windows
   venv\Scripts\activate
   # macOS / Linux
   source venv/bin/activate
   ```

3. Installer les dépendances :

   ```bash
   pip install -r requirements.txt
   ```

4. Créer une clé API Groq — elle est indispensable pour que le chatbot réponde. Le plan gratuit suffit pour tester, mais il est **limité** (voir « Limites du plan gratuit » ci-dessous) :

   1. Aller sur [console.groq.com](https://console.groq.com) et créer un compte (ou se connecter).
   2. Ouvrir la page [API Keys](https://console.groq.com/keys) et cliquer sur **Create API Key**.
   3. Donner un nom à la clé (ex : `chatbot-sav`) puis la créer.
   4. **Copier la clé immédiatement** (elle commence par `gsk_`) : elle ne sera plus affichée ensuite.

   Ne partagez jamais cette clé et ne la commitez pas : elle ne doit figurer que dans votre fichier `.env`.

   **Limites du plan gratuit.** Chaque modèle a des quotas, consultables dans la console Groq ([console.groq.com/settings/limits](https://console.groq.com/settings/limits)). Exemple pour `openai/gpt-oss-20b` :

   | Limite | Signification                  | Valeur  |
   | ------ | ------------------------------ | ------- |
   | RPM    | requêtes par minute            | 30      |
   | RPD    | requêtes par jour              | 1 000   |
   | TPM    | tokens par minute              | 8 000   |
   | TPD    | tokens par jour                | 200 000 |

   Quand un quota est atteint, l'API refuse les requêtes (erreur 429) et le chat affiche « Une erreur est survenue » jusqu'à la réinitialisation du quota. Pour des usages plus intensifs, Groq propose un plan payant facturé au token. Les quotas varient selon le modèle et peuvent changer : référez-vous toujours à la console. Pour changer de modèle, modifiez `GROQ_MODEL` dans le `.env` (ex : `GROQ_MODEL=openai/gpt-oss-20b`).

5. Configurer les variables d'environnement. Copier `.env.example` en `.env` et renseigner votre clé Groq :

   ```bash
   cp .env.example .env
   ```

   Seule `GROQ_API_KEY` est obligatoire. Toutes les variables sont documentées dans [backend/.env.example](backend/.env.example) :

   | Variable          | Obligatoire | Défaut                     | Rôle                                              |
   | ----------------- | ----------- | -------------------------- | ------------------------------------------------- |
   | `GROQ_API_KEY`    | Oui         | —                          | Clé d'API Groq                                    |
   | `GROQ_MODEL`      | Non         | `llama-3.3-70b-versatile`  | Modèle Groq utilisé                               |
   | `COMPANY_NAME`    | Non         | `notre entreprise`         | Nom affiché dans l'en-tête du chat                |
   | `CORS_ORIGINS`    | Non         | `http://localhost:5173`    | Origines frontend autorisées (séparées par `,`)   |
   | `CHROMA_PATH`     | Non         | `./chroma_db`              | Dossier de la base vectorielle                    |
   | `EMBEDDING_MODEL` | Non         | `all-MiniLM-L6-v2`         | Modèle d'embeddings (réindexer si modifié)        |

6. Lancer le serveur :

   ```bash
   uvicorn main:app --reload --port 8000
   ```

   L'API est disponible sur `http://localhost:8000`.

   Au premier lancement, le modèle d'embeddings `all-MiniLM-L6-v2` (sentence-transformers) est téléchargé automatiquement depuis Hugging Face — cela peut prendre quelques instants.

### API

Un unique endpoint GraphQL : `POST /graphql` (schéma dans `backend/schema.py`).

- `mutation chat` — envoie la conversation et reçoit la réponse de l'assistant. Les 3 passages les plus pertinents de la base de connaissances sont injectés dans le contexte du prompt.
- `mutation uploadDocument` — indexe un fichier PDF, CSV ou TXT (ChromaDB).
- `mutation deleteDocument` — supprime un document de la base.
- `query documents`, `totalChunks`, `companyName` — lecture de l'état de la base.

Les vecteurs sont stockés localement dans `backend/chroma_db/` (dossier généré automatiquement, non versionné).

## Frontend

1. Se placer dans le dossier `frontend` :

   ```bash
   cd frontend
   ```

2. Installer les dépendances :

   ```bash
   npm install
   ```

   (Optionnel) Si le backend n'est pas sur `http://localhost:8000`, copier `.env.example` en `.env` et définir `VITE_GRAPHQL_URL` (voir [frontend/.env.example](frontend/.env.example)).

3. Lancer le serveur de développement :

   ```bash
   npm run dev
   ```

   L'application est disponible sur `http://localhost:5173`.

## Utilisation

1. Démarrer le backend (port 8000) puis le frontend (port 5173).
2. Ouvrir `http://localhost:5173` pour discuter avec l'assistant.
3. Aller sur `http://localhost:5173/admin` pour glisser-déposer des documents (FAQ, catalogue, politique de retour...) et alimenter la base de connaissances utilisée par le chatbot.

## Documents d'exemple

Le dossier [documents_exemples/](documents_exemples/) contient des fichiers prêts à être envoyés depuis la page `/admin` pour tester le chatbot :

- `faq_boutique.txt` — questions fréquentes (livraison, retours, paiement...) ;
- `infos_boutique.txt` — informations générales sur la boutique ;
- `catalogue_produits.csv` — catalogue de produits.

Ces fichiers concernent une boutique fictive (UrbanThread) : remplacez-les par vos propres documents pour votre usage.
