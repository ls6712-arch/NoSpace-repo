import type { Transition } from "motion/react";
import { HOVER_SCALE, PRESS_SCALE, press, sheet } from "./motionTokens";

/**
 * Older name for the tokens in motionTokens.ts, kept so existing components
 * keep importing from here. New code imports motionTokens directly.
 * `settle` (a dragged thing snapping back) is the one value that is not a
 * motion token and is used only by the Corners rows.
 */
export const springs = {
  press,
  sheet,
  settle: { type: "spring", stiffness: 260, damping: 30 },
} satisfies Record<string, Transition>;

export { HOVER_SCALE, PRESS_SCALE };
