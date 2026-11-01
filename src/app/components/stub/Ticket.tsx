import { useEffect, useState, type CSSProperties } from "react";
import { motion } from "motion/react";
import { BadgeCheck } from "lucide-react";
import { RollNumber } from "../ui/RollNumber";
import { cn } from "../ui/utils";
import { haptic, pop, shared } from "../../lib/motionTokens";

export type TicketVariant = "event" | "finish" | "drop" | "regular";

const STUB_WIDTH = 88; // px, the right-hand count
const WIDE_STUB_WIDTH = 124; // px, when the total has two digits ("10/10")
const COMPACT_STUB_WIDTH = 14; // px, the narrow tear-off edge on a grid tile
const NOTCH = 9; // px, radius of the perforation cut-outs

const GOLD = "#D7A03D"; // design-token-ignore: Finisher stub colour from the visual spec (the amber category colour, fixed in both themes)

/**
 * A Stub as a ticket (core loop v1, §2.2). The body takes the category colour;
 * a notched perforation (CSS mask, no image) and a dashed divider split off
 * the count on the right. Text on it is always ink.
 *
 * - `event`: confirmed by a host (shows the check).
 * - `finish`: a finished Pursuit, amber with a slow foil sweep.
 * - `drop`: a drop finished inside its window; the foil sweep on its Corner colour.
 * - `regular`: one Corner on 10 different days in a month.
 * (Each kind's own material arrives with the Stub look PR; these are the interim faces.)
 *
 * `reveal` plays the Posted moment: the ticket drops in 40px on `pop`, the
 * perforation draws in 120ms, then the count rolls up by one.
 */
export function Ticket({
  variant = "regular",
  serial,
  title,
  meta,
  count,
  color = "var(--cat-orange)",
  reveal = false,
  layoutId,
  compact = false,
  className,
}: {
  variant?: TicketVariant;
  /** Position among this person's Stubs; shown as "Stub 014". Unknown while the database is still issuing it: the line reads "Stub". */
  serial?: number;
  title: string;
  meta?: string;
  /** "2/5": `done` of `total`. */
  count?: { done: number; total: number };
  /** Any CSS colour; ignored for gold. */
  color?: string;
  reveal?: boolean;
  /** Shared-element id so a tile in a grid can become the full-screen stub. */
  layoutId?: string;
  /** A small tile for a grid: the perforation sits near the right edge and there is no count. */
  compact?: boolean;
  className?: string;
}) {
  const [shown, setShown] = useState(count ? (reveal ? Math.max(0, count.done - 1) : count.done) : 0);
  useEffect(() => {
    if (!count) return;
    if (!reveal) {
      setShown(count.done);
      return;
    }
    const t = window.setTimeout(() => setShown(count.done), 520);
    haptic();
    return () => window.clearTimeout(t);
  }, [count, reveal]);

  const stubWidth = compact ? COMPACT_STUB_WIDTH : count && String(count.total).length >= 2 ? WIDE_STUB_WIDTH : STUB_WIDTH;
  const x = `calc(100% - ${stubWidth}px)`;
  // design-token-ignore: mask colours only set alpha; they are never painted
  const notch = (y: string) => `radial-gradient(circle ${NOTCH}px at ${x} ${y}, #0000 98%, #000)`;
  const style = {
    background: variant === "finish" ? GOLD : color,
    WebkitMask: `${notch("0")}, ${notch("100%")}`,
    mask: `${notch("0")}, ${notch("100%")}`,
    WebkitMaskComposite: "source-in",
    maskComposite: "intersect",
  } as CSSProperties;

  return (
    <motion.div
      layoutId={layoutId}
      transition={layoutId ? shared : pop}
      // A ticket that grows out of a photo (layoutId) moves with the shared spring instead of dropping in.
      initial={reveal && !layoutId ? { opacity: 0, y: -40 } : false}
      animate={{ opacity: 1, y: 0 }}
      style={style}
      className={cn("relative flex min-h-28 w-full overflow-hidden rounded-card text-[var(--ink)]", className)}
    >
      <div className={cn("flex min-w-0 flex-1 flex-col justify-between gap-2", compact ? "p-3" : "p-4")}>
        <span className="text-caption font-semibold tracking-[0.08em] opacity-80">
          {serial ? `Soosh · Stub ${String(serial).padStart(3, "0")}` : "Soosh · Stub"}
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-[family-name:var(--font-display)] text-lead leading-tight font-extrabold">
            <span className="truncate">{title}</span>
            {variant === "event" && <BadgeCheck className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />}
          </p>
          {meta && (
            <p className="mt-1 line-clamp-2 text-small opacity-80" title={meta}>
              {meta}
            </p>
          )}
        </div>
      </div>

      <motion.span
        aria-hidden="true"
        initial={reveal ? { scaleY: 0 } : false}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.12, delay: reveal ? 0.3 : 0, ease: "linear" }}
        style={{ right: stubWidth, transformOrigin: "top" }}
        className="absolute inset-y-3 border-l-2 border-dashed border-[var(--ink)]/35"
      />

      {count && !compact && (
        <div style={{ width: stubWidth }} className="flex shrink-0 items-center justify-center font-[family-name:var(--font-display)] text-display leading-none font-extrabold">
          <span className="sr-only">
            {count.done} of {count.total}
          </span>
          <span aria-hidden="true" className="flex items-baseline">
            <RollNumber value={shown} />
            <span>/{count.total}</span>
          </span>
        </div>
      )}

      {(variant === "finish" || variant === "drop") && (
        <motion.span
          aria-hidden="true"
          initial={{ x: "-120%" }}
          animate={{ x: "420%" }}
          transition={{ duration: 1.6, ease: "easeInOut", repeat: Infinity, repeatDelay: 3 }}
          className="pointer-events-none absolute inset-y-0 left-0 w-1/4 -skew-x-12 bg-gradient-to-r from-transparent via-[var(--photo-text)]/45 to-transparent"
        />
      )}
    </motion.div>
  );
}
