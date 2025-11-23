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
    const date = searchParams.get("date"); // YYYY-MM-DD from client
    const force = searchParams.get("force") === "true";

    console.log(`[API] GET /api/intention - Date: ${date}, Force: ${force}`);

    if (!date) {
      console.error("[API] Missing date parameter");
      return NextResponse.json({ error: "Date required" }, { status: 400 });
    }

    const supabase = getSupabaseClient(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[API] Unauthorized access attempt", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Check if intention exists
    const { data: existing, error: fetchError } = await supabase
      .from("daily_intentions")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", date)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error("[API] Error fetching intention:", fetchError);
    }

    if (existing && !force) {
      console.log("[API] Returning existing intention:", existing.id);
      return NextResponse.json(existing);
    }

    if (existing && force) {
      console.log("[API] Force refresh: Deleting existing intention:", existing.id);
      await supabase
        .from("daily_intentions")
        .delete()
        .eq("id", existing.id);
    } else {
      console.log("[API] No existing intention found (or force=true), generating new one.");
    }

    // 2. If not, generate one
    console.log("[API] Generating new intention for user:", user.id);

    // Fetch context (goals, habits, etc.) - simplified for now
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

    const systemPrompt = `
You are Daily Tracker AI, an elite mindset coach.
Generate a powerful, iconic Daily Intention for ${date}.
This is not advice—it is a directive for greatness.

Constraints:
- Maximum 35 words.
- Tone: Iconic, disciplined, stoic, high-agency.
- No fluff, no "fortune cookie" vague platitudes.
- Speak directly to the user's identity and goals.

User Context:
Goals: ${goalsText}
Core Truth: ${profileText}
`;

    console.log("[API] Calling OpenAI...");
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: systemPrompt }],
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "Focus on the present moment.";
    console.log("[API] OpenAI response received:", content);

    // 3. Save to DB
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
      console.error("[API] Error saving intention:", insertError);
      return NextResponse.json({
        error: "Failed to save intention",
        details: insertError.message,
        code: insertError.code,
        hint: insertError.hint
      }, { status: 500 });
    }

    console.log("[API] Generated and saved new intention:", newIntention.id);
    return NextResponse.json(newIntention);
  } catch (error: any) {
    console.error("[API] Unhandled error in GET /api/intention:", error);
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
