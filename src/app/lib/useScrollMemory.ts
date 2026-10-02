import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router";

/**
 * Scroll memory for the whole app (installed once in Root):
 *
 * - Going back (or forward) to a page puts you where you were, e.g. back
 *   from a Moment to the feed you opened it from. Feeds can still be
 *   filling in when you land, so we keep trying for a moment until the
 *   page is tall enough to reach the saved spot.
 * - Opening a new page starts at the top.
 * - Changing only the query string (a filter, a tab, opening a Moment over
 *   the feed) leaves the scroll alone.
 *
 * Positions live in sessionStorage, keyed by history entry, so they also
 * survive a reload within the tab.
 */
const STORE = "soosh-scroll-positions";
const RESTORE_FOR_MS = 1500;

function load(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function save(positions: Record<string, number>) {
  try {
    // Keep the last 50 entries; history this long back is rarely revisited.
    const keys = Object.keys(positions);
    const trimmed = keys.length > 50 ? Object.fromEntries(keys.slice(-50).map((k) => [k, positions[k]])) : positions;
    sessionStorage.setItem(STORE, JSON.stringify(trimmed));
  } catch {
    /* private mode or full: memory only */
  }
}

export function useScrollMemory() {
  const location = useLocation();
  const navType = useNavigationType();
  const positions = useRef<Record<string, number>>(load());
  const current = useRef(location.key);
  const lastPath = useRef(location.pathname);

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  }, []);

  // Remember where the current entry is scrolled to.
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        positions.current[current.current] = window.scrollY;
      });
    };
    const onHide = () => save(positions.current);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onHide);
      cancelAnimationFrame(frame);
    };
  }, []);

  useLayoutEffect(() => {
    const samePage = location.pathname === lastPath.current;
    current.current = location.key;
    lastPath.current = location.pathname;
    save(positions.current);

    if (navType === "POP") {
      const target = positions.current[location.key];
      if (target == null) return;
      const started = performance.now();
      let frame = 0;
      const tryRestore = () => {
        const reachable = document.documentElement.scrollHeight - window.innerHeight >= target;
        window.scrollTo(0, target);
        if (!reachable && performance.now() - started < RESTORE_FOR_MS) {
          frame = requestAnimationFrame(tryRestore);
        }
      };
      tryRestore();
      // Stop trying the moment the person scrolls themselves.
      const stop = () => cancelAnimationFrame(frame);
      window.addEventListener("wheel", stop, { once: true, passive: true });
      window.addEventListener("touchstart", stop, { once: true, passive: true });
      return () => {
        stop();
        window.removeEventListener("wheel", stop);
        window.removeEventListener("touchstart", stop);
      };
    }

    // A new page starts at the top; a query-only change stays put.
    if (!samePage) window.scrollTo(0, 0);
  }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps
}
