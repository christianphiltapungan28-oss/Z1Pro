"use client";

import { useEffect, useState } from "react";
import { CalendarIcon, MenuIcon, SearchIcon } from "@/components/icons";

function formatToday(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function Topbar({
  onMenuClick,
  searchPlaceholder = "Search Your Journeys.....",
}: {
  onMenuClick: () => void;
  searchPlaceholder?: string;
}) {
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- today's date depends on the client's clock, not server-rendered state
    setToday(formatToday(new Date()));
  }, []);

  return (
    <header className="flex items-center gap-4 border-b border-card-border px-4 py-3 sm:pl-6 sm:pr-4">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open menu"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground/70 hover:text-foreground md:hidden"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      <div className="flex max-w-md flex-1 items-center gap-2 rounded-[10px] border border-input-border px-3 py-2.5">
        <SearchIcon className="h-4.5 w-4.5 shrink-0 text-muted" />
        <input
          type="text"
          placeholder={searchPlaceholder}
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
        />
      </div>

      <div className="ml-auto hidden items-center gap-2 text-sm text-foreground sm:flex">
        <span>{today}</span>
        <CalendarIcon className="h-5 w-5 shrink-0 text-foreground/70" />
      </div>
    </header>
  );
}
