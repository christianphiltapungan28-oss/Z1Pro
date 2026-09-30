"use client";

import { useState } from "react";
import { CloseIcon } from "@/components/icons";
import { useDialog } from "@/lib/use-dialog";

const KINDS = [
  { key: "bug", label: "Something's broken" },
  { key: "idea", label: "An idea" },
  { key: "other", label: "Something else" },
] as const;

type Kind = (typeof KINDS)[number]["key"];

/** Beta feedback, saved as a support ticket (POST /api/feedback). */
export function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useDialog(open, onClose);
  const [kind, setKind] = useState<Kind>("bug");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  function close() {
    onClose();
    // Start fresh next time, once the thank-you has been seen.
    if (reference) {
      setReference(null);
      setMessage("");
      setKind("bug");
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          message,
          page: `${window.location.pathname}${window.location.search}`,
        }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.reference) setReference(body.reference);
      else setError(body?.error ?? "Couldn't send that. Please try again.");
    } catch {
      setError("Couldn't send that. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close feedback"
        onClick={close}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        tabIndex={-1}
        className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-2xl border border-card-border bg-background p-6 shadow-xl outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="feedback-title" className="font-display text-xl font-semibold text-foreground">
              Send feedback
            </h2>
            <p className="text-sm text-muted">
              You&rsquo;re testing an early version of Z1P. Tell us what broke,
              what confused you, or what you&rsquo;d love to see.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:text-foreground"
          >
            <CloseIcon className="h-4.5 w-4.5" />
          </button>
        </div>

        {reference ? (
          <div role="status" className="flex flex-col gap-4">
            <p className="rounded-xl bg-success-bg p-4 text-sm text-success-fg">
              Thank you! We&rsquo;ve got it. Your reference is{" "}
              <span className="font-bold">{reference}</span>.
            </p>
            <button
              type="button"
              onClick={close}
              className="flex h-11 w-full items-center justify-center rounded-full bg-accent text-sm font-bold text-white"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={send} className="flex flex-col gap-4">
            <fieldset className="flex flex-wrap gap-2">
              <legend className="sr-only">What kind of feedback?</legend>
              {KINDS.map((k) => (
                <label
                  key={k.key}
                  className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm ${
                    kind === k.key
                      ? "border-accent bg-accent/10 font-semibold text-accent"
                      : "border-card-border text-foreground hover:bg-foreground/5"
                  }`}
                >
                  <input
                    type="radio"
                    name="feedback-kind"
                    value={k.key}
                    checked={kind === k.key}
                    onChange={() => setKind(k.key)}
                    className="sr-only"
                  />
                  {k.label}
                </label>
              ))}
            </fieldset>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
              {kind === "bug" ? "What happened, and what did you expect?" : "Tell us more"}
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={4000}
                required
                placeholder={
                  kind === "bug"
                    ? "e.g. I tapped the orb on my phone and nothing happened."
                    : "Anything goes."
                }
                className="w-full resize-y rounded-xl border border-card-border bg-background px-3.5 py-3 text-base font-normal text-foreground placeholder:text-muted focus:border-foreground/30 focus:outline-none md:text-sm"
              />
            </label>
            <p className="text-xs text-muted">
              We&rsquo;ll include which screen you&rsquo;re on and your browser, to
              help us find the problem.
            </p>
            {error && (
              <p role="alert" className="text-sm text-red-500">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="flex h-11 w-full items-center justify-center rounded-full bg-accent text-sm font-bold text-white transition-opacity disabled:opacity-40"
            >
              {sending ? "Sending…" : "Send feedback"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
