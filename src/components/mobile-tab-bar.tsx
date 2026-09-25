"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { AssetIcon } from "@/components/asset-icon";
import type { View } from "@/components/app-shell";

const TABS: { label: string; icon: string; views: View[]; target: View; requiresAuth: boolean }[] = [
  { label: "Home", icon: "nav/home", views: ["home"], target: "home", requiresAuth: false },
  { label: "Journeys", icon: "nav/stacks", views: ["journeys"], target: "journeys", requiresAuth: true },
  {
    label: "Convos",
    icon: "nav/convos",
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
      className="flex shrink-0 items-center justify-center gap-12 border-t border-flow-line bg-background px-2.5 pt-2.5 pb-[max(10px,env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="flex items-start gap-12">
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
              className={`flex h-[58px] min-w-[52px] flex-col items-center justify-center gap-[5px] text-sm ${
                active ? "text-accent" : "text-foreground"
              }`}
            >
              <AssetIcon name={tab.icon} width={22.213} height={18.257} />
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
