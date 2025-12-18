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

function calculateStreak(foundationId: string, logs: FoundationLog[], endDateStr: string): number {
  const relevantLogs = logs
    .filter(l => l.foundation_id === foundationId && l.completed)
    .sort((a, b) => b.date.localeCompare(a.date));

  let streak = 0;
  let checkDate = parseISO(endDateStr);

  // Simplistic Streak Check (consecutive days with at least 1 completion)
  // Note: For multi-time habits, this counts "at least once" as maintaining streak?
  // User requested "Gold Streak is accomplished when ALL... are full".
  // But individual streak? Let's assume maintain streak if you did *something* or maybe *everything*?
  // Standard habit trackers usually count "Target Met" as streak. 
  // Let's assume "Target Met" for the streak calculation.

  // We need to know the TARGET for those past days. This is hard because habits change.
  // Simplifying assumption: If you did ANY rep on a past day, it counts? 
  // Or let's try to enforce stricter: You need >=1 log? 
  // Actually, let's stick to "At least one completion" keeps the fire burning for now, to be forgiving.

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
    userProfile
  } = useGlobalState();

  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [todaysLogs, setTodaysLogs] = useState<FoundationLog[]>([]);
  const [historyLogs, setHistoryLogs] = useState<FoundationLog[]>([]);
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

  // -- Text Size Logic --
  const textSizeClass = useMemo(() => {
    const size = userProfile?.text_size || "small";
    switch (size) {
      case "xl": return "text-lg"; // Bubbles text will inherit or scale relative
      case "large": return "text-base";
      case "medium": return "text-sm";
      default: return "text-xs";
    }
  }, [userProfile]);

  const gridClass = useMemo(() => {
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

    // Logic: If not full, ADD log. If full, Remove ALL logs? Or remove last log?
    // Usually "toggle" implies Undo if full.

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

        // Check Gold Streak (Live)
        // We need to check if THIS addition made everything complete
        const updatedLogs = [...todaysLogs, newLog]; // Note: using local var, state might lag slightly implies we should be careful. 
        // Actually state update is async, so `todaysLogs` is old. `updatedLogs` is better.
        // Wait, `updatedLogs` combines old `todaysLogs` + `newLog`. 
        // But `todaysLogs` state update hasn't processed yet? `setTodaysLogs` queues it.
        // So standard closure issue. We trust the local `updatedLogs`.

        const allDone = todaysFoundations.every(f => {
          const req = f.times_per_day || 1;
          const cnt = updatedLogs.filter(l => l.foundation_id === f.id).length;
          return cnt >= req;
        });

        if (allDone && !isGoldComplete) {
          setCelebrationMessage("Gold Streak Achieved! Discipline is destiny.");
          setShowCelebration(true);
          setCurrentGoldStreak(prev => prev + 1);
        }
      }
    } else {
      // REMOVE LAST LOG (Undo)
      const currentLogs = todaysLogs
        .filter(l => l.foundation_id === foundation.id)
        .sort((a, b) => b.id.localeCompare(a.id)); // sort by ID desc roughly

      const logToRemove = currentLogs[0];
      if (logToRemove) {
        setTodaysLogs(prev => prev.filter(l => l.id !== logToRemove.id));
        setHistoryLogs(prev => prev.filter(l => l.id !== logToRemove.id));
        await supabase.from("foundation_logs").delete().eq("id", logToRemove.id);
      }
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

      <main className="mx-auto max-w-md px-6 pt-6 relative">
        {/* Header Area */}
        <header className="mb-4 text-center pt-8">
          <p className="text-[10px] text-app-muted uppercase tracking-widest mb-2 font-semibold">
            {format(parseISO(selectedDate), "EEEE, MMMM d")}
          </p>
          <h1 className="text-xl md:text-2xl font-serif italic text-app-main leading-relaxed px-4 mb-6">
            &ldquo;{dailyIntention?.content || "Discipline is the bridge between goals and accomplishment."}&rdquo;
          </h1>

          {/* Controls: Gold Streak & Manage - Moved HERE */}
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
                const goldAll = isGoldComplete && isSameDay(parseISO(selectedDate), new Date());

                return (
                  <div key={foundation.id} className="w-full flex justify-center">
                    <HabitBubble
                      id={foundation.id}
                      title={foundation.title}
                      currentCount={currentCount}
                      targetCount={targetCount}
                      streak={streak} // Todo: Real streak logic
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
