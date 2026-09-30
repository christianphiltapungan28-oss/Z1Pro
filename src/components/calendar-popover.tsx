"use client";

import { useState } from "react";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** The month's days in Monday-first weeks, with nulls for the blank cells. */
function monthWeeks(year: number, month: number) {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: days }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/**
 * The top bar's month calendar (Figma 370:2315): browse months with ‹ ›,
 * today starts selected, and days use the Day Number states (371:2242):
 * hovered is outlined in pink, the selected day is filled.
 */
export function CalendarPopover({ today }: { today: Date }) {
  const [shown, setShown] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState(today);

  const title = new Date(shown.year, shown.month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  function step(by: number) {
    setShown(({ year, month }) => {
      const next = new Date(year, month + by, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  return (
    <div className="flex w-[340px] flex-col gap-3 rounded-2xl border border-divider bg-background p-5 drop-shadow-[0_4px_10px_rgba(0,0,0,0.1)]">
      <div className="flex h-7 items-center">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous month"
          className="-m-1.5 flex size-8 items-center justify-center rounded-full text-[22px] leading-none font-bold text-calendar-accent hover:bg-calendar-tint"
        >
          ‹
        </button>
        <h2 aria-live="polite" className="flex-1 text-center text-lg font-semibold text-foreground">
          {title}
        </h2>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Next month"
          className="-m-1.5 flex size-8 items-center justify-center rounded-full text-[22px] leading-none font-bold text-calendar-accent hover:bg-calendar-tint"
        >
          ›
        </button>
      </div>

      <div role="grid" aria-label={title} className="flex flex-col gap-3">
        <div role="row" className="flex">
          {WEEKDAYS.map((day) => (
            <span
              key={day}
              role="columnheader"
              className="flex h-7 flex-1 items-center justify-center text-xs font-medium text-tertiary"
            >
              {day}
            </span>
          ))}
        </div>
        <div className="h-px w-full bg-divider" aria-hidden="true" />
        {monthWeeks(shown.year, shown.month).map((week, w) => (
          <div key={w} role="row" className="flex">
            {week.map((date, d) => {
              if (!date) return <span key={d} role="gridcell" className="h-[38px] flex-1" />;
              const isSelected = sameDay(date, selected);
              const isToday = sameDay(date, today);
              return (
                <span key={d} role="gridcell" className="flex flex-1 justify-center">
                  <button
                    type="button"
                    onClick={() => setSelected(date)}
                    aria-pressed={isSelected}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={date.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                    className={`flex h-[38px] w-[42px] items-center justify-center rounded-[10px] border-2 text-sm ${
                      isSelected
                        ? "border-calendar-accent bg-calendar-accent font-bold text-white"
                        : "border-transparent text-foreground hover:border-calendar-accent hover:bg-calendar-tint hover:font-medium hover:text-calendar-accent"
                    }`}
                  >
                    {date.getDate()}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
