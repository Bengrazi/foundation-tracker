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
 * Output (STRICT JSON):
 * {
 *   "keyTruth": string,
 *   "board": [
 *      {"name": string, "role": string, "why": string}, ...
 *   ],
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
You are a pragmatic, optimistic planner. Output must be a SINGLE JSON object matching the required schema.

Rules:
- "board": 4–6 members max. Give realistic archetypes (e.g., "CFO mentor", "Family advisor", "Strength & cardio coach",
  "Community connector", "Founder/Operator", "Stoic mentor", etc.). Include "why" for each (1 short sentence).
- "goals": For each horizon (3y, 1y, 6m, 1m), propose 1–3 specific, measurable goals that, taken together,
  realistically lead toward the user's 10-year intent implied in their summary. Be optimistic, but not delusional.
- "keyTruth": 1 concise guiding belief for the next decade.
- "aiVoice": 2–3 sentences describing tone for the app when speaking to this user.
Keep the JSON compact and free of escape-breaking characters. No additional commentary.
`;

  const user = `
Priorities (ranked): ${priorities}
Life today & desired 10-year future: ${lifeSummary}
Ideology / worldview: ${ideology}
`;

  const c = client();
  const resp = await c.chat.completions.create({
    model: "gpt-4.1-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = resp.choices[0]?.message?.content ?? "{}";
  let json: any;
  try { json = JSON.parse(raw); } catch { json = {}; }
  return NextResponse.json(json);
}
