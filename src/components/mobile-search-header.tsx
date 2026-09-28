"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { AssetIcon } from "@/components/asset-icon";

/**
 * Phone header with journey search and the notifications bell (mobile
 * Figma: Home 493:6874, Journeys empty state 493:7973). Hidden from md up,
 * where the desktop top bar takes over.
 */
export function MobileSearchHeader({
  onOpenNotifications,
  onRequireAuth,
}: {
  onOpenNotifications: () => void;
  onRequireAuth: () => void;
}) {
  const { status } = useSession();
  const authenticated = status === "authenticated";
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!authenticated) return;
    let ignore = false;
    fetch("/api/notifications?count")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!ignore && body) setUnread(body.unread ?? 0);
      });
    return () => {
      ignore = true;
    };
  }, [authenticated]);

  return (
    <div className="flex shrink-0 items-center gap-[11px] px-[27px] pt-6 md:hidden">
      <div className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-[10px] border border-divider px-3.5 focus-within:ring-2 focus-within:ring-accent-strong">
        <span className="shrink-0 text-secondary">
          <AssetIcon name="search" width={20} height={20} />
        </span>
        <input
          type="text"
          aria-label="Search"
          placeholder="Search your journeys..."
          className="w-full min-w-0 bg-transparent text-[15px] text-foreground placeholder:text-secondary focus:outline-none"
        />
      </div>
      <button
        type="button"
        onClick={authenticated ? onOpenNotifications : onRequireAuth}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative shrink-0 rounded-full"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ui/bell-button.svg" alt="" width={40.3457} height={40.716} />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full border-2 border-background bg-accent" />
        )}
      </button>
    </div>
  );
}
