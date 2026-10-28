import { useRef, type ReactNode } from "react";
import { motion, useInView } from "motion/react";
import { PAGE_FROM, PAGE_TO, page, staggerDelay } from "../../lib/motionTokens";

/**
 * Entry reveal (`page` token): fade from 0 to 1 and rise 12px over 280ms,
 * ease-out, once only. Stagger a list by passing each item's `index` (40ms
 * apart). Under reduced motion `<MotionConfig reducedMotion="user">` removes
 * the rise and leaves the fade.
 */
export function Reveal({
  children,
  className,
  index = 0,
}: {
  children: ReactNode;
  className?: string;
  index?: number;
}) {
  const ref = useRef(null);
  const seen = useInView(ref, { once: true, margin: "-40px" as never });
  return (
    <motion.div
      ref={ref}
      initial={PAGE_FROM}
      animate={seen ? PAGE_TO : undefined}
      transition={{ ...page, delay: staggerDelay(index) }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
