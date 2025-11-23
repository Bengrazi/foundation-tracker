"use client";

import { useState } from "react";
import { DailyIntention } from "@/lib/engagementTypes";

interface Props {
    intention: DailyIntention;
}

export function DailyIntentionCard({ intention: initialIntention }: Props) {
    const [intention, setIntention] = useState(initialIntention);
    const [voting, setVoting] = useState(false);

    // Update local state if prop changes (e.g. after refresh)
    if (initialIntention.id !== intention.id && initialIntention.content !== intention.content) {
        setIntention(initialIntention);
    }

    async function handleVote(vote: "up" | "down") {
        if (voting || intention.vote === vote || intention.id === "default") return;

        // Optimistic update
        const previousVote = intention.vote;
        setIntention((prev) => ({ ...prev, vote }));
        setVoting(true);

        try {
            const res = await fetch("/api/intention", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: intention.id,
                    vote,
                    date: intention.date, // Pass date to verify/log if needed
                }),
            });

            if (!res.ok) {
                throw new Error("Failed to vote");
            }
        } catch (error) {
            // Revert on error
            setIntention((prev) => ({ ...prev, vote: previousVote }));
            console.error(error);
        } finally {
            setVoting(false);
        }
    }

    return (
        <div className="mb-6 rounded-2xl border border-app-border bg-app-card p-5 text-center shadow-sm relative group">
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-app-muted">
                Daily Intention
            </h3>
            <p className="mb-4 text-sm font-medium leading-relaxed text-app-main font-serif italic">
                “{intention.content}”
            </p>

            <div className="flex justify-center gap-4">
                <button
                    onClick={() => handleVote("up")}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${intention.vote === "up"
                        ? "bg-green-500/20 text-green-500"
                        : "bg-app-input text-app-muted hover:bg-app-border hover:text-app-main"
                        } ${intention.id === "default" ? "opacity-50 cursor-not-allowed" : ""}`}
                    disabled={voting || intention.id === "default"}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-4 w-4"
                    >
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                </button>
                <button
                    onClick={() => handleVote("down")}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${intention.vote === "down"
                        ? "bg-red-500/20 text-red-500"
                        : "bg-app-input text-app-muted hover:bg-app-border hover:text-app-main"
                        } ${intention.id === "default" ? "opacity-50 cursor-not-allowed" : ""}`}
                    disabled={voting || intention.id === "default"}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-4 w-4 rotate-180"
                    >
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
