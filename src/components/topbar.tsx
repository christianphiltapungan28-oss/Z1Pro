"use client";

import { useEffect, useState } from "react";
import { AssetIcon } from "@/components/asset-icon";
import { MenuIcon } from "@/components/icons";

// Matches the design's "Monday, September 7 2026" (no comma before the year).
function formatToday(date: Date) {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const month = date.toLocaleDateString("en-US", { month: "long" });
  return `${weekday}, ${month} ${date.getDate()} ${date.getFullYear()}`;
}

export function Topbar({
  onMenuClick,
  searchPlaceholder = "Search Your Journeys.....",
  title,
  subtitle,
}: {
  onMenuClick: () => void;
  searchPlaceholder?: string;
  /** Pages like Conversations show a heading here instead of search. */
  title?: string;
  subtitle?: string;
}) {
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- today's date depends on the client's clock, not server-rendered state
    setToday(formatToday(new Date()));
  }, []);

  return (
    <header className="flex h-[94px] shrink-0 items-center gap-4 border-b border-divider px-4 sm:pl-[51px] sm:pr-[42px]">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open menu"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground/70 hover:text-foreground md:hidden"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      {title ? (
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="truncate text-[22px] font-bold text-foreground">{title}</h1>
          {subtitle && (
            <p className="truncate text-sm text-tertiary">{subtitle}</p>
          )}
        </div>
      ) : (
      <div className="flex w-full max-w-[408px] items-center gap-2.5 rounded-[10px] border border-input-border p-2.5 focus-within:ring-2 focus-within:ring-accent-strong">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center text-search-placeholder">
          <AssetIcon name="search" width={20.207} height={20.207} />
        </span>
        <input
          type="text"
          aria-label="Search"
          placeholder={searchPlaceholder}
          className="w-full min-w-0 bg-transparent text-lg text-foreground placeholder:text-search-placeholder focus:outline-none"
        />
      </div>
      )}

      <div className="ml-auto hidden items-center gap-[7px] text-base text-foreground lg:flex">
        <span className="whitespace-nowrap">{today}</span>
        <span className="flex h-[27px] w-[27px] shrink-0 items-center justify-center">
          <AssetIcon name="calendar-clock" width={22.5} height={22.5} />
        </span>
      </div>
    </header>
  );
}
