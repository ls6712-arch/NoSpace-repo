import { toast } from "sonner";
import { track } from "./analytics";

/**
 * Nothing on the calendar asks "are you sure". A change is made on screen at
 * once and the toast offers Undo for 6 seconds. A change that others would
 * feel (cancelling or leaving a plan) is only sent after the 6 seconds, so an
 * Undo costs them nothing: `commit` runs when the time is up, `undo` when
 * Undo is tapped. Leaving the page sends whatever is still waiting.
 */
export const UNDO_MS = 6000;
export const UNDO_LABEL = "Undo";

const waiting = new Set<() => void>();

export function announceChange(message: string, handlers: { undo: () => void; commit?: () => void }): void {
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const commitNow = () => {
    if (settled) return;
    settled = true;
    waiting.delete(commitNow);
    if (timer) clearTimeout(timer);
    handlers.commit?.();
  };
  if (handlers.commit) {
    waiting.add(commitNow);
    timer = setTimeout(commitNow, UNDO_MS);
  }
  toast(message, {
    duration: UNDO_MS,
    action: {
      label: UNDO_LABEL,
      onClick: () => {
        if (settled) return;
        settled = true;
        waiting.delete(commitNow);
        if (timer) clearTimeout(timer);
        track({ name: "undo_used" });
        handlers.undo();
      },
    },
  });
}

/** Sends every change still inside its 6 seconds, now. For leaving the page. */
export function flushPendingChanges(): void {
  for (const commit of [...waiting]) commit();
}

// Closing the tab sends what is waiting. `pagehide` covers a tab or window closing and a page being left; `visibilitychange` covers a phone
// putting the page away, where `pagehide` can be skipped. Sending twice is harmless: a change is only sent once.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushPendingChanges);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPendingChanges();
  });
}
