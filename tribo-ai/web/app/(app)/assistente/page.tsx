/**
 * /assistente — Chatbot de RH com streaming
 *
 * Cliente React que se conecta ao /api/chat/stream via SSE.
 * Mantém histórico local no MVP; em produção persiste via ChatSession.
 */

"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "Quando tenho direito a férias?",
  "Como calcular 13º proporcional?",
  "Posso fazer home office nas sextas?",
  "Quantos dias de licença-paternidade?",
];

export default function AssistantePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return;
    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: null }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("sem stream");

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.text) {
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = {
                  ...copy[copy.length - 1],
                  content: copy[copy.length - 1].content + payload.text,
                };
                return copy;
              });
            }
            if (payload.done) setStreaming(false);
            if (payload.error) {
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = {
                  role: "assistant",
                  content: "Ops, tive um problema. Tente novamente em instantes.",
                };
                return copy;
              });
              setStreaming(false);
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch {
      setStreaming(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto h-[calc(100vh-64px)] flex flex-col">
      <header className="border-b border-gray-200 p-4">
        <h1 className="text-xl font-semibold">Assistente de RH</h1>
        <p className="text-sm text-gray-500">
          Especialista em CLT, benefícios e políticas da sua empresa
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">💬</div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">Como posso ajudar?</h2>
            <p className="text-gray-500 mb-6">
              Tire dúvidas sobre CLT, benefícios, férias, e mais
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg mx-auto">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="p-3 text-left text-sm border border-gray-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content || "..."}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="border-t border-gray-200 p-4 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte sobre CLT, férias, benefícios…"
          disabled={streaming}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {streaming ? "..." : "Enviar"}
        </button>
      </form>
    </main>
  );
}
