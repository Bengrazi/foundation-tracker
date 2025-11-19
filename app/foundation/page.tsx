"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { AuthGuardHeader } from "@/components/AuthGuardHeader";
import { supabase } from "@/lib/supabaseClient";
import { applySavedTextSize } from "@/lib/textSize";

// ------------- Types -------------

type ScheduleType = "daily" | "weekdays" | "weekly" | "monthly" | "xPerWeek";

type Foundation = {
  id: string;
  title: string;
  schedule_type: ScheduleType;
  x_per_week: number | null;
  start_date: string; // "yyyy-MM-dd"
  end_date: string | null; // null = still active
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
      // treat any chosen day as eligible; actual enforcement is
      // done by user behaviour, not by blocking UI
      return true;
    case "monthly":
      return true;
    case "xPerWeek":
      // same as weekly – we let user choose which days to hit
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

    // outside active window?
    if (key < foundation.start_date) break;
    if (foundation.end_date && key > foundation.end_date) break;

    if (!matchesSchedule(foundation.schedule_type, key, foundation.x_per_week)) {
      // skip non-scheduled days without breaking streak
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
    } else {
      break;
    }
  }

  return streak;
}

// ---------- Initial default foundations ----------

const DEFAULT_FOUNDATIONS: Omit<Foundation, "id" | "start_date" | "end_date">[] =
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
    {
      title: "Breathing exercises",
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

  const [showNewHabitForm, setShowNewHabitForm] = useState(false);
  const [creatingHabit, setCreatingHabit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState("");
  const [celebrationLoading, setCelebrationLoading] = useState(false);

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

  // text size + onboarding check on mount
  useEffect(() => {
    applySavedTextSize();

    if (typeof window !== "undefined") {
      const done = window.localStorage.getItem(ONBOARDING_KEY);
      if (!done) {
        setShowOnboarding(true);
      }
    }
  }, []);

  // Load foundations + logs whenever date changes (and on first load)
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      // 1. Ensure user is logged in (RLS will handle user scoping)
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        setLoading(false);
        return;
      }

      // 2. Load foundations (active + created up to selectedDate)
      const { data: fdData, error: fdError } = await supabase
        .from("foundations") // TODO: confirm table name
        .select("*")
        .lte("start_date", selectedDate)
        .or(`end_date.is.null,end_date.gte.${selectedDate}`)
        .order("start_date", { ascending: true });

      if (fdError) {
        console.error("Error loading foundations", fdError);
      }

      const foundationsLoaded = (fdData || []) as Foundation[];

      // If there are ZERO foundations at all, seed defaults starting today.
      if (!fdError && foundationsLoaded.length === 0) {
        // Double-check: does the user have ANY foundations? 
        // (If we are viewing a past date, foundationsLoaded might be empty but user has future habits)
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

          if (seedError) {
            console.error("Error seeding default foundations", seedError);
            alert("Failed to seed default habits. Please try resetting again.");
          }

          if (!seedError && seeded) {
            foundationsLoaded.push(...(seeded as Foundation[]));
          }
        }
      }

      // 3. Load logs for last 60 days
      const from = format(addDays(parseISO(selectedDate), -60), "yyyy-MM-dd");
      const { data: logsData, error: logsError } = await supabase
        .from("foundation_logs") // TODO: confirm table name
        .select("*")
        .gte("date", from)
        .lte("date", selectedDate)
        .order("date", { ascending: true });

      if (logsError) {
        console.error("Error loading foundation logs", logsError);
      }

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

  // ---------- Celebration Logic ----------

  const checkCelebration = async (
    foundationId: string,
    newStreak: number,
    allDone: boolean,
    goldStreak: number
  ) => {
    // Milestones
    const goldMilestones = [1, 7, 10, 13, 25, 50, 69, 100, 150, 200, 250, 300, 350, 365, 400, 500, 600, 700, 730, 800, 900, 1000, 1095, 1250, 1460, 1500, 1825];
    const habitMilestones = [3, 7, 14, 21, 30, 50, 69, 100, 365];

    let trigger = "";
    let count = 0;

    // Prioritize Gold Streak
    if (allDone && goldMilestones.includes(goldStreak)) {
      trigger = "gold";
      count = goldStreak;
    } else if (habitMilestones.includes(newStreak)) {
      trigger = "habit";
      count = newStreak;
    }

    if (trigger) {
      setShowCelebration(true);
      setCelebrationLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", auth.user?.id)
          .single();

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `Generate a short, powerful, personalized congratulation for a ${trigger} streak of ${count} days.`,
            contextMode: "celebration",
            profile,
          }),
        });
        const json = await res.json();
        setCelebrationMessage(json.reply);
      } catch (e) {
        setCelebrationMessage(`Amazing job! ${count} days streak!`);
      } finally {
        setCelebrationLoading(false);
      }
    }
  };

  // ---------- Foundation CRUD ----------

  const handleToggleFoundation = async (foundation: Foundation) => {
    const existing = logsForSelectedDay.find(
      (l) => l.foundation_id === foundation.id
    );

    const completed = !(existing?.completed ?? false);

    // optimistic update
    setLogsByDate((prev) => {
      const dayLogs = [...(prev[selectedDate] || [])];
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
      return { ...prev, [selectedDate]: dayLogs };
    });

    // persist
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
          const dayLogs = [...(prev[selectedDate] || [])];
          // replace temp with real row
          const tempIdx = dayLogs.findIndex((l) =>
            String(l.id).startsWith("temp-")
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

  const handleNotesChange = async (foundation: Foundation, notes: string) => {
    const existing = logsForSelectedDay.find(
      (l) => l.foundation_id === foundation.id
    );

    // optimistic
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

  const handleCreateFoundation = async () => {
    if (!newTitle.trim()) return;

    setCreatingHabit(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      setCreatingHabit(false);
      return;
    }

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

    setCreatingHabit(false);

    if (error) {
      console.error("Error creating foundation", error);
      alert(`Error creating habit: ${error.message}`);
      return;
    }

    setFoundations((prev) => [...prev, data as Foundation]);
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
    // Don’t delete past logs. Just mark end_date = selectedDate - 1.
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
      prev.map((f) => (f.id === updated.id ? updated : f))
    );
  };

  // ---------- Onboarding ----------

  const handleOnboardingChange = (field: keyof OnboardingState, value: string) =>
    setOnboarding((prev) => ({ ...prev, [field]: value }));

  const handleOnboardingSubmit = async () => {
    if (!onboarding.priorities.trim() || !onboarding.lifeSummary.trim()) {
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
      // data: { keyTruth, board, goals, aiVoice }

      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user) {
        // 1. Save Profile
        await supabase.from("profiles").upsert({
          id: auth.user.id,
          priorities: onboarding.priorities,
          life_summary: onboarding.lifeSummary,
          ideology: onboarding.ideology,
          key_truth: data.keyTruth,
          ai_voice: data.aiVoice,
        });

        // 2. Save Board Members
        if (Array.isArray(data.board)) {
          const members = data.board.map((m: any) => ({
            user_id: auth.user.id,
            name: m.name,
            role: m.role,
            why: m.why,
          }));
          await supabase.from("board_members").insert(members);
        }

        // 3. Save Goals
        if (data.goals) {
          const goalInserts: any[] = [];
          // horizons: 3y, 1y, 6m, 1m
          for (const horizon of ["3y", "1y", "6m", "1m"]) {
            const list = data.goals[horizon];
            if (Array.isArray(list)) {
              list.forEach((g: any) => {
                goalInserts.push({
                  user_id: auth.user.id,
                  title: g.title,
                  horizon,
                  status: "not_started",
                  // rough estimates for target_date
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
      }

      setShowOnboarding(false);
    } catch (err) {
      console.error("Onboarding error:", err);
      alert("Something went wrong saving your profile. Please try again.");
    } finally {
      setSavingOnboarding(false);
    }
  };

  // ---------- Render ----------

  const habitsDoneToday = foundations.filter((f) =>
    logsForSelectedDay.some((l) => l.foundation_id === f.id && l.completed)
  ).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      <AuthGuardHeader />

      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-24 pt-2">
        {/* Date header */}
        <section className="mt-2 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Today
            </div>
            <div className="text-xl font-semibold text-slate-50">
              {format(parseISO(selectedDate), "EEEE, MMM d")}
            </div>
            <div className="text-xs text-slate-400">
              {habitsDoneToday}/{foundations.length} habits today
            </div>
          </div>

          <div className="text-right">
            <label className="block text-[11px] uppercase tracking-wide text-slate-400">
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="mt-1 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-100 outline-none focus:border-emerald-400"
            />
            <div className="mt-1 text-[11px] text-amber-300">
              Gold streak: {goldStreak} {goldStreak === 1 ? "day" : "days"}
            </div>
          </div>
        </section>



        {/* Foundations list */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wide text-slate-300 uppercase">
              Daily habits
            </h2>
            <button
              onClick={() => setShowNewHabitForm(!showNewHabitForm)}
              className="text-[11px] text-emerald-300 hover:text-emerald-200"
            >
              {showNewHabitForm ? "Cancel" : "+ Add"}
            </button>
          </div>

          {/* New foundation inline editor */}
          {showNewHabitForm && (
            <div className="mb-3 rounded-2xl bg-slate-900/70 p-3 ring-1 ring-slate-800">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="New habit title…"
                className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-emerald-400"
              />
              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
                <div className="flex flex-wrap gap-1">
                  {(["daily", "weekdays", "weekly", "monthly", "xPerWeek"] as ScheduleType[]).map(
                    (opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setNewSchedule(opt)}
                        className={`rounded-full px-2 py-0.5 ${newSchedule === opt
                          ? "bg-emerald-500 text-slate-950"
                          : "bg-slate-800 text-slate-300"
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
                      className="h-6 w-10 rounded border border-slate-700 bg-slate-950 px-1 text-xs text-slate-100 outline-none"
                    />
                    <span className="text-slate-400">per week</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleCreateFoundation}
                disabled={creatingHabit}
                className="mt-3 w-full rounded-full bg-emerald-500 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-60"
              >
                {creatingHabit ? "Saving..." : "Save"}
              </button>
            </div>
          )}

          {loading && (
            <div className="py-6 text-center text-xs text-slate-400">
              Loading your foundations…
            </div>
          )}

          {!loading &&
            foundations.map((f) => {
              const logs = logsForSelectedDay;
              const log = logs.find((l) => l.foundation_id === f.id);
              const completed = log?.completed ?? false;
              const streak = streakByFoundationId[f.id] ?? 0;

              return (
                <div
                  key={f.id}
                  className="mb-3 rounded-2xl bg-slate-900/80 p-3 ring-1 ring-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => handleToggleFoundation(f)}
                      className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border ${completed
                        ? "border-emerald-400 bg-emerald-500 text-slate-950"
                        : "border-slate-600 bg-slate-950 text-slate-400"
                        }`}
                    >
                      {completed ? "✓" : ""}
                    </button>

                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-50">
                            {f.title}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {f.schedule_type === "daily"
                              ? "Daily"
                              : f.schedule_type === "weekdays"
                                ? "Weekdays"
                                : f.schedule_type === "weekly"
                                  ? "Weekly"
                                  : f.schedule_type === "monthly"
                                    ? "Monthly"
                                    : `${f.x_per_week}x per week`}
                            {streak > 0 && (
                              <span className="ml-2 text-emerald-300">
                                • Streak: {streak}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteFoundationFromTodayForward(f)}
                          disabled={deletingId === f.id}
                          className="text-[10px] text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-900/30 bg-red-950/20"
                        >
                          {deletingId === f.id ? "Removing..." : "Remove"}
                        </button>
                      </div>

                      <textarea
                        value={log?.notes ?? ""}
                        onChange={(e) => handleNotesChange(f, e.target.value)}
                        placeholder="Notes or extra effort for this habit today..."
                        rows={2}
                        className="mt-2 w-full resize-none rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
        </section>

        {/* Celebration Modal */}
        {
          showCelebration && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-3xl border border-emerald-500/50 bg-slate-900 p-6 text-center shadow-2xl shadow-emerald-500/20">
                <div className="mb-4 text-4xl">🎉</div>
                <h3 className="mb-2 text-xl font-bold text-emerald-400">
                  Congratulations!
                </h3>
                <div className="min-h-[60px] text-sm text-slate-200">
                  {celebrationLoading ? (
                    <span className="animate-pulse">Generating your praise...</span>
                  ) : (
                    celebrationMessage
                  )}
                </div>
                <button
                  onClick={() => setShowCelebration(false)}
                  className="mt-6 w-full rounded-full bg-emerald-500 py-2 font-bold text-slate-950 hover:bg-emerald-400"
                >
                  Let's go!
                </button>
              </div>
            </div>
          )
        }
      </main >

      {/* ---------- Onboarding modal ---------- */}
      {
        showOnboarding && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-slate-900 p-5 ring-1 ring-slate-700">
              <h2 className="mb-1 text-sm font-semibold text-slate-50">
                Welcome to Foundation
              </h2>
              <p className="mb-4 text-xs text-slate-300">
                This quick primer is private and only used to personalize your AI
                intentions, goals, and insights. It’s a one-time thing.
              </p>

              <div className="space-y-4 text-xs text-slate-200">
                <div>
                  <p className="mb-1 font-semibold">
                    1. Rank from most to least important for you
                  </p>
                  <p className="mb-2 text-[11px] text-slate-400">
                    Use the words{" "}
                    <span className="font-semibold">
                      Financial, Family, Friends (Community), Personal Growth.
                    </span>
                  </p>
                  <textarea
                    rows={2}
                    value={onboarding.priorities}
                    onChange={(e) =>
                      handleOnboardingChange("priorities", e.target.value)
                    }
                    placeholder="Example: Personal Growth, Family, Financial, Friends (Community)"
                    className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <p className="mb-1 font-semibold">
                    2. Briefly describe your life today and where you’d like to be
                    in 10 years
                  </p>
                  <textarea
                    rows={3}
                    value={onboarding.lifeSummary}
                    onChange={(e) =>
                      handleOnboardingChange("lifeSummary", e.target.value)
                    }
                    placeholder="Finances, family, community, personal growth now – and your ideal 10-year future."
                    className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <p className="mb-1 font-semibold">
                    3. How would you describe your ideology or worldview?
                  </p>
                  <textarea
                    rows={2}
                    value={onboarding.ideology}
                    onChange={(e) =>
                      handleOnboardingChange("ideology", e.target.value)
                    }
                    placeholder="E.g. Christian, stoic, freedom lover, capitalist, other…"
                    className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowOnboarding(false)}
                  className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Skip for now
                </button>
                <button
                  type="button"
                  onClick={handleOnboardingSubmit}
                  disabled={savingOnboarding}
                  className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {savingOnboarding ? "Saving…" : "Save & continue"}
                </button>
              </div>

              <p className="mt-3 text-[10px] text-slate-500">
                Keeps your login. After reset (from Settings) you’ll see these
                questions again so goals and daily intention can be recreated by
                AI — but you won’t be logged out.
              </p>
            </div>
          </div>
        )
      }
    </div >
  );
}
