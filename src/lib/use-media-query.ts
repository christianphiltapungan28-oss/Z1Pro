"use client";

import { useSyncExternalStore } from "react";

/**
 * True while the CSS media query matches. On the server (and the first
 * client render) it returns `serverValue`, so markup stays consistent.
 */
export function useMediaQuery(query: string, serverValue = false) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
