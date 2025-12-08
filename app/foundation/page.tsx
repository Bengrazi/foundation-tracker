"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { useGlobalState } from "@/components/GlobalStateProvider";
import { AuthGuardHeader } from "@/components/AuthGuardHeader";
import { supabase } from "@/lib/supabaseClient";
import { applySavedTextSize } from "@/lib/textSize";
import { applySavedTheme } from "@/lib/theme";
import { DailyIntentionCard } from "@/components/DailyIntentionCard";
import { CelebrationModal } from "@/components/CelebrationModal";
import { DailyIntention } from "@/lib/engagementTypes";
import { awardPoints, POINTS } from "@/lib/points";
import { OnboardingInterest, InterestSelection } from "@/components/OnboardingInterest";

// ------------- Types -------------

type ScheduleType = "daily" | "weekdays" | "weekly" | "monthly" | "xPerWeek";

type Foundation = {
  id: string;
  title: string;
  schedule_type: ScheduleType;
  x_per_week: number | null;
  start_date: string; // "yyyy-MM-dd"
  end_date: string | null; // null = still active
  user_id: string;
};

type FoundationLog = {
  id: string;
  foundation_id: string;
  date: string; // "yyyy-MM-dd"
  completed: boolean;
  notes: string | null;
};

type LogsByDate = Record<string, FoundationLog[]>;

type OnboardingState = {
  priorities: string;
  lifeSummary: string;
  ideology: string;
};

// ------------- Helpers -------------

const ONBOARDING_KEY = "foundation_onboarding_done_v1";

function dateKey(d: Date | string) {
  if (typeof d === "string") return d;
  return format(d, "yyyy-MM-dd");
}

function isWeekday(dateStr: string) {
  const d = parseISO(dateStr);
  const day = d.getDay(); // 0 = Sun, 6 = Sat
  return day !== 0 && day !== 6;
}

function matchesSchedule(
  schedule: ScheduleType,
  dateStr: string,
  xPerWeek: number | null
) {
  switch (schedule) {
    case "daily":
      return true;
    case "weekdays":
      return isWeekday(dateStr);
    case "weekly":
      return true;
    case "monthly":
      return true;
    case "xPerWeek":
      return (xPerWeek ?? 1) > 0;
    default:
      return true;
  }
}

function groupLogsByDate(logs: FoundationLog[]): LogsByDate {
  const map: LogsByDate = {};
  for (const log of logs) {
    if (!map[log.date]) map[log.date] = [];
    map[log.date].push(log);
  }
  return map;
}

function computeStreakForFoundation(
  foundation: Foundation,
  logsByDate: LogsByDate,
  selectedDate: string,
  maxLookbackDays = 60
) {
  let streak = 0;
  let current = parseISO(selectedDate);

  for (let i = 0; i < maxLookbackDays; i++) {
    const key = dateKey(current);

    if (key < foundation.start_date) break;
    if (foundation.end_date && key > foundation.end_date) break;

    if (!matchesSchedule(foundation.schedule_type, key, foundation.x_per_week)) {
      current = addDays(current, -1);
      continue;
    }

    const logs = logsByDate[key] || [];
    const log = logs.find((l) => l.foundation_id === foundation.id);

    if (log?.completed) {
      streak += 1;
      current = addDays(current, -1);
    } else {
      break;
    }
  }

  return streak;
}

function computeGoldStreak(
  foundations: Foundation[],
  logsByDate: LogsByDate,
  selectedDate: string,
  maxLookbackDays = 60
) {
  if (!foundations.length) return 0;

  let streak = 0;
  let current = parseISO(selectedDate);
  let isFirstDay = true;

  for (let i = 0; i < maxLookbackDays; i++) {
    const key = dateKey(current);

    const activeOnThisDay = foundations.filter((f) => {
      if (key < f.start_date) return false;
      if (f.end_date && key > f.end_date) return false;
      return matchesSchedule(f.schedule_type, key, f.x_per_week);
    });

    if (!activeOnThisDay.length) {
      current = addDays(current, -1);
      continue;
    }

    const logs = logsByDate[key] || [];
    const allDone = activeOnThisDay.every((f) =>
      logs.some((l) => l.foundation_id === f.id && l.completed)
    );

    if (allDone) {
      streak += 1;
      current = addDays(current, -1);
      isFirstDay = false;
    } else {
      if (isFirstDay) {
        current = addDays(current, -1);
        isFirstDay = false;
        continue;
      }
      break;
    }
  }

  return streak;
}

const DEFAULT_FOUNDATIONS: Omit<Foundation, "id" | "start_date" | "end_date" | "user_id">[] =
  [
    {
      title: "Complete A+ Problem",
      schedule_type: "daily",
      x_per_week: null,
    },
    {
      title: "Workout 45+ min",
      schedule_type: "daily",
      x_per_week: null,
    },
    {
      title: "Journal/reflect",
      schedule_type: "daily",
      x_per_week: null,
    },
  ];

// ------------- Component -------------

export default function FoundationPage() {
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );

  const [foundations, setFoundations] = useState<Foundation[]>([]);
  const [logsByDate, setLogsByDate] = useState<LogsByDate>({});
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState(0);

  const [showNewHabitForm, setShowNewHabitForm] = useState(false);
  const [creatingHabit, setCreatingHabit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newSchedule, setNewSchedule] = useState<ScheduleType>("daily");
  const [newXPerWeek, setNewXPerWeek] = useState<number>(3);

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingState>({
    priorities: "",
    lifeSummary: "",
    ideology: "",
  });
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [interestSelection, setInterestSelection] = useState<InterestSelection>({
    habits: true,
    goals: false,
    journal: false,
  });

  const { dailyIntention } = useGlobalState();
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [themeState, setThemeState] = useState<string>("cherry");

  const DEFAULT_INTENTION: DailyIntention = {
    id: "default",
    user_id: "system",
    date: format(new Date(), "yyyy-MM-dd"),
    content: "Focus on the step in front of you.",
    vote: null,
    created_at: new Date().toISOString()
  };

  useEffect(() => {
    applySavedTextSize();
    applySavedTheme();

    // Initialize theme state from localStorage
    if (typeof window !== "undefined") {
      setThemeState(localStorage.getItem("foundation_theme") || "cherry");
    }

    const checkOnboarding = async () => {
      if (typeof window === "undefined") return;
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        setShowOnboarding(true);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("priorities, life_summary")
        .eq("id", auth.user.id)
        .single();

      if (profile && profile.priorities && profile.life_summary) {
        window.localStorage.setItem(ONBOARDING_KEY, "1");
      } else {
        window.localStorage.removeItem(ONBOARDING_KEY);
        setShowOnboarding(true);
      }
    };

    checkOnboarding();

    // Trigger precompute buffer on mount
    const triggerPrecompute = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      fetch("/api/precompute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          check_celebrations: false // Only generate intentions
        }),
      });
    };
    triggerPrecompute();
  }, [selectedDate]);



  // Countdown timer - updates every minute
  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0); // Next midnight

      const diff = midnight.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      return `${hours}h ${minutes}m`;
    };

    // Initial calculation
    setTimeRemaining(calculateTimeRemaining());

    // Update every minute
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("points")
        .eq("id", auth.user.id)
        .single();
      if (profile) {
        setPoints(profile.points ?? 0);
      }

      const { data: fdData, error: fdError } = await supabase
        .from("foundations")
        .select("*")
        .lte("start_date", selectedDate)
        .or(`end_date.is.null,end_date.gte.${selectedDate}`)
        .order("start_date", { ascending: true });

      if (fdError) console.error("Error loading foundations", fdError);

      const foundationsLoaded = (fdData || []) as Foundation[];

      if (!fdError && foundationsLoaded.length === 0) {
        const { count } = await supabase
          .from("foundations")
          .select("*", { count: "exact", head: true })
          .eq("user_id", auth.user.id);

        if (count === 0) {
          const todayKey = dateKey(new Date());
          const inserts = DEFAULT_FOUNDATIONS.map((f) => ({
            ...f,
            user_id: auth.user.id,
            start_date: todayKey,
            end_date: null,
          }));

          const { data: seeded, error: seedError } = await supabase
            .from("foundations")
            .insert(inserts)
            .select("*");

          if (!seedError && seeded) {
            foundationsLoaded.push(...(seeded as Foundation[]));
          }
        }
      }

      const from = format(addDays(parseISO(selectedDate), -60), "yyyy-MM-dd");
      const { data: logsData, error: logsError } = await supabase
        .from("foundation_logs")
        .select("*")
        .gte("date", from)
        .lte("date", selectedDate)
        .order("date", { ascending: true });

      if (logsError) console.error("Error loading foundation logs", logsError);

      if (!cancelled) {
        setFoundations(foundationsLoaded);
        setLogsByDate(groupLogsByDate((logsData || []) as FoundationLog[]));
        setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const logsForSelectedDay = useMemo(
    () => logsByDate[selectedDate] || [],
    [logsByDate, selectedDate]
  );

  const goldStreak = useMemo(
    () => computeGoldStreak(foundations, logsByDate, selectedDate),
    [foundations, logsByDate, selectedDate]
  );

  const streakByFoundationId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of foundations) {
      map[f.id] = computeStreakForFoundation(f, logsByDate, selectedDate);
    }
    return map;
  }, [foundations, logsByDate, selectedDate]);

  const handleMoveFoundation = async (id: string, direction: "up" | "down") => {
    const index = foundations.findIndex((f) => f.id === id);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === foundations.length - 1) return;

    const newFoundations = [...foundations];
    const swapIndex = direction === "up" ? index - 1 : index + 1;

    [newFoundations[index], newFoundations[swapIndex]] = [
      newFoundations[swapIndex],
      newFoundations[index],
    ];
    setFoundations(newFoundations);

    const f1 = newFoundations[index];
    const f2 = newFoundations[swapIndex];

    await supabase.from("foundations").upsert([
      { id: f1.id, order_index: index, title: f1.title, user_id: f1.user_id },
      { id: f2.id, order_index: swapIndex, title: f2.title, user_id: f2.user_id },
    ]);
  };

  const checkCelebration = async (
    foundationId: string,
    habitTitle: string,
    newStreak: number,
    allDone: boolean,
    goldStreak: number,
    selectedDate: string
  ) => {
    const goldMilestones = [1, 3, 7, 14, 30, 60, 90, 100, 365];
    const habitMilestones = [7, 30, 60, 90, 100, 365];

    const savedCoach = localStorage.getItem("foundation_ai_coach_enabled");
    if (savedCoach === "false") return;

    const goldKey = `foundation_celebration_gold_${selectedDate}`;
    const stdKey = `foundation_celebration_std_${selectedDate}`;
    const firstGoldKey = "foundation_first_gold_celebration_shown";

    const goldCount = parseInt(localStorage.getItem(goldKey) || "0", 10);
    const stdCount = parseInt(localStorage.getItem(stdKey) || "0", 10);

    console.log(`[Celebration Check] Date: ${selectedDate}, Gold: ${goldStreak}, Habit: ${newStreak}, AllDone: ${allDone}`);
    console.log(`[Celebration Limits] Gold shown on ${selectedDate}: ${goldCount}, Habit shown on ${selectedDate}: ${stdCount}`);

    let trigger = "";
    let count = 0;
    let isFirstGold = false;

    // 1. Check Gold Streak
    if (allDone) {
      const firstGoldShown = localStorage.getItem(firstGoldKey);
      if (!firstGoldShown) {
        trigger = "gold_streak";
        count = goldStreak;
        isFirstGold = true;
      } else if (goldMilestones.includes(goldStreak) && goldCount < 1) {
        trigger = "gold_streak";
        count = goldStreak;
      }
    }

    // 2. Check Habit Streak
    // Only show habit streak if NO gold streak today AND no other habit streak today
    if (!trigger && habitMilestones.includes(newStreak) && stdCount < 1 && goldCount < 1) {
      trigger = "habit_streak";
      count = newStreak;
    }

    if (trigger) {
      console.log(`[Celebration Triggered] Type: ${trigger}, Count: ${count}, Date: ${selectedDate}`);

      // Update limits
      if (trigger === "gold_streak") {
        localStorage.setItem(goldKey, String(goldCount + 1));
        if (isFirstGold) {
          localStorage.setItem(firstGoldKey, "true");
        }
      } else {
        localStorage.setItem(stdKey, String(stdCount + 1));
      }

      // Fetch celebration from API
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const res = await fetch("/api/celebration", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            type: trigger,
            streak_days: count,
            habit_id: trigger === "habit_streak" ? foundationId : undefined,
            habit_title: habitTitle,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          let msg = data.message;

          // Append points if applicable
          if (trigger === "habit_streak") {
            if (count === 7) msg += ` (+${POINTS.STREAK_BONUS_7} Cherry)`;
            else if (count === 30) msg += ` (+${POINTS.STREAK_BONUS_30} Cherry)`;
          }

          setCelebrationMessage(msg);
          setShowCelebration(true);
        } else {
          console.error("[Celebration Error] API returned:", res.status);
        }
      } catch (e) {
        console.error("Failed to fetch celebration", e);
      }
    }

    // 3. Trigger Precompute (Event-Driven)
    // We do this if allDone is true OR if we just completed a habit
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Calculate all habit streaks for precompute context
        const habitStreaks = foundations.map(f => ({
          id: f.id,
          title: f.title,
          streak: f.id === foundationId ? newStreak : (streakByFoundationId[f.id] || 0)
        }));

        fetch("/api/precompute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            gold_streak: goldStreak,
            habit_streaks: habitStreaks
          }),
        });
      }
    } catch (e) {
      console.error("Precompute trigger failed", e);
    }
  };

  const handleToggleFoundation = async (foundation: Foundation) => {
    const existing = logsForSelectedDay.find(
      (l) => l.foundation_id === foundation.id
    );

    const completed = !(existing?.completed ?? false);

    const nextLogsByDate = { ...logsByDate };
    const dayLogs = [...(nextLogsByDate[selectedDate] || [])];

    if (existing) {
      const idx = dayLogs.findIndex((l) => l.id === existing.id);
      if (idx !== -1) {
        dayLogs[idx] = { ...existing, completed };
      }
    } else {
      dayLogs.push({
        id: `temp-${Date.now()}`,
        foundation_id: foundation.id,
        date: selectedDate,
        completed,
        notes: null,
      });
    }
    nextLogsByDate[selectedDate] = dayLogs;

    setLogsByDate(nextLogsByDate);

    if (completed) {
      const newStreak = computeStreakForFoundation(
        foundation,
        nextLogsByDate,
        selectedDate
      );
      const newGoldStreak = computeGoldStreak(
        foundations,
        nextLogsByDate,
        selectedDate
      );

      const activeToday = foundations.filter((f) => {
        if (selectedDate < f.start_date) return false;
        if (f.end_date && selectedDate > f.end_date) return false;
        return matchesSchedule(f.schedule_type, selectedDate, f.x_per_week);
      });

      const allDone = activeToday.every((f) => {
        const log = dayLogs.find((l) => l.foundation_id === f.id);
        return log?.completed;
      });

      checkCelebration(
        foundation.id,
        foundation.title,
        newStreak,
        allDone,
        newGoldStreak,
        selectedDate
      );

      const triggerCelebration = (msg: string) => {
        setCelebrationMessage(msg);
        setShowCelebration(true);
      };

      // Award Points
      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user) {
        // Base completion points
        const { points: earned } = await awardPoints(auth.user.id, POINTS.HABIT_COMPLETION, "habit_completion", foundation.id);
        if (earned > 0) {
          setPoints((prev) => prev + earned);
          // Only trigger celebration for streaks, not just points
          // triggerCelebration(`+${earned} Cherry!`); 
        }

        // Streak bonuses
        if (newStreak === 7) {
          const { points: bonus } = await awardPoints(auth.user.id, POINTS.STREAK_BONUS_7, "streak_bonus_7", foundation.id);
          if (bonus > 0) setPoints((prev) => prev + bonus);
        }
        if (newStreak === 30) {
          const { points: bonus } = await awardPoints(auth.user.id, POINTS.STREAK_BONUS_30, "streak_bonus_30", foundation.id);
          if (bonus > 0) setPoints((prev) => prev + bonus);
        }
      }
    } else {
      // Deduct points if unchecked
      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user) {
        const deduction = -POINTS.HABIT_COMPLETION;
        const { points: adjusted } = await awardPoints(auth.user.id, deduction, "habit_undo", foundation.id);
        if (adjusted !== 0) {
          setPoints((prev) => prev + adjusted);
        }
      }
    }

    if (existing) {
      await supabase
        .from("foundation_logs")
        .update({ completed })
        .eq("id", existing.id);
    } else {
      const { data, error } = await supabase
        .from("foundation_logs")
        .insert({
          foundation_id: foundation.id,
          date: selectedDate,
          completed,
          notes: null,
        })
        .select("*")
        .single();

      if (!error && data) {
        setLogsByDate((prev) => {
          const currentDayLogs = [...(prev[selectedDate] || [])];
          const tempIdx = currentDayLogs.findIndex((l) =>
            String(l.id).startsWith("temp-")
          );
          if (tempIdx !== -1) {
            currentDayLogs[tempIdx] = data as FoundationLog;
          } else {
            currentDayLogs.push(data as FoundationLog);
          }
          return { ...prev, [selectedDate]: currentDayLogs };
        });
      }
    }
  };

  const handleNotesChange = async (foundation: Foundation, notes: string) => {
    const existing = logsForSelectedDay.find(
      (l) => l.foundation_id === foundation.id
    );

    setLogsByDate((prev) => {
      const dayLogs = [...(prev[selectedDate] || [])];
      if (existing) {
        const idx = dayLogs.findIndex((l) => l.id === existing.id);
        if (idx !== -1) {
          dayLogs[idx] = { ...existing, notes };
        }
      } else {
        dayLogs.push({
          id: `temp-notes-${Date.now()}`,
          foundation_id: foundation.id,
          date: selectedDate,
          completed: false,
          notes,
        });
      }
      return { ...prev, [selectedDate]: dayLogs };
    });

    if (existing) {
      await supabase
        .from("foundation_logs")
        .update({ notes })
        .eq("id", existing.id);
    } else {
      const { data, error } = await supabase
        .from("foundation_logs")
        .insert({
          foundation_id: foundation.id,
          date: selectedDate,
          completed: false,
          notes,
        })
        .select("*")
        .single();

      if (!error && data) {
        setLogsByDate((prev) => {
          const dayLogs = [...(prev[selectedDate] || [])];
          const tempIdx = dayLogs.findIndex((l) =>
            String(l.id).startsWith("temp-notes-")
          );
          if (tempIdx !== -1) {
            dayLogs[tempIdx] = data as FoundationLog;
          } else {
            dayLogs.push(data as FoundationLog);
          }
          return { ...prev, [selectedDate]: dayLogs };
        });
      }
    }
  };

  const handleEditFoundation = (f: Foundation) => {
    setEditingId(f.id);
    setNewTitle(f.title);
    setNewSchedule(f.schedule_type);
    setNewXPerWeek(f.x_per_week || 3);
    setShowNewHabitForm(true);
  };

  const handleSaveFoundation = async () => {
    if (!newTitle.trim()) return;
    setCreatingHabit(true);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      setCreatingHabit(false);
      return;
    }

    if (editingId) {
      // EDIT MODE
      const foundation = foundations.find(f => f.id === editingId);
      if (!foundation) return;

      // Check for past logs
      const yesterday = format(addDays(parseISO(selectedDate), -1), "yyyy-MM-dd");
      const { count } = await supabase
        .from("foundation_logs")
        .select("*", { count: "exact", head: true })
        .eq("foundation_id", editingId)
        .lte("date", yesterday); // Logs before today

      const hasPastLogs = (count || 0) > 0;

      if (hasPastLogs) {
        // End old, create new
        const { error: endError } = await supabase
          .from("foundations")
          .update({ end_date: yesterday })
          .eq("id", editingId);

        if (endError) {
          console.error("Error ending foundation", endError);
          alert("Failed to update habit.");
          setCreatingHabit(false);
          return;
        }

        // Create new
        const { data: newF, error: createError } = await supabase
          .from("foundations")
          .insert({
            user_id: auth.user.id,
            title: newTitle.trim(),
            schedule_type: newSchedule,
            x_per_week: newSchedule === "xPerWeek" ? newXPerWeek : null,
            start_date: selectedDate, // Starts today
            end_date: null,
          })
          .select("*")
          .single();

        if (createError) {
          console.error("Error creating new version", createError);
        } else if (newF) {
          setFoundations(prev => [
            ...prev.filter(f => f.id !== editingId), // Remove old (it ended yesterday)
            newF as Foundation
          ]);
        }
      } else {
        // No past logs, just update in place
        const { data: updatedF, error: updateError } = await supabase
          .from("foundations")
          .update({
            title: newTitle.trim(),
            schedule_type: newSchedule,
            x_per_week: newSchedule === "xPerWeek" ? newXPerWeek : null,
          })
          .eq("id", editingId)
          .select("*")
          .single();

        if (updateError) {
          console.error("Error updating foundation", updateError);
        } else if (updatedF) {
          setFoundations(prev => prev.map(f => f.id === editingId ? (updatedF as Foundation) : f));
        }
      }

      setEditingId(null);
    } else {
      // CREATE MODE
      const insert = {
        user_id: auth.user.id,
        title: newTitle.trim(),
        schedule_type: newSchedule,
        x_per_week: newSchedule === "xPerWeek" ? newXPerWeek : null,
        start_date: selectedDate,
        end_date: null,
      };

      const { data, error } = await supabase
        .from("foundations")
        .insert(insert)
        .select("*")
        .single();

      if (error) {
        console.error("Error creating foundation", error);
        alert(`Error creating habit: ${error.message}`);
      } else if (data) {
        setFoundations((prev) => [...prev, data as Foundation]);
      }
    }

    setCreatingHabit(false);
    setNewTitle("");
    setNewSchedule("daily");
    setNewXPerWeek(3);
    setShowNewHabitForm(false);
  };

  const handleDeleteFoundationFromTodayForward = async (
    foundation: Foundation
  ) => {
    if (!confirm("Are you sure you want to remove this habit?")) return;

    setDeletingId(foundation.id);
    const prevDay = dateKey(addDays(parseISO(selectedDate), -1));

    const { data, error } = await supabase
      .from("foundations")
      .update({ end_date: prevDay })
      .eq("id", foundation.id)
      .select("*")
      .single();

    setDeletingId(null);

    if (error) {
      console.error("Error ending foundation", error);
      alert("Failed to remove habit.");
      return;
    }

    const updated = data as Foundation;

    setFoundations((prev) =>
      prev
        .map((f) => (f.id === updated.id ? updated : f))
        .filter((f) => !f.end_date || f.end_date >= selectedDate)
    );
  };

  const handleOnboardingChange = (field: keyof OnboardingState, value: string) =>
    setOnboarding((prev) => ({ ...prev, [field]: value }));

  const handleOnboardingSubmit = async () => {
    if (!onboarding.priorities.trim()) {
      return;
    }
    // Only check lifeSummary if Goals are selected
    if (interestSelection.goals && !onboarding.lifeSummary.trim()) {
      return;
    }

    setSavingOnboarding(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(onboarding),
      });

      if (!res.ok) throw new Error("Failed to generate onboarding data");

      const data = await res.json();

      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user) {
        await supabase.from("profiles").upsert({
          id: auth.user.id,
          priorities: onboarding.priorities,
          life_summary: onboarding.lifeSummary,
          ideology: onboarding.ideology,
          key_truth: data.keyTruth,
          ai_voice: data.aiVoice,
        });

        if (Array.isArray(data.board)) {
          const members = data.board.map((m: any) => ({
            user_id: auth.user.id,
            name: m.name,
            role: m.role,
            why: m.why,
          }));
          await supabase.from("board_members").insert(members);
        }

        if (data.goals) {
          const goalInserts: any[] = [];
          for (const horizon of ["3y", "1y", "6m", "1m"]) {
            const list = data.goals[horizon];
            if (Array.isArray(list)) {
              list.forEach((g: any) => {
                goalInserts.push({
                  user_id: auth.user.id,
                  title: g.title,
                  horizon,
                  status: "not_started",
                  target_date:
                    horizon === "3y"
                      ? format(addDays(new Date(), 365 * 3), "yyyy-MM-dd")
                      : horizon === "1y"
                        ? format(addDays(new Date(), 365), "yyyy-MM-dd")
                        : horizon === "6m"
                          ? format(addDays(new Date(), 180), "yyyy-MM-dd")
                          : format(addDays(new Date(), 30), "yyyy-MM-dd"),
                  pinned: false,
                });
              });
            }
          }
          if (goalInserts.length > 0) {
            await supabase.from("goals").insert(goalInserts);
          }
        }
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem(ONBOARDING_KEY, "1");
        window.location.reload();
      }

      setShowOnboarding(false);
    } catch (err) {
      console.error("Onboarding error:", err);
      alert("Something went wrong saving your profile. Please try again.");
    } finally {
      setSavingOnboarding(false);
    }
  };

  const habitsDoneToday = foundations.filter((f) =>
    logsForSelectedDay.some((l) => l.foundation_id === f.id && l.completed)
  ).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-app-main text-app-main pb-20 transition-colors duration-300">
        <AuthGuardHeader />
        <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-24 pt-2">
          {/* Skeleton date header */}
          <section className="mt-2 flex items-center justify-between">
            <div>
              <div className="h-3 w-12 bg-app-card animate-pulse rounded mb-2" />
              <div className="h-6 w-36 bg-app-card animate-pulse rounded" />
            </div>
            <div className="h-8 w-28 bg-app-card animate-pulse rounded-full" />
          </section>

          {/* Skeleton intention card */}
          <div className="rounded-2xl border border-app-border bg-app-card p-4">
            <div className="h-4 w-24 bg-app-card-hover animate-pulse rounded mb-3" />
            <div className="h-12 bg-app-card-hover animate-pulse rounded" />
          </div>

          {/* Skeleton habits */}
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-app-border bg-app-card p-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-app-card-hover animate-pulse rounded-full" />
                  <div className="h-4 w-32 bg-app-card-hover animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-main text-app-main pb-20 transition-colors duration-300">
      <AuthGuardHeader />

      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-24 pt-2">
        {/* Daily Intention */}


        {/* Date header */}
        <section className="mt-2 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-app-muted">
              Today
            </div>
            <div className="text-xl font-semibold text-app-main">
              {format(parseISO(selectedDate), "EEEE, MMM d")}
            </div>
          </div>

          <div className="text-right">
            <label className="block text-[11px] uppercase tracking-wide text-app-muted">
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="mt-1 rounded-full border border-app-border bg-app-card px-3 py-1 text-xs text-app-main outline-none focus:border-app-accent"
            />
          </div>
        </section>

        {/* Daily Intention */}
        <DailyIntentionCard
          intention={dailyIntention || DEFAULT_INTENTION}
          timeRemaining={timeRemaining}
        />

        {/* Gold Streak Display */}
        <div className="mb-2 flex justify-center">
          <div className={`inline-flex items-center gap-2 rounded-full bg-yellow-500/10 px-6 py-2 text-sm font-bold ring-1 ring-inset ring-yellow-500/20 ${themeState === "dark" || themeState === "cherry-dark" ? "text-yellow-500" : "text-yellow-700"
            }`}>
            <span>🏆</span>
            <span>Gold Streak: {goldStreak} {goldStreak === 1 ? "day" : "days"}</span>
          </div>
        </div>

        {/* Foundations list */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold tracking-wide text-app-muted uppercase">
                Daily habits
              </h2>
              <span className="text-[10px] text-app-muted bg-app-card px-2 py-0.5 rounded-full border border-app-border">
                {habitsDoneToday}/{foundations.length} done
              </span>
            </div>
            <button
              onClick={() => setShowNewHabitForm(!showNewHabitForm)}
              className="text-[11px] text-app-accent-color hover:text-app-accent-hover"
            >
              {showNewHabitForm ? "Cancel" : "+ Add"}
            </button>
          </div>

          {/* New foundation inline editor */}
          {showNewHabitForm && (
            <div className="mb-3 rounded-2xl bg-app-card p-3 ring-1 ring-app-border">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="New habit title…"
                className="mb-2 w-full rounded-lg border border-app-border bg-app-input px-3 py-1.5 text-xs text-app-main outline-none focus:border-app-accent"
              />
              <div className="flex items-center justify-between gap-2 text-[11px] text-app-muted">
                <div className="flex flex-wrap gap-1">
                  {(["daily", "weekdays", "weekly", "monthly", "xPerWeek"] as ScheduleType[]).map(
                    (opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setNewSchedule(opt)}
                        className={`rounded-full px-2 py-0.5 ${newSchedule === opt
                          ? "bg-app-accent text-app-accent-text"
                          : "bg-app-card-hover text-app-muted"
                          }`}
                      >
                        {opt === "xPerWeek" ? "x/week" : opt}
                      </button>
                    )
                  )}
                </div>

                {newSchedule === "xPerWeek" && (
                  <div className="flex items-center gap-1">
                    <span>x</span>
                    <input
                      type="number"
                      min={1}
                      max={7}
                      value={newXPerWeek}
                      onChange={(e) =>
                        setNewXPerWeek(Number(e.target.value || 3))
                      }
                      className="h-6 w-10 rounded border border-app-border bg-app-input px-1 text-xs text-app-main outline-none"
                    />
                    <span className="text-app-muted">per week</span>
                  </div>
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleSaveFoundation}
                  disabled={creatingHabit}
                  className="flex-1 rounded-full bg-app-accent py-1.5 text-xs font-semibold text-app-accent-text disabled:opacity-60"
                >
                  {creatingHabit ? "Saving..." : "Save"}
                </button>
                {editingId && (
                  <button
                    onClick={() => {
                      const f = foundations.find(f => f.id === editingId);
                      if (f) handleDeleteFoundationFromTodayForward(f);
                    }}
                    className="rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          )}

          {loading && (
            <div className="py-6 text-center text-xs text-app-muted">
              Loading your foundations…
            </div>
          )}

          {!loading &&
            foundations.map((f) => {
              const logs = logsForSelectedDay;
              const log = logs.find((l) => l.foundation_id === f.id);
              const completed = log?.completed ?? false;
              const streak = streakByFoundationId[f.id] ?? 0;

              const activeToday = foundations.filter((found) => {
                if (selectedDate < found.start_date) return false;
                if (found.end_date && selectedDate > found.end_date) return false;
                return matchesSchedule(found.schedule_type, selectedDate, found.x_per_week);
              });
              const allDone = activeToday.length > 0 && activeToday.every((found) =>
                logs.some((l) => l.foundation_id === found.id && l.completed)
              );

              let ringClass = "ring-1 ring-app-border";
              if (allDone) ringClass = "gold-racetrack shadow-[0_0_15px_rgba(234,179,8,0.6)] border-yellow-500";
              else if (completed) ringClass = "ring-1 ring-green-500";

              return (
                <div
                  key={f.id}
                  className={`mb-3 rounded-2xl bg-app-card p-3 transition-all duration-300 ${ringClass}`}
                >
                  {/* Row 1: Checkbox + Title */}
                  <div className="flex items-center gap-3 mb-2">
                    <button
                      type="button"
                      onClick={() => handleToggleFoundation(f)}
                      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${completed
                        ? allDone
                          ? "border-yellow-500 bg-yellow-500 text-app-main shadow-[0_0_10px_rgba(234,179,8,0.6)]"
                          : "border-app-accent bg-app-accent text-app-accent-text"
                        : "border-app-border bg-app-input text-app-muted"
                        }`}
                    >
                      {completed ? "✓" : ""}
                    </button>
                    <div className="text-sm font-semibold text-app-main">
                      {f.title}
                    </div>
                  </div>

                  {/* Row 2: Meta | Streak | Arrows | Remove */}
                  <div className="flex items-center justify-between pl-9 mb-2">
                    <div className="flex items-center gap-2 text-[11px] text-app-muted">
                      <span>
                        {f.schedule_type === "daily"
                          ? "Daily"
                          : f.schedule_type === "weekdays"
                            ? "Weekdays"
                            : f.schedule_type === "weekly"
                              ? "Weekly"
                              : f.schedule_type === "monthly"
                                ? "Monthly"
                                : `${f.x_per_week}x per week`}
                      </span>
                      {streak > 0 && (
                        <span className="text-app-accent-color">
                          • Streak: {streak}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 mr-2">
                        <button
                          onClick={() => handleMoveFoundation(f.id, "up")}
                          className="text-[10px] text-app-muted hover:text-app-accent-color px-1"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => handleMoveFoundation(f.id, "down")}
                          className="text-[10px] text-app-muted hover:text-app-accent-color px-1"
                        >
                          ▼
                        </button>
                      </div>

                      <div className="relative flex items-center gap-2">
                        <button
                          onClick={() => handleEditFoundation(f)}
                          className="text-[10px] text-app-muted hover:text-app-accent-color px-1"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Notes */}
                  <div className="pl-9">
                    <textarea
                      value={log?.notes ?? ""}
                      onChange={(e) => handleNotesChange(f, e.target.value)}
                      placeholder="Notes..."
                      className="w-full resize-none rounded bg-app-card-hover/30 px-2 py-1 text-xs text-app-muted placeholder-app-muted/50 outline-none focus:bg-app-card-hover/50 border border-transparent focus:border-app-border/30"
                      rows={1}
                      style={{ minHeight: "1.5em" }}
                    />
                  </div>
                </div>
              );
            })}
        </section>

        {/* Cherry Points Tracker */}
        <section className="mt-8 mb-8 rounded-3xl bg-app-card p-6 text-center ring-1 ring-app-border">
          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-app-muted">
            Cherry Balance
          </div>
          <div className="mb-2 text-4xl font-black text-app-accent-color">
            {points.toLocaleString()} 🍒
          </div>
          <p className="text-xs text-app-muted max-w-[200px] mx-auto leading-relaxed">
            Earn Cherry by completing your habits and goals. Use Cherry for cash and prizes!
          </p>
        </section>
      </main>

      {/* Onboarding Modal */}
      {showOnboarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-app-card p-6 shadow-2xl ring-1 ring-app-border">
            {onboardingStep === 0 ? (
              <OnboardingInterest
                onNext={(selection) => {
                  setInterestSelection(selection);
                  // Persist settings immediately
                  if (typeof window !== "undefined") {
                    localStorage.setItem("foundation_show_plans", String(selection.goals));
                    localStorage.setItem("foundation_show_journal", String(selection.journal));
                  }
                  setOnboardingStep(1);
                }}
              />
            ) : (
              <>
                <h2 className="mb-2 text-xl font-bold text-app-main">
                  Welcome to Cherry
                </h2>
                <p className="mb-6 text-sm text-app-muted">
                  Let’s set up your AI coach.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-app-muted uppercase tracking-wide">
                      Top 3 Priorities
                    </label>
                    <input
                      className="w-full rounded-xl border border-app-border bg-app-input px-4 py-3 text-sm text-app-main outline-none focus:border-app-accent transition-colors"
                      placeholder="e.g. Health, Startup, Family"
                      value={onboarding.priorities}
                      onChange={(e) =>
                        handleOnboardingChange("priorities", e.target.value)
                      }
                    />
                  </div>

                  {interestSelection.goals && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-app-muted uppercase tracking-wide">
                        Life Summary & 10-Year Vision
                      </label>
                      <textarea
                        className="h-24 w-full resize-none rounded-xl border border-app-border bg-app-input px-4 py-3 text-sm text-app-main outline-none focus:border-app-accent transition-colors"
                        placeholder="Where are you now? Where do you want to be?"
                        value={onboarding.lifeSummary}
                        onChange={(e) =>
                          handleOnboardingChange("lifeSummary", e.target.value)
                        }
                      />
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-xs font-medium text-app-muted uppercase tracking-wide">
                      Ideology / Worldview (Optional)
                    </label>
                    <input
                      className="w-full rounded-xl border border-app-border bg-app-input px-4 py-3 text-sm text-app-main outline-none focus:border-app-accent transition-colors"
                      placeholder="e.g. Stoicism, Christianity, Tech-Optimism"
                      value={onboarding.ideology}
                      onChange={(e) =>
                        handleOnboardingChange("ideology", e.target.value)
                      }
                    />
                  </div>
                </div>

                <button
                  onClick={handleOnboardingSubmit}
                  disabled={savingOnboarding}
                  className="mt-8 w-full rounded-full bg-app-accent py-3 text-sm font-bold text-app-accent-text hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {savingOnboarding ? "Generating Plan..." : "Create My Plan"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Celebration Modal */}
      {showCelebration && (
        <CelebrationModal
          message={celebrationMessage}
          onClose={() => setShowCelebration(false)}
        />
      )}
    </div>
  );
}
