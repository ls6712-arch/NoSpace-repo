import type { ComponentProps } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { HOVER_SCALE, PRESS_SCALE, springs } from "../../lib/springs";

const MotionLink = motion.create(Link);

/**
 * A router Link that gives under the thumb (press to 0.97) and grows a touch
 * under a mouse (hover to 1.02), both on the same spring. No lift shadow.
 */
export function PressLink(props: ComponentProps<typeof MotionLink>) {
  return <MotionLink whileTap={{ scale: PRESS_SCALE }} whileHover={{ scale: HOVER_SCALE }} transition={springs.press} {...props} />;
}
