"""RAG (Retrieval-Augmented Generation) : base de connaissances vectorielle.

Ce module stocke les textes utiles au SAV dans ChromaDB sous forme de
vecteurs (embeddings) et retrouve les passages les plus proches d'une
question pour les donner au LLM comme contexte.

Une seule collection, "documents" : les fichiers uploadés par l'admin
(PDF, CSV, TXT).

Variables d'environnement utilisées : CHROMA_PATH, EMBEDDING_MODEL.
"""

import csv
import io
import os
import uuid
from datetime import datetime, timezone

import chromadb
from pypdf import PdfReader
from sentence_transformers import SentenceTransformer

# --- Configuration -----------------------------------------------------------

CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_db")
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

COLLECTION_NAME = "documents"

# Découpage des fichiers .txt : taille d'un passage et recouvrement entre
# deux passages successifs (en caractères), pour ne pas couper une idée en deux.
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50

# --- Ressources partagées (créées une seule fois, à l'import du module) ------

_client = chromadb.PersistentClient(path=CHROMA_PATH)
_collection = _client.get_or_create_collection(COLLECTION_NAME)
_embedder = SentenceTransformer(EMBEDDING_MODEL_NAME)


# --- Découpage et extraction du texte ----------------------------------------


def _split_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Découpe un long texte en passages de `chunk_size` caractères qui se chevauchent."""
    chunks = []
    start = 0
    length = len(text)
    while start < length:
        end = start + chunk_size
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        # On avance de (taille - recouvrement) pour que les passages se recoupent.
        start += chunk_size - overlap
    return chunks


def _extract_passages(filename: str, content: bytes) -> list[str]:
    """Transforme un fichier en liste de passages selon son extension.

    - CSV : une ligne = un passage ;
    - PDF : une page = un passage ;
    - TXT : découpage en blocs de taille fixe.
    Lève ValueError pour tout autre format.
    """
    lower = filename.lower()

    if lower.endswith(".csv"):
        text = content.decode("utf-8", errors="ignore")
        reader = csv.reader(io.StringIO(text))
        # On ignore les lignes entièrement vides.
        return [", ".join(row) for row in reader if any(cell.strip() for cell in row)]

    if lower.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(content))
        passages = []
        for page in reader.pages:
            page_text = (page.extract_text() or "").strip()
            if page_text:
                passages.append(page_text)
        return passages

    if lower.endswith(".txt"):
        text = content.decode("utf-8", errors="ignore")
        return _split_text(text)

    raise ValueError("Format de fichier non supporté (formats acceptés : .pdf, .csv, .txt)")


# --- Gestion des documents uploadés ------------------------------------------


def add_document(filename: str, content: bytes) -> int:
    """Indexe un fichier uploadé. Retourne le nombre de passages créés (0 si le fichier est vide)."""
    passages = _extract_passages(filename, content)
    if not passages:
        return 0

    # Tous les passages d'un même fichier partagent le même doc_id,
    # ce qui permet ensuite de les lister ou supprimer ensemble.
    doc_id = str(uuid.uuid4())
    uploaded_at = datetime.now(timezone.utc).isoformat()

    embeddings = _embedder.encode(passages).tolist()
    ids = [f"{doc_id}_{i}" for i in range(len(passages))]
    metadatas = [
        {
            "doc_id": doc_id,
            "filename": filename,
            "chunk_index": i,
            "uploaded_at": uploaded_at,
        }
        for i in range(len(passages))
    ]

    _collection.add(ids=ids, documents=passages, embeddings=embeddings, metadatas=metadatas)
    return len(passages)


def list_documents() -> list[dict]:
    """Liste les documents indexés (un par fichier), du plus récent au plus ancien."""
    data = _collection.get(include=["metadatas"])
    docs: dict[str, dict] = {}

    # Chroma stocke des passages ; on les regroupe par doc_id pour retrouver les fichiers.
    for metadata in data["metadatas"]:
        doc_id = metadata["doc_id"]
        if doc_id not in docs:
            docs[doc_id] = {
                "doc_id": doc_id,
                "filename": metadata["filename"],
                "uploaded_at": metadata["uploaded_at"],
                "chunk_count": 0,
            }
        docs[doc_id]["chunk_count"] += 1

    return sorted(docs.values(), key=lambda doc: doc["uploaded_at"], reverse=True)


def delete_document(doc_id: str) -> int:
    """Supprime tous les passages d'un document. Retourne le nombre de passages supprimés."""
    existing = _collection.get(where={"doc_id": doc_id}, include=[])
    count = len(existing["ids"])
    if count:
        _collection.delete(where={"doc_id": doc_id})
    return count


# --- Recherche ---------------------------------------------------------------


def query_context(question: str, n_results: int = 3) -> list[str]:
    """Retourne les `n_results` passages les plus proches de la question."""
    count = _collection.count()
    if count == 0:
        return []

    embedding = _embedder.encode([question]).tolist()
    results = _collection.query(
        query_embeddings=embedding,
        n_results=min(n_results, count),
        include=["documents"],
    )
    # Chroma renvoie les passages déjà triés du plus proche au plus éloigné.
    return (results.get("documents") or [[]])[0]


def total_chunks() -> int:
    """Nombre total de passages dans les documents uploadés."""
    return _collection.count()
