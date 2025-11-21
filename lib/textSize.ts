// lib/textSize.ts

import { supabase } from "./supabaseClient";

export type TextSize = "small" | "medium" | "large" | "xl";

export const TEXT_SIZE_KEY = "foundation_ui_text_size_v1";

/**
 * Read the saved text size from localStorage (if any)
 * and apply it to <html data-text-size="...">.
 */
export function applySavedTextSize() {
  if (typeof window === "undefined") return;

  const saved = window.localStorage.getItem(TEXT_SIZE_KEY) as TextSize | null;

  const size: TextSize =
    saved === "medium" || saved === "large" || saved === "small" || saved === "xl"
      ? saved
      : "small";

  document.documentElement.dataset.textSize = size;
}

/**
 * Update text size and persist to localStorage.
 */
export async function setTextSize(size: TextSize) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(TEXT_SIZE_KEY, size);
  document.documentElement.dataset.textSize = size;

  // Persist to DB if logged in
  const { data: auth } = await supabase.auth.getUser();
  if (auth?.user) {
    await supabase
      .from("profiles")
      .update({ text_size: size })
      .eq("id", auth.user.id);
  }
}
