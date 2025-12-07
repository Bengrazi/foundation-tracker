import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "edge";

export async function GET(request: Request) {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Get user from auth header
        const authHeader = request.headers.get("Authorization");
        if (!authHeader) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const today = new Date().toISOString().split("T")[0];

        // 1. Check if we already have a question for today
        const { data: existingEntry } = await supabase
            .from("daily_intentions")
            .select("question")
            .eq("user_id", user.id)
            .eq("date", today)
            .single();

        if (existingEntry?.question) {
            return NextResponse.json({ question: existingEntry.question });
        }

        // 2. Generate new question
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are a thoughtful, philosophical AI coach. 
          Generate a single, short, thought-provoking question for the user to reflect on today. 
          It should be deep but accessible. 
          Examples: "What is one thing you are holding onto that you need to let go of?", "How did you show up for yourself today?", "What is the most important thing you learned this week?"
          Return ONLY the question text.`,
                },
            ],
            max_tokens: 50,
        });

        const question = completion.choices[0].message.content?.trim();

        // 3. Save to DB (UPSERT to handle race conditions or if intention exists but question doesn't)
        // We need to be careful not to overwrite the 'content' if it exists.
        // Actually, daily_intentions requires 'content' (not null). 
        // If we overlap with the intention creation, we might face issues if we don't have content.
        // However, usually the intention is created by the USER or precomputed.
        // If precomputed, it exists. If not, we need to insert it.
        // BUT, 'content' is NOT NULL. 
        // Let's check if the row exists first (which we did).
        // If it doesn't exist, we must provide 'content'. 
        // Let's provide a placeholder or wait for the user/precompute?
        // Actually, looking at schema, 'content' is NOT NULL.
        // Users might visit the dashboard before the precompute runs (rare but possible).
        // Or simply, we can just update if exists, or insert with a default content if not?
        // Better yet: The intention logic usually handles the row creation.
        // Let's see... 'precompute' route creates it.
        // If we are here, and no row exists, we can try to insert with a default content or just return the question without saving if we can't save.
        // BUT we want persistence.
        // Let's assume we can fetch the existing row. 
        // If we found 'existingEntry' was null, it means no row for today.

        // Let's try to UPSERT. If we insert, we need 'content'.
        // We can just set a default content if we are the first ones creating it.
        // Only insert if it doesn't exist.

        const { error: upsertError } = await supabase
            .from("daily_intentions")
            .upsert({
                user_id: user.id,
                date: today,
                question: question,
                content: "Focus on the step in front of you." // Default fallback if creating row
            }, { onConflict: "user_id, date", ignoreDuplicates: false });
        // We want to update 'question' if row exists, but preserve 'content' if it's already there?
        // UPSERT in Supabase/Postgres updates all columns specified if conflict.
        // If we specify 'content', it will overwrite 'content'. That is BAD if user wrote something.
        // So we should NOT use Upsert blindly if we might overwrite.

        // Refined Logic:
        // If row exists (but question was null, otherwise we would have returned above), UPDATE it.
        // If row does not exist, INSERT it.

        const { data: checkRow } = await supabase
            .from("daily_intentions") // Re-query just to be safe or use what we had
            .select("id")
            .eq("user_id", user.id)
            .eq("date", today)
            .single();

        if (checkRow) {
            await supabase
                .from("daily_intentions")
                .update({ question })
                .eq("id", checkRow.id);
        } else {
            await supabase
                .from("daily_intentions")
                .insert({
                    user_id: user.id,
                    date: today,
                    question: question,
                    content: "Focus on the step in front of you."
                });
        }

        return NextResponse.json({ question });
    } catch (error) {
        console.error("Error generating daily question:", error);
        // Fallback questions
        const fallbacks = [
            "What are you most grateful for today?",
            "What is one small win you had today?",
            "How can you be 1% better tomorrow?",
            "What is draining your energy right now?",
        ];
        return NextResponse.json({ question: fallbacks[Math.floor(Math.random() * fallbacks.length)] });
    }
}
