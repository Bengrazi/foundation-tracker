import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

// Initialize OpenAI
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  return new OpenAI({ apiKey });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabaseClient(req: Request) {
  const authHeader = req.headers.get("Authorization");
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader ?? "" } },
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const force = searchParams.get("force") === "true";
    const prevDayContext = searchParams.get("prev_day_context");

    if (!date) {
      return NextResponse.json({ error: "Date required" }, { status: 400 });
    }

    const supabase = getSupabaseClient(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if intention exists
    const { data: existing } = await supabase
      .from("daily_intentions")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", date)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(existing);
    }

    // Generate new intention
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
    const profileText = profile ? `Key Truth: ${profile.key_truth}` : "";

    // Build context-aware prompt
    let contextSection = "";
    if (prevDayContext) {
      try {
        const context = JSON.parse(prevDayContext);
        contextSection = `\n\nYesterday's Performance:\n- Habits completed: ${context.habitsCompleted}/${context.habitsTotal}\n- Gold streak: ${context.goldStreak ? "Maintained ✓" : "Broken"}\n- Journal entry: ${context.journalSubmitted ? "Yes ✓" : "No"}\n\n${context.goldStreak && context.journalSubmitted ? "They're CRUSHING IT. Reinforce momentum with urgency." : context.habitsCompleted === 0 ? "They need support. Motivate with compassion and challenge." : "Mixed performance. Push them to complete everything today."}\n`;
      } catch (e) {
        console.error("Failed to parse prev_day_context:", e);
      }
    }

    const systemPrompt = `
You are Daily Tracker AI, an elite mindset coach.
Generate a powerful, iconic Daily Intention for ${date}.

Constraints:
- MAXIMUM 8 words. Absolute hard limit.
- Tone: Iconic, disciplined, commanding, urgent.
- No fluff. Pure action. Dopamine hit.
- Each word must earn its place.

User Context:
Goals: ${goalsText}
Core Truth: ${profileText}${contextSection}

Examples of good length:
"Execute relentlessly. No excuses."
"Discipline conquers weakness. Move forward."
"Focus. Build. Dominate."
`;

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: systemPrompt }],
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "Execute. Build. Win.";

    // Save to DB
    const { data: newIntention, error: insertError } = await supabase
      .from("daily_intentions")
      .insert({
        user_id: user.id,
        date,
        content,
      })
      .select("*")
      .single();

    if (insertError) {
      return NextResponse.json({ error: "Failed to save intention" }, { status: 500 });
    }

    return NextResponse.json(newIntention);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { id, vote } = await req.json();
    const supabase = getSupabaseClient(req);

    const { error } = await supabase
      .from("daily_intentions")
      .update({ vote })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API] Unhandled error in POST /api/intention:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = getSupabaseClient(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, content, locked } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const updates: any = {};
    if (content !== undefined) updates.content = content;
    if (locked !== undefined) updates.locked = locked;

    const { error } = await supabase
      .from("daily_intentions")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id); // Ensure ownership

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API] Unhandled error in PATCH /api/intention:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
