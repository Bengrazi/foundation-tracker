"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        // Check if we have a session (magic link should have logged us in)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                // If no session, redirect to login
                router.push("/login");
            }
        });
    }, [router]);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setMessage({ type: "error", text: "Passwords do not match." });
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

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-app-main px-4 text-app-main transition-colors duration-300">
            <div className="w-full max-w-sm space-y-8">
                <div className="text-center">
                    <h2 className="text-3xl font-black tracking-tighter">Reset Password</h2>
                    <p className="mt-2 text-sm text-app-muted">
                        Enter your new password below.
                    </p>
                </div>

                <form onSubmit={handleReset} className="space-y-4">
                    <div>
                        <input
                            type="password"
                            required
                            placeholder="New Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-xl border border-app-border bg-app-input px-4 py-3 text-sm text-app-main outline-none focus:border-app-accent transition-colors placeholder-app-muted/50"
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            required
                            placeholder="Confirm New Password"
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
                </form>
            </div>
        </div>
    );
}
