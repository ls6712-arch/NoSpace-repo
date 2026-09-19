import { supabase } from "../../lib/supabase";

/** Reads public.profile_follows (sql/profile-follows.sql) — the one real
 * person-follows-person relationship, separate from hobby_follows
 * (interest-level) and the retired connections/PersonActions system.
 * Accept-based, same rule connections.sql enforced: a follow starts
 * 'pending' and only counts as a real follower once the followed person
 * accepts (respondToFollow below) — the same respondToConnection pattern,
 * just pointed at this table instead of the now-retired connections one.
 * Best-effort throughout: a signed-out visitor or an unconfigured project
 * both degrade to "0 followers, not following," never an error. */

export type FollowStatus = "none" | "pending" | "accepted" | "declined";

export interface IncomingFollowRequest {
  followerId: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: number;
}

export async function fetchFollowerCount(profileId: string): Promise<number> {
  if (!supabase) return 0;
  // A pending or declined row isn't a follower yet — only an accepted one is.
  const { count, error } = await supabase
    .from("profile_follows")
    .select("follower_id", { count: "exact", head: true })
    .eq("followed_id", profileId)
    .eq("status", "accepted");
  if (error || count === null) return 0;
  return count;
}

/** Every profile id `userId` follows and is accepted by — the "people you
 * follow" dimension My Space's contact sheet needs (docs/my-space-spec.md
 * section 2). No bulk version of this existed before; fetchFollowStatus
 * above only ever checked one profile at a time. */
export async function fetchFollowingIds(userId: string): Promise<string[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("profile_follows")
    .select("followed_id")
    .eq("follower_id", userId)
    .eq("status", "accepted");
  if (error || !data) return [];
  return data.map((row) => row.followed_id as string);
}

export async function fetchFollowStatus(viewerId: string, profileId: string): Promise<FollowStatus> {
  if (!supabase) return "none";
  const { data } = await supabase
    .from("profile_follows")
    .select("status")
    .eq("follower_id", viewerId)
    .eq("followed_id", profileId)
    .maybeSingle();
  return (data?.status as FollowStatus | undefined) ?? "none";
}

/** Sends a follow request, or re-sends one after a decline or an unfollow —
 * upsert rather than a plain insert, since the composite primary key means a
 * second request after either of those would otherwise collide instead of
 * resetting back to pending. */
export async function follow(viewerId: string, profileId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("profile_follows")
    .upsert(
      { follower_id: viewerId, followed_id: profileId, status: "pending", responded_at: null },
      { onConflict: "follower_id,followed_id" },
    );
  return !error;
}

/** Withdraws a pending request, or ends an accepted follow — both are the
 * same delete; there's nothing left to accept or decline either way. */
export async function unfollow(viewerId: string, profileId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("profile_follows")
    .delete()
    .eq("follower_id", viewerId)
    .eq("followed_id", profileId);
  return !error;
}

/** The followed person answering a pending request — only they can, per
 * sql/profile-follows.sql's own update policy. */
export async function respondToFollow(
  followerId: string,
  followedId: string,
  accept: boolean,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("profile_follows")
    .update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
    .eq("follower_id", followerId)
    .eq("followed_id", followedId);
  return !error;
}

/** Requests waiting on you specifically — what Inbox's Requests tab lists,
 * the same shape ConnectionsContext once built for the now-retired
 * connections table. */
export async function fetchIncomingFollowRequests(userId: string): Promise<IncomingFollowRequest[]> {
  if (!supabase) return [];
  const { data: rows } = await supabase
    .from("profile_follows")
    .select("follower_id, created_at")
    .eq("followed_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  const followerIds = (rows ?? []).map((r: any) => r.follower_id as string);
  if (followerIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", followerIds);
  const byId = new Map((profiles ?? []).map((p: any) => [p.id as string, p]));

  return (rows ?? []).map((r: any) => {
    const p = byId.get(r.follower_id);
    return {
      followerId: r.follower_id,
      displayName: p?.display_name?.trim() || "Someone",
      avatarUrl: p?.avatar_url ?? undefined,
      createdAt: new Date(r.created_at).getTime(),
    };
  });
}
