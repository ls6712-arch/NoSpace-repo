import type { ComponentProps } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { PRESS_SCALE, springs } from "../../lib/springs";

const MotionLink = motion.create(Link);

/**
 * A router Link that gives a little under the thumb (spring press scale).
 * Use it for tappable cards and tiles; the lift on hover stays CSS.
 */
export function PressLink(props: ComponentProps<typeof MotionLink>) {
  return <MotionLink whileTap={{ scale: PRESS_SCALE }} transition={springs.press} {...props} />;
}
