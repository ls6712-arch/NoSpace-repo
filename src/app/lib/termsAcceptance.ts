import { supabase } from "../../lib/supabase";
import { TERMS_VERSION } from "../config";

/** Sign-up has a required "I'm 16 or older and agree to the Terms and Privacy
 * Policy" checkbox. The client only ever SIGNALS acceptance of one version;
 * the time is stamped by the database (public.accept_terms(p_version) uses
 * now() and has no time argument), so nothing the browser says can set or
 * back-date it. The version is TERMS_VERSION from config, the one place it is
 * written; a new version means no record exists for it, so people are asked
 * again.
 *
 * Ticking the box at sign-up parks the version here until there is a session
 * to call the function with: email sign-up may only get a session after the
 * confirmation link, and Google leaves the page entirely.
 *
 * The function and table come from a migration that ships separately from
 * this code. "Not found" on either is treated as "nothing to do yet", so the
 * app works the same before and after that migration runs. */
const PENDING_KEY = "sushii-terms-accepted-pending";

export function rememberTermsAcceptance() {
  try {
    localStorage.setItem(PENDING_KEY, TERMS_VERSION);
  } catch {
    // Storage blocked: onboarding asks again instead.
  }
}

function pendingAcceptance(): string | null {
  try {
    return localStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

function clearPendingAcceptance() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // Fine.
  }
}

// PGRST202 is PostgREST's "no such function"; 42883 is Postgres's own.
const isNotDeployedYet = (code?: string) => code === "PGRST202" || code === "42883";

/** Asks the database to record acceptance of the current version for the
 * signed-in account. The version is the only argument; there is no time. */
async function callAcceptTerms() {
  if (!supabase) return { error: { code: "no-client" } };
  return supabase.rpc("accept_terms", { p_version: TERMS_VERSION });
}

/** Sends a pending acceptance, once. Only a pending flag for the CURRENT
 * version counts: an older one is dropped, and the person is asked again.
 * Keeps it when the function isn't deployed yet or the call failed, so the
 * next sign-in tries again. */
export async function flushTermsAcceptance(): Promise<void> {
  const pending = pendingAcceptance();
  if (!pending) return;
  if (pending !== TERMS_VERSION) {
    clearPendingAcceptance();
    return;
  }
  const { error } = await callAcceptTerms();
  if (!error) clearPendingAcceptance();
}

/** True only when this account is known to have no record of the current
 * version. A read error, including the table not existing yet, answers false
 * so nobody is blocked by something they can't fix. */
export async function needsTermsAcceptance(userId: string): Promise<boolean> {
  if (!supabase) return false;
  await flushTermsAcceptance();
  const { data, error } = await supabase
    .from("terms_acceptances")
    .select("terms_version")
    .eq("user_id", userId)
    .eq("terms_version", TERMS_VERSION)
    .maybeSingle();
  if (error) return false;
  return !data;
}

/** Records acceptance of the current version for the signed-in account (the
 * one-time prompt and the onboarding fallback). */
export async function recordTermsAcceptance(): Promise<{ error: string | null }> {
  const { error } = await callAcceptTerms();
  if (!error) {
    clearPendingAcceptance();
    return { error: null };
  }
  // Before the migration runs there is nothing to record and nobody to block.
  return { error: isNotDeployedYet(error.code) ? null : "retry" };
}
