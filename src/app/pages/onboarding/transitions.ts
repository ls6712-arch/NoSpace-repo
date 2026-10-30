import type { Variants } from "motion/react";
import { PAGE_FROM } from "../../lib/motionTokens";

/** Between screens the old one slides 24px away and the new one comes in from the other side (reduced motion: opacity only). */
export const SLIDE = 24;
export const slide: Variants = {
  enter: (dir: number) => (dir === 0 ? PAGE_FROM : { opacity: 0, x: dir * SLIDE }),
  center: { opacity: 1, x: 0, y: 0 },
  exit: (dir: number) => ({ opacity: 0, x: -dir * SLIDE }),
};
