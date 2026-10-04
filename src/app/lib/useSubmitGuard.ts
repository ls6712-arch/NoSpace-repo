import { useCallback, useRef, useState } from "react";

/**
 * One submit at a time, for any button that writes something (Join Space,
 * an invite, a reply). `busy` disables the button; the ref blocks a second
 * tap that lands before React has re-rendered it disabled, which state
 * alone can't. Stay busy through any follow-up refetch by awaiting it
 * inside `run`, so the button doesn't re-enable while the old state (say,
 * "Join Space" for someone who just joined) is still on screen.
 *
 *   const [joining, runJoin] = useSubmitGuard();
 *   <Button disabled={joining} onClick={() => runJoin(async () => { … })}>
 */
export function useSubmitGuard(): [boolean, <T>(fn: () => Promise<T>) => Promise<T | undefined>] {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);

  return [busy, run];
}
