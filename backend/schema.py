"""API GraphQL (Strawberry) : toute la logique exposée au frontend.

Contenu :
  - Query    : nom de l'entreprise, liste des documents, nombre de passages ;
  - Mutation : chat (coeur du SAV), upload et suppression de documents.

Fonctionnement du chat : on cherche dans la base de connaissances (rag.py)
les passages liés à la question, on les place dans le prompt système, puis on
interroge le LLM.

Variable d'environnement utilisée : COMPANY_NAME (le .env est chargé par main.py).
"""

import os

import strawberry
from strawberry.fastapi import GraphQLRouter
from strawberry.file_uploads import Upload

import rag
from llm_client import LLMClient, LLMConfigError, LLMRequestError, get_llm_client

# Nom affiché dans l'en-tête du widget de chat.
COMPANY_NAME = os.getenv("COMPANY_NAME", "notre entreprise")
llm_client: LLMClient = get_llm_client()


# --- Types GraphQL -----------------------------------------------------------


@strawberry.input
class MessageInput:
    """Un message de la conversation envoyé par le frontend ("user" ou "assistant")."""

    role: str
    content: str


@strawberry.type
class ChatResult:
    """Réponse du chatbot."""

    reply: str


@strawberry.type
class Document:
    """Un fichier indexé dans la base de connaissances."""

    doc_id: str
    filename: str
    uploaded_at: str
    chunk_count: int


@strawberry.type
class UploadResult:
    """Résultat d'un upload : fichier et nombre de passages créés."""

    filename: str
    chunks_indexed: int


@strawberry.type
class DeleteResult:
    """Résultat d'une suppression : document et nombre de passages supprimés."""

    doc_id: str
    chunks_deleted: int


# --- Prompt système ----------------------------------------------------------
# Règles de comportement du chatbot. Le nom de l'entreprise est injecté
# au moment de la construction du prompt (voir _build_system_prompt).
SYSTEM_PROMPT = """Tu es un assistant SAV professionnel pour {company}.
Tu réponds uniquement à partir des informations du contexte fourni.

RÈGLES STRICTES :

1. INFORMATIONS MANQUANTES :
   - Si tu n'as pas l'information dans le contexte →
     réponds : 'Je n'ai pas cette information. Je vous invite à contacter
     notre équipe pour plus de détails.'
   - Ne jamais inventer ou supposer une information absente du contexte.

2. TON ET FORMAT :
   - Toujours répondre en français.
   - Réponses courtes et directes, maximum 3-4 phrases.
   - Ton professionnel mais chaleureux, jamais agressif.
   - Ne jamais commencer une réponse par 'Je' ou 'Bonjour'.

3. COHÉRENCE :
   - Ne jamais contredire les informations du contexte.

4. HORS SUJET ET CONTENU INAPPROPRIÉ :
   - Si la question est clairement sans rapport avec le SAV →
     reformule poliment que tu es uniquement disponible pour le SAV.
     Varie la formulation, reste chaleureux et naturel.
   - Si le message contient des propos offensants, discriminatoires
     ou inappropriés → réponds calmement et fermement que tu n'es pas
     en mesure de traiter ce type de message, et redirige vers le SAV.
   - Si la question est vague mais pourrait concerner le SAV →
     demande de préciser sans rejeter."""


def _build_system_prompt(context_passages: list[str]) -> str:
    """Assemble le prompt final : règles + passages de contexte trouvés."""
    context = "\n\n".join(context_passages) if context_passages else "Aucune information disponible pour cette question."
    return SYSTEM_PROMPT.replace("{company}", COMPANY_NAME) + f"\n\nContexte :\n{context}"


# --- Requêtes (lecture) ------------------------------------------------------


@strawberry.type
class Query:
    @strawberry.field
    def company_name(self) -> str:
        return COMPANY_NAME

    @strawberry.field
    def documents(self) -> list[Document]:
        return [Document(**doc) for doc in rag.list_documents()]

    @strawberry.field
    def total_chunks(self) -> int:
        return rag.total_chunks()


# --- Mutations (actions) -----------------------------------------------------


@strawberry.type
class Mutation:
    @strawberry.mutation
    async def chat(self, messages: list[MessageInput]) -> ChatResult:
        """Répond au dernier message du client en tenant compte de tout l'historique."""
        # La recherche RAG se base uniquement sur la dernière question du client.
        last_user_message = next(
            (message.content for message in reversed(messages) if message.role == "user"),
            "",
        )
        context_passages = rag.query_context(last_user_message) if last_user_message else []

        chat_messages = [{"role": "system", "content": _build_system_prompt(context_passages)}] + [
            {"role": message.role, "content": message.content} for message in messages
        ]

        try:
            reply = await llm_client.complete(chat_messages)
            return ChatResult(reply=reply.content)
        except (LLMConfigError, LLMRequestError):
            return ChatResult(reply="Une erreur est survenue, veuillez réessayer dans quelques instants.")

    @strawberry.mutation
    async def upload_document(self, file: Upload) -> UploadResult:
        """Indexe un fichier (PDF/CSV/TXT) dans la base de connaissances."""
        content = await file.read()
        filename = file.filename

        try:
            chunks_indexed = rag.add_document(filename, content)
        except ValueError as error:
            raise Exception(str(error))

        if chunks_indexed == 0:
            raise Exception("Aucun contenu exploitable trouvé dans le fichier")

        return UploadResult(filename=filename, chunks_indexed=chunks_indexed)

    @strawberry.mutation
    def delete_document(self, doc_id: str) -> DeleteResult:
        """Supprime un document et tous ses passages."""
        chunks_deleted = rag.delete_document(doc_id)
        if chunks_deleted == 0:
            raise Exception("Document introuvable")

        return DeleteResult(doc_id=doc_id, chunks_deleted=chunks_deleted)


# --- Assemblage final (importé par main.py) ----------------------------------

schema = strawberry.Schema(query=Query, mutation=Mutation)
# multipart_uploads_enabled : nécessaire pour l'upload de fichiers via GraphQL.
graphql_router = GraphQLRouter(schema, multipart_uploads_enabled=True)
