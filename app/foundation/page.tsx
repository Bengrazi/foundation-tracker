"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO, isSameDay } from "date-fns";
import { useGlobalState } from "@/components/GlobalStateProvider";
import { AuthGuardHeader } from "@/components/AuthGuardHeader";
import { supabase } from "@/lib/supabaseClient";
import { applySavedTextSize } from "@/lib/textSize";
import { applySavedTheme } from "@/lib/theme";
import { CelebrationModal } from "@/components/CelebrationModal";
import { Foundation } from "@/lib/engagementTypes";
import { awardPoints, POINTS } from "@/lib/points";
import { HabitBubble } from "@/components/HabitBubble";
import { OnboardingInterest } from "@/components/OnboardingInterest";

// --- Types ---
type FoundationLog = {
  id: string;
  foundation_id: string;
  date: string; // "yyyy-MM-dd"
  completed: boolean;
};

// --- Helpers ---
function getDayName(dateStr: string) {
  // "Mon", "Tue", etc.
  return format(parseISO(dateStr), "eee");
}

function matchesSpecificDays(days: string[] | null | undefined, dateStr: string) {
  if (!days || days.length === 0) return true; // Default to every day if not set (migration safety)
  const dayName = getDayName(dateStr);
  return days.includes(dayName);
}

export default function FoundationPage() {
  const {
    foundations: globalFoundations,
    dailyIntention,
    refreshFoundations,
    loading: globalLoading
  } = useGlobalState();

  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // -- Computed Foundations --
  const todaysFoundations = useMemo(() => {
    return globalFoundations.filter(f => {
      // 1. Date Range
      if (selectedDate < f.start_date) return false;
      if (f.end_date && selectedDate > f.end_date) return false;

      // 2. Schedule
      // Use new 'days_of_week' column logic
      // Fallback to old schedule_type if days_of_week is null?
      // PRD says: "Explicit days of the week selection". 
      // If we are pivoting, existing data might need migration or we treat "Daily" as matching all.
      // Let's assume the GlobalState provider or DB migration sets default days_of_week for existing rows.
      // If not, we map old 'daily' to all days for safety here.

      const days = (f as any).days_of_week; // Cast as any because TS might not see new column yet
      if (days && Array.isArray(days)) {
        return matchesSpecificDays(days, selectedDate);
      }

      // Fallback for legacy data without days_of_week set yet
      return true;
    }).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  }, [globalFoundations, selectedDate]);

  // -- Logs --
  const [logs, setLogs] = useState<FoundationLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [points, setPoints] = useState(0);

  // -- Celebration --
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState("");

  // -- Interaction Logic --

  // Load Logs
  useEffect(() => {
    let cancelled = false;
    const loadLogs = async () => {
      setLoadingLogs(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch logs
      const { data, error } = await supabase
        .from("foundation_logs")
        .select("*")
        .eq("date", selectedDate)
        .eq("completed", true); // Only care about completed logs

      if (!cancelled && data) {
        setLogs(data as FoundationLog[]);
        setLoadingLogs(false);
      }
    };

    loadLogs();
    return () => { cancelled = true; };
  }, [selectedDate, globalFoundations]); // Reload if foundations change

  // Check Gold Streak status
  const isGoldComplete = useMemo(() => {
    if (todaysFoundations.length === 0) return false;

    // Check if EVERY foundation has enough logs
    return todaysFoundations.every(f => {
      const required = (f as any).times_per_day || 1;
      const count = logs.filter(l => l.foundation_id === f.id).length;
      return count >= required;
    });
  }, [todaysFoundations, logs]);

  const handleBubbleToggle = async (foundation: Foundation, index: number) => {
    // Find logs for this foundation
    const currentLogs = logs.filter(l => l.foundation_id === foundation.id);
    const completionCount = currentLogs.length;

    // index is 0-based. 
    // 1st bubble (index 0) requires 1 log.
    // If completedCount > index, this bubble is ON.
    // Toggling:
    // If ON: Remove a log (preferably the last one added).
    // If OFF: Add a log.

    const isCompleted = completionCount > index;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (isCompleted) {
      // Remove one log.
      // Simplest is to remove any log for this foundation/date.
      // Ideally the most recent one.
      const logToRemove = currentLogs[0]; // Just pick one
      if (!logToRemove) return;

      // Optimistic
      setLogs(prev => prev.filter(l => l.id !== logToRemove.id));

      await supabase.from("foundation_logs").delete().eq("id", logToRemove.id);

    } else {
      // Add a log
      // Check if we already have enough? (Shouldn't happen if UI allows clicking empty bubble)
      // Optimistic
      const tempId = `temp-${Date.now()}`;
      const newLog = {
        id: tempId,
        foundation_id: foundation.id,
        date: selectedDate,
        completed: true
      };

      setLogs(prev => [...prev, newLog]);

      const { data, error } = await supabase.from("foundation_logs").insert({
        foundation_id: foundation.id,
        date: selectedDate,
        completed: true
      }).select().single();

      if (data) {
        setLogs(prev => prev.map(l => l.id === tempId ? (data as FoundationLog) : l));

        // Points & Celebration Checks
        await awardPoints(user.id, POINTS.HABIT_COMPLETION, "habit_completion", foundation.id);

        // Check Gold Streak (Live)
        // We need to re-verify based on the NEW state including this log
        // Since state update is async, we simulate:
        const updatedLogs = [...logs, newLog];
        const allDone = todaysFoundations.every(f => {
          const req = (f as any).times_per_day || 1;
          const cnt = updatedLogs.filter(l => l.foundation_id === f.id).length;
          return cnt >= req;
        });

        if (allDone && !isGoldComplete) {
          // Trigger Gold Celebration!
          // (Simplified logic: always show if we just hit it)
          setCelebrationMessage("Gold Streak Achieved! Discipline is destiny.");
          setShowCelebration(true);
          // Award Bonus?
        }
      }
    }
  };

  // Render Bubbles
  // We flatten the list: foundations * times_per_day
  const bubbles = useMemo(() => {
    const list: any[] = [];
    todaysFoundations.forEach(f => {
      const times = (f as any).times_per_day || 1;
      for (let i = 0; i < times; i++) {
        list.push({ foundation: f, index: i });
      }
    });
    return list;
  }, [todaysFoundations]);

  return (
    <div className="min-h-screen bg-app-main text-app-main pb-24 transition-colors duration-500">
      <AuthGuardHeader />

      {/* Celebration Modal */}
      {showCelebration && (
        <CelebrationModal
          message={celebrationMessage}
          onClose={() => setShowCelebration(false)}
        />
      )}

      <main className="mx-auto max-w-md px-6 pt-6">
        {/* Header / Intention */}
        <header className="mb-8 text-center">
          <p className="text-[10px] text-app-muted uppercase tracking-widest mb-2 font-semibold">
            {format(parseISO(selectedDate), "EEEE, MMMM d")}
          </p>
          <h1 className="text-xl md:text-2xl font-serif italic text-app-main leading-relaxed px-4">
            &ldquo;{dailyIntention?.content || "Discipline is the bridge between goals and accomplishment."}&rdquo;
          </h1>
        </header>

        {/* Date Nav (Simplified) */}
        <div className="flex justify-center mb-10">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-app-card border border-app-border rounded-full px-4 py-1 text-xs text-app-muted focus:text-app-main focus:outline-none"
          />
        </div>

        {/* Habit Grid */}
        <section className="grid grid-cols-3 gap-6 place-items-center">
          {bubbles.map(({ foundation, index }) => {
            const logsForHabit = logs.filter(l => l.foundation_id === foundation.id);
            const completed = logsForHabit.length > index;

            // Logic for "Gold Ready" (Last bubble needed?)
            const totalBubbles = bubbles.length;
            const totalFinished = logs.length; // Approximate
            const isLast = (totalFinished === totalBubbles - 1) && !completed;

            return (
              <div key={`${foundation.id}-${index}`} className="w-full flex justify-center">
                <HabitBubble
                  id={foundation.id}
                  title={foundation.title}
                  completed={completed}
                  isGoldReady={isLast}
                  onToggle={() => handleBubbleToggle(foundation, index)}
                  onLongPress={() => alert(`Long Press Info: ${foundation.title}`)} // Placeholder
                />
              </div>
            );
          })}
        </section>

        {bubbles.length === 0 && (
          <div className="text-center text-app-muted text-sm mt-10">
            <p>No habits scheduled for today.</p>
            <p className="text-xs mt-2">Check Settings to configure your schedule.</p>
          </div>
        )}
      </main>
    </div>
  );
}
