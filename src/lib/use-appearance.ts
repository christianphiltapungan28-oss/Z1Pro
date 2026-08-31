"use client";

import { useLayoutEffect, useState } from "react";

export type Appearance = "light" | "aurora";

const STORAGE_KEY = "theme";

function resolveInitial(): Appearance {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "aurora") {
    return stored;
  }
  return "light";
}

export function useAppearance() {
  const [appearance, setAppearanceState] = useState<Appearance>(resolveInitial);

  // Re-apply after React's dev-mode Strict remount clears the attribute the
  // inline script in <head> set. No-op in production.
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", appearance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setAppearance(next: Appearance) {
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.setAttribute("data-theme", next);
    setAppearanceState(next);
  }

  return { appearance, setAppearance };
}
