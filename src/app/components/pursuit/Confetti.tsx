import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";

const COUNT = 24;

/**
 * A light amber burst of 24 pieces, once, from the top of the screen. Skipped
 * under reduced motion. Pieces animate only transform and opacity.
 */
export function Confetti() {
  const reduced = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => {
        // Spread evenly with a little deterministic scatter, so a rerender never changes it.
        const angle = (i / COUNT) * Math.PI * 2;
        const dist = 120 + ((i * 37) % 90);
        return {
          x: Math.cos(angle) * dist * 1.4,
          y: Math.abs(Math.sin(angle)) * dist + 140 + ((i * 53) % 120),
          r: ((i * 71) % 360) - 180,
          delay: (i % 6) * 0.02,
          w: 6 + (i % 3) * 2,
        };
      }),
    [],
  );
  if (reduced) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-24 z-40 flex justify-center">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, rotate: p.r, scale: 0.8 }}
          transition={{ duration: 1.3, delay: p.delay, ease: "easeOut" }}
          className="absolute h-3 rounded-full bg-[var(--cat-amber)]"
          style={{ width: p.w }}
        />
      ))}
    </div>
  );
}
