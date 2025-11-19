"use client";

import { useEffect, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import { AuthGuardHeader } from "@/components/AuthGuardHeader";
import { applySavedTextSize } from "@/lib/textSize";

type ScheduleType = "daily" | "weekdays" | "weekly" | "monthly";
interface Routine {
  id: string;
  user_id: string;
  title: string;
  schedule_type: ScheduleType;
  times_per_week: number | null;
}

interface RoutineLog {
  id: string;
  routine_id: string;
  user_id: string;
  day: string; // yyyy-MM-dd
  completed: boolean;
  notes: string | null;
}

export default function FoundationPage() {
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [intention, setIntention] = useState("");
  const [loadingIntention, setLoadingIntention] = useState(false);

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [logsByRoutine, setLogsByRoutine] = useState<Record<string, RoutineLog>>(
    {}
  );
  const [goldStreak, setGoldStreak] = useState(0);
  const [showNewRoutine, setShowNewRoutine] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    applySavedTextSize();
  }, []);

  useEffect(() => {
    loadDay(selectedDate);
    computeGoldStreak();
  }, [selectedDate]);

  async function loadDay(day: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const [routinesRes, logsRes] = await Promise.all([
      supabase.from("routines").select("*").eq("user_id", user.id),
      supabase
        .from("routine_logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("day", day),
    ]);

    if (!routinesRes.error && routinesRes.data) {
      setRoutines(routinesRes.data as Routine[]);
    }

    if (!logsRes.error && logsRes.data) {
      const byId: Record<string, RoutineLog> = {};
      (logsRes.data as RoutineLog[]).forEach((log) => {
        byId[log.routine_id] = log;
      });
      setLogsByRoutine(byId);
    }
  }

  async function computeGoldStreak() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("routine_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("day", { ascending: false })
      .limit(60);

    if (error || !data) {
      setGoldStreak(0);
      return;
    }

    const logs = data as RoutineLog[];
    const daysSet = new Map<string, RoutineLog[]>();

    logs.forEach((log) => {
      if (!daysSet.has(log.day)) daysSet.set(log.day, []);
      daysSet.get(log.day)!.push(log);
    });

    let streak = 0;
    let currentDay = format(new Date(), "yyyy-MM-dd");

    while (true) {
      const dayLogs = daysSet.get(currentDay);
      if (!dayLogs || dayLogs.length === 0) break;
      const allCompleted = dayLogs.every((l) => l.completed);
      if (!allCompleted) break;

      streak += 1;
      currentDay = format(addDays(parseISO(currentDay), -1), "yyyy-MM-dd");
    }

    setGoldStreak(streak);
  }

  async function toggleRoutineCompletion(routine: Routine) {
    const existing = logsByRoutine[routine.id];

    if (existing) {
      const updated = { ...existing, completed: !existing.completed };
      await supabase
        .from("routine_logs")
        .update(updated)
        .eq("id", existing.id);
      setLogsByRoutine((prev) => ({ ...prev, [routine.id]: updated }));
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("routine_logs")
        .insert({
          user_id: user.id,
          routine_id: routine.id,
          day: selectedDate,
          completed: true,
          notes: null,
        })
        .select("*")
        .single();

      if (!error && data) {
        setLogsByRoutine((prev) => ({
          ...prev,
          [routine.id]: data as RoutineLog,
        }));
      }
    }

    computeGoldStreak();
  }

  async function updateNotes(routine: Routine, notes: string) {
    const existing = logsByRoutine[routine.id];

    if (existing) {
      const updated = { ...existing, notes };
      await supabase
        .from("routine_logs")
        .update(updated)
        .eq("id", existing.id);
      setLogsByRoutine((prev) => ({ ...prev, [routine.id]: updated }));
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("routine_logs")
        .insert({
          user_id: user.id,
          routine_id: routine.id,
          day: selectedDate,
          completed: false,
          notes,
        })
        .select("*")
        .single();

      if (!error && data) {
        setLogsByRoutine((prev) => ({
          ...prev,
          [routine.id]: data as RoutineLog,
        }));
      }
    }
  }

  async function createRoutine() {
    const title = newTitle.trim();
    if (!title) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("routines")
      .insert({
        user_id: user.id,
        title,
        schedule_type: "daily",
        times_per_week: null,
      })
      .select("*")
      .single();

    if (!error && data) {
      setRoutines((prev) => [...prev, data as Routine]);
      setNewTitle("");
      setShowNewRoutine(false);
    }
  }

  async function deleteRoutine(routineId: string) {
    await supabase.from("routines").delete().eq("id", routineId);
    setRoutines((prev) => prev.filter((r) => r.id !== routineId));
    setLogsByRoutine((prev) => {
      const clone = { ...prev };
      delete clone[routineId];
      return clone;
    });
  }

  const completedCount = routines.filter(
    (r) => logsByRoutine[r.id]?.completed
  ).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <AuthGuardHeader />

      <main className="mx-auto max-w-md px-4 pb-28 pt-4">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              Today
            </p>
            <p className="text-lg font-semibold">
              {format(parseISO(selectedDate), "EEEE, MMM d")}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {completedCount}/{routines.length} habits today
            </p>
            <p className="mt-1 text-[11px] text-amber-300">
              Gold streak: {goldStreak}{" "}
              {goldStreak === 1 ? "day" : "days"} with all habits done
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-full bg-slate-900 border border-slate-700 px-3 py-1 text-xs text-slate-100"
            />
          </div>
        </header>

        {/* Intention */}
        <section className="mb-4 rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Daily intention
            </p>
            <button
              type="button"
              disabled={loadingIntention}
              onClick={async () => {
                setLoadingIntention(true);
                try {
                  const res = await fetch("/api/intention", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ date: selectedDate }),
                  });
                  const json = await res.json();
                  setIntention(json.intention ?? "");
                } finally {
                  setLoadingIntention(false);
                }
              }}
              className="text-[11px] text-emerald-400"
            >
              {loadingIntention ? "..." : "New"}
            </button>
          </div>
          <textarea
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            placeholder="Today, I will..."
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 min-h-[72px]"
          />
        </section>

        {/* Habits */}
        <section className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Daily habits
            </p>
            <button
              onClick={() => setShowNewRoutine((v) => !v)}
              className="text-[11px] text-emerald-400"
            >
              {showNewRoutine ? "Close" : "+ Add"}
            </button>
          </div>

          {showNewRoutine && (
            <div className="mb-4 rounded-2xl border border-slate-700 bg-slate-900/80 p-3 text-xs">
              <p className="mb-1 text-slate-300">New habit</p>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Habit name..."
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100"
              />
              <button
                onClick={createRoutine}
                className="mt-3 w-full rounded-full bg-emerald-500 py-1.5 text-xs font-semibold text-slate-950"
              >
                Save habit
              </button>
            </div>
          )}

          {routines.map((routine) => {
            const log = logsByRoutine[routine.id];
            const completed = !!log?.completed;

            return (
              <div
                key={routine.id}
                className="mb-3 rounded-2xl border border-slate-700 bg-slate-900/80 p-3 text-xs"
              >
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => toggleRoutineCompletion(routine)}
                    className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                      completed
                        ? "border-emerald-400 bg-emerald-500 text-slate-950"
                        : "border-slate-600 bg-slate-900 text-slate-500"
                    }`}
                  >
                    {completed ? "✓" : ""}
                  </button>
                  <div className="flex-1">
                    <p className="font-medium text-slate-100">
                      {routine.title}
                    </p>
                    <p className="text-[11px] text-slate-400">Daily</p>
                  </div>
                  <button
                    onClick={() => deleteRoutine(routine.id)}
                    className="text-[11px] text-red-400"
                  >
                    Remove →
                  </button>
                </div>

                <textarea
                  value={log?.notes ?? ""}
                  onChange={(e) => updateNotes(routine, e.target.value)}
                  placeholder="Notes or extra effort for this habit today..."
                  className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 min-h-[56px]"
                />
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
