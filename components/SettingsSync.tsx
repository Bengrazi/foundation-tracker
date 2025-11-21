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

        sync();
    }, []);

    return null;
}
