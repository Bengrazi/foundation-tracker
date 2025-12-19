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
            const { data: logs } = await supabase
                .from("foundation_logs")
                .select("date, completed")
                .eq("user_id", user.id);

            const safeLogs = logs || [];
            const totalHabitsCompleted = safeLogs.filter(l => l.completed).length;
            const uniqueDays = new Set(safeLogs.filter(l => l.completed).map(l => l.date));
            const daysActive = uniqueDays.size;

            // 3. Gold Streak Data (Matching Foundation Page Logic)
            // Just pull the *latest* gold streak value from celebrations.
            const { data: latestGold } = await supabase
                .from("celebrations")
                .select("streak_days")
                .eq("type", "gold_streak")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            // Also find max for "Best"
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
                </section>
            </main>
        </div>
    );
}
