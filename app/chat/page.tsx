"use client";

import { useEffect, useRef, useState } from "react";
import { AuthGuardHeader } from "@/components/AuthGuardHeader";
import { applySavedTextSize } from "@/lib/textSize";
import { supabase } from "@/lib/supabaseClient";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    applySavedTextSize();

    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) setProfile(data);
    }
    loadProfile();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content) return;

    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };

    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, profile }),
      });

      const json = await res.json();

      const reply: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: json.reply ?? "Sorry, I couldn't think of a good answer.",
      };

      setMessages((prev) => [...prev, reply]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <AuthGuardHeader />

      <main className="mx-auto flex min-h-[calc(100vh-80px)] max-w-md flex-col px-4 pb-24 pt-4">
        <h1 className="mb-3 text-lg font-semibold">AI Coach</h1>
        <p className="mb-4 text-xs text-slate-400">
          Ask about your habits, reflections, and goals. Replies stay concise and
          practical.
        </p>

        <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-xs">
          {messages.length === 0 && (
            <p className="text-slate-500 text-[11px]">
              Try: “How have my habits been this week?” or “Give me one suggestion
              to get closer to my 3-year goal.”
            </p>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`mb-2 flex ${m.role === "user" ? "justify-end" : "justify-start"
                }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 ${m.role === "user"
                    ? "bg-emerald-500 text-slate-950"
                    : "bg-slate-800 text-slate-100"
                  } text-[11px] whitespace-pre-wrap`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <p className="mt-2 text-[11px] text-slate-500">Thinking…</p>
          )}

          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={sendMessage}
          className="mt-3 flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Foundation…"
            className="flex-1 bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-slate-950 disabled:opacity-60"
          >
            Send
          </button>
        </form>
      </main>
    </div>
  );
}
