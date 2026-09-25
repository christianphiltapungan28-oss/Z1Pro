"use client";

import { useSession } from "next-auth/react";
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
        aria-label="Notifications"
        className="shrink-0 rounded-full"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ui/bell-button.svg" alt="" width={40.3457} height={40.716} />
      </button>
    </div>
  );
}
