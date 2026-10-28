import { forwardRef, type ComponentProps } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { cn } from "./utils";
import { PRESS_SCALE, pop, press } from "../../lib/motionTokens";

const VARIANTS = {
  /** The one primary action on a screen. */
  primary: "bg-accent text-accent-foreground",
  /** Light pill on dark surfaces: "Log pasta #2", the context action on a Moment. */
  light: "bg-foreground text-background",
  outline: "border border-foreground/30 bg-transparent text-foreground",
  /** On an accent card: dark pill with light text. */
  ink: "bg-[var(--ink)] text-[var(--photo-text)]",
} as const;

export type PillVariant = keyof typeof VARIANTS;

/**
 * Full-pill action (core loop v1, §2.1). Presses on the `press` spring. Set
 * `done` to morph the label into a check with `pop` (the "I'm in" and Join
 * buttons); the label comes back when `done` clears. 44px tall at least.
 */
export const PillButton = forwardRef<
  HTMLButtonElement,
  Omit<ComponentProps<typeof motion.button>, "children"> & {
    variant?: PillVariant;
    done?: boolean;
    /** Label shown once `done`; defaults to the check alone. */
    doneLabel?: string;
    children: React.ReactNode;
  }
>(function PillButton({ variant = "primary", done = false, doneLabel, className, children, disabled, ...props }, ref) {
  return (
    <motion.button
      ref={ref}
      type="button"
      whileTap={disabled ? undefined : { scale: PRESS_SCALE }}
      transition={press}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 text-body font-semibold outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {done ? (
          <motion.span
            key="done"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={pop}
            className="inline-flex items-center gap-2"
          >
            <Check className="size-5" strokeWidth={2.25} aria-hidden="true" />
            {doneLabel}
          </motion.span>
        ) : (
          <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={pop} className="inline-flex items-center gap-2">
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
});
