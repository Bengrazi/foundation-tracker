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

        // Check if we already have a question for today in a cache or DB?
        // For now, we'll generate one on the fly or use a static list if OpenAI is not available.
        // Ideally, this should be stored in a `daily_questions` table to be consistent for the user all day.
        // But for simplicity, let's generate it.

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
