"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { applySavedTheme } from "@/lib/theme";
import { applySavedTextSize } from "@/lib/textSize";

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        applySavedTheme();
        applySavedTextSize();

        // Check if user is logged in
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                router.push("/login");
            }
            setCheckingAuth(false);
        });
    }, [router]);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setMessage({ type: "error", text: "Passwords do not match." });
            return;
        }

        if (password.length < 6) {
            setMessage({ type: "error", text: "Password must be at least 6 characters." });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const { error } = await supabase.auth.updateUser({
                password: password,
            });

            if (error) throw error;

            setMessage({ type: "success", text: "Password updated successfully! Redirecting..." });
            setTimeout(() => {
                router.push("/foundation");
            }, 2000);
        } catch (err: any) {
            setMessage({ type: "error", text: err.message || "Failed to update password." });
        } finally {
            setLoading(false);
        }
    };

    if (checkingAuth) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-app-main">
                <p className="text-app-muted">Loading...</p>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-app-main px-4 text-app-main transition-colors duration-300">
            <div className="w-full max-w-sm space-y-8">
                <div className="text-center">
                    <h2 className="text-3xl font-black tracking-tighter">Change Password</h2>
                    <p className="mt-2 text-sm text-app-muted">
                        Enter your new password below.
                    </p>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                        <label className="block text-xs text-app-muted mb-1">New Password</label>
                        <input
                            type="password"
                            required
                            placeholder="Enter new password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-xl border border-app-border bg-app-input px-4 py-3 text-sm text-app-main outline-none focus:border-app-accent transition-colors placeholder-app-muted/50"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-app-muted mb-1">Confirm New Password</label>
                        <input
                            type="password"
                            required
                            placeholder="Confirm new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full rounded-xl border border-app-border bg-app-input px-4 py-3 text-sm text-app-main outline-none focus:border-app-accent transition-colors placeholder-app-muted/50"
                        />
                    </div>

                    {message && (
                        <div
                            className={`rounded-lg px-4 py-3 text-sm ${message.type === "success"
                                ? "bg-green-500/10 text-green-500"
                                : "bg-red-500/10 text-red-500"
                                }`}
                        >
                            {message.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-full bg-app-accent py-3 text-sm font-bold text-app-accent-text hover:bg-app-accent-hover disabled:opacity-50 transition-colors"
                    >
                        {loading ? "Updating..." : "Update Password"}
                    </button>

                    <button
                        type="button"
                        onClick={() => router.push("/settings")}
                        className="w-full rounded-full border border-app-border py-3 text-sm font-semibold text-app-muted hover:bg-app-card transition-colors"
                    >
                        Cancel
                    </button>
                </form>
            </div>
        </div>
    );
}
