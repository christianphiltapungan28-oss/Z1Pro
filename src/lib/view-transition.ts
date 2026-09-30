import { flushSync } from "react-dom";

/**
 * The orb on Home and the orb in voice mode share this view-transition name,
 * so going between them the orb glides from one spot to the other while the
 * rest of the screen cross-fades (timings in globals.css).
 */
export const ORB_TRANSITION = "z1p-orb";

/**
 * Applies a React state change as a view transition where the browser has
 * them (Chrome, Edge, Safari 18+), and instantly otherwise or for reduced
 * motion.
 */
export function withViewTransition(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (!doc.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    update();
    return;
  }
  // The new screen must be rendered before the browser takes its snapshot.
  doc.startViewTransition(() => flushSync(update));
}
