// app/goals/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGuardHeader } from "@/components/AuthGuardHeader";

type Horizon = "3y" | "1y" | "6m" | "1m";
type GoalStatus = "not_started" | "in_progress" | "achieved";

type Goal = {
  id: string;
  title: string;
  targetDate?: string;    // estimated finish date
  status: GoalStatus;
  pinned?: boolean;
  horizon: Horizon;
  sortIndex?: number;     // manual order within horizon
};

const STORAGE_KEY = "foundation_goals_v1";
const horizons: { value: Horizon; label: string }[] = [
  { value: "3y", label: "3 YEARS" },
  { value: "1y", label: "1 YEAR" },
  { value: "6m", label: "6 MONTHS" },
  { value: "1m", label: "1 MONTH" },
];

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [hideCompleted, setHideCompleted] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTargetDate, setNewTargetDate] = useState("");
  const [newHorizon, setNewHorizon] = useState<Horizon>("3y");
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try { setGoals(JSON.parse(raw)); } catch {}
  }, []);

  const grouped = useMemo(() => {
    const filtered = goals.filter((g) => !hideCompleted || g.status !== "achieved");
    const by: Record<Horizon, Goal[]> = { "3y": [], "1y": [], "6m": [], "1m": [] };
    filtered.forEach((g) => by[g.horizon].push(g));
    (Object.keys(by) as Horizon[]).forEach((h) =>
      by[h].sort((a,b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        const ai = a.sortIndex ?? 0, bi = b.sortIndex ?? 0;
        if (ai !== bi) return ai - bi;
        if (a.targetDate && b.targetDate) return b.targetDate.localeCompare(a.targetDate);
        if (a.targetDate && !b.targetDate) return -1;
        if (!a.targetDate && b.targetDate) return 1;
        return 0;
      })
    );
    return by;
  }, [goals, hideCompleted]);

  const persist = (next: Goal[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

  const addGoal = () => {
    if (!newTitle.trim()) return;
    const horizonGoals = goals.filter((g) => g.horizon === newHorizon);
    const maxSort = horizonGoals.reduce((m, g) => Math.max(m, g.sortIndex ?? 0), 0);
    const g: Goal = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      targetDate: newTargetDate || undefined,
      status: "not_started",
      pinned: false,
      horizon: newHorizon,
      sortIndex: maxSort + 1,
    };
    setGoals((prev) => {
      const next = [...prev, g];
      persist(next);
      return next;
    });
    setNewTitle(""); setNewTargetDate(""); setNewHorizon("3y"); setNewOpen(false);
  };

  const updateGoal = (id: string, patch: Partial<Goal>) =>
    setGoals((prev) => {
      const next = prev.map((g) => (g.id === id ? { ...g, ...patch } : g));
      persist(next);
      return next;
    });

  const deleteGoal = (id: string) =>
    setGoals((prev) => {
      const next = prev.filter((g) => g.id !== id);
      persist(next);
      return next;
    });

  const moveGoal = (id: string, dir: "up" | "down", horizon: Horizon) =>
    setGoals((prev) => {
      const arr = [...prev];
      const scope = arr.filter((g) => g.horizon === horizon).sort((a,b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
      const idx = scope.findIndex((g) => g.id === id);
      const neighborIdx = dir === "up" ? idx - 1 : idx + 1;
      if (idx < 0 || neighborIdx < 0 || neighborIdx >= scope.length) return prev;
      const A = scope[idx], B = scope[neighborIdx];
      arr.forEach((g) => {
        if (g.id === A.id) g.sortIndex = B.sortIndex ?? 0;
        else if (g.id === B.id) g.sortIndex = A.sortIndex ?? 0;
      });
      persist(arr);
      return arr;
    });

  const saveExplicit = () => {
    persist(goals);
    setSavedMessage("Saved ✔");
    setTimeout(() => setSavedMessage(""), 1500);
  };

  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  return (
    <div className="space-y-4 text-slate-100">
      <AuthGuardHeader />

      <header className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-amber-50">Goals</h1>
          <div className="flex items-center gap-2">
            {savedMessage && <span className="text-[11px] text-emerald-400">{savedMessage}</span>}
            <button onClick={saveExplicit} className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-slate-950">
              Save goals
            </button>
            <button onClick={() => setNewOpen((x) => !x)} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px]">
              {newOpen ? "Cancel" : "New goal"}
            </button>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={hideCompleted} onChange={(e) => setHideCompleted(e.target.checked)} />
          Hide completed
        </label>
      </header>

      {newOpen && (
        <section className="space-y-2 rounded-2xl bg-slate-900/80 p-3 ring-1 ring-slate-800">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span>Time frame</span>
            <select
              value={newHorizon}
              onChange={(e) => setNewHorizon(e.target.value as Horizon)}
              className="rounded-full border border-slate-700 bg-slate-950/60 px-2 py-1 text-slate-100 outline-none focus:border-emerald-500"
            >
              {horizons.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
          </div>
          <textarea
            value={newTitle}
            onChange={(e) => { setNewTitle(e.target.value); autoGrow(e.currentTarget); }}
            rows={2}
            className="w-full whitespace-pre-wrap break-words rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
            placeholder="Goal title…"
          />
          <div className="space-y-1">
            <input
              type="date"
              value={newTargetDate}
              onChange={(e) => setNewTargetDate(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none [color-scheme:dark] focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-400">This is your <strong>estimated finishing date</strong>.</p>
          </div>
          <button onClick={addGoal} className="w-full rounded-xl bg-emerald-500 py-2 text-sm font-medium text-slate-950">
            Save goal
          </button>
        </section>
      )}

      <section className="space-y-4">
        {horizons.map((h) => {
          const list = grouped[h.value];
          if (!list || list.length === 0) return null;
          return (
            <div key={h.value} className="space-y-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{h.label}</h2>
              <div className="space-y-2">
                {list.map((g, idx) => (
                  <div key={g.id} className="rounded-2xl bg-slate-900/80 p-3 ring-1 ring-slate-800">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-1">
                        <textarea
                          value={g.title}
                          onChange={(e) => { updateGoal(g.id, { title: e.target.value }); autoGrow(e.currentTarget); }}
                          rows={2}
                          className="w-full whitespace-pre-wrap break-words border-none bg-transparent text-sm text-slate-100 outline-none"
                        />
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                          {g.targetDate && <span>🎯 {g.targetDate} (est.)</span>}
                          <select
                            value={g.status}
                            onChange={(e) => updateGoal(g.id, { status: e.target.value as GoalStatus })}
                            className="rounded-full border border-slate-700 bg-slate-950/60 px-2 py-0.5 text-slate-100 outline-none"
                          >
                            <option value="not_started">Not started</option>
                            <option value="in_progress">In progress</option>
                            <option value="achieved">Achieved</option>
                          </select>
                          {g.pinned && <span>📌 Pinned</span>}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <div className="flex gap-1">
                          <button
                            onClick={() => moveGoal(g.id, "up", g.horizon)}
                            disabled={idx === 0}
                            className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 disabled:opacity-40"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveGoal(g.id, "down", g.horizon)}
                            disabled={idx === list.length - 1}
                            className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 disabled:opacity-40"
                          >
                            ↓
                          </button>
                        </div>
                        <button
                          onClick={() => updateGoal(g.id, { pinned: !g.pinned })}
                          className="text-[11px] text-emerald-400 underline"
                        >
                          {g.pinned ? "Unpin" : "Pin"}
                        </button>
                        <button onClick={() => deleteGoal(g.id)} className="text-[11px] text-red-400 underline">
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
