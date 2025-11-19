"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AuthGuardHeader } from "@/components/AuthGuardHeader";
import { applySavedTextSize, setTextSize, TextSize } from "@/lib/textSize";

export default function SettingsPage() {
  const router = useRouter();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [currentSize, setCurrentSize] = useState<TextSize>("small");

  useEffect(() => {
    applySavedTextSize();
    const saved = (document.documentElement.dataset.textSize ||
      "small") as TextSize;
    setCurrentSize(saved);
  }, []);

  function changeSize(size: TextSize) {
    setTextSize(size);
    setCurrentSize(size);
  }

  async function exportCsv(range: "30" | "all") {
    setExportLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Example: fetch reflections + routine_logs. Adjust table names if needed.
      const [reflectionsRes, logsRes] = await Promise.all([
        supabase
          .from("reflections")
          .select("*")
          .eq("user_id", user.id),
        supabase
          .from("routine_logs")
          .select("*")
          .eq("user_id", user.id),
      ]);

      const reflections = reflectionsRes.data ?? [];
      const logs = logsRes.data ?? [];

      const csvRows: string[] = [];
      csvRows.push("type,day,extra");

      reflections.forEach((r: any) => {
        csvRows.push(
          `reflection,${r.day},"${(r.text || "").replace(/"/g, '""')}"`
        );
      });

      logs.forEach((l: any) => {
        csvRows.push(
          `habit_log,${l.day},"routine:${l.routine_id} completed:${l.completed} notes:${(
            l.notes || ""
          ).replace(/"/g, '""')}"`
        );
      });

      const blob = new Blob([csvRows.join("\n")], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        range === "30" ? "foundation_last30.csv" : "foundation_all.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExportLoading(false);
    }
  }

  async function resetApp() {
    setResetLoading(true);
    try {
      // Clear local device state
      localStorage.clear();

      // (Optional) you could add Supabase deletes here if desired.

      router.push("/foundation");
      router.refresh();
    } finally {
      setResetLoading(false);
      setConfirmingReset(false);
    }
  }

  const sizeOptions: { label: string; value: TextSize }[] = [
    { label: "Small", value: "small" },
    { label: "Medium", value: "medium" },
    { label: "Large", value: "large" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <AuthGuardHeader />

      <main className="mx-auto max-w-md px-4 pb-28 pt-4">
        <h1 className="mb-4 text-lg font-semibold">Settings</h1>

        {/* Text size */}
        <section className="mb-5 rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-xs">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Text size
          </h2>
          <div className="flex gap-2">
            {sizeOptions.map((opt) => {
              const active = opt.value === currentSize;
              return (
                <button
                  key={opt.value}
                  onClick={() => changeSize(opt.value)}
                  className={`flex-1 rounded-full border px-3 py-1.5 text-[11px] ${
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

        {/* Export */}
        <section className="mb-5 rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-xs">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Export data (CSV)
          </h2>
          <p className="mb-3 text-[11px] text-slate-400">
            Download your reflections and habit logs as CSV.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => exportCsv("30")}
              disabled={exportLoading}
              className="flex-1 rounded-full bg-slate-800 px-3 py-1.5 text-[11px] text-slate-100 border border-slate-600 disabled:opacity-60"
            >
              Last 30 days
            </button>
            <button
              onClick={() => exportCsv("all")}
              disabled={exportLoading}
              className="flex-1 rounded-full bg-slate-800 px-3 py-1.5 text-[11px] text-slate-100 border border-slate-600 disabled:opacity-60"
            >
              All time
            </button>
          </div>
        </section>

        {/* Reset */}
        <section className="rounded-2xl border border-red-800/70 bg-red-950/30 p-4 text-xs">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-red-300 mb-2">
            Reset app
          </h2>
          <p className="text-[11px] text-red-100 mb-2">
            This will clear local data on this device and take you back through
            the starting questions.
          </p>

          {!confirmingReset ? (
            <button
              onClick={() => setConfirmingReset(true)}
              className="rounded-full bg-red-500 px-4 py-1.5 text-[11px] font-semibold text-slate-950"
            >
              Reset Foundation on this device
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-red-200">
                Are you sure? This cannot be undone for this device.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={resetApp}
                  disabled={resetLoading}
                  className="flex-1 rounded-full bg-red-500 px-4 py-1.5 text-[11px] font-semibold text-slate-950 disabled:opacity-60"
                >
                  {resetLoading ? "Resetting…" : "Yes, reset"}
                </button>
                <button
                  onClick={() => setConfirmingReset(false)}
                  className="flex-1 rounded-full bg-slate-800 px-4 py-1.5 text-[11px] text-slate-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
