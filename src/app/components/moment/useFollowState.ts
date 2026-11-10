import { useCallback, useEffect, useSyncExternalStore } from "react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { follow } from "../../lib/profileFollows";
import { LOCAL_CLEARED_EVENT } from "../../lib/localData";

/**
 * Who you follow and who follows you, read once for the whole page so a feed
 * of Moments asks the database one time, not once per card. It answers the
 * one question a Moment's header has: which Follow button, if any.
 */
export type FollowLabel = "Follow" | "Follow back" | "Requested";

interface Graph {
  userId: string | null;
  /** People I follow or have asked to follow: their id, and whether they accepted. */
  mine: Map<string, "pending" | "accepted">;
  /** People who follow me. */
  followers: Set<string>;
  loaded: boolean;
}

let graph: Graph = { userId: null, mine: new Map(), followers: new Set(), loaded: false };
let loadingFor: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => graph;

if (typeof window !== "undefined") {
  window.addEventListener(LOCAL_CLEARED_EVENT, () => {
    graph = { userId: null, mine: new Map(), followers: new Set(), loaded: false };
    loadingFor = null;
    emit();
  });
}

async function load(userId: string) {
  if (!supabase || loadingFor === userId || (graph.userId === userId && graph.loaded)) return;
  loadingFor = userId;
  try {
    const [out, incoming] = await Promise.all([
      supabase.from("profile_follows").select("followed_id, status").eq("follower_id", userId).in("status", ["pending", "accepted"]),
      supabase.from("profile_follows").select("follower_id").eq("followed_id", userId).eq("status", "accepted"),
    ]);
    if (loadingFor !== userId) return;
    graph = {
      userId,
      mine: new Map((out.data ?? []).map((r) => [r.followed_id as string, r.status as "pending" | "accepted"])),
      followers: new Set((incoming.data ?? []).map((r) => r.follower_id as string)),
      // A failed read leaves no button rather than a wrong one.
      loaded: !out.error && !incoming.error,
    };
    emit();
  } finally {
    if (loadingFor === userId) loadingFor = null;
  }
}

/** For tests: start from a known graph. */
export function seedFollowGraph(next: { userId: string; following?: string[]; requested?: string[]; followers?: string[] }) {
  graph = {
    userId: next.userId,
    mine: new Map([...(next.following ?? []).map((id) => [id, "accepted"] as const), ...(next.requested ?? []).map((id) => [id, "pending"] as const)]),
    followers: new Set(next.followers ?? []),
    loaded: true,
  };
  emit();
}

/** Which button a Moment by `authorId` shows: none for yourself or someone you already follow. */
export function followLabel(g: Pick<Graph, "mine" | "followers">, authorId: string): FollowLabel | null {
  const status = g.mine.get(authorId);
  if (status === "accepted") return null;
  if (status === "pending") return "Requested";
  return g.followers.has(authorId) ? "Follow back" : "Follow";
}

export function useFollowState(authorId: string | undefined) {
  const { user } = useAuth();
  const g = useSyncExternalStore(subscribe, snapshot, snapshot);
  const userId = user?.id;
  useEffect(() => {
    if (userId) void load(userId);
  }, [userId]);

  const ready = !!userId && !!authorId && authorId !== userId && g.userId === userId && g.loaded;
  const label = ready ? followLabel(g, authorId!) : null;

  /** Asks to follow. Resolves true once the request is saved. */
  const request = useCallback(async (): Promise<boolean> => {
    if (!userId || !authorId) return false;
    const ok = await follow(userId, authorId);
    if (ok && graph.userId === userId) {
      const mine = new Map(graph.mine);
      mine.set(authorId, "pending");
      graph = { ...graph, mine };
      emit();
    }
    return ok;
  }, [userId, authorId]);

  return { label, request };
}
