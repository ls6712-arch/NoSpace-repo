// The one Stubby version the app and stubby-scout must agree on (Nov 3, 2026). The app sends it on
// every call as the stubby-version header; the function answers any other version with "Stubby is
// updating, try again in a minute." instead of a bare 400, and sends its own on every answer.
//
// Bump STUBBY_VERSION whenever what the app sends or what the function answers changes shape.
// stubbyVersion.test.ts holds schema.ts (the request check) to the hash below, so changing the
// request check without a bump fails npm test. Pure, no dependencies: imported by both sides.

export const STUBBY_VERSION = "2026-11-03.2";
export const STUBBY_VERSION_HEADER = "stubby-version";

/** sha256 of supabase/functions/stubby-scout/schema.ts at this version. Update it with the bump. */
export const STUBBY_SCHEMA_SHA256 = "92e3f4ecdd288457e33deb042518ce717fecf2e86ad08ef9a5c8dc6c191ba9b8";

/** What the function answers when the versions differ (wording from the founder, Nov 3, 2026). */
export const STUBBY_UPDATING = { error: "Stubby is updating, try again in a minute.", code: "STUBBY_UPDATING" } as const;

/** True when a request may go on: no header (the morning schedule, curl, an app from before this), or the same version. */
export function versionMatches(sent: string | null | undefined): boolean {
  return sent === null || sent === undefined || sent.trim() === STUBBY_VERSION;
}
