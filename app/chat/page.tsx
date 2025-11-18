"use client";

import { useEffect, useRef, useState } from "react";
import { AuthGuardHeader } from "@/components/AuthGuardHeader";
import { applySavedTextSize } from "@/lib/textSize";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  useEffect(() => {
    applySavedTextSize();
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Ask me about your habits, reflections, or goals and I’ll give concise, practical insight.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            { role: "user", content: userMsg.content },
          ],
        }),
      });
      const data = await res.json();
      const replyText =
        (data?.reply as string) ||
        "Here’s a concise suggestion: focus on one key habit today and do it well.";

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: replyText,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error(err);
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "I ran into an error responding. Please try again in a moment or rephrase your question.",
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-slate-950 text-slate-100">
      <AuthGuardHeader />

      <header className="px-0 pt-2">
        <h1 className="text-2xl font-semibold text-amber-50">AI</h1>
        <p className="mt-1 text-xs text-slate-400">
          Chat with your personal Foundation AI about your data and goals. Replies stay short and
          focused.
        </p>
      </header>

      <div
        ref={listRef}
        className="mt-2 flex-1 space-y-2 overflow-y-auto rounded-2xl bg-slate-900 p-3 ring-1 ring-slate-700"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
              m.role === "user"
                ? "ml-auto bg-emerald-500 text-slate-950"
                : "mr-auto bg-slate-800 text-slate-100"
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="mr-auto inline-flex items-center gap-1 rounded-2xl bg-slate-800 px-3 py-2 text-xs text-slate-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            <span>Thinking…</span>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-2 flex items-end gap-2 border-t border-slate-800 pt-2 pb-1"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={2}
          className="max-h-20 w-full resize-none overflow-auto rounded-xl border border-slate-600 bg-slate-950/75 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
          placeholder="Ask Foundation AI about your routines, reflections, or goals…"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="flex-none rounded-full bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
