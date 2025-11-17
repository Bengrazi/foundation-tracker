// app/api/intention/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST() {
  const system = `
You are a stoic and optimistic coach.
Write a single, short, practical daily intention in 1–2 sentences.
Tone: calm, encouraging, grounded, never cheesy.
Do NOT mention Stoicism directly.
`;

  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: "Generate a daily intention." },
    ],
  });

  const intention = completion.choices[0]?.message?.content?.trim() ?? "";

  return NextResponse.json({ intention });
}
