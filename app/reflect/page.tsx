"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import { AuthGuardHeader } from "@/components/AuthGuardHeader";
import { applySavedTextSize } from "@/lib/textSize";

type Mood = 1 | 2 | 3 | 4 | 5;

interface Reflection {
  id: string;
  user_id: string;
  day: string; // yyyy-MM-dd
  mood: Mood | null;
  text: string | null;
}

export default function ReflectPage() {
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [mood, setMood] = useState<Mood | null>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    applySavedTextSize();
  }, []);

  useEffect(() => {
    loadReflection(selectedDate);
  }, [selectedDate]);

  async function loadReflection(day: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("reflections")
      .select("*")
      .eq("user_id", user.id)
      .eq("day", day)
      .maybeSingle();

    if (!error && data) {
      const r = data as Reflection;
      setMood(r.mood);
      setText(r.text ?? "");
    } else {
      setMood(null);
      setText("");
    }
  }

  async function saveReflection() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);

    const { data, error } = await supabase
      .from("reflections")
      .upsert(
        {
          user_id: user.id,
          day: selectedDate,
          mood,
          text,
        },
        {
          onConflict: "user_id,day",
        }
      )
      .select("*")
      .single();

    setSaving(false);

    if (error) {
      console.error("Error saving reflection", error);
      alert(`Error saving reflection: ${error.message}`);
    } else if (data) {
      alert("Reflection saved!");
    }
  }

  const moods: { value: Mood; label: string; emoji: string }[] = [
    { value: 1, label: "Very low", emoji: "😢" },
    { value: 2, label: "Low", emoji: "😕" },
    { value: 3, label: "Neutral", emoji: "😐" },
    { value: 4, label: "Good", emoji: "🙂" },
    { value: 5, label: "Great", emoji: "🤩" },
  ];

  return (
    <div className="min-h-screen bg-app-main text-app-main transition-colors duration-300">
      <AuthGuardHeader />

      <main className="mx-auto max-w-md px-4 pb-28 pt-4">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-app-muted">
              Reflection
            </p>
            <p className="text-lg font-semibold text-app-main">
              {format(parseISO(selectedDate), "EEEE, MMM d")}
            </p>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-full bg-app-card border border-app-border px-3 py-1 text-xs text-app-main"
          />
        </header>

        <section className="mb-4 rounded-2xl border border-app-border bg-app-card p-4">
          <p className="mb-2 text-xs text-app-muted">
            How are you feeling today?
          </p>
          <div className="flex gap-2">
            {moods.map((m) => {
              const active = mood === m.value;
              return (
                <button
                  key={m.value}
                  onClick={() => setMood(m.value)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border text-lg ${active
                    ? "border-app-accent bg-app-accent/10"
                    : "border-app-border bg-app-input"
                    }`}
                >
                  {m.emoji}
                </button>
              );
            })}
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Share about your day..."
            className="mt-4 w-full min-h-[120px] rounded-xl border border-app-border bg-app-input px-3 py-2 text-xs text-app-main"
          />

          <p className="mt-2 text-[10px] text-app-muted flex items-center gap-1">
            <span>🔒</span>
            <span>
              Your reflections are private and only used to personalize your AI
              responses.
            </span>
          </p>

          <button
            onClick={saveReflection}
            disabled={saving}
            className="mt-4 w-full rounded-full bg-app-accent py-1.5 text-xs font-semibold text-app-accent-text disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save entry"}
          </button>
        </section>
      </main>
    </div>
  );
}
