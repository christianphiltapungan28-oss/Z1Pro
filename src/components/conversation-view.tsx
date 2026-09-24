"use client";

import { useEffect, useRef, useState } from "react";
import { AssetIcon } from "@/components/asset-icon";
import { MarkdownMessage } from "@/components/markdown-message";
import { useDialog } from "@/lib/use-dialog";
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
        <div className="max-w-[700px] whitespace-pre-wrap rounded-2xl bg-accent px-[18px] py-3.5 text-[15px] leading-[22px] text-white">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex w-full items-start gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ui/ai-avatar.svg" alt="" width={32} height={32} className="shrink-0" />
      <div className="min-w-0 max-w-[700px] rounded-2xl bg-surface px-[18px] py-3.5 text-[15px] leading-[22px] text-foreground">
        <MarkdownMessage content={message.content} />
      </div>
    </div>
  );
}

function ConvertJourneyDialog({
  conversationId,
  onClose,
  onCreate,
}: {
  conversationId: string;
  onClose: () => void;
  onCreate: (title: string) => Promise<boolean>;
}) {
  const panelRef = useDialog<HTMLFormElement>(true, onClose);
  const [title, setTitle] = useState("");
  const [loadingTitle, setLoadingTitle] = useState(true);
  const [creating, setCreating] = useState(false);
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
    const ok = await onCreate(trimmed);
    if (!ok) {
      setError("Couldn't create the journey. Please try again.");
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4">
      <form
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="convert-journey-title"
        tabIndex={-1}
        onSubmit={handleCreate}
        className="flex w-full max-w-[520px] flex-col gap-6 rounded-[20px] bg-background p-8 shadow-[0_12px_12px_rgba(0,0,0,0.16)] outline-none"
      >
        <div className="flex flex-col gap-3">
          <h2 id="convert-journey-title" className="text-[22px] font-bold text-foreground">
            Convert to Journey?
          </h2>
          <p className="text-[15px] leading-[22px] text-label">
            Turn this conversation into a guided journey. Zip will break down
            your goal into actionable steps and guide you through each one with
            voice assistance.
          </p>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-label">
            SUGGESTED JOURNEY TITLE
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder={loadingTitle ? "Suggesting a title…" : "Name your journey"}
            className="w-full rounded-lg border-[1.5px] border-accent bg-background px-4 py-3 text-[15px] text-foreground placeholder:text-tertiary focus:outline-none"
          />
        </label>

        {error && (
          <p role="alert" className="-mt-3 text-sm text-red-500">
            {error}
          </p>
        )}

        <div className="flex items-start justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border-[1.5px] border-divider px-6 py-3 text-sm font-semibold text-label hover:bg-foreground/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || creating}
            className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {creating ? "Creating…" : "Create Journey"}
          </button>
        </div>
      </form>
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
  onViewJourneys,
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
  onViewJourneys: () => void;
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
    if (!journey) return false;
    setConverting(false);
    setCreatedJourneyTitle(journey.title);
    setMeta((m) => (m ? { ...m, journey: { id: journey.id, title: journey.title } } : m));
    return true;
  }

  const title = meta?.title || "New chat";
  const linked = Boolean(meta?.journey);

  return (
    <div className="flex h-full flex-col">
      <header className="relative flex h-[94px] shrink-0 items-center justify-between gap-4 border-b border-divider bg-background px-4 sm:px-10">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to conversations"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-foreground/5"
          >
            <AssetIcon name="back" width={20} height={20} />
          </button>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="truncate text-lg font-bold text-foreground">{title}</h1>
            {meta && (
              <p className="text-[13px] text-tertiary">
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
        <div className="flex flex-col gap-5 p-4 sm:p-10">
          {createdJourneyTitle && (
            <div
              role="status"
              className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-success bg-success-bg px-6 py-4"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-xl bg-success">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/ui/check-small.svg" alt="" width={12} height={12} />
              </span>
              <p className="min-w-0 flex-1 text-[15px] font-medium text-success-fg">
                Journey created! Your conversation has been converted to a journey:{" "}
                <span className="font-bold">{createdJourneyTitle}</span>
              </p>
              <button
                type="button"
                onClick={onViewJourneys}
                className="shrink-0 text-[15px] font-bold text-accent underline"
              >
                View Journey →
              </button>
            </div>
          )}

          <div role="log" aria-label="Conversation" className="flex w-full flex-col gap-6">
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
        <p role="alert" className="px-4 pb-2 text-center text-xs text-red-500 sm:px-10">
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex shrink-0 flex-wrap items-center gap-4 border-t border-divider bg-background px-4 py-5 sm:flex-nowrap sm:px-10"
      >
        <button
          type="button"
          onClick={onStartVoice}
          aria-label="Reply by voice"
          className="flex size-11 shrink-0 items-center justify-center rounded-[22px] bg-surface text-label hover:bg-foreground/5"
        >
          <AssetIcon name="mic" width={18} height={18} />
        </button>
        <div className="flex h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-divider bg-surface px-4 focus-within:ring-2 focus-within:ring-accent-strong">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Message Z1P"
            placeholder="Continue this conversation..."
            className="w-full min-w-0 bg-transparent text-sm text-foreground placeholder:text-tertiary focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            aria-label="Send"
            className="shrink-0 disabled:opacity-40"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ui/send-arrow.svg" alt="" width={18} height={18} />
          </button>
        </div>
        {linked ? (
          <button
            type="button"
            onClick={onViewJourneys}
            className="shrink-0 rounded-xl bg-accent/[0.08] px-6 py-3 text-[15px] font-bold text-accent"
          >
            → Linked to Journey
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConverting(true)}
            disabled={messages.length === 0}
            className="shrink-0 rounded-xl border-[1.5px] border-accent px-6 py-3 text-[15px] font-semibold text-accent transition-colors hover:bg-accent/5 disabled:opacity-50"
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
