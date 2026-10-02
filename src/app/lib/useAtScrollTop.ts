import { useEffect, useRef, useState } from "react";

/**
 * Whether the window is scrolled within `thresholdPx` of the top — the same
 * rAF-throttled window.scrollY pattern useHeroParallax (Home.tsx) already
 * uses, so a fast scroll never queues more than one state update per frame
 * no matter how many scroll events fire. A small threshold (rather than
 * exactly 0) absorbs iOS/Safari's elastic overscroll bounce at the very top,
 * which would otherwise toggle the result back and forth on its own.
 *
 * Plain window.scrollY, not a specific container's scrollTop: my-space.css
 * no longer carves out an independently-scrolling .myspace-feed at lg+ (see
 * its own comments) — the window is the one scroll source for the whole
 * page at every breakpoint, so there's nothing else to watch.
 */
export function useAtScrollTop(thresholdPx = 12): boolean {
  const [atTop, setAtTop] = useState(() => (typeof window === "undefined" ? true : window.scrollY <= thresholdPx));
  const frame = useRef(0);

  useEffect(() => {
    const apply = () => {
      frame.current = 0;
      setAtTop(window.scrollY <= thresholdPx);
    };
    const onScroll = () => {
      if (!frame.current) frame.current = requestAnimationFrame(apply);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [thresholdPx]);

  return atTop;
}
