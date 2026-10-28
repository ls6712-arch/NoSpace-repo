import { canonicalCorner } from "../data/hobbies";
import { postCorner, type Post } from "../data/posts";

/**
 * Which Corner a Moment counts under, after merges (hobbies.ts, MERGED_CORNERS):
 * a Moment tagged Espresso is a Coffee Moment. Stored Moments are never
 * rewritten; every read that groups or filters by Corner goes through here.
 */
export function postCornerKey(post: Pick<Post, "hobbySlug" | "corner" | "subHobby">): string | undefined {
  const c = postCorner(post);
  if (!c) return undefined;
  const k = canonicalCorner(post.hobbySlug, c);
  return `${k.spaceSlug}/${k.slug}`;
}

/** True when the Moment belongs to this Corner, counting Corners merged into it. */
export function isInCorner(post: Pick<Post, "hobbySlug" | "corner" | "subHobby">, spaceSlug: string, slug: string): boolean {
  const k = canonicalCorner(spaceSlug, slug);
  return postCornerKey(post) === `${k.spaceSlug}/${k.slug}`;
}
