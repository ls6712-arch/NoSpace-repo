import { useEffect, useRef } from "react";

/**
 * Infinite scroll: calls `onMore` whenever the returned sentinel gets within a
 * screen of the viewport, as long as `enabled`. Nothing happens where
 * IntersectionObserver is not available (the page shows what it has).
 */
export function useLoadMore<T extends HTMLElement>(onMore: () => void, enabled: boolean) {
  const ref = useRef<T>(null);
  const callback = useRef(onMore);
  callback.current = onMore;
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && callback.current(), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);
  return ref;
}
