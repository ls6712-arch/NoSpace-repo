import { useEffect, useRef, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { useCurrentTab } from "../lib/routeHandle";
import { viewForTab, type TownMotion } from "../world/townViews";
import type { Town } from "../world/town";

/**
 * The 3D town that sits behind every page. Mounted once in the shell, so moving
 * between tabs glides one camera across one park instead of reloading a
 * background. three.js and the town are fetched after the page has drawn,
 * and until they arrive (or if WebGL is missing) the plain page background
 * shows, so nothing waits on it.
 *
 * A soft wash in the page colour sits over the town so text on top stays
 * readable. The whole thing is decoration: hidden from screen readers and
 * never in the way of a tap.
 */
export function WorldBackdrop() {
  const host = useRef<HTMLDivElement>(null);
  const town = useRef<Town | null>(null);
  const { resolvedTheme } = useTheme();
  const view = viewForTab(useCurrentTab());
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const motion = useMotion();

  // Latest values, read once when the town finishes loading.
  const latest = useRef({ view, theme: resolvedTheme, motion });
  latest.current = { view, theme: resolvedTheme, motion };

  useEffect(() => {
    const el = host.current;
    if (!el || !webglAvailable()) return;
    let cancelled = false;
    // Let the page itself paint first; the town is never what someone came for.
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
    const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => {
      import("../world/town")
        .then(({ createTown }) => {
          if (cancelled) return;
          const { view: v, theme, motion: m } = latest.current;
          town.current = createTown(el, {
            small: window.innerWidth < 744,
            motion: m,
            view: v,
            theme,
            assetBase: import.meta.env.BASE_URL + "world/town/",
            onLost: () => setFailed(true),
          });
          setReady(true);
        })
        .catch(() => setFailed(true));
    });
    return () => {
      cancelled = true;
      cancelIdle(handle);
      town.current?.dispose();
      town.current = null;
    };
  }, []);

  useEffect(() => town.current?.setView(view), [view]);
  useEffect(() => town.current?.setTheme(resolvedTheme), [resolvedTheme]);
  useEffect(() => town.current?.setMotion(motion), [motion]);

  if (failed) return null;
  return (
    <div aria-hidden="true" className="world-backdrop" data-ready={ready || undefined}>
      <div ref={host} className="world-backdrop__town" />
      <div className="world-backdrop__wash" />
    </div>
  );
}

/** Whether this browser can draw 3D at all. Kept here, not imported, so the shell pulls in nothing else. */
function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** "still" under reduced motion, "calm" otherwise; follows the setting live. */
function useMotion(): TownMotion {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduce, setReduce] = useState(() => typeof window !== "undefined" && window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce ? "still" : "calm";
}
