"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { AuthGuardHeader } from "@/components/AuthGuardHeader";
import { applySavedTextSize } from "@/lib/textSize";

type Mood = 1 | 2 | 3 | 4 | 5;

type ReflectionDay = {
  mood: Mood | null;
  text: string;
};

type ReflectionsByDate = {
  [date: string]: ReflectionDay;
};

const STORAGE_KEY = "foundation_reflections_v1";
const DATE_KEY = "foundation_reflect_last_date_v1";

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ReflectPage() {
  useEffect(() => {
    applySavedTextSize();
  }, []);

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [reflections, setReflections] = useState<ReflectionsByDate>({});
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedDate = localStorage.getItem(DATE_KEY);
    if (storedDate) setSelectedDate(storedDate);

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      setReflections(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const headerLabel = useMemo(
    () => format(parseISO(selectedDate), "EEEE, MMM d"),
    [selectedDate]
  );

  const current = reflections[selectedDate] ?? { mood: null, text: "" };

  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const setMood = (m: Mood) =>
    setReflections((prev) => {
      const next: ReflectionsByDate = {
        ...prev,
        [selectedDate]: { ...(prev[selectedDate] ?? { text: "" }), mood: m },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });

  const setText = (text: string) =>
    setReflections((prev) => {
      const next: ReflectionsByDate = {
        ...prev,
        [selectedDate]: { ...(prev[selectedDate] ?? { mood: null }), text },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });

  const saveEntry = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reflections));
    setSavedMessage("Saved ✔");
    setTimeout(() => setSavedMessage(""), 1500);
  };

  const dateInputId = "reflect-date-input";

  const moodOptions: { value: Mood; label: string; emoji: string }[] = [
    { value: 1, label: "Rough", emoji: "😣" },
    { value: 2, label: "Low", emoji: "😕" },
    { value: 3, label: "Okay", emoji: "😐" },
    { value: 4, label: "Good", emoji: "🙂" },
    { value: 5, label: "Great", emoji: "😄" },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] space-y-4 bg-slate-950 text-slate-100">
      <AuthGuardHeader />

      <header className="space-y-1 pt-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
              Reflection
            </p>
            <h1 className="text-2xl font-semibold text-amber-50">
              {headerLabel}
            </h1>
          </div>

          <div className="relative">
            <input
              id={dateInputId}
              type="date"
              value={selectedDate}
              onChange={(e) => {
                const next = e.target.value;
                setSelectedDate(next);
                localStorage.setItem(DATE_KEY, next);
              }}
              className="peer w-[140px] rounded-full border border-slate-600 bg-slate-900 px-3 py-1 text-xs text-slate-200 outline-none [color-scheme:dark] focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                const input = document.getElementById(
                  dateInputId
                ) as HTMLInputElement | null;
                const anyInput = input as any;
                if (input && typeof anyInput.showPicker === "function") {
                  anyInput.showPicker();
                } else {
                  input?.focus();
                }
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-emerald-400"
            >
              📅
            </button>
          </div>
        </div>
      </header>

      <section className="space-y-2">
        <p className="text-xs font-medium text-slate-300">
          How are you feeling today?
        </p>
        <div className="flex items-center gap-2">
          {moodOptions.map((m) => {
            const active = current.mood === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setMood(m.value)}
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-lg transition ${
                  active
                    ? "border-emerald-400 bg-emerald-500/10"
                    : "border-slate-600 bg-slate-900"
                }`}
                title={m.label}
              >
                {m.emoji}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2 rounded-2xl bg-slate-900 p-3 ring-1 ring-slate-700">
        <textarea
          value={current.text}
          onChange={(e) => {
            setText(e.target.value);
            autoGrow(e.currentTarget);
          }}
          rows={4}
          className="w-full whitespace-pre-wrap break-words overflow-hidden resize-none rounded-xl border border-slate-600 bg-slate-950/75 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
          placeholder="Share about your day..."
        />
        <p className="flex items-center gap-1 text-[11px] text-slate-400">
          <span>🔒</span>
          <span>
            Your reflections are private and only used to generate your personal AI
            responses.
          </span>
        </p>
        <div className="flex items-center justify-between">
          {savedMessage && (
            <span className="text-[11px] text-emerald-400">{savedMessage}</span>
          )}
          <button
            onClick={saveEntry}
            className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950"
          >
            Save entry
          </button>
        </div>
      </section>
    </div>
  );
}
