/**
 * Where a person goes once they are signed in. Someone who left onboarding
 * unfinished goes back into it (it resumes after their last finished screen
 * and never restarts from the welcome); everyone else goes where they were
 * headed, or Home.
 */
export function signedInTarget(profile: { onboarding_completed?: boolean } | null, redirectTo: string): string {
  if (profile && profile.onboarding_completed === false) {
    return `/onboarding?redirect=${encodeURIComponent(redirectTo)}`;
  }
  return redirectTo;
}
