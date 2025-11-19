"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import { AuthGuardHeader } from "@/components/AuthGuardHeader";
import { applySavedTextSize } from "@/lib/textSize";

type Horizon = "3y" | "1y" | "6m" | "1m";
type GoalStatus = "not_started" | "in_progress" | "achieved";

interface Goal {
  id: string;
  user_id: string;
  title: string;
  status: GoalStatus;
  target_date: string;
  horizon: Horizon;
  pinned: boolean;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNewGoal, setShowNewGoal] = useState(false);

  const [newHorizon, setNewHorizon] = useState<Horizon>("3y");
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newStatus, setNewStatus] = useState<GoalStatus>("not_started");

  useEffect(() => {
    applySavedTextSize();
  }, []);

  useEffect(() => {
    async function loadGoals() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .order("target_date", { ascending: true });

      if (!error && data) {
        setGoals(data as Goal[]);
      }
      setLoading(false);
    }

    loadGoals();
  }, []);

  async function handleSaveAll() {
    const updates = goals.map((g) =>
      supabase.from("goals").update(g).eq("id", g.id)
    );
    await Promise.all(updates);
  }

  async function createGoal() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !newTitle.trim()) return;

    const { data, error } = await supabase
      .from("goals")
      .insert({
        user_id: user.id,
        title: newTitle.trim(),
        target_date: newDate,
        status: newStatus,
        horizon: newHorizon,
        pinned: false,
      })
      .select("*")
      .single();

    if (!error && data) {
      setGoals((prev) => [...prev, data as Goal]);
      setNewTitle("");
      setShowNewGoal(false);
    }
  }

  async function deleteGoal(id: string) {
    await supabase.from("goals").delete().eq("id", id);
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }

  async function togglePin(goal: Goal) {
    const updated = { ...goal, pinned: !goal.pinned };
    await supabase.from("goals").update(updated).eq("id", goal.id);
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? updated : g)));
  }

  const groups: Record<Horizon, Goal[]> = { "3y": [], "1y": [], "6m": [], "1m": [] };

  goals.forEach((g) => {
    if (!hideCompleted || g.status !== "achieved") {
      groups[g.horizon].push(g);
    }
  });

  function GoalCard(goal: Goal) {
    return (
      <div
        key={goal.id}
        className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 mb-3 text-xs text-slate-200"
      >
        <div className="flex justify-between gap-3">
          <p className="text-slate-300 font-medium break-words">{goal.title}</p>
          <button
            onClick={() => togglePin(goal)}
            className="text-[10px] text-emerald-400 whitespace-nowrap"
          >
            {goal.pinned ? "Unpin" : "Pin"}
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-slate-400 text-[11px]">
            {format(parseISO(goal.target_date), "yyyy-MM-dd")} (est.)
          </span>

          <select
            value={goal.status}
            onChange={(e) =>
              setGoals((prev) =>
                prev.map((g) =>
                  g.id === goal.id
                    ? { ...goal, status: e.target.value as GoalStatus }
                    : g
                )
              )
            }
            className="rounded bg-slate-800 border border-slate-600 px-2 py-1 text-[10px]"
          >
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="achieved">Achieved</option>
          </select>

          <button
            onClick={() => deleteGoal(goal.id)}
            className="text-red-400 text-[10px] whitespace-nowrap"
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <AuthGuardHeader />

      <main className="mx-auto max-w-md px-4 pb-28 pt-4">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Goals</h1>
            <label className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
              <input
                type="checkbox"
                checked={hideCompleted}
                onChange={(e) => setHideCompleted(e.target.checked)}
                className="h-3 w-3 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-400"
              />
              Hide completed
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleSaveAll}
              disabled={loading}
              className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs text-slate-950 shadow font-semibold disabled:opacity-60"
            >
              Save goals
            </button>
            <button
              onClick={() => setShowNewGoal((v) => !v)}
              className="rounded-full border border-slate-600 bg-slate-900 px-3 py-1 text-[11px] text-slate-200 hover:border-emerald-400"
            >
              {showNewGoal ? "Close new goal" : "New goal"}
            </button>
          </div>
        </header>

        {showNewGoal && (
          <section className="mb-6 rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-xs">
            <h2 className="text-slate-300 font-semibold mb-2">New goal</h2>

            <label className="text-[11px] text-slate-400">Horizon</label>
            <select
              value={newHorizon}
              onChange={(e) => setNewHorizon(e.target.value as Horizon)}
              className="mt-1 block w-full rounded bg-slate-800 border border-slate-600 px-2 py-1"
            >
              <option value="3y">3 years</option>
              <option value="1y">1 year</option>
              <option value="6m">6 months</option>
              <option value="1m">1 month</option>
            </select>

            <label className="mt-3 text-[11px] text-slate-400">Goal title</label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="mt-1 block w-full rounded bg-slate-800 border border-slate-600 px-2 py-1 text-slate-100"
            />

            <label className="mt-3 text-[11px] text-slate-400">
              Estimated finish date
            </label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="mt-1 block w-full rounded bg-slate-800 border border-slate-600 px-2 py-1 text-slate-100"
            />

            <label className="mt-3 text-[11px] text-slate-400">Status</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as GoalStatus)}
              className="mt-1 block w-full rounded bg-slate-800 border border-slate-600 px-2 py-1"
            >
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="achieved">Achieved</option>
            </select>

            <button
              onClick={createGoal}
              className="mt-4 w-full rounded-full bg-emerald-500 py-1.5 text-xs text-slate-950 font-semibold"
            >
              Add goal
            </button>
          </section>
        )}

        <section>
          <h2 className="text-xs text-slate-400 uppercase mb-1">3 years</h2>
          {groups["3y"].map(GoalCard)}

          <h2 className="text-xs text-slate-400 uppercase mt-5 mb-1">1 year</h2>
          {groups["1y"].map(GoalCard)}

          <h2 className="text-xs text-slate-400 uppercase mt-5 mb-1">
            6 months
          </h2>
          {groups["6m"].map(GoalCard)}

          <h2 className="text-xs text-slate-400 uppercase mt-5 mb-1">
            1 month
          </h2>
          {groups["1m"].map(GoalCard)}
        </section>
      </main>
    </div>
  );
}
