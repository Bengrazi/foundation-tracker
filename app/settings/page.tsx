// app/settings/page.tsx
"use client";

import { useEffect, useState } from "react";
import { applySavedTextSize, setTextSize, TextSize } from "@/lib/textSize";

const ROUTINE_STORAGE_KEY = "foundation_routines_v1";
const LOGS_STORAGE_KEY = "foundation_logs_v1";
const GOLD_STORAGE_KEY = "foundation_gold_streak_v1";
const DATE_STORAGE_KEY = "foundation_last_date_v1";
const PROFILE_STORAGE_KEY = "foundation_profile_v1";
const GOALS_STORAGE_KEY = "foundation_goals_v1";
const REFLECTIONS_KEY = "foundation_reflections_v1";
const REFLECT_DATE_KEY = "foundation_reflect_last_date_v1";
const UI_TEXT_KEY = "foundation_ui_text_size_v1";

type DayRoutineState = { done: boolean; notes: string };
type LogsByDate = { [date: string]: { [routineId: string]: DayRoutineState } };

type Routine = {
  id: string;
  name: string;
  createdAt: string;
  deletedFrom?: string;
};

type ReflectionDay = {
  mood: number | null;
  text: string;
};

type ReflectionsByDate = {
  [date: string]: ReflectionDay;
};

function escapeCsv(value: string): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(range: "30" | "all"): string {
  if (typeof window === "undefined") return "";

  const routines: Routine[] = JSON.parse(
    window.localStorage.getItem(ROUTINE_STORAGE_KEY) || "[]"
  );
  const logs: LogsByDate = JSON.parse(
    window.localStorage.getItem(LOGS_STORAGE_KEY) || "{}"
  );
  const reflections: ReflectionsByDate = JSON.parse(
    window.localStorage.getItem(REFLECTIONS_KEY) || "{}"
  );

  const routineById = new Map<string, Routine>();
  routines.forEach((r) => routineById.set(r.id, r));

  const allDates = new Set<string>();
  Object.keys(logs).forEach((d) => allDates.add(d));
  Object.keys(reflections).forEach((d) => allDates.add(d));

  const today = new Date();
  const cutoff =
    range === "30"
      ? new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30)
      : new Date(2000, 0, 1);

  const header = [
    "category",
    "date",
    "name",
    "status",
    "notes_or_text",
    "extra",
  ];
  const rows: string[][] = [header];

  const dateStrings = Array.from(allDates).sort();

  for (const ds of dateStrings) {
    const d = new Date(ds);
    if (d < cutoff) continue;

    // Routines
    const dayLog = logs[ds];
    if (dayLog) {
      for (const [routineId, state] of Object.entries(dayLog)) {
        const routine = routineById.get(routineId);
        rows.push([
          "habit",
          ds,
          routine ? routine.name : routineId,
          state.done ? "done" : "not_done",
          state.notes || "",
          "",
        ]);
      }
    }

    // Reflections
    const ref = reflections[ds];
    if (ref && (ref.text || ref.mood != null)) {
      rows.push([
        "reflection",
        ds,
        "",
        ref.mood != null ? String(ref.mood) : "",
        ref.text || "",
        "",
      ]);
    }
  }

  return rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
}

function downloadCsv(range: "30" | "all") {
  const csv = buildCsv(range);
  if (!csv) {
    alert("No data found to export yet.");
    return;
  }
  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const suffix = range === "30" ? "last_30_days" : "all_time";
  const a = document.createElement("a");
  a.href = url;
  a.download = `foundation_export_${suffix}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const ALL_KEYS_TO_RESET = [
  ROUTINE_STORAGE_KEY,
  LOGS_STORAGE_KEY,
  GOLD_STORAGE_KEY,
  DATE_STORAGE_KEY,
  PROFILE_STORAGE_KEY,
  GOALS_STORAGE_KEY,
  REFLECTIONS_KEY,
  REFLECT_DATE_KEY,
  UI_TEXT_KEY,
];

export default function SettingsPage() {
  const [textSize, setLocalTextSize] = useState<TextSize>("small");

  useEffect(() => {
    applySavedTextSize();
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(UI_TEXT_KEY) as TextSize | null;
    if (saved === "medium" || saved === "large" || saved === "small") {
      setLocalTextSize(saved);
    }
  }, []);

  const changeSize = (size: TextSize) => {
    setLocalTextSize(size);
    setTextSize(size);
  };

  const handleReset = () => {
    const first = window.confirm(
      "This will erase your local habits, reflections, goals, and AI profile on this device. Your login stays, but app data resets. Continue?"
    );
    if (!first) return;
    const second = window.confirm(
      "Are you absolutely sure? This cannot be undone."
    );
    if (!second) return;

    ALL_KEYS_TO_RESET.forEach((k) => window.localStorage.removeItem(k));

    // Reload into a clean state; onboarding will run again from Foundation.
    window.location.href = "/foundation";
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] space-y-4 bg-slate-950 text-slate-100">
      <header className="pt-2">
        <h1 className="text-2xl font-semibold text-amber-50">Settings</h1>
        <p className="mt-1 text-xs text-slate-400">
          Export your data, reset the app, or adjust text size.
        </p>
      </header>

      <section className="space-y-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-700">
        <h2 className="text-sm font-semibold text-slate-50">Export data</h2>
        <p className="text-xs text-slate-400">
          Exports habits and reflections as a CSV file you can open in Excel or
          Google Sheets.
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={() => downloadCsv("30")}
            className="rounded-full bg-slate-800 px-3 py-1.5 text-slate-100 hover:bg-slate-700"
          >
            Export last 30 days
          </button>
          <button
            onClick={() => downloadCsv("all")}
            className="rounded-full bg-slate-800 px-3 py-1.5 text-slate-100 hover:bg-slate-700"
          >
            Export all time
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-700">
        <h2 className="text-sm font-semibold text-slate-50">Text size</h2>
        <p className="text-xs text-slate-400">
          Adjust how large text appears across the app on this device.
        </p>
        <div className="flex gap-2 text-xs">
          {[
            { value: "small", label: "Small" },
            { value: "medium", label: "Medium" },
            { value: "large", label: "Large" },
          ].map((opt) => {
            const active = textSize === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => changeSize(opt.value as TextSize)}
                className={`flex-1 rounded-full border px-3 py-1.5 ${
                  active
                    ? "border-emerald-400 bg-emerald-500/10 text-emerald-300"
                    : "border-slate-600 bg-slate-900 text-slate-200"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl bg-slate-900 p-4 ring-1 ring-red-500/60">
        <h2 className="text-sm font-semibold text-red-300">Reset app</h2>
        <p className="text-xs text-slate-300">
          This resets Foundation on <strong>this device only</strong>:
        </p>
        <ul className="list-disc pl-5 text-xs text-slate-400">
          <li>Clears habits, streaks, and notes.</li>
          <li>Clears reflections.</li>
          <li>Clears current goals and AI profile.</li>
          <li>
            Keeps your login, then sends you back through the starting questions
            so goals and daily intention can be recreated by AI.
          </li>
        </ul>
        <button
          onClick={handleReset}
          className="mt-2 w-full rounded-xl bg-red-500 py-2 text-xs font-semibold text-slate-950 hover:bg-red-400"
        >
          Reset Foundation on this device
        </button>
      </section>
    </div>
  );
}
