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
