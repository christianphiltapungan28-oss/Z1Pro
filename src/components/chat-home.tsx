"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { DesignOrb } from "@/components/design-orb";
import { PlusIcon, SendIcon } from "@/components/icons";
import { Orb } from "@/components/orb";
import type { Appearance } from "@/lib/use-appearance";

function greetingForHour(hour: number) {
  if (hour < 5) return "Good Night";
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

/**
 * The Home workspace: greeting, the orb for voice, and a quick text box.
 * Sending creates a conversation and hands the message to the conversation
 * page, which sends it and shows the reply.
 */
export function ChatHome({
  authenticated,
  onRequireAuth,
  onOpenConversation,
  onStartVoice,
  appearance = "light",
}: {
  authenticated: boolean;
  onRequireAuth: () => void;
  onOpenConversation: (id: string, firstMessage: string) => void;
  onStartVoice: () => void;
  appearance?: Appearance;
}) {
  const { data: session } = useSession();
  const firstName = (session?.user?.name ?? "there").split(/\s+/)[0];

  const [message, setMessage] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || starting) return;
    if (!authenticated) {
      onRequireAuth();
      return;
    }

    setError(null);
    setStarting(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed.slice(0, 60) }),
      });
      if (!res.ok) {
        setError(
          res.status === 429
            ? "You're starting chats too quickly. Try again shortly."
            : "Couldn't start a new chat. Please try again."
        );
        return;
      }
      const conversation: { id: string } = await res.json();
      setMessage("");
      onOpenConversation(conversation.id, trimmed);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
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
      </div>

      {error && (
        <p
          role="alert"
          className="mx-auto mb-2 w-full max-w-xl px-4 text-center text-xs text-red-500 sm:px-8"
        >
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 pb-[max(2rem,calc(env(safe-area-inset-bottom)+1rem))] sm:px-8"
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
          disabled={starting || !message.trim()}
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
