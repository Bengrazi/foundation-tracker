"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
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
    order_index: number;
}

export function GoalsWidget() {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [hideCompleted, setHideCompleted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showNewGoal, setShowNewGoal] = useState(false);

    const [newHorizon, setNewHorizon] = useState<Horizon>("3y");
    const [newTitle, setNewTitle] = useState("");
    const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [newStatus, setNewStatus] = useState<GoalStatus>("not_started");

    const [editingId, setEditingId] = useState<string | null>(null);

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
                .order("order_index", { ascending: true });

            if (!error && data) {
                setGoals(data as Goal[]);
            }
            setLoading(false);
        }

        loadGoals();
    }, []);

    async function handleSaveGoal() {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user || !newTitle.trim()) return;

        if (editingId) {
            // Update existing
            const { data, error } = await supabase
                .from("goals")
                .update({
                    title: newTitle.trim(),
                    target_date: newDate,
                    status: newStatus,
                    horizon: newHorizon,
                })
                .eq("id", editingId)
                .select("*")
                .single();

            if (error) {
                console.error("Error updating goal", error);
                alert(`Error updating goal: ${error.message}`);
                return;
            }

            if (data) {
                setGoals((prev) => prev.map(g => g.id === editingId ? (data as Goal) : g));
                setEditingId(null);
                setNewTitle("");
                setShowNewGoal(false);
            }
        } else {
            // Create new
            const { data, error } = await supabase
                .from("goals")
                .insert({
                    user_id: user.id,
                    title: newTitle.trim(),
                    target_date: newDate,
                    status: newStatus,
                    horizon: newHorizon,
                    order_index: (goals.length + 1) * 1000,
                })
                .select("*")
                .single();

            if (error) {
                console.error("Error creating goal", error);
                alert(`Error creating goal: ${error.message}`);
                return;
            }

            if (data) {
                setGoals((prev) => [...prev, data as Goal]);
                setNewTitle("");
                setShowNewGoal(false);
            }
        }
    }

    async function deleteGoal(id: string) {
        if (!confirm("Are you sure you want to delete this goal?")) return;
        await supabase.from("goals").delete().eq("id", id);
        setGoals((prev) => prev.filter((g) => g.id !== id));
        if (editingId === id) {
            setEditingId(null);
            setShowNewGoal(false);
        }
    }

    function startEdit(goal: Goal) {
        setEditingId(goal.id);
        setNewTitle(goal.title);
        setNewDate(goal.target_date);
        setNewStatus(goal.status);
        setNewHorizon(goal.horizon);
        setShowNewGoal(true);
    }

    async function moveGoal(goal: Goal, direction: "up" | "down") {
        const group = goals
            .filter((g) => g.horizon === goal.horizon)
            .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

        const index = group.findIndex((g) => g.id === goal.id);
        if (index === -1) return;

        const swapIndex = direction === "up" ? index - 1 : index + 1;
        if (swapIndex < 0 || swapIndex >= group.length) return;

        const other = group[swapIndex];

        // Swap order_index
        const goalOrder = goal.order_index ?? index;
        const otherOrder = other.order_index ?? swapIndex;

        let newGoalOrder = otherOrder;
        let newOtherOrder = goalOrder;

        if (newGoalOrder === newOtherOrder) {
            newGoalOrder = swapIndex;
            newOtherOrder = index;
        }

        // Optimistic update
        setGoals((prev) =>
            prev.map((g) => {
                if (g.id === goal.id) return { ...g, order_index: newGoalOrder };
                if (g.id === other.id) return { ...g, order_index: newOtherOrder };
                return g;
            })
        );

        // Persist
        await Promise.all([
            supabase.from("goals").update({ order_index: newGoalOrder }).eq("id", goal.id),
            supabase.from("goals").update({ order_index: newOtherOrder }).eq("id", other.id),
        ]);
    }

    const groups: Record<Horizon, Goal[]> = { "3y": [], "1y": [], "6m": [], "1m": [] };

    goals.forEach((g) => {
        if (!hideCompleted || g.status !== "achieved") {
            groups[g.horizon].push(g);
        }
    });

    // Sort each horizon by order_index, then separate completed
    for (const h of Object.keys(groups) as Horizon[]) {
        const sorted = groups[h].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
        const active = sorted.filter((g) => g.status !== "achieved");
        const done = sorted.filter((g) => g.status === "achieved");
        groups[h] = [...active, ...done];
    }

    function GoalCard(goal: Goal) {
        return (
            <div
                key={goal.id}
                className="rounded-2xl border border-app-border bg-app-card p-4 mb-3 text-xs text-app-main"
            >
                <div className="flex justify-between gap-3">
                    <p className="text-app-main font-medium break-words">{goal.title}</p>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => moveGoal(goal, "up")}
                            className="text-[10px] text-app-muted hover:text-app-accent-color px-1"
                        >
                            ▲
                        </button>
                        <button
                            onClick={() => moveGoal(goal, "down")}
                            className="text-[10px] text-app-muted hover:text-app-accent-color px-1"
                        >
                            ▼
                        </button>
                    </div>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-app-muted text-[11px]">
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
                        className="rounded bg-app-input border border-app-border px-2 py-1 text-[10px] text-app-main"
                    >
                        <option value="not_started">Not started</option>
                        <option value="in_progress">In progress</option>
                        <option value="achieved">Achieved</option>
                    </select>

                    <button
                        onClick={() => startEdit(goal)}
                        className="text-app-muted hover:text-app-accent-color text-[10px] whitespace-nowrap px-1"
                    >
                        Edit
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-6">
            <header className="mb-5 flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-app-main">Goals</h1>
                    <label className="mt-1 flex items-center gap-2 text-[11px] text-app-muted">
                        <input
                            type="checkbox"
                            checked={hideCompleted}
                            onChange={(e) => setHideCompleted(e.target.checked)}
                            className="h-3 w-3 rounded border-app-border bg-app-input text-app-accent focus:ring-app-accent"
                        />
                        Hide completed
                    </label>
                </div>

                <div className="flex flex-col gap-2">
                    <button
                        onClick={() => {
                            if (showNewGoal) {
                                setShowNewGoal(false);
                                setEditingId(null);
                                setNewTitle("");
                            } else {
                                setShowNewGoal(true);
                                setEditingId(null);
                                setNewTitle("");
                            }
                        }}
                        className="rounded-full border border-app-border bg-app-card px-3 py-1 text-[11px] text-app-main hover:border-app-accent"
                    >
                        {showNewGoal ? "Close" : "New goal"}
                    </button>
                </div>
            </header>

            {showNewGoal && (
                <section className="mb-6 rounded-2xl border border-app-border bg-app-card p-4 text-xs">
                    <h2 className="text-app-main font-semibold mb-2">{editingId ? "Edit goal" : "New goal"}</h2>

                    <label className="text-[11px] text-app-muted">Horizon</label>
                    <select
                        value={newHorizon}
                        onChange={(e) => setNewHorizon(e.target.value as Horizon)}
                        className="mt-1 block w-full rounded bg-app-input border border-app-border px-2 py-1 text-app-main"
                    >
                        <option value="3y">3 years</option>
                        <option value="1y">1 year</option>
                        <option value="6m">6 months</option>
                        <option value="1m">1 month</option>
                    </select>

                    <label className="mt-3 text-[11px] text-app-muted">Goal title</label>
                    <input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="mt-1 block w-full rounded bg-app-input border border-app-border px-2 py-1 text-app-main"
                    />

                    <label className="mt-3 text-[11px] text-app-muted">
                        Estimated finish date
                    </label>
                    <input
                        type="date"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="mt-1 block w-full rounded bg-app-input border border-app-border px-2 py-1 text-app-main"
                    />

                    <label className="mt-3 text-[11px] text-app-muted">Status</label>
                    <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value as GoalStatus)}
                        className="mt-1 block w-full rounded bg-app-input border border-app-border px-2 py-1 text-app-main"
                    >
                        <option value="not_started">Not started</option>
                        <option value="in_progress">In progress</option>
                        <option value="achieved">Achieved</option>
                    </select>

                    <div className="mt-4 flex gap-2">
                        <button
                            onClick={handleSaveGoal}
                            className="flex-1 rounded-full bg-app-accent py-1.5 text-xs text-app-accent-text font-semibold"
                        >
                            {editingId ? "Save Changes" : "Add goal"}
                        </button>
                        {editingId && (
                            <button
                                onClick={() => deleteGoal(editingId)}
                                className="rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                            >
                                Delete
                            </button>
                        )}
                    </div>
                </section>
            )}

            <section>
                {groups["3y"].length > 0 && <h2 className="text-xs text-app-muted uppercase mb-1">3 years</h2>}
                {groups["3y"].map(GoalCard)}

                {groups["1y"].length > 0 && <h2 className="text-xs text-app-muted uppercase mt-5 mb-1">1 year</h2>}
                {groups["1y"].map(GoalCard)}

                {groups["6m"].length > 0 && <h2 className="text-xs text-app-muted uppercase mt-5 mb-1">6 months</h2>}
                {groups["6m"].map(GoalCard)}

                {groups["1m"].length > 0 && <h2 className="text-xs text-app-muted uppercase mt-5 mb-1">1 month</h2>}
                {groups["1m"].map(GoalCard)}
            </section>
        </div>
    );
}
