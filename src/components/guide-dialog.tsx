"use client";

import { CloseIcon } from "@/components/icons";
import { useDialog } from "@/lib/use-dialog";

const TIPS: { title: string; body: string }[] = [
  {
    title: "Talk to Zip",
    body: "Tap the orb on Home to open voice mode, then just say “Zip” and ask. After Zip answers you have a few seconds to follow up without saying its name. Works best in Chrome or Edge; other browsers get a tap-to-speak button.",
  },
  {
    title: "Chat and attach files",
    body: "Type in the box on Home or in any conversation. Use + to attach up to 3 PDFs, images or text files and Zip reads them with your message.",
  },
  {
    title: "Turn a chat into a Journey",
    body: "When a conversation turns into a goal or an assignment, use Convert to Journey. Zip breaks it into steps and coaches you through each one, without doing the work for you.",
  },
  {
    title: "Life Metrics",
    body: "Open your profile to turn on Life Metrics. After a few conversations Zip scores seven areas of your life and updates them weekly. Only you can see them, and you can delete them at any time.",
  },
  {
    title: "Stay on track",
    body: "Settings lets you choose reminders and weekly reports, add two-step verification, download your data or delete your account.",
  },
];

/** "AI Assisted Guide": a short how-to for getting the most out of Z1P. */
export function GuideDialog({
  open,
  onClose,
  onSendFeedback,
}: {
  open: boolean;
  onClose: () => void;
  onSendFeedback?: () => void;
}) {
  const panelRef = useDialog(open, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close guide"
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        tabIndex={-1}
        className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-2xl border border-card-border bg-background p-6 shadow-xl outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="guide-title" className="font-display text-xl font-semibold text-foreground">
              Getting the most out of Z1P
            </h2>
            <p className="text-sm text-muted">A quick tour of what Zip can do.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:text-foreground"
          >
            <CloseIcon className="h-4.5 w-4.5" />
          </button>
        </div>

        <ol className="flex flex-col gap-4">
          {TIPS.map((tip, i) => (
            <li key={tip.title} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">
                {i + 1}
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-foreground">{tip.title}</p>
                <p className="text-sm leading-[1.5] text-muted">{tip.body}</p>
              </div>
            </li>
          ))}
        </ol>

        {onSendFeedback && (
          <p className="rounded-xl bg-surface p-4 text-sm text-foreground">
            Z1P is in beta. Found something broken or confusing?{" "}
            <button
              type="button"
              onClick={onSendFeedback}
              className="font-semibold text-accent underline"
            >
              Send feedback
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
