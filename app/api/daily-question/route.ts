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

        // Get date from query param (client's local "today") or fallback to UTC
        const { searchParams } = new URL(request.url);
        const clientDate = searchParams.get("date");
        const today = clientDate || new Date().toISOString().split("T")[0];

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

        // 3. Save to DB
        // If row exists (but question was null), UPDATE it.
        // If row does not exist, INSERT it.

        const { data: checkRow } = await supabase
            .from("daily_intentions")
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
                    content: "Focus on the step in front of you." // Default intention if we are creating the row
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
