import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { aiMessages } from "@/db/schema";
import { openaiFetch } from "@/lib/openai";
import { rateLimit } from "@/lib/rate-limit";
import { isOverDailyBudget, recordUsage } from "@/lib/usage-guard";

const TTS_MODEL = "gpt-4o-mini-tts";
const TTS_VOICE = "alloy";
// Text-to-speech is billed by audio length and is the biggest cost of a
// voice turn. Voice replies are prompted to be 1–3 sentences; anything longer
// is cut at a sentence boundary (the full reply still shows on screen).
const MAX_SPEECH_CHARS = 600;

function speakablePart(text: string) {
  if (text.length <= MAX_SPEECH_CHARS) return text;
  const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)/g) ?? [];
  let spoken = "";
  for (const sentence of sentences) {
    if (spoken.length + sentence.length > MAX_SPEECH_CHARS) break;
    spoken += sentence;
  }
  // One very long sentence: fall back to cutting at the last word.
  return (
    spoken.trim() ||
    text.slice(0, MAX_SPEECH_CHARS).replace(/\s+\S*$/, "") + "…"
  );
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const burst = await rateLimit(`speech:${userId}`, 20, 10 * 60_000);
  const daily = burst.ok
    ? await rateLimit(`speech:daily:${userId}`, 150, 24 * 3600_000)
    : burst;
  if (!daily.ok) {
    return NextResponse.json(
      { error: "Too many speech requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(daily.retryAfterSeconds) } }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "AI is not configured" },
      { status: 500 }
    );
  }

  if (await isOverDailyBudget("speechChars")) {
    return NextResponse.json(
      { error: "Voice replies are temporarily unavailable." },
      { status: 503 }
    );
  }

  // Only speak an assistant reply this user already received, never
  // arbitrary text, so the endpoint can't be used as a free TTS service.
  const body = await request.json().catch(() => ({}));
  const messageId = typeof body?.messageId === "string" ? body.messageId : "";
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) {
    return NextResponse.json({ error: "messageId is required" }, { status: 400 });
  }

  const [message] = await db
    .select({ content: aiMessages.content })
    .from(aiMessages)
    .where(
      and(
        eq(aiMessages.id, messageId),
        eq(aiMessages.userId, userId),
        eq(aiMessages.role, "assistant")
      )
    )
    .limit(1);
  if (!message) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const text = speakablePart(message.content.trim());
  if (!text) {
    return NextResponse.json({ error: "Nothing to speak" }, { status: 400 });
  }

  let speechRes: Response | null = null;
  try {
    speechRes = await openaiFetch(
      "/audio/speech",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: TTS_MODEL,
          voice: TTS_VOICE,
          input: text,
          response_format: "mp3",
        }),
      },
      { timeoutMs: 45_000, maxRetries: 1 }
    );
  } catch (err) {
    console.error("Speech synthesis failed", err);
  }

  if (!speechRes?.ok || !speechRes.body) {
    const errorText = speechRes ? await speechRes.text().catch(() => "") : "";
    console.error("Speech synthesis failed", speechRes?.status, errorText);
    return NextResponse.json(
      { error: "Speech synthesis failed" },
      { status: 502 }
    );
  }

  await recordUsage("speechChars", text.length);

  return new NextResponse(speechRes.body, {
    headers: { "Content-Type": "audio/mpeg" },
  });
}
