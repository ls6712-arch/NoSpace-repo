import type { SignUpMethod, SignUpTrigger } from "./analytics";

/**
 * What a guest was doing when they started signing up, so they land back exactly there: the
 * Stubby page, the same picks, and the ask they had typed (sent for them if the limit stopped it).
 * Kept in sessionStorage: it survives the Google redirect in the same tab and nothing else.
 * Holds no ids and no tokens; the account is whoever the server says signed in.
 */
export const RETURN_KEY = "soosh.stubby.return.v1";
/** Set by SignUpReturnEffect after sign-up: the ask that was in the field, and whether to send it. */
export const RESUME_KEY = "soosh.stubby.resume.v1";
const MAX_AGE_MS = 30 * 60_000;

export interface SignUpReturn {
  trigger: SignUpTrigger;
  method: SignUpMethod;
  /** The ask in the field, 200 characters at most. */
  draft: string;
  /** The limit stopped this ask: send it once they're back. */
  blocked: boolean;
  /** Asks the guest made before signing up, for signup_completed. */
  guestMessages: number;
  /** Where to land: always the Stubby page for now. */
  path: "/calendar";
  at: number;
}

export function saveReturn(r: Omit<SignUpReturn, "at" | "path">): void {
  try {
    const v: SignUpReturn = { ...r, draft: r.draft.slice(0, 200), path: "/calendar", at: Date.now() };
    window.sessionStorage.setItem(RETURN_KEY, JSON.stringify(v));
  } catch {
    // Private mode: they land on Home instead, and their picks are still saved.
  }
}

/** Reads it without taking it. Null when there is none, it is too old, or it doesn't read. */
export function peekReturn(now = Date.now()): SignUpReturn | null {
  try {
    const raw = window.sessionStorage.getItem(RETURN_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<SignUpReturn>;
    const triggers: SignUpTrigger[] = ["inline_card", "feature_gate", "limit", "header"];
    const methods: SignUpMethod[] = ["google", "apple", "email"];
    if (
      !v ||
      typeof v.at !== "number" ||
      now - v.at > MAX_AGE_MS ||
      !triggers.includes(v.trigger as SignUpTrigger) ||
      !methods.includes(v.method as SignUpMethod) ||
      typeof v.draft !== "string"
    ) {
      window.sessionStorage.removeItem(RETURN_KEY);
      return null;
    }
    return {
      trigger: v.trigger as SignUpTrigger,
      method: v.method as SignUpMethod,
      draft: v.draft.slice(0, 200),
      blocked: v.blocked === true,
      guestMessages: typeof v.guestMessages === "number" ? Math.max(0, Math.floor(v.guestMessages)) : 0,
      path: "/calendar",
      at: v.at,
    };
  } catch {
    return null;
  }
}

/** Takes it: read once, then gone. */
export function takeReturn(now = Date.now()): SignUpReturn | null {
  const v = peekReturn(now);
  try {
    window.sessionStorage.removeItem(RETURN_KEY);
  } catch {
    // Nothing to clear.
  }
  return v;
}

/** The error Supabase puts in the address after a failed link: the Google account already has its own Soosh account. */
export function linkErrorInUrl(href = window.location.href): "identity_already_exists" | "other" | null {
  const m = /[#&?]error_code=([a-z_]+)/.exec(href);
  if (!m) return /[#&?]error=/.test(href) ? "other" : null;
  return m[1] === "identity_already_exists" ? "identity_already_exists" : "other";
}
