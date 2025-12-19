"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AuthGuardHeader } from "@/components/AuthGuardHeader";
import { CherryPyramid } from "@/components/CherryPyramid";
import { StatsGrid } from "@/components/StatsGrid";
import { ChatWidget } from "@/components/ChatWidget";
import { format, subDays, isSameDay } from "date-fns";

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

            // 2. Fetch Logs for Habits Count & Days Active & Gold Streak Calc
            // We fetch the last 60 days of logs to calculate streak responsibly
            const { data: logs } = await supabase
                .from("foundation_logs")
                .select("date, foundation_id, completed")
                .eq("user_id", user.id)
                .order("date", { ascending: false });

            const safeLogs = logs || [];

            // Calc Total Habits
            const totalHabitsCompleted = safeLogs.filter(l => l.completed).length;

            // Calc Days Active (Unique dates with > 0 completion)
            const uniqueDays = new Set(safeLogs.filter(l => l.completed).map(l => l.date));
            const daysActive = uniqueDays.size;

            // 3. Current Gold Streak Calculation
            // Logic: Check yesterday, then day before... 
            // A day is "Gold" if ALL scheduled habits were completed.
            // But we need to know HOW MANY habits were scheduled per day.
            // Assumption for MVP: If they have logs for a day, check if ALL logs for that day are completed.
            // Wait, if they added a habit recently, old days might have fewer logs. 
            // "All logs for that day" is a decent proxy for "All scheduled habits".

            let streak = 0;
            const logMap = new Map<string, typeof safeLogs>();
            safeLogs.forEach(l => {
                const dayLogs = logMap.get(l.date) || [];
                dayLogs.push(l);
                logMap.set(l.date, dayLogs);
            });

            // Iterate backwards from Yesterday (or Today if completed)
            // Actually, gold streak includes today if today is done. 
            const today = format(new Date(), "yyyy-MM-dd");
            let checkDate = new Date();

            // If today is NOT fully done, we start checking from yesterday.
            // If today IS fully done, streak includes today.
            // Let's check today first.

            const isDayGold = (dateStr: string) => {
                const daysLogs = logMap.get(dateStr);
                if (!daysLogs || daysLogs.length === 0) return false; // No logs = break streak? Or skip? Usually break.
                return daysLogs.every(l => l.completed);
            };

            // Recursively check
            const check = (d: Date) => {
                const dStr = format(d, "yyyy-MM-dd");
                if (isDayGold(dStr)) {
                    streak++;
                    check(subDays(d, 1));
                }
            };

            if (isDayGold(today)) {
                // Today counts!
                streak++;
                check(subDays(checkDate, 1));
            } else {
                // Today not done (yet), start checking yesterday
                check(subDays(checkDate, 1));
            }

            // 4. Max Gold Streak (from Celebrations table)
            const { data: maxGold } = await supabase
                .from("celebrations")
                .select("streak_days")
                .eq("type", "gold_streak")
                .order("streak_days", { ascending: false })
                .limit(1)
                .maybeSingle();

            setStats({
                totalCherries: profile?.points || 0,
                currentGoldStreak: streak,
                bestGoldStreak: Math.max(streak, maxGold?.streak_days || 0),
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
