"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AuthGuardHeader } from "@/components/AuthGuardHeader";
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
    // We don't block render on loading, but we need initials
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadStats = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                // Should be redirected by AuthGuard, but safety first
                setLoading(false);
                return;
            }

            // 1. Fetch Profile (Cherries)
            const { data: profile } = await supabase
                .from("profiles")
                .select("points")
                .eq("id", user.id)
                .single();

            // 2. Fetch Logs for Habits Count & Days Active
            // Rely on RLS for user filtering to avoid inconsistencies
            const { data: logs, error: logsError } = await supabase
                .from("foundation_logs")
                .select("date, completed");

            if (logsError) {
                console.error("Error fetching logs:", logsError);
            }

            const safeLogs = logs || [];
            // Filter completed just in case, though usually only true exist
            const completedLogs = safeLogs.filter(l => l.completed);

            const totalHabitsCompleted = completedLogs.length;
            const uniqueDays = new Set(completedLogs.map(l => l.date));
            const daysActive = uniqueDays.size;

            // 3. Gold Streak Data
            const { data: latestGold } = await supabase
                .from("celebrations")
                .select("streak_days")
                .eq("type", "gold_streak")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            const { data: maxGold } = await supabase
                .from("celebrations")
                .select("streak_days")
                .eq("type", "gold_streak")
                .order("streak_days", { ascending: false })
                .limit(1)
                .maybeSingle();

            setStats({
                totalCherries: profile?.points || 0,
                currentGoldStreak: latestGold?.streak_days || 0,
                bestGoldStreak: maxGold?.streak_days || 0,
                totalHabitsCompleted,
                daysActive: daysActive || 0
            });
            setLoading(false);
        };

        loadStats();
    }, []);

    return (
        <div className="min-h-screen bg-app-main text-app-main pb-24">
            <AuthGuardHeader />

            <main className="mx-auto max-w-md px-4 pt-4">
                <header className="mb-6">
                    <h1 className="text-xl font-bold text-app-main">Statistics</h1>
                    <p className="text-xs text-app-muted">Your disciplined growth, visualized.</p>
                </header>

                {/* Hero: Total Cherries */}
                <section className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-rose-500 via-red-500 to-red-600 p-6 shadow-2xl shadow-red-500/30">
                    {/* Decorative Background Cherries */}
                    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden opacity-20">
                        <span className="absolute text-6xl -top-2 -left-2 rotate-12">🍒</span>
                        <span className="absolute text-5xl top-4 right-8 -rotate-12">🍒</span>
                        <span className="absolute text-4xl bottom-2 left-12 rotate-45">🍒</span>
                        <span className="absolute text-7xl -bottom-4 -right-4 -rotate-6">🍒</span>
                        <span className="absolute text-3xl top-1/2 left-1/4 rotate-12">🍒</span>
                        <span className="absolute text-4xl top-8 left-1/2 -rotate-45">🍒</span>
                    </div>

                    {/* Content */}
                    <div className="relative z-10 text-center">
                        <p className="text-xs uppercase tracking-widest text-white/80 font-semibold mb-2">
                            Total Cherries Earned
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            <span className="text-5xl">🍒</span>
                            <span className="text-5xl md:text-6xl font-black text-white tracking-tight">
                                {stats.totalCherries.toLocaleString()}
                            </span>
                        </div>
                        <p className="mt-3 text-sm text-white/70">
                            Keep earning cherries by completing habits!
                        </p>
                    </div>
                </section>

                {/* Grid */}
                <StatsGrid stats={stats} />

                {/* AI Query */}
                <section className="mt-8">
                    <h2 className="text-sm font-semibold mb-2">Ask Foundation</h2>
                    <ChatWidget contextMode="allReflections" />
                </section>
            </main>
        </div>
    );
}
