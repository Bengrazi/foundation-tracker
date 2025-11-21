// app/api/onboarding/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

function client() {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new Error("OPENAI_API_KEY is not set.");
  return new OpenAI({ apiKey: k });
}

/**
 * Input: { priorities, lifeSummary, ideology }
 * Output:
 * {
 *   "keyTruth": string,
 *   "board": [{ "name": string, "role": string, "why": string }, ...],
 *   "goals": {
 *      "3y": [{"title": string}, ... up to 3],
 *      "1y": [{"title": string}, ... up to 3],
 *      "6m": [{"title": string}, ... up to 3],
 *      "1m": [{"title": string}, ... up to 3]
 *   },
 *   "aiVoice": string
 * }
 */
export async function POST(req: Request) {
  const { priorities, lifeSummary, ideology } = await req.json();

  const system = `
You are a pragmatic, optimistic planner. Output must be a SINGLE JSON object with the described schema.

- "board": 4–6 members max. Each:
   - "name": short archetype (e.g., "CFO mentor", "Stoic coach").
   - "role": 2–5 words.
   - "why": one short sentence.
- "goals": Output EXACTLY 3 goals TOTAL across all horizons. Do not fill every horizon if not needed. Just place the 3 most high-impact goals in their appropriate timeframes.
   - Each "title" must be a concise sentence fragment (ideally 6–12 words, max 15).
   - Goals should be realistic but ambitious, clearly helping toward the implied 10-year picture.
- "keyTruth": 1 short guiding belief sentence (max ~15 words).
- "aiVoice": 2–3 short sentences describing tone for the app when speaking to this user.

Keep the JSON compact and valid. No extra commentary, no markdown, no trailing commas.
`;

  const user = `
Priorities (ranked): ${priorities}
Life today & desired 10-year future: ${lifeSummary}
Ideology / worldview: ${ideology}
`;

  const c = client();
  const resp = await c.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = resp.choices[0]?.message?.content ?? "{}";
  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    json = {};
  }
  return NextResponse.json(json);
}
