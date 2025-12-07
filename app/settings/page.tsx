"use client";

import { useEffect, useState } from "react";
import { format, subDays } from "date-fns";
import { useRouter } from "next/navigation";
import { AuthGuardHeader } from "@/components/AuthGuardHeader";
import { supabase } from "@/lib/supabaseClient";
import { applySavedTextSize, setTextSize, TextSize } from "@/lib/textSize";

const ONBOARDING_KEY = "foundation_onboarding_done_v1";

type ExportRange = "30" | "all";

// Simple CSV helper
function toCsv(headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes('"') || str.includes(",") || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.join(",");
  const rowLines = rows.map((row) => row.map(escape).join(","));
  return [headerLine, ...rowLines].join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

import { applySavedTheme, setTheme, Theme } from "@/lib/theme";

// ... (imports)

export default function SettingsPage() {
  const router = useRouter();
  const [exporting, setExporting] = useState<ExportRange | null>(null);
  const [resetting, setResetting] = useState(false);
  const [textSize, setTextSizeState] = useState<TextSize>("small");
  const [theme, setThemeState] = useState<Theme>("dark");
  const [aiCoachEnabled, setAiCoachEnabled] = useState(true);
  const [showPlans, setShowPlans] = useState(true);
  const [showJournal, setShowJournal] = useState(true);
  const [dailyAiQuestionEnabled, setDailyAiQuestionEnabled] = useState(false);

  useEffect(() => {
    applySavedTextSize();
    applySavedTheme();

    if (typeof window !== "undefined") {
      const savedCoach = localStorage.getItem("foundation_ai_coach_enabled");
      if (savedCoach !== null) {
        setAiCoachEnabled(savedCoach === "true");
      }

      setShowPlans(localStorage.getItem("foundation_show_plans") !== "false");
      setShowJournal(localStorage.getItem("foundation_show_journal") !== "false");
      setDailyAiQuestionEnabled(localStorage.getItem("foundation_daily_ai_question_enabled") === "true");

      const savedTextSize = localStorage.getItem("foundation_ui_text_size_v1") as TextSize | null;
      if (savedTextSize) setTextSizeState(savedTextSize);

      const savedTheme = localStorage.getItem("foundation_theme") as Theme | null;
      if (savedTheme) setThemeState(savedTheme);
    }

    // Sync from DB
    const syncSettings = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("theme, text_size")
        .eq("id", auth.user.id)
        .single();

      if (profile) {
        if (profile.theme) {
          setTheme(profile.theme as Theme);
          setThemeState(profile.theme as Theme);
        }
        if (profile.text_size) {
          setTextSize(profile.text_size as TextSize);
          setTextSizeState(profile.text_size as TextSize);
        }
      }
    };
    syncSettings();
  }, []);

  const handleAiCoachToggle = (enabled: boolean) => {
    setAiCoachEnabled(enabled);
    localStorage.setItem("foundation_ai_coach_enabled", String(enabled));
  };

  const handleExportData = async (range: ExportRange) => {
    setExporting(range);
    try {
      const since = range === "30" ? format(subDays(new Date(), 30), "yyyy-MM-dd") : null;
      const sinceDate = since ? new Date(since) : null;

      // Foundations logs
      const logsPromise = supabase
        .from("foundation_logs")
        .select("*")
        .order("date", { ascending: true });

      const reflectionsPromise = supabase
        .from("reflections")
        .select("*")
        .order("date", { ascending: true });

      const goalsPromise = supabase
        .from("goals")
        .select("*")
        .order("target_date", { ascending: true });

      const [logsRes, reflRes, goalsRes] = await Promise.all([
        logsPromise,
        reflectionsPromise,
        goalsPromise,
      ]);

      if (logsRes.error) console.error("Export logs error", logsRes.error);
      if (reflRes.error) console.error("Export reflections error", reflRes.error);
      if (goalsRes.error) console.error("Export goals error", goalsRes.error);

      const logs = (logsRes.data || []) as any[];
      const reflections = (reflRes.data || []) as any[];
      const goals = (goalsRes.data || []) as any[];

      const rows: (string | number | null | undefined)[][] = [];

      // foundation logs
      for (const l of logs) {
        if (sinceDate && new Date(l.date) < sinceDate) continue;
        rows.push([
          "foundation_log",
          l.date,
          l.foundation_id,
          l.completed ? "1" : "0",
          l.notes ?? "",
        ]);
      }

      // reflections
      for (const r of reflections) {
        if (sinceDate && new Date(r.date) < sinceDate) continue;
        rows.push([
          "reflection",
          r.date,
          "",
          r.mood ?? "",
          r.text ?? "",
        ]);
      }

      // goals (always export all)
      for (const g of goals) {
        rows.push([
          "goal",
          g.target_date ?? "",
          g.title ?? "",
          g.status ?? "",
          g.horizon ?? "",
        ]);
      }

      const headers = ["type", "date", "field1", "field2", "field3"];
      const csv = toCsv(headers, rows);

      const suffix = range === "30" ? "last30" : "all";
      downloadCsv(`foundation-export-${suffix}.csv`, csv);
    } finally {
      setExporting(null);
    }
  };

  const handleReset = async () => {
    const first = window.confirm(
      "Reset Foundation on THIS device? This clears your habits, reflections, goals, and intentions."
    );
    if (!first) return;
    const second = window.confirm(
      "Are you sure? This cannot be undone. Past data will be deleted for your account."
    );
    if (!second) return;

    setResetting(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        // Still clear onboarding so they see questions again
        window.localStorage.removeItem(ONBOARDING_KEY);
        router.push("/foundation");
        return;
      }

      // RLS should ensure we only delete the current user's rows
      const results = await Promise.all([
        supabase.from("foundation_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("foundations").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("reflections").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("goals").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("daily_intentions").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        // Clear onboarding fields instead of deleting profile
        supabase.from("profiles").update({
          priorities: null,
          life_summary: null,
          ideology: null,
          key_truth: null,
          ai_voice: null
        }).eq("id", auth.user.id),
        supabase.from("board_members").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      ]);

      // Log any errors
      console.log("[Reset] Deletion results:", results);
      results.forEach((result, index) => {
        const tables = ["foundation_logs", "foundations", "reflections", "goals", "daily_intentions", "profiles", "board_members"];
        if (result.error) {
          console.error(`[Reset] Failed to delete from ${tables[index]}:`, result.error);
        } else {
          console.log(`[Reset] Successfully deleted from ${tables[index]}`);
        }
      });

      // Do NOT sign out. Just clear onboarding flag so they see questions again.
      window.localStorage.removeItem(ONBOARDING_KEY);

      // Clear celebration flags so first gold celebration shows again
      window.localStorage.removeItem("foundation_first_gold_celebration_shown");

      // Clear all date-specific celebration limits
      Object.keys(window.localStorage).forEach(key => {
        if (key.startsWith("foundation_celebration_")) {
          window.localStorage.removeItem(key);
        }
      });

      // Send them back to Foundation; onboarding modal will appear again.
      router.push("/foundation");
    } finally {
      setResetting(false);
    }
  };

  const textSizeOptions: { label: string; value: TextSize }[] = [
    { label: "Small", value: "small" },
    { label: "Medium", value: "medium" },
    { label: "Large", value: "large" },
    { label: "Extra Large", value: "xl" },
  ];

  const themeOptions: { label: string; value: Theme }[] = [
    { label: "Dark", value: "dark" },
    { label: "Light", value: "light" },

    { label: "Cherry", value: "cherry" },
    { label: "Cherry Dark", value: "cherry-dark" },
  ];

  return (
    <div className="min-h-screen bg-app-main text-app-main pb-20 transition-colors duration-300">
      <AuthGuardHeader />

      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-24 pt-4">
        <section>
          <h1 className="text-lg font-semibold text-app-main">Settings</h1>
          <p className="mt-1 text-xs text-app-muted">
            Tune your Cherry experience, export your data, or reset this device.
          </p>
        </section>

        {/* Appearance (Theme + Text Size combined) */}
        <section className="space-y-4 rounded-2xl bg-app-card p-4 ring-1 ring-app-border">
          <h2 className="text-sm font-semibold text-app-main">Appearance</h2>

          {/* Theme */}
          <div className="space-y-2">
            <p className="text-xs text-app-muted">Theme</p>
            <div className="flex gap-2">
              {themeOptions.map((opt) => {
                const active = opt.value === theme;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setTheme(opt.value);
                      setThemeState(opt.value);
                    }}
                    className={
                      "flex-1 rounded-full border px-3 py-1.5 text-xs transition " +
                      (active
                        ? "border-app-accent bg-app-accent text-app-accent-text"
                        : "border-app-border bg-app-card text-app-muted hover:border-app-accent")
                    }
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text Size */}
          <div className="space-y-2 pt-2 border-t border-app-border/50">
            <p className="text-xs text-app-muted">Text size</p>
            <div className="flex gap-2">
              {textSizeOptions.map((opt) => {
                const active = opt.value === textSize;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setTextSize(opt.value);
                      setTextSizeState(opt.value);
                    }}
                    className={
                      "flex-1 rounded-full border px-3 py-1.5 text-xs transition " +
                      (active
                        ? "border-app-accent bg-app-accent text-app-accent-text"
                        : "border-app-border bg-app-card text-app-muted hover:border-app-accent")
                    }
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="space-y-3 rounded-2xl bg-app-card p-4 ring-1 ring-app-border">
          <h2 className="text-sm font-semibold text-app-main">Features</h2>

          {/* AI Coach */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-app-main">AI Coach</div>
              <div className="text-[10px] text-app-muted">Enable pop-ups to celebrate streaks</div>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={aiCoachEnabled}
                onChange={(e) => handleAiCoachToggle(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-5 w-9 rounded-full bg-app-card-hover ring-1 ring-app-border after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-app-accent peer-checked:after:translate-x-full"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-app-main">Show Plans</div>
              <div className="text-[10px] text-app-muted">Goals and long-term vision</div>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={showPlans}
                onChange={(e) => {
                  const val = e.target.checked;
                  setShowPlans(val);
                  localStorage.setItem("foundation_show_plans", String(val));
                  window.location.reload(); // Reload to update nav
                }}
                className="peer sr-only"
              />
              <div className="peer h-5 w-9 rounded-full bg-app-card-hover ring-1 ring-app-border after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-app-accent peer-checked:after:translate-x-full"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-app-main">Show Journal</div>
              <div className="text-[10px] text-app-muted">Daily reflections and notes</div>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={showJournal}
                onChange={(e) => {
                  const val = e.target.checked;
                  setShowJournal(val);
                  localStorage.setItem("foundation_show_journal", String(val));
                  window.location.reload();
                }}
                className="peer sr-only"
              />
              <div className="peer h-5 w-9 rounded-full bg-app-card-hover ring-1 ring-app-border after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-app-accent peer-checked:after:translate-x-full"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-app-main">Daily AI Question</div>
              <div className="text-[10px] text-app-muted">Get a thought-provoking question daily</div>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={dailyAiQuestionEnabled}
                onChange={(e) => {
                  const val = e.target.checked;
                  setDailyAiQuestionEnabled(val);
                  localStorage.setItem("foundation_daily_ai_question_enabled", String(val));
                  window.location.reload();
                }}
                className="peer sr-only"
              />
              <div className="peer h-5 w-9 rounded-full bg-app-card-hover ring-1 ring-app-border after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-app-accent peer-checked:after:translate-x-full"></div>
            </label>
          </div>
        </section>

        {/* Export */}
        <section className="space-y-3 rounded-2xl bg-app-card p-4 ring-1 ring-app-border">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-app-main">
              Export data
            </h2>
          </div>
          <p className="text-xs text-app-muted">
            Download your logs, reflections, and goals as a CSV file.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleExportData("30")}
              disabled={exporting !== null}
              className="flex-1 rounded-full bg-app-card-hover px-3 py-1.5 text-xs text-app-main ring-1 ring-app-border hover:bg-app-card disabled:opacity-60"
            >
              {exporting === "30" ? "Exporting…" : "Last 30 days"}
            </button>
            <button
              type="button"
              onClick={() => handleExportData("all")}
              disabled={exporting !== null}
              className="flex-1 rounded-full bg-app-card-hover px-3 py-1.5 text-xs text-app-main ring-1 ring-app-border hover:bg-app-card disabled:opacity-60"
            >
              {exporting === "all" ? "Exporting…" : "All time"}
            </button>
          </div>
          <p className="text-[11px] text-app-muted">
            Exports are private and stay on your device unless you share the file.
          </p>
        </section>

        {/* Account */}
        <section className="space-y-3 rounded-2xl bg-app-card p-4 ring-1 ring-app-border">
          <h2 className="text-sm font-semibold text-app-main">Account</h2>
          <p className="text-xs text-app-muted">
            Manage your account settings.
          </p>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/auth/reset-password";
            }}
            className="w-full rounded-full bg-app-card-hover px-4 py-2 text-xs font-semibold text-app-main ring-1 ring-app-border hover:bg-app-card"
          >
            Change Password
          </button>
        </section>

        {/* Reset */}
        <section className="space-y-3 rounded-2xl bg-app-card p-4 ring-1 ring-red-500/50">
          <h2 className="text-sm font-semibold text-red-400">Reset app</h2>
          <p className="text-xs text-app-muted">
            Reset Cherry on <strong>this device only</strong>. This:
          </p>
          <ul className="list-disc pl-5 text-xs text-app-muted">
            <li>Clears habits, streaks, and notes.</li>
            <li>Clears reflections.</li>
            <li>Clears current goals and daily intentions.</li>
            <li>Keeps your login session.</li>
          </ul>
          <p className="text-[11px] text-app-muted">
            After reset, you&apos;ll be taken back through the starting questions so
            your goals and daily intention can be recreated by AI.
          </p>
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            className="mt-1 w-full rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white hover:bg-red-400 disabled:opacity-60"
          >
            {resetting ? "Resetting…" : "Reset app on this device"}
          </button>
        </section>
      </main>
    </div>
  );
}
