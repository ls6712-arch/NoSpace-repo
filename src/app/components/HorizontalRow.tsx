import type { ReactNode } from "react";
import { useRowScrollMemory } from "../lib/useHistoryState";

/**
 * A row of cards that scrolls sideways with scroll-snap and no visible
 * scrollbar. It runs to the page edge (16px gutter on a phone, 32px from md)
 * and cards have a fixed width, so the last one is cut off to show there is
 * more. Same frame as Discover's "Start here" row.
 */
export function HorizontalRow({
  name,
  label,
  children,
}: {
  /** Scroll position is remembered per name when going back. */
  name: string;
  label: string;
  children: ReactNode;
}) {
  const row = useRowScrollMemory(name);
  return (
    <ul
      {...row}
      aria-label={label}
      className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:-mx-8 md:gap-4 md:px-8 md:scroll-px-8 [&::-webkit-scrollbar]:hidden"
    >
      {children}
    </ul>
  );
}
