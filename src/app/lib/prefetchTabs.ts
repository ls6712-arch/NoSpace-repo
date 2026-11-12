/**
 * Once the first screen is up and the browser is idle, fetch the page files
 * for the main tabs (Discover, Calendar, You, Log) so they open without a wait.
 * Quiet by design: one request after another, errors ignored (the page loads
 * normally on first visit), and skipped when the person has asked their
 * browser to save data or is on a very slow connection.
 */
const TABS: Array<() => Promise<unknown>> = [
  () => import("../pages/Discover"),
  () => import("../pages/Calendar"),
  () => import("../pages/Profile"),
  () => import("../pages/Log"),
];

type Connection = { saveData?: boolean; effectiveType?: string };

let started = false;

export function shouldPrefetch(connection: Connection | undefined): boolean {
  if (!connection) return true;
  if (connection.saveData) return false;
  return connection.effectiveType !== "slow-2g" && connection.effectiveType !== "2g";
}

/** Returns a cleanup so it can be used directly as a useEffect body. */
export function prefetchMainTabs(): () => void {
  if (started || typeof window === "undefined") return () => {};
  if (!shouldPrefetch((navigator as Navigator & { connection?: Connection }).connection)) return () => {};
  let cancelled = false;
  let handle: number | undefined;
  const idle = (cb: () => void): number => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    return w.requestIdleCallback ? w.requestIdleCallback(cb, { timeout: 4000 }) : window.setTimeout(cb, 2000);
  };
  const run = async () => {
    if (started || cancelled) return;
    started = true;
    for (const load of TABS) {
      if (cancelled) return;
      await load().catch(() => {});
      // Let the browser breathe between files.
      await new Promise<void>((resolve) => idle(resolve));
    }
  };
  const start = () => {
    handle = idle(() => void run());
  };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener("load", start);
    if (handle !== undefined) (window as Window & { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(handle);
  };
}
