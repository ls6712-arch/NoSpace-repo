import { useEffect, useRef, type RefObject } from "react";

/** True when the visitor asked for no motion. Read each time, never cached. */
export function reducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** True on a device with a pointer that can hover (not a phone). */
export function canHover(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(hover: hover)").matches;
}

/**
 * Runs `fn` once, the first time the element is mostly on screen. Content is
 * always fully visible before this fires; it only starts a small flourish.
 * Does nothing under reduced motion or without IntersectionObserver.
 */
export function useOnceInView<T extends Element>(fn: () => void, threshold = 0.6): RefObject<T> {
  const ref = useRef<T>(null);
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          latest.current();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return ref;
}

/** Restarts a CSS animation class on an element, and removes it when it is over. */
export function replayClass(el: Element | null, cls: string, ms: number) {
  if (!el || reducedMotion()) return;
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
  window.setTimeout(() => el.classList.remove(cls), ms);
}
