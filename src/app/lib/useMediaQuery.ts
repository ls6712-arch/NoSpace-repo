import { useEffect, useState } from "react";

/** Whether a media query matches now, and keeps matching as the window changes. False where there is no matchMedia. */
export function useMediaQuery(query: string): boolean {
  const get = () => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return matches;
}

/** Tablet and up: the same 744px the `tab:` breakpoint uses. */
export const useWide = () => useMediaQuery("(min-width: 744px)");
