"use client";



import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { setTheme, Theme } from "@/lib/theme";
import { setTextSize, TextSize } from "@/lib/textSize";

export function SettingsSync() {
    useEffect(() => {
        const sync = async () => {
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
                }
                if (profile.text_size) {
                    setTextSize(profile.text_size as TextSize);
                }
            }
        };

        // Initial check
        sync();

        // Listen for auth changes (e.g. session restore, login)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                sync();
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return null;
}
