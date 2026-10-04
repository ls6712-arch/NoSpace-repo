/**
 * The app's motion tokens for JS animation (the `motion` library), matching
 * the CSS ones in theme.css: two durations and one curve.
 *
 * - fast (150ms): state changes, presses, anything leaving
 * - base (250ms): things arriving (dialogs, sheets, cards, page steps)
 *
 * No springs and no bounce anywhere: everything settles on the same curve.
 */
export const DURATION_FAST = 0.15;
export const DURATION_BASE = 0.25;
export const EASE_STANDARD = [0.22, 0.61, 0.36, 1] as const;

/** Something arriving or moving into place. */
export const ENTER = { duration: DURATION_BASE, ease: EASE_STANDARD };
/** Something leaving, or a quick state change. */
export const EXIT = { duration: DURATION_FAST, ease: EASE_STANDARD };
