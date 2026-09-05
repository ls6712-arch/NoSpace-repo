/**
 * Everything NoSpace keeps in the browser, in one place.
 *
 * These stores exist so the app works before you sign in and stays responsive
 * after. That's fine on your own device and a problem on a shared one: private
 * reflections, saved work and joined Circles all sat here across a sign-out,
 * so the next person to sign in on the same laptop inherited them. Signing out
 * now clears the lot.
 *
 * Anything added here must be listed in LOCAL_KEYS, or it will quietly become
 * the next thing that leaks between accounts.
 */
export const LOCAL_KEYS = [
  "nospace.journal.v1", // private logs, saved posts, projects, entries
  "nospace.listings.v1", // things you listed for sale
  "nospace.circles.joined.v1", // Circles you joined
  "nospace.reactions.v1", // which reactions you left
  "nospace.rewards.v1", // milestone progress
  "nospace.social.v1", // participations, thoughts, notifications when signed out
] as const;

/** Notifies the in-memory stores that their backing storage was emptied. */
export const LOCAL_CLEARED_EVENT = "nospace:local-cleared";

/**
 * Wipes every local store and tells the app to re-read from empty. Called on
 * sign-out. Deliberately not called on sign-in: someone who logged something
 * while signed out should keep it when they make an account.
 */
export function clearLocalData() {
  if (typeof window === "undefined") return;
  for (const key of LOCAL_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // A private window may refuse; there's nothing stored to leak in that case.
    }
  }
  window.dispatchEvent(new Event(LOCAL_CLEARED_EVENT));
}
