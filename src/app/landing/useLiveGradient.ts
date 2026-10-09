import { useEffect, useRef, useState, type RefObject } from "react";

interface GradientHandle {
  setPaused: (paused: boolean) => void;
  destroy: () => void;
}
interface GradientModule {
  mount: (el: HTMLElement, onReady: () => void) => GradientHandle;
}

// The gradient is its own bundle (vite.gradient.config.ts). This is a runtime
// import of a URL, not a module the app bundles, so three.js and ShaderGradient
// stay out of the signed-in app.
const GRADIENT_URL = import.meta.env.DEV ? "/src/landing-gradient/main.tsx" : `${import.meta.env.BASE_URL}gradient/gradient.js`;

function whenIdle(fn: () => void): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: 1500 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(fn, 600);
  return () => window.clearTimeout(id);
}

/**
 * Loads the live gradient into `target` once the page has painted, and keeps it
 * paused whenever none of `watch` is on screen. Returns true after its first
 * frames, when the caller can fade it in over the static image. Does nothing
 * under prefers-reduced-motion, with Save-Data on, or if the bundle won't load:
 * the static image stays.
 */
export function useLiveGradient(
  target: RefObject<HTMLElement | null>,
  watch: RefObject<HTMLElement | null>[],
  enabled: boolean,
): boolean {
  const [ready, setReady] = useState(false);
  const handle = useRef<GradientHandle | null>(null);
  const visible = useRef(new Set<Element>());
  const tabVisible = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;

    let cancelled = false;
    const sync = () => handle.current?.setPaused(visible.current.size === 0 || !tabVisible.current);

    const cancelIdle = whenIdle(() => {
      import(/* @vite-ignore */ GRADIENT_URL)
        .then((mod: GradientModule) => {
          const el = target.current;
          if (cancelled || !el) return;
          handle.current = mod.mount(el, () => !cancelled && setReady(true));
          sync();
        })
        .catch(() => {
          // Offline, a blocked script, no WebGL: the static image stays.
        });
    });

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.current.add(e.target);
        else visible.current.delete(e.target);
      }
      sync();
    });
    for (const ref of watch) if (ref.current) io.observe(ref.current);

    const onVis = () => {
      tabVisible.current = !document.hidden;
      sync();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      cancelIdle();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      handle.current?.destroy();
      handle.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return ready;
}
