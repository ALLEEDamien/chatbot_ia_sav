"""Point d'entrée de l'API backend (FastAPI).

Ce fichier crée l'application, charge les variables d'environnement depuis
`.env`, autorise le frontend à l'appeler (CORS) et expose l'API GraphQL
(définie dans schema.py) sur l'URL /graphql.

Lancement : `uvicorn main:app --reload --port 8000` (depuis le dossier backend).
"""

import os

from dotenv import load_dotenv

# IMPORTANT : à faire AVANT d'importer les autres modules, car rag.py et
# llm_client.py lisent des variables d'environnement dès leur import.
load_dotenv()

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from schema import graphql_router  # noqa: E402

# Origines autorisées à appeler l'API, séparées par des virgules.
# Par défaut : le serveur de développement Vite.
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Toute l'API (chat, documents) passe par un unique endpoint GraphQL.
app.include_router(graphql_router, prefix="/graphql")
