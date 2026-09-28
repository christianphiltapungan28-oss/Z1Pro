"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";

export type Appearance = "light" | "aurora";

const STORAGE_KEY = "theme";

// The saved theme lives in localStorage; this hook subscribes to it as an
// external store. The server snapshot is always "light", so the first client
// render matches the server-rendered markup (no hydration mismatch) and React
// then switches to the saved value.
const listeners = new Set<() => void>();
// Used when storage is blocked (e.g. some private modes), for this visit.
let unsaved: Appearance | null = null;

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange); // other tabs
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(): Appearance {
  if (unsaved) return unsaved;
  try {
    return localStorage.getItem(STORAGE_KEY) === "aurora" ? "aurora" : "light";
  } catch {
    return "light";
  }
}

export function useAppearance() {
  const appearance = useSyncExternalStore(subscribe, read, () => "light" as const);

  // Also re-applies the attribute after React's dev-mode Strict remount
  // clears the one the inline script in <head> set.
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", appearance);
  }, [appearance]);

  function setAppearance(next: Appearance) {
    try {
      localStorage.setItem(STORAGE_KEY, next);
      unsaved = null;
    } catch {
      unsaved = next;
    }
    document.documentElement.setAttribute("data-theme", next);
    listeners.forEach((notify) => notify());
  }

  return { appearance, setAppearance };
}
