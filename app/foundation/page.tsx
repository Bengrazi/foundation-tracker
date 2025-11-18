// app/foundation/page.tsx
"use client";

import { useEffect, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { AuthGuardHeader } from "@/components/AuthGuardHeader";

type ScheduleType =
  | "daily"
  | "weekdays"
  | "weekly"
  | "monthly"
  | "xPerWeek";

type Routine = {
  id: string;
  name: string;
  schedule: ScheduleType;
  xPerWeek?: number;
  createdAt: string; // YYYY-MM-DD
  deletedFrom?: string; // YYYY-MM-DD (no longer active on or after this date)
};

type DayRoutineState = {
  done: boolean;
  notes: string;
};

type LogsByDate = {
  [date: string]: {
    [routineId: string]: DayRoutineState;
  };
};

type OnboardingProfile = {
  priorities: string;
  lifeSummary: string;
  ideology: string;
  keyTruth?: string;
  aiVoice?: string;
};

type GeneratedGoal = {
  title: string;
  horizon: "3y" | "1y" | "6m" | "1m";
};

type StoredGoal = {
  id: string;
  title: string;
  targetDate?: string;
  status: "not_started" | "in_progress" | "achieved";
  pinned?: boolean;
  horizon: "3y" | "1y" | "6m" | "1m";
  sortIndex?: number;
};

const ROUTINE_STORAGE_KEY = "foundation_routines_v1";
const LOGS_STORAGE_KEY = "foundation_logs_v1";
const GOLD_STORAGE_KEY = "foundation_gold_streak_v1";
const DATE_STORAGE_KEY = "foundation_last_date_v1";
const PROFILE_STORAGE_KEY = "foundation_profile_v1";
const GOALS_STORAGE_KEY = "foundation_goals_v1";

function formatDate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export default function FoundationPage() {
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const headerLabel = format(parseISO(selectedDate), "EEEE, MMM d");

  const [intention, setIntention] = useState("");
  const [loadingIntention, setLoadingIntention] = useState(false);

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [logs, setLogs] = useState<LogsByDate>({});
  const [goldStreak, setGoldStreak] = useState(0);

  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSchedule, setNewSchedule] = useState<ScheduleType>("daily");
  const [newXPerWeek, setNewXPerWeek] = useState("3");

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [obPriorities, setObPriorities] = useState("");
  const [obLifeSummary, setObLifeSummary] = useState("");
  const [obIdeology, setObIdeology] = useState("");
  const [obLoading, setObLoading] = useState(false);
  const [obError, setObError] = useState<string | null>(null);

  // ---------- LOAD ONCE ----------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const todayStr = format(new Date(), "yyyy-MM-dd");

    // last selected date
    const storedDate = window.localStorage.getItem(DATE_STORAGE_KEY);
    if (storedDate) {
      setSelectedDate(storedDate);
    } else {
      setSelectedDate(todayStr);
    }

    // routines
    const routinesRaw = window.localStorage.getItem(ROUTINE_STORAGE_KEY);
    if (routinesRaw) {
      try {
        const parsed = JSON.parse(routinesRaw) as Routine[];
        setRoutines(parsed);
      } catch {
        // ignore
      }
    } else {
      const defaults: Routine[] = [
        {
          id: crypto.randomUUID(),
          name: "Complete A+ Problem for today",
          schedule: "daily",
          createdAt: todayStr,
        },
        {
          id: crypto.randomUUID(),
          name: "Journal and reflect",
          schedule: "daily",
          createdAt: todayStr,
        },
        {
          id: crypto.randomUUID(),
          name: "Move your body 45+ min",
          schedule: "daily",
          createdAt: todayStr,
        },
        {
          id: crypto.randomUUID(),
          name: "Breathing exercises",
          schedule: "daily",
          createdAt: todayStr,
        },
      ];
      setRoutines(defaults);
      window.localStorage.setItem(
        ROUTINE_STORAGE_KEY,
        JSON.stringify(defaults)
      );
    }

    // logs
    const logsRaw = window.localStorage.getItem(LOGS_STORAGE_KEY);
    if (logsRaw) {
      try {
        setLogs(JSON.parse(logsRaw));
      } catch {
        // ignore
      }
    }

    // gold streak
    const goldRaw = window.localStorage.getItem(GOLD_STORAGE_KEY);
    if (goldRaw) {
      const n = Number(goldRaw);
      if (!Number.isNaN(n)) setGoldStreak(n);
    }

    // onboarding profile existence check
    const profileRaw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!profileRaw) {
      setShowOnboarding(true);
    }
  }, []);

  // ---------- HELPERS TO UPDATE + SAVE ----------

  const updateRoutines = (updater: (prev: Routine[]) => Routine[]) => {
    setRoutines((prev) => {
      const next = updater(prev);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          ROUTINE_STORAGE_KEY,
          JSON.stringify(next)
        );
      }
      return next;
    });
  };

  const updateLogs = (updater: (prev: LogsByDate) => LogsByDate) => {
    setLogs((prev) => {
      const next = updater(prev);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  const saveGoldStreak = (value: number) => {
    setGoldStreak(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(GOLD_STORAGE_KEY, String(value));
    }
  };

  const getProfile = (): OnboardingProfile | null => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as OnboardingProfile;
    } catch {
      return null;
    }
  };

  // ---------- AI INTENTION ----------
  useEffect(() => {
    const loadIntention = async () => {
      try {
        setLoadingIntention(true);
        const profile = getProfile();
        const res = await fetch("/api/intention", {
          method: "POST",
          body: JSON.stringify({ profile }),
        });
        const data = await res.json();
        if (data?.intention) setIntention(data.intention);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingIntention(false);
      }
    };
    loadIntention();
  }, []);

  // ---------- LOG + ROUTINE HELPERS ----------

  const getDayLog = (date: string): { [id: string]: DayRoutineState } =>
    logs[date] ?? {};

  const toggleRoutine = (id: string) => {
    updateLogs((prev) => {
      const day = { ...(prev[selectedDate] ?? {}) };
      const current = day[id] ?? { done: false, notes: "" };
      day[id] = { ...current, done: !current.done };
      return { ...prev, [selectedDate]: day };
    });
  };

  const updateNotes = (id: string, notes: string) => {
    updateLogs((prev) => {
      const day = { ...(prev[selectedDate] ?? {}) };
      const current = day[id] ?? { done: false, notes: "" };
      day[id] = { ...current, notes };
      return { ...prev, [selectedDate]: day };
    });
  };

  const scheduleLabel = (r: Routine) => {
    switch (r.schedule) {
      case "xPerWeek":
        return r.xPerWeek ? `${r.xPerWeek}×/week` : "Several times per week";
      case "weekdays":
        return "Weekdays";
      case "weekly":
        return "Weekly";
      case "monthly":
        return "Monthly";
      default:
        return "Daily";
    }
  };

  // Routines active on the selected date
  const activeRoutines: Routine[] = routines.filter((r) => {
    if (r.createdAt > selectedDate) return false;
    if (r.deletedFrom && selectedDate >= r.deletedFrom) return false;
    return true;
  });

  const computeRoutineStreak = (routine: Routine): number => {
    let streak = 0;
    let cursor = parseISO(selectedDate);

    for (let i = 0; i < 365; i++) {
      const dateStr = format(cursor, "yyyy-MM-dd");

      if (dateStr < routine.createdAt) break;
      if (routine.deletedFrom && dateStr >= routine.deletedFrom) break;

      const state = logs[dateStr]?.[routine.id];
      if (state?.done) {
        streak += 1;
      } else {
        break;
      }

      cursor = addDays(cursor, -1);
    }

    return streak;
  };

  const addRoutine = () => {
    if (!newName.trim()) return;

    const routine: Routine = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      schedule: newSchedule,
      createdAt: selectedDate,
      ...(newSchedule === "xPerWeek"
        ? { xPerWeek: Number(newXPerWeek) || 3 }
        : {}),
    };

    updateRoutines((prev) => [...prev, routine]);
    setNewName("");
    setNewSchedule("daily");
    setNewXPerWeek("3");
    setNewOpen(false);
  };

  // Delete only from this day forward
  const deleteRoutineForFuture = (id: string) => {
    updateRoutines((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, deletedFrom: selectedDate } : r
      )
    );
  };

  const saveDayAndUpdateStreak = () => {
    const day = getDayLog(selectedDate);
    const allDone =
      activeRoutines.length > 0 &&
      activeRoutines.every((r) => day[r.id]?.done === true);

    if (allDone) {
      saveGoldStreak(goldStreak + 1);
    } else {
      saveGoldStreak(0);
    }
  };

  const day = getDayLog(selectedDate);
  const completedCount = activeRoutines.filter(
    (r) => day[r.id]?.done
  ).length;

  // ---------- ONBOARDING SUBMIT ----------

  const handleOnboardingSubmit = async () => {
    if (!obPriorities.trim() || !obLifeSummary.trim() || !obIdeology.trim()) {
      setObError("Please answer all three questions.");
      return;
    }

    setObError(null);
    setObLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        body: JSON.stringify({
          priorities: obPriorities,
          lifeSummary: obLifeSummary,
          ideology: obIdeology,
        }),
      });
      const data = await res.json();

      const profile: OnboardingProfile = {
        priorities: obPriorities,
        lifeSummary: obLifeSummary,
        ideology: obIdeology,
        keyTruth: data?.keyTruth ?? undefined,
        aiVoice: data?.aiVoice ?? undefined,
      };

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          PROFILE_STORAGE_KEY,
          JSON.stringify(profile)
        );
      }

      // Seed goals if none exist yet
      if (typeof window !== "undefined") {
        const goalsRaw = window.localStorage.getItem(GOALS_STORAGE_KEY);
        let existing: StoredGoal[] = [];
        if (goalsRaw) {
          try {
            existing = JSON.parse(goalsRaw);
          } catch {
            existing = [];
          }
        }

        if (existing.length === 0 && Array.isArray(data?.goals)) {
          const baseDate = new Date();
          const generated: StoredGoal[] = [];

          const pushGoal = (g: GeneratedGoal, horizonIndex: number) => {
            let target: Date;
            if (g.horizon === "3y") target = addMonths(baseDate, 36);
            else if (g.horizon === "1y") target = addMonths(baseDate, 12);
            else if (g.horizon === "6m") target = addMonths(baseDate, 6);
            else target = addMonths(baseDate, 1);

            generated.push({
              id: crypto.randomUUID(),
              title: g.title,
              horizon: g.horizon,
              status: "not_started",
              pinned: horizonIndex === 0,
              targetDate: formatDate(target),
              sortIndex: horizonIndex,
            });
          };

          if (profile.keyTruth) {
            pushGoal(
              {
                title: `Key truth: ${profile.keyTruth}`,
                horizon: "3y",
              },
              0
            );
          }

          data.goals.forEach((g: GeneratedGoal, idx: number) =>
            pushGoal(g, idx + 1)
          );

          window.localStorage.setItem(
            GOALS_STORAGE_KEY,
            JSON.stringify(generated)
          );
        }
      }

      setShowOnboarding(false);
    } catch (e) {
      console.error(e);
      setObError(
        "Something went wrong creating your starter goals. You can always add your own later."
      );
    } finally {
      setObLoading(false);
    }
  };

  // ---------- UI ----------
  return (
    <div className="space-y-4">
      <AuthGuardHeader />

      {/* Onboarding overlay */}
      {showOnboarding && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-slate-900 p-4 shadow-2xl ring-1 ring-amber-500/20">
            <h2 className="mb-2 text-lg font-semibold text-amber-50">
              Welcome to Foundation
            </h2>
            <p className="mb-3 text-xs text-slate-300">
              This quick primer is{" "}
              <span className="font-semibold">private</span> and only used to
              personalize your AI intentions, goals, and insights. It&apos;s a
              one-time thing.
            </p>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-slate-100">
                  1. Rank from most to least important for you
                </label>
                <p className="text-[11px] text-slate-400">
                  Use the words{" "}
                  <strong>
                    Financial, Family, Friends (Community), Personal Growth
                  </strong>
                  .
                </p>
                <textarea
                  value={obPriorities}
                  onChange={(e) => setObPriorities(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 text-xs text-slate-100 outline-none focus:border-amber-500"
                  placeholder="Example: Personal Growth, Family, Financial, Friends (Community)"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-slate-100">
                  2. Briefly describe your life today and where you&apos;d like
                  to be in 10 years
                </label>
                <textarea
                  value={obLifeSummary}
                  onChange={(e) => setObLifeSummary(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 text-xs text-slate-100 outline-none focus:border-amber-500"
                  placeholder="Finances, family, community, personal growth now – and your ideal 10-year future."
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-slate-100">
                  3. How would you describe your ideology or worldview?
                </label>
                <textarea
                  value={obIdeology}
                  onChange={(e) => setObIdeology(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 text-xs text-slate-100 outline-none focus:border-amber-500"
                  placeholder="E.g. Christian, stoic, freedom lover, capitalist, other…"
                />
              </div>

              {obError && (
                <p className="text-[11px] text-red-400">{obError}</p>
              )}

              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  disabled={obLoading}
                  onClick={handleOnboardingSubmit}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow disabled:opacity-50"
                >
                  {obLoading ? "Creating your foundations..." : "Save & continue"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header with date + gold streak */}
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Today
            </p>
            <h1 className="text-2xl font-semibold text-amber-50">
              {headerLabel}
            </h1>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              const nextDate = e.target.value;
              setSelectedDate(nextDate);
              if (typeof window !== "undefined") {
                window.localStorage.setItem(DATE_STORAGE_KEY, nextDate);
              }
            }}
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 outline-none focus:border-amber-500"
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>
            {completedCount}/{activeRoutines.length} habits today
          </span>
          <span className="text-amber-400">
            Gold streak: {goldStreak} day{goldStreak === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      {/* Intention */}
      <section className="space-y-2 rounded-2xl bg-slate-900/70 p-3 ring-1 ring-slate-800">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Daily intention
          </h2>
          <button
            disabled={loadingIntention}
            onClick={async () => {
              try {
                setLoadingIntention(true);
                const profile = getProfile();
                const res = await fetch("/api/intention", {
                  method: "POST",
                  body: JSON.stringify({ profile }),
                });
                const data = await res.json();
                if (data?.intention) setIntention(data.intention);
              } finally {
                setLoadingIntention(false);
              }
            }}
            className="text-[11px] text-emerald-400 underline disabled:opacity-40"
          >
            {loadingIntention ? "Thinking..." : "New"}
          </button>
        </div>
        <textarea
          value={intention}
          onChange={(e) => setIntention(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
        />
      </section>

      {/* Foundations header */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Daily habits
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNewOpen((x) => !x)}
              className="text-[11px] text-emerald-400"
            >
              {newOpen ? "Cancel" : "+ Add"}
            </button>
            <button
              onClick={saveDayAndUpdateStreak}
              className="rounded-full bg-amber-500 px-3 py-1 text-[11px] font-semibold text-slate-950 shadow-sm"
            >
              Save day
            </button>
          </div>
        </div>

        {/* New foundation form */}
        {newOpen && (
          <div className="space-y-2 rounded-2xl bg-slate-900/80 p-3 ring-1 ring-slate-800">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New habit (e.g. Read 10 pages)"
              className="w-full rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
            />
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span>Frequency</span>
              <select
                value={newSchedule}
                onChange={(e) =>
                  setNewSchedule(e.target.value as ScheduleType)
                }
                className="rounded-full border border-slate-700 bg-slate-950/60 px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-emerald-500"
              >
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="xPerWeek">X times per week</option>
              </select>
              {newSchedule === "xPerWeek" && (
                <>
                  <span>×</span>
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={newXPerWeek}
                    onChange={(e) => setNewXPerWeek(e.target.value)}
                    className="w-14 rounded-xl border border-slate-800 bg-slate-950/40 px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-emerald-500"
                  />
                  <span>per week</span>
                </>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              This habit will exist from <strong>{selectedDate}</strong> onward
              until you remove it.
            </p>
            <button
              onClick={addRoutine}
              className="w-full rounded-xl bg-emerald-500 py-2 text-sm font-medium text-slate-950 shadow-sm"
            >
              Save habit
            </button>
          </div>
        )}

        {/* Foundations list */}
        <div className="space-y-2">
          {activeRoutines.map((routine) => {
            const dayState = day[routine.id] ?? { done: false, notes: "" };
            const isDone = dayState.done;
            const streak = computeRoutineStreak(routine);

            return (
              <div
                key={routine.id}
                className="space-y-2 rounded-2xl bg-slate-900/80 p-3 ring-1 ring-slate-800"
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => toggleRoutine(routine.id)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <div
                      className={`flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 ${
                        isDone
                          ? "border-emerald-400 bg-emerald-500/10"
                          : "border-slate-600 bg-transparent"
                      }`}
                    >
                      {isDone && (
                        <span className="text-xs text-emerald-300">●</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-50">
                        {routine.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span>{scheduleLabel(routine)}</span>
                        {streak > 0 && (
                          <span className="text-amber-400">
                            • 🔥 {streak}-day streak
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => deleteRoutineForFuture(routine.id)}
                    className="text-[11px] text-slate-500 underline"
                  >
                    Remove →
                  </button>
                </div>

                <textarea
                  value={dayState.notes}
                  onChange={(e) => updateNotes(routine.id, e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/40 px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-emerald-500"
                  placeholder="Notes or extra effort for this habit today…"
                />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
