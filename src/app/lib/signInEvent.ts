import type { User } from "@supabase/supabase-js";
import { track } from "./analytics";

/** An account this new counts as a sign-up rather than a log-in. */
const NEW_ACCOUNT_MS = 10 * 60 * 1000;
const SENT_KEY = "soosh.analytics.signin";

/**
 * "sign_up" for an account made in the last few minutes, "login" for anyone
 * else. The method is the sign-in provider only (email, google, apple).
 */
export function signInEvent(
  user: Pick<User, "created_at" | "app_metadata">,
  now: number,
): { name: "sign_up" | "login"; method: string } {
  const created = Date.parse(user.created_at);
  const isNew = Number.isFinite(created) && now - created < NEW_ACCOUNT_MS;
  const provider = typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider : "email";
  return { name: isNew ? "sign_up" : "login", method: provider };
}

/**
 * Supabase sends SIGNED_IN again when a tab regains focus, so this sends one
 * event per account per browser tab session.
 */
export function trackSignIn(user: User) {
  try {
    if (sessionStorage.getItem(SENT_KEY) === user.id) return;
    sessionStorage.setItem(SENT_KEY, user.id);
  } catch {
    // Private mode: send anyway.
  }
  track(signInEvent(user, Date.now()));
}
