import { useEffect, useState } from "react";

/**
 * `prefers-reduced-motion`, live-updated if the OS setting changes mid-
 * session. `motion/react`'s own `useReducedMotion()` covers most of this
 * app's animated components already; this plain version exists for the
 * handful of places — Step 3's hold-to-share gesture among them — that
 * branch their whole interaction model (not just a transition) on the
 * setting and have no other reason to depend on the animation library.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
