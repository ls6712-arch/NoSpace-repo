import type { Transition } from "motion/react";

/**
 * The motion system (core loop v1, §2.3; one vocabulary since Nov 8, 2026).
 * Every animation in the app is one of the movements below and uses its value;
 * nothing invents its own spring, duration or curve. `npm run lint` fails on a
 * raw spring or duration anywhere else. Two places keep their own physics on
 * purpose: Stubby (a character moves like a character) and the public landing
 * page (src/app/landing).
 *
 * | Movement   | When                                        | Value                    |
 * |------------|---------------------------------------------|--------------------------|
 * | Press      | anything tappable                           | press, PRESS_SCALE       |
 * | Pop        | choosing: chips, reactions, I'm going       | pop                      |
 * | Enter/exit | screens, sections, lists, backdrops         | page, exit, staggerDelay |
 * | Sheet      | bottom sheets                               | sheet                    |
 * | Swipe away | anything that rises from the bottom         | DISMISS_*, settle        |
 * | Fuse       | anything with Undo, and every toast         | fuse(ms)                 |
 * | Grow into  | a card becoming its page, a tab pill        | shared                   |
 * | Roll       | any number that changes                     | <RollNumber> (pop)       |
 * | Reward     | earning a Stub, and nothing else            | reward, rewardLight, foil|
 *
 * Only `transform` and `opacity` are animated. `<MotionConfig
 * reducedMotion="user">` in App.tsx drops transforms for people who ask for
 * less motion, so everything here degrades to opacity only.
 */

/** Mirrors --duration-fast, --duration-base and --ease-standard in theme.css (checked by the test). */
export const DURATION_FAST = 0.15;
export const DURATION_BASE = 0.25;
export const EASE_STANDARD = [0.22, 0.61, 0.36, 1] as const;

/** Every tappable: scale to PRESS_SCALE on this spring. */
export const press = { type: "spring", stiffness: 500, damping: 30 } satisfies Transition;
export const PRESS_SCALE = 0.97;
export const HOVER_SCALE = 1.02;

/** Chips selecting, the "I’m in" morph, a reaction, a ring completing. */
export const pop = { type: "spring", stiffness: 420, damping: 22 } satisfies Transition;

/** Bottom sheets, Log, Make it a Pursuit. */
export const sheet = { type: "spring", stiffness: 380, damping: 36 } satisfies Transition;

/** A dragged thing let go short of dismissing: it springs back to rest. */
export const settle = { type: "spring", stiffness: 260, damping: 30 } satisfies Transition;

/** Screen, section, backdrop and list entry: --duration-base on the one curve, opacity 0 to 1, y 12 to 0. */
export const page = { duration: DURATION_BASE, ease: EASE_STANDARD } satisfies Transition;
export const PAGE_FROM = { opacity: 0, y: 12 } as const;
export const PAGE_TO = { opacity: 1, y: 0 } as const;

/** Something leaving, or a quick state change: --duration-fast. */
export const exit = { duration: DURATION_FAST, ease: EASE_STANDARD } satisfies Transition;

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
/** A toast is a fifth of a sheet's height, so a slow drag needs less travel. The flick speed is the same. */
export const TOAST_DISMISS_OFFSET = 40;

/** How long a plain toast stays; an Undo toast stays for UNDO_MS (lib/undo.ts). */
export const TOAST_MS = 2500;

/** The fuse: a line that burns down at an even speed over the time left. */
export const fuse = (ms: number) => ({ duration: ms / 1000, ease: "linear" }) satisfies Transition;

/** Reward: a Stub landing after it is earned. Nothing else in the app uses these three. */
export const reward = { type: "spring", stiffness: 260, damping: 16 } satisfies Transition;
/** Reward: the line of light the Stub is printed from. */
export const rewardLight = { duration: 0.9, ease: [0.2, 0.8, 0.2, 1] } satisfies Transition;
/** Reward: the foil sweep across a finished or numbered Stub, every few seconds. */
export const foil = { duration: 1.6, ease: "easeInOut", repeat: Infinity, repeatDelay: 3 } satisfies Transition;

/** Short buzz for join, post and stub reveal. Never call it on scroll. */
export function haptic(ms = 10): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Some browsers throw when vibrate is called without a user gesture.
  }
}
