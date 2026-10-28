import { supabase } from "../../lib/supabase";

/**
 * The host Space page puts Moments from members first and the host's own after,
 * each group newest first. Hosts' posts never push a member's Moment down.
 */
export function orderSpaceMoments<T extends { userId?: string; createdAt: number }>(moments: readonly T[], hostIds: ReadonlySet<string>): T[] {
  const newest = (a: T, b: T) => b.createdAt - a.createdAt;
  const isHost = (m: T) => !!m.userId && hostIds.has(m.userId);
  return [...moments.filter((m) => !isHost(m))].sort(newest).concat([...moments.filter(isHost)].sort(newest));
}

/**
 * Which of these Spaces have at least one approved Moment from someone who is not
 * a host (spaces_with_member_moments, 20261102000000). Null when it cannot be
 * answered (the function is not live yet, or the request failed): callers then
 * show every Space rather than none.
 */
export async function fetchSpacesWithMemberMoments(spaceIds: readonly string[]): Promise<Set<string> | null> {
  if (spaceIds.length === 0) return new Set();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc("spaces_with_member_moments", { p_space_ids: [...spaceIds] });
    if (error || !Array.isArray(data)) return null;
    return new Set(data as string[]);
  } catch {
    return null;
  }
}

/** Keeps the Spaces that have member Moments. With no answer (null) every Space stays. */
export function keepSpacesWithMemberMoments<T extends { id: string }>(spaces: readonly T[], withMoments: ReadonlySet<string> | null): T[] {
  return withMoments ? spaces.filter((s) => withMoments.has(s.id)) : [...spaces];
}

/** Fetches, then keeps. For the lists that show Spaces to people who are not in them. */
export async function onlySpacesWithMemberMoments<T extends { id: string }>(spaces: readonly T[]): Promise<T[]> {
  return keepSpacesWithMemberMoments(spaces, await fetchSpacesWithMemberMoments(spaces.map((s) => s.id)));
}
