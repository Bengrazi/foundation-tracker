"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import { applySavedTextSize } from "@/lib/textSize";
import { awardPoints, POINTS } from "@/lib/points";
import { useGlobalState } from "./GlobalStateProvider";

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
    const { refreshPoints } = useGlobalState();
    const [goals, setGoals] = useState<Goal[]>([]);
    const [hideCompleted, setHideCompleted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showNewGoal, setShowNewGoal] = useState(false);

    // Default to "1m" (Weekly) for new goals as it's the top priority now
    const [newHorizon, setNewHorizon] = useState<Horizon>("1m");
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

    async function handleStatusChange(goal: Goal, newStatus: GoalStatus) {
        // Optimistic update
        setGoals((prev) =>
            prev.map((g) =>
                g.id === goal.id
                    ? { ...goal, status: newStatus }
                    : g
            )
        );

        // Award points if completing
        if (goal.status !== "achieved" && newStatus === "achieved") {
            // Check if we already awarded for this? Use local storage or just trust standard logic?
            // Simple logic: Award 50 points for a goal!
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await awardPoints(user.id, 50, "goal_achieved", goal.id);
                refreshPoints(); // Update global state
            }
        }

        // Persist
        await supabase.from("goals").update({ status: newStatus }).eq("id", goal.id);
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
                    <p className={`text-app-main font-bold text-sm break-words ${goal.status === 'achieved' ? 'line-through opacity-50' : ''}`}>
                        {goal.title}
                    </p>
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
                        Target: {format(parseISO(goal.target_date), "MMM d, yyyy")}
                    </span>

                    <select
                        value={goal.status}
                        onChange={(e) => handleStatusChange(goal, e.target.value as GoalStatus)}
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
                    <h1 className="text-lg font-semibold text-app-main">Plan & Conquer</h1>
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
                        {showNewGoal ? "Close" : "+ New Goal"}
                    </button>
                </div>
            </header>

            {showNewGoal && (
                <section className="mb-6 rounded-2xl border border-app-border bg-app-card p-4 text-xs">
                    <h2 className="text-app-main font-semibold mb-2">{editingId ? "Edit goal" : "New goal"}</h2>

                    <label className="text-[11px] text-app-muted">Time Horizon</label>
                    <select
                        value={newHorizon}
                        onChange={(e) => setNewHorizon(e.target.value as Horizon)}
                        className="mt-1 block w-full rounded bg-app-input border border-app-border px-2 py-1 text-app-main"
                    >
                        <option value="1m">Weekly Focus (Urgent)</option>
                        <option value="6m">6 Months</option>
                        <option value="1y">1 Year</option>
                        <option value="3y">3 Years</option>
                    </select>

                    <label className="mt-3 text-[11px] text-app-muted">Goal title</label>
                    <input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="e.g. Launch the MVP"
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
                            {editingId ? "Save Changes" : "Create Goal"}
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

            <section className="space-y-6">
                {/* 1. WEEKLY / SHORT TERM (Top Priority) */}
                <div>
                    <h2 className="text-sm font-bold text-app-accent-color uppercase tracking-wider mb-2 border-b border-app-border pb-1">
                        Weekly Focus
                    </h2>
                    {groups["1m"].length === 0 && <p className="text-xs text-app-muted italic">No active weekly goals.</p>}
                    {groups["1m"].map(GoalCard)}
                </div>

                {/* 2. 6 MONTHS */}
                <div>
                    <h2 className="text-xs font-semibold text-app-muted uppercase tracking-wider mb-2 mt-4">6 Months</h2>
                    {groups["6m"].map(GoalCard)}
                </div>

                {/* 3. 1 YEAR */}
                <div>
                    <h2 className="text-xs font-semibold text-app-muted uppercase tracking-wider mb-2 mt-4">1 Year</h2>
                    {groups["1y"].map(GoalCard)}
                </div>

                {/* 4. 3 YEARS */}
                <div>
                    <h2 className="text-xs font-semibold text-app-muted uppercase tracking-wider mb-2 mt-4">3 Years (Vision)</h2>
                    {groups["3y"].map(GoalCard)}
                </div>
            </section>
        </div>
    );
}
