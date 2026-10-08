import { supabase } from "../../lib/supabase";

/** When someone ticks "I'm 16 or older and agree to the Terms and Privacy
 * policy" at sign-up, the time is parked here until there is a session to
 * write it with. Email sign-up may only get a session after the confirmation
 * link, and Google leaves the page entirely, so it has to survive both.
 *
 * profiles.terms_accepted_at comes from a migration that ships separately
 * from this code. Every read and write below treats a missing column as
 * "nothing to do" rather than an error, so the app works the same before and
 * after that migration runs. */
const PENDING_KEY = "sushii-terms-accepted-at";

export function rememberTermsAcceptance(now = new Date()) {
  try {
    localStorage.setItem(PENDING_KEY, now.toISOString());
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

/** Writes a pending acceptance onto the profile, once. Never overwrites an
 * earlier time. Resolves true once the profile holds a time (or there is
 * nothing it could hold), false when a write is still outstanding. */
export async function flushTermsAcceptance(userId: string): Promise<void> {
  const pending = pendingAcceptance();
  if (!supabase || !pending) return;
  const { error } = await supabase
    .from("profiles")
    .update({ terms_accepted_at: pending })
    .eq("id", userId)
    .is("terms_accepted_at", null);
  // A missing column (42703) is the pre-migration state: drop the pending
  // time. Any other error keeps it for the next sign-in.
  if (!error || error.code === "42703" || error.code === "PGRST204") {
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch {
      // Fine.
    }
  }
}

/** True only when this account is known to have no recorded acceptance.
 * A read error, including the column not existing yet, answers false so
 * nobody is blocked by something they can't fix. */
export async function needsTermsAcceptance(userId: string): Promise<boolean> {
  if (!supabase) return false;
  await flushTermsAcceptance(userId);
  const { data, error } = await supabase
    .from("profiles")
    .select("terms_accepted_at")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return false;
  return (data as { terms_accepted_at: string | null }).terms_accepted_at == null;
}

/** Records acceptance for the signed-in account (the onboarding fallback). */
export async function recordTermsAcceptance(userId: string): Promise<{ error: string | null }> {
  rememberTermsAcceptance();
  await flushTermsAcceptance(userId);
  return { error: pendingAcceptance() ? "retry" : null };
}
