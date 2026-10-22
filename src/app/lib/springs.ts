import type { Transition } from "motion/react";

/**
 * Springs for anything a finger touches: presses, sheets, drags. The after-
 * hours direction allows spring physics for gestures only. Ambient motion
 * (reveals, hovers) stays on the calm CSS tokens (--duration-*, --ease-
 * standard), and `<MotionConfig reducedMotion="user">` in App.tsx switches
 * every transform animation off for people who ask for less motion.
 */
export const springs = {
  /** A card or tile under the thumb: quick, no wobble. */
  press: { type: "spring", stiffness: 520, damping: 34, mass: 0.8 },
  /** A sheet or panel settling into place. */
  sheet: { type: "spring", stiffness: 380, damping: 36 },
  /** A dragged thing snapping back. */
  settle: { type: "spring", stiffness: 260, damping: 30 },
} satisfies Record<string, Transition>;

/** How far a pressed card gives. Small: a press, not a bounce. */
export const PRESS_SCALE = 0.97;
