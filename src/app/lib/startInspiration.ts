import type { Post } from "../data/posts";
import { classifyFeed, type FeedInputs } from "./homeFeed";
import { postCornerKey } from "./discoverFeed";
import type { DiscoverMoment } from "./discover";

/**
 * "Made by others" on the Start page: photo Moments in this Corner that the
 * viewer can already see. Friends and followed Spaces first (newest first),
 * then public Moments from people they do not follow, in discover_moments()'s
 * order. Pure: the page passes in what it already holds.
 *
 * The Moments passed in are the ones the database already let this viewer read
 * (and the content layer already leaves out test accounts). On top of that this
 * drops anything that is not a shareable photo, the viewer's own Moments, and
 * anyone the viewer has blocked. It never returns a count.
 */

export const INSPIRATION_MAX = 12;

/** Only Moments that are not just for the author or their Pursuit's group. */
const SHAREABLE: ReadonlySet<Post["visibility"]> = new Set(["public", "followers", "space"]);

export const isInspiringPhoto = (p: Post): boolean =>
  p.type === "photo" && !p.isPrivateLog && !p.unsaved && SHAREABLE.has(p.visibility) && !!(p.mediaUrls?.[0] ?? p.media);

export function inspirationPosts(opts: {
  posts: readonly Post[];
  cornerKey: string;
  inputs: FeedInputs;
  discover?: readonly DiscoverMoment[];
  blockedIds?: readonly string[];
  limit?: number;
}): Post[] {
  const blocked = new Set(opts.blockedIds ?? []);
  const ok = (p: Post) => isInspiringPhoto(p) && postCornerKey(p) === opts.cornerKey && !(p.userId && (blocked.has(p.userId) || p.userId === opts.inputs.meId));
  const here = opts.posts.filter(ok);

  const { friends, spaces } = classifyFeed(here, opts.inputs);
  const out: Post[] = [];
  const seen = new Set<number>();
  const take = (p: Post) => {
    if (seen.has(p.id)) return;
    seen.add(p.id);
    out.push(p);
  };
  for (const f of friends) take(f.post);
  for (const s of spaces) take(s.post);
  const byId = new Map(here.map((p) => [p.id, p]));
  for (const m of opts.discover ?? []) {
    const p = byId.get(m.postId);
    if (p) take(p);
  }
  return out.slice(0, opts.limit ?? INSPIRATION_MAX);
}

/** A Moment from the URL's ?inspired=, or null when it is unknown, not a number, or not one the strip may show. */
export function inspiredPost(param: string | null, posts: readonly Post[], blockedIds: readonly string[] = [], meId?: string): Post | null {
  if (!param || !/^\d+$/.test(param)) return null;
  const p = posts.find((x) => x.id === Number(param));
  if (!p || !isInspiringPhoto(p) || (p.userId && (blockedIds.includes(p.userId) || p.userId === meId))) return null;
  return p;
}
