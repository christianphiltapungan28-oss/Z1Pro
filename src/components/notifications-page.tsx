"use client";

import { useEffect, useState } from "react";
import { AssetIcon } from "@/components/asset-icon";
import { Skeleton, SkeletonGroup } from "@/components/skeleton";

type Notification = {
  id: string;
  kind: "step" | "journey" | "metrics" | "file" | "reply" | "weekly" | "reminder";
  title: string;
  body: string;
  linkType: "journey" | "conversation" | "profile" | null;
  linkId: string | null;
  readAt: string | null;
  createdAt: string;
};

const ICONS: Record<Notification["kind"], string> = {
  step: "profile/target",
  journey: "profile/target",
  metrics: "notifications/sparkles",
  reply: "notifications/message-circle",
  file: "notifications/file",
  weekly: "notifications/chart-column-stacked",
  reminder: "notifications/bell",
};

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

/** "9:02 AM" today, then "Yesterday", a weekday within the week, then "Sep 5". */
function formatTime(iso: string, now: Date) {
  const date = new Date(iso);
  if (isSameDay(date, now)) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return "Yesterday";
  if (now.getTime() - date.getTime() < 6 * 86_400_000) {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function NotificationRow({
  item,
  now,
  onOpen,
}: {
  item: Notification;
  now: Date;
  onOpen: (item: Notification) => void;
}) {
  const unread = !item.readAt;
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={`flex w-full items-center gap-3 rounded-[14px] px-3.5 py-[13px] text-left ${
        unread ? "bg-accent/[0.035]" : "border border-foreground/[0.06] bg-background"
      }`}
    >
      <span
        className={`flex size-[42px] shrink-0 items-center justify-center rounded-full ${
          unread ? "bg-accent/[0.07] text-accent" : "bg-foreground/5 text-secondary"
        }`}
      >
        <AssetIcon name={ICONS[item.kind]} width={20} height={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center justify-between gap-2">
          <span
            className={`truncate text-[15px] text-foreground ${unread ? "font-bold" : "font-medium"}`}
          >
            {item.title}
          </span>
          <span className="shrink-0 text-xs font-medium text-tertiary">
            {formatTime(item.createdAt, now)}
          </span>
        </span>
        <span className="text-[13px] leading-[1.35] text-secondary">{item.body}</span>
      </span>
      {unread && (
        <span className="text-accent">
          <AssetIcon name="notifications/unread-dot" width={8} height={8} />
          <span className="sr-only">Unread</span>
        </span>
      )}
    </button>
  );
}

/** Notifications list (mobile Figma 597:2995), grouped into Today and Earlier. */
export function NotificationsPage({
  onOpenJourney,
  onOpenConversation,
  onOpenProfile,
}: {
  onOpenJourney: (id: string) => void;
  onOpenConversation: (id: string) => void;
  onOpenProfile: () => void;
}) {
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState(false);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let ignore = false;
    fetch("/api/notifications")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body) => {
        if (!ignore) setItems(body.items ?? []);
      })
      .catch(() => {
        if (!ignore) setError(true);
      });
    return () => {
      ignore = true;
    };
  }, []);

  function markRead(body: { id: string } | { all: true }) {
    const stamp = new Date().toISOString();
    setItems(
      (prev) =>
        prev?.map((n) =>
          !n.readAt && ("all" in body || n.id === body.id) ? { ...n, readAt: stamp } : n,
        ) ?? null,
    );
    void fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function open(item: Notification) {
    if (!item.readAt) markRead({ id: item.id });
    if (item.linkType === "journey" && item.linkId) onOpenJourney(item.linkId);
    else if (item.linkType === "conversation" && item.linkId) onOpenConversation(item.linkId);
    else if (item.linkType === "profile") onOpenProfile();
  }

  const unread = items?.filter((n) => !n.readAt).length ?? 0;
  const groups = [
    { label: "Today", list: items?.filter((n) => isSameDay(new Date(n.createdAt), now)) ?? [] },
    { label: "Earlier", list: items?.filter((n) => !isSameDay(new Date(n.createdAt), now)) ?? [] },
  ];

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-6 pt-[34px] pb-10 md:px-10 md:pt-10">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="text-[30px] leading-tight font-bold text-foreground">Notifications</h1>
            <p className="text-[13px] font-medium text-secondary">
              {items === null
                ? " "
                : unread === 0
                  ? "No unread updates"
                  : `${unread} unread ${unread === 1 ? "update" : "updates"}`}
            </p>
          </div>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => markRead({ all: true })}
              className="shrink-0 rounded-[10px] bg-accent px-4 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
            >
              Mark all as read
            </button>
          )}
        </header>

        {error && (
          <p role="alert" className="text-sm text-red-500">
            Couldn&rsquo;t load your notifications. Please try again.
          </p>
        )}
        {items === null && !error && (
          <SkeletonGroup label="Loading notifications" className="flex flex-col gap-2">
            <Skeleton className="mb-1 h-4 w-20" />
            {["w-1/2", "w-2/3", "w-2/5", "w-3/5"].map((width) => (
              <div
                key={width}
                className="flex items-center gap-3 rounded-[14px] border border-foreground/[0.06] px-3.5 py-[13px]"
              >
                <Skeleton className="size-[42px] shrink-0 rounded-full" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className={`h-4 ${width}`} />
                    <Skeleton className="h-3 w-10" />
                  </div>
                  <Skeleton className="h-3 w-4/5" />
                </div>
              </div>
            ))}
          </SkeletonGroup>
        )}

        {items?.length === 0 && (
          <div className="flex flex-col items-center gap-2 pt-16 text-center">
            <p className="text-lg font-semibold text-foreground">You&apos;re all caught up</p>
            <p className="max-w-[280px] text-sm text-secondary">
              Journey milestones, score updates and replies from Zip will show up here.
            </p>
          </div>
        )}

        {groups.map(
          ({ label, list }) =>
            list.length > 0 && (
              <section key={label} className="flex flex-col gap-2">
                <h2 className="text-base font-bold text-foreground">{label}</h2>
                {list.map((item) => (
                  <NotificationRow key={item.id} item={item} now={now} onOpen={open} />
                ))}
              </section>
            ),
        )}
      </div>
    </div>
  );
}
