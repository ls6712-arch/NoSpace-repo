import { forwardRef, type ComponentProps } from "react";
import { motion } from "motion/react";
import { cn } from "./utils";
import { PRESS_SCALE, pop, press } from "../../lib/motionTokens";

/**
 * A selectable chip (moods, filters). Off: surface fill. On: accent fill with
 * ink text. Selecting pops the chip with the `pop` spring. 44px tall at least,
 * so it is a real touch target.
 */
export const Chip = forwardRef<
  HTMLButtonElement,
  Omit<ComponentProps<typeof motion.button>, "children"> & { selected?: boolean; children: React.ReactNode }
>(function Chip({ selected = false, className, children, ...props }, ref) {
  return (
    <motion.button
      ref={ref}
      type="button"
      aria-pressed={selected}
      whileTap={{ scale: PRESS_SCALE }}
      animate={{ scale: selected ? [1, 1.06, 1] : 1 }}
      transition={{ scale: selected ? pop : press }}
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-full px-4 text-small font-semibold outline-none select-none transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        selected ? "bg-accent text-accent-foreground" : "bg-[var(--surface-raised,var(--card))] text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
});
