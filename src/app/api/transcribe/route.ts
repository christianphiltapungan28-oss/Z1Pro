import { NextResponse } from "next/server";
import { auth } from "@/auth";

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

  const formData = await request.formData().catch(() => null);
  const audio = formData?.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json(
      { error: "Audio file is required" },
      { status: 400 }
    );
  }

  const openaiForm = new FormData();
  openaiForm.append(
    "file",
    audio,
    audio instanceof File ? audio.name : "audio.webm"
  );
  openaiForm.append("model", "gpt-4o-mini-transcribe");

  const transcribeRes = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: openaiForm,
    }
  );

  if (!transcribeRes.ok) {
    const errorText = await transcribeRes.text().catch(() => "");
    console.error("Transcription failed", transcribeRes.status, errorText);
    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 502 }
    );
  }

  const data = await transcribeRes.json();
  return NextResponse.json({ text: data.text ?? "" });
}
