/**
 * Everything Sushii keeps in the browser, in one place.
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
  "sushii.journal.v1", // saved posts, projects, entries (privateLogs field now unused)
  "sushii.listings.v1", // things you listed for sale
  "sushii.circles.joined.v1", // Circles you joined
  "sushii.reactions.v1", // which reactions you left
  "sushii.rewards.v1", // milestone progress
  "sushii.social.v1", // participations, thoughts, notifications when signed out
  "sushii.draft.v1", // the in-progress composer draft
  "sushii.privateLogs.local.v1", // private logs when signed out (no account to key a real row off)
  "sushii.cornerNotes.v1", // your own private note per Corner, shown on its Moments tile
] as const;

/**
 * The same keys under their pre-rebrand "nospace.*" names (the product was
 * called NoSpace before it became Sushii). migrateLegacyStorageKeys() below
 * copies any of these forward to their new LOCAL_KEYS counterpart on first
 * load after the rename, but the old key is deliberately left in place
 * rather than deleted there — so it still needs sweeping here too, or a
 * sign-out on a shared computer would leave this stale pre-rename copy
 * behind for the next person, exactly what this function exists to prevent.
 */
const LEGACY_LOCAL_KEYS = [
  "nospace.journal.v1",
  "nospace.listings.v1",
  "nospace.circles.joined.v1",
  "nospace.reactions.v1",
  "nospace.rewards.v1",
  "nospace.social.v1",
  "nospace.draft.v1",
  "nospace.privateLogs.local.v1",
  "nospace.cornerNotes.v1",
] as const;

/** Notifies the in-memory stores that their backing storage was emptied. */
export const LOCAL_CLEARED_EVENT = "sushii:local-cleared";

/**
 * Wipes every local store and tells the app to re-read from empty. Called on
 * sign-out. Deliberately not called on sign-in: someone who logged something
 * while signed out should keep it when they make an account.
 */
export function clearLocalData() {
  if (typeof window === "undefined") return;
  for (const key of [...LOCAL_KEYS, ...LEGACY_LOCAL_KEYS]) {
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

/**
 * One-time forward-copy from the pre-rebrand "nospace.*" storage keys (see
 * LEGACY_LOCAL_KEYS above) to their "sushii.*" replacements, so nobody's
 * existing badges, points, drafts, saved listings, joined Circles or private
 * logs reset to empty just because the product was renamed. Must run before
 * anything else in the app reads from localStorage — called once, at the
 * top of main.tsx, ahead of the render.
 *
 * Two keys existed before the rename but were never added to LOCAL_KEYS
 * (`nospace.corners.local.v1`, `nospace.profileLinks.v1`) — migrated here
 * too, under their own explicit pair, since this function's job is "don't
 * lose anyone's local data," not just the sign-out sweep's narrower list.
 */
export function migrateLegacyStorageKeys() {
  if (typeof window === "undefined") return;
  const pairs: [string, string][] = [
    ...LOCAL_KEYS.map((key, i): [string, string] => [LEGACY_LOCAL_KEYS[i], key]),
    ["nospace.corners.local.v1", "sushii.corners.local.v1"],
    ["nospace.profileLinks.v1", "sushii.profileLinks.v1"],
  ];
  for (const [oldKey, newKey] of pairs) {
    try {
      if (window.localStorage.getItem(newKey) !== null) continue;
      const oldValue = window.localStorage.getItem(oldKey);
      if (oldValue !== null) window.localStorage.setItem(newKey, oldValue);
    } catch {
      // A private window may refuse reads/writes; nothing to migrate in that case.
    }
  }
}
