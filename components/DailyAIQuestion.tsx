"use client";

import { useState } from "react";
import { useGlobalState } from "./GlobalStateProvider";
import { supabase } from "@/lib/supabaseClient";
import { awardPoints, POINTS } from "@/lib/points";

export function DailyAIQuestion() {
    const { dailyQuestion, refreshPoints } = useGlobalState();
    const [awarding, setAwarding] = useState(false);

    // This component is often used in Reflection page
    // The answering logic is usually external (in the parent page), 
    // but if we want to award points for answering, we should expose a helper or handle it there.
    // Actually, the parent `ReflectPage` handles the input. 
    // This component only DISPLAYs the question.

    // WAIT. If the user wants to award points for answering, checking the code in `ReflectPage`, 
    // the answer is saved there.
    // So this component just needs to display the question using the Global State found in cache.
    // It should NOT fetch on its own.

    if (!dailyQuestion) return null;

    return (
        <div className="mb-4 rounded-2xl border border-app-border bg-app-card p-5 text-center shadow-sm relative group">
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-app-muted">
                Daily Question
            </h3>
            <p className="text-sm font-medium leading-relaxed text-app-main font-serif italic">
                “{dailyQuestion}”
            </p>
        </div>
    );
}
