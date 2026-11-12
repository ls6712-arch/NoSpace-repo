import type { SignUpMethod, SignUpTrigger } from "./analytics";

/**
 * What a guest was doing when they started signing up, so they land back exactly there: the
 * Stubby page, the same picks, and the ask they had typed (sent for them if the limit stopped it).
 * Kept in sessionStorage: it survives the Google redirect in the same tab and nothing else.
 * Holds no ids and no tokens; the account is whoever the server says signed in.
 */
export const RETURN_KEY = "soosh.stubby.return.v1";
/** Set by SignUpReturnEffect after sign-up: the ask that was in the field, and whether to send it. Lapses after 30 minutes, like the return note. */
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

/** What AskStubby picks back up after sign-up: the ask that was in the field and whether to send it. */
export interface SignUpResume {
  draft: string;
  send: boolean;
}

/** Writes the resume note, stamped with the time so it lapses like the return note does. */
export function saveResume(draft: string, send: boolean, now = Date.now()): void {
  try {
    window.sessionStorage.setItem(RESUME_KEY, JSON.stringify({ draft: draft.slice(0, 200), send, at: now }));
  } catch {
    // Private mode: they are back on Stubby, without the draft.
  }
}

/** Reads the resume note without taking it. Null, and the note is dropped, when it is older than 30 minutes, has no time on it, or doesn't read. */
export function peekResume(now = Date.now()): SignUpResume | null {
  try {
    const raw = window.sessionStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { draft?: unknown; send?: unknown; at?: unknown };
    if (!v || typeof v.at !== "number" || now - v.at > MAX_AGE_MS || typeof v.draft !== "string") {
      window.sessionStorage.removeItem(RESUME_KEY);
      return null;
    }
    return { draft: v.draft.slice(0, 200), send: v.send === true };
  } catch {
    return null;
  }
}

/** Takes the resume note: read once, then gone. */
export function takeResume(now = Date.now()): SignUpResume | null {
  const v = peekResume(now);
  try {
    window.sessionStorage.removeItem(RESUME_KEY);
  } catch {
    // Nothing to clear.
  }
  return v;
}

/**
 * Where someone who just signed up from Stubby belongs while they are on their way back: the Stubby
 * page, whether the return is still waiting (SignUpReturnEffect has not run yet) or it has already
 * run and set the resume note (AskStubby clears that once it has picked the ask back up). Home reads
 * this so its "signed in, go to Home" redirect cannot override the trip back, whichever of the two
 * runs first. Both notes lapse after 30 minutes. Null for everyone else.
 */
export function signUpLanding(now = Date.now()): "/calendar" | null {
  return peekReturn(now) || peekResume(now) ? "/calendar" : null;
}
