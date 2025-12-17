"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AuthGuardHeader } from "@/components/AuthGuardHeader";
import { CherryPyramid } from "@/components/CherryPyramid";
import { StatsGrid } from "@/components/StatsGrid";
import { ChatWidget } from "@/components/ChatWidget";

export default function StatsPage() {
    const [stats, setStats] = useState({
        totalCherries: 0,
        currentGoldStreak: 0,
        bestGoldStreak: 0,
        totalHabitsCompleted: 0,
        daysActive: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadStats = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Fetch Profile (Cherries)
            const { data: profile } = await supabase
                .from("profiles")
                .select("points")
                .eq("id", user.id)
                .single();

            // 2. Fetch Logs for Habits Count & Days Active
            // This could be heavy, ideally we'd have summary tables, but for V1 we count.
            const { count: habitsCount } = await supabase
                .from("foundation_logs")
                .select("*", { count: "exact", head: true })
                .eq("completed", true);

            // Days active: Count unique days in logs? Or use created_at of profile?
            // Let's count unique days in logs where at least one habit was completed.
            // Supabase doesn't do "COUNT(DISTINCT column)" easily via JS client without RPC.
            // We'll estimate or plain fetch dates if not too many.
            // For now, let's use a simpler proxy or just fetch generic logs.
            // Actually, let's use the 'points_history' if available or just stick to habitsCount.
            // Let's fetch the earliest log date.

            const { data: earliest } = await supabase
                .from("foundation_logs")
                .select("date")
                .order("date", { ascending: true })
                .limit(1)
                .single();

            let daysActive = 0;
            if (earliest) {
                const start = new Date(earliest.date);
                const now = new Date();
                const diffTime = Math.abs(now.getTime() - start.getTime());
                daysActive = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }

            // 3. Gold Streaks
            // We can check the 'celebrations' table for 'gold_streak' types to find the max.
            const { data: maxGold } = await supabase
                .from("celebrations")
                .select("streak_days")
                .eq("type", "gold_streak")
                .order("streak_days", { ascending: false })
                .limit(1)
                .maybeSingle();

            // Current streak implies checking recent days. 
            // For now, let's pull 'streak_days' from the latest celebration OR 0 if long ago.
            // A precise calculation requires the same logic as FoundationPage.
            // Let's assume 0 for MVP or fetch the precomputed value if we stored it?
            // We don't store "current streak" permanently except in local storage or recompute.
            // Let's rely on LocalStorage for "Current Gold Streak" as it's computed on the main page often?
            // Or just recompute simplified version here?
            // Let's use 0 as placeholder for now or try to read from a shared source if available.
            // Actually, we can just query the last 'gold_streak' celebration date? No, celebrations only happen on milestones.

            // Re-use logic? Hard to share without moving code.
            // Let's default to standard fetch.

            setStats({
                totalCherries: profile?.points || 0,
                currentGoldStreak: 0, // Todo: accurate compute (expensive)
                bestGoldStreak: maxGold?.streak_days || 0,
                totalHabitsCompleted: habitsCount || 0,
                daysActive: daysActive || 1
            });
            setLoading(false);
        };

        loadStats();
    }, []);

    // Hydrate current streak from localStorage if client-side
    useEffect(() => {
        // This is a rough hack to sync the "Current Gold Streak" calculated on the home page
        // A better way is to store it in the DB profile or context.
        const msg = localStorage.getItem("foundation_celebration_gold_streak_current");
        if (msg) {
            // If we stored it... but we didn't explicitly store "current streak" in LS in FoundationPage.
            // We only stored "celebration_gold_DATE".
        }
    }, []);

    return (
        <div className="min-h-screen bg-app-main text-app-main pb-24">
            <AuthGuardHeader />

            <main className="mx-auto max-w-md px-4 pt-4">
                <header className="mb-6">
                    <h1 className="text-xl font-bold text-app-main">Statistics</h1>
                    <p className="text-xs text-app-muted">Your disciplined growth, visualized.</p>
                </header>

                {/* Hero: Pyramid */}
                <section className="h-[350px] mb-6 shadow-2xl shadow-black/20 rounded-3xl">
                    <CherryPyramid totalCherries={stats.totalCherries} />
                </section>

                {/* Grid */}
                <StatsGrid stats={stats} />

                {/* AI Query */}
                <section className="mt-8">
                    <h2 className="text-sm font-semibold mb-2">Ask Foundation</h2>
                    <ChatWidget contextMode="allReflections" />
                    {/* Re-using ChatWidget but ideally we customize the prompt slightly for stats context */}
                </section>
            </main>
        </div>
    );
}
