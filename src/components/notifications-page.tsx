"use client";

import { AssetIcon } from "@/components/asset-icon";

/**
 * Notifications (mobile design 597:2995). The list itself arrives with
 * in-app notifications; until then there is nothing to show.
 */
export function NotificationsPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <header className="flex items-center gap-3 px-6 pt-8 pb-6 md:px-10">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-foreground md:hidden"
        >
          <AssetIcon name="back" width={20} height={20} />
        </button>
        <div className="flex flex-col">
          <h1 className="text-[34px] leading-tight font-bold text-foreground">Notifications</h1>
          <p className="text-sm text-secondary">No unread updates</p>
        </div>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 pb-16 text-center">
        <p className="text-lg font-semibold text-foreground">You&apos;re all caught up</p>
        <p className="max-w-[280px] text-sm text-secondary">
          Journey milestones, score updates and replies from Zip will show up here.
        </p>
      </div>
    </div>
  );
}
