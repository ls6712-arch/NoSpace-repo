import { allSubHobbies, isBrowsableCorner } from "../data/hobbies";
import { supabase } from "../../lib/supabase";
import { postCornerKey } from "./cornerAlias";
import type { Post } from "../data/posts";

export interface CornerSuggestion {
  spaceSlug: string;
  slug: string;
  name: string;
}

export const MAX_CORNER_SUGGESTIONS = 3;
export const CITY_WINDOW_DAYS = 7;

function toSuggestion(key: string): CornerSuggestion | undefined {
  const [spaceSlug, slug] = key.split("/");
  const sub = allSubHobbies.find((s) => s.hobbySlug === spaceSlug && s.slug === slug);
  if (!sub || !isBrowsableCorner(spaceSlug, slug)) return undefined;
  return { spaceSlug, slug, name: sub.label };
}

/**
 * Corner keys ("space/slug") from the Moments someone posted, the Corner of the
 * most recent Moment first, each Corner once.
 */
export function cornersPostedIn(posts: readonly Pick<Post, "hobbySlug" | "corner" | "subHobby" | "createdAt">[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of [...posts].sort((a, b) => b.createdAt - a.createdAt)) {
    const k = postCornerKey(p);
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

/** Followed Corner slugs to keys, in the order they were followed, for the Corners that exist. */
export function followedCornerKeys(slugs: readonly string[]): string[] {
  const out: string[] = [];
  for (const slug of slugs) {
    const sub = allSubHobbies.find((s) => s.slug === slug);
    if (sub) out.push(`${sub.hobbySlug}/${sub.slug}`);
  }
  return out;
}

/** City counts to keys, most Moments first (ties A to Z by key, so the order is stable). */
export function topCityCorners(counts: ReadonlyMap<string, number>): string[] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);
}

/**
 * Up to three Corners to offer on Posted for a Moment that has none. Only ever
 * offered: nothing is applied until the person taps a chip. In order: Corners
 * they have posted in (most recent first), then Corners they follow, then the
 * most-posted Corners in their city this week. Never alphabetical, each Corner
 * once, and none the Moment already has.
 */
export function rankCornerSuggestions(input: {
  postedIn: readonly string[];
  followed: readonly string[];
  inCity: readonly string[];
}): CornerSuggestion[] {
  const out: CornerSuggestion[] = [];
  const seen = new Set<string>();
  for (const key of [...input.postedIn, ...input.followed, ...input.inCity]) {
    if (out.length >= MAX_CORNER_SUGGESTIONS) break;
    if (seen.has(key)) continue;
    seen.add(key);
    const s = toSuggestion(key);
    if (s) out.push(s);
  }
  return out;
}

/**
 * Public Moments from the last 7 days whose place names this city, counted by
 * Corner. Moments with their place hidden are left out. A failure is an empty map.
 */
export async function fetchCityCornerCounts(city: string, now = Date.now()): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const q = city.trim().replace(/[%,()]/g, " ").trim();
  if (!supabase || !q) return counts;
  try {
    const since = new Date(now - CITY_WINDOW_DAYS * 86400000).toISOString();
    const { data, error } = await supabase
      .from("posts")
      .select("hobby_slug, sub_hobby, corner")
      .eq("visibility", "public")
      .neq("location_privacy", "hidden")
      .ilike("location_name", `%${q}%`)
      .gte("created_at", since)
      .limit(500);
    if (error || !data) return counts;
    for (const row of data) {
      const k = postCornerKey({ hobbySlug: row.hobby_slug as string, corner: (row.corner as string) ?? undefined, subHobby: (row.sub_hobby as string) ?? undefined });
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  } catch {
    /* best effort */
  }
  return counts;
}
