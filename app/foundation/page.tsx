"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO, isSameDay, subDays } from "date-fns";
import { useRouter } from "next/navigation";
import { useGlobalState } from "@/components/GlobalStateProvider";
import { AuthGuardHeader } from "@/components/AuthGuardHeader";
import { supabase } from "@/lib/supabaseClient";
import { CelebrationModal } from "@/components/CelebrationModal";
import { Foundation, Celebration } from "@/lib/engagementTypes";
import { awardPoints, POINTS } from "@/lib/points";
import { HabitBubble } from "@/components/HabitBubble";
import { HabitManager } from "@/components/HabitManager";
import { TEXT_SIZE_KEY, TextSize } from "@/lib/textSize";

// --- Constants ---
const GOLD_MILESTONES = [1, 3, 7, 14, 30, 50, 75, 100, 150, 200, 250, 300, 365, 500, 1000];
const ONBOARDING_KEY = "foundation_onboarding_done_v1";

// --- Types ---
type FoundationLog = {
  id: string;
  foundation_id: string;
  date: string; // "yyyy-MM-dd"
  completed: boolean;
};

// --- Helpers ---
function getDayName(dateStr: string) {
  return format(parseISO(dateStr), "eee");
}

function matchesSpecificDays(days: string[] | null | undefined, dateStr: string) {
  if (!days || days.length === 0) return true; // Default to every day
  const dayName = getDayName(dateStr);
  return days.includes(dayName);
}

function calculateStreak(foundationId: string, logs: FoundationLog[], endDateStr: string): number {
  const relevantLogs = logs
    .filter(l => l.foundation_id === foundationId && l.completed)
    .sort((a, b) => b.date.localeCompare(a.date));

  let streak = 0;
  let checkDate = parseISO(endDateStr);

  for (let i = 0; i < 100; i++) {
    const dateStr = format(checkDate, "yyyy-MM-dd");
    // For this date, did we have logs?
    const count = relevantLogs.filter(l => l.date === dateStr).length;

    if (count > 0) {
      streak++;
    } else {
      if (dateStr !== endDateStr) break;
    }
    checkDate = subDays(checkDate, 1);
  }
  return streak;
}

export default function FoundationPage() {
  const router = useRouter();
  const {
    foundations: globalFoundations,
    dailyIntention,
    refreshFoundations,
    refreshPoints,
    refreshGoals,
    refreshProfile,
    userProfile
  } = useGlobalState();

  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [todaysLogs, setTodaysLogs] = useState<FoundationLog[]>([]);
  const [historyLogs, setHistoryLogs] = useState<FoundationLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState("");

  // Layout State (Sync from LocalStorage for instant updates)
  const [localTextSize, setLocalTextSize] = useState<TextSize>("small");

  // Streak State
  const [currentGoldStreak, setCurrentGoldStreak] = useState(0);

  // Edit Mode
  const [isEditing, setIsEditing] = useState(false);

  // Onboarding State
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [priorities, setPriorities] = useState("");
  const [ideology, setIdeology] = useState("");
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  // -- Computed Foundations --
  const todaysFoundations = useMemo(() => {
    return globalFoundations.filter(f => {
      // 1. Date Range
      if (selectedDate < f.start_date) return false;
      if (f.end_date && selectedDate > f.end_date) return false;

      // 2. Schedule
      const days = f.days_of_week;
      if (days && Array.isArray(days)) {
        return matchesSpecificDays(days, selectedDate);
      }
      return true;
    }).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  }, [globalFoundations, selectedDate]);

  // -- Onboarding Check --
  useEffect(() => {
    if (typeof window !== "undefined") {
      const done = localStorage.getItem(ONBOARDING_KEY);
      if (!done) {
        setShowOnboarding(true);
      }
    }
  }, []);

  // -- Text Size Logic (Prioritize LocalStorage) --
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(TEXT_SIZE_KEY) as TextSize | null;
      if (saved) {
        setLocalTextSize(saved);
      } else if (userProfile?.text_size) {
        setLocalTextSize(userProfile.text_size as TextSize);
      }
    }
  }, [userProfile]); // Check on mount and if profile loads

  const textSizeClass = useMemo(() => {
    const size = localTextSize || "small";
    switch (size) {
      case "xl": return "text-lg"; // Bubbles text will inherit or scale relative
      case "large": return "text-base";
      case "medium": return "text-sm";
      default: return "text-xs";
    }
  }, [localTextSize]);

  const gridClass = useMemo(() => {
    const size = localTextSize || "small";
    if (size === "large" || size === "xl") {
      return "grid-cols-2";
    }
    return "grid-cols-3";
  }, [localTextSize]);

  // -- Logs & Streak --
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoadingLogs(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: todayData } = await supabase
        .from("foundation_logs")
        .select("*")
        .eq("date", selectedDate)
        .eq("completed", true);

      const startHistoryParams = format(subDays(new Date(), 90), "yyyy-MM-dd");
      const { data: histData } = await supabase
        .from("foundation_logs")
        .select("*")
        .gte("date", startHistoryParams)
        .eq("completed", true);

      if (!cancelled) {
        if (todayData) setTodaysLogs(todayData as FoundationLog[]);
        if (histData) setHistoryLogs(histData as FoundationLog[]);

        // Load Streak from Profile
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        if (profile) {
          const todayStr = format(new Date(), "yyyy-MM-dd");
          const yesterdayStr = format(subDays(new Date(), 1), "yyyy-MM-dd");

          // Check if broken
          let streak = profile.current_gold_streak || 0;
          const lastDate = profile.last_gold_date;

          // If last completed date is not today AND not yesterday, streak is broken -> 0
          // Unless streak is 0, in which case it stays 0
          if (streak > 0 && lastDate !== todayStr && lastDate !== yesterdayStr) {
            streak = 0;
            // We could update DB here to reset 0, but UI display is enough for now
          }
          setCurrentGoldStreak(streak);
        }
        setLoadingLogs(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [selectedDate, globalFoundations]);

  // -- Gold Streak Status (ALL habits fully complete) --
  const isGoldComplete = useMemo(() => {
    if (todaysFoundations.length === 0) return false;

    return todaysFoundations.every(f => {
      const required = f.times_per_day || 1;
      const count = todaysLogs.filter(l => l.foundation_id === f.id).length;
      return count >= required;
    });
  }, [todaysFoundations, todaysLogs]);

  // -- Toggle Logic: Fill ONE segment at a time --
  const handleBubbleClick = async (foundation: Foundation, currentCount: number, targetCount: number) => {
    if (isEditing) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (currentCount < targetCount) {
      // ADD LOG
      const tempId = `temp-${Date.now()}`;
      const newLog = {
        id: tempId,
        foundation_id: foundation.id,
        date: selectedDate,
        completed: true
      };

      setTodaysLogs(prev => [...prev, newLog]);
      setHistoryLogs(prev => [...prev, newLog]);

      const { data } = await supabase.from("foundation_logs").insert({
        foundation_id: foundation.id,
        date: selectedDate,
        completed: true
      }).select().single();

      if (data) {
        const realLog = data as FoundationLog;
        setTodaysLogs(prev => prev.map(l => l.id === tempId ? realLog : l));
        setHistoryLogs(prev => prev.map(l => l.id === tempId ? realLog : l));

        await awardPoints(user.id, POINTS.HABIT_COMPLETION, "habit_completion", foundation.id);
        await refreshPoints();

        // Check Gold Streak achievement
        const updatedLogs = [...todaysLogs, newLog];
        const allDone = todaysFoundations.every(f => {
          const req = f.times_per_day || 1;
          const cnt = updatedLogs.filter(l => l.foundation_id === f.id).length;
          return cnt >= req;
        });

        // Updated Gold Streak with Persistence Logic
        if (allDone && !isGoldComplete) {
          const todayStr = format(new Date(), "yyyy-MM-dd");

          // Optimistic update
          let newStreak = (userProfile?.current_gold_streak || 0) + 1;

          // Redundant safety check: if already recorded today, don't double count
          if (userProfile?.last_gold_date === todayStr) {
            newStreak = userProfile.current_gold_streak || 0;
          }

          setCurrentGoldStreak(newStreak);

          // Update DB
          await supabase.from("profiles").update({
            current_gold_streak: newStreak,
            last_gold_date: todayStr,
            best_gold_streak: Math.max(newStreak, userProfile?.best_gold_streak || 0)
          }).eq("id", user.id);

          // Refresh global state
          await refreshProfile();

          // Milestone Celebration
          if (GOLD_MILESTONES.includes(newStreak)) {
            setCelebrationMessage("Gold Streak Achieved! Discipline is destiny.");
            setShowCelebration(true);
          }
        }
      }
    } else {
      // FULL RESET: Remove ALL logs for this foundation on this date
      const currentLogs = todaysLogs.filter(l => l.foundation_id === foundation.id);

      // Optimistic update
      setTodaysLogs(prev => prev.filter(l => l.foundation_id !== foundation.id));
      setHistoryLogs(prev => prev.filter(l => l.foundation_id !== foundation.id));

      // Batch delete from DB
      const idsToRemove = currentLogs.map(l => l.id);
      if (idsToRemove.length > 0) {
        await supabase.from("foundation_logs").delete().in("id", idsToRemove);
      }
    }
  };

  // -- Onboarding Submit Handler --
  const handleOnboardingSubmit = async () => {
    if (!priorities.trim()) {
      alert("Please fill in your priorities.");
      return;
    }

    setOnboardingLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Call onboarding API
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ priorities, lifeSummary: "", ideology }),
      });

      const data = await res.json();

      // Save to profile
      await supabase.from("profiles").update({
        priorities,
        life_summary: null,
        ideology,
        key_truth: data.keyTruth || null,
        ai_voice: data.aiVoice || null,
      }).eq("id", user.id);

      // Save goals if any
      if (data.goals) {
        const horizons = ["3y", "1y", "6m", "1m"] as const;
        for (const h of horizons) {
          const goalsForHorizon = data.goals[h] || [];
          for (let i = 0; i < goalsForHorizon.length; i++) {
            const g = goalsForHorizon[i];
            await supabase.from("goals").insert({
              user_id: user.id,
              title: g.title,
              horizon: h,
              status: "not_started",
              target_date: format(new Date(), "yyyy-MM-dd"),
              order_index: i * 1000,
            });
          }
        }
      }

      // Mark onboarding as done
      localStorage.setItem(ONBOARDING_KEY, "true");
      setShowOnboarding(false);

      // Refresh data
      await refreshFoundations();
      await refreshPoints();
      await refreshGoals();
    } catch (e) {
      console.error("Onboarding failed:", e);
      alert("Something went wrong. Please try again.");
    } finally {
      setOnboardingLoading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-app-main text-app-main pb-24 transition-colors duration-500 ${textSizeClass}`}>
      <AuthGuardHeader />

      {showCelebration && (
        <CelebrationModal
          message={celebrationMessage}
          onClose={() => setShowCelebration(false)}
        />
      )}

      {/* Onboarding Modal */}
      {showOnboarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-app-card rounded-3xl p-6 shadow-2xl border border-app-border space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="text-center">
              <h2 className="text-xl font-bold text-app-main">Welcome to Cherry 🍒</h2>
              <p className="mt-2 text-sm text-app-muted">
                Let&apos;s personalize your experience. Answer a few questions to get started.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-app-main mb-1">
                  What are your top priorities in life right now?
                </label>
                <textarea
                  value={priorities}
                  onChange={(e) => setPriorities(e.target.value)}
                  placeholder="e.g., Building my startup, health, relationships..."
                  className="w-full min-h-[80px] rounded-xl border border-app-border bg-app-input px-3 py-2 text-sm text-app-main placeholder:text-app-muted/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-app-main mb-1">
                  Your worldview or guiding philosophy (optional)
                </label>
                <textarea
                  value={ideology}
                  onChange={(e) => setIdeology(e.target.value)}
                  placeholder="e.g., Stoicism, pragmatic optimism, long-term thinking..."
                  className="w-full min-h-[60px] rounded-xl border border-app-border bg-app-input px-3 py-2 text-sm text-app-main placeholder:text-app-muted/50"
                />
              </div>
            </div>

            <button
              onClick={handleOnboardingSubmit}
              disabled={onboardingLoading}
              className="w-full rounded-full bg-app-accent py-3 text-sm font-bold text-app-accent-text hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {onboardingLoading ? "Setting up..." : "Get Started"}
            </button>

            <button
              onClick={() => {
                localStorage.setItem(ONBOARDING_KEY, "true");
                setShowOnboarding(false);
              }}
              className="w-full text-xs text-app-muted hover:text-app-main transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-md px-6 pt-6 relative">
        {/* Header Area */}
        <header className="mb-2 text-center pt-4">
          <p className="text-[0.65rem] text-app-muted uppercase tracking-widest mb-1 font-semibold">
            {format(parseISO(selectedDate), "EEEE, MMMM d")}
          </p>
          <h1 className="text-lg md:text-xl font-serif italic text-app-main leading-relaxed px-4 mb-4">
            &ldquo;{dailyIntention?.content || "Discipline is the bridge between goals and accomplishment."}&rdquo;
          </h1>

          {/* Controls: Gold Streak & Manage */}
          <div className="flex items-center justify-between px-4 py-2 bg-app-card/50 rounded-xl mb-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              <div className="flex flex-col items-start px-2">
                <span className="text-xs font-bold text-yellow-600">Gold Streak</span>
                <span className="text-lg font-bold leading-none">{currentGoldStreak}</span>
              </div>
            </div>

            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${isEditing
                ? "bg-app-accent text-app-accent-text border-app-accent"
                : "border-app-border text-app-muted hover:text-app-main"
                }`}
            >
              {isEditing ? "Done" : "Manage Habits"}
            </button>
          </div>
        </header>

        {isEditing ? (
          <div className="animate-in fade-in zoom-in duration-300">
            <HabitManager />
            <div className="mt-8 text-center">
              <button
                onClick={() => setIsEditing(false)}
                className="text-sm text-app-accent hover:underline"
              >
                Return to Routine
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Date Nav */}
            <div className="flex justify-center mb-8">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-app-card border border-app-border rounded-full px-4 py-1 text-xs text-app-muted focus:text-app-main focus:outline-none"
              />
            </div>

            {/* Habit Grid */}
            <section className={`grid gap-6 place-items-center ${gridClass}`}>
              {todaysFoundations.map((foundation) => {
                // Calc logic
                const currentCount = todaysLogs.filter(l => l.foundation_id === foundation.id).length;
                const targetCount = foundation.times_per_day || 1;
                const streak = calculateStreak(foundation.id, historyLogs, format(new Date(), "yyyy-MM-dd"));

                // Gold Status Check
                const goldAll = isGoldComplete;

                return (
                  <div key={foundation.id} className="w-full flex justify-center">
                    <HabitBubble
                      id={foundation.id}
                      title={foundation.title}
                      currentCount={currentCount}
                      targetCount={targetCount}
                      streak={streak}
                      isGoldState={goldAll}
                      onToggle={() => handleBubbleClick(foundation, currentCount, targetCount)}
                      onLongPress={() => setIsEditing(true)}
                    />
                  </div>
                );
              })}
            </section>

            {todaysFoundations.length === 0 && (
              <div className="text-center text-app-muted text-sm mt-10">
                <p>No habits scheduled for today.</p>
                <button onClick={() => setIsEditing(true)} className="text-app-accent hover:underline mt-2">
                  Add a habit
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
