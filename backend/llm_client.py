"""Client LLM : isole le fournisseur d'IA (Groq) du reste de l'application.

La logique métier (schema.py) ne dépend que de l'interface abstraite
`LLMClient`. Pour changer de fournisseur, il suffit d'ajouter une classe
qui l'implémente et de modifier `get_llm_client()` en bas du fichier.

Variables d'environnement utilisées : GROQ_API_KEY, GROQ_MODEL.
"""

import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

import httpx

# Modèle utilisé si GROQ_MODEL n'est pas défini.
DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"


@dataclass
class LLMMessage:
    """Réponse du LLM : du texte, et/ou des demandes d'appel d'outils (tool calls)."""

    content: str | None
    tool_calls: list[dict] = field(default_factory=list)


class LLMConfigError(Exception):
    """La configuration du LLM (clé API, modèle...) est invalide ou manquante."""


class LLMRequestError(Exception):
    """L'appel au LLM a échoué (erreur réseau, modèle indisponible, etc.)."""


class LLMClient(ABC):
    """Abstraction dont dépend la logique métier (chat, agent). Toute
    nouvelle implémentation (autre fournisseur, autre modèle) doit
    respecter ce contrat sans que le reste du code n'ait à changer."""

    @abstractmethod
    async def complete(self, messages: list[dict], tools: list[dict] | None = None) -> LLMMessage:
        """Envoie une conversation au LLM et retourne sa réponse (texte et/ou appels d'outils)."""


class GroqLLMClient(LLMClient):
    """Implémentation pour l'API Groq (format compatible OpenAI)."""

    API_URL = "https://api.groq.com/openai/v1/chat/completions"

    def __init__(self, api_key: str | None, model: str):
        self._api_key = api_key
        self._model = model

    async def complete(self, messages: list[dict], tools: list[dict] | None = None) -> LLMMessage:
        if not self._api_key:
            raise LLMConfigError("GROQ_API_KEY manquante dans le fichier .env")

        payload = {"model": self._model, "messages": messages}
        # Si des outils sont fournis, le modèle décide seul s'il doit en appeler un.
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(self.API_URL, json=payload, headers=headers)

        if response.status_code != 200:
            raise LLMRequestError(response.text)

        message = response.json()["choices"][0]["message"]
        return LLMMessage(content=message.get("content"), tool_calls=message.get("tool_calls") or [])


def get_llm_client() -> LLMClient:
    """Point d'assemblage unique : c'est ici, et seulement ici, qu'on choisit
    le fournisseur/modèle concret. Changer de modèle = éditer .env, pas le code.
    Changer de fournisseur = ajouter une classe et changer cette fonction."""
    return GroqLLMClient(
        api_key=os.getenv("GROQ_API_KEY"),
        model=os.getenv("GROQ_MODEL", DEFAULT_GROQ_MODEL),
    )
