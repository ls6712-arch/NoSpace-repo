import { useEffect, useState } from "react";
import { useNavigation } from "react-router";

/** How long a page may take before the loading bar shows. A fast change never flashes it. */
export const SLOW_NAVIGATION_MS = 150;

/** True while a page change has been loading for longer than 150 ms. */
export function useSlowNavigation(): boolean {
  const loading = useNavigation().state === "loading";
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return;
    }
    const t = window.setTimeout(() => setSlow(true), SLOW_NAVIGATION_MS);
    return () => window.clearTimeout(t);
  }, [loading]);
  return slow;
}
