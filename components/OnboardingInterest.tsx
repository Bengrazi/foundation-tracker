"use client";

import { useState } from "react";

export type InterestSelection = {
    habits: boolean;
    goals: boolean;
    journal: boolean;
};

interface Props {
    onNext: (selection: InterestSelection) => void;
}

export function OnboardingInterest({ onNext }: Props) {
    const [selection, setSelection] = useState<InterestSelection>({
        habits: true,
        goals: false,
        journal: false,
    });

    const toggle = (key: keyof InterestSelection) => {
        if (key === "habits") return; // Locked
        setSelection((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h2 className="text-xl font-bold text-app-main">Welcome to Cherry</h2>
                <p className="mt-2 text-sm text-app-muted">
                    What would you like to focus on?
                </p>
            </div>

            <div className="space-y-3">
                {/* Habits (Locked) */}
                <button
                    type="button"
                    disabled
                    className="flex w-full items-center justify-between rounded-xl border border-app-accent/50 bg-app-accent/10 px-4 py-3 text-left opacity-80"
                >
                    <span className="font-medium text-app-main">Habit Tracking</span>
                    <span className="text-app-accent">✓</span>
                </button>

                {/* Goals */}
                <button
                    type="button"
                    onClick={() => toggle("goals")}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${selection.goals
                            ? "border-app-accent bg-app-accent/10"
                            : "border-app-border bg-app-card hover:border-app-accent/50"
                        }`}
                >
                    <span className="font-medium text-app-main">Long-Term Goals</span>
                    {selection.goals && <span className="text-app-accent">✓</span>}
                </button>

                {/* Journal */}
                <button
                    type="button"
                    onClick={() => toggle("journal")}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${selection.journal
                            ? "border-app-accent bg-app-accent/10"
                            : "border-app-border bg-app-card hover:border-app-accent/50"
                        }`}
                >
                    <span className="font-medium text-app-main">Journal & Notes</span>
                    {selection.journal && <span className="text-app-accent">✓</span>}
                </button>
            </div>

            <button
                onClick={() => onNext(selection)}
                className="w-full rounded-full bg-app-accent py-3 text-sm font-bold text-app-accent-text hover:opacity-90 transition-opacity"
            >
                Continue
            </button>
        </div>
    );
}
