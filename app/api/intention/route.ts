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

// Initialize Supabase (Service Role for RLS bypass if needed, or just standard client)
// Since we are in a route handler, we should use the standard client but we need the user's session.
// However, for simplicity in this "prototype" phase, we can use the ANON key and rely on the `Authorization` header passed from the client,
// OR we can use a service role key if we want to do admin things. 
// But `daily_intentions` has RLS. 
// Actually, the best way in Next.js App Router is `createServerClient` from `@supabase/ssr`.
// But I don't have that package installed/configured in the snippets I've seen.
// I see `lib/supabaseClient.ts` which is a client-side client.
// I'll use a direct `createClient` with the URL and ANON key, passing the user's token if possible, 
// OR just use the Service Role key for server-side operations and manually check auth.
// Let's use Service Role for reliability in generation, but we need to verify the user.
// Actually, let's just use the `Authorization` header to forward the user's session.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabaseClient(req: Request) {
  const authHeader = req.headers.get("Authorization");
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader ?? "" } },
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); // YYYY-MM-DD from client

  if (!date) {
    return NextResponse.json({ error: "Date required" }, { status: 400 });
  }

  const supabase = getSupabaseClient(req);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Check if intention exists
  const { data: existing, error: fetchError } = await supabase
    .from("daily_intentions")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", date)
    .single();

  const force = searchParams.get("force") === "true";

  if (existing && !force) {
    return NextResponse.json(existing);
  }

  if (existing && force) {
    await supabase
      .from("daily_intentions")
      .delete()
      .eq("id", existing.id);
  }

  // 2. If not, generate one
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

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "system", content: systemPrompt }],
  });

  const content = completion.choices[0]?.message?.content?.trim() ?? "Focus on the present moment.";

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
    console.error("Error saving intention:", insertError);
    return NextResponse.json({ error: "Failed to save intention" }, { status: 500 });
  }

  return NextResponse.json(newIntention);
}

export async function POST(req: Request) {
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
}
