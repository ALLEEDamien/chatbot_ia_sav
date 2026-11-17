// Espace d'administration (/admin) : gestion de la base de connaissances du chatbot.
// Permet d'envoyer (glisser-déposer), lister et supprimer les documents (PDF, CSV, TXT)
// que l'assistant utilise pour répondre.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gqlRequest, gqlUpload } from "../lib/graphql";

// Liste des documents + nombre total de passages.
const DOCUMENTS_QUERY = `
  query {
    documents {
      docId
      filename
      uploadedAt
      chunkCount
    }
    totalChunks
  }
`;

// Envoi d'un fichier à indexer (exécuté via gqlUpload).
const UPLOAD_MUTATION = `
  mutation Upload($file: Upload!) {
    uploadDocument(file: $file) {
      filename
      chunksIndexed
    }
  }
`;

// Suppression d'un document et de tous ses passages.
const DELETE_MUTATION = `
  mutation Delete($docId: String!) {
    deleteDocument(docId: $docId) {
      docId
      chunksDeleted
    }
  }
`;

// Date ISO -> affichage français court (ex : "17/11/2026 14:30").
function formatDate(isoString) {
  return new Date(isoString).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

// Carte réutilisable : titre, description facultative, pastille (badge) et contenu.
function SectionCard({ title, description, badge, children }) {
  return (
    <section className="rounded-2xl border border-[var(--sav-border)] bg-[var(--sav-surface)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--sav-text)]">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-[var(--sav-text-muted)]">{description}</p>
          )}
        </div>
        {badge && (
          <span className="shrink-0 rounded-full bg-[var(--sav-bubble-bot-bg)] px-2.5 py-1 text-xs font-medium text-[var(--sav-text-muted)]">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Admin() {
  const [documents, setDocuments] = useState([]);
  const [totalChunks, setTotalChunks] = useState(0); // nombre total de passages indexés
  const [uploads, setUploads] = useState([]); // envois en cours (barres de progression)
  const [isDragging, setIsDragging] = useState(false); // fichier survolant la zone de dépôt
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  // Recharge la liste des documents et les compteurs depuis le backend.
  const fetchDocuments = useCallback(async () => {
    try {
      const data = await gqlRequest(DOCUMENTS_QUERY);
      setDocuments(data.documents);
      setTotalChunks(data.totalChunks);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // Chargement initial de la liste.
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Envoie un fichier et met à jour sa barre de progression.
  // Statuts : uploading -> processing (envoi fini, indexation côté serveur) -> done | error.
  const uploadFile = (file) => {
    const uploadId = crypto.randomUUID();
    setUploads((prev) => [
      ...prev,
      { id: uploadId, filename: file.name, progress: 0, status: "uploading", error: null },
    ]);

    gqlUpload(UPLOAD_MUTATION, {}, file, (progress) => {
      setUploads((prev) =>
        prev.map((upload) =>
          upload.id === uploadId
            ? { ...upload, progress, status: progress >= 100 ? "processing" : "uploading" }
            : upload
        )
      );
    })
      .then(() => {
        setUploads((prev) =>
          prev.map((upload) =>
            upload.id === uploadId ? { ...upload, progress: 100, status: "done" } : upload
          )
        );
        fetchDocuments();
        // Retire la ligne de progression après 2,5 s pour ne pas encombrer l'écran.
        setTimeout(() => {
          setUploads((prev) => prev.filter((upload) => upload.id !== uploadId));
        }, 2500);
      })
      .catch((err) => {
        setUploads((prev) =>
          prev.map((upload) =>
            upload.id === uploadId ? { ...upload, status: "error", error: err.message } : upload
          )
        );
      });
  };

  // Lance l'envoi de chaque fichier sélectionné ou déposé.
  const handleFiles = (fileList) => {
    Array.from(fileList).forEach(uploadFile);
  };

  // Dépôt d'un fichier dans la zone (glisser-déposer).
  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  // Supprime un document puis rafraîchit la liste.
  const handleDelete = async (docId) => {
    try {
      await gqlRequest(DELETE_MUTATION, { docId });
      fetchDocuments();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--sav-bg)] text-[var(--sav-text)]">
      <header className="flex items-center justify-between border-b border-[var(--sav-border)] bg-[var(--sav-header-bg)] px-6 py-4 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-[var(--sav-text)]">Base de connaissances</h1>
          <p className="mt-0.5 text-sm text-[var(--sav-text-muted)]">
            Gérez les informations que l'assistant utilise pour répondre à vos clients
          </p>
        </div>
        <Link
          to="/"
          className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--sav-text-muted)] hover:bg-[var(--sav-bubble-bot-bg)]"
        >
          Retour au site
        </Link>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Documents : zone de dépôt, envois en cours, liste des fichiers indexés */}
        <SectionCard
          title="Documents"
          description="PDF, CSV ou TXT contenant vos FAQ, politiques ou fiches produits"
          badge={`${totalChunks} passage${totalChunks !== 1 ? "s" : ""}`}
        >
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
              isDragging
                ? "border-[var(--sav-primary)] bg-[var(--sav-bubble-bot-bg)]"
                : "border-[var(--sav-border)] bg-[var(--sav-bg)]"
            }`}
          >
            <p className="text-sm font-medium text-[var(--sav-text)]">
              Glissez-déposez un fichier ici, ou cliquez pour en sélectionner un
            </p>
            <p className="mt-1 text-xs text-[var(--sav-text-muted)]">
              Formats acceptés : PDF, CSV, TXT
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.csv,.txt"
              multiple
              className="hidden"
              onChange={(event) => {
                handleFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>

          {uploads.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {uploads.map((upload) => (
                <div
                  key={upload.id}
                  className="rounded-lg border border-[var(--sav-border)] bg-[var(--sav-bg)] px-3 py-2.5"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate font-medium">{upload.filename}</span>
                    <span className="shrink-0 text-xs text-[var(--sav-text-muted)]">
                      {upload.status === "uploading" && `${upload.progress}%`}
                      {upload.status === "processing" && "Indexation..."}
                      {upload.status === "done" && "Terminé"}
                      {upload.status === "error" && "Erreur"}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--sav-border)]">
                    <div
                      className={`h-full rounded-full transition-all ${
                        upload.status === "error" ? "bg-red-500" : "bg-[var(--sav-primary)]"
                      } ${upload.status === "processing" ? "animate-pulse" : ""}`}
                      style={{
                        width: upload.status === "error" ? "100%" : `${upload.progress}%`,
                      }}
                    />
                  </div>
                  {upload.error && <p className="mt-1 text-xs text-red-600">{upload.error}</p>}
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 border-t border-[var(--sav-border)] pt-4">
            {documents.length === 0 && (
              <p className="text-center text-sm text-[var(--sav-text-muted)]">
                Aucun document indexé pour le moment.
              </p>
            )}

            {documents.map((doc) => (
              <div
                key={doc.docId}
                className="flex items-center justify-between rounded-lg border border-[var(--sav-border)] bg-[var(--sav-bg)] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{doc.filename}</p>
                  <p className="text-xs text-[var(--sav-text-muted)]">
                    {doc.chunkCount} passage{doc.chunkCount !== 1 ? "s" : ""} · indexé le{" "}
                    {formatDate(doc.uploadedAt)}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(doc.docId)}
                  className="ml-3 shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        </SectionCard>

      </main>
    </div>
  );
}

export default Admin;
