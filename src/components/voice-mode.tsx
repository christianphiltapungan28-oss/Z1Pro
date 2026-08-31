"use client";

import { useEffect, useRef, useState } from "react";
import { MicIcon } from "@/components/icons";
import { Orb } from "@/components/orb";
import type { Appearance } from "@/lib/use-appearance";

const HEADLINE: Record<Appearance, string> = {
  light: "Speak Naturally As Z1P.pro Listen And Responds Instantly",
  aurora: "Speak Naturally As Z1P.pro Listen And Responds Instantly",
};

type VoicePhase = "idle" | "recording" | "processing" | "speaking";

function pickRecorderMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
  ];
  if (typeof MediaRecorder === "undefined") return "";
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function extensionForMimeType(mimeType: string) {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

export function VoiceMode({
  appearance,
  conversationId,
  onConversationCreated,
}: {
  appearance: Appearance;
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
}) {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      audioRef.current?.pause();
    };
  }, []);

  async function handleRecordingComplete(mimeType: string) {
    setPhase("processing");
    try {
      const blob = new Blob(chunksRef.current, {
        type: mimeType || "audio/webm",
      });
      if (blob.size < 500) {
        setError("Didn't catch that — try speaking a bit longer.");
        setPhase("idle");
        return;
      }

      const form = new FormData();
      form.append("audio", blob, `audio.${extensionForMimeType(mimeType)}`);

      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        body: form,
      });
      if (!transcribeRes.ok) {
        setError("Couldn't transcribe that. Please try again.");
        setPhase("idle");
        return;
      }
      const transcribeData: { text?: string } = await transcribeRes.json();
      const spoken = (transcribeData.text ?? "").trim();
      if (!spoken) {
        setError("Didn't catch that — try again.");
        setPhase("idle");
        return;
      }
      setTranscript(spoken);
      setReply("");

      let activeId = conversationId;
      if (!activeId) {
        const createRes = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: spoken.slice(0, 60) }),
        });
        if (!createRes.ok) {
          setError("Couldn't start a new chat. Please try again.");
          setPhase("idle");
          return;
        }
        const conversation: { id: string } = await createRes.json();
        activeId = conversation.id;
        onConversationCreated(conversation.id);
      }

      const messageRes = await fetch(
        `/api/conversations/${activeId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: spoken }),
        }
      );
      if (!messageRes.ok) {
        if (messageRes.status === 429) {
          const data = await messageRes.json().catch(() => null);
          setError(
            data?.dailyLimit
              ? `You've hit today's ${data.dailyLimit}-message limit on the ${data.planCode} plan. Upgrade for more.`
              : "You've hit today's message limit. Upgrade for more."
          );
        } else {
          setError("Something went wrong. Please try again.");
        }
        setPhase("idle");
        return;
      }
      const messageData: { assistantMessage?: { content?: string } } =
        await messageRes.json();
      const replyText = messageData.assistantMessage?.content ?? "";
      setReply(replyText);

      if (!replyText) {
        setPhase("idle");
        return;
      }

      const speechRes = await fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: replyText }),
      });
      if (!speechRes.ok) {
        setPhase("idle");
        return;
      }
      const audioBlob = await speechRes.blob();
      const url = URL.createObjectURL(audioBlob);
      const audioEl = new Audio(url);
      audioRef.current = audioEl;
      audioEl.onended = () => {
        setPhase("idle");
        URL.revokeObjectURL(url);
      };
      audioEl.onerror = () => {
        setPhase("idle");
        URL.revokeObjectURL(url);
      };
      setPhase("speaking");
      await audioEl.play();
    } catch {
      setError("Something went wrong. Please try again.");
      setPhase("idle");
    }
  }

  async function startRecording() {
    setError(null);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError("Microphone access isn't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const mimeType = pickRecorderMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        handleRecordingComplete(recorder.mimeType || mimeType);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setPhase("recording");
    } catch {
      setError(
        "Couldn't access your microphone. Check permissions and try again."
      );
    }
  }

  function handleMicClick() {
    if (phase === "recording") {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (phase === "idle") {
      startRecording();
    }
  }

  const busy = phase === "processing" || phase === "speaking";
  const statusText =
    phase === "recording"
      ? "Listening… tap to stop"
      : phase === "processing"
        ? "Thinking…"
        : phase === "speaking"
          ? "Speaking…"
          : "Tap to speak";

  return (
    <div className="flex h-full flex-col items-center justify-center px-4 py-8 sm:px-8">
      <Orb size={168} appearance={appearance} />

      <div className="mt-8 max-w-md text-center">
        <h1 className="font-display text-2xl font-medium text-foreground sm:text-3xl">
          {HEADLINE[appearance]}
        </h1>
      </div>

      {(transcript || reply) && (
        <div className="mt-6 flex w-full max-w-md flex-col gap-2 text-center text-sm">
          {transcript && <p className="text-muted">&ldquo;{transcript}&rdquo;</p>}
          {reply && <p className="text-foreground">{reply}</p>}
        </div>
      )}

      {error && (
        <p className="mt-4 max-w-md text-center text-xs text-red-500">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleMicClick}
        disabled={busy}
        aria-pressed={phase === "recording"}
        aria-label={phase === "recording" ? "Stop recording" : "Start speaking"}
        className={`mt-10 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-md transition-transform disabled:opacity-60 ${
          phase === "recording"
            ? "scale-105 animate-pulse bg-[#ff6791]"
            : "bg-[#ff6791]/70"
        }`}
      >
        <MicIcon className="h-6 w-6" />
      </button>

      <p className="mt-3 text-xs text-muted">{statusText}</p>
    </div>
  );
}
