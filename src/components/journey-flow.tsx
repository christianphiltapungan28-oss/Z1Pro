"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { View } from "@/components/app-shell";
import { DesignOrb } from "@/components/design-orb";
import { MarkdownMessage } from "@/components/markdown-message";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { Skeleton, SkeletonGroup } from "@/components/skeleton";

/** The journey page's layout (top bar, chat, checklist) while it loads. */
function JourneyFlowSkeleton() {
  return (
    <SkeletonGroup label="Loading journey" className="flex min-h-dvh flex-col bg-flow-bg">
      <div className="flex items-center justify-between gap-4 border-b border-flow-line bg-background px-[27px] py-4 sm:px-10 sm:py-5">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-4 w-44 sm:w-64" />
          </div>
        </div>
        <Skeleton className="hidden h-2 w-40 rounded md:block" />
      </div>
      <div className="flex flex-1 flex-col gap-8 p-4 sm:p-10 lg:flex-row">
        <div className="flex min-h-[420px] min-w-0 flex-1 flex-col gap-6 rounded-3xl border border-flow-line bg-background p-6 sm:min-h-[640px] sm:p-10">
          <Skeleton className="size-[90px] self-center rounded-full" />
          <Skeleton className="h-16 w-3/4 rounded-2xl" />
          <Skeleton className="ml-auto h-11 w-1/2 rounded-2xl" />
          <Skeleton className="h-20 w-2/3 rounded-2xl" />
          <Skeleton className="mt-auto h-14 w-full rounded-[28px]" />
        </div>
        <div className="hidden w-full shrink-0 flex-col gap-6 rounded-3xl border border-flow-line bg-background p-6 sm:p-10 md:flex lg:w-[480px]">
          <Skeleton className="h-3 w-28" />
          {["w-3/5", "w-1/2", "w-2/3", "w-2/5", "w-1/2"].map((width, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="size-7 shrink-0 rounded-full" />
              <Skeleton className={`h-4 ${width}`} />
            </div>
          ))}
        </div>
      </div>
    </SkeletonGroup>
  );
}

// ---------------------------------------------------------------------------
// Types

type Step = {
  id: string;
  position: number;
  title: string;
  tip: string | null;
  status: "pending" | "active" | "done";
  completedAt: string | null;
};

type FileMeta = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type Flow = {
  ready: boolean;
  journey: {
    id: string;
    title: string;
    progress: number;
    completedAt: string | null;
    createdAt: string;
    sourceConversationId: string | null;
  };
  steps: Step[];
  files: FileMeta[];
  messages: Message[];
};

type Busy = "analyzing" | "recording" | "transcribing" | "replying" | null;

// Placeholder breakdown shown before the AI has planned the real one.
const PLACEHOLDER_STEPS = [
  "Understand the requirements",
  "Research key topics",
  "Build your argument",
  "Draft your response",
  "Review & refine",
];

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,application/pdf,image/*,text/plain,text/markdown";
const MAX_RECORDING_MS = 60_000;

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(from: string, to: string) {
  const minutes = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days >= 2) return `${days} days`;
  return `${hours} h ${minutes % 60} min`;
}

function pickRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return (
    ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) =>
      MediaRecorder.isTypeSupported(t)
    ) ?? ""
  );
}

function Icon(props: { name: string; size: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
    src={`/ui/journey/${props.name}.svg`}
    alt=""
    width={props.size}
    height={props.size}
      className={`shrink-0 ${props.className ?? ""}`}
    />
  );
}

// ---------------------------------------------------------------------------
// Pieces

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  const ai = role === "assistant";
  return (
    <div
      className={`flex w-full flex-col gap-3 rounded-2xl border p-6 ${
        ai ? "border-flow-line bg-flow-bg" : "border-transparent bg-flow-user"
      }`}
    >
      <p className={`text-xs font-bold uppercase ${ai ? "text-flow" : "text-flow-muted"}`}>
        {ai ? "Zip AI" : "You"}
      </p>
      <div className="text-lg font-medium leading-[26px] text-flow-ink">{children}</div>
    </div>
  );
}

function StatusPill({ label, pulse }: { label: string; pulse?: boolean }) {
  return (
    <div className="flex w-full items-center gap-4 rounded-2xl border border-flow-line bg-flow-bg p-5">
      <span className={`size-2.5 shrink-0 rounded-full bg-flow ${pulse ? "animate-pulse" : ""}`} />
      <p className="text-sm font-bold uppercase text-flow">{label}</p>
    </div>
  );
}

function StepRow({ step, placeholder }: { step: Pick<Step, "title" | "status">; placeholder?: boolean }) {
  if (step.status === "done") {
    return (
      <div className="flex w-full items-center gap-4 rounded-2xl border border-done-line bg-done-bg p-[18px]">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-xl bg-done">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ui/check-small.svg" alt="" width={12} height={12} />
        </span>
        <p className="min-w-0 flex-1 text-base font-medium text-flow-muted">
          <span className="sr-only">Done: </span>
          {step.title}
        </p>
      </div>
    );
  }
  if (step.status === "active") {
    return (
      <div className="flex w-full items-center gap-4 rounded-2xl border border-flow-ring bg-flow-soft p-[18px]" aria-current="step">
        <Icon name="checkbox-active" size={24} />
        <p className="min-w-0 flex-1 text-base font-bold text-flow-ink">{step.title}</p>
      </div>
    );
  }
  return (
    <div
      className={`flex w-full items-center gap-4 rounded-2xl border border-flow-line bg-flow-bg p-[18px] ${
        placeholder ? "opacity-70" : ""
      }`}
    >
      <span className="size-6 shrink-0 rounded-xl border-[1.5px] border-flow-muted" />
      <p className="min-w-0 flex-1 text-base font-medium text-flow-ink">{step.title}</p>
    </div>
  );
}

function HelperCard({ title, sparkle, children }: { title: string; sparkle?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2.5 rounded-2xl border border-flow-ring bg-flow-soft p-5">
      <div className="flex items-center gap-2">
        {sparkle && <Icon name="sparkle" size={16} />}
        <p className="text-sm font-bold text-flow-ink">{title}</p>
      </div>
      <div className="text-[13px] leading-[18px] text-flow-muted">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phone pieces (mobile Figma 523:5379 – 533:7583)

function MobileMessage({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  const ai = role === "assistant";
  return (
    <div className="flex w-full flex-col gap-2 rounded-[14px] border border-flow-line bg-background p-4">
      <p className={`text-[11px] font-bold uppercase ${ai ? "text-flow" : "text-flow-muted"}`}>
        {ai ? "Zip AI" : "You"}
      </p>
      <div className="text-[15px] leading-[21px] font-medium text-flow-ink">{children}</div>
    </div>
  );
}

function MobileTask({ step }: { step: Pick<Step, "title" | "status"> }) {
  const done = step.status === "done";
  const active = step.status === "active";
  return (
    <div
      aria-current={active ? "step" : undefined}
      className={`flex w-full items-center gap-2.5 rounded-[10px] border border-flow-line px-3 py-2.5 ${
        done ? "bg-done-bg" : active ? "bg-flow-tint" : "bg-background"
      }`}
    >
      <Icon name={done ? "status-done" : active ? "status-active" : "status-pending"} size={20} />
      <p className={`min-w-0 flex-1 text-[13px] font-medium ${done ? "text-done" : "text-flow-ink"}`}>
        {done && <span className="sr-only">Done: </span>}
        {done ? "✓ " : ""}
        {step.title}
      </p>
    </div>
  );
}

function MobileBreakdown({ steps }: { steps: Pick<Step, "title" | "status">[] }) {
  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-xs font-bold uppercase text-foreground">Actionable breakdown</p>
      {steps.map((step, i) => (
        <MobileTask key={`${i}-${step.title}`} step={step} />
      ))}
    </div>
  );
}

function MobileTip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-[5px] rounded-[14px] bg-flow-tint p-3.5">
      <p className="text-[13px] font-bold text-flow-ink">✦ {title}</p>
      <p className="text-xs leading-[17px] font-medium text-flow-muted">{children}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function JourneyFlow({ journeyId }: { journeyId: string }) {
  const router = useRouter();
  const [flow, setFlow] = useState<Flow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [pendingFile, setPendingFile] = useState<{ name: string; size: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [liveTranscript, setLiveTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Phones: the response bar switches between voice and typing.
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/journeys/${journeyId}/flow`)
      .then(async (res) => {
        if (res.status === 404) throw new Error("This journey couldn't be found.");
        if (!res.ok) throw new Error("Couldn't load this journey. Please refresh.");
        return res.json();
      })
      .then((data: Flow) => {
        if (!ignore) setFlow(data);
      })
      .catch((err: Error) => {
        if (!ignore) setLoadError(err.message);
      });
    return () => {
      ignore = true;
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      if (stopTimer.current) clearTimeout(stopTimer.current);
    };
  }, [journeyId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    mobileScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [flow?.messages.length, busy, liveTranscript]);

  useEffect(() => {
    if (!celebrate) return;
    const t = setTimeout(() => setCelebrate(null), 8000);
    return () => clearTimeout(t);
  }, [celebrate]);

  // --- actions -------------------------------------------------------------

  async function upload(file: File) {
    if (busy) return;
    setError(null);
    setPendingFile({ name: file.name, size: file.size });
    setBusy("analyzing");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/journeys/${journeyId}/files`, { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Couldn't upload that file. Please try again.");
        return;
      }
      setFlow(data);
    } finally {
      setBusy(null);
      setPendingFile(null);
    }
  }

  async function planFromText(description?: string) {
    if (busy) return;
    setError(null);
    setBusy("analyzing");
    try {
      const res = await fetch(`/api/journeys/${journeyId}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Couldn't plan the steps. Please try again.");
        return;
      }
      setFlow(data);
    } finally {
      setBusy(null);
    }
  }

  async function sendReply(content: string) {
    const text = content.trim();
    if (!text || busy || !flow) return;
    setError(null);
    setBusy("replying");
    const optimistic: Message = {
      id: `pending-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setFlow({ ...flow, messages: [...flow.messages, optimistic] });
    try {
      const res = await fetch(`/api/journeys/${journeyId}/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFlow((f) => (f ? { ...f, messages: f.messages.filter((m) => m.id !== optimistic.id) } : f));
        setDraft(text);
        setError(
          res.status === 429 && data?.dailyLimit
            ? `You've hit today's ${data.dailyLimit}-message limit on the ${data.planCode} plan.`
            : (data?.error ?? "Zip couldn't reply just now. Please try again.")
        );
        return;
      }
      setFlow((f) =>
        f
          ? {
              ...f,
              steps: data.steps,
              journey: {
                ...f.journey,
                progress: data.progress,
                completedAt: data.journeyComplete ? new Date().toISOString() : f.journey.completedAt,
              },
              messages: [
                ...f.messages.filter((m) => m.id !== optimistic.id),
                data.userMessage,
                data.assistantMessage,
              ],
            }
          : f
      );
      if (data.completedStep && !data.journeyComplete) {
        const index = (data.steps as Step[]).findIndex((s) => s.title === data.completedStep);
        setCelebrate(`Step ${index + 1} Complete! Excellent Progress`);
      }
    } finally {
      setBusy(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft;
    setDraft("");
    if (!flow || flow.steps.length === 0) {
      void planFromText(text);
    } else {
      void sendReply(text);
    }
  }

  async function toggleRecording() {
    if (busy === "recording") {
      recorderRef.current?.stop();
      return;
    }
    if (busy) return;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Voice input isn't supported in this browser.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Couldn't access your microphone. Check permissions and try again.");
      return;
    }
    const mimeType = pickRecorderMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
      stream.getTracks().forEach((t) => t.stop());
      const type = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunks, { type });
      if (blob.size < 500) {
        setBusy(null);
        setError("Didn't catch that — try speaking a bit longer.");
        return;
      }
      setBusy("transcribing");
      setLiveTranscript("");
      try {
        const form = new FormData();
        const ext = type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : "webm";
        form.append("audio", blob, `answer.${ext}`);
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = await res.json().catch(() => null);
        const spoken = (data?.text ?? "").trim();
        if (!res.ok || !spoken) {
          setBusy(null);
          setError(res.ok ? "Didn't catch that — try again." : "Couldn't transcribe that. Please try again.");
          return;
        }
        setBusy(null);
        if (!flow || flow.steps.length === 0) {
          void planFromText(spoken);
        } else {
          void sendReply(spoken);
        }
      } finally {
        setLiveTranscript(null);
      }
    };
    recorderRef.current = recorder;
    recorder.start();
    stopTimer.current = setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, MAX_RECORDING_MS);
    setBusy("recording");
  }

  function copyDraft() {
    if (!flow) return;
    const draftStep = flow.steps.find((s) => /draft/i.test(s.title));
    const userText = flow.messages.filter((m) => m.role === "user").map((m) => m.content);
    const text =
      (draftStep ? userText.slice(-3) : userText).join("\n\n") || "Nothing to copy yet.";
    void navigator.clipboard?.writeText(text).then(
      () => setCelebrate("Copied your responses to the clipboard"),
      () => setError("Couldn't copy to the clipboard.")
    );
  }

  // --- render --------------------------------------------------------------

  const journeysHref = "/?view=journeys";

  if (loadError) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-flow-bg p-6 text-center">
        <p className="text-lg font-semibold text-flow-ink">{loadError}</p>
        <button type="button" onClick={() => router.push(journeysHref)} className="rounded-[30px] bg-flow px-6 py-3 text-[15px] font-bold text-white">
          Back to Journeys
        </button>
      </div>
    );
  }
  if (!flow) return <JourneyFlowSkeleton />;

  const { journey, steps, files, messages } = flow;
  const hasPlan = steps.length > 0;
  const activeIndex = steps.findIndex((s) => s.status === "active");
  const doneCount = steps.filter((s) => s.status === "done").length;
  const complete = hasPlan && activeIndex === -1 && doneCount === steps.length;
  const analyzing = busy === "analyzing";
  const listening = busy === "recording" || busy === "transcribing";
  const progress = complete ? 100 : hasPlan ? Math.round((doneCount / steps.length) * 100) : 0;
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const shownMessages = messages.slice(-6);
  const activeStep = activeIndex >= 0 ? steps[activeIndex] : null;
  const latestCompleted = [...steps].reverse().find((s) => s.status === "done");

  const stepBadge = analyzing
    ? "Analyzing…"
    : hasPlan
      ? `Step ${complete ? steps.length : activeIndex + 1} of ${steps.length}`
      : "Getting started";

  const composerDisabled = analyzing || busy === "replying" || !flow.ready;

  // --- phone layout (below md) -------------------------------------------

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const userReplies = messages.filter((m) => m.role === "user").length;
  const finalStep = hasPlan && activeIndex === steps.length - 1;
  const firstFile = files[0];

  let mobileLabel: string;
  let mobileHeading: string;
  let mobileBody: React.ReactNode;

  if (!flow.ready) {
    mobileLabel = "Coming soon";
    mobileHeading = journey.title;
    mobileBody = (
      <MobileMessage role="assistant">
        Guided journeys aren&rsquo;t switched on yet. Please check back soon.
      </MobileMessage>
    );
  } else if (analyzing) {
    mobileLabel = "AI analyzing";
    mobileHeading = "Building Your Plan";
    mobileBody = (
      <>
        <div role="status" className="flex flex-col items-center gap-2 py-4 text-center">
          <DesignOrb width={130} active />
          <p className="text-[11px] font-bold uppercase text-flow">
            {pendingFile ? "Zip AI · Analyzing your file" : "Zip AI · Planning your steps"}
          </p>
          <p className="text-xs text-flow-muted">Finding requirements and key milestones</p>
        </div>
        <MobileMessage role="assistant">
          Reading through your {pendingFile ? "document" : "notes"} and preparing personalized guidance…
        </MobileMessage>
      </>
    );
  } else if (!hasPlan) {
    mobileLabel = "Ready to upload";
    mobileHeading = "Add your assignment";
    mobileBody = (
      <>
        <MobileMessage role="assistant">
          Welcome! Upload your assignment and I&rsquo;ll help you work through it step by step.
        </MobileMessage>
        <div className="flex h-[233px] w-full flex-col items-center justify-center gap-[15px] rounded-[10px] border border-dashed border-card-border">
          <div className="flex flex-col items-center gap-5">
            <Icon name="m-cloud-upload" size={40} />
            <p className="text-base font-bold text-flow-ink">Choose your assignment file</p>
          </div>
          <p className="-mt-1 text-xs text-flow-muted">PDF, image or text file · up to 8 MB</p>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex h-11 w-[180px] items-center justify-center rounded-full bg-accent text-sm font-bold text-white"
          >
            Upload File
          </button>
        </div>
        {journey.sourceConversationId && (
          <button
            type="button"
            onClick={() => planFromText()}
            className="self-center text-sm font-semibold text-flow"
          >
            No file? Build my steps from our conversation
          </button>
        )}
      </>
    );
  } else if (complete) {
    mobileLabel = "Journey complete";
    mobileHeading = "Journey Complete";
    mobileBody = (
      <>
        <div className="flex w-full flex-col items-center gap-3 rounded-[20px] bg-background px-[18px] py-[22px] text-center">
          <span className="flex size-[72px] items-center justify-center rounded-full border border-gold bg-gold-bg">
            <Icon name="m-award" size={32} />
          </span>
          <p className="text-[22px] font-bold text-flow-ink">Journey 100% Complete</p>
          <p className="text-sm leading-5 text-flow-muted">
            You worked through every step yourself. Your responses are saved here
            whenever you need them.
          </p>
        </div>
        <MobileBreakdown steps={steps} />
        <div className="flex w-full items-start justify-between rounded-[14px] bg-flow-tint p-3.5 text-xs whitespace-nowrap">
          <span className="text-flow-muted">
            {formatDuration(journey.createdAt, journey.completedAt ?? new Date().toISOString())}
          </span>
          <span className="font-bold text-flow-ink">
            {doneCount}/{steps.length} steps
          </span>
          <span className="text-flow-muted">
            {files.length} {files.length === 1 ? "file" : "files"}
          </span>
        </div>
        <div className="flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={copyDraft}
            className="flex h-11 w-full items-center justify-center rounded-full bg-accent text-sm font-bold text-white"
          >
            Copy Draft Text
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex h-11 w-full items-center justify-center rounded-full border border-flow-line bg-foreground/5 text-sm font-bold text-flow-ink"
          >
            Export Draft (PDF)
          </button>
        </div>
      </>
    );
  } else if (listening) {
    mobileLabel = "User speaking";
    mobileHeading = "I\u2019m Listening";
    mobileBody = (
      <div className="flex flex-col gap-1.5">
        {lastAssistant && (
          <MobileMessage role="assistant">
            <MarkdownMessage content={lastAssistant.content} />
          </MobileMessage>
        )}
        <MobileMessage role="user">
          <span className="text-flow-muted">
            {busy === "transcribing" ? "Transcribing…" : "Listening…"}
          </span>
        </MobileMessage>
        <button
          type="button"
          onClick={toggleRecording}
          disabled={busy === "transcribing"}
          aria-label="Stop recording and send"
          className="flex h-[210px] w-full flex-col items-center justify-center gap-4 rounded-[20px] border border-flow-line bg-background"
        >
          <span className="relative flex size-28 items-center justify-center">
            <Icon
              name="m-pulse"
              size={112}
              className={`absolute ${busy === "recording" ? "animate-pulse" : ""}`}
            />
            <span className="relative flex size-16 items-center justify-center rounded-full bg-flow">
              <Icon name="m-mic" size={24} />
            </span>
          </span>
          <span className="text-[15px] font-medium text-flow">
            {busy === "transcribing" ? "Transcribing…" : "Listening… Speak now"}
          </span>
        </button>
      </div>
    );
  } else if (busy === "replying") {
    mobileLabel = "AI responding";
    mobileHeading = "Zip is thinking";
    mobileBody = (
      <>
        {lastUser && <MobileMessage role="user">{lastUser.content}</MobileMessage>}
        <div role="status" className="flex w-full flex-col gap-2 rounded-[14px] border border-flow-line bg-background p-4">
          <p className="text-[11px] font-bold uppercase text-flow">Zip AI</p>
          <span className="flex gap-1 py-1.5">
            <span className="sr-only">Zip is thinking…</span>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                aria-hidden="true"
                className="size-2 animate-bounce rounded-full bg-flow"
                style={{ animationDelay: `${i * 120}ms` }}
              />
            ))}
          </span>
        </div>
      </>
    );
  } else if (celebrate && latestCompleted) {
    mobileLabel = finalStep ? "Final review" : "Step progressing";
    mobileHeading = finalStep ? "Almost Finished" : "Great Progress";
    mobileBody = (
      <>
        <span
          role="status"
          className="-mt-3 self-start rounded-full bg-done-bg px-4 py-2.5 text-[13px] font-bold text-done"
        >
          ✓ {celebrate}
        </span>
        {lastAssistant && (
          <MobileMessage role="assistant">
            <MarkdownMessage content={lastAssistant.content} />
          </MobileMessage>
        )}
        <MobileBreakdown steps={steps} />
        {activeStep?.tip && (
          <MobileTip title={finalStep ? "Final check" : "Tip Card"}>{activeStep.tip}</MobileTip>
        )}
      </>
    );
  } else if (userReplies === 0) {
    mobileLabel = firstFile ? "File uploaded" : "Guidance ready";
    mobileHeading = activeStep ? `Let\u2019s ${activeStep.title.charAt(0).toLowerCase()}${activeStep.title.slice(1)}` : "Guidance ready";
    mobileBody = (
      <>
        {firstFile && (
          <div className="flex w-full items-center justify-between gap-3 rounded-[14px] border border-flow-line bg-background p-4">
            <div className="flex min-w-0 items-center gap-3">
              <Icon name="file" size={20} />
              <div className="flex min-w-0 flex-col">
                <p className="truncate text-sm font-bold text-flow-ink">{firstFile.fileName}</p>
                <p className="text-xs text-flow-muted">{formatSize(firstFile.sizeBytes)}</p>
              </div>
            </div>
            <span className="shrink-0 text-xs font-bold text-done">Uploaded ✓</span>
          </div>
        )}
        {lastAssistant && (
          <MobileMessage role="assistant">
            <MarkdownMessage content={lastAssistant.content} />
          </MobileMessage>
        )}
        <MobileBreakdown steps={steps} />
        {activeStep?.tip && <MobileTip title="Tip Card">{activeStep.tip}</MobileTip>}
      </>
    );
  } else {
    mobileLabel = `Step ${activeIndex + 1} of ${steps.length}`;
    mobileHeading = "Keep going";
    mobileBody = (
      <>
        {lastUser && <MobileMessage role="user">{lastUser.content}</MobileMessage>}
        {lastAssistant && (
          <MobileMessage role="assistant">
            <MarkdownMessage content={lastAssistant.content} />
          </MobileMessage>
        )}
        {activeStep && (
          <div className="flex w-full flex-col gap-1.5 rounded-[14px] bg-flow-tint p-3.5">
            <p className="text-sm font-bold text-flow">{activeStep.title}</p>
            {activeStep.tip && <p className="text-xs leading-[17px] text-flow-muted">{activeStep.tip}</p>}
          </div>
        )}
      </>
    );
  }

  const mobileView = (
    <div className="flex h-dvh flex-col bg-background text-flow-ink md:hidden print:hidden">
      <header className="flex shrink-0 flex-col gap-3.5 border-b border-flow-line p-2.5 pt-4">
        <div className="flex items-center gap-3 px-[17px]">
          <button
            type="button"
            onClick={() => router.push(journeysHref)}
            aria-label="Back to Journeys"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground/5"
          >
            <Icon name="arrow-left" size={18} />
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 font-bold">
            <p className="text-[10px] uppercase text-flow-muted">Active journey</p>
            <p className="truncate text-base text-flow-ink">{journey.title}</p>
          </div>
          <p className="shrink-0 text-xs font-bold text-flow-muted">{stepBadge}</p>
        </div>
        <div
          className="flex items-center gap-2.5"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Journey progress"
        >
          <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-flow-line">
            <span
              className="block h-full rounded-full bg-flow transition-[width] duration-500"
              style={{ width: `${Math.max(progress, 4)}%` }}
            />
          </span>
          <span className="text-xs font-bold text-flow">{progress}%</span>
        </div>
      </header>

      <div ref={mobileScrollRef} className="min-h-0 flex-1 overflow-y-auto px-[29px] pt-6 pb-4">
        <div className="flex flex-col gap-[3px]">
          <p className="text-[10px] font-bold uppercase text-flow">{mobileLabel}</p>
          <h2 className="text-2xl font-medium text-flow-ink">{mobileHeading}</h2>
        </div>
        <div className="mt-5 flex flex-col gap-[18px]">
          {mobileBody}
          {error && (
            <p role="alert" className="w-full rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      </div>

      {flow.ready && !complete && (
        <div className="shrink-0 px-[29px] pt-2 pb-3">
          {keyboardOpen ? (
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-3 rounded-[14px] border border-flow-line bg-background p-3"
            >
              <button
                type="button"
                onClick={() => setKeyboardOpen(false)}
                aria-label="Speak instead"
                aria-pressed="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-flow-tint"
              >
                <Icon name="keyboard-pink" size={18} />
              </button>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={composerDisabled}
                maxLength={4000}
                autoFocus
                aria-label={hasPlan ? "Type your answer" : "Describe your task"}
                placeholder={hasPlan ? "Type your answer…" : "Describe what you need to do…"}
                className="min-w-0 flex-1 bg-transparent text-[15px] text-flow-ink placeholder:text-flow-muted focus:outline-none"
              />
              <button
                type="submit"
                disabled={composerDisabled || !draft.trim()}
                aria-label="Send"
                className="flex size-12 shrink-0 items-center justify-center rounded-full bg-flow disabled:opacity-60"
              >
                <Icon name="send" size={14} />
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-3 rounded-[14px] border border-flow-line bg-background p-3">
              <button
                type="button"
                onClick={() => setKeyboardOpen(true)}
                disabled={listening}
                aria-label="Type instead"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-flow-tint disabled:opacity-50"
              >
                <Icon name="keyboard-pink" size={18} />
              </button>
              <button
                type="button"
                onClick={toggleRecording}
                disabled={analyzing || busy === "replying" || busy === "transcribing"}
                aria-pressed={busy === "recording"}
                className="flex min-w-0 flex-1 items-center justify-end gap-3 disabled:opacity-60"
              >
                <span className="text-sm font-medium text-flow">
                  {busy === "recording"
                    ? "Tap to stop"
                    : busy === "transcribing"
                      ? "Transcribing…"
                      : analyzing
                        ? "Processing…"
                        : "Tap to speak"}
                </span>
                <span
                  className={`flex size-12 shrink-0 items-center justify-center rounded-full bg-flow ${
                    busy === "recording" ? "animate-pulse" : ""
                  }`}
                >
                  <Icon name="mic" size={20} />
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      <MobileTabBar
        view="journeys"
        onChangeView={(next: View) => router.push(next === "home" ? "/" : `/?view=${next}`)}
        onRequireAuth={() => router.push("/login")}
      />
    </div>
  );

  return (
    <>
    {mobileView}
    <div className="hidden min-h-dvh flex-col bg-flow-bg text-flow-ink md:flex print:flex print:bg-white">
      {/* Top bar */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-flow-line bg-background px-4 py-5 sm:px-10 print:hidden">
        <div className="flex min-w-0 items-center gap-5">
          <button
            type="button"
            onClick={() => router.push(journeysHref)}
            aria-label="Back to Journeys"
            className="flex size-10 shrink-0 items-center justify-center rounded-[20px] bg-flow-bg"
          >
            <Icon name="arrow-left" size={18} />
          </button>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-[11px] font-bold uppercase text-flow-muted">Active Journey</p>
            <h1 className="truncate text-lg font-bold text-flow-ink">{journey.title}</h1>
          </div>
        </div>
        <div className="relative flex items-center gap-4 sm:gap-8">
          <span className="rounded-[20px] border border-flow-line bg-flow-bg px-3.5 py-1.5 text-[13px] font-bold text-flow-muted">
            {stepBadge}
          </span>
          <div className="flex items-center gap-3" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Journey progress">
            <span className="block h-2 w-[100px] overflow-hidden rounded bg-flow-line sm:w-40">
              <span className="block h-full rounded bg-flow transition-[width] duration-500" style={{ width: `${Math.max(progress, hasPlan ? 3 : 0)}%` }} />
            </span>
            <span className="whitespace-nowrap text-sm font-bold text-flow">{progress}% Completed</span>
          </div>
          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            aria-label="How journeys work"
            aria-expanded={showInfo}
            className="flex size-10 shrink-0 items-center justify-center rounded-[20px] border border-flow-line bg-flow-bg"
          >
            <Icon name="info" size={18} />
          </button>
          {showInfo && (
            <div role="note" className="absolute right-0 top-full z-20 mt-3 w-72 rounded-2xl border border-flow-line bg-background p-4 text-[13px] leading-[18px] text-flow-muted shadow-lg">
              <p className="mb-1 text-sm font-bold text-flow-ink">How journeys work</p>
              Upload your brief (or describe your task) and Zip breaks it into steps.
              Answer Zip&rsquo;s questions by voice or text; each step is ticked off when
              you&rsquo;ve done it. Zip guides you but never does the work for you.
            </div>
          )}
        </div>
      </header>

      {/* Workspace */}
      <main className="flex flex-1 flex-col gap-8 p-4 sm:p-10 lg:flex-row print:hidden">
        <section
          aria-label="Zip AI companion"
          className="flex min-h-[640px] min-w-0 flex-1 flex-col gap-8 rounded-3xl border border-flow-line bg-background p-6 sm:p-10"
        >
          {!flow.ready && (
            <Bubble role="assistant">
              Guided journeys aren&rsquo;t switched on yet. Please check back soon.
            </Bubble>
          )}

          {/* 1–3: before the plan exists */}
          {flow.ready && !hasPlan && !analyzing && (
            <>
              <Bubble role="assistant">
                &ldquo;Welcome! I&rsquo;m here to guide you through {journey.title}. Upload
                your assignment file and I&rsquo;ll help you work through it step by
                step.&rdquo;
              </Bubble>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) void upload(file);
                }}
                className={`flex min-h-[220px] w-full flex-1 flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-flow p-10 transition-colors ${
                  dragging ? "bg-flow-soft" : "bg-flow-bg"
                }`}
              >
                <Icon name="cloud-upload" size={48} />
                <span className="text-base font-semibold text-flow-ink">
                  Drop your file here or click to browse
                </span>
                <span className="rounded-[30px] bg-flow px-6 py-3 text-[15px] font-bold text-white">
                  Upload File
                </span>
                <span className="text-xs text-flow-muted">PDF, image or text file, up to 8 MB</span>
              </button>
              {journey.sourceConversationId && (
                <button
                  type="button"
                  onClick={() => planFromText()}
                  className="-mt-4 self-center text-sm font-semibold text-flow hover:underline"
                >
                  No file? Build my steps from our conversation
                </button>
              )}
            </>
          )}

          {analyzing && (
            <>
              {pendingFile && (
                <div className="flex w-full items-center justify-between gap-4 rounded-2xl border border-flow-line bg-flow-bg p-5">
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-flow-soft">
                      <Icon name="file" size={20} />
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="truncate text-base font-bold text-flow-ink">{pendingFile.name}</p>
                      <p className="text-[13px] text-flow-muted">{formatSize(pendingFile.size)}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-xl bg-ok/10 px-3 py-1.5 text-[13px] font-bold text-ok">Uploaded ✓</span>
                </div>
              )}
              <div role="status" className="flex w-full items-center gap-4 rounded-2xl border border-flow-line bg-flow-bg p-5">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-[28px] bg-flow-ring">
                  <span className="flex size-10 items-center justify-center rounded-[20px] bg-flow">
                    <Icon name="loader" size={18} className="animate-spin" />
                  </span>
                </span>
                <div className="flex min-w-0 flex-col gap-1.5 text-sm">
                  <p className="font-bold uppercase text-flow">
                    {pendingFile ? "Zip AI • Analyzing your file" : "Zip AI • Planning your steps"}
                  </p>
                  <p className="text-flow-muted">
                    {pendingFile ? "Processing elements of the uploaded document" : "Reading what you've told me so far"}
                  </p>
                </div>
              </div>
              <div className="flex w-full flex-col gap-3 rounded-2xl border border-flow-line bg-flow-bg p-6">
                <p className="text-xs font-bold uppercase text-flow">Zip AI</p>
                <p className="text-lg font-medium leading-[26px] text-flow-ink">
                  &ldquo;Reading through your {pendingFile ? "document" : "notes"} and preparing personalized guidance…&rdquo;
                </p>
                <span className="block h-1.5 w-full overflow-hidden rounded-[3px] bg-flow-line">
                  <span className="block h-full w-2/5 animate-pulse rounded-[3px] bg-flow" />
                </span>
              </div>
              <div aria-hidden="true" className="flex h-[60px] w-full items-center justify-center gap-1.5">
                {[16, 32, 48, 20, 56, 38, 12].map((h, i) => (
                  <span
                    key={i}
                    className="w-1 animate-pulse rounded-sm bg-flow"
                    style={{ height: h, animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
              <div className="flex-1" />
            </>
          )}

          {/* 4–7: coaching */}
          {flow.ready && hasPlan && !complete && !analyzing && (
            <>
              <div ref={scrollRef} role="log" aria-label="Coaching conversation" className="flex min-h-0 w-full flex-1 flex-col gap-5 overflow-y-auto">
                {messages.length <= 1 && !listening && busy !== "replying" && (
                  <StatusPill label="Zip AI • Ready to guide" />
                )}
                {shownMessages.map((m) => (
                  <Bubble key={m.id} role={m.role}>
                    {m.role === "assistant" ? <MarkdownMessage content={m.content} /> : m.content}
                  </Bubble>
                ))}
                {liveTranscript !== null && (
                  <Bubble role="user">
                    <span className="text-flow-muted">Transcribing</span>
                    <span className="font-bold text-flow">…</span>
                  </Bubble>
                )}
                {busy === "replying" && (
                  <div role="status" className="flex items-center gap-4 rounded-2xl border border-flow-line bg-flow-bg p-5">
                    <span className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="size-2 animate-bounce rounded-full bg-flow" style={{ animationDelay: `${i * 120}ms` }} />
                      ))}
                    </span>
                    <p className="text-sm font-bold uppercase text-flow">Zip AI is thinking</p>
                  </div>
                )}
                {busy === "recording" && (
                  <button
                    type="button"
                    onClick={toggleRecording}
                    className="flex min-h-[180px] w-full flex-col items-center justify-center gap-4 rounded-2xl bg-flow-bg p-6"
                  >
                    <span className="relative flex size-[140px] items-center justify-center">
                      <Icon name="pulse-outer" size={120} className="absolute animate-ping [animation-duration:2s]" />
                      <Icon name="pulse-inner" size={90} className="absolute" />
                      <span className="relative flex h-16 w-[60px] items-center justify-center rounded-[32px] bg-flow">
                        <Icon name="mic-large" size={24} />
                      </span>
                    </span>
                    <span className="text-base font-bold text-flow">Listening… Speak now</span>
                  </button>
                )}
                {celebrate && (
                  <div role="status" className="flex justify-center py-4">
                    <span className="flex items-center gap-2 rounded-full border border-done bg-done-line px-6 py-3 text-sm font-bold text-done">
                      <Icon name="check-green" size={14} />
                      {celebrate}
                    </span>
                  </div>
                )}
                {!busy && messages.length > 1 && lastAssistant && !celebrate && (
                  <div className="flex justify-center py-2">
                    <span className="flex items-center gap-2 rounded-2xl border border-flow-ring bg-flow-soft px-4 py-2 text-xs font-bold uppercase text-flow">
                      <span className="size-1.5 rounded-full bg-flow" />
                      Zip AI • Ready to listen
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 8: complete */}
          {flow.ready && complete && (
            <>
              {lastAssistant && (
                <Bubble role="assistant">
                  <MarkdownMessage content={lastAssistant.content} />
                </Bubble>
              )}
              <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                <span className="rounded-full border border-gold bg-gold-bg p-5">
                  <Icon name="award" size={40} />
                </span>
                <p className="text-[22px] font-extrabold text-flow-ink">Journey 100% Complete</p>
                <p className="w-full max-w-[380px] text-[15px] text-flow-muted">
                  You worked through every step yourself. Your responses are saved here
                  whenever you need them.
                </p>
              </div>
              <div className="flex w-full flex-col gap-4 border-t border-flow-line pt-5 sm:flex-row">
                <button type="button" onClick={() => window.print()} className="flex-1 rounded-[30px] border border-flow-line bg-flow-bg px-6 py-3 text-[15px] font-bold text-flow-ink">
                  Export Summary (PDF)
                </button>
                <button type="button" onClick={copyDraft} className="flex-1 rounded-[30px] bg-flow px-6 py-3 text-[15px] font-bold text-white">
                  Copy My Responses
                </button>
              </div>
            </>
          )}

          {error && (
            <p role="alert" className="w-full rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          {/* Composer (all states but completion) */}
          {!complete && flow.ready && (
            <div className={`flex w-full flex-col gap-6 border-t border-flow-line pt-5 ${analyzing ? "opacity-50" : ""}`}>
              <div className="flex w-full items-center gap-4">
                <div className="flex flex-1 items-center gap-4">
                  <button
                    type="button"
                    onClick={toggleRecording}
                    disabled={analyzing || busy === "replying" || busy === "transcribing"}
                    aria-pressed={busy === "recording"}
                    aria-label={busy === "recording" ? "Stop recording" : "Speak your response"}
                    className="flex size-16 shrink-0 items-center justify-center rounded-[32px] bg-flow-soft disabled:cursor-not-allowed"
                  >
                    <span className={`flex size-12 items-center justify-center rounded-3xl bg-flow ${busy === "recording" ? "animate-pulse" : ""}`}>
                      <Icon name="mic" size={20} />
                    </span>
                  </button>
                  {busy === "recording" ? (
                    <div className="flex flex-col gap-0.5">
                      <p className="text-[15px] font-bold text-flow">Recording your answer</p>
                      <p className="text-[13px] text-flow-muted">Tap mic to stop and send</p>
                    </div>
                  ) : (
                    <p className="text-[15px] font-semibold text-flow">
                      {analyzing
                        ? "Processing…"
                        : busy === "transcribing"
                          ? "Transcribing…"
                          : "Tap to speak response"}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={busy !== null}
                  aria-label={hasPlan ? "Attach another file" : "Upload a file"}
                  className="flex size-10 shrink-0 items-center justify-center rounded-[20px] border border-flow-ring bg-flow-soft disabled:opacity-50"
                >
                  <Icon name="paperclip" size={18} />
                </button>
              </div>
              <form
                onSubmit={handleSubmit}
                className={`flex w-full items-center gap-3 rounded-[14px] border border-flow-line bg-flow-bg px-5 py-3 focus-within:border-foreground/30 ${
                  listening ? "opacity-50" : ""
                }`}
              >
                <Icon name="keyboard" size={18} />
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={composerDisabled || listening}
                  maxLength={4000}
                  aria-label={hasPlan ? "Type your answer" : "Describe your task"}
                  placeholder={
                    listening
                      ? "Keyboard disabled while speaking..."
                      : analyzing
                        ? "Analyst working..."
                        : hasPlan
                          ? "Type your answer instead..."
                          : "Or describe what you need to do..."
                  }
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-flow-ink placeholder:text-flow-muted focus:outline-none"
                />
                {!listening && (
                  <button
                    type="submit"
                    disabled={composerDisabled || !draft.trim()}
                    aria-label="Send"
                    className="flex size-8 shrink-0 items-center justify-center rounded-2xl bg-flow disabled:opacity-60"
                  >
                    <Icon name="send" size={14} />
                  </button>
                )}
              </form>
            </div>
          )}

        </section>

        {/* Checklist */}
        <aside
          aria-label="Actionable breakdown"
          className="flex w-full shrink-0 flex-col gap-7 rounded-3xl border border-flow-line bg-background p-6 sm:p-10 lg:w-[480px]"
        >
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase text-flow-muted">Interactive Flow</p>
              {celebrate && latestCompleted && !complete && (
                <span className="rounded border border-done bg-done-bg px-2 py-1 text-[10px] font-bold text-done">
                  ✓ Step {latestCompleted.position + 1} Complete!
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-flow-ink">Actionable Breakdown</h2>
          </div>

          <div className="flex flex-col gap-3.5">
            {hasPlan
              ? steps.map((s) => <StepRow key={s.id} step={s} />)
              : PLACEHOLDER_STEPS.map((title) => (
                  <StepRow key={title} step={{ title, status: "pending" }} placeholder />
                ))}
          </div>

          {!hasPlan && !analyzing && (
            <HelperCard title="How it works">
              Upload your brief, and Zip AI will analyze it into distinct interactive
              checkpoints to keep you focused.
            </HelperCard>
          )}
          {analyzing && (
            <HelperCard title="Formulating Milestones">
              Wait just a moment while our companion outlines your path to complete the
              task.
            </HelperCard>
          )}
          {hasPlan && !complete && activeStep?.tip && (
            <HelperCard title="Tip Card" sparkle>
              {activeStep.tip}
            </HelperCard>
          )}
          {complete && (
            <div className="flex w-full flex-col gap-4 rounded-2xl border border-flow-ring bg-flow-soft p-5">
              <p className="text-base font-extrabold text-flow-ink">🎉 Journey Complete!</p>
              <dl className="flex flex-col gap-2 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-flow-muted">Time spent:</dt>
                  <dd className="font-bold text-flow-ink">
                    {formatDuration(journey.createdAt, journey.completedAt ?? new Date().toISOString())}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-flow-muted">Steps completed:</dt>
                  <dd className="font-bold text-flow-ink">{doneCount}/{steps.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-flow-muted">Files analyzed:</dt>
                  <dd className="font-bold text-flow-ink">{files.length}</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => router.push(journeysHref)}
                className="w-full rounded-[30px] bg-flow py-3 text-sm font-bold text-white"
              >
                Start New Journey
              </button>
            </div>
          )}
          {hasPlan && files.length > 0 && !complete && (
            <p className="text-xs text-flow-muted">
              Working from {files.map((f) => f.fileName).join(", ")}
            </p>
          )}
        </aside>
      </main>

      {/* Printable summary for "Export Summary (PDF)" */}
      <article className="hidden p-10 text-black print:block">
        <h1 className="text-2xl font-bold">{journey.title}</h1>
        <p className="mb-6 text-sm text-gray-600">Journey summary from Z1P.pro</p>
        <h2 className="mb-2 text-lg font-bold">Steps</h2>
        <ol className="mb-6 list-decimal pl-6">
          {steps.map((s) => (
            <li key={s.id}>
              {s.title} {s.status === "done" ? "✓" : ""}
            </li>
          ))}
        </ol>
        <h2 className="mb-2 text-lg font-bold">Conversation</h2>
        {messages.map((m) => (
          <p key={m.id} className="mb-3 whitespace-pre-wrap">
            <strong>{m.role === "assistant" ? "Zip" : "You"}:</strong> {m.content}
          </p>
        ))}
      </article>
    </div>
    <input
      ref={fileInput}
      type="file"
      accept={ACCEPT}
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) void upload(file);
      }}
    />
    </>
  );
}
