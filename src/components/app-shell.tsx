"use client";

import { useEffect, useState } from "react";
import { AmbientBackground } from "@/components/ambient-background";
import { AppearanceDialog } from "@/components/appearance-dialog";
import { ChatHome } from "@/components/chat-home";
import { CloseIcon } from "@/components/icons";
import { Sidebar } from "@/components/sidebar";
import { SignInDialog } from "@/components/sign-in-dialog";
import { Topbar } from "@/components/topbar";
import { UpgradeDialog } from "@/components/upgrade-dialog";
import { VoiceMode } from "@/components/voice-mode";
import { useAppearance } from "@/lib/use-appearance";

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
          ? "bg-[#ff6791]/12 text-foreground"
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [checkoutStatus, setCheckoutStatus] = useState<string | null>(null);
  const { appearance, setAppearance } = useAppearance();

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
          onOpenAppearance={() => setAppearanceOpen(true)}
          onRequireAuth={() => setSignInOpen(true)}
          onOpenUpgrade={() => setUpgradeOpen(true)}
          activeConversationId={activeConversationId}
          onSelectConversation={(id) => {
            setActiveConversationId(id);
            setSidebarOpen(false);
          }}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            voiceMode={voiceMode}
            onVoiceModeChange={setVoiceMode}
            onMenuClick={() => setSidebarOpen(true)}
            appearance={appearance}
            onOpenAppearance={() => setAppearanceOpen(true)}
          />
          {checkoutStatus && (
            <CheckoutBanner
              status={checkoutStatus}
              onDismiss={() => setCheckoutStatus(null)}
            />
          )}
          <main className="min-h-0 flex-1">
            {voiceMode ? (
              <VoiceMode
                appearance={appearance}
                conversationId={activeConversationId}
                onConversationCreated={setActiveConversationId}
              />
            ) : (
              <ChatHome
                conversationId={activeConversationId}
                onConversationCreated={setActiveConversationId}
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
