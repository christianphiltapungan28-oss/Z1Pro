"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { AmbientBackground } from "@/components/ambient-background";
import { AppearanceDialog } from "@/components/appearance-dialog";
import { ChatHome } from "@/components/chat-home";
import { CloseIcon } from "@/components/icons";
import { Journeys } from "@/components/journeys";
import { Sidebar } from "@/components/sidebar";
import { SignInDialog } from "@/components/sign-in-dialog";
import { Topbar } from "@/components/topbar";
import { UpgradeDialog } from "@/components/upgrade-dialog";
import { VoiceMode } from "@/components/voice-mode";
import { useAppearance } from "@/lib/use-appearance";
import type { Journey } from "@/types/journey";

type View = "home" | "journeys";

const CHECKOUT_MESSAGES: Record<string, string> = {
  success: "You're upgraded! Your new plan is now active.",
  cancelled: "Checkout was cancelled — you weren't charged.",
  pending: "Payment is still processing. We'll update your plan once it's confirmed.",
  error: "Something went wrong starting checkout. Please try again.",
};

function CheckoutBanner({
  status,
  onDismiss,
}: {
  status: string;
  onDismiss: () => void;
}) {
  const message = CHECKOUT_MESSAGES[status] ?? CHECKOUT_MESSAGES.error;
  const isSuccess = status === "success";
  return (
    <div
      className={`mx-4 mt-2 flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-sm sm:mx-6 ${
        isSuccess
          ? "bg-accent/12 text-foreground"
          : "bg-foreground/8 text-foreground"
      }`}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted hover:text-foreground"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function AppShell() {
  const [voiceMode, setVoiceMode] = useState(false);
  const [view, setView] = useState<View>("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [checkoutStatus, setCheckoutStatus] = useState<string | null>(null);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [journeysLoading, setJourneysLoading] = useState(true);
  const { appearance, setAppearance } = useAppearance();
  const { status: sessionStatus } = useSession();
  const authenticated = sessionStatus === "authenticated";

  useEffect(() => {
    if (!authenticated) return;
    let ignore = false;
    fetch("/api/journeys")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (ignore || !data) return;
        setJourneys(data.journeys ?? []);
      })
      .finally(() => {
        if (!ignore) setJourneysLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [authenticated]);

  async function createJourney(payload: {
    title: string;
    description?: string;
    sourceConversationId?: string;
  }) {
    const res = await fetch("/api/journeys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const journey: Journey = await res.json();
    setJourneys((prev) => [journey, ...prev]);
    return journey;
  }

  function openJourney(journey: Journey) {
    setActiveConversationId(journey.sourceConversationId);
    setVoiceMode(false);
    setView("home");
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    if (!checkout) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from the URL on mount, not derivable from render
    setCheckoutStatus(checkout);
    params.delete("checkout");
    params.delete("payment");
    const query = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (query ? `?${query}` : "")
    );
  }, []);

  return (
    <div className="relative flex h-dvh overflow-hidden bg-background">
      <AmbientBackground />

      <div className="relative z-10 flex h-full min-w-0 flex-1">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          view={view}
          onChangeView={(next) => {
            setView(next);
            setVoiceMode(false);
            setSidebarOpen(false);
          }}
          onOpenAppearance={() => setAppearanceOpen(true)}
          onRequireAuth={() => setSignInOpen(true)}
          onOpenUpgrade={() => setUpgradeOpen(true)}
          activeConversationId={activeConversationId}
          onSelectConversation={(id) => {
            setActiveConversationId(id);
            setSidebarOpen(false);
          }}
          journeys={journeys}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            onMenuClick={() => setSidebarOpen(true)}
            searchPlaceholder={
              view === "journeys"
                ? "Search Your Journeys....."
                : "Ask anything"
            }
          />
          {checkoutStatus && (
            <CheckoutBanner
              status={checkoutStatus}
              onDismiss={() => setCheckoutStatus(null)}
            />
          )}
          <main className="min-h-0 flex-1">
            {view === "journeys" ? (
              <Journeys
                journeys={journeys}
                loading={journeysLoading}
                onStartJourney={() => {
                  setView("home");
                  setVoiceMode(true);
                }}
                onOpenJourney={openJourney}
              />
            ) : voiceMode ? (
              <VoiceMode
                appearance={appearance}
                conversationId={activeConversationId}
                onConversationCreated={setActiveConversationId}
              />
            ) : (
              <ChatHome
                conversationId={activeConversationId}
                onConversationCreated={setActiveConversationId}
                onStartVoice={() => setVoiceMode(true)}
                onCreateJourney={createJourney}
                onJourneySaved={() => setView("journeys")}
                appearance={appearance}
              />
            )}
          </main>
        </div>
      </div>

      <AppearanceDialog
        open={appearanceOpen}
        onClose={() => setAppearanceOpen(false)}
        appearance={appearance}
        onChange={setAppearance}
      />

      <SignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} />

      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
}
