import type { LucideIcon } from "lucide-react";
import { cn } from "./utils";

/**
 * The art for a tile with no photo (core loop v1, §2.2): the category's line
 * icon at 22% ink, rotated 15 degrees and bleeding off the corner. Sits behind
 * the tile's text, which must be ink on the category colour. Decorative.
 */
export function TiltedIcon({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <Icon
      aria-hidden="true"
      strokeWidth={1.75}
      className={cn("pointer-events-none absolute -top-3 -right-4 size-24 rotate-[15deg] text-[var(--ink)] opacity-[0.22]", className)}
    />
  );
}
