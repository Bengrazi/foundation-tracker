"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Foundation } from "@/lib/engagementTypes";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function HabitManager() {
    const [habits, setHabits] = useState<Foundation[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);

    // Form State
    const [title, setTitle] = useState("");
    const [days, setDays] = useState<string[]>(DAYS); // Default all
    const [times, setTimes] = useState(1);

    useEffect(() => {
        loadHabits();
    }, []);

    const loadHabits = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from("foundations")
            .select("*")
            .eq("user_id", user.id)
            .order("order_index", { ascending: true });

        if (data) setHabits(data as Foundation[]);
        setLoading(false);
    };

    const handleEdit = (habit: Foundation) => {
        setEditingId(habit.id);
        setTitle(habit.title);
        // Cast to any to access new columns if types aren't updated globally yet
        setDays((habit as any).days_of_week || DAYS);
        setTimes((habit as any).times_per_day || 1);
        setShowForm(true);
    };

    const handleAddNew = () => {
        setEditingId(null);
        setTitle("");
        setDays(DAYS); // Default to daily
        setTimes(1);
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!title.trim()) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const payload = {
            title,
            days_of_week: days,
            times_per_day: times,
            // defaults
            schedule_type: "daily", // legacy fallback
            start_date: new Date().toISOString().split('T')[0],
        };

        if (editingId) {
            await supabase.from("foundations").update(payload).eq("id", editingId);
        } else {
            await supabase.from("foundations").insert({
                ...payload,
                user_id: user.id,
                order_index: (habits.length + 1) * 1000
            });
        }

        setShowForm(false);
        loadHabits();
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this habit permanently?")) return;

        // 1. Delete associated logs first (FK constraint safety)
        await supabase.from("foundation_logs").delete().eq("foundation_id", id);

        // 2. Delete the habit
        await supabase.from("foundations").delete().eq("id", id);

        loadHabits();
        if (editingId === id) setShowForm(false);
    };

    const toggleDay = (d: string) => {
        if (days.includes(d)) {
            setDays(days.filter(x => x !== d));
        } else {
            setDays([...days, d]);
        }
    };

    const moveHabit = async (index: number, direction: "up" | "down") => {
        if (direction === "up" && index === 0) return;
        if (direction === "down" && index === habits.length - 1) return;

        const swapIndex = direction === "up" ? index - 1 : index + 1;
        const newHabits = [...habits];

        // Swap
        [newHabits[index], newHabits[swapIndex]] = [newHabits[swapIndex], newHabits[index]];

        // Optimistic
        setHabits(newHabits);

        // Persist
        const h1 = newHabits[index];
        const h2 = newHabits[swapIndex];

        // Use UPDATE instead of UPSERT to avoid needing all required fields
        await Promise.all([
            supabase.from("foundations").update({ order_index: index * 1000 }).eq("id", h1.id),
            supabase.from("foundations").update({ order_index: swapIndex * 1000 }).eq("id", h2.id)
        ]);
    };

    if (loading) return <div className="text-xs text-app-muted">Loading habits...</div>;

    return (
        <div className="space-y-4">
            {!showForm ? (
                <>
                    <div className="space-y-2">
                        {habits.map((h, i) => (
                            <div key={h.id} className="flex items-center justify-between p-3 bg-app-card border border-app-border rounded-xl">
                                <div>
                                    <div className="text-sm font-medium text-app-main">{h.title}</div>
                                    <div className="text-[10px] text-app-muted">
                                        {(h as any).times_per_day || 1}x/day • {((h as any).days_of_week || []).length === 7 ? "Every day" : ((h as any).days_of_week || []).join(", ")}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col">
                                        <button onClick={() => moveHabit(i, "up")} className="text-[10px] text-app-muted hover:text-white">▲</button>
                                        <button onClick={() => moveHabit(i, "down")} className="text-[10px] text-app-muted hover:text-white">▼</button>
                                    </div>
                                    <button onClick={() => handleEdit(h)} className="text-xs text-app-accent hover:underline px-2">Edit</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={handleAddNew}
                        className="w-full py-2 border border-dashed border-app-border rounded-xl text-xs text-app-muted hover:text-app-main hover:border-app-accent"
                    >
                        + Add Habit
                    </button>
                </>
            ) : (
                <div className="p-4 bg-app-card border border-app-border rounded-xl space-y-4">
                    <h3 className="text-sm font-semibold text-app-main">{editingId ? "Edit Habit" : "New Habit"}</h3>

                    <div>
                        <label className="block text-xs text-app-muted mb-1">Title</label>
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full bg-app-input border border-app-border rounded-lg px-3 py-2 text-sm text-app-main focus:border-app-accent outline-none"
                            placeholder="e.g. Deep Work"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-app-muted mb-1">Schedule</label>
                        <div className="flex gap-1">
                            {DAYS.map(d => (
                                <button
                                    key={d}
                                    onClick={() => toggleDay(d)}
                                    className={`flex-1 py-1.5 text-[10px] rounded-md border text-center transition-colors
                                        ${days.includes(d)
                                            ? "bg-app-accent text-app-accent-text border-app-accent"
                                            : "bg-app-input text-app-muted border-app-border hover:bg-app-card-hover"
                                        }
                                    `}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-app-muted mb-1">Times per day</label>
                        <div className="flex gap-2">
                            {[1, 2, 3].map(n => (
                                <button
                                    key={n}
                                    onClick={() => setTimes(n)}
                                    className={`flex-1 py-1.5 text-xs rounded-md border text-center
                                        ${times === n
                                            ? "bg-app-accent text-app-accent-text border-app-accent"
                                            : "bg-app-input text-app-muted border-app-border hover:bg-app-card-hover"
                                        }
                                    `}
                                >
                                    {n}x
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={handleSave}
                            disabled={!title.trim() || days.length === 0}
                            className="flex-1 py-2 bg-app-accent text-app-accent-text rounded-lg text-xs font-semibold disabled:opacity-50"
                        >
                            Save
                        </button>
                        <button
                            onClick={() => setShowForm(false)}
                            className="flex-1 py-2 bg-transparent border border-app-border text-app-muted rounded-lg text-xs hover:text-app-main"
                        >
                            Cancel
                        </button>
                    </div>

                    {editingId && (
                        <div className="pt-2 border-t border-app-border/50">
                            <button onClick={() => handleDelete(editingId)} className="text-red-500 text-xs w-full text-center hover:underline">
                                Delete Habit
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
