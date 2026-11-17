/**
 * Client GraphQL minimal utilisé par tout le frontend.
 *
 * - gqlRequest : requête/mutation GraphQL classique (JSON) ;
 * - gqlUpload  : upload de fichier avec suivi de progression
 *                (spécification "GraphQL multipart request").
 *
 * Variable d'environnement : VITE_GRAPHQL_URL (voir frontend/.env.example).
 */

// URL de l'API backend. Les variables Vite doivent commencer par VITE_.
const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL || "http://localhost:8000/graphql";

/**
 * Envoie une requête GraphQL et retourne `data`.
 * Lève une Error avec le message de la première erreur GraphQL, le cas échéant.
 */
export async function gqlRequest(query, variables = {}) {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();

  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }

  return json.data;
}

/**
 * Envoie une mutation avec un fichier (variable GraphQL nommée "file").
 * `onProgress(pourcentage)` est appelé pendant l'envoi.
 * XMLHttpRequest est utilisé car fetch ne permet pas de suivre la progression d'un upload.
 */
export function gqlUpload(query, variables, file, onProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    // Format multipart GraphQL : "operations" (la requête, fichier à null),
    // "map" (quelle partie du formulaire remplit quelle variable), puis le fichier lui-même.
    formData.append(
      "operations",
      JSON.stringify({ query, variables: { ...variables, file: null } })
    );
    formData.append("map", JSON.stringify({ "0": ["variables.file"] }));
    formData.append("0", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", GRAPHQL_URL);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      let json;
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error("Réponse invalide du serveur"));
        return;
      }

      if (json.errors?.length) {
        reject(new Error(json.errors[0].message));
        return;
      }

      resolve(json.data);
    };

    xhr.onerror = () => reject(new Error("Échec de la connexion au serveur"));

    xhr.send(formData);
  });
}
