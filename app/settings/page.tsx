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

export default function SettingsPage() {
  const router = useRouter();
  const [exporting, setExporting] = useState<ExportRange | null>(null);
  const [resetting, setResetting] = useState(false);
  const [textSize, setTextSizeState] = useState<TextSize>("small");

  useEffect(() => {
    applySavedTextSize();
    if (typeof window !== "undefined") {
      const html = document.documentElement;
      const saved = (html.dataset.textSize as TextSize | undefined) || "small";
      setTextSizeState(saved);
    }
  }, []);

  const changeSize = (size: TextSize) => {
    setTextSize(size);
    setTextSizeState(size);
  };

  const handleExport = async (range: ExportRange) => {
    setExporting(range);
    try {
      const since =
        range === "30"
          ? format(subDays(new Date(), 30), "yyyy-MM-dd")
          : null;

      // Foundations logs
      const logsPromise = supabase
        .from("foundation_logs") // TODO: keep in sync with your schema
        .select("*")
        .order("date", { ascending: true });

      const reflectionsPromise = supabase
        .from("reflections") // TODO: keep in sync with your schema
        .select("*")
        .order("date", { ascending: true });

      const goalsPromise = supabase
        .from("goals") // TODO: keep in sync with your schema
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

      const sinceDate = since ? new Date(since) : null;

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
      await Promise.all([
        supabase.from("foundation_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000"), // Hack to delete all rows (since delete() requires a filter)
        supabase.from("foundations").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("reflections").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("goals").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("daily_intentions").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("profiles").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("board_members").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      ]);

      // Do NOT sign out. Just clear onboarding flag so they see questions again.
      window.localStorage.removeItem(ONBOARDING_KEY);

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
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      <AuthGuardHeader />

      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-24 pt-4">
        <section>
          <h1 className="text-lg font-semibold text-slate-50">Settings</h1>
          <p className="mt-1 text-xs text-slate-400">
            Tune your Foundation experience, export your data, or reset this device.
          </p>
        </section>

        {/* Text size */}
        <section className="space-y-3 rounded-2xl bg-slate-900/80 p-4 ring-1 ring-slate-800">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              Text size
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Adjust the text size across the app. This is stored only on this device.
          </p>
          <div className="flex gap-2">
            {textSizeOptions.map((opt) => {
              const active = opt.value === textSize;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => changeSize(opt.value)}
                  className={
                    "flex-1 rounded-full border px-3 py-1.5 text-xs transition " +
                    (active
                      ? "border-emerald-400 bg-emerald-500/90 text-slate-950"
                      : "border-slate-700 bg-slate-900 text-slate-200 hover:border-emerald-400")
                  }
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Export data */}
        <section className="space-y-3 rounded-2xl bg-slate-900/80 p-4 ring-1 ring-slate-800">
          <h2 className="text-sm font-semibold text-slate-100">
            Export data
          </h2>
          <p className="text-xs text-slate-400">
            Export your habits, reflections, and goals as a CSV file for your own records.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleExport("30")}
              disabled={exporting !== null}
              className="flex-1 rounded-full bg-slate-800 px-3 py-1.5 text-xs text-slate-100 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-60"
            >
              {exporting === "30" ? "Exporting…" : "Last 30 days"}
            </button>
            <button
              type="button"
              onClick={() => handleExport("all")}
              disabled={exporting !== null}
              className="flex-1 rounded-full bg-slate-800 px-3 py-1.5 text-xs text-slate-100 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-60"
            >
              {exporting === "all" ? "Exporting…" : "All time"}
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Exports are private and stay on your device unless you share the file.
          </p>
        </section>

        {/* Reset */}
        <section className="space-y-3 rounded-2xl bg-slate-900/80 p-4 ring-1 ring-red-500/50">
          <h2 className="text-sm font-semibold text-red-300">Reset app</h2>
          <p className="text-xs text-slate-300">
            Reset Foundation on <strong>this device only</strong>. This:
          </p>
          <ul className="list-disc pl-5 text-xs text-slate-300">
            <li>Clears habits, streaks, and notes.</li>
            <li>Clears reflections.</li>
            <li>Clears current goals and daily intentions.</li>
            <li>Keeps your login session.</li>
          </ul>
          <p className="text-[11px] text-slate-500">
            After reset, you&apos;ll be taken back through the starting questions so
            your goals and daily intention can be recreated by AI.
          </p>
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            className="mt-1 w-full rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-red-400 disabled:opacity-60"
          >
            {resetting ? "Resetting…" : "Reset app on this device"}
          </button>
        </section>
      </main>
    </div>
  );
}
