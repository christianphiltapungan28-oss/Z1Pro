import { NextResponse } from "next/server";
import { auth } from "@/auth";

const TTS_MODEL = "gpt-4o-mini-tts";
const TTS_VOICE = "alloy";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI is not configured" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

  const speechRes = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: text.slice(0, 4000),
      response_format: "mp3",
    }),
  });

  if (!speechRes.ok || !speechRes.body) {
    const errorText = await speechRes.text().catch(() => "");
    console.error("Speech synthesis failed", speechRes.status, errorText);
    return NextResponse.json(
      { error: "Speech synthesis failed" },
      { status: 502 }
    );
  }

  return new NextResponse(speechRes.body, {
    headers: { "Content-Type": "audio/mpeg" },
  });
}
