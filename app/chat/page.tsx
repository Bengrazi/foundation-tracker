// app/chat/page.tsx
"use client";

import { useState } from "react";
import { AuthGuardHeader } from "@/components/AuthGuardHeader";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Profile = {
  priorities?: string;
  lifeSummary?: string;
  ideology?: string;
  keyTruth?: string;
  aiVoice?: string;
};

const quickModes = [
  { id: "last7days", label: "Last 7 days" },
  { id: "allReflections", label: "All reflections" },
  { id: "general", label: "General advice" },
];

function getProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("foundation_profile_v1");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Profile;
  } catch {
    return null;
  }
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [contextMode, setContextMode] =
    useState<"last7days" | "allReflections" | "general">("general");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const newMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setLoading(true);

    try {
      const profile = getProfile();
      const res = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message: newMessage.content,
          contextMode,
          profile,
        }),
      });
      const data = await res.json();
      if (data?.reply) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.reply,
          },
        ]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <AuthGuardHeader />

      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Chat with Foundation AI</h1>
        <p className="text-xs text-slate-500">
          Foundation AI uses your routines, goals, reflections, and onboarding
          answers to respond just to you.
        </p>
      </header>

      <div className="flex gap-2 text-xs">
        {quickModes.map((m) => (
          <button
            key={m.id}
            onClick={() =>
              setContextMode(m.id as "last7days" | "allReflections" | "general")
            }
            className={`rounded-full border px-3 py-1 ${
              contextMode === m.id
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-2 overflow-auto rounded-xl border border-slate-200 bg-white p-3 text-sm">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                m.role === "user"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-900"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <p className="text-xs text-slate-400">Foundation AI is thinking…</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask anything…"
          className="flex-1 rounded-full border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
