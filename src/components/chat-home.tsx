"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { DesignOrb } from "@/components/design-orb";
import {
  AttachButton,
  AttachmentChips,
  useChatAttachments,
  type Outgoing,
} from "@/components/chat-attachments";
import { SendIcon } from "@/components/icons";
import { MobileSearchHeader } from "@/components/mobile-search-header";
import { Orb } from "@/components/orb";
import type { Appearance } from "@/lib/use-appearance";
import { useMediaQuery } from "@/lib/use-media-query";
import { ORB_TRANSITION } from "@/lib/view-transition";

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
  onOpenNotifications,
  appearance = "light",
}: {
  authenticated: boolean;
  onRequireAuth: () => void;
  onOpenConversation: (id: string, firstMessage: Outgoing) => void;
  onStartVoice: () => void;
  onOpenNotifications: () => void;
  appearance?: Appearance;
}) {
  const { data: session } = useSession();
  const firstName = (session?.user?.name ?? "there").split(/\s+/)[0];
  // Phones get the smaller orb from the mobile design.
  const phone = useMediaQuery("(max-width: 767px)");

  const [message, setMessage] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attachments = useChatAttachments();
  const canSend = !starting && (message.trim() !== "" || attachments.files.length > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    const files = attachments.files;
    if ((!trimmed && files.length === 0) || starting) return;
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
        body: JSON.stringify({ title: (trimmed || files.map((f) => f.name).join(", ")).slice(0, 60) }),
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
      attachments.clear();
      onOpenConversation(conversation.id, { content: trimmed, files });
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <MobileSearchHeader onOpenNotifications={onOpenNotifications} onRequireAuth={onRequireAuth} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex h-full flex-col px-6 pt-9 pb-6 md:pl-[47px] md:pr-8 md:pt-[53px]">
          <div className="flex max-w-[712px] flex-col gap-[7px] md:gap-6">
            <p className="text-base font-medium text-secondary md:text-lg md:font-normal md:text-foreground">
              Your Workspace
            </p>
            <div className="flex flex-col gap-[7px] md:block">
              <h1 className="font-display text-[34px] leading-[1.05] font-bold text-foreground md:text-5xl md:leading-normal">
                {greetingForHour(new Date().getHours())},{" "}
                <span className="text-accent-strong">{firstName}</span>
              </h1>
              <p className="text-xl text-foreground md:text-2xl">
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
              {/* Named so it glides into voice mode's orb (see app-shell). */}
              <span style={{ viewTransitionName: ORB_TRANSITION }}>
                {appearance === "light" ? (
                  <DesignOrb width={phone ? 173 : 241} />
                ) : (
                  <Orb size={140} appearance={appearance} />
                )}
              </span>
              <span className="w-full text-center text-foreground">
                <span className="-mb-px block text-2xl font-medium">
                  Speak with Z1p
                </span>
                <span className="block whitespace-nowrap text-base md:text-lg">
                  Ask anything or describe a task
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>

      {(error || attachments.problem) && (
        <p
          role="alert"
          className="mx-auto mb-2 w-full max-w-xl px-4 text-center text-xs text-red-500 sm:px-8"
        >
          {attachments.problem ?? error}
        </p>
      )}

      <AttachmentChips
        files={attachments.files}
        onRemove={attachments.remove}
        className="mx-auto mb-2 w-full max-w-xl px-4 sm:px-8"
      />

      <form
        onSubmit={handleSubmit}
        // Phones: the tab bar below already clears the home indicator.
        className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 pb-8 sm:px-8 md:pb-[max(2rem,calc(env(safe-area-inset-bottom)+1rem))]"
      >
        <div className="flex flex-1 items-center gap-2 rounded-full border border-input-border bg-input py-1.5 pr-4 pl-1.5 focus-within:border-foreground/30">
          <AttachButton
            onPick={(picked) => (authenticated ? attachments.add(picked) : onRequireAuth())}
            disabled={starting}
            className="size-9"
          />
          <input
            value={message}
            aria-label="Message Z1P"
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask anything"
            // 16px on phones, or iOS zooms the page in when the box is tapped.
            className="w-full bg-transparent text-base text-foreground placeholder:text-muted focus:outline-none md:text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={!canSend}
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
