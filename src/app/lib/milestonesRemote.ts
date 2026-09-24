import { supabase } from "../../lib/supabase";

/**
 * The rewards ledger (RewardsContext, localStorage) is the source of truth
 * for the owner's own view of which milestones are unlocked and which of
 * those they've shared — it works instantly, with or without an account.
 * This file is the one place that talks to the `shared_milestones` table
 * (sql/milestones.sql), used only for the one thing local storage can't do:
 * let a milestone the owner explicitly shared show up on their public
 * profile, in someone else's browser.
 *
 * Every function here is best-effort. A signed-out visitor, an unconfigured
 * Supabase project, or a table that hasn't been migrated yet all degrade to
 * "no shared milestones to show" rather than an error — the owner's own view
 * never depends on any of this succeeding.
 */

/** A stranger's-eye view of one person's shared milestones — never their
 * locked or unshared ones, enforced by the table's own row-level security as
 * well as this query. Returns [] rather than throwing when Supabase isn't
 * configured or the table doesn't exist yet. */
export async function fetchSharedMilestoneIds(userId: string): Promise<string[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("shared_milestones")
      .select("badge_id")
      .eq("user_id", userId);
    if (error || !data) return [];
    return data.map((row: any) => row.badge_id as string);
  } catch {
    return [];
  }
}

/** Marks one milestone shared. Not awaited by callers that don't need to
 * know whether it landed — the owner's own local ledger already reflects
 * the share immediately. */
export async function shareMilestone(userId: string, badgeId: string) {
  if (!supabase) return;
  try {
    await supabase.from("shared_milestones").upsert({ user_id: userId, badge_id: badgeId });
  } catch {
    // Best effort — the owner's own copy in the local ledger is unaffected.
  }
}

/** Returns a previously shared milestone to private. */
export async function unshareMilestone(userId: string, badgeId: string) {
  if (!supabase) return;
  try {
    await supabase.from("shared_milestones").delete().eq("user_id", userId).eq("badge_id", badgeId);
  } catch {
    // Best effort — the owner's own copy in the local ledger is unaffected.
  }
}
