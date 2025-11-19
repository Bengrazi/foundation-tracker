// app/api/chat/route.ts
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
  const { message, contextMode, profile } = await req.json();

  let contextDescription = "";
  if (contextMode === "last7days") {
    contextDescription = "Focus on the last 7 days of routines and reflections.";
  } else if (contextMode === "allReflections") {
    contextDescription =
      "Use all available reflections and high-level routine/goal data.";
  } else if (contextMode === "celebration") {
    contextDescription = "The user just hit a significant streak milestone. Celebrate them warmly and reinforce the value of consistency.";
  } else {
    contextDescription =
      "Give general advice based on healthy routines and consistent habits.";
  }

  const profileText = profile
    ? `
User priorities: ${profile.priorities ?? ""}
Life summary / 10-year vision: ${profile.life_summary ?? ""}
Ideology / worldview: ${profile.ideology ?? ""}
Key truth: ${profile.key_truth ?? ""}
Preferred tone: ${profile.ai_voice ?? ""}
`
    : "";

  const system = `
You are Foundation AI, a calm, supportive, slightly stoic and optimistic coach.
Be VERY concise and practical.
Respond in at most 3 short paragraphs or 5 bullet points, and keep it under ~120 words.
Avoid fluffy quotes. Focus on one or two specific, doable suggestions.
Use the user's values, long-term vision, and ideology to choose examples and tone, but do not flatter them or over-index on labels.
`;

  const client = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content:
          `Context mode: ${contextDescription}\n\n` +
          (profileText ? `User profile:\n${profileText}\n\n` : "") +
          `User says: ${message}`,
      },
    ],
  });

  const reply = completion.choices[0]?.message?.content?.trim() ?? "";

  return NextResponse.json({ reply });
}
