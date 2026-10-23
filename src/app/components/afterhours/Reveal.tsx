import { useRef, type ReactNode } from "react";
import { motion, useInView } from "motion/react";

/**
 * Entry reveal (spec v1): fade from 0 to 1 and rise 12px over 280ms, ease-out,
 * once only. Stagger a list by passing each item's `index` (40ms apart).
 * Under reduced motion `<MotionConfig reducedMotion="user">` removes the rise
 * and leaves the fade.
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
      initial={{ opacity: 0, y: 12 }}
      animate={seen ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.28, ease: "easeOut", delay: index * 0.04 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
