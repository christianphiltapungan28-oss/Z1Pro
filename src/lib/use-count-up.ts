"use client";

import { useEffect, useState } from "react";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Fast at first, settling gently onto the final number.
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * Counts from 0 up to `target` over `duration` ms, starting after `delay`
 * ms, each time the component mounts or `target` changes. Used to fill the
 * Life Metrics gauge and bars so they grow to the user's scores. Returns
 * the target straight away for reduced motion.
 */
export function useCountUp(target: number, { duration = 1200, delay = 0 } = {}) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));

  useEffect(() => {
    if (prefersReducedMotion()) {
      const frame = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(frame);
    }
    let frame = 0;
    let start: number | null = null;
    function tick(now: number) {
      start ??= now + delay;
      const t = Math.min(Math.max((now - start) / duration, 0), 1);
      setValue(target * easeOutCubic(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, delay]);

  return value;
}
