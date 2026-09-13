/**
 * A local fallback for "has this browser finished onboarding" — the real
 * flag is profiles.onboarding_completed_at (see sql/profile-onboarding.sql),
 * checked first. This only matters when there's no account to hang that
 * flag off yet: Supabase isn't configured, or the save on finishing
 * onboarding failed to reach it. Without this, either case would show the
 * 3-step setup again on every visit.
 *
 * Registered in localData.ts's LOCAL_KEYS: without that, this flag would
 * survive a sign-out and let the next account on a shared browser skip
 * onboarding it never actually did.
 */
const KEY = "nospace.onboarding.completed.v1";

export function localOnboardingDone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markLocalOnboardingDone() {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // best effort — a private window shouldn't block finishing onboarding
  }
}
