// app/api/chat/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  const { message, contextMode } = await req.json();

  let contextDescription = "";
  if (contextMode === "last7days") {
    contextDescription = "Focus on the last 7 days of routines and reflections.";
  } else if (contextMode === "allReflections") {
    contextDescription =
      "Use all available reflections and high-level routine/goal data.";
  } else {
    contextDescription =
      "Give general advice based on healthy routines and consistent habits.";
  }

  const system = `
You are Foundation AI, a calm, supportive, slightly stoic and optimistic coach.
Be VERY concise and practical.
Respond in at most 3 short paragraphs or 5 bullet points, and keep it under ~120 words.
Avoid fluffy quotes. Focus on one or two specific, doable suggestions.
`;

  const completion = await client.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `Context: ${contextDescription}\n\nUser says: ${message}`,
      },
    ],
  });

  const reply = completion.choices[0]?.message?.content?.trim() ?? "";

  return NextResponse.json({ reply });
}
