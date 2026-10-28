import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { useSocial } from "../context/SocialContext";
import { fetchFollowingIds } from "../lib/profileFollows";
import { supabase } from "../../lib/supabase";
import type { Post } from "../data/posts";
import { buildFeed } from "../lib/homeFeed";
import { FeedCard } from "../components/home/FeedCard";
import { PursuitBar } from "../components/home/PursuitBar";
import { HomeEmpty } from "../components/home/HomeEmpty";
import { MomentDetail } from "../components/MomentDetail";
import { Loadable } from "../components/ui/skeleton";
import { MomentGridSkeleton } from "../components/Skeletons";
import { ErrorNotice } from "../components/StateViews";
import { haptic, pop } from "../lib/motionTokens";

const PULL_THRESHOLD = 64;

/**
 * Home (screen 8): the Pursuit you are working on, then Moments from the
 * people you follow, newest first. At most about one card in four is a Space
 * promotion (a stranger's Moment from a Space you are in or a Corner you
 * follow); a friend's Moment at a Space is a friend card and never counts
 * toward that. With nothing from your people yet it shows the empty view
 * (screen 14). The old grid is still at /my-space/all.
 */
export function HomeFeed() {
  const { user } = useAuth();
  const { publicFeed, postsStatus, reloadPosts } = useContent();
  const social = useSocial();
  const [searchParams, setSearchParams] = useSearchParams();
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [spacePostIds, setSpacePostIds] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState(!user);
  const [refreshing, setRefreshing] = useState(false);
  const [pull, setPull] = useState(0);
  const touchStart = useRef<number | null>(null);

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
    })().catch((err) => console.warn("[HomeFeed] Space Moments load failed:", err));
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const followedCorners = useMemo(() => new Set(social.followedHobbies), [social.followedHobbies]);
  const feed = useMemo(
    () => buildFeed(publicFeed, { meId: user?.id, followingIds, spacePostIds, followedCorners }),
    [publicFeed, user?.id, followingIds, spacePostIds, followedCorners],
  );

  const openId = searchParams.get("m") ? Number(searchParams.get("m")) : null;
  const openPost = openId != null ? (publicFeed.find((p) => p.id === openId) ?? null) : null;
  const open = (post: Post) => {
    const next = new URLSearchParams(searchParams);
    next.set("m", String(post.id));
    setSearchParams(next, { replace: true });
  };
  const close = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("m");
    setSearchParams(next, { replace: true });
  };

  const refresh = async () => {
    setRefreshing(true);
    haptic();
    try {
      await reloadPosts();
    } finally {
      setRefreshing(false);
      setPull(0);
    }
  };

  const loading = postsStatus === "loading" || !loaded;

  return (
    <div
      className="mx-auto w-full max-w-md px-4 pb-8 pt-4"
      onTouchStart={(e) => {
        touchStart.current = window.scrollY <= 0 ? e.touches[0].clientY : null;
      }}
      onTouchMove={(e) => {
        if (touchStart.current == null || refreshing) return;
        setPull(Math.max(0, Math.min(PULL_THRESHOLD * 1.5, e.touches[0].clientY - touchStart.current)));
      }}
      onTouchEnd={() => {
        touchStart.current = null;
        if (pull >= PULL_THRESHOLD) void refresh();
        else setPull(0);
      }}
    >
      <motion.div
        aria-live="polite"
        animate={{ height: refreshing ? 32 : pull > 8 ? Math.min(pull / 2, 32) : 0, opacity: refreshing || pull > 8 ? 1 : 0 }}
        transition={pop}
        className="flex items-center justify-center overflow-hidden text-small text-muted-foreground"
      >
        {refreshing ? "Refreshing…" : pull >= PULL_THRESHOLD ? "Let go to refresh" : "Pull to refresh"}
      </motion.div>

      <h1 className="mb-4 text-title font-semibold">Home</h1>

      <PursuitBar />

      <Loadable loading={loading} skeleton={<MomentGridSkeleton count={2} />}>
        {postsStatus === "error" && feed.length === 0 ? (
          <ErrorNotice onRetry={reloadPosts} />
        ) : feed.length === 0 ? (
          <HomeEmpty />
        ) : (
          <>
            <div>
              {feed.map((item, i) => (
                <FeedCard key={item.post.id} post={item.post} source={item.source} onOpen={open} priority={i === 0} />
              ))}
            </div>
            <p className="mt-6 text-center text-small text-muted-foreground">You’re caught up</p>
            <p className="mt-2 text-center">
              <Link to="/my-space/all" className="text-small text-accent-text underline-offset-4 hover:underline">
                See all Moments
              </Link>
            </p>
          </>
        )}
      </Loadable>

      <MomentDetail post={openPost} owned={false} onOpenChange={(o) => !o && close()} />
    </div>
  );
}
