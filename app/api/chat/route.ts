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
Life summary / 10-year vision: ${profile.life_summary ?? ""}
Ideology / worldview: ${profile.ideology ?? ""}
Key truth: ${profile.key_truth ?? ""}
Preferred tone: ${profile.ai_voice ?? ""}
Total Cherries (Lifetime Proof of Work): ${profile.points ?? 0}
`
    : "";

  const system = `
    You are Foundation AI, a calm, stoic, and deeply supportive partner in discipline.
    Your role is to mirror the user's intentions and reinforce their consistency.
    
    Style:
    - Concise: Max 1-2 sentences. No fluff.
    - Tone: Proud, grounded, serious but warm. Like a trusted mentor or a mirror.
    - Avoid: "Woohoo!", exclamation marks, toxic positivity.
    
    Stats Context:
    - 1 Cherry = 1 Unit of Effort.
    - The Pyramid = Lifetime proof of work.
    
    Focus on ONE thing: Evidence of execution.
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
          `Context mode: ${contextDescription}\n\n` +
          (profileText ? `User profile:\n${profileText}\n\n` : "") +
          (goalsText ? `${goalsText}\n\n` : "") +
          `User says: ${message}`,
      },
    ],
  });

  const reply = completion.choices[0]?.message?.content?.trim() ?? "";

  return NextResponse.json({ reply });
}
