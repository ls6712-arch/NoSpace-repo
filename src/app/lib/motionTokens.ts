import type { Transition } from "motion/react";

/**
 * The motion system (core loop v1, §2.3). Every animation in the app uses one
 * of these values; nothing invents its own spring or duration.
 *
 * Only `transform` and `opacity` are animated. `<MotionConfig
 * reducedMotion="user">` in App.tsx drops transforms for people who ask for
 * less motion, so everything here degrades to opacity only.
 */

/** Every tappable: scale to PRESS_SCALE on this spring. */
export const press = { type: "spring", stiffness: 500, damping: 30 } satisfies Transition;
export const PRESS_SCALE = 0.97;
export const HOVER_SCALE = 1.02;

/** Chips selecting, the "I'm in" morph, a cheer. */
export const pop = { type: "spring", stiffness: 420, damping: 22 } satisfies Transition;

/** Bottom sheets, Log, Make it a Pursuit. */
export const sheet = { type: "spring", stiffness: 380, damping: 36 } satisfies Transition;

/** Screen and section entry: 280ms ease-out, opacity 0 to 1, y 12 to 0. */
export const page = { duration: 0.28, ease: "easeOut" } satisfies Transition;
export const PAGE_FROM = { opacity: 0, y: 12 } as const;
export const PAGE_TO = { opacity: 1, y: 0 } as const;

/** Seconds between items of a list or grid entering. */
export const STAGGER = 0.04;
/** Past this many items the delay stops growing, so a long list never waits. */
export const STAGGER_CAP = 10;
export const staggerDelay = (index: number) => Math.min(index, STAGGER_CAP) * STAGGER;

/** `layoutId` transitions: a card's photo becoming the detail hero, a pill sliding between tabs. */
export const shared = { type: "spring", stiffness: 350, damping: 32 } satisfies Transition;

/** A dragged sheet is dismissed past this offset (px) or this downward velocity (px/s). */
export const DISMISS_OFFSET = 120;
export const DISMISS_VELOCITY = 500;

/** Short buzz for join, post and stub reveal. Never call it on scroll. */
export function haptic(ms = 10): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Some browsers throw when vibrate is called without a user gesture.
  }
}
