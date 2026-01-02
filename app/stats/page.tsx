"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AuthGuardHeader } from "@/components/AuthGuardHeader";
import { StatsGrid } from "@/components/StatsGrid";
import { ChatWidget } from "@/components/ChatWidget";
import { BadgeWall } from "@/components/BadgeWall";
import { Badge, UserBadge } from "@/lib/engagementTypes";

export default function StatsPage() {
    const [stats, setStats] = useState({
        totalCherries: 0,
        currentGoldStreak: 0,
        bestGoldStreak: 0,
        totalHabitsCompleted: 0,
        daysActive: 0
    });
    const [badges, setBadges] = useState<Badge[]>([]);
    const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadStats = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            // 1. Fetch Profile
            const { data: profile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single();

            // 2. Fetch Badges
            const { data: allBadges } = await supabase.from("badges").select("*");
            if (allBadges) setBadges(allBadges);

            const { data: myBadges } = await supabase.from("user_badges").select("*").eq("user_id", user.id);
            if (myBadges) setUserBadges(myBadges);

            // 3. Fetch Logs (Basic Stats)
            const { data: logs } = await supabase
                .from("foundation_logs")
                .select("date, completed");

            const safeLogs = logs || [];
            const completedLogs = safeLogs.filter(l => l.completed);
            const totalHabitsCompleted = completedLogs.length;
            const uniqueDays = new Set(completedLogs.map(l => l.date));
            const daysActive = uniqueDays.size;

            // 4. Gold Streak Data
            const todayStr = new Date().toISOString().split('T')[0];
            const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

            let currentStreak = profile?.current_gold_streak || 0;
            const lastDate = profile?.last_gold_date;

            if (currentStreak > 0 && lastDate !== todayStr && lastDate !== yesterdayStr) {
                currentStreak = 0;
            }

            setStats({
                totalCherries: profile?.points || 0,
                currentGoldStreak: currentStreak,
                bestGoldStreak: profile?.best_gold_streak || 0,
                totalHabitsCompleted,
                daysActive: daysActive || 0
            });
            setLoading(false);
        };

        loadStats();
    }, []);

    return (
        <div className="min-h-screen bg-app-main text-app-main pb-24 transition-colors duration-500">
            <AuthGuardHeader />

            <main className="mx-auto max-w-md px-6 pt-6">
                <header className="mb-8">
                    <h1 className="text-2xl font-bold text-app-main tracking-tight">Legacy</h1>
                    <p className="text-xs text-app-muted uppercase tracking-widest mt-1">Proof of Work</p>
                </header>

                {/* Badge Wall */}
                <section className="mb-12">
                    <BadgeWall badges={badges} userBadges={userBadges} />
                </section>

                {/* Secondary Stats */}
                <section className="mb-12">
                    <h2 className="text-sm font-bold text-app-muted uppercase tracking-widest text-center mb-4">
                        Lifetime Stats
                    </h2>
                    <StatsGrid stats={stats} />
                </section>

                {/* AI Query */}
                <section className="mt-8 border-t border-app-border/30 pt-8">
                    <h2 className="text-sm font-semibold mb-4 text-app-muted">Consult the Archives</h2>
                    <ChatWidget contextMode="allReflections" />
                </section>
            </main>
        </div>
    );
}
