import type { Transition } from "motion/react";

/**
 * Springs for anything a finger touches (spec v1): a press scales to
 * PRESS_SCALE, a hover (desktop) to HOVER_SCALE, both on the same spring.
 * Ambient motion (the entry reveal) is a plain 280ms ease-out in Reveal.tsx.
 * `<MotionConfig reducedMotion="user">` in App.tsx drops every transform for
 * people who ask for less motion, leaving opacity only.
 */
export const springs = {
  press: { type: "spring", stiffness: 500, damping: 30 },
  /** A sheet or panel settling into place. */
  sheet: { type: "spring", stiffness: 380, damping: 36 },
  /** A dragged thing snapping back. */
  settle: { type: "spring", stiffness: 260, damping: 30 },
} satisfies Record<string, Transition>;

export const PRESS_SCALE = 0.97;
export const HOVER_SCALE = 1.02;
