import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { openaiFetch } from "@/lib/openai";
import { rateLimit } from "@/lib/rate-limit";
import { isOverDailyBudget, recordUsage } from "@/lib/usage-guard";

// Transcription bills per minute of audio. The recorder stops itself after
// 60 seconds, which is well under 2 MB of Opus/WebM; this server-side cap is
// the backstop against a modified client uploading much longer audio.
const MAX_AUDIO_BYTES = 3 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const burst = await rateLimit(`transcribe:${userId}`, 15, 10 * 60_000);
  const daily = burst.ok
    ? await rateLimit(`transcribe:daily:${userId}`, 150, 24 * 3600_000)
    : burst;
  if (!daily.ok) {
    return NextResponse.json(
      { error: "Too many transcription requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(daily.retryAfterSeconds) } }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "AI is not configured" },
      { status: 500 }
    );
  }

  if (await isOverDailyBudget("transcribeKb")) {
    return NextResponse.json(
      { error: "Voice input is temporarily unavailable." },
      { status: 503 }
    );
  }

  // Reject oversized uploads before reading the body into memory.
  const declaredLength = Number(request.headers.get("content-length"));
  if (declaredLength > MAX_AUDIO_BYTES + 64 * 1024) {
    return NextResponse.json(
      { error: "Audio file is too large" },
      { status: 413 }
    );
  }

  const formData = await request.formData().catch(() => null);
  const audio = formData?.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json(
      { error: "Audio file is required" },
      { status: 400 }
    );
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Audio file is too large" },
      { status: 413 }
    );
  }
  if (!audio.type.startsWith("audio/") && !audio.type.startsWith("video/webm")) {
    return NextResponse.json(
      { error: "Unsupported audio format" },
      { status: 415 }
    );
  }

  const openaiForm = new FormData();
  openaiForm.append(
    "file",
    audio,
    audio instanceof File ? audio.name : "audio.webm"
  );
  openaiForm.append("model", "gpt-4o-mini-transcribe");

  let transcribeRes: Response | null = null;
  try {
    transcribeRes = await openaiFetch(
      "/audio/transcriptions",
      { method: "POST", body: openaiForm },
      { timeoutMs: 60_000, maxRetries: 1 }
    );
  } catch (err) {
    console.error("Transcription failed", err);
  }

  if (!transcribeRes?.ok) {
    const errorText = transcribeRes
      ? await transcribeRes.text().catch(() => "")
      : "";
    console.error("Transcription failed", transcribeRes?.status, errorText);
    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 502 }
    );
  }

  await recordUsage("transcribeKb", Math.ceil(audio.size / 1024));

  const data = await transcribeRes.json();
  return NextResponse.json({ text: data.text ?? "" });
}
