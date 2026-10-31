import { useCallback, useEffect, useRef, useState, type ForwardedRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRowScrollMemory } from "../lib/useHistoryState";
import { usePrefersReducedMotion } from "../lib/useReducedMotion";

/**
 * A row of cards that scrolls sideways with scroll-snap and no visible
 * scrollbar. It runs to the page edge (16px gutter on a phone, 32px from md)
 * and cards have a fixed width, so the last one is cut off to show there is
 * more. From md, with a mouse, round arrows appear at each end on hover or
 * focus and move the row by most of its width; an arrow hides when the row is
 * already at that end. Touch and trackpads just scroll. From md the edge that
 * still has cards beyond it fades out, so a row that stops at the page frame
 * on a wide screen reads as scrollable rather than cut off.
 */
export function HorizontalRow({
  name,
  label,
  listRef,
  contentKey,
  children,
}: {
  /** Scroll position is remembered per name when going back. */
  name: string;
  label: string;
  /** The scrolling list itself, for a page that moves it (scroll back to the start). */
  listRef?: ForwardedRef<HTMLUListElement>;
  /** What the row holds (its ids, joined). A saved scroll offset is restored only when this is unchanged, so a row whose contents changed starts at the left. */
  contentKey?: string;
  children: ReactNode;
}) {
  const row = useRowScrollMemory(name, contentKey);
  const el = useRef<HTMLUListElement | null>(null);
  const reduced = usePrefersReducedMotion();
  const [ends, setEnds] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const node = el.current;
    if (!node) return;
    setEnds({ start: node.scrollLeft <= 2, end: node.scrollLeft >= node.scrollWidth - node.clientWidth - 2 });
  }, []);

  useEffect(() => {
    measure();
    const node = el.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [measure]);

  // Stable, so a re-render (the arrows' state changing on every scroll) does
  // not run the saved-position restore again and cancel a smooth scroll.
  const setRefs = useCallback(
    (node: HTMLUListElement | null) => {
      el.current = node;
      row.ref(node);
      if (typeof listRef === "function") listRef(node);
      else if (listRef) listRef.current = node;
    },
    [row.ref, listRef],
  );

  const page = (dir: -1 | 1) => {
    const node = el.current;
    if (node) node.scrollBy({ left: dir * node.clientWidth * 0.8, behavior: reduced ? "auto" : "smooth" });
  };

  const fade =
    !ends.start && !ends.end
      ? "tab:[-webkit-mask-image:linear-gradient(to_right,transparent,black_3rem,black_calc(100%-3rem),transparent)] tab:[mask-image:linear-gradient(to_right,transparent,black_3rem,black_calc(100%-3rem),transparent)]"
      : !ends.end
        ? "tab:[-webkit-mask-image:linear-gradient(to_right,black_calc(100%-3rem),transparent)] tab:[mask-image:linear-gradient(to_right,black_calc(100%-3rem),transparent)]"
        : !ends.start
          ? "tab:[-webkit-mask-image:linear-gradient(to_right,transparent,black_3rem)] tab:[mask-image:linear-gradient(to_right,transparent,black_3rem)]"
          : "";

  const arrow =
    "absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/95 text-foreground shadow-card transition-opacity duration-fast focus-visible:opacity-100 tab:flex [@media(hover:none)]:hidden";

  return (
    <div className="group/row relative -mx-4 tab:-mx-6 desk:-mx-8">
      <ul
        ref={setRefs}
        onScroll={() => {
          row.onScroll();
          measure();
        }}
        aria-label={label}
        className={`flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] tab:scroll-px-6 desk:scroll-px-8 tab:gap-4 tab:px-6 desk:px-8 [&::-webkit-scrollbar]:hidden ${fade}`}
      >
        {children}
      </ul>
      {!ends.start && (
        <button type="button" aria-label="Scroll left" onClick={() => page(-1)} className={`${arrow} left-3 opacity-0 group-hover/row:opacity-100`}>
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
      )}
      {!ends.end && (
        <button type="button" aria-label="Scroll right" onClick={() => page(1)} className={`${arrow} right-3 opacity-0 group-hover/row:opacity-100`}>
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
