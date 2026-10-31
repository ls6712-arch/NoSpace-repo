import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useSocial } from "../context/SocialContext";
import { fetchFollowingIds } from "./profileFollows";
import type { FeedInputs } from "./homeFeed";

/**
 * Everything Home's feed rule needs about the signed-in person: who they follow,
 * which Moments were approved into a Space they are an active member of, and the
 * Corners they follow. Home uses it to build its feed and Discover uses the same
 * thing to leave out whatever Home would show, so the two cannot disagree.
 */
export function useFeedInputs(): { inputs: FeedInputs; loaded: boolean } {
  const { user } = useAuth();
  const social = useSocial();
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [spacePostIds, setSpacePostIds] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState(!user);

  useEffect(() => {
    if (!user) return;
    fetchFollowingIds(user.id)
      .then(setFollowingIds)
      .finally(() => setLoaded(true));
  }, [user?.id]);

  useEffect(() => {
    const client = supabase;
    if (!user || !client) return;
    let cancelled = false;
    (async () => {
      const { data: memberships } = await client.from("space_members").select("space_id").eq("user_id", user.id).eq("status", "active");
      const spaceIds = (memberships ?? []).map((m) => m.space_id as string);
      if (spaceIds.length === 0) return;
      const { data: moments } = await client
        .from("space_moments")
        .select("post_id")
        .in("space_id", spaceIds)
        .eq("status", "approved")
        .eq("removed_by_host", false);
      if (!cancelled) setSpacePostIds(new Set((moments ?? []).map((m) => m.post_id as number)));
    })().catch((err) => console.warn("[feed inputs] Space Moments load failed:", err));
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const followedCorners = useMemo(() => new Set(social.followedHobbies), [social.followedHobbies]);
  const inputs = useMemo<FeedInputs>(
    () => ({ meId: user?.id, followingIds, spacePostIds, followedCorners }),
    [user?.id, followingIds, spacePostIds, followedCorners],
  );
  return { inputs, loaded };
}
