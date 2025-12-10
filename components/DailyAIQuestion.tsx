"use client";

import { useState } from "react";
import { useGlobalState } from "./GlobalStateProvider";
import { supabase } from "@/lib/supabaseClient";
import { awardPoints, POINTS } from "@/lib/points";

interface Props {
    question?: string | null;
}

export function DailyAIQuestion({ question: propQuestion }: Props) {
    const { dailyQuestion: globalQuestion } = useGlobalState();

    // Use prop if provided, otherwise fallback to global
    // If prop is explicitly provided as null (loading or empty), we might want to wait or show nothing?
    // Let's assume if prop is undefined, use global. If string, use string.
    const displayQuestion = propQuestion !== undefined ? propQuestion : globalQuestion;

    if (!displayQuestion) return null;

    return (
        <div className="mb-4 rounded-2xl border border-app-border bg-app-card p-5 text-center shadow-sm relative group">
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-app-muted">
                Daily Question
            </h3>
            <p className="text-sm font-medium leading-relaxed text-app-main font-serif italic">
                “{displayQuestion}”
            </p>
        </div>
    );
}
