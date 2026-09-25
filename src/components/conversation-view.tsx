"use client";

import { useEffect, useRef, useState } from "react";
import { AssetIcon } from "@/components/asset-icon";
import { MarkdownMessage } from "@/components/markdown-message";
import { useDialog } from "@/lib/use-dialog";
import { useMediaQuery } from "@/lib/use-media-query";
import { formatRelativeTime } from "@/lib/relative-time";
import type { Journey } from "@/types/journey";

type Message = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt: string;
};

type ConversationMeta = {
  id: string;
  title: string | null;
  pinned: boolean;
  createdAt: string;
  journey: { id: string; title: string } | null;
};

function MessageRow({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex w-full justify-end">
        <div className="max-w-[292px] whitespace-pre-wrap rounded-2xl bg-accent px-3.5 py-[11px] text-[13px] leading-[18px] font-medium text-white md:max-w-[700px] md:px-[18px] md:py-3.5 md:text-[15px] md:leading-[22px] md:font-normal">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex w-full flex-col items-start gap-2 md:flex-row md:gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ui/conversation-tile.svg" alt="" width={40} height={40} className="shrink-0 md:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ui/ai-avatar.svg" alt="" width={32} height={32} className="hidden shrink-0 md:block" />
      <div className="min-w-0 max-w-[306px] rounded-2xl bg-surface px-3.5 py-[11px] text-[13px] leading-[18px] font-medium text-foreground md:max-w-[700px] md:px-[18px] md:py-3.5 md:text-[15px] md:leading-[22px] md:font-normal">
        <MarkdownMessage content={message.content} />
      </div>
    </div>
  );
}

/** Status box inside the phone "Analyzing Convo" / "Journey created!" card. */
function BuildStatus({ done }: { done: boolean }) {
  return (
    <div
      className={`flex w-full flex-col gap-3 rounded-xl p-3 ${done ? "bg-success-bg" : "bg-accent/[0.06]"}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-background">
            <span
              className={`size-2 rounded-full ${done ? "bg-ok" : "status-pulse bg-accent"}`}
            />
          </span>
          <span className="text-xs font-semibold text-foreground">
            {done ? "JOURNEY READY" : "BUILDING YOUR JOURNEY"}
          </span>
        </div>
        <span aria-hidden="true" className="flex items-center gap-1">
          <span className={`size-[5px] rounded-full ${done ? "bg-ok" : "status-dot-1 bg-accent"}`} />
          <span className={`size-[5px] rounded-full ${done ? "bg-ok" : "status-dot-2 bg-accent"}`} />
          <span className={`size-[5px] rounded-full ${done ? "bg-ok" : "bg-accent opacity-35"}`} />
        </span>
      </div>
      <div className="h-[5px] w-full overflow-hidden rounded-full bg-track">
        <div
          className={`h-full rounded-full transition-[width] duration-[1500ms] ease-out ${
            done ? "w-full bg-ok" : "w-[70%] bg-accent"
          }`}
        />
      </div>
    </div>
  );
}

function ConvertJourneyDialog({
  conversationId,
  onClose,
  onCreate,
  onOpenJourney,
}: {
  conversationId: string;
  onClose: () => void;
  onCreate: (title: string) => Promise<Journey | null>;
  onOpenJourney: (journeyId: string) => void;
}) {
  const panelRef = useDialog<HTMLDivElement>(true, onClose);
  const phone = useMediaQuery("(max-width: 767px)");
  const [title, setTitle] = useState("");
  const [loadingTitle, setLoadingTitle] = useState(true);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Journey | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/conversations/${conversationId}/journey-title`, { method: "POST" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { title?: string } | null) => {
        if (!ignore && data?.title) setTitle((current) => current || data.title!);
      })
      .finally(() => {
        if (!ignore) setLoadingTitle(false);
      });
    return () => {
      ignore = true;
    };
  }, [conversationId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    setError(null);
    const journey = await onCreate(trimmed);
    if (!journey) {
      setError("Couldn't create the journey. Please try again.");
      setCreating(false);
      return;
    }
    // Desktop shows the banner in the conversation; phones show the
    // "Journey created!" card with an Open Journey button (mobile design).
    if (phone) setCreated(journey);
    else onClose();
  }

  const building = phone && creating && !created;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="convert-journey-title"
        tabIndex={-1}
        className="w-full max-w-[350px] rounded-[20px] bg-background p-[22px] shadow-[0_12px_28px_rgba(0,0,0,0.15)] outline-none md:max-w-[520px] md:p-8 md:shadow-[0_12px_12px_rgba(0,0,0,0.16)]"
      >
        {building || created ? (
          <div className="flex flex-col gap-5" aria-live="polite">
            <div className="flex flex-col gap-2">
              <h2 id="convert-journey-title" className="text-[22px] font-bold text-foreground">
                {created ? "Journey created!" : "Analyzing Convo"}
              </h2>
              <p className="text-[13px] leading-[19px] text-label">
                {created
                  ? "Your conversation is now a guided Journey. Open it to continue with the next step."
                  : "We\u2019re finding the key goals and next steps in this conversation so it can become a guided journey."}
              </p>
            </div>
            <BuildStatus done={!!created} />
            {created && (
              <button
                type="button"
                onClick={() => onOpenJourney(created.id)}
                className="flex h-10 w-full items-center justify-center rounded-[10px] bg-accent text-base font-bold text-white"
              >
                Open Journey
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleCreate} className="flex flex-col gap-5 md:gap-6">
            <div className="flex flex-col gap-2 md:gap-3">
              <h2 id="convert-journey-title" className="text-[22px] font-bold text-foreground">
                Convert to Journey?
              </h2>
              <p className="text-[13px] leading-[19px] text-label md:text-[15px] md:leading-[22px]">
                Turn this conversation into a guided journey. Zip will break down
                your goal into actionable steps and guide you through each one with
                voice assistance.
              </p>
            </div>

            <label className="flex flex-col gap-[7px] md:gap-2">
              <span className="text-xs font-semibold text-label md:text-[13px]">
                SUGGESTED JOURNEY TITLE
              </span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder={loadingTitle ? "Suggesting a title\u2026" : "Name your journey"}
                className="w-full rounded-lg border border-accent bg-background px-[13px] py-3 text-[13px] text-foreground placeholder:text-tertiary focus:outline-none md:border-[1.5px] md:px-4 md:text-[15px]"
              />
            </label>

            {error && (
              <p role="alert" className="-mt-3 text-sm text-red-500">
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2.5 md:flex-row md:items-start md:justify-end md:gap-3">
              <button
                type="button"
                onClick={onClose}
                className="h-10 rounded-[10px] border border-field-border text-base font-bold text-subtle hover:bg-foreground/5 md:h-auto md:rounded-lg md:border-[1.5px] md:border-divider md:px-6 md:py-3 md:text-sm md:font-semibold md:text-label"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim() || creating}
                className="h-10 rounded-[10px] bg-accent text-base font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60 md:h-auto md:rounded-lg md:px-6 md:py-3 md:text-sm md:font-semibold"
              >
                {creating ? "Creating\u2026" : "Create Journey"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function ConversationView({
  conversationId,
  initialMessage,
  onInitialMessageSent,
  onBack,
  onStartVoice,
  onDeleted,
  onCreateJourney,
  onViewJourney,
}: {
  conversationId: string;
  /** A first message typed on Home, sent once this view opens. */
  initialMessage?: string | null;
  onInitialMessageSent?: () => void;
  onBack: () => void;
  onStartVoice: () => void;
  onDeleted: () => void;
  onCreateJourney: (payload: {
    title: string;
    sourceConversationId: string;
  }) => Promise<Journey | null>;
  /** Opens the journey page for this conversation's journey. */
  onViewJourney: (journeyId: string) => void;
}) {
  const [meta, setMeta] = useState<ConversationMeta | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [converting, setConverting] = useState(false);
  const [createdJourneyTitle, setCreatedJourneyTitle] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const phone = useMediaQuery("(max-width: 767px)");
  const sentInitial = useRef(false);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      fetch(`/api/conversations/${conversationId}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/conversations/${conversationId}/messages`).then((r) =>
        r.ok ? r.json() : null
      ),
    ]).then(([metaData, messageData]) => {
      if (ignore) return;
      setMeta(metaData);
      setMessages(messageData?.messages ?? []);
      setLoaded(true);
    });
    return () => {
      ignore = true;
    };
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  async function send(content: string) {
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    setError(null);
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      if (!res.ok) {
        setDraft(trimmed);
        if (res.status === 429) {
          const data = await res.json().catch(() => null);
          setError(
            data?.dailyLimit
              ? `You've hit today's ${data.dailyLimit}-message limit on the ${data.planCode} plan. Upgrade for more.`
              : "You've hit today's message limit. Try again later."
          );
        } else {
          setError("Something went wrong sending that message. Try again.");
        }
        return;
      }
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        ...[data.userMessage, data.assistantMessage].filter(Boolean),
      ]);
    } finally {
      setSending(false);
    }
  }

  // A message typed on Home is sent once the conversation has loaded.
  useEffect(() => {
    if (!loaded || !initialMessage || sentInitial.current) return;
    sentInitial.current = true;
    onInitialMessageSent?.();
    void send(initialMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per initial message
  }, [loaded, initialMessage]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const content = draft;
    setDraft("");
    void send(content);
  }

  async function togglePinned() {
    if (!meta) return;
    setMenuOpen(false);
    const res = await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !meta.pinned }),
    });
    if (res.ok) setMeta({ ...meta, pinned: !meta.pinned });
  }

  async function handleDelete() {
    const res = await fetch(`/api/conversations/${conversationId}`, { method: "DELETE" });
    if (res.ok) onDeleted();
    else setError("Couldn't delete this conversation. Please try again.");
    setConfirmDelete(false);
  }

  async function handleCreateJourney(title: string) {
    const journey = await onCreateJourney({ title, sourceConversationId: conversationId });
    if (!journey) return null;
    setCreatedJourneyTitle(journey.title);
    setMeta((m) => (m ? { ...m, journey: { id: journey.id, title: journey.title } } : m));
    return journey;
  }

  const title = meta?.title || "New chat";
  const linked = Boolean(meta?.journey);

  return (
    <div className="flex h-full flex-col">
      <header className="relative flex h-16 shrink-0 items-center justify-between gap-4 bg-background px-6 md:h-[94px] md:border-b md:border-divider md:px-10">
        <div className="flex min-w-0 items-center gap-5 md:gap-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to conversations"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-foreground hover:bg-foreground/10 md:size-8 md:bg-transparent md:hover:bg-foreground/5"
          >
            <span className="md:hidden">
              <AssetIcon name="journey/arrow-left" width={18} height={18} />
            </span>
            <span className="hidden md:inline-flex">
              <AssetIcon name="back" width={20} height={20} />
            </span>
          </button>
          <div className="flex min-w-0 flex-col md:gap-0.5">
            <h1 className="-mb-[3px] truncate text-[26px] font-medium text-foreground md:mb-0 md:text-lg md:font-bold">
              {title}
            </h1>
            {meta && (
              <p className="text-xs text-tertiary md:text-[13px]">
                Started {formatRelativeTime(meta.createdAt)}
              </p>
            )}
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Conversation options"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex size-8 items-center justify-center rounded-full text-label hover:bg-foreground/5"
          >
            <AssetIcon name="ellipsis" width={20} height={20} />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Close options"
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 flex w-44 flex-col rounded-xl border border-divider bg-background p-1.5 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={togglePinned}
                  className="rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-foreground/5"
                >
                  {meta?.pinned ? "Unpin conversation" : "Pin conversation"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmDelete(true);
                  }}
                  className="rounded-lg px-3 py-2 text-left text-sm text-red-500 hover:bg-red-500/5"
                >
                  Delete conversation
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col p-3 md:gap-5 md:p-10">
          {createdJourneyTitle && (
            <div
              role="status"
              className="flex w-full flex-col items-start gap-2 rounded-xl border border-success bg-success-bg p-3.5 md:flex-row md:flex-wrap md:items-center md:gap-3 md:px-6 md:py-4"
            >
              <span className="hidden size-6 shrink-0 items-center justify-center rounded-xl bg-success md:flex">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/ui/check-small.svg" alt="" width={12} height={12} />
              </span>
              <p className="min-w-0 flex-1 text-xs leading-[17px] font-medium text-success-fg md:text-[15px] md:leading-normal">
                Journey created! Your conversation has been converted to a journey:{" "}
                <span className="md:font-bold">{createdJourneyTitle}</span>
              </p>
              <button
                type="button"
                onClick={() => meta?.journey && onViewJourney(meta.journey.id)}
                className="shrink-0 text-xs font-medium text-accent underline underline-offset-[3px] md:text-[15px] md:font-bold md:underline-offset-auto"
              >
                View Journey<span className="hidden md:inline"> →</span>
              </button>
            </div>
          )}

          <div
            role="log"
            aria-label="Conversation"
            className="flex w-full flex-col gap-3.5 px-3.5 pt-4 pb-[18px] md:gap-6 md:p-0"
          >
            {!loaded && <p className="text-center text-sm text-tertiary">Loading chat…</p>}
            {loaded && !meta && (
              <p role="alert" className="text-center text-sm text-tertiary">
                This conversation couldn&rsquo;t be found.
              </p>
            )}
            {messages.map((m) => (
              <MessageRow key={m.id} message={m} />
            ))}
            {sending && (
              <div role="status" className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/ui/ai-avatar.svg" alt="" width={32} height={32} />
                <span className="flex items-center gap-1 rounded-2xl bg-surface px-[18px] py-4">
                  <span className="sr-only">Z1P is typing…</span>
                  {[0.2, 0.1, 0].map((d) => (
                    <span
                      key={d}
                      aria-hidden="true"
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-tertiary"
                      style={{ animationDelay: `-${d}s` }}
                    />
                  ))}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="px-4 pb-2 text-center text-xs text-red-500 md:px-10">
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex shrink-0 items-center gap-2 bg-background px-3.5 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] md:gap-4 md:border-t md:border-divider md:px-10 md:py-5"
      >
        <button
          type="button"
          onClick={onStartVoice}
          aria-label="Reply by voice"
          className="hidden size-11 shrink-0 items-center justify-center rounded-[22px] bg-surface text-label hover:bg-foreground/5 md:flex"
        >
          <AssetIcon name="mic" width={18} height={18} />
        </button>
        <div className="flex h-[54px] min-w-0 flex-1 items-center justify-between gap-2 rounded-[10px] border border-field-border bg-background px-[19px] focus-within:ring-2 focus-within:ring-accent-strong md:h-11 md:rounded-xl md:border-divider md:bg-surface md:px-4">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Message Z1P"
            placeholder={phone ? "Continue this Conversation" : "Continue this conversation..."}
            className="w-full min-w-0 bg-transparent text-base text-foreground placeholder:text-subtle focus:outline-none md:text-sm md:placeholder:text-tertiary"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            aria-label="Send"
            className="hidden shrink-0 disabled:opacity-40 md:block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ui/send-arrow.svg" alt="" width={18} height={18} />
          </button>
        </div>

        {/* Phones: one round button that sends when there's text, and
            otherwise starts voice (the design shows the mic). */}
        {draft.trim() ? (
          <button
            type="submit"
            disabled={sending}
            aria-label="Send"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-flow disabled:opacity-60 md:hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ui/journey/send.svg" alt="" width={14} height={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onStartVoice}
            aria-label="Reply by voice"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-flow md:hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ui/journey/mic.svg" alt="" width={20} height={20} />
          </button>
        )}
        <button
          type="button"
          onClick={
            linked
              ? () => meta?.journey && onViewJourney(meta.journey.id)
              : () => setConverting(true)
          }
          disabled={!linked && messages.length === 0}
          aria-label={linked ? "Open linked journey" : "Convert to Journey"}
          className={`flex size-12 shrink-0 items-center justify-center rounded-[10px] border disabled:opacity-50 md:hidden ${
            linked ? "border-accent bg-accent/[0.08] text-accent" : "border-field-border text-foreground"
          }`}
        >
          <AssetIcon name="nav/stacks" width={22.213} height={18.257} />
        </button>

        {linked ? (
          <button
            type="button"
            onClick={() => meta?.journey && onViewJourney(meta.journey.id)}
            className="hidden shrink-0 rounded-xl bg-accent/[0.08] px-6 py-3 text-[15px] font-bold text-accent md:block"
          >
            → Linked to Journey
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConverting(true)}
            disabled={messages.length === 0}
            className="hidden shrink-0 rounded-xl border-[1.5px] border-accent px-6 py-3 text-[15px] font-semibold text-accent transition-colors hover:bg-accent/5 disabled:opacity-50 md:block"
          >
            Convert to Journey
          </button>
        )}
      </form>

      {converting && (
        <ConvertJourneyDialog
          conversationId={conversationId}
          onClose={() => setConverting(false)}
          onCreate={handleCreateJourney}
          onOpenJourney={onViewJourney}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteDialog
          title={title}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

function ConfirmDeleteDialog({
  title,
  onCancel,
  onConfirm,
}: {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const panelRef = useDialog(true, onCancel);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4">
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-conversation-title"
        tabIndex={-1}
        className="flex w-full max-w-[420px] flex-col gap-5 rounded-[20px] bg-background p-8 shadow-[0_12px_12px_rgba(0,0,0,0.16)] outline-none"
      >
        <div className="flex flex-col gap-2">
          <h2 id="delete-conversation-title" className="text-xl font-bold text-foreground">
            Delete this conversation?
          </h2>
          <p className="text-[15px] leading-[22px] text-label">
            &ldquo;{title}&rdquo; and all its messages will be permanently
            deleted. This can&rsquo;t be undone.
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border-[1.5px] border-divider px-6 py-3 text-sm font-semibold text-label hover:bg-foreground/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-500 px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
