import type { Post } from "../data/posts";
import { postCorner } from "../data/posts";
import { cornerHasStill } from "./cornerPicture";
import { yourCorners, type HomeCorner } from "./homeYourCorners";
import { pickKey } from "./tasteRemote";

/** The most Corners the Home row shows. */
export const HOME_ROW_CORNERS = 6;

type FeedPost = Pick<Post, "hobbySlug" | "subHobby" | "corner" | "createdAt">;

/**
 * Which Corners the Home row shows, and whether they are the person's own.
 *
 * Someone who follows Corners sees only those, the most recently active first (the newest public Moment in each,
 * from the feed the app already holds; a Corner with none keeps its place after the ones that have one).
 * Anyone else sees the Corners with a 3D world: their onboarding picks first, then by `my_corner_affinity()`,
 * then the rest in catalog order. A visitor has no picks and no affinity, so catalog order.
 */
export function homeCornersRow(o: {
  followed: readonly string[];
  /** Every known Corner, in catalog order. */
  known: readonly HomeCorner[];
  feed: readonly FeedPost[];
  /** Onboarding picks, as "space-slug/corner-slug". */
  picks: readonly string[];
  /** `my_corner_affinity()`, by "space-slug/corner-slug". */
  affinity: ReadonlyMap<string, number>;
  limit?: number;
}): { corners: HomeCorner[]; yours: boolean } {
  const limit = o.limit ?? HOME_ROW_CORNERS;
  const mine = yourCorners(o.followed, o.known, [], Number.POSITIVE_INFINITY);
  if (mine.corners.length > 0) {
    const newest = new Map<string, number>();
    for (const post of o.feed) {
      const slug = postCorner(post);
      if (slug && post.createdAt > (newest.get(slug) ?? 0)) newest.set(slug, post.createdAt);
    }
    // Array.sort is stable, so Corners with no Moment in the feed stay in the order they were followed.
    const corners = [...mine.corners].sort((a, b) => (newest.get(b.slug) ?? 0) - (newest.get(a.slug) ?? 0));
    return { corners: corners.slice(0, limit), yours: true };
  }
  const key = (c: HomeCorner) => pickKey(c.spaceSlug, c.slug);
  const seen = new Set<string>();
  // The Corner itself, once: not a Corner that was merged into it (that one opens the same page).
  const withWorld = o.known.filter((c) => cornerHasStill(c.spaceSlug, c.slug) && key(c) === `${c.spaceSlug}/${c.slug}` && !seen.has(c.slug) && seen.add(c.slug));
  const pickAt = (c: HomeCorner) => {
    const i = o.picks.indexOf(key(c));
    return i < 0 ? Number.POSITIVE_INFINITY : i;
  };
  const corners = [...withWorld].sort((a, b) => pickAt(a) - pickAt(b) || (o.affinity.get(key(b)) ?? 0) - (o.affinity.get(key(a)) ?? 0));
  return { corners: corners.slice(0, limit), yours: false };
}
