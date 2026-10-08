/** One definition of what counts as a usable display name, shared by
 * sign-up, the onboarding name step and the one-time name prompt. */
export const DISPLAY_NAME_MAX = 50;

/** Shared with Settings' own prompt so dismissing either one dismisses both. */
export function nameDismissKey(userId: string) {
  return `sushii-name-prompt-dismissed-${userId}`;
}

/** Collapses runs of whitespace and trims, so "  Mia   Chen " is "Mia Chen". */
export function cleanDisplayName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export function validateDisplayName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = cleanDisplayName(raw);
  if (!name) return { ok: false, error: "What should people call you?" };
  if (name.length > DISPLAY_NAME_MAX) {
    return { ok: false, error: `Keep it to ${DISPLAY_NAME_MAX} characters or fewer.` };
  }
  return { ok: true, name };
}

export function emailPrefixOf(email: string | null | undefined): string {
  return email?.split("@")[0]?.trim() ?? "";
}

/** True when the stored name is just the part of the email before the @. */
export function isEmailPrefixName(displayName: string | null | undefined, email: string | null | undefined) {
  const prefix = emailPrefixOf(email);
  return !!prefix && (displayName ?? "").trim().toLowerCase() === prefix.toLowerCase();
}
