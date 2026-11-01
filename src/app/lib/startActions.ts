import { track } from "./analytics";
import { logSuggestionEvent } from "./homeSuggestions";

/**
 * What the Start page records. Opening it from Home is "start" (HomeFeed, on the
 * tap); making a plan is "going"; a Moment logged from it is "logged". The
 * suggestion log (config.ts) takes them only once logging is switched on.
 */
export function recordStartAction(action: "going" | "logged", cornerKey: string): void {
  track({ name: `home_suggestion_${action}` as const, kind: "at_home", position: 0 });
  void logSuggestionEvent({ kind: "at_home", refId: cornerKey, cornerKey, position: 0, action });
}
