/**
 * What a password reset link leaves in the address when it opens the app.
 *
 * The app routes with the hash (`/#/discover`), and Supabase also returns its
 * answer in the hash: `#access_token=...&type=recovery` for a good link, and
 * `#error=access_denied&error_code=otp_expired...` for one that has expired or
 * was already used. The router would read either as a page that does not
 * exist, so this runs before anything else (main.tsx imports it first, ahead
 * of the Supabase client, which reads the same hash and then clears it), notes
 * which kind of link it was, and tidies the hash. Root.tsx then sends the
 * person to /reset-password.
 */
const KEY = "soosh.recovery";
const EMAIL_KEY = "soosh.reset.email";
const EMAIL_TTL_MS = 60 * 60 * 1000;

export type RecoveryKind = "ready" | "expired";

/** Reads a hash and says what it is. Pure, so it can be tested. */
export function readRecoveryHash(hash: string): { kind: RecoveryKind | null; hash: string } {
  // A redirect that kept its own fragment: "#/reset-password#access_token=...". Keep the part Supabase reads.
  const inner = /^#\/[^#]*#(.+)$/.exec(hash);
  const tokens = inner ? `#${inner[1]}` : hash;
  if (/(^|[#&])type=recovery(&|$)/.test(tokens) && /access_token=/.test(tokens)) return { kind: "ready", hash: tokens };
  if (/(^|[#&?])error(_code)?=/.test(tokens) && /otp_expired|access_denied/.test(tokens)) return { kind: "expired", hash: "#/reset-password" };
  return { kind: null, hash };
}

function note(kind: RecoveryKind) {
  try {
    sessionStorage.setItem(KEY, kind);
  } catch {
    // Without storage the person lands on Home signed in, and can change the password from Settings.
  }
}

/** What this tab was opened with, if it was a reset link. Reading does not use it up; the reset screen clears it once it has shown. */
export function peekRecoveryKind(): RecoveryKind | null {
  try {
    const v = sessionStorage.getItem(KEY);
    return v === "ready" || v === "expired" ? v : null;
  } catch {
    return null;
  }
}

/** Whether a link was just opened in this tab. */
export function hasRecoveryKind(): boolean {
  return peekRecoveryKind() !== null;
}

export function clearRecoveryKind(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

/** The address a reset link was last asked for, kept on this device for an hour so an expired link can be replaced in one tap. */
export function rememberResetEmail(email: string): void {
  try {
    localStorage.setItem(EMAIL_KEY, JSON.stringify({ email, at: Date.now() }));
  } catch {
    // The expired screen then sends people back to the log in screen to ask again.
  }
}

export function readResetEmail(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(EMAIL_KEY) ?? "null") as { email?: string; at?: number } | null;
    if (v?.email && typeof v.at === "number" && Date.now() - v.at < EMAIL_TTL_MS) return v.email;
  } catch {
    // Unreadable: treat as not kept.
  }
  return null;
}

export function forgetResetEmail(): void {
  try {
    localStorage.removeItem(EMAIL_KEY);
  } catch {
    // Nothing to clear.
  }
}

if (typeof window !== "undefined") {
  const seen = readRecoveryHash(window.location.hash);
  if (seen.kind) {
    note(seen.kind);
    if (seen.hash !== window.location.hash) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${seen.hash}`);
  }
}
