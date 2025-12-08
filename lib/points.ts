import { supabase } from "./supabaseClient";

export const POINTS = {
    HABIT_COMPLETION: 10,
    STREAK_BONUS_7: 50,
    STREAK_BONUS_30: 200,
    REFLECTION: 20,
    DAILY_QUESTION: 20,
};

export async function awardPoints(userId: string, amount: number, reason: string, referenceId?: string) {
    try {
        // 1. Update profile points
        const { error: profileError } = await supabase.rpc("increment_points", {
            user_id_input: userId,
            amount_input: amount
        });

        // Fallback if RPC doesn't exist (optimistic locking issue potential, but okay for MVP)
        if (profileError) {
            const { data: profile } = await supabase
                .from("profiles")
                .select("points")
                .eq("id", userId)
                .single();

            const currentPoints = profile?.points || 0;
            await supabase
                .from("profiles")
                .update({ points: currentPoints + amount })
                .eq("id", userId);
        }

        // 2. Log history
        await supabase.from("points_history").insert({
            user_id: userId,
            amount,
            reason,
            reference_id: referenceId,
        });

        return { success: true, points: amount };

    } catch (e) {
        console.error("Error awarding points:", e);
        return { success: false, points: 0 };
    }
}
