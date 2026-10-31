import type { Post } from "../data/posts";
import { classifyFeed, type FeedInputs } from "./homeFeed";
import type { DiscoverMoment } from "./discover";

/**
 * "What {city} is making": the Moments discover_moments() returned, as the Posts
 * the app already holds, minus anything Home would show. A Moment is on one or the
 * other, never both. The server already leaves out followed authors and joined
 * Spaces' Moments; this also drops a stranger's Moment that Home promotes because
 * of a Corner the person follows, using Home's own classifier so the two cannot
 * drift apart.
 */

/** True when Home's feed would carry this Moment. */
export function homeWouldShow(post: Post, inputs: FeedInputs): boolean {
  const { friends, spaces } = classifyFeed([post], inputs);
  return friends.length + spaces.length > 0;
}

export function postCornerKey(post: Pick<Post, "hobbySlug" | "corner" | "subHobby">): string {
  const corner = (post.corner ?? post.subHobby ?? "").trim().toLowerCase();
  return corner ? `${post.hobbySlug}/${corner}` : "";
}

/**
 * Posts for the page, in the server's order. `hiddenAuthors` is who the person
 * followed from this page since the fetch (hidden at once, no reload).
 */
export function discoverFeed(
  moments: readonly DiscoverMoment[],
  posts: readonly Post[],
  home: FeedInputs,
  hiddenAuthors: ReadonlySet<string> = new Set(),
): Post[] {
  const byId = new Map(posts.map((p) => [p.id, p]));
  const seen = new Set<number>();
  const out: Post[] = [];
  for (const m of moments) {
    const post = byId.get(m.postId);
    if (!post || seen.has(post.id)) continue;
    if (post.userId && post.userId === home.meId) continue;
    if (post.userId && hiddenAuthors.has(post.userId)) continue;
    if (homeWouldShow(post, home)) continue;
    seen.add(post.id);
    out.push(post);
  }
  return out;
}

const DAY = 86_400_000;

/**
 * The Corners above the feed: the most Moments in the feed in the last day (all
 * the loaded ones when fewer than three Corners have anything that recent), three
 * to five of them. Ties go to the Corner key, so the order is steady.
 */
export function feedCornerChips(posts: readonly Post[], now: number, max = 5, min = 3): string[] {
  const count = (list: readonly Post[]) => {
    const counts = new Map<string, number>();
    for (const p of list) {
      const key = postCornerKey(p);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  };
  const rank = (counts: Map<string, number>) =>
    [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([key]) => key);
  const today = rank(count(posts.filter((p) => now - p.createdAt <= DAY)));
  const keys = today.length >= min ? today : [...today, ...rank(count(posts)).filter((k) => !today.includes(k))];
  return keys.slice(0, max);
}
