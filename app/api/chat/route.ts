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
  const { message, contextMode, profile, goals } = await req.json();

  let contextDescription = "";
  if (contextMode === "last7days") {
    contextDescription = "Focus on the last 7 days of routines and consistency.";
  } else if (contextMode === "allReflections") {
    contextDescription =
      "Use all available reflections and stats data.";
  } else if (contextMode === "celebration") {
    contextDescription = "The user just hit a milestone. Acknowledge with pride but keep it grounded.";
  } else {
    contextDescription =
      "Give general advice based on healthy routines and consistent habits.";
  }

  const profileText = profile
    ? `
User priorities: ${profile.priorities ?? ""}
Life summary: ${profile.life_summary ?? ""}
Ideology: ${profile.ideology ?? ""}
points: ${profile.points ?? 0}
`
    : "";

  const system = `
    You are Foundation AI, a stoic, concise mentor.
    
    CRITICAL INSTRUCTION: Your response must be EXTREMELY SHORT. 
    Maximum 20 words. Preferably 10.
    
    Style:
    - Concise: 1 sentence.
    - Tone: Proud, grounded.
    - No "Woohoo!".
    `;

  const client = getOpenAIClient();

  let goalsText = "";
  if (goals && Array.isArray(goals)) {
    goalsText = "User Goals:\n" + goals.map((g: any) => `- ${g.title} (${g.horizon})`).join("\n");
  }

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content:
          `Context: ${contextDescription}\n` +
          (profileText ? `Profile: ${profileText}\n` : "") +
          `User: ${message}`,
      },
    ],
  });

  const reply = completion.choices[0]?.message?.content?.trim() ?? "";

  return NextResponse.json({ reply });
}
