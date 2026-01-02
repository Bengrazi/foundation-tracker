"use client";

import React from "react";

interface GoldStreakCounterProps {
    count: number;
}

export function GoldStreakCounter({ count }: GoldStreakCounterProps) {
    return (
        <div className="flex flex-col items-center justify-center py-6">
            <div className="relative flex items-center justify-center">
                {/* Simple, grounded visual - maybe a glow if high streak */}
                <span className="text-6xl font-bold text-app-accent tracking-tighter shadow-sm">
                    {count}
                </span>
            </div>
            <span className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-app-muted">
                Gold Streak
            </span>
        </div>
    );
}
