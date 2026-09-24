"use client";

import { useEffect, useState } from "react";
import { AssetIcon } from "@/components/asset-icon";
import { formatRelativeTime } from "@/lib/relative-time";

type ConversationItem = {
  id: string;
  title: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  preview: string | null;
  hasJourney: boolean;
};

type Page = {
  items: ConversationItem[];
  total: number;
  page: number;
  pageSize: number;
};

// The design shows at most this many page dots.
const MAX_DOTS = 4;

export function ConversationsList({
  onOpen,
  onNewChat,
}: {
  onOpen: (id: string) => void;
  onNewChat: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState(false);

  // Wait for typing to pause before searching, so each keystroke isn't a
  // request.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let ignore = false;
    const params = new URLSearchParams({ page: String(page) });
    if (debouncedQuery) params.set("q", debouncedQuery);
    fetch(`/api/conversations?${params}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((next: Page) => {
        if (ignore) return;
        setData(next);
        setError(false);
      })
      .catch(() => {
        if (!ignore) setError(true);
      });
    return () => {
      ignore = true;
    };
  }, [page, debouncedQuery]);

  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const firstDot = Math.min(
    Math.max(0, page - 1 - Math.floor(MAX_DOTS / 2)),
    Math.max(0, pageCount - MAX_DOTS)
  );
  const dots = Array.from(
    { length: Math.min(MAX_DOTS, pageCount) },
    (_, i) => firstDot + i + 1
  );

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex w-full max-w-[500px] items-center gap-2.5 rounded-[10px] border border-divider bg-background px-4 py-2.5 text-label focus-within:ring-2 focus-within:ring-accent-strong">
          <AssetIcon name="search-small" width={16} height={16} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search past conversations"
            placeholder="Search past conversations..."
            className="w-full min-w-0 bg-transparent text-sm text-foreground placeholder:text-tertiary focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={onNewChat}
          className="shrink-0 rounded-[10px] bg-accent px-6 py-3 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          + New Chat
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-divider bg-background">
        <div className="flex items-start border-b border-divider bg-surface px-6 py-3.5 text-xs font-bold text-label">
          <p className="min-w-0 flex-1">CONVERSATION</p>
          <p className="w-[100px] shrink-0 text-right">LAST ACTIVE</p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {error && (
            <p role="alert" className="px-6 py-10 text-center text-sm text-tertiary">
              Couldn&rsquo;t load your conversations. Please try again.
            </p>
          )}
          {!error && !data && (
            <p className="px-6 py-10 text-center text-sm text-tertiary">Loading…</p>
          )}
          {!error && data && data.items.length === 0 && (
            <p className="px-6 py-10 text-center text-sm text-tertiary">
              {debouncedQuery
                ? `No conversations match “${debouncedQuery}”.`
                : "No conversations yet. Start one with + New Chat."}
            </p>
          )}
          {data?.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpen(item.id)}
              className="flex w-full shrink-0 items-center gap-4 border-b border-divider bg-background px-6 py-5 text-left transition-colors hover:bg-accent/[0.02]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ui/conversation-tile.svg" alt="" width={40} height={40} className="shrink-0" />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex w-full items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
                    {item.title || "New chat"}
                  </span>
                  {item.hasJourney && (
                    <span className="shrink-0 rounded-md bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
                      → Journey
                    </span>
                  )}
                </span>
                <span className="w-full truncate text-sm text-tertiary">
                  {item.preview
                    ?.replace(/[*_`#>]+/g, "")
                    .replace(/\s+/g, " ")
                    .trim() || "No messages yet"}
                </span>
              </span>
              <span className="w-[100px] shrink-0 text-right text-[13px] text-tertiary">
                {formatRelativeTime(item.lastMessageAt ?? item.createdAt)}
              </span>
            </button>
          ))}
        </div>

        <nav
          aria-label="Pages"
          className="flex shrink-0 items-center gap-2 border-t border-divider bg-surface px-6 py-4"
        >
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label="Previous page"
            className="flex size-8 items-center justify-center rounded-2xl bg-accent/10 disabled:border disabled:border-divider disabled:bg-background"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={page <= 1 ? "/ui/page-next.svg" : "/ui/page-prev.svg"}
              alt=""
              width={16}
              height={16}
              className={page <= 1 ? "-rotate-90" : "rotate-90"}
            />
          </button>
          <span className="flex items-center gap-2" aria-label={`Page ${page} of ${pageCount}`}>
            {dots.map((n) => (
              <span
                key={n}
                aria-hidden="true"
                className={`size-2 rounded-full ${n === page ? "bg-accent" : "bg-dot-inactive"}`}
              />
            ))}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={page >= pageCount}
            aria-label="Next page"
            className="flex size-8 items-center justify-center rounded-2xl border border-divider bg-background enabled:hover:bg-accent/10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ui/page-next.svg" alt="" width={16} height={16} className="rotate-90" />
          </button>
        </nav>
      </div>
    </div>
  );
}
