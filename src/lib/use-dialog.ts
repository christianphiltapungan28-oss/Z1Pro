"use client";

import { useEffect, useRef } from "react";

/**
 * Keyboard and focus behaviour for a modal dialog: moves focus into the
 * panel when it opens, closes on Escape, and hands focus back to whatever
 * opened it on close. Attach the returned ref to the panel element, which
 * should also carry role="dialog", aria-modal and tabIndex={-1}.
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose: () => void
) {
  const panelRef = useRef<T>(null);
  // Callers usually pass an inline arrow; keeping it in a ref stops every
  // parent re-render from re-running the effect and stealing focus back.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    panelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus();
    };
  }, [open]);

  return panelRef;
}
