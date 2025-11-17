// app/reflect/page.tsx
"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { AuthGuardHeader } from "@/components/AuthGuardHeader";

type Entry = {
  date: string; // YYYY-MM-DD
  mood: number | null;
  text: string;
};

const STORAGE_KEY = "foundation_reflections_v1";

export default function ReflectPage() {
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [mood, setMood] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [savedMessage, setSavedMessage] = useState("");

  const label = format(parseISO(selectedDate), "EEEE, MMM d");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Record<string, Entry>;
        setEntries(parsed);
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    const entry = entries[selectedDate];
    setMood(entry?.mood ?? null);
    setText(entry?.text ?? "");
  }, [selectedDate, entries]);

  const moods = [
    { value: 1, label: "😔" },
    { value: 2, label: "😕" },
    { value: 3, label: "😐" },
    { value: 4, label: "🙂" },
    { value: 5, label: "😄" },
  ];

  const saveEntry = () => {
    const updated: Entry = {
      date: selectedDate,
      mood,
      text,
    };
    const newEntries = { ...entries, [selectedDate]: updated };
    setEntries(newEntries);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries));
    }
    setSavedMessage("Saved ✔");
    setTimeout(() => setSavedMessage(""), 1500);
  };

  return (
    <div className="space-y-4">
      <AuthGuardHeader />

      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Reflection
        </p>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">{label}</h1>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-xl border border-slate-200 px-2 py-1 text-xs outline-none focus:border-slate-400"
          />
        </div>
      </header>

      <section className="space-y-2">
        <p className="text-sm text-slate-700">How are you feeling today?</p>
        <div className="flex gap-2">
          {moods.map((m) => (
            <button
              key={m.value}
              onClick={() => setMood(m.value)}
              className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                mood === m.value
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <span className="text-lg">{m.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          placeholder="Share about your day..."
        />
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            🔒 Your reflections are private and only used to generate your
            personal AI responses.
          </p>
          {savedMessage && (
            <p className="text-[11px] text-emerald-600">{savedMessage}</p>
          )}
        </div>
        <button
          onClick={saveEntry}
          className="mt-1 w-full rounded-xl bg-emerald-600 py-2 text-sm font-medium text-white"
        >
          Save entry
        </button>
      </section>
    </div>
  );
}
