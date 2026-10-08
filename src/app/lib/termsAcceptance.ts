import { supabase } from "../../lib/supabase";

/** Sign-up has a required "I'm 16 or older and agree to the Terms and Privacy
 * Policy" checkbox. The client only ever SIGNALS acceptance; the time is
 * stamped by the database (public.accept_terms() uses now() and takes no
 * arguments), so nothing the browser says can set or back-date it.
 *
 * Ticking the box at sign-up parks a plain flag here until there is a session
 * to call the function with: email sign-up may only get a session after the
 * confirmation link, and Google leaves the page entirely.
 *
 * The function comes from a migration that ships separately from this code.
 * "Function not found" and "column not found" are both treated as "nothing to
 * do yet", so the app works the same before and after that migration runs. */
const PENDING_KEY = "sushii-terms-accepted-pending";

export function rememberTermsAcceptance() {
  try {
    localStorage.setItem(PENDING_KEY, "1");
  } catch {
    // Storage blocked: onboarding asks again instead.
  }
}

function hasPendingAcceptance(): boolean {
  try {
    return localStorage.getItem(PENDING_KEY) === "1";
  } catch {
    return false;
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

/** Asks the database to record acceptance for the signed-in account. Never
 * sends a time. Returns true once it is recorded. */
async function callAcceptTerms(): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc("accept_terms");
  return !error;
}

/** Sends a pending acceptance, once. Keeps it when the function isn't
 * deployed yet or the call failed, so the next sign-in tries again. */
export async function flushTermsAcceptance(): Promise<void> {
  if (!hasPendingAcceptance()) return;
  if (await callAcceptTerms()) clearPendingAcceptance();
}

/** True only when this account is known to have no recorded acceptance. A
 * read error, including the column not existing yet, answers false so nobody
 * is blocked by something they can't fix. */
export async function needsTermsAcceptance(userId: string): Promise<boolean> {
  if (!supabase) return false;
  await flushTermsAcceptance();
  const { data, error } = await supabase
    .from("profiles")
    .select("terms_accepted_at")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return false;
  return (data as { terms_accepted_at: string | null }).terms_accepted_at == null;
}

/** Records acceptance for the signed-in account (the one-time prompt and the
 * onboarding fallback). */
export async function recordTermsAcceptance(): Promise<{ error: string | null }> {
  if (!supabase) return { error: "retry" };
  const { error } = await supabase.rpc("accept_terms");
  if (!error) {
    clearPendingAcceptance();
    return { error: null };
  }
  // Before the migration runs there is nothing to record and nobody to block.
  return { error: isNotDeployedYet(error.code) ? null : "retry" };
}
