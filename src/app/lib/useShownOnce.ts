import { useEffect, useRef } from "react";

/**
 * Calls `onShown` once, the first time at least half of the element is on
 * screen. Scrolling away and back does not call it again, and a visit that
 * never scrolls to it never does. Nothing happens where IntersectionObserver
 * is not available.
 */
export function useShownOnce<T extends HTMLElement>(onShown: () => void, enabled = true) {
  const ref = useRef<T>(null);
  const done = useRef(false);
  const callback = useRef(onShown);
  callback.current = onShown;
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || done.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (done.current) return;
        if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5)) {
          done.current = true;
          callback.current();
          io.disconnect();
        }
      },
      { threshold: [0.5] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);
  return ref;
}
