"use client";

import { BellIcon, LogoIcon, MenuIcon, MicIcon, PaletteIcon } from "@/components/icons";
import type { Appearance } from "@/lib/use-appearance";

const SWATCH: Record<Appearance, string> = {
  light: "linear-gradient(135deg, #ffc9d6, #bcd4ff)",
  aurora: "linear-gradient(135deg, #ff0022, #0021d5)",
};

export function Topbar({
  voiceMode,
  onVoiceModeChange,
  onMenuClick,
  appearance,
  onOpenAppearance,
}: {
  voiceMode: boolean;
  onVoiceModeChange: (value: boolean) => void;
  onMenuClick: () => void;
  appearance: Appearance;
  onOpenAppearance: () => void;
}) {
  return (
    <header className="flex items-center justify-between px-4 py-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 hover:text-foreground md:hidden"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <LogoIcon className="h-6 w-6" />
        <span className="font-display text-lg font-semibold text-foreground">
          Z1P.pro
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => onVoiceModeChange(!voiceMode)}
          aria-pressed={voiceMode}
          className="hidden items-center gap-2 rounded-full border border-card-border py-1 pl-3 pr-1 sm:flex"
        >
          <span className="text-sm font-medium text-foreground/80">
            Voice Mode
          </span>
          <span className="rounded-full bg-[#ffc3cf] px-1.5 py-0.5 text-[10px] font-semibold text-[#8a2745]">
            New
          </span>
          <span
            className={`relative h-5 w-9 rounded-full transition-colors ${
              voiceMode ? "bg-[#ff6791]" : "bg-foreground/15"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left,right] ${
                voiceMode ? "right-0.5" : "left-0.5"
              }`}
            />
          </span>
        </button>

        <button
          type="button"
          onClick={() => onVoiceModeChange(!voiceMode)}
          aria-pressed={voiceMode}
          className={`flex h-9 w-9 items-center justify-center rounded-full border border-card-border transition-colors sm:hidden ${
            voiceMode ? "bg-[#ff6791] text-white" : "text-foreground/70"
          }`}
          aria-label="Toggle voice mode"
        >
          <MicIcon className="h-4.5 w-4.5" />
        </button>

        <button
          type="button"
          aria-label="Notifications"
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 hover:text-foreground"
        >
          <BellIcon className="h-4.5 w-4.5" />
        </button>

        <button
          type="button"
          onClick={onOpenAppearance}
          aria-label="Appearance settings"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-card-border text-foreground/70 transition-colors hover:text-foreground"
        >
          <span
            className="flex h-4.5 w-4.5 items-center justify-center rounded-full"
            style={{ background: SWATCH[appearance] }}
          >
            <PaletteIcon className="h-3 w-3 text-white/90" />
          </span>
        </button>
      </div>
    </header>
  );
}
