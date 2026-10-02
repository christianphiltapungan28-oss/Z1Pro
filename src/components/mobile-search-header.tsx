"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { AssetIcon } from "@/components/asset-icon";
import type { Journey } from "@/types/journey";

const MAX_RESULTS = 6;

/**
 * Phone header with journey search and the notifications bell (mobile
 * Figma: Home 493:6874, Journeys empty state 493:7973). Hidden from md up,
 * where the desktop top bar takes over. Search matches journey titles and
 * descriptions; the list is fetched the first time the box is focused.
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
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [journeys, setJourneys] = useState<Journey[] | null>(null);
  const [loading, setLoading] = useState(false);

  function loadJourneys() {
    if (!authenticated || journeys || loading) return;
    setLoading(true);
    fetch("/api/journeys")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setJourneys(body?.journeys ?? []))
      .finally(() => setLoading(false));
  }

  const q = query.trim().toLowerCase();
  const results =
    q && journeys
      ? journeys
          .filter((j) => `${j.title} ${j.description ?? ""}`.toLowerCase().includes(q))
          .slice(0, MAX_RESULTS)
      : [];
  const open = focused && q.length > 0;

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
      <div className="relative min-w-0 flex-1">
        <div className="flex h-12 items-center gap-2.5 rounded-[10px] border border-divider px-3.5 focus-within:border-foreground/30">
          <span className="shrink-0 text-secondary">
            <AssetIcon name="search" width={20} height={20} />
          </span>
          <input
            type="search"
            role="combobox"
            aria-label="Search your journeys"
            aria-expanded={open}
            aria-controls={listId}
            placeholder="Search your journeys..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              setFocused(true);
              if (!authenticated) onRequireAuth();
              else loadJourneys();
            }}
            // Delay so a tap on a result lands before the list closes.
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQuery("");
              if (e.key === "Enter" && results[0]) router.push(`/journeys/${results[0].id}`);
            }}
            className="w-full min-w-0 bg-transparent text-base text-foreground placeholder:text-secondary outline-none! [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        {open && (
          <ul
            id={listId}
            role="listbox"
            className="absolute inset-x-0 top-[52px] z-30 max-h-[60vh] overflow-y-auto rounded-[14px] border border-divider bg-background py-1 shadow-[0_12px_28px_rgba(0,0,0,0.12)]"
          >
            {journeys === null ? (
              <li className="px-4 py-3 text-sm text-tertiary">Loading…</li>
            ) : results.length === 0 ? (
              <li className="px-4 py-3 text-sm text-secondary">No journeys match &ldquo;{query.trim()}&rdquo;</li>
            ) : (
              results.map((j) => (
                <li key={j.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => router.push(`/journeys/${j.id}`)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-foreground/5"
                  >
                    <span className="min-w-0 truncate text-[15px] font-medium text-foreground">{j.title}</span>
                    <span className="shrink-0 text-xs font-medium text-secondary">
                      {j.completedAt ? "Done" : `${j.progress}%`}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
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
