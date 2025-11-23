import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { addDays, format } from "date-fns";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabaseClient(req: Request) {
    const authHeader = req.headers.get("Authorization");
    return createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader ?? "" } },
    });
}

function getOpenAIClient() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");
    return new OpenAI({ apiKey });
}

export async function POST(req: Request) {
    const {
        gold_streak,
        habit_streaks, // Array of { id, title, streak }
        check_celebrations
    } = await req.json();

    const supabase = getSupabaseClient(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Generate Intentions for next 3 days (including today)
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    const { data: goals } = await supabase.from("goals").select("title").eq("user_id", user.id);
    const goalsText = goals?.map((g: any) => g.title).join(", ") ?? "";
    const openai = getOpenAIClient();

    for (let i = 0; i <= 3; i++) {
        const targetDate = format(addDays(new Date(), i), "yyyy-MM-dd");

        // Check if already exists
        const { data: existingIntention } = await supabase
            .from("daily_intentions")
            .select("id")
            .eq("user_id", user.id)
            .eq("date", targetDate)
            .single();

        if (!existingIntention) {
            const systemPrompt = `
You are Daily Tracker AI. Generate a Daily Intention for ${targetDate}.
Constraints: 1-2 sentences, max 40 words. Wise, disciplined, grounded.
User Context: Goals: ${goalsText}. Key Truth: ${profile?.key_truth}.
`;
            try {
                const completion = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [{ role: "system", content: systemPrompt }],
                });
                const content = completion.choices[0]?.message?.content?.trim() ?? "Prepare for the future.";

                await supabase.from("daily_intentions").insert({
                    user_id: user.id,
                    date: targetDate,
                    content
                });
            } catch (e) {
                console.error(`Failed to generate intention for ${targetDate}`, e);
            }
        }
    }

    // 2. Precompute Celebrations (if requested)
    if (check_celebrations !== false) {
        // Milestones
        const goldMilestones = [1, 3, 7, 14, 30, 50, 75, 100, 150, 200, 250, 300, 365, 500, 1000];
        const habitMilestones = [7, 30, 60, 90, 100, 365, 1000];

        // Check Gold Streak (current + 1)
        const nextGold = (gold_streak || 0) + 1;
        if (goldMilestones.includes(nextGold)) {
            // Check if already cached
            const { data: cached } = await supabase
                .from("celebrations")
                .select("id")
                .eq("user_id", user.id)
                .eq("type", "gold_streak")
                .eq("streak_days", nextGold)
                .single();

            if (!cached) {
                // Generate
                const prompt = `Generate a bold celebration for a Gold Streak of ${nextGold} days. Max 35 words. Iconic, disciplined tone.`;
                const completion = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [{ role: "system", content: prompt }],
                });
                const content = completion.choices[0]?.message?.content?.trim() ?? `Day ${nextGold} complete.`;

                await supabase.from("celebrations").insert({
                    user_id: user.id,
                    type: "gold_streak",
                    streak_days: nextGold,
                    content,
                    is_used: false
                });
            }
        }

        // Check Habit Streaks (current + 1)
        if (habit_streaks && Array.isArray(habit_streaks)) {
            for (const h of habit_streaks) {
                const nextStreak = h.streak + 1;
                if (habitMilestones.includes(nextStreak)) {
                    const { data: cached } = await supabase
                        .from("celebrations")
                        .select("id")
                        .eq("user_id", user.id)
                        .eq("type", "habit_streak")
                        .eq("habit_id", h.id)
                        .eq("streak_days", nextStreak)
                        .single();

                    if (!cached) {
                        const prompt = `Generate a celebration for habit "${h.title}" reaching ${nextStreak} days. Max 35 words. Focused, disciplined tone.`;
                        const completion = await openai.chat.completions.create({
                            model: "gpt-4o",
                            messages: [{ role: "system", content: prompt }],
                        });
                        const content = completion.choices[0]?.message?.content?.trim() ?? `${nextStreak} days of ${h.title}.`;

                        await supabase.from("celebrations").insert({
                            user_id: user.id,
                            type: "habit_streak",
                            streak_days: nextStreak,
                            habit_id: h.id,
                            content,
                            is_used: false
                        });
                    }
                }
            }
        }
    }

    return NextResponse.json({ success: true });
}
