"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { IconSetIcon, type IconSetName } from "@/components/asset-icon";
import type { View } from "@/components/app-shell";

const TABS: { label: string; icon: IconSetName; views: View[]; target: View; requiresAuth: boolean }[] = [
  { label: "Home", icon: "home", views: ["home"], target: "home", requiresAuth: false },
  { label: "Journeys", icon: "stacks", views: ["journeys"], target: "journeys", requiresAuth: true },
  {
    label: "Convos",
    icon: "chat-spark",
    views: ["conversations", "conversation"],
    target: "conversations",
    requiresAuth: true,
  },
];

function Avatar({ image, name }: { image?: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (image && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        onError={() => setFailed(true)}
        className="size-7 rounded-full object-cover"
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
    <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-[11px] font-semibold text-white">
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
    // Four equal columns, so the bar fits every phone width (the old fixed
    // gaps pushed the profile button off 320–360px screens).
    <nav
      aria-label="Main"
      className="grid shrink-0 grid-cols-4 border-t border-flow-line bg-background px-1 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))] md:hidden"
    >
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
            className={`flex h-[54px] min-w-0 flex-col items-center justify-center gap-1 text-[clamp(11px,3.3vw,13px)] ${
              active ? "font-semibold text-accent" : "text-foreground"
            }`}
          >
            {/* Each icon at its own proportions (all were drawn at the home icon's). */}
            <span className="flex h-7 items-center justify-center">
              <IconSetIcon name={tab.icon} size={tab.icon === "chat-spark" ? 24 : 22} />
            </span>
            <span className="max-w-full truncate">{tab.label}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={authenticated ? () => onChangeView("profile") : onRequireAuth}
        aria-label={authenticated ? "Your profile" : "Sign in"}
        aria-current={view === "profile" ? "page" : undefined}
        className={`flex h-[54px] min-w-0 flex-col items-center justify-center gap-1 text-[clamp(11px,3.3vw,13px)] ${
          view === "profile" ? "font-semibold text-accent" : "text-foreground"
        }`}
      >
        <span
          className={`flex h-7 items-center justify-center rounded-full ${
            view === "profile" ? "ring-2 ring-accent ring-offset-1 ring-offset-background" : ""
          }`}
        >
          <Avatar
            key={user?.image ?? "fallback"}
            image={user?.image}
            name={authenticated ? user?.name ?? "" : ""}
          />
        </span>
        <span className="max-w-full truncate">{authenticated ? "You" : "Sign in"}</span>
      </button>
    </nav>
  );
}
