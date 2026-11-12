import { fetchPasses, fetchTaste } from "./tasteRemote";
import { capabilityProfileFromTaste, type PersonalCapabilityProfileV1 } from "./capabilityProfile";

import { supabase } from "../../lib/supabase";
import { emptyCapability, parseCapability, type CapabilityProfile } from "./capabilityProfile";
type Client = typeof supabase;
async function owner(client: Client, expectedUserId?: string): Promise<string> {
  if (!client) throw new Error("Log in to save what Stubby knows.");
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || data.user.is_anonymous) throw new Error("Log in to save what Stubby knows.");
  if (expectedUserId && data.user.id !== expectedUserId) throw new Error("Your account changed. Reload before saving.");
  return data.user.id;
}
export async function fetchCapability(client: Client = supabase, expectedUserId?: string): Promise<CapabilityProfile> {
  const id = await owner(client, expectedUserId);
  const { data, error } = await client!.from("stubby_capabilities").select("profile").eq("user_id", id).maybeSingle();
  if (error) throw new Error("Stubby couldn’t load your saved information. Try again.");
  return data ? parseCapability(data.profile) : emptyCapability();
}
export async function saveCapability(profile: CapabilityProfile, client: Client = supabase, expectedUserId?: string): Promise<void> {
  const id = await owner(client, expectedUserId);
  const clean = parseCapability(profile);
  const { error } = await client!.from("stubby_capabilities").upsert({ user_id: id, profile: clean }, { onConflict: "user_id" });
  if (error) throw new Error("Your changes weren’t saved. Try again.");
}
/** One transaction revokes consent and removes the extension and feedback, without deleting onboarding. */
export async function deleteCapability(client: Client = supabase, expectedUserId?: string): Promise<void> {
  const id = await owner(client, expectedUserId);
  const { error } = await client!.rpc("forget_stubby_memory", { expected_user: id });
  if (error) throw new Error("Your saved information wasn’t deleted. Try again.");
}

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
  await owner(supabase, authenticatedUserId);
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
