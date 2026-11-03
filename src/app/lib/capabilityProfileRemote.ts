import { fetchPasses, fetchTaste } from "./tasteRemote";
import { capabilityProfileFromTaste, type PersonalCapabilityProfileV1 } from "./capabilityProfile";

/**
 * Read-only bridge from existing onboarding data into Stubby's capability
 * contract. No new table, no migration, and no production behavior change.
 * Caller must pass the authenticated user's ID; Supabase RLS remains the
 * authorization boundary.
 */
export async function fetchCapabilityProfile(
  authenticatedUserId: string,
  nowUtc: string = new Date().toISOString(),
): Promise<PersonalCapabilityProfileV1> {
  if (!authenticatedUserId.trim()) throw new Error("Authenticated user required");
  const [taste, passes] = await Promise.all([
    fetchTaste(authenticatedUserId),
    fetchPasses(authenticatedUserId),
  ]);
  return capabilityProfileFromTaste({
    windows: taste.windows,
    monthlyBudget: taste.budget,
    passes,
    picks: taste.picks,
    updatedAtUtc: nowUtc,
  });
}
