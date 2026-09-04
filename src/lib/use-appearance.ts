"use client";

import { useLayoutEffect, useState } from "react";

export type Appearance = "light" | "aurora";

const STORAGE_KEY = "theme";

export function useAppearance() {
  // Always start at "light" so this matches the server-rendered markup —
  // reading localStorage here would run during the client's first render
  // and disagree with SSR, causing a hydration mismatch. The real value is
  // synced in the layout effect below (which also re-applies it after
  // React's dev-mode Strict remount clears the attribute the inline script
  // in <head> set).
  const [appearance, setAppearanceState] = useState<Appearance>("light");

  useLayoutEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const resolved: Appearance = stored === "aurora" ? "aurora" : "light";
    document.documentElement.setAttribute("data-theme", resolved);
    setAppearanceState(resolved);
  }, []);

  function setAppearance(next: Appearance) {
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.setAttribute("data-theme", next);
    setAppearanceState(next);
  }

  return { appearance, setAppearance };
}
