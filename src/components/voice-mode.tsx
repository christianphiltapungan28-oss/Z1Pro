"use client";

import { useEffect, useRef, useState } from "react";
import { AssetIcon } from "@/components/asset-icon";
import { DesignOrb } from "@/components/design-orb";
import { MicIcon } from "@/components/icons";
import { Orb } from "@/components/orb";
import type { Appearance } from "@/lib/use-appearance";
import { useElementSize } from "@/lib/use-element-size";
import { useMediaQuery } from "@/lib/use-media-query";
import { ORB_TRANSITION } from "@/lib/view-transition";
import {
  afterWakeWord,
  speechRecognitionCtor,
  stripWakeWord,
  type SpeechRecognition,
  type SpeechRecognitionEvent,
} from "@/lib/wake-word";

const HEADLINE: Record<Appearance, string> = {
  light: "Speak Naturally As Z1P.pro Listen And Responds Instantly",
  aurora: "Speak Naturally As Z1P.pro Listen And Responds Instantly",
};

/*
 * Hands-free (browsers with speech recognition):
 *   waiting  → listening for "Zip"
 *   hearing  → heard "Zip", taking down the question (also the follow-up
 *              window after a reply, when "Zip" isn't needed)
 *   processing → speaking → back to hearing, then waiting
 * Tap to speak (the fallback, e.g. Firefox): idle → recording → processing.
 */
type VoicePhase = "waiting" | "hearing" | "idle" | "recording" | "processing" | "speaking";

// How long to wait for the question after "Zip", and for a follow-up after
// a reply, before going back to waiting for "Zip".
const HEARING_TIMEOUT_MS = 8_000;

// Transcription bills per minute of audio, so a forgotten open mic stops
// itself instead of recording (and uploading) indefinitely.
const MAX_RECORDING_MS = 60_000;

function pickRecorderMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
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
  onExit,
}: {
  appearance: Appearance;
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
  /** Phones: the back button in voice mode's own header. */
  onExit?: () => void;
}) {
  // Voice mode only renders after a tap in the browser, never on the server.
  const [handsFree] = useState(() => speechRecognitionCtor() !== null);
  const [phase, setPhase] = useState<VoicePhase>(handsFree ? "waiting" : "idle");
  const [heard, setHeard] = useState("");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [micBlocked, setMicBlocked] = useState(false);
  // Set when the browser wouldn't play the reply without a tap.
  const [playBlocked, setPlayBlocked] = useState<HTMLAudioElement | null>(null);
  // Phones get the smaller orb from the mobile design, as on Home.
  const phone = useMediaQuery("(max-width: 767px)");
  const stageRef = useRef<HTMLDivElement>(null);
  const stage = useElementSize(stageRef);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Measures the spoken reply's loudness so the orb pulses with Z1p's voice.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelBufRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  // Recognition callbacks outlive renders, so they read state through refs.
  const phaseRef = useRef(phase);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const listeningRef = useRef(false);
  const hearingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onResultRef = useRef<(e: SpeechRecognitionEvent) => void>(() => {});

  function go(next: VoicePhase) {
    phaseRef.current = next;
    setPhase(next);
  }

  useEffect(() => {
    onResultRef.current = handleResult;
  });

  useEffect(() => {
    if (handsFree) {
      prepareAudioContext();
      startListening();
    }
    return () => {
      stopListening();
      if (hearingTimerRef.current) clearTimeout(hearingTimerRef.current);
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      audioRef.current?.pause();
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state !== "closed") ctx.close().catch(() => {});
      audioCtxRef.current = null;
    };
    // Runs once: voice mode starts listening as soon as it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Browsers (Safari especially) only let audio start after a tap. Voice
  // mode opens from one, so the context is made then, ready for replies.
  function prepareAudioContext() {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new AudioContext();
      }
      audioCtxRef.current.resume().catch(() => {});
    } catch {
      // No Web Audio: the orb falls back to its thinking rhythm.
    }
  }

  function connectAnalyser(audioEl: HTMLAudioElement) {
    const ctx = audioCtxRef.current;
    // A suspended context would silence the reply, so play it directly.
    if (!ctx || ctx.state !== "running") return null;
    try {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaElementSource(audioEl).connect(analyser);
      analyser.connect(ctx.destination);
      return analyser;
    } catch {
      return null;
    }
  }

  function voiceLevel() {
    const analyser = analyserRef.current;
    if (!analyser) return null;
    const buf = (levelBufRef.current ??= new Uint8Array(analyser.fftSize));
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += ((v - 128) / 128) ** 2;
    // Speech RMS rarely passes ~0.2, so scale it up to fill 0–1.
    return Math.min(1, Math.sqrt(sum / buf.length) * 5);
  }

  // --- Hands-free listening -------------------------------------------

  function startListening() {
    const Recognition = speechRecognitionCtor();
    if (!Recognition) return;
    listeningRef.current = true;
    if (recognitionRef.current) return;

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    let failed = false;
    recognition.onresult = (e) => onResultRef.current(e);
    recognition.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        listeningRef.current = false;
        setMicBlocked(true);
      }
      // "no-speech" and "aborted" are routine; anything else backs off.
      if (e.error !== "no-speech" && e.error !== "aborted") failed = true;
    };
    // Browsers end recognition every so often even when continuous, so it's
    // restarted for as long as voice mode wants to listen.
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      if (!listeningRef.current) return;
      setTimeout(
        () => {
          if (listeningRef.current) startListening();
        },
        failed ? 2_000 : 250,
      );
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setMicBlocked(false);
    } catch {
      recognitionRef.current = null;
    }
  }

  function stopListening() {
    listeningRef.current = false;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
  }

  function hearFor(ms: number) {
    if (hearingTimerRef.current) clearTimeout(hearingTimerRef.current);
    hearingTimerRef.current = setTimeout(() => {
      if (phaseRef.current !== "hearing") return;
      setHeard("");
      go("waiting");
    }, ms);
  }

  function handleResult(e: SpeechRecognitionEvent) {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      const text = result[0]?.transcript ?? "";

      if (phaseRef.current === "waiting") {
        const question = afterWakeWord(text);
        if (question === null) continue;
        setError(null);
        go("hearing");
        hearFor(HEARING_TIMEOUT_MS);
        setHeard(question);
        // "Zip, what's…" in one breath is asked now; "Zip" alone waits for
        // the question in the next result.
        if (result.isFinal && question) submit(question);
      } else if (phaseRef.current === "hearing") {
        const question = stripWakeWord(text);
        setHeard(question);
        hearFor(HEARING_TIMEOUT_MS);
        if (result.isFinal && question) submit(question);
      }
    }
  }

  function submit(question: string) {
    // Stop listening while replying, so Z1p doesn't hear itself.
    stopListening();
    if (hearingTimerRef.current) clearTimeout(hearingTimerRef.current);
    setHeard("");
    void respond(question);
  }

  /** After a reply: a short window for a follow-up without saying "Zip". */
  function afterReply() {
    analyserRef.current = null;
    if (!handsFree) {
      go("idle");
      return;
    }
    go("hearing");
    hearFor(HEARING_TIMEOUT_MS);
    startListening();
  }

  // --- Asking and replying --------------------------------------------

  async function respond(spoken: string) {
    go("processing");
    setError(null);
    setTranscript(spoken);
    setReply("");
    try {
      let activeId = conversationId;
      if (!activeId) {
        const createRes = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: spoken.slice(0, 60) }),
        });
        if (!createRes.ok) {
          setError("Couldn't start a new chat. Please try again.");
          afterReply();
          return;
        }
        const conversation: { id: string } = await createRes.json();
        activeId = conversation.id;
        onConversationCreated(conversation.id);
      }

      const messageRes = await fetch(`/api/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: spoken, mode: "voice" }),
      });
      if (!messageRes.ok) {
        if (messageRes.status === 429) {
          const data = await messageRes.json().catch(() => null);
          setError(
            data?.dailyLimit
              ? `You've hit today's ${data.dailyLimit}-message limit on the ${data.planCode} plan. Upgrade for more.`
              : "You've hit today's message limit. Upgrade for more.",
          );
        } else {
          setError("Something went wrong. Please try again.");
        }
        afterReply();
        return;
      }
      const messageData: {
        assistantMessage?: { id?: string; content?: string };
      } = await messageRes.json();
      const replyText = messageData.assistantMessage?.content ?? "";
      setReply(replyText);

      const replyId = messageData.assistantMessage?.id;
      if (!replyText || !replyId) {
        afterReply();
        return;
      }

      const speechRes = await fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: replyId }),
      });
      if (!speechRes.ok) {
        afterReply();
        return;
      }
      const audioBlob = await speechRes.blob();
      const url = URL.createObjectURL(audioBlob);
      const audioEl = new Audio(url);
      audioRef.current = audioEl;
      analyserRef.current = connectAnalyser(audioEl);
      audioEl.onended = () => {
        URL.revokeObjectURL(url);
        afterReply();
      };
      audioEl.onerror = () => {
        URL.revokeObjectURL(url);
        afterReply();
      };
      go("speaking");
      try {
        await audioEl.play();
      } catch {
        // The browser wants a tap before playing sound.
        setPlayBlocked(audioEl);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      afterReply();
    }
  }

  function playBlockedReply() {
    prepareAudioContext();
    void playBlocked?.play().catch(() => afterReply());
    setPlayBlocked(null);
  }

  // --- Tap to speak (browsers without speech recognition) -------------

  async function handleRecordingComplete(mimeType: string) {
    go("processing");
    try {
      const blob = new Blob(chunksRef.current, {
        type: mimeType || "audio/webm",
      });
      if (blob.size < 500) {
        setError("Didn't catch that — try speaking a bit longer.");
        go("idle");
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
        go("idle");
        return;
      }
      const transcribeData: { text?: string } = await transcribeRes.json();
      const spoken = (transcribeData.text ?? "").trim();
      if (!spoken) {
        setError("Didn't catch that — try again.");
        go("idle");
        return;
      }
      await respond(spoken);
    } catch {
      setError("Something went wrong. Please try again.");
      go("idle");
    }
  }

  async function startRecording() {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Microphone access isn't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const mimeType = pickRecorderMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
        stream.getTracks().forEach((t) => t.stop());
        handleRecordingComplete(recorder.mimeType || mimeType);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      stopTimerRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, MAX_RECORDING_MS);
      go("recording");
    } catch {
      setError("Couldn't access your microphone. Check permissions and try again.");
    }
  }

  // --- Mic button -----------------------------------------------------

  /**
   * Hands-free: tap instead of saying "Zip". While listening, tap again to
   * send what was heard (or cancel if nothing was); while Z1p is talking,
   * tap to cut it off and speak.
   */
  function handleHandsFreeMicClick() {
    prepareAudioContext();
    setError(null);
    if (phase === "waiting") {
      setHeard("");
      go("hearing");
      hearFor(HEARING_TIMEOUT_MS);
      startListening();
    } else if (phase === "hearing") {
      if (heard.trim()) {
        submit(heard.trim());
      } else {
        if (hearingTimerRef.current) clearTimeout(hearingTimerRef.current);
        go("waiting");
      }
    } else if (phase === "speaking") {
      audioRef.current?.pause();
      setPlayBlocked(null);
      afterReply();
    }
  }

  function handleMicClick() {
    if (handsFree) {
      handleHandsFreeMicClick();
      return;
    }
    if (phase === "recording") {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (phase === "idle") {
      prepareAudioContext();
      startRecording();
    }
  }

  // --- View -----------------------------------------------------------

  const busy = phase === "processing" || phase === "speaking";
  const orbActive = busy || phase === "hearing";
  // Before the voice starts there's no level, so the orb keeps its own rhythm.
  const orbLevel = phase === "speaking" ? voiceLevel : undefined;
  // The mic is live (pulsing) while it's taking down what you say.
  const micLive = phase === "hearing" || phase === "recording";
  // Hands-free can interrupt a reply; tap to speak waits for it to finish.
  const micDisabled = phase === "processing" || (!handsFree && phase === "speaking");
  const micLabel =
    phase === "recording"
      ? "Stop recording"
      : phase === "hearing"
        ? heard
          ? "Send"
          : "Stop listening"
        : phase === "speaking" && handsFree
          ? "Interrupt and speak"
          : "Start speaking";
  const statusText = micBlocked
    ? "Z1p needs your microphone to hear you"
    : phase === "waiting"
      ? "Say “Zip” or tap the mic to speak"
      : phase === "hearing"
        ? heard
          ? "Listening… tap to send"
          : "Listening…"
        : phase === "recording"
          ? "Listening… tap to stop"
          : phase === "processing"
            ? "Thinking…"
            : phase === "speaking"
              ? handsFree
                ? "Speaking… tap the mic to interrupt"
                : "Speaking…"
              : "Tap to speak";

  // Phones size the orb to the screen's height, leaving room for the headline
  // and status below it (short phones get a smaller orb, tall ones a bigger).
  const orbWidth = phone
    ? Math.round(Math.max(120, Math.min(230, ((stage?.height ?? 600) - 230) / 1.17)))
    : 241;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 px-3 md:hidden">
        {onExit && (
          <button
            type="button"
            onClick={onExit}
            aria-label="Back to Home"
            className="flex size-10 items-center justify-center rounded-full bg-foreground/5"
          >
            <AssetIcon name="journey/arrow-left" width={18} height={18} />
          </button>
        )}
        <p className="text-base font-bold text-foreground">Voice</p>
      </header>

      <div
        ref={stageRef}
        className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-4 sm:px-8 md:py-8"
      >
        {/* Shares Home's orb transition name, so the orb glides in from Home. */}
        <span style={{ viewTransitionName: ORB_TRANSITION }}>
          {appearance === "light" ? (
            <DesignOrb width={orbWidth} active={orbActive} getLevel={orbLevel} />
          ) : (
            <Orb
              size={Math.round(orbWidth * 0.75)}
              appearance={appearance}
              active={orbActive}
              getLevel={orbLevel}
            />
          )}
        </span>

        <div className="mt-[clamp(12px,3vh,32px)] max-w-md text-center">
          <h1 className="font-display text-[clamp(20px,6vw,24px)] leading-tight font-medium text-foreground sm:text-3xl">
            {HEADLINE[appearance]}
          </h1>
        </div>

        {phase === "hearing" && heard ? (
          <p className="mt-6 max-w-md text-center text-sm text-muted">&ldquo;{heard}&rdquo;</p>
        ) : (
          (transcript || reply) && (
            <div className="mt-6 flex w-full max-w-md flex-col gap-2 text-center text-sm">
              {transcript && <p className="text-muted">&ldquo;{transcript}&rdquo;</p>}
              {reply && <p className="text-foreground">{reply}</p>}
            </div>
          )
        )}

        {error && (
          <p role="alert" className="mt-4 max-w-md text-center text-xs text-red-500">
            {error}
          </p>
        )}

        {playBlocked && (
          <button
            type="button"
            onClick={playBlockedReply}
            className="mt-6 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-md"
          >
            Play Z1p&rsquo;s reply
          </button>
        )}

        {handsFree && micBlocked ? (
          <button
            type="button"
            onClick={() => {
              prepareAudioContext();
              startListening();
            }}
            className="mt-6 flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-bold text-white shadow-md md:mt-10"
          >
            <MicIcon className="h-5 w-5" />
            Turn on microphone
          </button>
        ) : (
          <button
            type="button"
            onClick={handleMicClick}
            disabled={micDisabled}
            aria-pressed={micLive}
            aria-label={micLabel}
            className={`mt-6 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-md transition-transform disabled:opacity-60 md:mt-10 ${
              micLive ? "scale-105 animate-pulse bg-accent" : "bg-accent/70"
            }`}
          >
            <MicIcon className="h-6 w-6" />
          </button>
        )}

        <p aria-live="polite" className="mt-3 text-xs text-muted">
          {statusText}
        </p>
      </div>
    </div>
  );
}
