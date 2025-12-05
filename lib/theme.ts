import { supabase } from "./supabaseClient";

export type Theme = "dark" | "light" | "cherry" | "cherry-dark";

export function applySavedTheme() {
    if (typeof window === "undefined") return;
    const theme = localStorage.getItem("foundation_theme") || "cherry";
    document.documentElement.setAttribute("data-theme", theme);
}

export async function setTheme(theme: Theme) {
    if (typeof window === "undefined") return;
    localStorage.setItem("foundation_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);

    // Persist to DB if logged in
    const { data: auth } = await supabase.auth.getUser();
    if (auth?.user) {
        await supabase
            .from("profiles")
            .update({ theme })
            .eq("id", auth.user.id);
    }
}
