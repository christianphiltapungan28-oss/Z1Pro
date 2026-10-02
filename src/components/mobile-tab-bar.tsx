"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { AssetIcon } from "@/components/asset-icon";
import type { View } from "@/components/app-shell";

// Every tab icon sits in the same 22.213 × 18.257 box, as in the mobile
// design (Figma 493:7843).
const ICON_W = 22.213;
const ICON_H = 18.257;

function TabIcon({ name }: { name: "home" | "stacks" | "chat-spark" }) {
  if (name === "chat-spark") {
    // The chat icon's frame pads its artwork (insets 4.17% / 6.94%).
    return (
      <span className="relative block shrink-0" style={{ width: ICON_W, height: ICON_H }}>
        <span className="absolute" style={{ inset: "4.17% 4.17% 6.94% 6.94%" }}>
          <AssetIcon name="icons/chat-spark" width={ICON_W * 0.8889} height={ICON_H * 0.8889} />
        </span>
      </span>
    );
  }
  return <AssetIcon name={`icons/${name}`} width={ICON_W} height={ICON_H} />;
}

const TABS: {
  label: string;
  icon: "home" | "stacks" | "chat-spark";
  width: number;
  views: View[];
  target: View;
  requiresAuth: boolean;
}[] = [
  { label: "Home", icon: "home", width: 52, views: ["home"], target: "home", requiresAuth: false },
  { label: "Journeys", icon: "stacks", width: 61, views: ["journeys"], target: "journeys", requiresAuth: true },
  {
    label: "Convos",
    icon: "chat-spark",
    width: 52,
    views: ["conversations", "conversation"],
    target: "conversations",
    requiresAuth: true,
  },
];

// The design's 48px gaps on its 412px screen; narrower phones get smaller
// gaps so the profile photo never runs off the edge (it did at 320–360px).
const GAP = "gap-[min(48px,calc((100vw-266px)/3))]";

function Avatar({ image, name }: { image?: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (image && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        onError={() => setFailed(true)}
        className="size-[49px] rounded-full object-cover"
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span className="flex size-[49px] items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-sm font-semibold text-white">
      {initials || "?"}
    </span>
  );
}

/** Phone navigation (below the md breakpoint), in place of the sidebar. */
export function MobileTabBar({
  view,
  onChangeView,
  onRequireAuth,
}: {
  view: View;
  onChangeView: (view: View) => void;
  onRequireAuth: () => void;
}) {
  const { data: session, status } = useSession();
  const authenticated = status === "authenticated";
  const user = session?.user;

  return (
    <nav
      aria-label="Main"
      className={`flex shrink-0 items-center justify-center border-t border-flow-line bg-background px-2.5 pt-2.5 pb-[max(10px,env(safe-area-inset-bottom))] md:hidden ${GAP}`}
    >
      <div className={`flex items-start ${GAP}`}>
        {TABS.map((tab) => {
          const active = tab.views.includes(view);
          return (
            <button
              key={tab.label}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={
                tab.requiresAuth && !authenticated ? onRequireAuth : () => onChangeView(tab.target)
              }
              style={{ width: tab.width }}
              className={`flex h-[58px] shrink-0 flex-col items-center justify-center gap-[5px] text-[clamp(12px,3.6vw,14px)] ${
                active ? "text-accent" : "text-foreground"
              }`}
            >
              <TabIcon name={tab.icon} />
              {tab.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={authenticated ? () => onChangeView("profile") : onRequireAuth}
        aria-label={authenticated ? "Your profile" : "Sign in"}
        aria-current={view === "profile" ? "page" : undefined}
        className={`shrink-0 rounded-full ${view === "profile" ? "ring-2 ring-accent ring-offset-2 ring-offset-background" : ""}`}
      >
        <Avatar
          key={user?.image ?? "fallback"}
          image={user?.image}
          name={authenticated ? user?.name ?? "" : ""}
        />
      </button>
    </nav>
  );
}
