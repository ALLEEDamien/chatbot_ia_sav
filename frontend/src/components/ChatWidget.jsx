// Widget de chat flottant (bulle en bas à droite) affiché sur toutes les pages.
// Il garde l'historique de la conversation en mémoire et l'envoie en entier au
// backend à chaque message, pour que l'IA tienne compte du contexte.
import { useEffect, useRef, useState } from "react";
import { gqlRequest } from "../lib/graphql";

// Récupère le nom de l'entreprise affiché dans l'en-tête du chat.
const CONFIG_QUERY = `
  query {
    companyName
  }
`;

// Envoie la conversation et reçoit la réponse de l'IA.
const CHAT_MUTATION = `
  mutation Chat($messages: [MessageInput!]!) {
    chat(messages: $messages) {
      reply
    }
  }
`;

function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false); // fenêtre de chat ouverte ou repliée
  const [companyName, setCompanyName] = useState("");
  // Historique affiché ; `id` sert uniquement de clé React (jamais envoyé au backend).
  const [messages, setMessages] = useState([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "Bonjour ! Comment puis-je vous aider ?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false); // true pendant l'attente de la réponse de l'IA
  const messagesEndRef = useRef(null); // repère placé sous le dernier message, pour le défilement

  // Au chargement : récupère le nom de l'entreprise (échec ignoré, "..." reste affiché).
  useEffect(() => {
    gqlRequest(CONFIG_QUERY)
      .then((data) => setCompanyName(data.companyName))
      .catch(() => {});
  }, []);

  // Fait défiler jusqu'au dernier message à chaque nouveau message ou à l'ouverture.
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping, isOpen]);

  // Envoie le message saisi puis ajoute la réponse de l'IA (ou un message d'erreur).
  const sendMessage = async () => {
    const trimmed = input.trim();
    // Ignore les messages vides et empêche d'envoyer pendant qu'une réponse est attendue.
    if (!trimmed || isTyping) return;

    const userMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);

    try {
      // On n'envoie que role + content (sans l'id local).
      const data = await gqlRequest(CHAT_MUTATION, {
        messages: newMessages.map(({ role, content }) => ({ role, content })),
      });
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: data.chat.reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: "Une erreur est survenue" },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // La touche Entrée envoie le message.
  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed right-6 bottom-6 z-50 flex flex-col items-end gap-3">
      {/* Fenêtre de chat : en-tête, liste des messages, zone de saisie */}
      {isOpen && (
        <div className="flex h-[480px] w-[350px] max-h-[480px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
          <div className="flex shrink-0 items-center justify-between bg-black px-4 py-3">
            <span className="text-sm font-semibold text-white">
              Assistant {companyName || "..."}
            </span>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Fermer le chat"
              className="text-white/80 transition-colors hover:text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-white px-4 py-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "rounded-br-sm bg-black text-white"
                      : "rounded-bl-sm bg-gray-100 text-gray-900"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {/* Indicateur "l'assistant écrit..." (trois points animés) */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-gray-100 px-3 py-2.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="flex shrink-0 gap-2 border-t border-gray-200 bg-white p-3">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Écrivez votre message..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-black"
            />
            <button
              onClick={sendMessage}
              disabled={isTyping || !input.trim()}
              className="shrink-0 rounded-lg bg-black px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Envoyer
            </button>
          </div>
        </div>
      )}

      {/* Bulle flottante qui ouvre/ferme la fenêtre de chat */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? "Fermer le chat" : "Ouvrir le chat"}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-black text-white shadow-lg transition-transform hover:scale-105"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
          <path d="M12 2C6.477 2 2 5.977 2 10.857c0 2.719 1.37 5.13 3.51 6.751-.13 1.001-.482 2.383-1.16 3.677-.09.174.048.38.24.352 1.87-.276 3.44-.994 4.478-1.596 1 .25 2.05.386 3.13.386 5.523 0 10-3.977 10-8.857 0-4.88-4.477-8.857-10-8.857Z" />
        </svg>
      </button>
    </div>
  );
}

export default ChatWidget;
