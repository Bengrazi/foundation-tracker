// app/api/intention/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it in your environment variables."
    );
  }
  return new OpenAI({ apiKey });
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const profile = body?.profile;

  const client = getOpenAIClient();

  const profileText = profile
    ? `
User priorities: ${profile.priorities ?? ""}
Life summary / 10-year vision: ${profile.lifeSummary ?? ""}
Ideology / worldview: ${profile.ideology ?? ""}
Key truth: ${profile.keyTruth ?? ""}
Preferred tone: ${profile.aiVoice ?? ""}
`
    : "";

  const system = `
You are a stoic and optimistic coach.
Write a single, short, practical daily intention in 1–2 sentences.
Tone: calm, encouraging, grounded, never cheesy.
Do NOT mention Stoicism directly.
Personalize gently to the user's values if profile info is given.
`;

  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content:
          "Generate a daily intention for this person.\n\nProfile:\n" +
          (profileText || "No extra profile. Use general healthy habits."),
      },
    ],
  });

  const intention = completion.choices[0]?.message?.content?.trim() ?? "";

  return NextResponse.json({ intention });
}
