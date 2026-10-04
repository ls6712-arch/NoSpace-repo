import { useNetworkState } from "../lib/networkStatus";
import { OFFLINE_LINE, SLOW_LINE } from "../lib/stateCopy";

/**
 * A quiet one-line strip under the preview banner when the connection is
 * gone or crawling. No dismiss button: it leaves on its own when things
 * recover. Forms don't clear on a failed save, so nothing typed is lost.
 */
export function NetworkBanner() {
  const state = useNetworkState();
  if (state === "online") return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 border-b border-border bg-surface-muted px-4 py-1.5 text-center text-caption text-muted-foreground"
    >
      {state === "offline" ? OFFLINE_LINE : SLOW_LINE}
    </div>
  );
}
