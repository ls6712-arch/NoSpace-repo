import { useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { pop } from "../../lib/motionTokens";

/**
 * A number that rolls vertically when it changes: up when it grows, down when
 * it shrinks (goal stepper, reaction count, stub count). Reserves the width of
 * the widest digit string so neighbours do not shift.
 */
export function RollNumber({ value, className }: { value: number; className?: string }) {
  const previous = useRef(value);
  const dir = value >= previous.current ? 1 : -1;
  previous.current = value;
  return (
    <span style={{ clipPath: "inset(0)" }}
      className={`relative inline-flex tabular-nums ${className ?? ""}`} aria-label={String(value)}>
      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.span
          key={value}
          custom={dir}
          aria-hidden="true"
          initial={{ y: `${dir * 100}%`, opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: `${dir * -100}%`, opacity: 0 }}
          transition={pop}
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
