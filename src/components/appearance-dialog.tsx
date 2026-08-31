"use client";

import { useEffect } from "react";
import { CheckCircleIcon, CloseIcon } from "@/components/icons";
import type { Appearance } from "@/lib/use-appearance";

const OPTIONS: {
  id: Appearance;
  name: string;
  description: string;
  bg: string;
  blobA: string;
  blobB: string;
  panel: string;
  ink: string;
}[] = [
  {
    id: "light",
    name: "Daylight",
    description: "Soft pastel gradients on white",
    bg: "#ffffff",
    blobA: "#ffc9d6",
    blobB: "#bcd4ff",
    panel: "#ffffff",
    ink: "#16121a",
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "Vivid neon pink-to-blue glow",
    bg: "#050308",
    blobA: "#ff0022",
    blobB: "#0021d5",
    panel: "#1a1424",
    ink: "#ffffff",
  },
];

function Swatch({ option }: { option: (typeof OPTIONS)[number] }) {
  return (
    <div
      className="relative h-20 w-full overflow-hidden rounded-xl"
      style={{ background: option.bg }}
    >
      <div
        className="absolute -right-4 -top-4 h-16 w-16 rounded-full blur-xl"
        style={{ background: option.blobA, opacity: 0.7 }}
      />
      <div
        className="absolute -bottom-4 right-6 h-14 w-14 rounded-full blur-xl"
        style={{ background: option.blobB, opacity: 0.7 }}
      />
      <div
        className="absolute inset-y-1.5 left-1.5 w-7 rounded-lg"
        style={{ background: option.panel }}
      />
    </div>
  );
}

export function AppearanceDialog({
  open,
  onClose,
  appearance,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  appearance: Appearance;
  onChange: (value: Appearance) => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close appearance settings"
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-card-border bg-background p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Appearance
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-foreground"
          >
            <CloseIcon className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {OPTIONS.map((option) => {
            const selected = appearance === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange(option.id)}
                aria-pressed={selected}
                className={`flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${
                  selected
                    ? "border-[#ff6791]"
                    : "border-card-border hover:border-[#ff6791]/50"
                }`}
              >
                <div className="w-24 shrink-0">
                  <Swatch option={option} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {option.name}
                  </p>
                  <p className="text-xs text-muted">{option.description}</p>
                </div>
                {selected && (
                  <CheckCircleIcon className="h-5 w-5 shrink-0 text-[#ff6791]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
