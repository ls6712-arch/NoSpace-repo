import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";

const MotionContext = createContext({ enabled: false, reduced: true, toggle: () => {} });

/** Presentation only: trying examples or pausing motion never writes a personal preference. */
export function LandingMotionProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion() ?? false;
  const [paused, setPaused] = useState(false);
  const toggle = useCallback(() => setPaused(value => !value), []);
  const value = useMemo(() => ({ enabled: !reduced && !paused, reduced, toggle }), [reduced, paused, toggle]);
  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export const useLandingMotion = () => useContext(MotionContext);
