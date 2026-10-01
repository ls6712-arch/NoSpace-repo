/**
 * The one place event names get typed out. No real analytics backend is
 * wired up yet — this logs to the console in dev and no-ops in prod, same
 * "deliberately easy to find and swap" spirit as SALE_COMING_SOON_COPY in
 * Log.tsx. Swap sendToConsole for a real client (PostHog, Amplitude, etc.)
 * here, once one exists, without touching any call site.
 */
export type AnalyticsEvent =
  | { name: "pursuits_in_progress_viewed"; count: number }
  | { name: "pursuits_in_progress_item_tapped"; pursuitId: string }
  | { name: "pursuits_in_progress_see_all_tapped"; count: number };

function sendToConsole(event: AnalyticsEvent) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", event.name, event);
  }
}

export function track(event: AnalyticsEvent) {
  sendToConsole(event);
}
