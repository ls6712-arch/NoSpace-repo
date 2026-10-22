/**
 * Fade-and-rise reveal, from Magic UI's BlurFade
 * (https://github.com/magicuidesign/magicui, MIT, registry/magicui/blur-fade.tsx).
 * Copied in and adapted: it takes the theme's calm timing (no spring), skips
 * the blur and the move entirely under reduced motion, and drops the
 * "use client" pragma and the exit animation this app never uses.
 */
import { useRef, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";

interface BlurFadeProps {
  children: ReactNode;
  className?: string;
  /** Seconds. Stagger a list by passing index * 0.04. */
  delay?: number;
  duration?: number;
  /** Pixels the content rises from. */
  offset?: number;
  blur?: string;
  /** Wait until the element scrolls into view. */
  inView?: boolean;
  inViewMargin?: string;
}

export function BlurFade({
  children,
  className,
  delay = 0,
  duration = 0.4,
  offset = 8,
  blur = "6px",
  inView = false,
  inViewMargin = "-50px",
}: BlurFadeProps) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const seen = useInView(ref, { once: true, margin: inViewMargin as never });
  const show = !inView || seen;

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      initial={{ y: offset, opacity: 0, filter: `blur(${blur})` }}
      animate={show ? { y: 0, opacity: 1, filter: "blur(0px)" } : undefined}
      transition={{ delay: 0.04 + delay, duration, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
