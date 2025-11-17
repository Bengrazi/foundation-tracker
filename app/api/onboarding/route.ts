// app/api/onboarding/route.ts
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
  const { priorities, lifeSummary, ideology } = await req.json();

  const client = getOpenAIClient();

  const system = `
You are helping a user set up their personal Foundation habit app.

You must respond as a STRICT JSON object with this shape:
{
  "keyTruth": string,
  "goals": [
    { "title": string, "horizon": "3y" | "1y" | "6m" | "1m" },
    ...
  ],
  "aiVoice": string
}

- "keyTruth" is a single guiding belief or phrase for the next decade.
- "goals" should contain exactly 4 goals: one for each horizon "3y", "1y", "6m", "1m".
- Make each goal concrete and measurable enough to track.
- "aiVoice" is 2–3 sentences describing the tone the AI should use with this user, based on their values and worldview.
- Keep everything concise and free of JSON-breaking characters.
`;

  const userContent = `
Priorities ranked (Financial / Family / Friends (Community) / Personal Growth):
${priorities}

Life today and desired 10-year future:
${lifeSummary}

Ideology / worldview:
${ideology}
`;

  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  return NextResponse.json(parsed);
}
