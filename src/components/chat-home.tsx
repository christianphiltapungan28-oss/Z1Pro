"use client";

import { useEffect, useRef, useState } from "react";
import {
  BotIcon,
  ChevronRightIcon,
  ImageIcon,
  PlusIcon,
  SendIcon,
  SettingsIcon,
  ToolsIcon,
} from "@/components/icons";
import { MarkdownMessage } from "@/components/markdown-message";

const suggestions = [
  {
    label: "Suggestions",
    description: "Ideas tailored to what you're working on",
    icon: BotIcon,
  },
  {
    label: "Elite Tools",
    description: "Premium tools to speed up your workflow",
    icon: ToolsIcon,
  },
  {
    label: "AI Image Generator",
    description: "Turn a prompt into an image in seconds",
    icon: ImageIcon,
  },
  {
    label: "Assistants",
    description: "Purpose-built assistants for any task",
    icon: SettingsIcon,
  },
];

type Message = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt: string;
};

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? "whitespace-pre-wrap bg-[#ff6791] text-white"
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
      <div className="flex items-center gap-1 rounded-2xl border border-card-border bg-card px-4 py-3">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.2s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.1s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
      </div>
    </div>
  );
}

export function ChatHome({
  conversationId,
  onConversationCreated,
}: {
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
}) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadedForId, setLoadedForId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const skipNextFetchForId = useRef<string | null>(null);

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

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {showLanding ? (
          <div className="flex h-full flex-col items-center justify-center px-4 py-8 sm:px-8">
            <div className="mb-10 text-center">
              <h1 className="font-display text-3xl font-medium text-foreground sm:text-4xl">
                Hey, whats up!
              </h1>
              <p className="mt-2 text-sm text-muted sm:text-base">
                What are you up to? You can ask me anything
              </p>
            </div>

            <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
              {suggestions.map(({ label, description, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  className="group flex items-center gap-3 rounded-2xl border border-card-border bg-card px-4 py-3.5 text-left shadow-sm backdrop-blur-md transition-colors hover:bg-foreground/5 sm:flex-col sm:items-start sm:gap-2 sm:py-4"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ff6791]/12 text-[#ff6791]">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-foreground">
                      {label}
                    </span>
                    <span className="hidden text-xs text-muted sm:block">
                      {description}
                    </span>
                  </span>
                  <ChevronRightIcon className="h-4 w-4 text-muted sm:hidden" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6 sm:px-8">
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
          className={`mx-auto mb-2 w-full px-4 text-center text-xs text-red-500 sm:px-8 ${
            showLanding ? "max-w-xl" : "max-w-2xl"
          }`}
        >
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className={`flex w-full items-center gap-3 px-4 pb-8 sm:px-8 ${
          showLanding ? "mx-auto max-w-xl" : "mx-auto max-w-2xl"
        }`}
      >
        <div className="flex flex-1 items-center gap-2 rounded-full border border-input-border bg-input px-4 py-3 backdrop-blur-md">
          <PlusIcon className="h-4.5 w-4.5 shrink-0 text-muted" />
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask anything"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={sending || !message.trim()}
          aria-label="Send"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#ff6791] text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <SendIcon className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
