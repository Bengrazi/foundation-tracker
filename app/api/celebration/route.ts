import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

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
    const { type, streak_days, habit_id, habit_title } = await req.json();
    const supabase = getSupabaseClient(req);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Check for unused cached celebration
    let query = supabase
        .from("celebrations")
        .select("*")
        .eq("user_id", user.id)
        .eq("type", type)
        .eq("streak_days", streak_days)
        .eq("is_used", false);

    if (habit_id) {
        query = query.eq("habit_id", habit_id);
    }

    const { data: cached } = await query.maybeSingle();

    if (cached) {
        // Mark as used
        await supabase
            .from("celebrations")
            .update({ is_used: true })
            .eq("id", cached.id);

        return NextResponse.json({ message: cached.content });
    }

    // 2. Generate on demand
    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    const { data: goals } = await supabase
        .from("goals")
        .select("title")
        .eq("user_id", user.id);

    const goalsText = goals?.map((g: any) => g.title).join(", ") ?? "No specific goals";

    let systemPrompt = "";
    if (type === "gold_streak") {
        systemPrompt = `
You are Daily Tracker AI, a high-performance habit and discipline coach.
Generate a bold, powerful celebration message for the user's Gold Streak reaching ${streak_days} days.

Constraints:
1–2 sentences, maximum 35 words.
Tone: iconic, disciplined, confident.
Must feel rare and special.

User Context:
Goals: ${goalsText}
Profile: ${profile?.key_truth ?? ""}
`;
    } else {
        systemPrompt = `
You are Daily Tracker AI, a focused habit coach.
Generate a powerful celebration message for the user's habit "${habit_title}" reaching ${streak_days} days in a row.

Constraints:
1–2 sentences, maximum 35 words.
Tone: respectful, focused, disciplined.
Emphasize identity and consistency.

User Context:
Goals: ${goalsText}
`;
    }

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "system", content: systemPrompt }],
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "Keep going.";

    // 3. Save as used
    await supabase.from("celebrations").insert({
        user_id: user.id,
        type,
        streak_days,
        habit_id: habit_id || null,
        content,
        is_used: true,
    });

    return NextResponse.json({ message: content });
}
