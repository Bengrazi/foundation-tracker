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
  const raw = localStorage.getItem("foundation_profile_v1");
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

  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-full flex-col gap-3 text-slate-100">
      <AuthGuardHeader />

      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-amber-50">
          Chat with Foundation AI
        </h1>
        <p className="text-xs text-slate-400">
          Ask about your routines, goals, or reflections. Replies stay short and
          practical.
        </p>
      </header>

      <div className="flex gap-2 text-xs">
        {quickModes.map((m) => (
          <button
            key={m.id}
            onClick={() =>
              setContextMode(m.id as "last7days" | "allReflections" | "general")
            }
            className={`rounded-full border px-3 py-1 transition ${
              contextMode === m.id
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                : "border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-100"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-2 overflow-auto rounded-2xl bg-slate-900/80 p-3 ring-1 ring-slate-800">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-slate-800 text-slate-100"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <p className="text-xs text-slate-400">Foundation AI is thinking…</p>
        )}
        {!loading && messages.length === 0 && (
          <p className="text-xs text-slate-500">
            Example: &quot;What should I focus on this week to move my 3-year
            goals forward?&quot;
          </p>
        )}
      </div>

      <div className="space-y-2">
        <textarea
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            autoGrow(e.currentTarget);
          }}
          onKeyDown={handleKeyDown}
          rows={2}
          className="w-full whitespace-pre-wrap break-words overflow-hidden resize-none rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
          placeholder="Ask anything… (Shift+Enter for new line)"
        />
        <div className="flex justify-end">
          <button
            onClick={sendMessage}
            disabled={loading}
            className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
