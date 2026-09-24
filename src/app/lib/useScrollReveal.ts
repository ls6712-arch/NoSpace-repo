import { useEffect, useRef } from "react";

/**
 * Attaches the "ns-reveal" rise-in (see theme.css) to an element the first
 * time it scrolls into view, so the page reads as one continuous unfolding
 * story rather than five sections that were simply always there. Fires once
 * per element — re-scrolling past a section it already revealed doesn't
 * replay it, which would read as nervous rather than calm.
 *
 * Skips entirely under prefers-reduced-motion, matching every other motion
 * hook in this file (see useHeroParallax in Home.tsx) — the CSS's own
 * reduced-motion block also forces `.ns-reveal` visible as a belt-and-braces
 * fallback, but not attaching the observer at all avoids the pointless work.
 */
export function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-visible");
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-visible");
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}
