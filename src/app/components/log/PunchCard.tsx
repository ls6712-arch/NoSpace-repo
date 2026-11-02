import { motion, useReducedMotion } from "motion/react";
import { pop } from "../../lib/motionTokens";

/**
 * A punch card: one hole per day (or Moment) toward a Stub. Filled holes are
 * done; with `fresh`, the last filled hole is the one this Moment just punched
 * and pops in; with `next`, the hole this Moment would punch pulses (the Log
 * preview). Numbers come from lib/punchCards.ts, never from here.
 */
export function PunchHoles({
  done,
  total,
  fresh = false,
  next = false,
  size = "md",
}: {
  done: number;
  total: number;
  fresh?: boolean;
  next?: boolean;
  size?: "sm" | "md";
}) {
  const reduce = useReducedMotion();
  const dot = size === "sm" ? "size-3" : "size-full";
  return (
    <span
      aria-hidden="true"
      className={size === "sm" ? "flex shrink-0 gap-1" : "grid flex-1 gap-2.5"}
      style={size === "sm" ? undefined : { gridTemplateColumns: `repeat(${Math.min(total, 5)}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: total }, (_, i) => {
        const filled = i < done;
        const isFresh = fresh && i === done - 1;
        const isNext = next && i === done;
        return (
          <span key={i} className={size === "sm" ? "" : "flex aspect-square"}>
            {filled ? (
              <motion.span
                className={`block rounded-full bg-foreground ${dot}`}
                initial={isFresh && !reduce ? { scale: 0, opacity: 0 } : false}
                animate={{ scale: 1, opacity: 1 }}
                transition={isFresh ? { ...pop, delay: 0.5 } : undefined}
              />
            ) : (
              <span
                className={`block rounded-full border-dashed ${dot} ${
                  isNext ? "border-[2.5px] border-[var(--accent-text)] motion-safe:animate-pulse" : "border-2 border-[var(--border)]"
                }`}
              />
            )}
          </span>
        );
      })}
    </span>
  );
}

/** The ticket-shaped card on Posted: the Stub's name on the stub end, the holes on the rest. */
export function PunchCard({
  label,
  done,
  total,
  fresh,
  ariaLabel,
}: {
  label: string;
  done: number;
  total: number;
  fresh: boolean;
  ariaLabel: string;
}) {
  return (
    <div role="img" aria-label={ariaLabel} className="flex w-full overflow-hidden rounded-card border-2 border-foreground bg-card">
      <div className="flex w-20 shrink-0 items-center justify-center border-r-2 border-dashed border-foreground bg-accent px-2 text-center text-caption font-bold text-accent-foreground">
        {label}
      </div>
      <div className="flex flex-1 p-4">
        <PunchHoles done={done} total={total} fresh={fresh} />
      </div>
    </div>
  );
}
