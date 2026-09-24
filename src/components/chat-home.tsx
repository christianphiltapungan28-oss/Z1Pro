"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { DesignOrb } from "@/components/design-orb";
import { BookIcon, PlusIcon, SendIcon } from "@/components/icons";
import { MarkdownMessage } from "@/components/markdown-message";
import { Orb } from "@/components/orb";
import type { Appearance } from "@/lib/use-appearance";

type Message = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt: string;
};

function greetingForHour(hour: number) {
  if (hour < 5) return "Good Night";
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? "whitespace-pre-wrap bg-accent text-white"
            : "border border-card-border bg-card text-foreground"
        }`}
      >
        {isUser ? (
          message.content
        ) : (
          <MarkdownMessage content={message.content} />
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div
        role="status"
        className="flex items-center gap-1 rounded-2xl border border-card-border bg-card px-4 py-3"
      >
        <span className="sr-only">Z1P is typing…</span>
        <span aria-hidden="true" className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.2s]" />
        <span aria-hidden="true" className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.1s]" />
        <span aria-hidden="true" className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
      </div>
    </div>
  );
}

export function ChatHome({
  conversationId,
  onConversationCreated,
  onStartVoice,
  onCreateJourney,
  onJourneySaved,
  appearance = "light",
}: {
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
  onStartVoice: () => void;
  onCreateJourney: (payload: {
    title: string;
    description?: string;
    sourceConversationId?: string;
  }) => Promise<unknown>;
  onJourneySaved: () => void;
  appearance?: Appearance;
}) {
  const { data: session } = useSession();
  const firstName = (session?.user?.name ?? "there").split(/\s+/)[0];

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadedForId, setLoadedForId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingJourney, setSavingJourney] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const skipNextFetchForId = useRef<string | null>(null);

  async function handleSaveAsJourney() {
    if (!conversationId || savingJourney) return;
    const firstUserMessage = messages.find((m) => m.role === "user")?.content;
    setSavingJourney(true);
    try {
      const created = await onCreateJourney({
        title: (firstUserMessage ?? "New Journey").slice(0, 60),
        sourceConversationId: conversationId,
      });
      if (created) onJourneySaved();
    } finally {
      setSavingJourney(false);
    }
  }

  useEffect(() => {
    if (!conversationId) return;
    if (skipNextFetchForId.current === conversationId) {
      skipNextFetchForId.current = null;
      return;
    }

    let ignore = false;
    fetch(`/api/conversations/${conversationId}/messages`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (ignore || !data) return;
        setMessages(data.messages ?? []);
        setLoadedForId(conversationId);
      });
    return () => {
      ignore = true;
    };
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || sending) return;

    setError(null);
    setMessage("");
    setSending(true);
    try {
      let activeId = conversationId;
      if (!activeId) {
        const createRes = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmed.slice(0, 60) }),
        });
        if (!createRes.ok) {
          setMessage(trimmed);
          return;
        }
        const conversation: { id: string } = await createRes.json();
        activeId = conversation.id;
        skipNextFetchForId.current = conversation.id;
        onConversationCreated(conversation.id);
      }

      const res = await fetch(`/api/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      if (!res.ok) {
        setMessage(trimmed);
        if (res.status === 429) {
          const data = await res.json().catch(() => null);
          setError(
            data?.dailyLimit
              ? `You've hit today's ${data.dailyLimit}-message limit on the ${data.planCode} plan. Upgrade for more.`
              : "You've hit today's message limit. Upgrade for more."
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
      setLoadedForId(activeId);
    } finally {
      setSending(false);
    }
  }

  const messagesLoaded = conversationId !== null && loadedForId === conversationId;
  const visibleMessages = messagesLoaded ? messages : [];
  const loadingMessages = conversationId !== null && !messagesLoaded;
  const showLanding = !conversationId;
  const hasReply = visibleMessages.some((m) => m.role === "assistant");

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {showLanding ? (
          <div className="flex h-full flex-col px-4 pt-10 pb-6 sm:pl-[47px] sm:pr-8 sm:pt-[53px]">
            <div className="flex max-w-[712px] flex-col gap-6">
              <p className="text-lg text-foreground">Your Workspace</p>
              <div>
                <h1 className="font-display text-4xl font-bold text-foreground sm:text-5xl">
                  {greetingForHour(new Date().getHours())},{" "}
                  <span className="text-accent-strong">{firstName}</span>
                </h1>
                <p className="text-xl text-foreground sm:text-2xl">
                  What would you like to do?
                </p>
              </div>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center">
              <button
                type="button"
                onClick={onStartVoice}
                className="flex w-[248px] flex-col items-center gap-[22px]"
              >
                {appearance === "light" ? (
                  <DesignOrb width={241} />
                ) : (
                  <Orb size={140} appearance={appearance} />
                )}
                <span className="w-full text-center text-foreground">
                  <span className="-mb-px block text-2xl font-medium">
                    Speak with Z1p
                  </span>
                  <span className="block whitespace-nowrap text-lg">
                    Ask anything or describe a task
                  </span>
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div
            role="log"
            aria-label="Conversation"
            className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6 sm:px-8"
          >
            {loadingMessages && (
              <p className="text-center text-sm text-muted">
                Loading chat…
              </p>
            )}
            {visibleMessages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {sending && <TypingIndicator />}
          </div>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className={`mx-auto mb-2 w-full px-4 text-center text-xs text-red-500 sm:px-8 ${
            showLanding ? "max-w-xl" : "max-w-2xl"
          }`}
        >
          {error}
        </p>
      )}

      {hasReply && (
        <div className="mx-auto mb-3 w-full max-w-2xl px-4 sm:px-8">
          <button
            type="button"
            onClick={handleSaveAsJourney}
            disabled={savingJourney}
            className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <BookIcon className="h-4 w-4" />
            {savingJourney ? "Saving…" : "Save as Journey"}
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={`flex w-full items-center gap-3 px-4 pb-[max(2rem,calc(env(safe-area-inset-bottom)+1rem))] sm:px-8 ${
          showLanding ? "mx-auto max-w-xl" : "mx-auto max-w-2xl"
        }`}
      >
        <div className="flex flex-1 items-center gap-2 rounded-full border border-input-border bg-input px-4 py-3 focus-within:ring-2 focus-within:ring-accent-strong">
          <PlusIcon className="h-4.5 w-4.5 shrink-0 text-muted" />
          <input
            value={message}
            aria-label="Message Z1P"
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask anything"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={sending || !message.trim()}
          aria-label="Send"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <SendIcon className="h-5 w-5" />
        </button>
      </form>
      <p className="-mt-5 mb-3 px-4 text-center text-[11px] text-muted sm:-mt-6">
        Z1P can make mistakes. Check important information.
      </p>
    </div>
  );
}
