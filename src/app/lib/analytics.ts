/**
 * The one place event names get typed out. Every event goes to Google
 * Analytics 4 (src/app/lib/googleAnalytics.ts) when GA is loaded, which is
 * only on the live site and never for Do Not Track or Global Privacy Control.
 * In dev it logs to the console instead.
 *
 * Ids never leave the browser: any field whose name ends in "Id" is dropped
 * before sending, so GA sees "pursuit_share_opened from pursuit_page", never
 * which Pursuit. Other fields are sent as snake_case event parameters. Keep new
 * fields to small fixed values (a kind, a view, a count), never a name, a
 * title, an email or free text.
 */
/** Where a sign-up prompt came from. */
export type SignUpTrigger = "inline_card" | "feature_gate" | "limit" | "header";
export type SignUpMethod = "google" | "apple" | "email";

export type AnalyticsEvent =
  | { name: "landing_action_clicked"; action: "ask" | "signup" | "corner" | "pursuit"; placement: "header" | "hero" | "example" | "corner" | "pursuit" | "walls" | "footer"; hasExample?: boolean }
  | { name: "pursuits_in_progress_viewed"; count: number }
  | { name: "pursuits_in_progress_item_tapped"; pursuitId: string }
  | { name: "pursuits_in_progress_see_all_tapped"; count: number }
  | { name: "pursuit_share_opened"; pursuitId: string; from: "pursuit_page" | "pursuit_item" | "all_pursuits_row" }
  | { name: "pursuit_share_link_copied"; pursuitId: string }
  | { name: "pursuit_share_native_sheet_opened"; pursuitId: string }
  | { name: "discover_for_you_personalized"; signalCount: number }
  | { name: "moment_double_tap_loved"; postId: number }
  | { name: "moment_quick_react_opened"; postId: number }
  | { name: "home_suggestion_shown"; kind: string; position: number }
  | { name: "home_suggestion_opened"; kind: string; position: number }
  | { name: "home_suggestion_start"; kind: string; position: number }
  | { name: "home_suggestion_going"; kind: string; position: number }
  | { name: "home_suggestion_logged"; kind: string; position: number }
  | { name: "home_suggestion_invite"; kind: string; position: number }
  | { name: "home_suggestion_dismissed"; kind: string; position: number }
  | { name: "calendar_opened"; view: "day" | "week" | "month" | "list" }
  | { name: "calendar_view_changed"; view: "day" | "week" | "month" | "list" }
  | { name: "calendar_filter_changed"; row: string; on: boolean }
  | { name: "calendar_slot_tapped"; kind: "empty" | "plan" | "free" | "block" | "stub" }
  | { name: "plan_created_from_calendar" }
  | { name: "free_time_added"; repeat: "none" | "weekly" }
  | { name: "block_added"; repeat: "none" | "weekly" }
  | { name: "plan_cancelled" }
  | { name: "plan_left" }
  | { name: "undo_used" }
  | { name: "week_day_tapped"; offset: number }
  | { name: "week_find_something"; window: string }
  | { name: "week_budget_changed" }
  | { name: "week_view_toggled"; view: "week" | "month" }
  // Stubby for guests. Never the ask, a title or an email: kinds and counts only.
  | { name: "stubby_opened"; who: "guest" | "user" }
  | { name: "stubby_example_prompt_clicked"; who: "guest" | "user" }
  | { name: "stubby_message_sent"; who: "guest" | "user"; messageNumber: number }
  | { name: "signup_prompt_shown"; trigger: SignUpTrigger }
  | { name: "signup_prompt_dismissed"; trigger: SignUpTrigger }
  | { name: "signup_started"; trigger: SignUpTrigger; method: SignUpMethod }
  | { name: "signup_completed"; trigger: SignUpTrigger; method: SignUpMethod; guestMessages: number }
  | { name: "stubby_context_shown" }
  | { name: "stubby_context_completed"; interests: number; city: boolean; timing: boolean }
  | { name: "stubby_context_skipped" }
  // GA4 recommended events, sent once per sign-in by AuthContext.
  | { name: "sign_up"; method: string }
  | { name: "login"; method: string };

function sendToConsole(event: AnalyticsEvent) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", event.name, event);
  }
}

/** Event fields as GA4 parameters: ids dropped, names in snake_case. */
export function toGaParams(event: AnalyticsEvent): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(event)) {
    if (key === "name" || /Id$/.test(key)) continue;
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") continue;
    out[key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = value;
  }
  return out;
}

function sendToGoogle(event: AnalyticsEvent) {
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag === "function") gtag("event", event.name, toGaParams(event));
}

export function track(event: AnalyticsEvent) {
  sendToConsole(event);
  try {
    sendToGoogle(event);
  } catch {
    // Analytics must never break the app.
  }
}
