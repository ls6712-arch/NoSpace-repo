import { supabase } from "../../lib/supabase";

/** Reads public.profile_follows (sql/profile-follows.sql) — the one real,
 * one-directional person-follows-person relationship, separate from
 * hobby_follows (interest-level) and the retired Clan/connections system.
 * Best-effort throughout: a signed-out visitor or an unconfigured project
 * both degrade to "0 followers, not following," never an error. */

export async function fetchFollowerCount(profileId: string): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("profile_follows")
    .select("follower_id", { count: "exact", head: true })
    .eq("followed_id", profileId);
  if (error || count === null) return 0;
  return count;
}

export async function fetchIsFollowing(viewerId: string, profileId: string): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase
    .from("profile_follows")
    .select("follower_id")
    .eq("follower_id", viewerId)
    .eq("followed_id", profileId)
    .maybeSingle();
  return !!data;
}

export async function follow(viewerId: string, profileId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("profile_follows")
    .insert({ follower_id: viewerId, followed_id: profileId });
  return !error;
}

export async function unfollow(viewerId: string, profileId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("profile_follows")
    .delete()
    .eq("follower_id", viewerId)
    .eq("followed_id", profileId);
  return !error;
}
