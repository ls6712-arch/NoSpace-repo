import type { Transition } from "motion/react";
import { HOVER_SCALE, PRESS_SCALE, press, settle, sheet } from "./motionTokens";

/**
 * Older name for the tokens in motionTokens.ts, kept so existing components
 * keep importing from here. New code imports motionTokens directly.
 */
export const springs = { press, sheet, settle } satisfies Record<string, Transition>;

export { HOVER_SCALE, PRESS_SCALE };
