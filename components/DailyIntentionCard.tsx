"use client";

import { useState } from "react";
import { DailyIntention } from "@/lib/engagementTypes";

interface Props {
    intention: DailyIntention;
}

export function DailyIntentionCard({ intention: initialIntention }: Props) {
    const [intention, setIntention] = useState(initialIntention);

    // Update local state if prop changes (e.g. after refresh)
    if (initialIntention.id !== intention.id && initialIntention.content !== intention.content) {
        setIntention(initialIntention);
    }

    return (
        <div className="mb-6 rounded-2xl border border-app-border bg-app-card p-5 text-center shadow-sm relative group">
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-app-muted">
                Daily Intention
            </h3>
            <p className="mb-4 text-sm font-medium leading-relaxed text-app-main font-serif italic">
                “{intention.content}”
            </p>
        </div>
    );
}
