"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function DailyAIQuestion() {
    const [question, setQuestion] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchQuestion = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                // In a real implementation, this would fetch from an API that generates a daily question
                // For now, we'll use a placeholder or fetch from a static list/API
                // Let's assume we have an API route for this
                const res = await fetch("/api/daily-question", {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                    },
                });

                if (res.ok) {
                    const data = await res.json();
                    setQuestion(data.question);
                }
            } catch (e) {
                console.error("Failed to fetch daily question", e);
            } finally {
                setLoading(false);
            }
        };

        fetchQuestion();
    }, []);

    if (loading) return null;
    if (!question) return null;

    return (
        <div className="mb-4 rounded-2xl border border-app-accent/30 bg-app-accent/5 p-4">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🍒</span>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-app-accent-color">
                    Daily Question
                </h3>
            </div>
            <p className="text-sm text-app-main italic">
                &ldquo;{question}&rdquo;
            </p>
        </div>
    );
}
