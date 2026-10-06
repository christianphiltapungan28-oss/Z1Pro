"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Returns how loud Z1p's voice is right now, 0–1, or null if unknown. */
export type LevelSource = () => number | null;

// How fast the orb's colours turn, as a multiple of their base speed.
const IDLE_SPEED = 0.7;
const ACTIVE_SPEED = 1.8;
// Extra speed at full voice level.
const LEVEL_BOOST = 2.2;

// At rest the orb breathes softly (level 0.05–0.35 over ~4s).
function idleLevel(now: number) {
  return 0.2 + 0.15 * Math.sin(now / 650);
}

/**
 * Drives the orb's motion by setting two CSS variables on `ref`, once a
 * frame: `--orb-turn` (how far its colours have turned, in seconds of base
 * speed) and `--orb-level` (0–1, how strongly it pulses).
 *
 * The orb always drifts slowly. While `active` (Z1p thinking or speaking)
 * it speeds up and pulses: to the voice's loudness when `getLevel` gives one,
 * otherwise to a steady "thinking" rhythm. Speed and pulse ease between
 * states so the orb never jumps. Stays still for reduced motion.
 */
export function useOrbMotion(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  getLevel?: LevelSource,
) {
  const activeRef = useRef(active);
  const getLevelRef = useRef(getLevel);
  useEffect(() => {
    activeRef.current = active;
    getLevelRef.current = getLevel;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let turn = 0;
    let speed = IDLE_SPEED;
    let level = 0;
    let last = performance.now();
    let frame = requestAnimationFrame(tick);

    function tick(now: number) {
      // Cap the step so a backgrounded tab doesn't lurch when it returns.
      const dt = Math.min(now - last, 100) / 1000;
      last = now;

      const on = activeRef.current;
      const voice = on ? (getLevelRef.current?.() ?? null) : idleLevel(now);
      const target = voice ?? 0.55 + 0.4 * Math.sin(now / 260);
      // Voice rises fast and falls a little slower, like a level meter.
      const ease = target > level ? 18 : 8;
      level += (target - level) * (1 - Math.exp(-dt * ease));

      const targetSpeed = on ? ACTIVE_SPEED + level * LEVEL_BOOST : IDLE_SPEED + level * 0.6;
      speed += (targetSpeed - speed) * (1 - Math.exp(-dt * 3));
      turn += speed * dt;

      el!.style.setProperty("--orb-turn", turn.toFixed(4));
      el!.style.setProperty("--orb-level", level.toFixed(3));
      frame = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(frame);
  }, [ref]);
}
