"use client";

import { useEffect, useRef, useState } from "react";
import { applySavedTextSize } from "@/lib/textSize";
import { supabase } from "@/lib/supabaseClient";

type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
};

interface ChatWidgetProps {
    contextMode?: "last7days" | "allReflections" | "celebration" | "general" | "stats";
}

export function ChatWidget({ contextMode = "general" }: ChatWidgetProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [profile, setProfile] = useState<any>(null);
    const [goals, setGoals] = useState<any[]>([]);

    useEffect(() => {
        applySavedTextSize();

        async function loadData() {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profileData } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single();

            if (profileData) setProfile(profileData);

            const { data: goalsData } = await supabase
                .from("goals")
                .select("title, horizon")
                .eq("user_id", user.id);

            if (goalsData) {
                setGoals(goalsData);
            }
        }
        loadData();
    }, []);

    useEffect(() => {
        if (messages.length > 0) {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
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
                body: JSON.stringify({ message: content, profile, goals, contextMode }),
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
        <div className="flex flex-col h-80 rounded-2xl border border-app-border bg-app-card overflow-hidden">
            <div className="bg-app-card border-b border-app-border px-4 py-2">
                <h2 className="text-sm font-semibold text-app-main">AI Coach</h2>
                <p className="text-[10px] text-app-muted">
                    Ask about your habits & goals.
                </p>
            </div>

            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto p-3 text-xs"
            >
                {messages.length === 0 && (
                    <p className="text-app-muted text-[11px] text-center mt-4">
                        Try: “How have my habits been?” or “Give me a tip for my 3y goal.”
                    </p>
                )}

                {messages.map((m) => (
                    <div
                        key={m.id}
                        className={`mb-2 flex ${m.role === "user" ? "justify-end" : "justify-start"
                            }`}
                    >
                        <div
                            className={`max-w-[85%] rounded-2xl px-3 py-2 ${m.role === "user"
                                ? "bg-app-accent text-app-accent-text"
                                : "bg-app-input text-app-main"
                                } text-[11px] whitespace-pre-wrap`}
                        >
                            {m.content}
                        </div>
                    </div>
                ))}

                {loading && (
                    <p className="mt-2 text-[11px] text-app-muted">Thinking…</p>
                )}

                <div ref={bottomRef} />
            </div>

            <form
                onSubmit={sendMessage}
                className="p-2 bg-app-card border-t border-app-border flex gap-2"
            >
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask Foundation…"
                    className="flex-1 bg-app-input rounded-full px-3 py-1.5 text-xs text-app-main placeholder:text-app-muted focus:outline-none border border-transparent focus:border-app-border"
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="rounded-full bg-app-accent px-3 py-1 text-[11px] font-semibold text-app-accent-text disabled:opacity-60"
                >
                    Send
                </button>
            </form>
        </div>
    );
}
