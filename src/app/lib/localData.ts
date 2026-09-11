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
  // Private logs used to live in here (`privateLogs`), for every account —
  // that field is unused now that a signed-in owner's Private Logs are
  // Supabase-backed (context/PrivateLogsContext.tsx). Still cleared on
  // sign-out below since old, already-saved private logs may still be
  // sitting in this key for someone who hasn't migrated — see that
  // context's own note on why they're left alone rather than migrated.
  "nospace.journal.v1", // saved posts, projects, entries (privateLogs field now unused)
  "nospace.listings.v1", // things you listed for sale
  "nospace.circles.joined.v1", // Circles you joined
  "nospace.reactions.v1", // which reactions you left
  "nospace.rewards.v1", // milestone progress
  "nospace.social.v1", // participations, thoughts, notifications when signed out
  "nospace.draft.v1", // the in-progress composer draft
  "nospace.privateLogs.local.v1", // private logs when signed out (no account to key a real row off)
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
  // The draft's attached photo/video lives in IndexedDB, not localStorage
  // (see lib/draftMedia.ts) — it would otherwise survive a sign-out on a
  // shared computer and leak into the next account, same problem this
  // whole function exists to prevent for everything else. Dynamically
  // imported so a page that never touches the composer doesn't pay for it.
  import("./draftMedia").then(({ clearDraftMedia }) => clearDraftMedia());
  window.dispatchEvent(new Event(LOCAL_CLEARED_EVENT));
}
