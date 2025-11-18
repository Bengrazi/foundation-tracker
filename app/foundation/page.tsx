// app/foundation/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { AuthGuardHeader } from "@/components/AuthGuardHeader";

type ScheduleType = "daily" | "weekdays" | "weekly" | "monthly" | "xPerWeek";

type Routine = {
  id: string;
  name: string;
  schedule: ScheduleType;
  xPerWeek?: number;
  createdAt: string; // YYYY-MM-DD
  deletedFrom?: string; // YYYY-MM-DD (inactive on/after this date)
};

type DayRoutineState = { done: boolean; notes: string };

type LogsByDate = {
  [date: string]: { [routineId: string]: DayRoutineState };
};

type OnboardingProfile = {
  priorities: string;
  lifeSummary: string;
  ideology: string;
  keyTruth?: string;
  aiVoice?: string;
  board?: { name: string; role: string; why: string }[];
};

type GeneratedHorizon = "3y" | "1y" | "6m" | "1m";
type GeneratedGoal = { title: string; horizon: GeneratedHorizon };
type StoredGoal = {
  id: string;
  title: string;
  targetDate?: string;
  status: "not_started" | "in_progress" | "achieved";
  pinned?: boolean;
  horizon: GeneratedHorizon;
  sortIndex?: number;
};

const ROUTINE_STORAGE_KEY = "foundation_routines_v1";
const LOGS_STORAGE_KEY = "foundation_logs_v1";
const GOLD_STORAGE_KEY = "foundation_gold_streak_v1";
const DATE_STORAGE_KEY = "foundation_last_date_v1";
const PROFILE_STORAGE_KEY = "foundation_profile_v1";
const GOALS_STORAGE_KEY = "foundation_goals_v1";

function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

// ---------- Component ----------
export default function FoundationPage() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [intention, setIntention] = useState("");
  const [loadingIntention, setLoadingIntention] = useState(false);

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [logs, setLogs] = useState<LogsByDate>({});
  const [goldStreak, setGoldStreak] = useState(0);

  // New / edit
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSchedule, setNewSchedule] = useState<ScheduleType>("daily");
  const [newXPerWeek, setNewXPerWeek] = useState("3");

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [obPriorities, setObPriorities] = useState("");
  const [obLifeSummary, setObLifeSummary] = useState("");
  const [obIdeology, setObIdeology] = useState("");
  const [obLoading, setObLoading] = useState(false);
  const [obError, setObError] = useState<string | null>(null);

  const headerLabel = useMemo(() => format(parseISO(selectedDate), "EEEE, MMM d"), [selectedDate]);

  // ---------- Load once ----------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const today = format(new Date(), "yyyy-MM-dd");
    const storedDate = localStorage.getItem(DATE_STORAGE_KEY);
    setSelectedDate(storedDate || today);

    // routines
    const rRaw = localStorage.getItem(ROUTINE_STORAGE_KEY);
    if (rRaw) {
      try {
        setRoutines(JSON.parse(rRaw));
      } catch {}
    } else {
      // 4 default daily habits (removable)
      const defaults: Routine[] = [
        { id: crypto.randomUUID(), name: "Complete A+ Problem for today", schedule: "daily", createdAt: today },
        { id: crypto.randomUUID(), name: "Journal and reflect",           schedule: "daily", createdAt: today },
        { id: crypto.randomUUID(), name: "Move your body 45+ min",        schedule: "daily", createdAt: today },
        { id: crypto.randomUUID(), name: "Breathing exercises",           schedule: "daily", createdAt: today },
      ];
      setRoutines(defaults);
      localStorage.setItem(ROUTINE_STORAGE_KEY, JSON.stringify(defaults));
    }

    // logs
    const lRaw = localStorage.getItem(LOGS_STORAGE_KEY);
    if (lRaw) {
      try {
        setLogs(JSON.parse(lRaw));
      } catch {}
    }

    // streak
    const gRaw = localStorage.getItem(GOLD_STORAGE_KEY);
    if (gRaw && !Number.isNaN(Number(gRaw))) setGoldStreak(Number(gRaw));

    // onboarding
    const profileRaw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!profileRaw) setShowOnboarding(true);
  }, []);

  // ---------- Helpers: persistence ----------
  const persistRoutines = (next: Routine[]) => localStorage.setItem(ROUTINE_STORAGE_KEY, JSON.stringify(next));
  const persistLogs = (next: LogsByDate) => localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(next));
  const persistGold = (n: number) => localStorage.setItem(GOLD_STORAGE_KEY, String(n));

  // ---------- Profile getter ----------
  const getProfile = (): OnboardingProfile | null => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(PROFILE_STORAGE_KEY) : null;
    if (!raw) return null;
    try { return JSON.parse(raw) as OnboardingProfile; } catch { return null; }
  };

  // ---------- AI Intention ----------
  useEffect(() => {
    const run = async () => {
      try {
        setLoadingIntention(true);
        const profile = getProfile();
        const res = await fetch("/api/intention", { method: "POST", body: JSON.stringify({ profile }) });
        const data = await res.json();
        if (data?.intention) setIntention(data.intention);
      } finally {
        setLoadingIntention(false);
      }
    };
    run();
  }, []);

  // ---------- Active routines for any date ----------
  const getActiveRoutinesForDate = (date: string) =>
    routines.filter((r) => !(r.createdAt > date || (r.deletedFrom && date >= r.deletedFrom)));

  // ---------- Gold streak calculation ----------
  const allActiveCompleteOn = (date: string, logsObj: LogsByDate) => {
    const active = getActiveRoutinesForDate(date);
    if (active.length === 0) return false;
    const day = logsObj[date] ?? {};
    return active.every((r) => day[r.id]?.done === true);
  };

  const computeGoldStreakUpTo = (date: string, logsObj: LogsByDate): number => {
    let streak = 0;
    let cursor = parseISO(date);
    for (let i = 0; i < 365; i++) {
      const ds = format(cursor, "yyyy-MM-dd");
      if (!allActiveCompleteOn(ds, logsObj)) break;
      streak += 1;
      cursor = addDays(cursor, -1);
    }
    return streak;
  };

  // ---------- Logs updates (auto-save + auto-streak) ----------
  const updateLogs = (updater: (prev: LogsByDate) => LogsByDate) => {
    setLogs((prev) => {
      const next = updater(prev);
      persistLogs(next);
      const s = computeGoldStreakUpTo(selectedDate, next);
      setGoldStreak(s);
      persistGold(s);
      return next;
    });
  };

  const toggleRoutine = (id: string) =>
    updateLogs((prev) => {
      const day = { ...(prev[selectedDate] ?? {}) };
      const current = day[id] ?? { done: false, notes: "" };
      day[id] = { ...current, done: !current.done };
      return { ...prev, [selectedDate]: day };
    });

  const updateNotes = (id: string, notes: string) =>
    updateLogs((prev) => {
      const day = { ...(prev[selectedDate] ?? {}) };
      const current = day[id] ?? { done: false, notes: "" };
      day[id] = { ...current, notes };
      return { ...prev, [selectedDate]: day };
    });

  // ---------- Routine CRUD ----------
  const addRoutine = () => {
    if (!newName.trim()) return;
    const routine: Routine = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      schedule: newSchedule,
      createdAt: selectedDate,
      ...(newSchedule === "xPerWeek" ? { xPerWeek: Number(newXPerWeek) || 3 } : {}),
    };
    setRoutines((prev) => {
      const next = [...prev, routine];
      persistRoutines(next);
      return next;
    });
    setNewName("");
    setNewSchedule("daily");
    setNewXPerWeek("3");
    setNewOpen(false);
  };

  // Delete only from selected day forward (keep history)
  const deleteRoutineForFuture = (id: string) =>
    setRoutines((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, deletedFrom: selectedDate } : r));
      persistRoutines(next);
      // update streak in case this changed “all active complete”
      const s = computeGoldStreakUpTo(selectedDate, logs);
      setGoldStreak(s);
      persistGold(s);
      return next;
    });

  // ---------- Display helpers ----------
  const scheduleLabel = (r: Routine) => {
    switch (r.schedule) {
      case "xPerWeek": return r.xPerWeek ? `${r.xPerWeek}×/week` : "Several times per week";
      case "weekdays": return "Weekdays";
      case "weekly":   return "Weekly";
      case "monthly":  return "Monthly";
      default:         return "Daily";
    }
  };

  const activeRoutines = getActiveRoutinesForDate(selectedDate);
  const day = logs[selectedDate] ?? {};
  const completedCount = activeRoutines.filter((r) => day[r.id]?.done).length;

  // ---------- Onboarding submit ----------
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
        board: Array.isArray(data?.board) ? data.board : undefined,
      };
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));

      // Seed goals if empty
      const goalsRaw = localStorage.getItem(GOALS_STORAGE_KEY);
      let existing: StoredGoal[] = [];
      if (goalsRaw) {
        try { existing = JSON.parse(goalsRaw); } catch { existing = []; }
      }

         const goals = data?.goals;
      if (existing.length === 0 && goals && typeof goals === "object") {
        const baseDate = new Date();
        const generated: StoredGoal[] = [];
        let pinnedUsed = false; // only pin the first good 3-year goal

        const normalizeTitle = (g: any): string => {
          if (!g) return "";
          if (typeof g === "string") return g.trim();
          if (typeof g.title === "string" && g.title.trim()) return g.title.trim();
          if (typeof g.goal === "string" && g.goal.trim()) return g.goal.trim();
          if (typeof g.text === "string" && g.text.trim()) return g.text.trim();
          return "";
        };

        const inject = (title: string, horizon: GeneratedHorizon, order: number) => {
          if (!title) return;

          let target = baseDate;
          if (horizon === "3y") target = addMonths(baseDate, 36);
          else if (horizon === "1y") target = addMonths(baseDate, 12);
          else if (horizon === "6m") target = addMonths(baseDate, 6);
          else target = addMonths(baseDate, 1);

          const pinned = !pinnedUsed && horizon === "3y";
          if (pinned) pinnedUsed = true;

          generated.push({
            id: crypto.randomUUID(),
            title,
            horizon,
            status: "not_started",
            pinned,
            targetDate: formatDate(target),
            sortIndex: order + 1,
          });
        };

        (["3y", "1y", "6m", "1m"] as GeneratedHorizon[]).forEach((h) => {
          const arr = Array.isArray(goals[h]) ? (goals[h] as any[]) : [];
          // at most 2 goals per horizon
          arr.slice(0, 2).forEach((g, idx) => {
            const title = normalizeTitle(g);
            inject(title, h, idx);
          });
        });

        if (generated.length > 0) {
          localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(generated));
        }
      }


      setShowOnboarding(false);
    } catch (e) {
      console.error(e);
      setObError("Something went wrong creating your starter goals. You can always add your own later.");
    } finally {
      setObLoading(false);
    }
  };

  // ---------- UI ----------
  const dateInputId = "foundation-date-input";

  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

 return (
  <div className="min-h-[calc(100vh-4rem)] space-y-4 bg-slate-950 text-slate-100">

      <AuthGuardHeader />

      {/* Onboarding overlay */}
      {showOnboarding && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-slate-900 p-4 shadow-2xl ring-1 ring-amber-500/20">
            <h2 className="mb-2 text-lg font-semibold text-amber-50">Welcome to Foundation</h2>
            <p className="mb-3 text-xs text-slate-300">
              This quick primer is <span className="font-semibold">private</span> and only used to personalize your AI
              intentions, goals, and insights. It&apos;s a one‑time thing.
            </p>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-slate-100">1. Rank from most to least important for you</label>
                <p className="text-[11px] text-slate-400">
                  Use <strong>Financial, Family, Friends (Community), Personal Growth</strong>.
                </p>
                <textarea
                  value={obPriorities}
                  onChange={(e) => { setObPriorities(e.target.value); autoGrow(e.currentTarget); }}
                  rows={2}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
                  placeholder="Example: Personal Growth, Family, Financial, Friends (Community)"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-slate-100">
                  2. Briefly describe your life today and where you&apos;d like to be in 10 years
                </label>
                <textarea
                  value={obLifeSummary}
                  onChange={(e) => { setObLifeSummary(e.target.value); autoGrow(e.currentTarget); }}
                  rows={4}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
                  placeholder="Finances, family, community, personal growth now — and your ideal 10‑year future."
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-slate-100">3. How would you describe your ideology or worldview?</label>
                <textarea
                  value={obIdeology}
                  onChange={(e) => { setObIdeology(e.target.value); autoGrow(e.currentTarget); }}
                  rows={2}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
                  placeholder="E.g. Christian, stoic, freedom lover, capitalist, other…"
                />
              </div>

              {obError && <p className="text-[11px] text-red-400">{obError}</p>}

              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  disabled={obLoading}
                  onClick={handleOnboardingSubmit}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow disabled:opacity-50"
                >
                  {obLoading ? "Creating your plan…" : "Save & continue"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Today</p>
            <h1 className="text-2xl font-semibold text-amber-50">{headerLabel}</h1>
          </div>

          <div className="relative">
            <input
              id={dateInputId}
              type="date"
              value={selectedDate}
              onChange={(e) => {
                const next = e.target.value;
                setSelectedDate(next);
                localStorage.setItem(DATE_STORAGE_KEY, next);
                // recalc streak on date switch
                const s = computeGoldStreakUpTo(next, logs);
                setGoldStreak(s);
                persistGold(s);
              }}
              className="peer w-[140px] rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs
                         text-slate-200 outline-none [color-scheme:dark] focus:border-emerald-500"
            />
            <label
              htmlFor={dateInputId}
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 peer-focus:text-emerald-400"
              title="Open calendar"
            >
              📅
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400">{completedCount}/{activeRoutines.length} habits today</span>
          <span className="text-amber-400">Gold streak: {goldStreak} day{goldStreak === 1 ? "" : "s"}</span>
        </div>
      </header>

      {/* Intention */}
      <section className="space-y-2 rounded-2xl bg-slate-900/70 p-3 ring-1 ring-slate-800">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Daily intention</h2>
          <button
            disabled={loadingIntention}
            onClick={async () => {
              try {
                setLoadingIntention(true);
                const profile = getProfile();
                const res = await fetch("/api/intention", { method: "POST", body: JSON.stringify({ profile }) });
                const data = await res.json();
                if (data?.intention) setIntention(data.intention);
              } finally { setLoadingIntention(false); }
            }}
            className="text-[11px] text-emerald-400 underline disabled:opacity-40"
          >
            {loadingIntention ? "Thinking…" : "New"}
          </button>
        </div>
        <textarea
          value={intention}
          onChange={(e) => { setIntention(e.target.value); autoGrow(e.currentTarget); }}
          rows={3}
          className="w-full whitespace-pre-wrap break-words rounded-xl border border-slate-800 bg-slate-950/40
                     px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
        />
      </section>

      {/* Daily habits */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Daily habits</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setNewOpen((x) => !x)} className="text-[11px] text-emerald-400">
              {newOpen ? "Cancel" : "+ Add"}
            </button>
          </div>
        </div>

        {/* New habit form */}
        {newOpen && (
          <div className="space-y-2 rounded-2xl bg-slate-900/80 p-3 ring-1 ring-slate-800">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New habit (e.g., Read 10 pages)"
              className="w-full rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100
                         outline-none focus:border-emerald-500"
            />
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span>Frequency</span>
              <select
                value={newSchedule}
                onChange={(e) => setNewSchedule(e.target.value as ScheduleType)}
                className="rounded-full border border-slate-700 bg-slate-950/60 px-2 py-1 text-slate-100
                           outline-none focus:border-emerald-500"
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
                    type="number" min={1} max={7} value={newXPerWeek}
                    onChange={(e) => setNewXPerWeek(e.target.value)}
                    className="w-14 rounded-xl border border-slate-800 bg-slate-950/40 px-2 py-1 text-slate-100
                               outline-none focus:border-emerald-500"
                  />
                  <span>per week</span>
                </>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              This habit will exist from <strong>{selectedDate}</strong> onward until you remove it.
            </p>
            <button
              onClick={addRoutine}
              className="w-full rounded-xl bg-emerald-500 py-2 text-sm font-medium text-slate-950 shadow-sm"
            >
              Save habit
            </button>
          </div>
        )}

        {/* Habits list */}
        <div className="space-y-2">
          {activeRoutines.map((routine) => {
            const state = day[routine.id] ?? { done: false, notes: "" };
            const isDone = state.done;

            // per-habit streak (to selected date)
            let streak = 0;
            {
              let cursor = parseISO(selectedDate);
              for (let i = 0; i < 365; i++) {
                const ds = format(cursor, "yyyy-MM-dd");
                if (ds < routine.createdAt) break;
                if (routine.deletedFrom && ds >= routine.deletedFrom) break;
                if (logs[ds]?.[routine.id]?.done) {
                  streak += 1;
                  cursor = addDays(cursor, -1);
                } else break;
              }
            }

            return (
              <div key={routine.id} className="space-y-2 rounded-2xl bg-slate-900/80 p-3 ring-1 ring-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <button onClick={() => toggleRoutine(routine.id)} className="flex flex-1 items-center gap-3 text-left">
                    <div
                      className={`flex h-7 w-7 flex-none items-center justify-center rounded-full border-2
                        ${isDone ? "border-emerald-400 bg-emerald-500/10" : "border-slate-600"}`}
                      aria-checked={isDone}
                      role="checkbox"
                    >
                      {isDone && <span className="text-xs text-emerald-300">●</span>}
                    </div>
                    <div className="space-y-1">
                      <p className="whitespace-pre-wrap break-words text-sm font-medium text-slate-50">{routine.name}</p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span>{scheduleLabel(routine)}</span>
                        {streak > 0 && <span className="text-amber-400">• 🔥 {streak}-day streak</span>}
                      </div>
                    </div>
                  </button>

                  <button onClick={() => deleteRoutineForFuture(routine.id)} className="text-[11px] text-red-400 underline">
                    Remove →
                  </button>
                </div>

                <textarea
                  value={state.notes}
                  onChange={(e) => { updateNotes(routine.id, e.target.value); autoGrow(e.currentTarget); }}
                  rows={2}
                  className="w-full whitespace-pre-wrap break-words rounded-xl border border-slate-800 bg-slate-950/40
                             px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-emerald-500"
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
