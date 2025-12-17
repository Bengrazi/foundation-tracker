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

// Calculate streak based on logs and foundation schedule
function calculateStreak(foundationId: string, logs: FoundationLog[], endDateStr: string): number {
  const relevantLogs = logs
    .filter(l => l.foundation_id === foundationId && l.completed)
    .sort((a, b) => b.date.localeCompare(a.date)); // Descending

  let streak = 0;
  let checkDate = parseISO(endDateStr);

  // Check up to 100 days back
  for (let i = 0; i < 100; i++) {
    const dateStr = format(checkDate, "yyyy-MM-dd");

    // Find if completed on this date
    const isDone = relevantLogs.some(l => l.date === dateStr);

    // If done, increment. 
    if (isDone) {
      streak++;
    } else {
      // If NOT done, checking if it was today.
      // If today is not done yet, streak isn't broken, just doesn't include today.
      // UNLESS we are checking a past chain.
      if (dateStr === endDateStr) {
        // Today not done, continue to yesterday
      } else {
        // Break streak if miss
        break;
      }
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
    userProfile
  } = useGlobalState();

  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [todaysLogs, setTodaysLogs] = useState<FoundationLog[]>([]);
  const [historyLogs, setHistoryLogs] = useState<FoundationLog[]>([]); // For streak calc
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState("");

  // Streak State
  const [currentGoldStreak, setCurrentGoldStreak] = useState(0);

  // Edit Mode
  const [isEditing, setIsEditing] = useState(false);

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

  // -- Grid Columns Logic --
  const gridClass = useMemo(() => {
    // Check user profile text size
    const size = userProfile?.text_size || "small";
    if (size === "large" || size === "xl") {
      return "grid-cols-2";
    }
    return "grid-cols-3";
  }, [userProfile]);

  // -- Logs & Streak --
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoadingLogs(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Logs for Today (Fast)
      const { data: todayData } = await supabase
        .from("foundation_logs")
        .select("*")
        .eq("date", selectedDate)
        .eq("completed", true);

      // 2. Logs for History (last 90 days) for streaks
      const startHistoryParams = format(subDays(new Date(), 90), "yyyy-MM-dd");
      const { data: histData } = await supabase
        .from("foundation_logs")
        .select("*")
        .gte("date", startHistoryParams)
        .eq("completed", true);

      // 3. Best Gold Streak
      const { data: streakData } = await supabase
        .from("celebrations")
        .select("streak_days")
        .eq("type", "gold_streak")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!cancelled) {
        if (todayData) setTodaysLogs(todayData as FoundationLog[]);
        if (histData) setHistoryLogs(histData as FoundationLog[]);
        if (streakData) setCurrentGoldStreak(streakData.streak_days);
        setLoadingLogs(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [selectedDate, globalFoundations]);

  // -- Gold Streak Status --
  const isGoldComplete = useMemo(() => {
    if (todaysFoundations.length === 0) return false;

    return todaysFoundations.every(f => {
      const required = f.times_per_day || 1;
      const count = todaysLogs.filter(l => l.foundation_id === f.id).length;
      return count >= required;
    });
  }, [todaysFoundations, todaysLogs]);

  const handleBubbleToggle = async (foundation: Foundation, index: number) => {
    if (isEditing) return;

    const currentLogs = todaysLogs.filter(l => l.foundation_id === foundation.id);
    const completionCount = currentLogs.length;

    const isCompleted = completionCount > index;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (isCompleted) {
      // Remove
      const logToRemove = currentLogs[0];
      if (!logToRemove) return;
      setTodaysLogs(prev => prev.filter(l => l.id !== logToRemove.id));
      // Also update history logs for streak consistency on live toggle
      setHistoryLogs(prev => prev.filter(l => l.id !== logToRemove.id));
      await supabase.from("foundation_logs").delete().eq("id", logToRemove.id);
    } else {
      // Add
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

        // Check Gold Streak (Live)
        const updatedLogs = [...todaysLogs, newLog];
        const allDone = todaysFoundations.every(f => {
          const req = f.times_per_day || 1;
          const cnt = updatedLogs.filter(l => l.foundation_id === f.id).length;
          return cnt >= req;
        });

        if (allDone && !isGoldComplete) {
          // Celebration
          setCelebrationMessage("Gold Streak Achieved! Discipline is destiny.");
          setShowCelebration(true);
          // Optimistically increment streak for display
          setCurrentGoldStreak(prev => prev + 1);
        }
      }
    }
  };

  const bubbles = useMemo(() => {
    const list: any[] = [];
    const today = format(new Date(), "yyyy-MM-dd");

    todaysFoundations.forEach(f => {
      const times = f.times_per_day || 1;
      // Calculate streak
      const streak = calculateStreak(f.id, historyLogs, today);

      for (let i = 0; i < times; i++) {
        list.push({ foundation: f, index: i, streak });
      }
    });
    return list;
  }, [todaysFoundations, historyLogs]);

  return (
    <div className="min-h-screen bg-app-main text-app-main pb-24 transition-colors duration-500">
      <AuthGuardHeader />

      {showCelebration && (
        <CelebrationModal
          message={celebrationMessage}
          onClose={() => setShowCelebration(false)}
        />
      )}

      <main className="mx-auto max-w-md px-6 pt-6 relative">
        {/* Top Actions */}
        <div className="absolute top-4 right-4 flex gap-4 items-center">
          {/* Gold Streak Counter */}
          <div className="flex items-center gap-1 text-yellow-600">
            <span className="text-lg">🏆</span>
            <span className="text-xs font-bold">{currentGoldStreak}</span>
          </div>

          <button
            onClick={() => router.push("/reflect")}
            className="text-xs text-app-muted hover:text-app-main underline"
          >
            Journal
          </button>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`text-xs ${isEditing ? "text-app-accent font-bold" : "text-app-muted hover:text-app-main"}`}
          >
            {isEditing ? "Done" : "Manage"}
          </button>
        </div>

        {/* Header */}
        <header className="mb-8 text-center pt-8">
          <p className="text-[10px] text-app-muted uppercase tracking-widest mb-2 font-semibold">
            {format(parseISO(selectedDate), "EEEE, MMMM d")}
          </p>
          <h1 className="text-xl md:text-2xl font-serif italic text-app-main leading-relaxed px-4">
            &ldquo;{dailyIntention?.content || "Discipline is the bridge between goals and accomplishment."}&rdquo;
          </h1>
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
            <div className="flex justify-center mb-10">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-app-card border border-app-border rounded-full px-4 py-1 text-xs text-app-muted focus:text-app-main focus:outline-none"
              />
            </div>

            {/* Habit Grid */}
            <section className={`grid gap-6 place-items-center ${gridClass}`}>
              {bubbles.map(({ foundation, index, streak }) => {
                const logsForHabit = todaysLogs.filter(l => l.foundation_id === foundation.id);
                const completed = logsForHabit.length > index;

                // "Gold Ready" logic 
                const totalNeeds = bubbles.length;
                const validLogs = todaysLogs.length;
                const isGoldReady = (validLogs === totalNeeds - 1) && !completed;

                // Visual Gold State
                const goldAll = isGoldComplete && isSameDay(parseISO(selectedDate), new Date());

                return (
                  <div key={`${foundation.id}-${index}`} className="w-full flex justify-center">
                    <HabitBubble
                      id={foundation.id}
                      title={foundation.title}
                      completed={completed}
                      streak={streak}
                      isGoldReady={isGoldReady}
                      isGoldState={goldAll}
                      onToggle={() => handleBubbleToggle(foundation, index)}
                      onLongPress={() => setIsEditing(true)}
                    />
                  </div>
                );
              })}
            </section>

            {bubbles.length === 0 && (
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
