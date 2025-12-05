"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setMessage("");

        try {
            const { error } = await supabase.auth.updateUser({
                password: password,
            });

            if (error) throw error;

            setMessage("Password updated successfully! Redirecting...");
            setTimeout(() => {
                router.push("/foundation");
            }, 2000);
        } catch (err: any) {
            setError(err.message || "Failed to update password.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-app-main text-app-main flex items-center justify-center px-4">
            <div className="w-full max-w-sm rounded-3xl border border-app-border bg-app-card p-6 shadow-xl">
                <h1 className="text-xl font-semibold text-app-main mb-1">Reset Password</h1>
                <p className="mb-6 text-xs text-app-muted">
                    Enter your new password below.
                </p>

                <form onSubmit={handleReset} className="space-y-4">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-app-muted">
                            New Password
                        </label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-xl border border-app-border bg-app-input px-3 py-2 text-sm text-app-main outline-none focus:border-app-accent"
                            placeholder="••••••••"
                            minLength={6}
                        />
                    </div>

                    {error && (
                        <p className="text-xs text-red-400 bg-red-950/40 border border-red-700/60 rounded-lg px-3 py-2">
                            {error}
                        </p>
                    )}

                    {message && (
                        <p className="text-xs text-green-400 bg-green-950/40 border border-green-700/60 rounded-lg px-3 py-2">
                            {message}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-2 w-full rounded-full bg-app-accent px-4 py-2 text-sm font-semibold text-app-accent-text shadow hover:opacity-90 disabled:opacity-60"
                    >
                        {loading ? "Updating..." : "Update Password"}
                    </button>
                </form>
            </div>
        </div>
    );
}
