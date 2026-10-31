import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { motion } from "motion/react";
import { HorizontalRow } from "../HorizontalRow";
import { Reveal } from "../afterhours/Reveal";
import { PRESS_SCALE, pop, press } from "../../lib/motionTokens";
import { cn } from "./utils";

/**
 * The one carousel (core loop v1, §2.4): CSS scroll-snap on HorizontalRow,
 * no library. Cards snap to their start with the next card peeking about
 * 28px. Optional dot pager (the active dot widens 6 to 20px on `pop`). A
 * mouse can drag it, arrow keys move it when focused, and cards enter on the
 * 40ms stagger once. Press feedback is on the card wrapper.
 */
export function SnapCarousel<T>({
  items,
  getKey,
  renderItem,
  label,
  name,
  dots = false,
  itemClassName = "w-[calc(100%-2.5rem)] tab:w-[22rem]",
}: {
  items: readonly T[];
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  /** Accessible name, also announced as "carousel". */
  label: string;
  /** Scroll position is remembered per name when going back. */
  name: string;
  dots?: boolean;
  /** Width of one card. The default leaves the next card peeking on a phone. */
  itemClassName?: string;
}) {
  const list = useRef<HTMLUListElement | null>(null);
  const [active, setActive] = useState(0);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  const measure = useCallback(() => {
    const ul = list.current;
    if (!ul) return;
    const kids = Array.from(ul.children) as HTMLElement[];
    let best = 0;
    let bestDist = Infinity;
    kids.forEach((k, i) => {
      const d = Math.abs(k.offsetLeft - ul.scrollLeft - ul.offsetLeft - parseFloat(getComputedStyle(ul).paddingLeft));
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setActive(best);
  }, []);

  useEffect(() => {
    const ul = list.current;
    if (!ul || !dots) return;
    ul.addEventListener("scroll", measure, { passive: true });
    measure();
    return () => ul.removeEventListener("scroll", measure);
  }, [dots, measure, items.length]);

  const goTo = (i: number) => {
    const ul = list.current;
    const kid = ul?.children[Math.max(0, Math.min(items.length - 1, i))] as HTMLElement | undefined;
    if (!ul || !kid) return;
    const pad = parseFloat(getComputedStyle(ul).paddingLeft) || 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ul.scrollTo({ left: kid.offsetLeft - ul.offsetLeft - pad, behavior: reduced ? "auto" : "smooth" });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goTo(active + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(active - 1);
    }
  };

  // Mouse drag only; touch and trackpads already scroll natively.
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !list.current) return;
    drag.current = { x: e.clientX, left: list.current.scrollLeft, moved: false };
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    const ul = list.current;
    if (!d || !ul) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 4) {
      d.moved = true;
      ul.style.scrollSnapType = "none";
      ul.setPointerCapture(e.pointerId);
    }
    if (d.moved) ul.scrollLeft = d.left - dx;
  };
  const endDrag = () => {
    const ul = list.current;
    if (drag.current?.moved && ul) {
      ul.style.scrollSnapType = "";
      // Let the snap settle on the nearest card.
      window.setTimeout(() => ul.dispatchEvent(new Event("scroll")), 0);
    }
    window.setTimeout(() => (drag.current = null), 0);
  };

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      // A drag must not end as a click on the card under the pointer.
      onClickCapture={(e) => {
        if (drag.current?.moved) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className="rounded-card outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <HorizontalRow name={name} label={label} listRef={list} contentKey={items.map(getKey).join("|")}>
        {items.map((item, i) => (
          <li key={getKey(item, i)} className={cn("shrink-0 snap-start", itemClassName)}>
            <Reveal index={i}>
              <motion.div whileTap={{ scale: PRESS_SCALE }} transition={press}>
                {renderItem(item, i)}
              </motion.div>
            </Reveal>
          </li>
        ))}
      </HorizontalRow>
      {dots && items.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
          {items.map((item, i) => (
            <motion.span
              key={getKey(item, i)}
              initial={false}
              animate={{ width: i === active ? 20 : 6, opacity: i === active ? 1 : 0.4 }}
              transition={pop}
              className="h-1.5 rounded-full bg-foreground"
            />
          ))}
        </div>
      )}
    </div>
  );
}
