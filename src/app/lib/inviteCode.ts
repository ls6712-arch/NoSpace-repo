/**
 * Step 2 (invite-only sign-up) — the invite code, carried three ways:
 * raw in the arrival link (/#/i/<code>, exactly what create_invite
 * returned), typed by hand into the door screen's field (where it reads
 * back auto-uppercase and hyphenated for legibility), and stashed in
 * localStorage across the sign-in redirect (Google's own redirect_to is
 * the site root, so the code can't ride along as a URL param).
 */

/** Survives the Google OAuth round trip, which lands back on the site
 * root with no room for a code of our own in the URL. Read once, by
 * whichever screen runs right after sign-in (see AuthContext's own
 * claim-on-pending logic) — always paired with takeSavedInviteCode so a
 * stale code never lingers past that one attempt. */
export const INVITE_CODE_STORAGE_KEY = "sushii.inviteCode";

export function saveInviteCode(code: string) {
  try {
    window.localStorage.setItem(INVITE_CODE_STORAGE_KEY, code);
  } catch {
    // Private browsing / storage disabled — the sign-in itself still
    // works, it just won't auto-claim afterward. The door screen's own
    // manual code field is the fallback.
  }
}

/** Reads and clears in one step — a saved code is only ever meant to be
 * tried once, whatever the result. */
export function takeSavedInviteCode(): string | null {
  try {
    const value = window.localStorage.getItem(INVITE_CODE_STORAGE_KEY);
    window.localStorage.removeItem(INVITE_CODE_STORAGE_KEY);
    return value;
  } catch {
    return null;
  }
}

/** As typed into the door screen's invite-code field: uppercase, and a
 * hyphen inserted after the 4th character once there's more than that —
 * e.g. "v6nx6pj3" -> "V6NX-6PJ3". Purely a display/typing convenience;
 * rawInviteCode below strips it back out before anything is ever sent to
 * claim_invite. Capped at 8 real characters (9 with the hyphen), the
 * length create_invite's own codes actually are. */
export function formatInviteCodeInput(raw: string): string {
  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  return cleaned.length > 4 ? `${cleaned.slice(0, 4)}-${cleaned.slice(4)}` : cleaned;
}

/** What actually reaches claim_invite: lowercase, no hyphen, matching the
 * exact form create_invite returns and the arrival link carries verbatim
 * (/#/i/<code>) — so a code typed by hand and one clicked from a link
 * normalize to the same string. */
export function rawInviteCode(display: string): string {
  return display.toLowerCase().replace(/[^a-z0-9]/g, "");
}
