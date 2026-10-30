import { isStep, stepIndex, type OnboardingStep } from "../pages/onboarding/steps";

/**
 * The last onboarding screen a person finished, so reopening the app resumes
 * there. Kept on this device for now; the account migration adds
 * `profile_private.onboarding_step` and this is the one place to switch over.
 */
const key = (userId: string) => `soosh.onboarding.step.${userId}`;

export function readLastFinished(userId: string | undefined): OnboardingStep | null {
  if (!userId) return null;
  try {
    const value = localStorage.getItem(key(userId));
    return isStep(value) ? value : null;
  } catch {
    return null;
  }
}

/** Only ever moves forward: finishing an earlier screen again does not lose later progress. */
export function writeLastFinished(userId: string | undefined, step: OnboardingStep): void {
  if (!userId) return;
  const current = readLastFinished(userId);
  if (current && stepIndex(current) >= stepIndex(step)) return;
  try {
    localStorage.setItem(key(userId), step);
  } catch {
    // Private mode or full storage: resume falls back to the first screen.
  }
}

export function clearLastFinished(userId: string | undefined): void {
  if (!userId) return;
  try {
    localStorage.removeItem(key(userId));
  } catch {
    // Nothing stored, nothing to clear.
  }
}

/** The later of two saved steps (this device's and the account's). */
export function laterStep(a: OnboardingStep | null, b: OnboardingStep | null): OnboardingStep | null {
  if (!a) return b;
  if (!b) return a;
  return stepIndex(a) >= stepIndex(b) ? a : b;
}

// Two small things that have to survive a page leaving and coming back:
// the email a code was sent to (only for this tab), and where an invite or
// link was going (across the Google or Apple round trip, which lands on the site root).
const EMAIL_KEY = "soosh.onboarding.email";
const REDIRECT_KEY = "soosh.onboarding.redirect";

export function rememberEmail(email: string): void {
  try {
    sessionStorage.setItem(EMAIL_KEY, email);
  } catch {
    // The code screen sends people back to type it again.
  }
}
export function readEmail(): string {
  try {
    return sessionStorage.getItem(EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

/** True for a real in-app destination: a path, not the bare site root, not "//host" or a backslash trick. */
export const isRealRedirect = (target: string | null | undefined): target is string =>
  !!target && target !== "/" && target.startsWith("/") && !target.startsWith("//") && !target.includes("\\");

export function rememberRedirect(target: string): void {
  if (!isRealRedirect(target)) return;
  try {
    localStorage.setItem(REDIRECT_KEY, target);
  } catch {
    // Without it the person lands on Discover, which is fine.
  }
}
/** Reads the kept destination without clearing it (a render can run twice). Clear it with takeRedirect when the flow ends. */
export function peekRedirect(): string | null {
  try {
    const value = localStorage.getItem(REDIRECT_KEY);
    return isRealRedirect(value) ? value : null;
  } catch {
    return null;
  }
}
export function takeRedirect(): string | null {
  try {
    const value = localStorage.getItem(REDIRECT_KEY);
    localStorage.removeItem(REDIRECT_KEY);
    return isRealRedirect(value) ? value : null;
  } catch {
    return null;
  }
}

// "Want a password too?" is offered once, right after an email code is accepted
// (never to Google or Apple, which have no code step). It is not one of the
// numbered screens, so it is a flag that makes the name screen show the offer
// first; for this tab only.
const OFFER_KEY = "soosh.onboarding.passwordOffer";
export function markPasswordOffer(): void {
  try {
    sessionStorage.setItem(OFFER_KEY, "1");
  } catch {
    // Without it the offer is simply not shown.
  }
}
export function readPasswordOffer(): boolean {
  try {
    return sessionStorage.getItem(OFFER_KEY) === "1";
  } catch {
    return false;
  }
}
export function clearPasswordOffer(): void {
  try {
    sessionStorage.removeItem(OFFER_KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
}
