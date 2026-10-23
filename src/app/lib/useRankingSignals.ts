import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { useSocial } from "../context/SocialContext";
import { fetchFollowing } from "./profileFollows";
import { hasRealMedia } from "../components/MomentCard";
import { postCorner, type Post } from "../data/posts";
import { mergeWeights, DEFAULT_WEIGHTS, type CornerEvent, type Interaction, type RankPost, type RankingWeights, type Signals } from "./ranking";
import { cornerKey } from "./ranking/types";

/** A Moment as the ranking reads it: nothing but the fields RankPost names. */
export function toRankPost(post: Post, thoughtCount = 0): RankPost {
  return {
    id: post.id,
    userId: post.userId,
    createdAt: post.createdAt,
    visibility: post.visibility,
    type: post.type,
    hasMedia: hasRealMedia(post),
    hobbySlug: post.hobbySlug,
    corner: postCorner(post),
    caption: post.caption,
    loveCount: post.loveCount ?? 0,
    inCount: post.inCount ?? 0,
    thoughtCount,
  };
}

interface Remote {
  followedAt: Map<string, number>;
  people: Map<string, { name: string; avatarUrl?: string }>;
  reactions: { postId: number; type: string; at: number }[];
  reportedMomentIds: Set<number>;
  sharedPursuitWith: Map<string, number>;
  weights: RankingWeights;
}

const EMPTY: Remote = {
  followedAt: new Map(),
  people: new Map(),
  reactions: [],
  reportedMomentIds: new Set(),
  sharedPursuitWith: new Map(),
  weights: DEFAULT_WEIGHTS,
};

/**
 * Gathers what the ranking needs about the signed-in viewer, from what the app
 * already loads (Moments, thoughts, requests, messages, blocks) and a few small
 * reads of the viewer's own rows (who they follow and since when, their own
 * reactions, their open reports, the Pursuits they share, and the tuned
 * weights in app_config). Everything is the viewer's own data: reactions on a
 * Moment are only ever read for the person who left them.
 */
export function useRankingSignals() {
  const { user } = useAuth();
  const { publicFeed, myPosts } = useContent();
  const social = useSocial();
  const [remote, setRemote] = useState<Remote>(EMPTY);
  const client = supabase;

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    (async () => {
      const weightsRow = await client.from("app_config").select("value").eq("key", "ranking_weights").maybeSingle();
      const weights = mergeWeights(weightsRow.data?.value);
      if (!user) {
        if (!cancelled) setRemote({ ...EMPTY, weights });
        return;
      }
      const [follows, people, reactions, reports, mine] = await Promise.all([
        client.from("profile_follows").select("followed_id, created_at").eq("follower_id", user.id).eq("status", "accepted"),
        fetchFollowing(user.id),
        client.from("reactions").select("post_id, type, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(400),
        client.from("reports").select("target_id").eq("reporter_id", user.id).eq("target_kind", "moment").eq("status", "open"),
        client.from("pursuit_members").select("pursuit_id").eq("user_id", user.id).eq("status", "joined"),
      ]);
      const pursuitIds = (mine.data ?? []).map((r) => r.pursuit_id as string);
      const sharedPursuitWith = new Map<string, number>();
      if (pursuitIds.length > 0) {
        const others = await client
          .from("pursuit_members")
          .select("user_id, created_at")
          .in("pursuit_id", pursuitIds)
          .eq("status", "joined")
          .neq("user_id", user.id);
        for (const o of others.data ?? []) {
          const at = new Date(o.created_at as string).getTime();
          sharedPursuitWith.set(o.user_id as string, Math.max(sharedPursuitWith.get(o.user_id as string) ?? 0, at));
        }
      }
      if (cancelled) return;
      setRemote({
        followedAt: new Map((follows.data ?? []).map((f) => [f.followed_id as string, new Date(f.created_at as string).getTime()])),
        people: new Map(people.map((p) => [p.id, { name: p.displayName, avatarUrl: p.avatarUrl }])),
        reactions: (reactions.data ?? []).map((r) => ({ postId: r.post_id as number, type: r.type as string, at: new Date(r.created_at as string).getTime() })),
        reportedMomentIds: new Set((reports.data ?? []).map((r) => r.target_id as number).filter((n) => typeof n === "number")),
        sharedPursuitWith,
        weights,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [client, user?.id]);

  const rankPosts = useMemo(() => {
    // Thoughts the viewer can see on each Moment (all of them on their own; on others', the ones they may read).
    return publicFeed.map((p) => toRankPost(p, social.thoughtsFor(p.id).length));
  }, [publicFeed, social]);

  const signals = useMemo<Signals>(() => {
    const now = Date.now();
    const viewerId = user?.id ?? null;
    const authorOf = new Map<number, Post>();
    for (const p of publicFeed) authorOf.set(p.id, p);
    const interactions: Interaction[] = [];
    const cornerEvents: CornerEvent[] = [];
    const cornerOf = (p?: Post) => {
      const c = p ? postCorner(p) : undefined;
      return p && c ? cornerKey(p.hobbySlug, c) : undefined;
    };

    for (const r of remote.reactions) {
      const p = authorOf.get(r.postId);
      if (!p) continue;
      const key = cornerOf(p);
      if (r.type === "love") {
        if (p.userId) interactions.push({ authorId: p.userId, kind: "love", at: r.at });
        if (key) cornerEvents.push({ cornerKey: key, kind: "love", at: r.at });
      } else if (r.type === "in" && p.userId) {
        interactions.push({ authorId: p.userId, kind: "countMeIn", at: r.at });
      }
    }
    for (const p of publicFeed) {
      for (const t of social.thoughtsFor(p.id)) {
        if (t.userId !== viewerId) continue;
        if (p.userId) interactions.push({ authorId: p.userId, kind: "thought", at: t.createdAt });
        const key = cornerOf(p);
        if (key) cornerEvents.push({ cornerKey: key, kind: "thought", at: t.createdAt });
      }
    }
    for (const part of social.participations) {
      if (part.fromUser === viewerId && part.toUser) interactions.push({ authorId: part.toUser, kind: "countMeIn", at: part.createdAt });
    }
    for (const part of social.participations) {
      const other = part.fromUser === viewerId ? part.toUser : part.fromUser;
      if (!other) continue;
      for (const m of social.messagesFor(part.id)) {
        if (m.fromUser === viewerId) interactions.push({ authorId: other, kind: "message", at: m.createdAt });
      }
    }
    for (const [id, at] of remote.followedAt) interactions.push({ authorId: id, kind: "follow", at });
    for (const [id, at] of remote.sharedPursuitWith) interactions.push({ authorId: id, kind: "sharedPursuit", at });

    const ownMoments = myPosts.map((p) => ({ cornerKey: cornerOf(p) ?? null, createdAt: p.createdAt }));
    for (const m of ownMoments) if (m.cornerKey) cornerEvents.push({ cornerKey: m.cornerKey, kind: "own", at: m.createdAt });

    return {
      viewerId,
      now,
      following: new Map([...remote.followedAt.keys()].map((id) => [id, { name: remote.people.get(id)?.name ?? "Someone" }])),
      blockedIds: new Set(social.blockedIds),
      interactions,
      cornerEvents,
      hobbyFollowKeys: new Set(social.followedHobbies),
      ownMoments,
      reportedMomentIds: remote.reportedMomentIds,
      savedTicketKeys: new Set<string>(), // tickets can be saved from the next PR
    };
  }, [user?.id, publicFeed, myPosts, social, remote]);

  return { signals, weights: remote.weights, rankPosts, people: remote.people };
}
