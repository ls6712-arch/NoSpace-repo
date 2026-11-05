import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

const MotionContext = createContext({ enabled: false, reduced: true });
const query = "(prefers-reduced-motion: reduce)";
const snapshot = () => window.matchMedia?.(query).matches ?? true;
const serverSnapshot = () => true;
function subscribe(onChange: () => void) {
  const media = window.matchMedia?.(query);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

/** Presentation only. Listen for device changes without storing a personal preference. */
export function LandingMotionProvider({ children }: { children: ReactNode }) {
  // Motion's current hook snapshots the initial preference, so subscribe here to
  // also stop transitions and pointer tilt when the setting changes mid-visit.
  const reduced = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const value = useMemo(() => ({ enabled: !reduced, reduced }), [reduced]);
  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export const useLandingMotion = () => useContext(MotionContext);
