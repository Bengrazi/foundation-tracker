"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO, isSameDay } from "date-fns";
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

export default function FoundationPage() {
  const router = useRouter();
  const {
    foundations: globalFoundations,
    dailyIntention,
    refreshFoundations,
    refreshPoints
  } = useGlobalState();

  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [logs, setLogs] = useState<FoundationLog[]>([]);
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

  // -- Logs & Streak --
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoadingLogs(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Logs
      const { data: logsData } = await supabase
        .from("foundation_logs")
        .select("*")
        .eq("date", selectedDate)
        .eq("completed", true);

      // 2. Streak (Best effort fetch - look for latest celebration)
      // Ideally we store this on profile, but for now we query the latest "gold_streak" celebration
      const { data: streakData } = await supabase
        .from("celebrations")
        .select("streak_days")
        .eq("type", "gold_streak")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!cancelled) {
        if (logsData) setLogs(logsData as FoundationLog[]);
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
      const count = logs.filter(l => l.foundation_id === f.id).length;
      return count >= required;
    });
  }, [todaysFoundations, logs]);

  const handleBubbleToggle = async (foundation: Foundation, index: number) => {
    if (isEditing) return;

    const currentLogs = logs.filter(l => l.foundation_id === foundation.id);
    const completionCount = currentLogs.length;

    const isCompleted = completionCount > index;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (isCompleted) {
      // Remove
      const logToRemove = currentLogs[0];
      if (!logToRemove) return;
      setLogs(prev => prev.filter(l => l.id !== logToRemove.id));
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

      setLogs(prev => [...prev, newLog]);

      const { data } = await supabase.from("foundation_logs").insert({
        foundation_id: foundation.id,
        date: selectedDate,
        completed: true
      }).select().single();

      if (data) {
        setLogs(prev => prev.map(l => l.id === tempId ? (data as FoundationLog) : l));
        await awardPoints(user.id, POINTS.HABIT_COMPLETION, "habit_completion", foundation.id);
        await refreshPoints();

        // Check Gold Streak (Live)
        const updatedLogs = [...logs, newLog];
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
    todaysFoundations.forEach(f => {
      const times = f.times_per_day || 1;
      for (let i = 0; i < times; i++) {
        list.push({ foundation: f, index: i });
      }
    });
    return list;
  }, [todaysFoundations]);

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
          {/* Gold Streak Counter (New Request) */}
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

          {/* Banner Removed per user request */}
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
            <section className="grid grid-cols-3 gap-6 place-items-center data-[text-size='large']:grid-cols-2 data-[text-size='xl']:grid-cols-2">
              {bubbles.map(({ foundation, index }) => {
                const logsForHabit = logs.filter(l => l.foundation_id === foundation.id);
                const completed = logsForHabit.length > index;

                // "Gold Ready" logic 
                const totalNeeds = bubbles.length;
                const validLogs = logs.length;
                const isGoldReady = (validLogs === totalNeeds - 1) && !completed;

                // Visual Gold State - All turn gold when streak is complete
                const goldAll = isGoldComplete && isSameDay(parseISO(selectedDate), new Date());

                return (
                  <div key={`${foundation.id}-${index}`} className="w-full flex justify-center">
                    <HabitBubble
                      id={foundation.id}
                      title={foundation.title}
                      completed={completed}
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
