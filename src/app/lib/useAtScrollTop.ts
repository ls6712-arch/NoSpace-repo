import { useEffect, useRef, useState, type RefObject } from "react";

// my-space.css's own lg breakpoint: below it the whole page scrolls
// (.myspace-shell has no fixed height), at and above it .myspace-shell is
// capped to the viewport and hands scrolling to .myspace-feed itself
// (overflow-y: auto) — the window stops scrolling almost entirely at that
// point. A hook that only ever watched window.scrollY would see that and
// never fire on desktop, since the real scrolling the user feels is
// happening inside the feed, not the window.
const DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * Whether the page's active scroll container is within `thresholdPx` of its
 * top. Below lg that's the window; at lg and up it's `scrollRef`'s own
 * element (pass the ref to whichever element actually has overflow-y: auto
 * at that breakpoint — see my-space.css). Which one is live is re-checked on
 * every breakpoint crossing, not just once on mount, the same matchMedia-
 * driven pattern useHeroParallax (Home.tsx) already uses for its own
 * desktop-only behavior.
 *
 * rAF-throttled either way, so a fast scroll never queues more than one
 * state update per frame no matter how many scroll events fire. A small
 * threshold (rather than exactly 0) absorbs iOS/Safari's elastic overscroll
 * bounce at the very top, which would otherwise toggle the result back and
 * forth on its own.
 */
export function useAtScrollTop(scrollRef?: RefObject<HTMLElement | null>, thresholdPx = 12): boolean {
  const [atTop, setAtTop] = useState(true);
  const frame = useRef(0);

  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP_QUERY);
    let target: Window | HTMLElement = window;

    const currentScrollTop = () =>
      desktop.matches && scrollRef?.current ? scrollRef.current.scrollTop : window.scrollY;

    const apply = () => {
      frame.current = 0;
      setAtTop(currentScrollTop() <= thresholdPx);
    };
    const onScroll = () => {
      if (!frame.current) frame.current = requestAnimationFrame(apply);
    };

    // Re-picks the live scroll target on mount and on every breakpoint
    // crossing — a resize from desktop down to tablet mid-session (or back
    // up) has to re-attach from the feed's own scroll to the window's, or
    // vice versa, not keep listening to whichever one was live at mount.
    const attach = () => {
      target.removeEventListener("scroll", onScroll);
      target = desktop.matches && scrollRef?.current ? scrollRef.current : window;
      target.addEventListener("scroll", onScroll, { passive: true });
      apply();
    };

    attach();
    desktop.addEventListener("change", attach);
    return () => {
      target.removeEventListener("scroll", onScroll);
      desktop.removeEventListener("change", attach);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [scrollRef, thresholdPx]);

  return atTop;
}
