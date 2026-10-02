"use client";

import { useSession } from "next-auth/react";
import { useRef, useState, useSyncExternalStore } from "react";
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
import { useElementSize } from "@/lib/use-element-size";
import { useMediaQuery } from "@/lib/use-media-query";
import { ORB_TRANSITION } from "@/lib/view-transition";

const noSubscription = () => () => {};

// The orb is 1.17× as tall as it is wide (its glow reaches further down), and
// "Speak with Z1p" plus the gap above it take about 84px. Its blurred glow
// also spills about a third of its width past the top, so phones leave room
// for that too, or the glow runs into the greeting.
const ORB_ASPECT = 1.17;
const ORB_GLOW = 0.34;
const ORB_LABEL_SPACE = 84;

// The mobile design's orb (Figma 493:6874); it only shrinks on phones too
// short to fit it.
const PHONE_ORB = 173;

function phoneOrbWidth(area: { width: number; height: number } | null) {
  if (!area) return PHONE_ORB;
  const byHeight = (area.height - ORB_LABEL_SPACE) / (ORB_ASPECT + ORB_GLOW);
  return Math.round(Math.max(96, Math.min(PHONE_ORB, byHeight, area.width * 0.6)));
}

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
  const firstName = session?.user?.name?.split(/\s+/)[0] ?? null;
  // The hour comes from the visitor's clock. The server renders in UTC, so it
  // gets no hour (a neutral "Hello") rather than a greeting that may not
  // match the browser's and trip React's hydration check.
  const hour = useSyncExternalStore(
    noSubscription,
    () => new Date().getHours(),
    () => null
  );
  const phone = useMediaQuery("(max-width: 767px)");
  // Phones size the orb to the room left between the greeting and the chat
  // box, so it fits from small to tall screens without pushing "Speak with
  // Z1p" out of view.
  const orbArea = useRef<HTMLDivElement>(null);
  const area = useElementSize(orbArea);
  const orbWidth = phone ? phoneOrbWidth(area) : 241;

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
        {/* Phone type and spacing scale with the screen (clamp), so the
            greeting stays on two lines from 320px phones up. */}
        <div className="flex h-full flex-col px-[clamp(16px,6vw,24px)] pt-[clamp(12px,4vh,36px)] pb-4 md:pl-[47px] md:pr-8 md:pt-[53px] md:pb-6">
          <div className="flex max-w-[712px] shrink-0 flex-col gap-[7px] md:gap-6">
            <p className="text-[clamp(14px,4vw,16px)] font-medium text-secondary md:text-lg md:font-normal md:text-foreground">
              Your Workspace
            </p>
            <div className="flex flex-col gap-[7px] md:block">
              <h1 className="font-display text-[clamp(28px,8.6vw,36px)] leading-[1.08] font-bold text-foreground md:text-5xl md:leading-normal">
                {firstName ? (
                  <>
                    {hour === null ? "Hello" : greetingForHour(hour)},{" "}
                    <span className="text-accent-strong">{firstName}</span>
                  </>
                ) : (
                  <>
                    Welcome to <span className="text-accent-strong">Z1P</span>
                  </>
                )}
              </h1>
              <p className="text-[clamp(17px,5vw,20px)] text-foreground md:text-2xl">
                What would you like to do?
              </p>
            </div>
          </div>

          <div ref={orbArea} className="flex min-h-0 flex-1 flex-col items-center justify-center">
            <button
              type="button"
              onClick={onStartVoice}
              // Clears the glow above the orb (see ORB_GLOW).
              style={phone ? { marginTop: Math.round(orbWidth * ORB_GLOW) } : undefined}
              className="flex w-full max-w-[248px] flex-col items-center gap-[clamp(10px,2.4vh,22px)]"
            >
              {/* Named so it glides into voice mode's orb (see app-shell). */}
              <span style={{ viewTransitionName: ORB_TRANSITION }}>
                {appearance === "light" ? (
                  <DesignOrb width={orbWidth} />
                ) : (
                  <Orb size={Math.round(orbWidth * 0.8)} appearance={appearance} />
                )}
              </span>
              <span className="w-full text-center text-foreground">
                <span className="-mb-px block text-[clamp(20px,6vw,24px)] font-medium md:text-2xl">
                  Speak with <span className="md:hidden">Z1P</span>
                  <span className="hidden md:inline">Z1p</span>
                </span>
                <span className="block whitespace-nowrap text-[clamp(14px,4vw,16px)] md:text-lg">
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
        className="mx-auto flex w-full max-w-xl shrink-0 items-center gap-2 px-[clamp(12px,4vw,16px)] pt-1 pb-2 sm:px-8 md:gap-3 md:pt-0 md:pb-[max(2rem,calc(env(safe-area-inset-bottom)+1rem))]"
      >
        {/* Phones: the field and send button share one 48px height. */}
        <div className="flex h-12 min-w-0 flex-1 items-center gap-1.5 rounded-full border border-input-border bg-input pr-4 pl-1.5 shadow-[0_1px_6px_rgba(0,0,0,0.06)] focus-within:border-foreground/30 md:h-auto md:gap-2 md:py-1.5 md:shadow-none">
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
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50 md:size-12"
        >
          <SendIcon className="h-5 w-5" />
        </button>
      </form>
      <p className="mb-2.5 shrink-0 px-4 text-center text-[clamp(11px,3vw,12px)] text-muted md:-mt-6 md:mb-3">
        Z1P can make mistakes. Check important information.
      </p>
    </div>
  );
}
