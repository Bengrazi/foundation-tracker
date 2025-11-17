// app/goals/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGuardHeader } from "@/components/AuthGuardHeader";

type Horizon = "3y" | "1y" | "6m" | "1m";
type GoalStatus = "not_started" | "in_progress" | "achieved";

type Goal = {
  id: string;
  title: string;
  targetDate?: string; // estimated finish date
  status: GoalStatus;
  pinned?: boolean;
  horizon: Horizon;
  sortIndex?: number;
};

const STORAGE_KEY = "foundation_goals_v1";

const horizonOptions: { value: Horizon; label: string; order: number }[] = [
  { value: "3y", label: "3 years", order: 0 },
  { value: "1y", label: "1 year", order: 1 },
  { value: "6m", label: "6 months", order: 2 },
  { value: "1m", label: "1 month", order: 3 },
];

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [hideCompleted, setHideCompleted] = useState(true);

  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTargetDate, setNewTargetDate] = useState("");
  const [newHorizon, setNewHorizon] = useState<Horizon>("3y");
  const [savedMessage, setSavedMessage] = useState("");

  // Load once from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setGoals(parsed);
      }
    } catch {
      // ignore broken data
    }
  }, []);

  const groupedGoals = useMemo(() => {
    const filtered = goals.filter(
      (g) => !hideCompleted || g.status !== "achieved"
    );

    const groups: Record<Horizon, Goal[]> = {
      "3y": [],
      "1y": [],
      "6m": [],
      "1m": [],
    };

    for (const g of filtered) {
      groups[g.horizon].push(g);
    }

    (Object.keys(groups) as Horizon[]).forEach((h) => {
      groups[h].sort((a, b) => {
        // pinned first
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        // manual order
        const ai = a.sortIndex ?? 0;
        const bi = b.sortIndex ?? 0;
        if (ai !== bi) return ai - bi;
        // fallback: furthest-out date first
        if (a.targetDate && b.targetDate)
          return b.targetDate.localeCompare(a.targetDate);
        if (a.targetDate && !b.targetDate) return -1;
        if (!a.targetDate && b.targetDate) return 1;
        return 0;
      });
    });

    return groups;
  }, [goals, hideCompleted]);

  const addGoal = () => {
    if (!newTitle.trim()) return;

    const horizonGoals = goals.filter((g) => g.horizon === newHorizon);
    const maxSort =
      horizonGoals.reduce(
        (max, g) => (g.sortIndex ?? 0) > max ? (g.sortIndex ?? 0) : max,
        0
      ) || 0;

    const goal: Goal = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      targetDate: newTargetDate || undefined,
      status: "not_started",
      pinned: false,
      horizon: newHorizon,
      sortIndex: maxSort + 1,
    };
    setGoals((prev) => [...prev, goal]);
    setNewTitle("");
    setNewTargetDate("");
    setNewHorizon("3y");
    setNewOpen(false);
  };

  const updateGoal = (id: string, updates: Partial<Goal>) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)));
  };

  const deleteGoal = (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  const moveGoal = (id: string, direction: "up" | "down") => {
    setGoals((prev) => {
      const next = [...prev];
      const target = next.find((g) => g.id === id);
      if (!target) return prev;
      const horizon = target.horizon;

      const horizonGoals = next
        .filter((g) => g.horizon === horizon)
        .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));

      const index = horizonGoals.findIndex((g) => g.id === id);
      if (index === -1) return prev;

      const neighborIndex =
        direction === "up" ? index - 1 : index + 1;
      if (neighborIndex < 0 || neighborIndex >= horizonGoals.length) {
        return prev;
      }

      const current = horizonGoals[index];
      const neighbor = horizonGoals[neighborIndex];

      const currentSort = current.sortIndex ?? 0;
      const neighborSort = neighbor.sortIndex ?? 0;

      next.forEach((g) => {
        if (g.id === current.id) g.sortIndex = neighborSort;
        else if (g.id === neighbor.id) g.sortIndex = currentSort;
      });

      return next;
    });
  };

  const saveGoalsToStorage = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
    }
    setSavedMessage("Saved ✔");
    setTimeout(() => setSavedMessage(""), 1500);
  };

  return (
    <div className="space-y-4">
      <AuthGuardHeader />

      <header className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">Goals</h1>
          <div className="flex items-center gap-2">
            {savedMessage && (
              <span className="text-[11px] text-emerald-600">
                {savedMessage}
              </span>
            )}
            <button
              onClick={saveGoalsToStorage}
              className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white"
            >
              Save goals
            </button>
            <button
              onClick={() => setNewOpen((x) => !x)}
              className="rounded-full border border-slate-300 px-3 py-1 text-[11px] text-slate-600"
            >
              {newOpen ? "Cancel" : "New goal"}
            </button>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={(e) => setHideCompleted(e.target.checked)}
          />
          Hide completed
        </label>
      </header>

      {/* New goal form */}
      {newOpen && (
        <section className="space-y-2 rounded-2xl border border-slate-200 bg-white px-3 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-600">Time frame</span>
            <select
              value={newHorizon}
              onChange={(e) => setNewHorizon(e.target.value as Horizon)}
              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs outline-none"
            >
              {horizonOptions.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>
          </div>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Goal title…"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
          <div className="space-y-1">
            <input
              type="date"
              value={newTargetDate}
              onChange={(e) => setNewTargetDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
            <p className="text-[11px] text-slate-500">
              This is your <strong>estimated finishing date</strong> for this
              goal.
            </p>
          </div>
          <button
            onClick={addGoal}
            className="w-full rounded-xl bg-emerald-600 py-2 text-sm font-medium text-white"
          >
            Save goal
          </button>
        </section>
      )}

      {/* Combined list: 3y → 1y → 6m → 1m */}
      <section className="space-y-4">
        {horizonOptions.map((horizonDef) => {
          const list = groupedGoals[horizonDef.value as Horizon];
          if (!list || list.length === 0) return null;

          return (
            <div key={horizonDef.value} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {horizonDef.label}
              </h2>
              <div className="space-y-2">
                {list.map((goal, idx) => (
                  <div
                    key={goal.id}
                    className="space-y-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <input
                          value={goal.title}
                          onChange={(e) =>
                            updateGoal(goal.id, { title: e.target.value })
                          }
                          className="w-full border-none bg-transparent text-sm font-medium outline-none"
                        />
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          {goal.targetDate && (
                            <span>🎯 {goal.targetDate} (est.)</span>
                          )}
                          <select
                            value={goal.status}
                            onChange={(e) =>
                              updateGoal(goal.id, {
                                status: e.target.value as GoalStatus,
                              })
                            }
                            className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] outline-none"
                          >
                            <option value="not_started">Not started</option>
                            <option value="in_progress">In progress</option>
                            <option value="achieved">Achieved</option>
                          </select>
                          {goal.pinned && <span>📌 Pinned</span>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex gap-1">
                          <button
                            onClick={() => moveGoal(goal.id, "up")}
                            disabled={idx === 0}
                            className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 disabled:opacity-40"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveGoal(goal.id, "down")}
                            disabled={idx === list.length - 1}
                            className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 disabled:opacity-40"
                          >
                            ↓
                          </button>
                        </div>
                        <button
                          onClick={() =>
                            updateGoal(goal.id, { pinned: !goal.pinned })
                          }
                          className="text-[11px] text-slate-500 underline"
                        >
                          {goal.pinned ? "Unpin" : "Pin"}
                        </button>
                        <button
                          onClick={() => deleteGoal(goal.id)}
                          className="text-[11px] text-red-500 underline"
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

        {horizonOptions.every(
          (h) => groupedGoals[h.value as Horizon].length === 0
        ) && (
          <p className="text-xs text-slate-500">
            No goals yet. Tap &quot;New goal&quot; to add your first one.
          </p>
        )}
      </section>
    </div>
  );
}
