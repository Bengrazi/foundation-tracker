"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import { AuthGuardHeader } from "@/components/AuthGuardHeader";
import { ChatWidget } from "@/components/ChatWidget";
import { applySavedTextSize } from "@/lib/textSize";
import { DailyAIQuestion } from "@/components/DailyAIQuestion";
import { awardPoints, POINTS } from "@/lib/points";
import { useGlobalState } from "@/components/GlobalStateProvider";

type Mood = 1 | 2 | 3 | 4 | 5;

interface Reflection {
  id: string;
  user_id: string;
  day: string; // yyyy-MM-dd
  mood: Mood | null;
  text: string | null;
}

export default function ReflectPage() {
  const { refreshPoints } = useGlobalState();
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [mood, setMood] = useState<Mood | null>(null);
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [showJournal, setShowJournal] = useState(true);
  const [showAIQuestion, setShowAIQuestion] = useState(false);

  // Track if we've already earned points for today's entry to avoid duplicates
  const [hasReflected, setHasReflected] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);

  const SEPARATOR = "\n\n--- Daily Question Answer ---\n";

  useEffect(() => {
    applySavedTextSize();
    if (typeof window !== "undefined") {
      setShowJournal(localStorage.getItem("foundation_show_journal") !== "false");
      setShowAIQuestion(localStorage.getItem("foundation_daily_ai_question_enabled") === "true");
    }
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
      const fullText = r.text ?? "";

      let loadedText = "";
      let loadedAnswer = "";

      if (fullText.includes(SEPARATOR)) {
        const parts = fullText.split(SEPARATOR);
        loadedText = parts[0];
        loadedAnswer = parts[1];
        setText(loadedText);
        setAnswer(loadedAnswer);
      } else {
        loadedText = fullText;
        setText(loadedText);
        setAnswer("");
      }

      // Determine initial point status based on content existence
      setHasReflected(!!loadedText.trim() || !!r.mood);
      setHasAnswered(!!loadedAnswer.trim());

    } else {
      setMood(null);
      setText("");
      setAnswer("");
      setHasReflected(false);
      setHasAnswered(false);
    }
  }

  async function saveReflection() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);

    const fullText = text + (answer.trim() ? SEPARATOR + answer.trim() : "");

    const { data, error } = await supabase
      .from("reflections")
      .upsert(
        {
          user_id: user.id,
          day: selectedDate,
          mood,
          text: fullText,
        },
        {
          onConflict: "user_id,day",
        }
      )
      .select("*")
      .single();

    if (!error && data) {
      // Award Points Logic
      let pointsAwarded = 0;
      const promises = [];

      // 1. Reflection Points
      // If we hadn't reflected before, and now we have some text or mood
      const isReflectingNow = !!text.trim() || !!mood;
      if (!hasReflected && isReflectingNow) {
        promises.push(awardPoints(user.id, POINTS.REFLECTION, "daily_reflection", selectedDate));
        setHasReflected(true);
        pointsAwarded += POINTS.REFLECTION;
      }

      // 2. Question Points
      // If we hadn't answered before, and now we have an answer
      const isAnsweringNow = !!answer.trim();
      if (!hasAnswered && isAnsweringNow) {
        promises.push(awardPoints(user.id, POINTS.DAILY_QUESTION, "daily_question", selectedDate));
        setHasAnswered(true);
        pointsAwarded += POINTS.DAILY_QUESTION;
      }

      if (promises.length > 0) {
        await Promise.all(promises);
        await refreshPoints();
      }

      alert(pointsAwarded > 0 ? `Saved! +${pointsAwarded} Cherries 🍒` : "Reflection saved!");
    } else if (error) {
      console.error("Error saving reflection", error);
      alert(`Error saving reflection: ${error.message}`);
    }

    setSaving(false);
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

        {showJournal && (
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
        )}

        {showAIQuestion && (
          <section className="mb-4 rounded-2xl border border-app-border bg-app-card p-4">
            <DailyAIQuestion />
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Your answer..."
              className="mt-3 w-full min-h-[80px] rounded-xl border border-app-border bg-app-input px-3 py-2 text-xs text-app-main"
            />
            <button
              onClick={saveReflection}
              disabled={saving}
              className="mt-3 w-full rounded-full bg-app-accent py-1.5 text-xs font-semibold text-app-accent-text disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Answer"}
            </button>
          </section>
        )}

        <div className="mt-6">
          <ChatWidget />
        </div>
      </main>
    </div>
  );
}
