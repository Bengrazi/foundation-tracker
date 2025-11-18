"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { AuthGuardHeader } from "@/components/AuthGuardHeader";
import { applySavedTextSize } from "@/lib/textSize";

type Horizon = "3y" | "1y" | "6m" | "1m";
type GoalStatus = "not_started" | "in_progress" | "achieved";

type Goal = {
  id: string;
  title: string;
  horizon: Horizon;
  targetDate: string;
  status: GoalStatus;
  pinned?: boolean;
  sortIndex?: number;
};

const GOALS_STORAGE_KEY = "foundation_goals_v1";

const horizonLabels: Record<Horizon, string> = {
  "3y": "3 years",
  "1y": "1 year",
  "6m": "6 months",
  "1m": "1 month",
};

const horizonOrder: Horizon[] = ["3y", "1y", "6m", "1m"];

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function GoalsPage() {
  useEffect(() => {
    applySavedTextSize();
  }, []);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [hideCompleted, setHideCompleted] = useState(true);
  const [newHorizon, setNewHorizon] = useState<Horizon>("3y");
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(todayStr());
  const [intention, setIntention] = useState("");
  const [loadingIntention, setLoadingIntention] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(GOALS_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed: Goal[] = JSON.parse(raw);
      setGoals(parsed);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const fetchIntention = async () => {
      try {
        setLoadingIntention(true);
        const res = await fetch("/api/intention", { method: "POST" });
        const data = await res.json();
        if (data?.intention) setIntention(data.intention);
      } catch {
        // ignore
      } finally {
        setLoadingIntention(false);
      }
    };
    fetchIntention();
  }, []);

  const saveGoals = (next: Goal[]) => {
    setGoals(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(next));
    }
  };

  const sortedGoalsByHorizon = useMemo(() => {
    const byHorizon: Record<Horizon, Goal[]> = {
      "3y": [],
      "1y": [],
      "6m": [],
      "1m": [],
    };
    goals.forEach((g) => {
      byHorizon[g.horizon]?.push(g);
    });
    horizonOrder.forEach((h) => {
      byHorizon[h].sort((a, b) => {
        const pinDiff = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
        if (pinDiff !== 0) return pinDiff;
        if (a.sortIndex != null && b.sortIndex != null) {
          return a.sortIndex - b.sortIndex;
        }
        return a.targetDate.localeCompare(b.targetDate);
      });
    });
    return byHorizon;
  }, [goals]);

  const pinnedThreeYear = goals.find((g) => g.horizon === "3y" && g.pinned);

  const addGoal = () => {
    if (!newTitle.trim()) return;
    const g: Goal = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      horizon: newHorizon,
      targetDate: newDate,
      status: "not_started",
      pinned: false,
      sortIndex:
        (sortedGoalsByHorizon[newHorizon].slice(-1)[0]?.sortIndex ?? 0) + 1,
    };
    saveGoals([...goals, g]);
    setNewTitle("");
    setNewDate(todayStr());
  };

  const updateGoal = (id: string, patch: Partial<Goal>) => {
    saveGoals(goals.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };

  const deleteGoal = (id: string) => {
    saveGoals(goals.filter((g) => g.id !== id));
  };

  const moveGoal = (id: string, direction: "up" | "down") => {
    const target = goals.find((g) => g.id === id);
    if (!target) return;
    const sameH = goals.filter((g) => g.horizon === target.horizon);
    sameH.sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
    const idx = sameH.findIndex((g) => g.id === id);
    if (idx === -1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sameH.length) return;

    const a = sameH[idx];
    const b = sameH[swapIdx];

    const newGoals = goals.map((g) => {
      if (g.id === a.id) return { ...g, sortIndex: b.sortIndex };
      if (g.id === b.id) return { ...g, sortIndex: a.sortIndex };
      return g;
    });
    saveGoals(newGoals);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] space-y-4 bg-slate-950 text-slate-100">
      <AuthGuardHeader />

      <header className="pt-2">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-amber-50">Goals</h1>
          <button
            onClick={() => saveGoals([...goals])}
            className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-slate-950"
          >
            Save goals
          </button>
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={(e) => setHideCompleted(e.target.checked)}
            className="h-3 w-3 rounded border-slate-600 bg-slate-900"
          />
          Hide completed
        </label>
      </header>

      {/* Intention + core 3-year truth */}
      <section className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2 rounded-2xl bg-slate-900 p-3 ring-1 ring-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Daily intention
            </h2>
            <button
              type="button"
              disabled={loadingIntention}
              onClick={async () => {
                try {
                  setLoadingIntention(true);
                  const res = await fetch("/api/intention", { method: "POST" });
                  const data = await res.json();
                  if (data?.intention) setIntention(data.intention);
                } finally {
                  setLoadingIntention(false);
                }
              }}
              className="text-[11px] text-emerald-400 underline disabled:opacity-40"
            >
              {loadingIntention ? "…" : "New"}
            </button>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm text-slate-100">
            {intention || "Today, take one meaningful step toward your key goals."}
          </p>
        </div>

        <div className="space-y-2 rounded-2xl bg-slate-900 p-3 ring-1 ring-slate-700">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Core 3-year truth
          </h2>
          <p className="whitespace-pre-wrap break-words text-sm text-slate-100">
            {pinnedThreeYear
              ? pinnedThreeYear.title
              : "Define a single key truth that guides the next 3 years of your life."}
          </p>
        </div>
      </section>

      {/* New goal editor */}
      <section className="space-y-2 rounded-2xl bg-slate-900 p-3 ring-1 ring-slate-700">
        <h2 className="text-sm font-semibold text-slate-50">New goal</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span>Timeframe</span>
          <select
            value={newHorizon}
            onChange={(e) => setNewHorizon(e.target.value as Horizon)}
            className="rounded-full border border-slate-600 bg-slate-950/75 px-2 py-1 text-slate-100 outline-none focus:border-emerald-500"
          >
            <option value="3y">3 years</option>
            <option value="1y">1 year</option>
            <option value="6m">6 months</option>
            <option value="1m">1 month</option>
          </select>
        </div>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Goal title..."
          className="w-full rounded-xl border border-slate-600 bg-slate-950/75 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
        />
        <div className="flex items-center gap-2 text-xs">
          <span>Estimated finish date</span>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="rounded-full border border-slate-600 bg-slate-950/75 px-2 py-1 text-slate-100 outline-none [color-scheme:dark] focus:border-emerald-500"
          />
        </div>
        <button
          onClick={addGoal}
          className="mt-1 w-full rounded-xl bg-emerald-500 py-2 text-sm font-semibold text-slate-950"
        >
          Add goal
        </button>
      </section>

      {/* Goals list */}
      <section className="space-y-4 pb-2">
        {horizonOrder.map((horizon) => {
          const list = sortedGoalsByHorizon[horizon].filter(
            (g) => !(hideCompleted && g.status === "achieved")
          );
          if (list.length === 0) return null;
          return (
            <div key={horizon} className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {horizonLabels[horizon]}
              </h3>
              <div className="space-y-2">
                {list.map((g) => (
                  <div
                    key={g.id}
                    className="space-y-2 rounded-2xl bg-slate-900 p-3 ring-1 ring-slate-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-1">
                        <textarea
                          value={g.title}
                          onChange={(e) =>
                            updateGoal(g.id, { title: e.target.value })
                          }
                          rows={2}
                          className="w-full whitespace-pre-wrap break-words rounded-xl border border-slate-600 bg-slate-950/75 px-2 py-1 text-sm text-slate-100 outline-none focus:border-emerald-500"
                        />
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                          <span>🎯</span>
                          <input
                            type="date"
                            value={g.targetDate}
                            onChange={(e) =>
                              updateGoal(g.id, { targetDate: e.target.value })
                            }
                            className="rounded-full border border-slate-600 bg-slate-950/75 px-2 py-1 text-xs text-slate-100 outline-none [color-scheme:dark] focus:border-emerald-500"
                          />
                          <select
                            value={g.status}
                            onChange={(e) =>
                              updateGoal(g.id, {
                                status: e.target.value as GoalStatus,
                              })
                            }
                            className="rounded-full border border-slate-600 bg-slate-950/75 px-2 py-1 text-xs text-slate-100 outline-none focus:border-emerald-500"
                          >
                            <option value="not_started">Not started</option>
                            <option value="in_progress">In progress</option>
                            <option value="achieved">Completed</option>
                          </select>
                          {g.pinned && (
                            <span className="text-amber-300">★ Pinned</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 text-[11px]">
                        <div className="flex gap-1">
                          <button
                            onClick={() => moveGoal(g.id, "up")}
                            className="rounded-full border border-slate-600 bg-slate-950/75 px-1"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveGoal(g.id, "down")}
                            className="rounded-full border border-slate-600 bg-slate-950/75 px-1"
                          >
                            ↓
                          </button>
                        </div>
                        <button
                          onClick={() =>
                            updateGoal(g.id, { pinned: !g.pinned })
                          }
                          className="text-emerald-300 underline"
                        >
                          {g.pinned ? "Unpin" : "Pin"}
                        </button>
                        <button
                          onClick={() => deleteGoal(g.id)}
                          className="text-red-400 underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
