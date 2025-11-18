// app/api/intention/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set. Add it in your environment variables.");
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
You are a stoic, optimistic coach.
Write ONE short daily intention: ideally 6–12 words, strict maximum of 15.
Tone: calm, grounded, practical, not cheesy.
Do NOT mention Stoicism directly and avoid quotation marks.
Personalize gently to the user's values if a profile is given.
`;

  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content:
          "Generate a very concise daily intention for this person.\n\nProfile:\n" +
          (profileText || "No extra profile. Use general healthy habits."),
      },
    ],
  });

  const intention = completion.choices[0]?.message?.content?.trim() ?? "";

  return NextResponse.json({ intention });
}
