export type Theme = "dark" | "light" | "sunrise";

export function applySavedTheme() {
    if (typeof window === "undefined") return;
    const theme = localStorage.getItem("foundation_theme") || "dark";
    document.documentElement.setAttribute("data-theme", theme);
}

export function setTheme(theme: Theme) {
    if (typeof window === "undefined") return;
    localStorage.setItem("foundation_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
}
