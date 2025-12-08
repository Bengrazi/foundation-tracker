"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import { DailyIntention, Goal, UserProfile } from "@/lib/engagementTypes";

interface GlobalState {
    points: number;
    dailyIntention: DailyIntention | null;
    dailyQuestion: string | null;
    goals: Goal[];
    userProfile: UserProfile | null;
    refreshPoints: () => Promise<void>;
    refreshQuestion: () => Promise<void>;
    refreshIntention: () => Promise<void>;
    refreshGoals: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    loading: boolean;
}

const GlobalContext = createContext<GlobalState>({
    points: 0,
    dailyIntention: null,
    dailyQuestion: null,
    goals: [],
    userProfile: null,
    refreshPoints: async () => { },
    refreshQuestion: async () => { },
    refreshIntention: async () => { },
    refreshGoals: async () => { },
    refreshProfile: async () => { },
    loading: true,
});

export function useGlobalState() {
    return useContext(GlobalContext);
}

export function GlobalStateProvider({ children }: { children: ReactNode }) {
    const [points, setPoints] = useState(0);
    const [dailyIntention, setDailyIntention] = useState<DailyIntention | null>(null);
    const [dailyQuestion, setDailyQuestion] = useState<string | null>(null);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // Initial load
    useEffect(() => {
        async function loadAll() {
            setLoading(true);
            await Promise.all([
                refreshPoints(),
                refreshIntention(),
                refreshQuestion(),
                refreshGoals(),
                refreshProfile()
            ]);
            setLoading(false);
        }
        loadAll();
    }, []);

    async function refreshPoints() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from("profiles")
            .select("points")
            .eq("id", user.id)
            .single();

        if (data) setPoints(data.points || 0);
    }

    async function refreshIntention() {
        const today = format(new Date(), "yyyy-MM-dd");
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            const res = await fetch(`/api/intention?date=${today}`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setDailyIntention(data);
            }
        } catch (e) {
            console.error("Failed to fetch intention", e);
        }
    }

    async function refreshQuestion() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            // Use our new persistent API
            const res = await fetch("/api/daily-question", {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setDailyQuestion(data.question);
            }
        } catch (e) {
            console.error("Failed to fetch question", e);
        }
    }

    async function refreshGoals() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from("goals")
            .select("*")
            .eq("user_id", user.id)
            .order("order_index", { ascending: true });

        if (!error && data) {
            setGoals(data as Goal[]);
        }
    }

    async function refreshProfile() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

        if (!error && data) {
            setUserProfile(data as UserProfile);
        }
    }

    return (
        <GlobalContext.Provider
            value={{
                points,
                dailyIntention,
                dailyQuestion,
                goals,
                userProfile,
                refreshPoints,
                refreshQuestion,
                refreshIntention,
                refreshGoals,
                refreshProfile,
                loading,
            }}
        >
            {children}
        </GlobalContext.Provider>
    );
}
