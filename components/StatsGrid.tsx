"use client";

import { useMemo } from "react";
import { format } from "date-fns";

type StatsData = {
    totalCherries: number;
    currentGoldStreak: number;
    bestGoldStreak: number;
    totalHabitsCompleted: number;
    daysActive: number;
};

export function StatsGrid({ stats }: { stats: StatsData }) {
    const items = [
        { label: "Longest Gold Streak", value: stats.bestGoldStreak, icon: "🏆", color: "text-yellow-500" },
        { label: "Total Days Tracked", value: stats.daysActive, icon: "📅", color: "text-stone-400" },
        { label: "Habits Completed", value: stats.totalHabitsCompleted, icon: "✅", color: "text-stone-500" },
        // { label: "Current Gold Streak", value: stats.currentGoldStreak, icon: "🔥", color: "text-amber-500" },
    ];

    return (
        <div className="grid grid-cols-2 gap-3 mt-4">
            {items.map((item) => (
                <div key={item.label} className="bg-app-card border border-app-border rounded-xl p-3 flex flex-col items-center justify-center text-center">
                    <span className="text-xl mb-1">{item.icon}</span>
                    <span className={`text-xl font-bold ${item.color}`}>{item.value}</span>
                    <span className="text-[10px] text-app-muted uppercase tracking-wide mt-1">{item.label}</span>
                </div>
            ))}
        </div>
    );
}
