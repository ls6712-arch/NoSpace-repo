import { useSyncExternalStore } from "react";
import { TRY_AGAIN } from "../../lib/stateCopy";
import { getToasts, removeToast, showToast, subscribeToasts } from "../../lib/toasts";
import { SwipeToast } from "./SwipeToast";

/**
 * Quiet confirmations: one short line at the bottom, gone in a few seconds.
 * No icons, no confetti. Each one burns a fuse for the time it stays and
 * swipes down to go away, like a sheet. Mounted once in App.
 */
export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToasts);
  return (
    <section
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 z-[70] mx-auto flex w-[min(356px,calc(100vw-32px))] flex-col justify-end"
      style={{ bottom: "calc(88px + var(--safe-bottom))" }}
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <SwipeToast
            message={t.message}
            actionLabel={t.action?.label}
            onAction={t.action?.onClick}
            open={t.open}
            duration={t.duration}
            tone={t.tone}
            onClose={() => removeToast(t.id)}
          />
        </div>
      ))}
    </section>
  );
}

/** A quiet confirmation ("Changes saved", "Link copied"). */
export function notify(message: string) {
  showToast(message);
}

/** A failure that isn't tied to a form on screen (e.g. a rolled-back Love this). */
export function notifyError(message: string, retry?: () => void, retryLabel = TRY_AGAIN) {
  showToast(message, { tone: "error", action: retry ? { label: retryLabel, onClick: retry } : undefined });
}
